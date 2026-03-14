import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee, WorkSchedule } from '@/models/Schemas';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, time } = await req.json();
        const today = new Date().toISOString().split("T")[0];

        // 1. Fetch Employee
        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        const [outHours, outMins] = time.split(':').map(Number);
        const outTotalMins = outHours * 60 + outMins;

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const todayDayName = dayNames[new Date().getDay()];

        // 2. Get Expected Out Time
        let schedule = await WorkSchedule.findOne({ 
            employeeId, 
            $or: [{ date: today }, { date: todayDayName }]
            // Removed status: "Approved" to allow HOI assignments to take immediate effect
        });

        let expectedOut = "18:30";
        if (schedule) {
            expectedOut = schedule.clockOutTime;
        } else {
            const expected = getExpectedTimingInternal(employee.name, employee.location || "Bhopal", today);
            expectedOut = expected.out;
        }

        const [schedHours, schedMins] = expectedOut.split(':').map(Number);
        const schedTotalMins = schedHours * 60 + schedMins;

        // 3. Enforce 12 PM Rule
        if (outHours < 12) {
            return NextResponse.json({ error: "Clock-out is only allowed after 12:00 PM." }, { status: 403 });
        }

        const isEarly = outTotalMins < schedTotalMins;
        const points = isEarly ? -5 : 2;

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

        // 4. Update Employee Points
        const currentPeriod = "Mar 01 - Mar 15, 2026"; // Current period
        const employeeUpdate = await Employee.findOneAndUpdate(
            { id: employeeId, "biWeeklyScores.period": currentPeriod },
            { $inc: { "biWeeklyScores.$.points": points } },
            { new: true }
        );

        // If period not found, push new one
        if (!employeeUpdate) {
            await Employee.findOneAndUpdate(
                { id: employeeId },
                {
                    $push: {
                        biWeeklyScores: {
                            period: currentPeriod,
                            score: 0,
                            points: points,
                            status: "Recording"
                        }
                    }
                }
            );
        }

        return NextResponse.json({ message: "Clock-out successful", record, pointsAwarded: points });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
