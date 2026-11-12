import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkSchedule, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { LocationScheduleAudit } from '@/models/LocationJustification';
import { hoiDailyLocations, FIELD_VISIT_LOCATION, AUTO_FETCH_KEY } from '@/lib/hoi-daily-locations';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// Same roles the Work Location and Flag Calendar screens allow
const SCHEDULE_EDITOR_ROLES = ["HOI", "AD", "OM", "HR", "FOUNDER"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// HOI weekday rule (several colleges / Automatic Location Fetch): set by HR / HR Executive / Founder / AD — same as Location Management
const HOI_MULTI_EDITOR_ROLES = ["HR", "FOUNDER", "AD"];

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only the roles that have a schedule screen can change a schedule (never the employee themselves)
        if (!SCHEDULE_EDITOR_ROLES.includes(actor.role)) {
            return NextResponse.json({ error: 'You are not allowed to change a work schedule.' }, { status: 403 });
        }

        const body = await req.json();
        const { employeeId, employeeName, date, clockInTime, clockOutTime } = body;
        let location = body.location;

        // 1. Hierarchical Permission Check (Conceptual)
        // HR can set for anyone. AD can set for HOI/Faculty. HOI can set for Faculty/OM.

        // The schedule takes effect as soon as it is saved. HR does not approve or reject it:
        // a change made by anyone other than HR is only flagged as unread for HR ("Pending")
        // until HR marks it as read ("Approved").
        const byHR = actor.role === "FOUNDER" || actor.role === "HR";
        const now = new Date().toISOString();
        const target = employeeName ? null : await Employee.findOne({ id: employeeId }).select('name');

        // HOI, a weekday (Mon … Sun, every week): several allowed colleges and / or Automatic Location Fetch.
        // Any other save of a day clears an earlier selection, so the day follows the single location again.
        const multi = Array.isArray(body.locations) && (body.locations.length > 1 || body.autoLocationFetch === true);
        let extra: any = { $unset: { locations: '', locationsFor: '', autoLocationFetch: '' } };
        let emp: any = null;
        if (multi) {
            emp = await Employee.findOne({ id: employeeId }).select('id name role attendanceLocations').lean();
            if (!emp || emp.role !== 'HOI') return NextResponse.json({ error: 'Several clock-in locations / Automatic Location Fetch are for HOI only.' }, { status: 400 });
            if (!HOI_MULTI_EDITOR_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Only HR or AD can set several clock-in locations for an HOI.' }, { status: 403 });
            if (!WEEKDAYS.includes(String(date))) return NextResponse.json({ error: 'Several clock-in locations are set for a weekday (Mon … Sun).' }, { status: 400 });
            const ids = Array.from(new Set((body.locations as any[]).map(x => String(x || '')).filter(Boolean)));
            const assigned: string[] = emp.attendanceLocations || [];
            if (ids.some(id => !assigned.includes(id))) return NextResponse.json({ error: "Every selected college must be one of the HOI's assigned clock-in locations (save them first)." }, { status: 400 });
            if (!ids.length && body.autoLocationFetch !== true) return NextResponse.json({ error: 'Select at least one college or Automatic Location Fetch.' }, { status: 400 });
            location = ids[0] || FIELD_VISIT_LOCATION;
            extra = { $set: { locations: ids, autoLocationFetch: body.autoLocationFetch === true, locationsFor: location } };
        }
        const before: any = await WorkSchedule.findOne({ employeeId, date }).select('date location locations locationsFor autoLocationFetch').lean();

        const schedule = await WorkSchedule.findOneAndUpdate(
            { employeeId, date },
            {
                ...extra,
                location,
                clockInTime,
                clockOutTime,
                employeeName: employeeName || target?.name,
                assignedBy: actor.id,
                assignedByName: actor.name,
                changedAt: now,
                status: byHR ? "Approved" : "Pending",
                hrReadBy: byHR ? actor.id : null,
                hrReadByName: byHR ? actor.name : null,
                hrReadAt: byHR ? now : null
            },
            { upsert: true, new: true }
        );

        // audit (Location Management history) whenever an HOI's weekday selection is set or changed
        const prev = before ? hoiDailyLocations(before, String(date)) : null;
        if (multi || prev?.set) {
            const list = (d: any) => (d?.set ? [...d.ids, ...(d.autoFetch ? [AUTO_FETCH_KEY] : [])] : d?.location ? [d.location] : []);
            const from = prev?.set ? list(prev) : before?.location ? [before.location] : [];
            const to = multi ? list(hoiDailyLocations(schedule, String(date))) : [location];
            if (from.join() !== to.join()) {
                const who: any = emp || await Employee.findOne({ id: employeeId }).select('id name').lean();
                await LocationScheduleAudit.create({
                    id: `LSA-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(), employeeId, employeeName: who?.name || employeeName, kind: 'scheduled',
                    date, from, to, byId: actor.id, byName: actor.name, byRole: (actor as any).hrExecutive ? 'HR Executive' : actor.role, at: now,
                }).catch((e: any) => console.error('[schedule audit]', e?.message));
            }
        }

        // A new change means the whole schedule of this employee is unread for HR again
        if (!byHR) {
            await WorkSchedule.updateMany(
                { employeeId, status: "Approved" },
                { $set: { status: "Pending", hrReadBy: null, hrReadByName: null, hrReadAt: null } }
            );
        }

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