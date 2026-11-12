import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canOpenHolidayManagement, listHolidayRows, assignedEmployees, removeHoliday } from '@/lib/holiday-management';

export const dynamic = 'force-dynamic';

/**
 * Announcements → Holiday Management (HR / HR Executive / Founder: every holiday · HOI: its colleges only).
 *   GET                      → { rows, colleges, canManageAll }
 *   GET ?employees=<rowKey>  → employees the holiday row applies to (View Assigned Employees)
 *   POST { action: "remove", holidayId, collegeId | employeeId }  → remove from one college / one employee
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canOpenHolidayManagement(actor)) return NextResponse.json({ error: 'Holiday Management is for HR and HOI.' }, { status: 403 });
        const key = new URL(req.url).searchParams.get('employees');
        if (key) {
            const r: any = await assignedEmployees(actor, key);
            if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
            return NextResponse.json({ holiday: r.holiday, employees: r.employees });
        }
        return NextResponse.json(await listHolidayRows(actor));
    } catch (e: any) {
        console.error('holiday management GET', e);
        return NextResponse.json({ error: 'Could not load the holidays.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canOpenHolidayManagement(actor)) return NextResponse.json({ error: 'Holiday Management is for HR and HOI.' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        if (body.action !== 'remove') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        const r: any = await removeHoliday(actor, body);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ success: true, message: r.message, flagsRestored: r.restored });
    } catch (e: any) {
        console.error('holiday management POST', e);
        return NextResponse.json({ error: 'Could not remove the holiday.' }, { status: 500 });
    }
}