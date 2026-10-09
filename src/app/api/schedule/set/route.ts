import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkSchedule, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

// Same roles the Work Location and Flag Calendar screens allow
const SCHEDULE_EDITOR_ROLES = ["HOI", "AD", "OM", "HR", "FOUNDER"];

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only the roles that have a schedule screen can change a schedule (never the employee themselves)
        if (!SCHEDULE_EDITOR_ROLES.includes(actor.role)) {
            return NextResponse.json({ error: 'You are not allowed to change a work schedule.' }, { status: 403 });
        }

        const { employeeId, employeeName, date, location, clockInTime, clockOutTime } = await req.json();

        // 1. Hierarchical Permission Check (Conceptual)
        // HR can set for anyone. AD can set for HOI/Faculty. HOI can set for Faculty/OM.

        // The schedule takes effect as soon as it is saved. HR does not approve or reject it:
        // a change made by anyone other than HR is only flagged as unread for HR ("Pending")
        // until HR marks it as read ("Approved").
        const byHR = actor.role === "FOUNDER" || actor.role === "HR";
        const now = new Date().toISOString();
        const target = employeeName ? null : await Employee.findOne({ id: employeeId }).select('name');

        const schedule = await WorkSchedule.findOneAndUpdate(
            { employeeId, date },
            {
                location,
                clockInTime,
                clockOutTime,
                employeeName: employeeName || target?.name,
                assignedBy: actor.id,
                assignedByName: actor.name,
                changedAt: now,
                status: byHR ? "Approved" : "Pending",
                hrReadBy: byHR ? actor.id : null,
                hrReadByName: byHR ? actor.name : null,
                hrReadAt: byHR ? now : null
            },
            { upsert: true, new: true }
        );

        // A new change means the whole schedule of this employee is unread for HR again
        if (!byHR) {
            await WorkSchedule.updateMany(
                { employeeId, status: "Approved" },
                { $set: { status: "Pending", hrReadBy: null, hrReadByName: null, hrReadAt: null } }
            );
        }

        return NextResponse.json({ message: "Schedule updated", schedule });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        const date = searchParams.get('date');

        const query: any = {};
        if (employeeId) query.employeeId = employeeId;
        if (date) query.date = date;

        const schedules = await WorkSchedule.find(query);
        return NextResponse.json(schedules);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
