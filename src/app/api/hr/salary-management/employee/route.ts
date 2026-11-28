import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { CorrectionTicket, PayableCorrection, HrMonetaryPenalty } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { ReportingManager } from '@/models/ManagerAssignment';
import { displayManager } from '@/lib/display-manager';
import { hoiLocationsForMonth } from '@/lib/hoi-payable-locations';
import { canViewSalaryAdmin, canCorrectPayable, isMonth, istToday, monthLabel, payableDaysFor, employeeCard, collegeName, CORRECTION_CATEGORIES, NON_PAYABLE_CATEGORIES, HALF_DAY_REASONS, PENALTY_REASONS, MAX_PENALTY_AMOUNT } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/** GET ?id=EMPID&month=YYYY-MM — one employee's salary detail (HR, HR Executive, Founders) */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canViewSalaryAdmin(actor)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const sp = new URL(req.url).searchParams;
        const id = sp.get('id') || '';
        const cur = istToday().slice(0, 7);
        const month = sp.get('month') || cur;
        if (!isMonth(month) || month > cur) return NextResponse.json({ error: 'Choose a valid month.' }, { status: 400 });
        const emp: any = await Employee.findOne({ id }).lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        // Professor / Faculty / OM → HOI; everyone else → the manager HR assigned (lib/display-manager)
        const assignedRow: any = await ReportingManager.findOne({ employeeId: id }).lean().catch(() => null);
        const mgrIds = [...(Array.isArray(emp.reportsTo) ? emp.reportsTo : emp.reportsTo ? [emp.reportsTo] : []), ...(assignedRow?.managerId ? [assignedRow.managerId] : [])];
        const managerDocs: any[] = mgrIds.length ? await Employee.find({ id: { $in: mgrIds } }).select('id name role').lean() : [];
        const mgr = displayManager(emp, (x: string) => managerDocs.find(m => m.id === x), assignedRow?.managerId);
        const managers = mgr.people;
        const [calc, corrections, tickets, penalties] = await Promise.all([
            payableDaysFor(emp, month),
            PayableCorrection.find({ employeeId: id }).sort({ correctedAt: -1 }).limit(200).lean(),
            CorrectionTicket.find({ employeeId: id }).sort({ createdAt: -1 }).lean(),
            HrMonetaryPenalty.find({ employeeId: id }).sort({ createdAt: -1 }).limit(200).lean(),
        ]);
        // HOI only: the day's assigned location(s) and the actual clock-in location (+ field visit reason) — display only
        if (emp.role === 'HOI') {
            const locs = await hoiLocationsForMonth(emp, month).catch(() => null);
            if (locs) (calc as any).days = ((calc as any).days || []).map((d: any) => ({ ...d, hoiLocation: locs[d.date] || null }));
        }
        return NextResponse.json({
            employee: { ...employeeCard(emp, await collegeName(emp.location)), joiningDate: emp.joiningDate || '', reportingManager: managers.map((m: any) => m.role ? `${m.name} (${m.role})` : m.name).join(', '), reportingManagerLabel: mgr.label === 'HOI' ? 'HOI' : 'Reporting Manager' },
            month, monthLabel: monthLabel(month), calc,
            corrections: (corrections as any[]).map(({ _id, __v, activeKey, ...c }) => c),
            tickets: (tickets as any[]).map(({ _id, __v, ...t }) => t),
            penalties: (penalties as any[]).map(({ _id, __v, activeKey, history, ...p }) => ({ ...p, history: (history || []).map(({ _id, ...h }: any) => h) })),
            halfDayReasons: HALF_DAY_REASONS, penaltyReasons: PENALTY_REASONS, maxPenalty: MAX_PENALTY_AMOUNT,
            categories: CORRECTION_CATEGORIES, nonPayableCategories: NON_PAYABLE_CATEGORIES, canEdit: canCorrectPayable(actor) && (id !== actor.id || actor.role === 'HR'), self: id === actor.id,
        });
    } catch (e: any) {
        console.error('salary-management employee GET', e);
        return NextResponse.json({ error: 'Could not load the employee.' }, { status: 500 });
    }
}