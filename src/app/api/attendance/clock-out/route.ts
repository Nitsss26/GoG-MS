import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee, WorkSchedule, Location } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, time, date: overrideDate, isShortLeave, lat, lng } = await req.json();
        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        
        const today = overrideDate || (istTime.getFullYear() + "-" + 
                     (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" + 
                     istTime.getDate().toString().padStart(2, '0'));

        // 1. Fetch Employee
        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        const [outHours, outMins] = time.split(':').map(Number);
        const outTotalMins = outHours * 60 + outMins;

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const todayDayName = dayNames[istTime.getDay()];

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

        // 3. Enforce 12 PM Rule (Skip for overrides)
        if (!overrideDate && outHours < 12) {
            return NextResponse.json({ error: "Clock-out is only allowed after 12:00 PM." }, { status: 403 });
        }

        const isEarly = outTotalMins < schedTotalMins;
        const points = isEarly ? -5 : 2;

        // HOI with authorised attendance locations: the clock-out must be inside any one of them (it may differ from
        // the clock-in college); the actual clock-out location is stored separately. Other roles: unchanged.
        let clockOutLocation: string | null = null;
        const hoiAllowed: string[] = employee.role === "HOI" && Array.isArray(employee.attendanceLocations) ? employee.attendanceLocations.filter(Boolean) : [];
        if (hoiAllowed.length && !overrideDate) {
            const dayRec: any = await Attendance.findOne({ employeeId, date: today }).select('location workMode').lean();
            const remote = String(dayRec?.location || '').toLowerCase() === 'wfh';
            if (!remote) {
                if (typeof lat !== 'number' || typeof lng !== 'number') {
                    return NextResponse.json({ error: "Location coordinates missing from request." }, { status: 400 });
                }
                const allowed = await Location.find({ id: { $in: hoiAllowed } });
                const inside = allowed.find((c: any) => getDistance(lat, lng, c.lat, c.lng) <= (c.radiusKm || 2));
                if (!inside) {
                    return NextResponse.json({ error: "Not in geofence of any of your authorised attendance locations." }, { status: 403 });
                }
                clockOutLocation = inside.id;
            }
        }

        let updateFields: any = {
            clockOut: time,
            "flags.earlyOut": overrideDate ? false : isEarly
        };
        if (clockOutLocation) updateFields.clockOutLocation = clockOutLocation;
        if (isShortLeave) {
            updateFields["flags.shortLeave"] = true;
        }

        const record = await Attendance.findOneAndUpdate(
            { employeeId, date: today },
            { $set: updateFields },
            { new: true }
        );

        if (!record) {
            return NextResponse.json({ error: "Clock-in record not found for today" }, { status: 404 });
        }

        // 4. Update Employee Points
        const currentPeriod = "Mar 01 - Mar 15, 2026"; // Current period
        const employeeUpdate = await Employee.findOneAndUpdate(
            { id: employeeId, "monthlyScores.period": currentPeriod },
            { $inc: { "monthlyScores.$.points": points } },
            { new: true }
        );

        // If period not found, push new one
        if (!employeeUpdate) {
            await Employee.findOneAndUpdate(
                { id: employeeId },
                {
                    $push: {
                        monthlyScores: {
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