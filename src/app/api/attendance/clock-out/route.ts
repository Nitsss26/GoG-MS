import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance } from '@/models/Schemas';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, time } = await req.json();
        const today = new Date().toISOString().split("T")[0];

        const record = await Attendance.findOneAndUpdate(
            { employeeId, date: today },
            {
                clockOut: time,
                $set: { "flags.earlyOut": parseInt(time.split(":")[0]) < 18 }
            },
            { new: true }
        );

        if (!record) {
            return NextResponse.json({ error: "Clock-in record not found for today" }, { status: 404 });
        }

        return NextResponse.json({ message: "Clock-out successful", record });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
