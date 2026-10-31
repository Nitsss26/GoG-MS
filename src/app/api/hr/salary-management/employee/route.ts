import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { CorrectionTicket, PayableCorrection } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { canViewSalaryAdmin, canCorrectPayable, isMonth, istToday, monthLabel, payableDaysFor, employeeCard, collegeName, CORRECTION_CATEGORIES, NON_PAYABLE_CATEGORIES } from '@/lib/salary-module';

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
        const managers: any[] = emp.reportsTo?.length ? await Employee.find({ id: { $in: emp.reportsTo } }).select('id name role').lean() : [];
        const [calc, corrections, tickets] = await Promise.all([
            payableDaysFor(emp, month),
            PayableCorrection.find({ employeeId: id }).sort({ correctedAt: -1 }).limit(200).lean(),
            CorrectionTicket.find({ employeeId: id }).sort({ createdAt: -1 }).lean(),
        ]);
        return NextResponse.json({
            employee: { ...employeeCard(emp, await collegeName(emp.location)), joiningDate: emp.joiningDate || '', reportingManager: managers.map(m => `${m.name} (${m.role})`).join(', ') },
            month, monthLabel: monthLabel(month), calc,
            corrections: (corrections as any[]).map(({ _id, __v, activeKey, ...c }) => c),
            tickets: (tickets as any[]).map(({ _id, __v, ...t }) => t),
            categories: CORRECTION_CATEGORIES, nonPayableCategories: NON_PAYABLE_CATEGORIES, canEdit: canCorrectPayable(actor) && id !== actor.id, self: id === actor.id,
        });
    } catch (e: any) {
        console.error('salary-management employee GET', e);
        return NextResponse.json({ error: 'Could not load the employee.' }, { status: 500 });
    }
}