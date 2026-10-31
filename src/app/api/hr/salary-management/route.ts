import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Location } from '@/models/Schemas';
import { CorrectionTicket, PayableCorrection } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { canViewSalaryAdmin, canCorrectPayable, isMonth, istToday, monthLabel, payableForMany, salaryEmployees } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';
const PAGE = 25;
const OPEN = ['Open', 'Under Review', 'Additional Information Required'];

/**
 * GET — Employee Salary Management list (HR, HR Executive: manage · Founders: view only).
 * ?month= &q= &dept= &college= &designation= &tickets=pending &sort=name|payable|nonPayable|penalty &dir=asc|desc &page=
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
        const sort = sp.get('sort') || 'name', dir = sp.get('dir') === 'desc' ? -1 : 1;
        const page = Math.max(1, Number(sp.get('page')) || 1);

        const emps = await salaryEmployees(month);
        const [calcs, tickets, corrections, locs] = await Promise.all([
            payableForMany(emps, month),
            CorrectionTicket.find({}).select('id employeeId status month createdAt').lean(),
            PayableCorrection.find({ month }).select('employeeId status').lean(),
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
        const summary = {
            totalEmployees: rows.length,
            totalPayableDays: Math.round(rows.reduce((s, r) => s + r.payableDays, 0) * 100) / 100,
            totalNonPayableDays: Math.round(rows.reduce((s, r) => s + r.nonPayableDays, 0) * 100) / 100,
            pendingTickets: (tickets as any[]).filter(t => OPEN.includes(t.status)).length,
            resolvedTickets: (tickets as any[]).filter(t => t.status === 'Resolved').length,
            totalPenaltyDays: Math.round(rows.reduce((s, r) => s + r.penaltyDays, 0) * 100) / 100,
            corrections: (corrections as any[]).filter(c => c.status === 'ACTIVE').length,
        };
        const filtered = rows.filter(r => (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
            && (!dept || r.dept === dept) && (!college || r.location === college) && (!designation || r.designation === designation)
            && (!pendingOnly || r.tickets.pending > 0));
        const key: Record<string, (r: any) => any> = { name: r => r.name.toLowerCase(), payable: r => r.payableDays, nonPayable: r => r.nonPayableDays, penalty: r => r.penaltyDays, tickets: r => r.tickets.pending };
        const k = key[sort] || key.name;
        filtered.sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0) * dir || a.name.localeCompare(b.name));
        const uniq = (f: (r: any) => string) => Array.from(new Set(rows.map(f).filter(Boolean))).sort();
        return NextResponse.json({
            month, monthLabel: monthLabel(month), summary, total: filtered.length, page, pages: Math.max(1, Math.ceil(filtered.length / PAGE)),
            rows: sp.get('all') === '1' ? filtered : filtered.slice((page - 1) * PAGE, page * PAGE),
            filters: { depts: uniq(r => r.dept), designations: uniq(r => r.designation), colleges: Array.from(new Map(rows.filter(r => r.location).map(r => [r.location, r.locationName])).entries()).map(([id, name]) => ({ id, name })) },
            canEdit: canCorrectPayable(actor),
        });
    } catch (e: any) {
        console.error('salary-management GET', e);
        return NextResponse.json({ error: 'Could not load employee salary data.' }, { status: 500 });
    }
}