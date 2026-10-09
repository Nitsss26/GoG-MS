import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkSchedule } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

/**
 * HR acknowledges ("Mark as Read") a work schedule change.
 * There is no approve / reject decision: the schedule is already in effect when it is saved.
 * status "Approved" is the stored "read by HR" flag (kept so existing data and logic keep working).
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (actor.role !== "HR" && actor.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can mark a work schedule as read.' }, { status: 403 });
        }

        const { employeeId } = await req.json();

        if (!employeeId) {
            return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
        }

        const hrReadAt = new Date().toISOString();
        // A schedule is stored as one document per day, so every unread day is marked together
        const result = await WorkSchedule.updateMany(
            { employeeId, status: { $ne: "Approved" } },
            { $set: { status: "Approved", hrReadBy: actor.id, hrReadByName: actor.name, hrReadAt } }
        );

        const schedule = await WorkSchedule.findOne({ employeeId });
        if (!schedule) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Schedule marked as read", updated: result.modifiedCount, hrReadBy: actor.id, hrReadByName: actor.name, hrReadAt, schedule });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
