import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ExitRecord } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

/**
 * HR: remove an ex-employee from the portal.
 * Removal now happens only through the mandatory exit checklist (POST /api/hr/exit, action "complete"),
 * so the formalities are always recorded. This endpoint is kept for older clients and tells them where to go.
 */
export async function POST(request: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HR' && actor.role !== 'FOUNDER') {
            return NextResponse.json({ error: 'Only HR can remove an employee from the portal.' }, { status: 403 });
        }
        const { employeeId } = await request.json().catch(() => ({}));
        const done = employeeId ? await ExitRecord.findOne({ employeeId, status: 'COMPLETED' }).lean() : null;
        if (done) return NextResponse.json({ error: 'This employee has already been removed from the portal.' }, { status: 409 });
        return NextResponse.json({
            error: 'Complete the exit checklist first: Workforce → ⋮ → Delete Employee.',
            code: 'EXIT_CHECKLIST_REQUIRED',
        }, { status: 428 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
