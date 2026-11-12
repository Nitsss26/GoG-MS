import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { Employee, Location, WorkSchedule } from '@/models/Schemas';
import { LocationScheduleAudit } from '@/models/LocationJustification';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';
import { scheduledLocationOf } from '@/lib/location-justification';
import { hoiDailyLocations, weekdayOf, FIELD_VISIT_LOCATION, AUTO_FETCH_KEY, AUTO_FETCH_LABEL, FIELD_VISIT_LABEL } from '@/lib/hoi-daily-locations';

export const dynamic = 'force-dynamic';

/**
 * HOI / OM location management — assigned colleges (Employee.attendanceLocations) and date-wise scheduled
 * locations (Work Location schedule). HR / HR Executive / Founder: HOI and OM. AD: HOI only. Every change is audited.
 *   GET                       → employees + locations
 *   GET ?employeeId=          → that employee's schedules + audit log
 *   PUT  { employeeId, attendanceLocations }      → assigned colleges
 *   POST { employeeId, date, location }           → scheduled location for a date (YYYY-MM-DD) or weekday (Mon..Sun)
 *   POST { employeeId, date: Mon..Sun, locations[], autoLocationFetch } → HOI only, every weekday: several allowed colleges
 *        and / or Automatic Location Fetch (Field Visit / Meeting). Assigned colleges are never changed by this.
 *   DELETE ?employeeId=&date=                     → remove a scheduled location
 */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isYmd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`));
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const rolesFor = (actor: any) => (['HR', 'FOUNDER'].includes(actor?.role) ? ['HOI', 'OM'] : actor?.role === 'AD' ? ['HOI'] : []);
const roleLabel = (actor: any) => actor?.hrExecutive || actor?.session?.actualRole === 'HR_EXECUTIVE' ? 'HR Executive' : actor?.role === 'FOUNDER' ? 'Founder' : actor?.role;

async function guard(employeeId?: string) {
    const actor: any = await getSessionUser({ ignoreDelegation: true });
    if (!actor) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const roles = rolesFor(actor);
    if (!roles.length) return { res: NextResponse.json({ error: 'Only HR or AD can manage locations.' }, { status: 403 }) };
    if (employeeId === undefined) return { actor, roles };
    const emp: any = await Employee.findOne({ id: String(employeeId || '') }).lean();
    if (!emp) return { res: NextResponse.json({ error: 'Employee not found.' }, { status: 404 }) };
    if (!roles.includes(emp.role)) return { res: NextResponse.json({ error: actor.role === 'AD' ? 'AD can manage HOI locations only.' : 'Locations are managed for HOI and OM only.' }, { status: 403 }) };
    return { actor, roles, emp };
}
const audit = (actor: any, emp: any, kind: string, from: any, to: any, date?: string) => LocationScheduleAudit.create({
    id: `LSA-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(), employeeId: emp.id, employeeName: emp.name, kind,
    ...(date ? { date } : {}), from, to, byId: actor.id, byName: actor.name, byRole: roleLabel(actor), at: new Date().toISOString(),
});

