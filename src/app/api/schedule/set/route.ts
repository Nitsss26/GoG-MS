import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkSchedule, Employee } from '@/models/Schemas';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, date, location, clockInTime, clockOutTime, assignedBy, role } = await req.json();

        // 1. Hierarchical Permission Check (Conceptual)
        // HR can set for anyone. AD can set for HOI/Faculty. HOI can set for Faculty/OM.

        const schedule = await WorkSchedule.findOneAndUpdate(
            { employeeId, date },
            {
                location,
                clockInTime,
                clockOutTime,
                assignedBy,
                status: (role === "FOUNDER" || role === "HR") ? "Approved" : "Pending"
            },
            { upsert: true, new: true }
        );

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
