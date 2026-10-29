import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, Attendance, WorkSchedule, Location, WorkFromHome } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';
import { COLLEGES } from '@/lib/colleges';
import { getSessionUser } from '@/lib/session-user';
import { recordViolation } from '@/lib/attendance-violations';
import { assignedLocationsOf, matchAssignedLocation, makeVisit, locationLabel, MAX_VISIT_ACCURACY_M, UNASSIGNED_LOCATION_ERROR, tracksDetectedAddress, matchedVisitExtras, recordUnmatchedAttempt, unmatchedPlace } from '@/lib/multi-location-attendance';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, lat, lng, dressCodeImageUrl, isShortLeave, mode, accuracy, preview } = await req.json();
        // Official time and date come only from this server's clock: any time / date / override sent by the browser is ignored
        const isOverride = false, overrideDate: string | undefined = undefined;
        // Only the logged-in employee can clock in for themself
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (actor.id !== employeeId) return NextResponse.json({ error: "You can only clock in for yourself." }, { status: 403 });
        if (dressCodeImageUrl !== undefined && dressCodeImageUrl !== null && (typeof dressCodeImageUrl !== 'string' || !/^https:\/\//i.test(dressCodeImageUrl) || dressCodeImageUrl.length > 2048)) {
            return NextResponse.json({ error: "Invalid attendance photo." }, { status: 400 });
        }

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
        
        const today = overrideDate || (istTime.getFullYear() + "-" + 
                     (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" + 
                     istTime.getDate().toString().padStart(2, '0'));
        
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

        if (!isOverride && currentTime < schedTime - 30) {
            return NextResponse.json({ error: `Too early to clock-in. Window opens at ${Math.floor((schedTime - 30) / 60).toString().padStart(2, '0')}:${((schedTime - 30) % 60).toString().padStart(2, '0')}` }, { status: 403 });
        }

        // HOI / OM with assigned attendance locations: detect the assigned location from the device position
        const assignedLocs = assignedLocationsOf(employee);
        const hasCoords = typeof lat === 'number' && typeof lng === 'number';
        const gpsAccuracy = typeof accuracy === 'number' && isFinite(accuracy) ? accuracy : undefined;
        const nowHMS = istTime.getHours().toString().padStart(2, '0') + ":" + istTime.getMinutes().toString().padStart(2, '0') + ":" + istTime.getSeconds().toString().padStart(2, '0');
        // HOI outside every assigned location: the clock-in is allowed at the actual GPS position, shown and stored as
        // "No Location Match" with the reverse-geocoded address (and logged for HR review). Other roles: refused as before.
        const refusedUnassigned = () => NextResponse.json({ error: UNASSIGNED_LOCATION_ERROR, unassignedLocation: true }, { status: 403 });
        const unmatchedPreview = (u: any, extra: any = {}) => NextResponse.json({
            preview: true, unmatched: true, locationMatchStatus: 'unmatched',
            detected: { id: u.place.id, name: u.place.name, unmatched: true }, detectedAddress: u.detectedAddress || null, attemptTime: nowHMS, ...extra,
        });

        // One attendance session per day: an existing clock-in is never overwritten or duplicated
        // (a double click / two tabs used to create a second record for the same date)
        if (!isOverride) {
            const existing: any = await Attendance.findOne({ employeeId, date: today }).select('clockIn clockInAt clockOut status location currentLocationId locationVisits workMode').lean();
            if (existing?.clockIn && existing.status !== 'Absent') {
                // HOI / OM: a clock-in at ANOTHER assigned location while the day is open is a location visit
                // (same daily record, same payable day, no new late check / points)
                const remoteDay = existing.workMode === 'WFH' || String(existing.location || '').toLowerCase() === 'wfh';
                if (assignedLocs.length && !existing.clockOut && !remoteDay) {
                    if (!hasCoords) return NextResponse.json({ error: "Location coordinates missing from request." }, { status: 400 });
                    if (gpsAccuracy !== undefined && gpsAccuracy > MAX_VISIT_ACCURACY_M) {
                        return NextResponse.json({ error: `GPS accuracy is too low (±${Math.round(gpsAccuracy)} m). Move to an open area and try again.`, gpsAccuracyLow: true }, { status: 422 });
                    }
                    const match = await matchAssignedLocation(lat, lng, assignedLocs);
                    const currentId = existing.currentLocationId || existing.location;
                    let place: any, extras: any = {}, unmatched: any = null;
                    if (match) {
                        place = match.location;
                    } else {
                        if (!tracksDetectedAddress(employee)) return refusedUnassigned();
                        unmatched = await unmatchedPlace(lat, lng);
                        place = unmatched.place; extras = unmatched.extras;
                    }
                    // same spot again: an assigned location by id; a "No Location Match" place within 300 m of the last one
                    const lastVisit: any = [...(existing.locationVisits || [])].reverse().find((v: any) => v.event !== 'CLOCK_OUT' && v.event !== 'UNMATCHED_ATTEMPT');
                    const samePlace = currentId === place.id || (!!unmatched && String(currentId || '').startsWith('GPS:') && typeof lastVisit?.lat === 'number' && getDistance(lat, lng, lastVisit.lat, lastVisit.lng) < 0.3);
                    if (preview) {
                        if (unmatched) return unmatchedPreview(unmatched, { currentLocationId: currentId, sameAsCurrent: samePlace });
                        return NextResponse.json({ preview: true, detected: { id: match!.location.id, name: locationLabel(match!.location), distanceKm: match!.distanceKm, ambiguous: match!.ambiguous }, currentLocationId: currentId, sameAsCurrent: samePlace });
                    }
                    const detected = match
                        ? { id: match.location.id, name: locationLabel(match.location), distanceKm: match.distanceKm, ambiguous: match.ambiguous }
                        : { id: place.id, name: place.name, unmatched: true };
                    if (samePlace) {
                        return NextResponse.json({ error: `You are already clocked in at ${detected.name}.`, record: existing, alreadyClockedIn: true, duplicate: true }, { status: 409 });
                    }
                    const time = istTime.getHours().toString().padStart(2, '0') + ":" + istTime.getMinutes().toString().padStart(2, '0') + ":" + istTime.getSeconds().toString().padStart(2, '0');
                    const visits: any[] = [];
                    // Day started before this feature: keep its first clock-in as the first visit
                    if (!(existing.locationVisits || []).some((v: any) => v.event === 'CLOCK_IN')) {
                        const firstLoc: any = await Location.findOne({ id: existing.location }).lean();
                        visits.push(makeVisit('CLOCK_IN', firstLoc || { id: existing.location }, existing.clockInAt ? new Date(existing.clockInAt) : now, existing.clockIn));
                    }
                    if (match) extras = await matchedVisitExtras(employee, lat, lng);
                    visits.push({ ...makeVisit('LOCATION_CLOCK_IN', place, now, time, lat, lng, gpsAccuracy), ...extras });
                    // Only if nothing changed since it was read (two quick requests cannot both add a visit)
                    const updated = await Attendance.findOneAndUpdate(
                        {
                            _id: existing._id, $or: [{ clockOut: { $exists: false } }, { clockOut: null }, { clockOut: '' }],
                            ...(existing.currentLocationId ? { currentLocationId: existing.currentLocationId } : { currentLocationId: { $exists: false } }),
                        },
                        { $set: { currentLocationId: place.id }, $push: { locationVisits: { $each: visits } } },
                        { new: true }
                    );
                    const ownVisitId = visits[visits.length - 1].id;
                    if (!updated || !(updated.locationVisits || []).some((v: any) => v.id === ownVisitId)) {
                        const latest: any = await Attendance.findById(existing._id).lean();
                        return NextResponse.json({ error: "This clock-in was already recorded.", record: latest, alreadyClockedIn: true, duplicate: true }, { status: 409 });
                    }
                    if (unmatched) {
                        await recordUnmatchedAttempt(employee, today, time, now, lat, lng, gpsAccuracy, assignedLocs, { timeline: false, outcome: 'Clocked In', detectedAddress: unmatched.detectedAddress }).catch(() => {});
                        return NextResponse.json({ message: `Clock-in recorded at ${detected.name} (No Location Match)`, record: updated, locationVisit: true, detected, locationMatchStatus: 'unmatched', detectedAddress: unmatched.detectedAddress || null });
                    }
                    return NextResponse.json({ message: `Location change recorded: ${detected.name}`, record: updated, locationVisit: true, detected, locationMatchStatus: tracksDetectedAddress(employee) ? 'matched' : undefined });
                }
                return NextResponse.json({ error: "You have already clocked in today.", record: existing, alreadyClockedIn: true }, { status: 409 });
            }
            // Preview before the first clock-in of the day (HOI / OM with assigned locations)
            if (preview && assignedLocs.length) {
                if (!hasCoords) return NextResponse.json({ error: "Location coordinates missing from request." }, { status: 400 });
                const match = await matchAssignedLocation(lat, lng, assignedLocs);
                if (!match) {
                    if (!tracksDetectedAddress(employee)) return refusedUnassigned();
                    return unmatchedPreview(await unmatchedPlace(lat, lng), { firstClockIn: true });
                }
                return NextResponse.json({ preview: true, firstClockIn: true, detected: { id: match.location.id, name: locationLabel(match.location), distanceKm: match.distanceKm, ambiguous: match.ambiguous } });
            }
        }
        if (preview) return NextResponse.json({ preview: true, detected: null });

        // Work From Home: an application covering today (approved, or still pending — then the attendance is provisional).
        // mode "WFH" = remote attendance, "OFFICE" = normal office attendance; without a mode an approved application means remote.
        // The employee's Original Location and schedule are not changed.
        const scheduledWfh = String(expectedLocationId || '').toLowerCase() === 'wfh';
        const wfhApp: any = await WorkFromHome.findOne({ employeeId, status: { $in: ['Approved', 'Pending'] }, startDate: { $lte: today }, endDate: { $gte: today } })
            .sort({ status: 1 }).select('id status workLocation').lean();
        if (mode === 'WFH' && !scheduledWfh && !wfhApp) {
            return NextResponse.json({ error: "No Work From Home application covers today. Apply for Work From Home first." }, { status: 403 });
        }
        const useWfhApp = !!wfhApp && !scheduledWfh && (mode === 'WFH' || (!mode && wfhApp.status === 'Approved'));
        if (useWfhApp) expectedLocationId = "WFH";
        if (mode === 'OFFICE' && scheduledWfh) {
            return NextResponse.json({ error: "Today is scheduled as Work From Home." }, { status: 400 });
        }

        // 5. Geofencing Check (Skip if WFH)
        const isWFH = expectedLocationId.toLowerCase() === "wfh";
        let campus = null;
        let hoiUnmatched: any = null; // HOI first clock-in outside every assigned location
        if (!isWFH && !isOverride) {
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                return NextResponse.json({ error: "Location coordinates missing from request." }, { status: 400 });
            }

            if (assignedLocs.length) {
                // HOI / OM with assigned attendance locations (HR → Work Location): the nearest assigned one whose
                // geofence contains the device; nowhere else
                const match = await matchAssignedLocation(lat, lng, assignedLocs);
                if (match) campus = match.location;
                else if (tracksDetectedAddress(employee)) {
                    hoiUnmatched = await unmatchedPlace(lat, lng);
                    campus = hoiUnmatched.place;
                } else return refusedUnassigned();
            } else if (employee.role === "HOI" || employee.role === "MARKETING_TEAM" || employee.role === "TECH_TEAM") {
                // (OM without allotted Clock-In Locations: only the scheduled / assigned location — the branch below)
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
            location: isWFH ? "WFH" : (isOverride ? (expectedLocationId || "Office") : hoiUnmatched ? hoiUnmatched.place.name : campus?.id),
            clockInAt: now,
            status: "Present",
            dressCodeImageUrl: dressCodeImageUrl,
            dressCodeStatus: isOverride ? "Approved" : "Pending",
            ...(dressCodeImageUrl ? { dressCodeSubmittedAt: now.toISOString() } : {}),
            ...(useWfhApp ? {
                workMode: "WFH", wfhApplicationId: wfhApp.id, wfhStatus: wfhApp.status, wfhReviewRequired: false,
                ...(wfhApp.workLocation ? { wfhWorkLocation: wfhApp.workLocation } : {}),
                // approximate position (about 100 m) when the browser shared it — never shown to other employees
                ...(typeof lat === 'number' && typeof lng === 'number' ? { wfhLocation: { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000, at: now.toISOString() } } : {}),
            } : {}),
            ...(isOverride ? {} : { attendanceSource: "SELF_CLOCK_IN" }),
            ...(isOverride ? {} : (isLate ? { "flags.late": true } : {}))
        };
        if (isShortLeave) {
            updateData["flags.shortLeave"] = true;
        }
        // HOI / OM with assigned locations: the first clock-in opens the day's location timeline
        if (assignedLocs.length && campus && !isWFH && !useWfhApp) {
            updateData.currentLocationId = campus.id;
            updateData.locationVisits = [{ ...makeVisit('CLOCK_IN', campus, now, updateData.clockIn, lat, lng, gpsAccuracy), ...(hoiUnmatched ? hoiUnmatched.extras : await matchedVisitExtras(employee, lat, lng)) }];
        }

        let attendance = await Attendance.findOneAndUpdate(
            { employeeId, date: today },
            { $set: updateData },
            { upsert: true, new: true }
        );
        // Two simultaneous requests can both insert: keep the first record of the day, remove the copies just created
        const sameDay: any[] = await Attendance.find({ employeeId, date: today }).sort({ _id: 1 }).select('_id').lean();
        if (sameDay.length > 1) {
            await Attendance.deleteMany({ _id: { $in: sameDay.slice(1).map(d => d._id) } });
            attendance = await Attendance.findById(sameDay[0]._id);
        }

        // HOI clock-in outside every assigned location: also logged for HR review
        if (hoiUnmatched) {
            await recordUnmatchedAttempt(employee, today, updateData.clockIn, now, lat, lng, gpsAccuracy, assignedLocs, { timeline: false, outcome: 'Clocked In', detectedAddress: hoiUnmatched.detectedAddress }).catch(() => {});
        }

        // Late Clock-In → warning / deduction email (once per day; short leave is not counted)
        if (isLate && !isShortLeave) {
            await recordViolation({ emp: employee, type: 'LATE_IN', date: today, scheduledTime: expectedIn, actualTime: updateData.clockIn, durationMins: currentTime - schedTime });
        }

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