export async function GET(req: Request) {
    try {
        await dbConnect();
        const employeeId = new URL(req.url).searchParams.get('employeeId');
        const g: any = await guard(employeeId ?? undefined);
        if (g.res) return g.res;
        const locations: any[] = await Location.find({}).select('id name shortName').sort({ name: 1 }).lean();
        const name = (id: string) => { const l = locations.find(x => x.id === id); return l?.shortName || l?.name || id; };
        const today = istToday();
        if (!employeeId) {
            const emps: any[] = await Employee.find({ role: { $in: g.roles }, isRemoved: { $ne: true }, status: { $nin: ['Inactive', 'Removed', 'Exited'] } })
                .select('id name role location attendanceLocations designation current_designation_at_gog').sort({ name: 1 }).lean();
            const todayRows: any[] = await WorkSchedule.find({ employeeId: { $in: emps.map(e => e.id) }, date: { $in: [today, weekdayOf(today)] } }).select('employeeId date location locations locationsFor autoLocationFetch').lean();
            const rows = await Promise.all(emps.map(async e => {
                const sched = await scheduledLocationOf(e, today);
                // HOI: several colleges / Automatic Location Fetch selected for today
                // (a specific-date entry for today wins over the weekday entry, as on clock-in)
                const todayRow = todayRows.find(r => r.employeeId === e.id && r.date === today) || todayRows.find(r => r.employeeId === e.id && r.date === weekdayOf(today));
                const daily = e.role === 'HOI' ? hoiDailyLocations(todayRow, today) : { set: false, ids: [], autoFetch: false };
                return {
                    id: e.id, name: e.name, role: e.role, designation: e.current_designation_at_gog || e.designation || '',
                    location: e.location || '', locationName: name(e.location || ''),
                    assigned: (e.attendanceLocations || []).map((id: string) => ({ id, name: name(id) })),
                    todayScheduled: sched,
                    todayScheduledName: daily.set ? [...daily.ids.map(name), ...(daily.autoFetch ? [FIELD_VISIT_LABEL] : [])].join(', ') : sched.toLowerCase() === 'wfh' ? 'WFH' : name(sched),
                };
            }));
            return NextResponse.json({ employees: rows, locations: locations.map(l => ({ id: l.id, name: l.shortName || l.name || l.id })), today, canManageOm: g.roles.includes('OM') });
        }
        const emp = g.emp;
        const [schedules, audits]: [any[], any[]] = await Promise.all([
            WorkSchedule.find({ employeeId: emp.id, $or: [{ date: { $gte: new Date(Date.now() - 31 * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10) } }, { date: { $in: WEEKDAYS } }] }).select('date location clockInTime clockOutTime assignedByName changedAt locations locationsFor autoLocationFetch').lean(),
            LocationScheduleAudit.find({ employeeId: emp.id }).sort({ at: -1 }).limit(200).lean(),
        ]);
        const legacy = (emp.attendanceLocationLog || []).map((l: any) => ({ id: `LOG-${l.at}`, kind: 'assigned', from: l.from, to: l.to, byName: l.byName || l.by, byRole: 'HR', at: l.at }));
        const seen = new Set(audits.filter(a => a.kind === 'assigned').map(a => a.at));
        return NextResponse.json({
            employee: { id: emp.id, name: emp.name, role: emp.role, location: emp.location || '', assigned: (emp.attendanceLocations || []).map((id: string) => ({ id, name: name(id) })) },
            schedules: schedules.map(s => {
                const daily = emp.role === 'HOI' ? hoiDailyLocations(s, s.date) : { set: false, ids: [] as string[], autoFetch: false };
                return {
                    date: s.date, location: s.location,
                    locationName: daily.set ? [...daily.ids.map(name), ...(daily.autoFetch ? [FIELD_VISIT_LABEL] : [])].join(', ') : String(s.location).toLowerCase() === 'wfh' ? 'WFH' : name(s.location),
                    ...(daily.set ? { locations: daily.ids, autoLocationFetch: daily.autoFetch } : {}),
                    clockInTime: s.clockInTime, clockOutTime: s.clockOutTime, by: s.assignedByName || '', at: s.changedAt || '',
                };
            })
                .sort((a, b) => (WEEKDAYS.includes(a.date) ? 0 : 1) - (WEEKDAYS.includes(b.date) ? 0 : 1) || (WEEKDAYS.includes(a.date) ? WEEKDAYS.indexOf(a.date) - WEEKDAYS.indexOf(b.date) : a.date.localeCompare(b.date))),
            audit: [...audits.map(a => ({ id: a.id, kind: a.kind, date: a.date || '', from: a.from, to: a.to, byName: a.byName, byRole: a.byRole, at: a.at })), ...legacy.filter((l: any) => !seen.has(l.at))]
                .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
                .map((a: any) => {
                    const nm = (id: string) => (id === AUTO_FETCH_KEY ? AUTO_FETCH_LABEL : id === FIELD_VISIT_LOCATION ? FIELD_VISIT_LABEL : name(id));
                    return { ...a, fromName: Array.isArray(a.from) ? a.from.map(nm).join(', ') : a.from ? nm(a.from) : '', toName: Array.isArray(a.to) ? a.to.map(nm).join(', ') : a.to ? nm(a.to) : '' };
                }),
            today,
        });
    } catch (e: any) {
        console.error('location-management GET', e);
        return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json().catch(() => ({}));
        const g: any = await guard(String(body.employeeId || ''));
        if (g.res) return g.res;
        const list = body.attendanceLocations;
        if (!Array.isArray(list) || list.some((v: any) => typeof v !== 'string' || !v)) return NextResponse.json({ error: 'Choose the assigned colleges.' }, { status: 400 });
        const ids = Array.from(new Set(list as string[]));
        const found: any[] = await Location.find({ id: { $in: ids } }).select('id').lean();
        const missing = ids.filter(id => !found.some(l => l.id === id));
        if (missing.length) return NextResponse.json({ error: `Unknown location(s): ${missing.join(', ')}` }, { status: 400 });
        const before: string[] = g.emp.attendanceLocations || [];
        if (before.length === ids.length && before.every(id => ids.includes(id))) return NextResponse.json({ message: 'No change.' });
        const at = new Date().toISOString();
        await Employee.updateOne({ id: g.emp.id }, { $set: { attendanceLocations: ids }, $push: { attendanceLocationLog: { at, by: g.actor.id, byName: g.actor.name, from: before, to: ids } } });
        await audit(g.actor, g.emp, 'assigned', before, ids);
        return NextResponse.json({ message: 'Assigned colleges updated.' });
    } catch (e: any) {
        console.error('location-management PUT', e);
        return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json().catch(() => ({}));
        const g: any = await guard(String(body.employeeId || ''));
        if (g.res) return g.res;
        const date = String(body.date || ''), location = String(body.location || '');
        if (!isYmd(date) && !WEEKDAYS.includes(date)) return NextResponse.json({ error: 'Choose a date or a weekday.' }, { status: 400 });
        if (isYmd(date) && date < istToday()) return NextResponse.json({ error: 'A past date cannot be scheduled.' }, { status: 400 });
        const assigned: string[] = g.emp.attendanceLocations || [];
        // HOI weekday clock-in locations (several colleges and / or Automatic Location Fetch) — every Mon … Sun
        if (Array.isArray(body.locations) || body.autoLocationFetch !== undefined) return await saveHoiDaily(g, body, date, assigned);
        if (!assigned.includes(location)) return NextResponse.json({ error: 'The scheduled location must be one of the assigned colleges.' }, { status: 400 });
        const existing: any = await WorkSchedule.findOne({ employeeId: g.emp.id, date }).lean();
        // keep the employee's timing: an existing entry, the weekday entry, otherwise the existing timing rules
        const dayName = isYmd(date) ? DAY[new Date(`${date}T12:00:00Z`).getUTCDay()] : date;
        const weekday: any = existing ? null : await WorkSchedule.findOne({ employeeId: g.emp.id, date: dayName }).lean();
        const rule = getExpectedTimingInternal(g.emp.name || '', g.emp.location || '', isYmd(date) ? date : istToday());
        const clockInTime = existing?.clockInTime || weekday?.clockInTime || rule.in || '09:30';
        const clockOutTime = existing?.clockOutTime || weekday?.clockOutTime || rule.out || '18:30';
        if (existing?.location === location) return NextResponse.json({ message: 'No change.' });
        const byHR = ['HR', 'FOUNDER'].includes(g.actor.role);
        const now = new Date().toISOString();
        await WorkSchedule.findOneAndUpdate({ employeeId: g.emp.id, date }, {
            $set: {
                location, clockInTime, clockOutTime, employeeName: g.emp.name, assignedBy: g.actor.id, assignedByName: g.actor.name, changedAt: now,
                status: byHR ? 'Approved' : 'Pending', hrReadBy: byHR ? g.actor.id : null, hrReadByName: byHR ? g.actor.name : null, hrReadAt: byHR ? now : null,
            },
            // a single scheduled location replaces any HOI daily multi-location selection of that date
            $unset: { locations: '', locationsFor: '', autoLocationFetch: '' },
        }, { upsert: true, new: true });
        await audit(g.actor, g.emp, 'scheduled', existing?.location || '', location, date);
        return NextResponse.json({ message: 'Scheduled location saved.' });
    } catch (e: any) {
        console.error('location-management POST', e);
        return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await dbConnect();
        const sp = new URL(req.url).searchParams;
        const g: any = await guard(sp.get('employeeId') || '');
        if (g.res) return g.res;
        const date = sp.get('date') || '';
        const existing: any = await WorkSchedule.findOne({ employeeId: g.emp.id, date }).lean();
        if (!existing) return NextResponse.json({ error: 'Schedule entry not found.' }, { status: 404 });
        await WorkSchedule.deleteOne({ _id: existing._id });
        const daily = g.emp.role === 'HOI' ? hoiDailyLocations(existing, date) : null;
        await audit(g.actor, g.emp, 'schedule_removed', daily?.set ? [...daily.ids, ...(daily.autoFetch ? [AUTO_FETCH_KEY] : [])] : existing.location, '', date);
        return NextResponse.json({ message: 'Scheduled location removed.' });
    } catch (e: any) {
        console.error('location-management DELETE', e);
        return NextResponse.json({ error: 'Could not remove.' }, { status: 500 });
    }
}
/**
 * HOI only, every weekday (Mon … Sun, repeats each week): several allowed clock-in colleges (from the HOI's assigned colleges) and / or
 * Automatic Location Fetch. The permanent assigned colleges are not changed. Audited.
 */
