import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkSchedule } from '@/models/Schemas';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId } = await req.json();

        if (!employeeId) {
            return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
        }

        const schedule = await WorkSchedule.findOneAndUpdate(
            { employeeId },
            { status: "Approved" },
            { new: true }
        );

        if (!schedule) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Schedule approved successfully", schedule });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
