import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, Attendance, WorkSchedule, Location, WorkFromHome } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';
import { COLLEGES } from '@/lib/colleges';
import { getSessionUser } from '@/lib/session-user';
import { recordViolation } from '@/lib/attendance-violations';
import { createLateAtClockIn, discardLateAtClockIn, finishLateAtClockIn } from '@/lib/late-justification';
import { createAtClockIn as createLocationJustification, discardAtClockIn as discardLocationJustification, finishAtClockIn as finishLocationJustification } from '@/lib/location-justification';
import { assignedLocationsOf, matchAssignedLocation, makeVisit, locationLabel, MAX_VISIT_ACCURACY_M, UNASSIGNED_LOCATION_ERROR, tracksDetectedAddress, matchedVisitExtras, recordUnmatchedAttempt, unmatchedPlace, NO_ADDRESS_LABEL } from '@/lib/multi-location-attendance';
import { hoiDailyLocations, FIELD_VISIT_LOCATION, FIELD_VISIT_LABEL } from '@/lib/hoi-daily-locations';

/** Minutes after the scheduled clock-in time that still count as on time (more than 2 minutes late = Late Clock-In) */
const LATE_GRACE_MINUTES = 2;

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, lat, lng, dressCodeImageUrl, mode, accuracy, preview, lateReason, locationReason, fieldVisitReason } = await req.json();
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
        // A date-wise schedule entry wins over the weekday entry (Removed status: "Approved" to allow HOI assignments to take immediate effect)
        const schedRows: any[] = await WorkSchedule.find({ employeeId, $or: [{ date: today }, { date: todayDayName }] });
        let schedule = schedRows.find(r => r.date === today) || schedRows.find(r => r.date === todayDayName) || null;

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

        // HOI only: the colleges / Automatic Location Fetch HR selected for today's weekday (Every Mon … Sun).
        // A specific-date entry for today (single location) wins, exactly like the scheduled location above.
        const daily = employee.role === 'HOI' ? hoiDailyLocations(schedule, today) : { ids: [] as string[], autoFetch: false, set: false };

        const [schedHours, schedMins] = expectedIn.split(':').map(Number);
        const schedTime = schedHours * 60 + schedMins;

        // 4. Window Timing Check
        // Late Clock-In only after the grace period: up to LATE_GRACE_MINUTES after the scheduled time is on time
        // (e.g. 09:30 schedule → 09:32 is on time, 09:33 is late). The late duration is still counted from 09:30.
        const isLate = currentTime > schedTime + LATE_GRACE_MINUTES;

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
        // Outside every assigned location: blocked for HOI and OM alike (no bypass). The HOI attempt is still logged for HR.
        const blockUnassigned = async () => {
            if (hasCoords) await recordUnmatchedAttempt(employee, today, nowHMS, now, lat, lng, gpsAccuracy, assignedLocs, { outcome: 'Blocked' }).catch(() => {});
            return refusedUnassigned();
        };
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
                // HOI and OM: one clock-in per day like everyone else (no second clock-in at another location)
                if (assignedLocs.length && !['HOI', 'OM'].includes(employee.role) && !existing.clockOut && !remoteDay) {
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
                        return preview ? refusedUnassigned() : await blockUnassigned();
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
                    // HOI with Automatic Location Fetch today: an external place is allowed with a field visit reason
                    if (daily.set && daily.autoFetch) {
                        const fv = await unmatchedPlace(lat, lng);
                        return NextResponse.json({ preview: true, firstClockIn: true, fieldVisit: true, detected: { id: fv.place.id, name: fv.place.name, unmatched: true }, detectedAddress: fv.detectedAddress || null, late: isLate });
                    }
                    return refusedUnassigned();
                }
                const schedLoc = String(expectedLocationId || '');
                return NextResponse.json({ preview: true, firstClockIn: true, detected: { id: match.location.id, name: locationLabel(match.location), distanceKm: match.distanceKm, ambiguous: match.ambiguous },
                    scheduledLocationId: schedLoc, locationMismatch: daily.set ? !daily.ids.includes(match.location.id) : !!schedLoc && schedLoc.toLowerCase() !== 'wfh' && match.location.id !== schedLoc, late: isLate });
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
                else if (daily.set && daily.autoFetch) {
                    // CASE C with Automatic Location Fetch (HR selected it for today): the actual GPS position is used —
                    // only with reliable coordinates (accuracy reported by the device, not worse than the visit limit)
                    if (gpsAccuracy === undefined) return NextResponse.json({ error: 'Your device did not report the location accuracy. Turn on precise location and try again.', gpsAccuracyLow: true }, { status: 422 });
                    if (gpsAccuracy > MAX_VISIT_ACCURACY_M) return NextResponse.json({ error: `GPS accuracy is too low (±${Math.round(gpsAccuracy)} m). Move to an open area and try again.`, gpsAccuracyLow: true }, { status: 422 });
                    hoiUnmatched = await unmatchedPlace(lat, lng);
                }
                else return await blockUnassigned();
            } else if (employee.role === "HOI" || employee.role === "MARKETING_TEAM" || employee.role === "TECH_TEAM" || employee.role === "PLACEMENT_INTERN_HEAD" || employee.role === "TECH_INTERN") {
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

        // 5b. Mandatory justification BEFORE the clock-in is recorded (nothing is written without it)
        //   - Late Clock-In (after the grace period): every employee
        //   - HOI / OM with assigned locations: an assigned location other than today's scheduled one
        const scheduledLocId = String(expectedLocationId || '');
        // HOI daily locations: inside ANY selected college = normal; another assigned college = location justification
        const locationMismatch = assignedLocs.length > 0 && !!campus && !isWFH && !useWfhApp && (daily.set
            ? !daily.ids.includes(campus.id)
            : !!scheduledLocId && scheduledLocId.toLowerCase() !== 'wfh' && campus.id !== scheduledLocId);
        // HOI outside every assigned college with Automatic Location Fetch → mandatory field visit / meeting reason
        const fieldVisit = !!hoiUnmatched && !isWFH && !useWfhApp;
        const lateText = typeof lateReason === 'string' ? lateReason.trim() : '';
        const locText = typeof locationReason === 'string' ? locationReason.trim() : '';
        const fvText = typeof fieldVisitReason === 'string' ? fieldVisitReason.trim() : '';
        const dailyNames = async () => {
            if (!daily.set) return '';
            const ls: any[] = daily.ids.length ? await Location.find({ id: { $in: daily.ids } }).select('id name shortName').lean() : [];
            return [...daily.ids.map(id => { const l = ls.find(x => x.id === id); return l?.shortName || l?.name || id; }), ...(daily.autoFetch ? [FIELD_VISIT_LABEL] : [])].join(', ');
        };
        const missing: string[] = [];
        if (isLate && !isOverride && !lateText) missing.push('late');
        if (locationMismatch && !locText) missing.push('location');
        if (fieldVisit && !fvText) missing.push('fieldVisit');
        if (missing.length) {
            const hm = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
            let scheduledLocationName = scheduledLocId;
            if (daily.set) scheduledLocationName = await dailyNames();
            else if (locationMismatch) { const sl: any = await Location.findOne({ id: scheduledLocId }).select('name shortName').lean(); scheduledLocationName = sl?.shortName || sl?.name || scheduledLocId; }
            return NextResponse.json({
                error: missing.length === 2 ? 'Please submit both justifications before clocking in.' : missing[0] === 'late' ? 'Please submit your late arrival justification before clocking in.' : missing[0] === 'fieldVisit' ? 'Please submit your field visit / meeting reason before clocking in.' : 'Please submit your location change justification before clocking in.',
                justificationRequired: true, requires: missing,
                ...(isLate ? { late: { scheduledTime: expectedIn, currentTime: hm(currentTime), lateMinutes: currentTime - schedTime } } : {}),
                ...(locationMismatch ? { location: { scheduledLocationId: scheduledLocId, scheduledLocationName, actualLocationId: campus.id, actualLocationName: locationLabel(campus), autoFetch: daily.autoFetch } } : {}),
                ...(fieldVisit ? { fieldVisit: { scheduledLocationName, address: hoiUnmatched.detectedAddress || null, addressLabel: hoiUnmatched.detectedAddress || NO_ADDRESS_LABEL, lat, lng, accuracyMeters: typeof gpsAccuracy === 'number' ? Math.round(gpsAccuracy) : null } } : {}),
            }, { status: 428 });
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
        // Clock-in: "short leave" no longer excuses a late clock-in (same rule for everyone) — not stored here any more
        // HOI / OM with assigned locations: the first clock-in opens the day's location timeline
        if (assignedLocs.length && (campus || hoiUnmatched) && !isWFH && !useWfhApp) {
            // a field visit (Automatic Location Fetch) opens the timeline at the actual GPS place
            const place = campus || hoiUnmatched.place;
            updateData.currentLocationId = place.id;
            updateData.locationVisits = [{ ...makeVisit('CLOCK_IN', place, now, updateData.clockIn, lat, lng, gpsAccuracy), ...(hoiUnmatched ? hoiUnmatched.extras : await matchedVisitExtras(employee, lat, lng)) }];
        }

        // Justifications are saved first; if the attendance cannot be written they are removed again
        let lateJustId: string | undefined, locJust: { id: string; hois: any[] } | undefined;
        let attendance: any;
        try {
            if (isLate && !isOverride) lateJustId = await createLateAtClockIn(employee, { date: today, scheduled: expectedIn, actual: updateData.clockIn, lateMinutes: currentTime - schedTime, reason: lateText });
            const dailyIds = daily.set ? [...daily.ids, ...(daily.autoFetch ? [FIELD_VISIT_LOCATION] : [])] : undefined;
            if (locationMismatch) locJust = await createLocationJustification(employee, {
                date: today, scheduledLocationId: scheduledLocId, actual: campus, assignedIds: assignedLocs, clockIn: updateData.clockIn, at: now,
                lat, lng, accuracy: gpsAccuracy, justification: locText, lateAlso: !!lateJustId, scheduledLocationIds: dailyIds,
            });
            // field visit / meeting (Automatic Location Fetch, allowed by HR for that day): a normal clock-in — no approval step.
            // The reason, the actual GPS position and the address are saved on the attendance (shown in history / payable days).
            attendance = await Attendance.findOneAndUpdate(
                { employeeId, date: today },
                { $set: updateData },
                { upsert: true, new: true }
            );
            if (!attendance) throw new Error('Attendance could not be saved.');
        } catch (e: any) {
            if (lateJustId) await discardLateAtClockIn(lateJustId);
            if (locJust) await discardLocationJustification(locJust.id);
            if (e?.code === 11000) return NextResponse.json({ error: 'A justification for today already exists. Refresh and try again.' }, { status: 409 });
            throw e;
        }
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

        // Late Clock-In → recorded for everyone (justification → 1st / 2nd / 3rd … warning from Email Management)
        if (isLate) {
            await recordViolation({ emp: employee, type: 'LATE_IN', date: today, scheduledTime: expectedIn, actualTime: updateData.clockIn, durationMins: currentTime - schedTime });
        }
        // Link the justifications to the saved attendance and notify the reviewers
        if (lateJustId) await finishLateAtClockIn(lateJustId, String(attendance._id)).catch(() => {});
        if (locJust) await finishLocationJustification(locJust.id, String(attendance._id), lateJustId, locJust.hois).catch(() => {});
        // HOI daily locations: the day's attendance keeps what HR allowed + the actual GPS position (history / review)
        if (daily.set && !isWFH && !useWfhApp) {
            await Attendance.collection.updateOne({ _id: attendance._id }, { $set: {
                hoiDailyLocations: daily.ids, hoiDailyLocationsLabel: await dailyNames(), autoLocationFetch: daily.autoFetch,
                ...(typeof lat === 'number' ? { clockInLat: lat, clockInLng: lng, ...(typeof gpsAccuracy === 'number' ? { clockInAccuracyMeters: Math.round(gpsAccuracy) } : {}) } : {}),
                ...(fieldVisit ? { fieldVisit: true, fieldVisitAddress: hoiUnmatched.detectedAddress || '', fieldVisitReason: fvText.slice(0, 2000) } : {}),
            } }).catch(() => {});
            attendance = await Attendance.findById(attendance._id);
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