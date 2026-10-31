import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { payableDaysFor, isMonth, istToday, monthLabel, nowIso, employeeCard, collegeName } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/**
 * My Salary & Payable Days — always the logged-in employee only (no employeeId parameter is accepted).
 * GET ?month=YYYY-MM (default: current month)
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const emp = actor.employee?.toObject ? actor.employee.toObject() : actor.employee;
        const cur = istToday().slice(0, 7);
        const month = new URL(req.url).searchParams.get('month') || cur;
        if (!isMonth(month) || month > cur) return NextResponse.json({ error: 'Choose a valid month (not in the future).' }, { status: 400 });
        const calc = await payableDaysFor(emp, month);
        // months the employee can pick: from joining (max 24 back) up to now
        const months: string[] = [];
        const [y, m] = cur.split('-').map(Number);
        for (let i = 0; i < 24; i++) {
            const d = new Date(Date.UTC(y, m - 1 - i, 1));
            const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            if (emp.joiningDate && k < String(emp.joiningDate).slice(0, 7)) break;
            months.push(k);
        }
        return NextResponse.json({
            employee: employeeCard(emp, await collegeName(emp.location)),
            month, monthLabel: monthLabel(month), months: months.map(k => ({ value: k, label: monthLabel(k) })),
            calculatedAt: nowIso(), calc,
        });
    } catch (e: any) {
        console.error('my-payable-days GET', e);
        return NextResponse.json({ error: 'Could not load your payable days.' }, { status: 500 });
    }
}