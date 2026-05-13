import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, Attendance, WorkSchedule, Location } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';
import { COLLEGES } from '@/lib/colleges';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, lat, lng, dressCodeImageUrl } = await req.json();

        // 1. Fetch Employee
        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        // 2. Founder Exemption
        if (employee.role === "FOUNDER") {
            return NextResponse.json({ error: "Founders are exempt from clock-in/out" }, { status: 400 });
        }

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        
        const today = istTime.getFullYear() + "-" + 
                     (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" + 
                     istTime.getDate().toString().padStart(2, '0');
        
        const currentTime = istTime.getHours() * 60 + istTime.getMinutes();
        
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const todayDayName = dayNames[istTime.getDay()];

        // 3. Fetch Work Schedule or use Unified Config
        let schedule = await WorkSchedule.findOne({ 
            employeeId, 
            $or: [{ date: today }, { date: todayDayName }]
            // Removed status: "Approved" to allow HOI assignments to take immediate effect
        });

        let expectedIn = "09:30";
        let expectedLocationId = employee.location || "bhopal";

        if (schedule) {
            expectedIn = schedule.clockInTime;
            expectedLocationId = schedule.location;
        } else {
            // Use unified config fallback
            const resolved = getExpectedTimingInternal(employee.name, employee.location, today);
            expectedIn = resolved.in;
            expectedLocationId = resolved.location;
        }

        const [schedHours, schedMins] = expectedIn.split(':').map(Number);
        const schedTime = schedHours * 60 + schedMins;

        // 4. Window Timing Check
        const isLate = currentTime > schedTime;

        if (currentTime < schedTime - 30) {
            return NextResponse.json({ error: `Too early to clock-in. Window opens at ${Math.floor((schedTime - 30) / 60).toString().padStart(2, '0')}:${((schedTime - 30) % 60).toString().padStart(2, '0')}` }, { status: 403 });
        }

        // 5. Geofencing Check (Skip if WFH)
        const isWFH = expectedLocationId.toLowerCase() === "wfh";
        let campus = null;
        if (!isWFH) {
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                return NextResponse.json({ error: "Location coordinates missing from request." }, { status: 400 });
            }

            if (employee.role === "HOI" || employee.role === "OM" || employee.role === "MARKETING_TEAM" || employee.role === "TECH_TEAM") {
                const dbCampuses = await Location.find({});
                const map = new Map();
                for (const c of COLLEGES) map.set(c.id, c);
                for (const c of dbCampuses) map.set(c.id, c);
                const allCampuses = Array.from(map.values());

                let inAnyCampus = false;
                let closestCampus = null;
                for(const c of allCampuses) {
                    const d = getDistance(lat, lng, c.lat, c.lng);
                    if (d <= (c.radiusKm || 2)) {
                        inAnyCampus = true;
                        closestCampus = c;
                        break;
                    }
                }
                if (!inAnyCampus) {
                    return NextResponse.json({ error: "Not in geofence of any college." }, { status: 403 });
                }
                campus = closestCampus;
            } else {
                let dbCampus = await Location.findOne({ id: expectedLocationId });
                campus = dbCampus || COLLEGES.find(c => c.id === expectedLocationId);

                if (!campus) return NextResponse.json({ error: `Assigned campus location (${expectedLocationId}) not found` }, { status: 404 });

                const distance = getDistance(lat, lng, campus.lat, campus.lng);
                if (distance > (campus.radiusKm || 2)) {
                    return NextResponse.json({ error: `Not in geofence of ${campus.name}. Distance: ${distance.toFixed(2)}km` }, { status: 403 });
                }
            }
        }

        // 6. Clock-in
        const updateData: any = {
            clockIn: istTime.getHours().toString().padStart(2, '0') + ":" + istTime.getMinutes().toString().padStart(2, '0') + ":" + istTime.getSeconds().toString().padStart(2, '0'),
            location: isWFH ? "WFH" : campus?.id,
            status: "Present",
            dressCodeImageUrl: dressCodeImageUrl,
            dressCodeStatus: "Pending",
            ...(isLate ? { "flags.late": true } : {})
        };

        const attendance = await Attendance.findOneAndUpdate(
            { employeeId, date: today },
            { $set: updateData },
            { upsert: true, new: true }
        );

        // 7. Update Employee Points (+2 for correct clock-in)
        const currentPeriod = "Mar 01 - Mar 15, 2026";
        const points = 2;
        const employeeUpdate = await Employee.findOneAndUpdate(
            { id: employeeId, "monthlyScores.period": currentPeriod },
            { $inc: { "monthlyScores.$.points": points } },
            { new: true }
        );

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

        return NextResponse.json({ message: "Clock-in successful", record: attendance, pointsAwarded: points });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