async function saveHoiDaily(g: any, body: any, date: string, assigned: string[]) {
    if (g.emp.role !== 'HOI') return NextResponse.json({ error: 'Several daily clock-in locations / Automatic Location Fetch are for HOI only.' }, { status: 403 });
    if (!WEEKDAYS.includes(date)) return NextResponse.json({ error: 'Several clock-in locations / Automatic Location Fetch are set for a weekday (Every Mon … Sun), not a specific date.' }, { status: 400 });
    const raw = Array.isArray(body.locations) ? body.locations : [];
    if (raw.some((v: any) => typeof v !== 'string' || !v)) return NextResponse.json({ error: 'Invalid location.' }, { status: 400 });
    const ids = Array.from(new Set(raw as string[]));
    const autoFetch = body.autoLocationFetch === true;
    if (!ids.length && !autoFetch) return NextResponse.json({ error: 'Select at least one college or Automatic Location Fetch.' }, { status: 400 });
    const notAssigned = ids.filter(id => !assigned.includes(id));
    if (notAssigned.length) return NextResponse.json({ error: 'Every selected college must be one of the HOI\'s assigned colleges.' }, { status: 400 });
    const existing: any = await WorkSchedule.findOne({ employeeId: g.emp.id, date }).lean();
    const before = existing ? hoiDailyLocations(existing, date) : null;
    const fromList = before?.set ? [...before.ids, ...(before.autoFetch ? [AUTO_FETCH_KEY] : [])] : existing?.location ? [existing.location] : [];
    const toList = [...ids, ...(autoFetch ? [AUTO_FETCH_KEY] : [])];
    if (before?.set && fromList.length === toList.length && fromList.every(x => toList.includes(x))) return NextResponse.json({ message: 'No change.' });
    // keep the weekday's timing (existing entry, otherwise the existing timing rules)
    const rule = getExpectedTimingInternal(g.emp.name || '', g.emp.location || '', istToday());
    const clockInTime = existing?.clockInTime || rule.in || '09:30';
    const clockOutTime = existing?.clockOutTime || rule.out || '18:30';
    // `location` keeps one value for every other screen: the first selected college, or FIELD_VISIT (Automatic Location Fetch only)
    const location = ids[0] || FIELD_VISIT_LOCATION;
    const byHR = ['HR', 'FOUNDER'].includes(g.actor.role);
    const now = new Date().toISOString();
    await WorkSchedule.findOneAndUpdate({ employeeId: g.emp.id, date }, {
        $set: {
            location, locations: ids, autoLocationFetch: autoFetch, locationsFor: location, clockInTime, clockOutTime,
            employeeName: g.emp.name, assignedBy: g.actor.id, assignedByName: g.actor.name, changedAt: now,
            status: byHR ? 'Approved' : 'Pending', hrReadBy: byHR ? g.actor.id : null, hrReadByName: byHR ? g.actor.name : null, hrReadAt: byHR ? now : null,
        },
    }, { upsert: true, new: true });
    await audit(g.actor, g.emp, 'scheduled', fromList, toList, date);
    return NextResponse.json({ message: `Clock-in locations saved for every ${date}.` });
}