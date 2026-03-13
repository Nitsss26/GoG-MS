import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee } from '@/models/Schemas';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, time } = await req.json();
        const today = new Date().toISOString().split("T")[0];

        // 1. Fetch Employee
        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        // 2. Get Expected Out Time
        const expected = getExpectedTimingInternal(employee.name, employee.location || "Bhopal", today);
        const [schedHours, schedMins] = expected.out.split(':').map(Number);
        const schedTotalMins = schedHours * 60 + schedMins;

        const [outHours, outMins] = time.split(':').map(Number);
        const outTotalMins = outHours * 60 + outMins;

        const isEarly = outTotalMins < schedTotalMins;

        const record = await Attendance.findOneAndUpdate(
            { employeeId, date: today },
            {
                clockOut: time,
                $set: { "flags.earlyOut": isEarly }
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
