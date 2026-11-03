import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Location, WorkFromHome, WorkSchedule } from '@/models/Schemas';
import { CorrectionTicket, PayableCorrection } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { canViewSalaryAdmin, canCorrectPayable, isMonth, istToday, monthLabel, payableForMany, salaryEmployees } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';
const PAGE = 25;
const OPEN = ['Open', 'Under Review', 'Additional Information Required'];

/**
 * GET — Employee Salary Management list (HR, HR Executive: manage · Founders: view only).
 * ?month= &q= &dept= &college= &designation= &tickets=pending &penalty=1 &sort=name|payable|nonPayable|penalty &dir=asc|desc &page=
 * Same calculation as each employee's own "My Salary & Payable Days" (src/lib/payable-days.ts + HR corrections).
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canViewSalaryAdmin(actor)) return NextResponse.json({ error: 'Only HR, HR Executive or Founders can open Employee Salary Management.' }, { status: 403 });
        const sp = new URL(req.url).searchParams;
        const cur = istToday().slice(0, 7);
        const month = sp.get('month') || cur;
        if (!isMonth(month) || month > cur) return NextResponse.json({ error: 'Choose a valid month.' }, { status: 400 });
        const q = (sp.get('q') || '').trim().toLowerCase();
        const dept = sp.get('dept') || '', college = sp.get('college') || '', designation = sp.get('designation') || '';
        const pendingOnly = sp.get('tickets') === 'pending';
        const penaltyOnly = sp.get('penalty') === '1';
        const sort = sp.get('sort') || 'name', dir = sp.get('dir') === 'desc' ? -1 : 1;
        const page = Math.max(1, Number(sp.get('page')) || 1);

        const emps = await salaryEmployees(month);
        const [calcs, tickets, corrections, locs] = await Promise.all([
            payableForMany(emps, month),
            CorrectionTicket.find({}).select('id employeeId status month createdAt').lean(),
            PayableCorrection.find({ month }).select('id employeeId employeeName date direction status correctionCategory correctionReason correctedByName correctedByRole correctedAt').lean(),
            Location.find({}).select('id name').lean(),
        ]);
        const locName = (v: string) => (locs as any[]).find(l => l.id === v || l.name === v)?.name || v || '';
        const tBy = new Map<string, any[]>(); (tickets as any[]).forEach(t => { if (!tBy.has(t.employeeId)) tBy.set(t.employeeId, []); tBy.get(t.employeeId)!.push(t); });
        const rows = emps.map(e => {
            const c = calcs.get(e.id)!;
            const ts = tBy.get(e.id) || [];
            const pending = ts.filter(t => OPEN.includes(t.status)).length;
            return {
                id: e.id, name: e.name, role: e.role, dept: e.dept || '', designation: e.designation || e.current_designation_at_gog || '',
                location: e.location || '', locationName: locName(e.location),
                payableDays: c.payableDays, nonPayableDays: c.nonPayableDays, penaltyDays: c.penaltyDays, correctedDays: c.correctedDays, hrDeductedDays: c.hrDeductedDays,
                activeFlags: c.activeFlags, provisional: c.provisional,
                tickets: { pending, resolved: ts.filter(t => t.status === 'Resolved').length, total: ts.length },
            };
        });
        // Work From Home of the month: applied (WFH applications) and allotted (HR / manager work schedule = WFH)
        const mStart = `${month}-01`;
        const mEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
        const empIds = emps.map(e => e.id);
        const byEmp = new Map(rows.map(r => [r.id, r]));
        const [apps, scheds] = await Promise.all([
            WorkFromHome.find({ employeeId: { $in: empIds }, startDate: { $lte: mEnd }, endDate: { $gte: mStart }, status: { $ne: 'Cancelled' } })
                .select('id employeeId employeeName wfhType startDate endDate days status reason approverName').lean(),
            WorkSchedule.find({ employeeId: { $in: empIds }, location: 'WFH' }).select('employeeId employeeName date clockInTime clockOutTime assignedByName').lean(),
        ]);
        const monthDates: string[] = []; for (let d = new Date(`${mStart}T00:00:00Z`); d.toISOString().slice(0, 10) <= mEnd; d.setUTCDate(d.getUTCDate() + 1)) monthDates.push(d.toISOString().slice(0, 10));
        const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const wfhApplied = (apps as any[]).map(a => {
            const inMonth = monthDates.filter(d => d >= a.startDate && d <= a.endDate).length;
            return { id: a.id, employeeId: a.employeeId, employeeName: a.employeeName || byEmp.get(a.employeeId)?.name || a.employeeId, type: a.wfhType === 'HALF_DAY' ? 'Half Day' : 'Full Day',
                startDate: a.startDate, endDate: a.endDate, daysInMonth: a.wfhType === 'HALF_DAY' ? inMonth / 2 : inMonth, status: a.status, reason: a.reason || '', approverName: a.approverName || '' };
        }).sort((a, b) => a.startDate.localeCompare(b.startDate));
        const allotMap = new Map<string, { employeeId: string; employeeName: string; dates: Set<string>; weekdays: Set<string>; by: Set<string> }>();
        (scheds as any[]).forEach(w => {
            const dates = /^\d{4}-\d{2}-\d{2}$/.test(w.date) ? (w.date >= mStart && w.date <= mEnd ? [w.date] : []) : monthDates.filter(d => WD[new Date(`${d}T00:00:00Z`).getUTCDay()] === w.date);
            if (!dates.length) return;
            const cur = allotMap.get(w.employeeId) || { employeeId: w.employeeId, employeeName: byEmp.get(w.employeeId)?.name || w.employeeName || w.employeeId, dates: new Set<string>(), weekdays: new Set<string>(), by: new Set<string>() };
            dates.forEach(d => cur.dates.add(d)); if (!/^\d/.test(w.date)) cur.weekdays.add(w.date); if (w.assignedByName) cur.by.add(w.assignedByName);
            allotMap.set(w.employeeId, cur);
        });
        const wfhAllotted = Array.from(allotMap.values()).map(a => ({ employeeId: a.employeeId, employeeName: a.employeeName, days: a.dates.size, dates: Array.from(a.dates).sort(), weekdays: Array.from(a.weekdays), assignedBy: Array.from(a.by).join(', ') }))
            .sort((a, b) => b.days - a.days || a.employeeName.localeCompare(b.employeeName));
        const summary = {
            totalEmployees: rows.length,
            totalPayableDays: Math.round(rows.reduce((s, r) => s + r.payableDays, 0) * 100) / 100,
            totalNonPayableDays: Math.round(rows.reduce((s, r) => s + r.nonPayableDays, 0) * 100) / 100,
            wfhApplied: wfhApplied.length,
            wfhAppliedDays: wfhApplied.reduce((s, a) => s + a.daysInMonth, 0),
            wfhAllotted: wfhAllotted.reduce((s, a) => s + a.days, 0),
            wfhAllottedEmployees: wfhAllotted.length,
            pendingTickets: (tickets as any[]).filter(t => OPEN.includes(t.status)).length,
            resolvedTickets: (tickets as any[]).filter(t => t.status === 'Resolved').length,
            totalPenaltyDays: Math.round(rows.reduce((s, r) => s + r.penaltyDays, 0) * 100) / 100,
            corrections: (corrections as any[]).filter(c => c.status === 'ACTIVE').length,
        };
        const filtered = rows.filter(r => (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
            && (!dept || r.dept === dept) && (!college || r.location === college) && (!designation || r.designation === designation)
            && (!pendingOnly || r.tickets.pending > 0) && (!penaltyOnly || r.penaltyDays > 0));
        const key: Record<string, (r: any) => any> = { name: r => r.name.toLowerCase(), payable: r => r.payableDays, nonPayable: r => r.nonPayableDays, penalty: r => r.penaltyDays, tickets: r => r.tickets.pending };
        const k = key[sort] || key.name;
        filtered.sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0) * dir || a.name.localeCompare(b.name));
        const uniq = (f: (r: any) => string) => Array.from(new Set(rows.map(f).filter(Boolean))).sort();
        return NextResponse.json({
            month, monthLabel: monthLabel(month), summary, total: filtered.length, page, pages: Math.max(1, Math.ceil(filtered.length / PAGE)),
            rows: sp.get('all') === '1' ? filtered : filtered.slice((page - 1) * PAGE, page * PAGE),
            filters: { depts: uniq(r => r.dept), designations: uniq(r => r.designation), colleges: Array.from(new Map(rows.filter(r => r.location).map(r => [r.location, r.locationName])).entries()).map(([id, name]) => ({ id, name })) },
            canEdit: canCorrectPayable(actor),
            // lists behind the clickable summary cards
            details: {
                wfhApplied, wfhAllotted,
                corrections: (corrections as any[]).filter(c => c.status === 'ACTIVE').map(c => ({ id: c.id, employeeId: c.employeeId, employeeName: c.employeeName || byEmp.get(c.employeeId)?.name || c.employeeId, date: c.date, direction: c.direction || 'TO_PAYABLE', category: c.correctionCategory || '', reason: c.correctionReason || '', by: `${c.correctedByName || ''}${c.correctedByRole ? ` (${c.correctedByRole})` : ''}`, at: c.correctedAt })),
            },
        });
    } catch (e: any) {
        console.error('salary-management GET', e);
        return NextResponse.json({ error: 'Could not load employee salary data.' }, { status: 500 });
    }
}