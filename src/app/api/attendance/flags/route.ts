import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { managedEmployeeIds } from '@/lib/leave-scope';
import { listFlagsFor } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/**
 * GET ?employeeId=EMP&month=YYYY-MM — the employee's active attendance flags of the month (Flag Calendar):
 * Late Clock-In, Early Clock-Out, Missing Clock-Out, Dress Code (removed / waived flags are left out).
 * Own flags; HR / HR Executive / Founder: everyone; a manager: their reporting team.
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const sp = new URL(req.url).searchParams;
        const employeeId = String(sp.get('employeeId') || actor.id);
        const month = String(sp.get('month') || '');
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Choose a valid month.' }, { status: 400 });
        const allowed = employeeId === actor.id || ['HR', 'FOUNDER'].includes(actor.role) || (await managedEmployeeIds(actor)).has(employeeId);
        if (!allowed) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const rows = await listFlagsFor(employeeId, `${month}-01`, `${month}-31`);
        return NextResponse.json({
            flags: rows.map(r => ({ flagId: r.flagId, date: r.date, type: r.type, typeLabel: r.typeLabel, levelLabel: r.levelLabel, deduction: r.deduction, hrStatus: r.hrStatus, detail: r.detail })),
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e: any) {
        console.error('attendance flags GET', e?.message);
        return NextResponse.json({ error: 'Could not load flags.' }, { status: 500 });
    }
}