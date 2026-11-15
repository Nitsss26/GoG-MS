import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee, WorkSchedule, Location } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';
import { getSessionUser } from '@/lib/session-user';
import { recordViolation } from '@/lib/attendance-violations';
import { AttendanceViolation } from '@/models/Schemas';
import { assignedLocationsOf, matchAssignedLocation, makeVisit } from '@/lib/multi-location-attendance';
import { hoiDailyLocations } from '@/lib/hoi-daily-locations';
import { COLLEGES } from '@/lib/colleges';

/** Roles that may clock in inside ANY college geofence (when no attendance locations are allotted) — same as clock-in */
const ANY_COLLEGE_ROLES = ['HOI', 'MARKETING_TEAM', 'TECH_TEAM', 'PLACEMENT_INTERN_HEAD', 'TECH_INTERN'];
const OUT_OF_RANGE = (where: string) => `Out of range: you are outside ${where}. Clock-out is allowed only inside your clock-in location — move inside it and try again.`;

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, lat, lng, clockOutImageUrl, accuracy } = await req.json();
        // Short Leave is no longer used (an early clock-out is always an Early Clock-Out); a value sent by an old page is ignored
        const isShortLeave = false;
        // Official time and date come only from this server's clock: a time / date sent by the browser is ignored
        const overrideDate: string | undefined = undefined;
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (actor.id !== employeeId) return NextResponse.json({ error: "You can only clock out for yourself." }, { status: 403 });
        if (clockOutImageUrl !== undefined && clockOutImageUrl !== null && (typeof clockOutImageUrl !== 'string' || !/^https:\/\//i.test(clockOutImageUrl) || clockOutImageUrl.length > 2048)) {
            return NextResponse.json({ error: "Invalid attendance photo." }, { status: 400 });
        }
        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        
        const today = overrideDate || (istTime.getFullYear() + "-" + 
                     (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" + 
                     istTime.getDate().toString().padStart(2, '0'));

        // 1. Fetch Employee
        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        // Clock-out needs today's clock-in, and happens only once
        const dayRecord: any = await Attendance.findOne({ employeeId, date: today }).select('clockIn clockOut status').lean();
        if (!dayRecord?.clockIn || dayRecord.status === 'Absent') return NextResponse.json({ error: "You have not clocked in today." }, { status: 400 });
        if (dayRecord.clockOut) return NextResponse.json({ error: "You have already clocked out today.", record: dayRecord, alreadyClockedOut: true }, { status: 409 });

        const time = istTime.getHours().toString().padStart(2, '0') + ":" + istTime.getMinutes().toString().padStart(2, '0') + ":" + istTime.getSeconds().toString().padStart(2, '0');
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

        // Clock-out location = the same places the clock-in allows (one or several assigned locations, the college
        // geofence, or the clock-in location); outside → "Out of range" and the clock-out is not recorded.
        // No check on a Work From Home day, an HR-marked day, or an HOI field-visit / Automatic Location Fetch day.
        let clockOutLocation: string | null = null;
        let clockOutLoc: any = null;
        if (!overrideDate) {
            const dayRec: any = await Attendance.findOne({ employeeId, date: today }).select('location workMode attendanceSource fieldVisit').lean();
            const remote = dayRec?.workMode === 'WFH' || String(dayRec?.location || '').toLowerCase() === 'wfh';
            const hrMarked = dayRec?.attendanceSource === 'HR_MANUAL';
            const daily = employee.role === 'HOI' ? hoiDailyLocations(schedule, today) : { ids: [] as string[], autoFetch: false, set: false };
            const fieldDay = employee.role === 'HOI' && (!!dayRec?.fieldVisit || (daily.set && daily.autoFetch));
            if (!remote && !hrMarked && !fieldDay) {
                if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
                    return NextResponse.json({ error: "Location is needed to clock out. Allow location access and try again.", locationRequired: true }, { status: 400 });
                }
                const assigned: string[] = assignedLocationsOf(employee);
                if (assigned.length) {
                    // one or several assigned locations (HR → Work Location): inside any one of them
                    const match = await matchAssignedLocation(lat, lng, assigned);
                    if (!match) return NextResponse.json({ error: OUT_OF_RANGE('your assigned work locations'), outOfRange: true, unassignedLocation: true }, { status: 403 });
                    clockOutLoc = match.location;
                    clockOutLocation = match.location.id;
                } else {
                    const dbCampuses: any[] = await Location.find({}).lean();
                    const map = new Map<string, any>();
                    for (const c of COLLEGES as any[]) map.set(c.id, c);
                    for (const c of dbCampuses) map.set(c.id, c);
                    const inside = (c: any) => c && typeof c.lat === 'number' && typeof c.lng === 'number' && getDistance(lat, lng, c.lat, c.lng) <= (c.radiusKm || 2);
                    if (ANY_COLLEGE_ROLES.includes(employee.role)) {
                        // like the clock-in: inside any college geofence
                        const c = Array.from(map.values()).find(inside);
                        if (!c) return NextResponse.json({ error: OUT_OF_RANGE('every college location'), outOfRange: true }, { status: 403 });
                        clockOutLocation = c.id;
                    } else {
                        // the location the clock-in was made at (else today's scheduled / own location)
                        const ids = [dayRec?.location, schedule?.location, employee.location].map(x => String(x || '')).filter(Boolean);
                        const campus = ids.map(id => map.get(id) || Array.from(map.values()).find((c: any) => c.name === id)).find(Boolean);
                        if (campus) {
                            if (!inside(campus)) {
                                const d = getDistance(lat, lng, campus.lat, campus.lng);
                                return NextResponse.json({ error: `${OUT_OF_RANGE(campus.name || 'your clock-in location')} Distance: ${d.toFixed(2)} km`, outOfRange: true }, { status: 403 });
                            }
                            clockOutLocation = campus.id;
                        }
                    }
                }
            }
        }

        let updateFields: any = {
            clockOut: time,
            clockOutAt: now,
            ...(clockOutImageUrl ? { clockOutImageUrl } : {}),
            "flags.earlyOut": overrideDate ? false : isEarly
        };
        if (clockOutLocation) updateFields.clockOutLocation = clockOutLocation;

        // HOI / OM location timeline: the final clock-out closes the day's visits
        const timelineOps: any = clockOutLoc
            ? { $push: { locationVisits: makeVisit('CLOCK_OUT', clockOutLoc, now, time, lat, lng, typeof accuracy === 'number' ? accuracy : undefined) } }
            : {};
        if (clockOutLoc) updateFields.currentLocationId = clockOutLoc.id;

        // Only a record that is not clocked out yet (two clicks cannot overwrite the first clock-out)
        const record = await Attendance.findOneAndUpdate(
            { employeeId, date: today, $or: [{ clockOut: { $exists: false } }, { clockOut: null }, { clockOut: '' }] },
            { $set: updateFields, ...timelineOps },
            { new: true }
        );

        if (!record) {
            return NextResponse.json({ error: "You have already clocked out today.", alreadyClockedOut: true }, { status: 409 });
        }

        // Early Clock-Out → warning / deduction email (once per day; short leave is not counted)
        if (isEarly && !isShortLeave) {
            await recordViolation({ emp: employee, type: 'EARLY_OUT', date: today, scheduledTime: expectedOut, actualTime: time, durationMins: schedTotalMins - outTotalMins });
        }
        // A Missing Clock-Out alert already sent for today: note the later clock-out for HR
        await AttendanceViolation.updateOne({ key: `MISSING_OUT:${employeeId}:${today}` }, { $set: { laterClockOut: time } }).catch(() => {});

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