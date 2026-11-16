/**
 * SERVER-ONLY: a professor's college for each day, from the EXISTING HR work-location routine.
 *
 * Single source of truth = WorkSchedule (HR → Work Location, the same rows clock-in uses):
 *   1. a date-wise row ("2026-11-23")  → that date only (temporary change)
 *   2. a weekday row ("Mon" … "Sat")   → every week, until HR changes it
 *   3. otherwise the Original Location (Employee.location)
 * "WFH" on a day = no campus that day → every college of the professor may be planned for it.
 * Values that are not a college in the Locations database are ignored (never lock a day because of them).
 *
 * Nothing here writes data. Professors with one college (or no routine) get exactly the old behaviour:
 * one college, every day editable.
 */
import { WorkSchedule } from '@/models/Schemas';
import { resolveCollege, type College } from '@/lib/academic';

export const WEEKDAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayCodeOf = (ymd: string) => WEEKDAY_CODES[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
export const longDayOf = (ymd: string) => LONG_DAY[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
const isWfh = (v: any) => String(v || '').trim().toLowerCase() === 'wfh';
const isYmd = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export type RoutineDay = {
    date: string; day: string;
    /** college id, 'WFH', or '' (nothing known — the day is not locked) */
    assigned: string;
    assignedName: string;
    source: 'date' | 'weekday' | 'original';
};
export type ProfessorRoutine = {
    /** the professor's colleges: weekday routine + this week's date-wise rows + Original Location */
    colleges: College[];
    original: College | null;
    days: RoutineDay[];
    /** true when the professor works at more than one college → plans are per college and days are locked */
    multi: boolean;
};

/** Mon … Sat of the week that starts on weekStart (Monday) */
export function weekDates(weekStart: string, weekEnd?: string) {
    const out: string[] = [];
    const d = new Date(`${weekStart}T00:00:00Z`);
    for (let i = 0; i < 7; i++) {
        const ymd = d.toISOString().slice(0, 10);
        if (weekEnd ? ymd <= weekEnd : i < 6) out.push(ymd);
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

/** Same resolution as clock-in (date row → weekday row → Original Location) for the given dates */
export async function professorRoutine(emp: any, dates: string[]): Promise<ProfessorRoutine> {
    const rows: any[] = emp?.id ? await WorkSchedule.find({ employeeId: emp.id }).select('date location').lean() : [];
    const cache = new Map<string, College | null>();
    const col = async (v: any): Promise<College | null> => {
        const key = String(v || '').trim();
        if (!key || isWfh(key)) return null;
        if (!cache.has(key)) cache.set(key, await resolveCollege(key));
        return cache.get(key) || null;
    };
    // Original Location: as before (a value missing from the Locations database still counts, like collegeOfEmployee)
    const loc = String(emp?.location || '').trim();
    const original: College | null = loc ? (await col(loc)) || { id: loc, name: loc, keys: [loc] } : null;

    const colleges: College[] = [];
    const add = (c: College | null) => { if (c && !colleges.some(x => x.id === c.id)) colleges.push(c); };
    for (const r of rows.filter(r => WEEKDAY_CODES.includes(r.date))) add(await col(r.location));
    for (const r of rows.filter(r => isYmd(r.date) && dates.includes(r.date))) add(await col(r.location));
    add(original);

    const days: RoutineDay[] = [];
    for (const date of dates) {
        const day = dayCodeOf(date);
        const byDate = rows.find(r => r.date === date), byDay = rows.find(r => r.date === day);
        const r = byDate || byDay;
        const source: RoutineDay['source'] = byDate ? 'date' : byDay ? 'weekday' : 'original';
        const value = r ? r.location : loc;
        if (isWfh(value)) { days.push({ date, day, assigned: 'WFH', assignedName: 'Work From Home', source }); continue; }
        const c = source === 'original' ? original : await col(value);
        days.push({ date, day, assigned: c?.id || '', assignedName: c?.name || '', source });
    }
    return { colleges, original, days, multi: colleges.length > 1 };
}

/** Find one of the professor's colleges by id / name / short name */
export function routineCollege(r: ProfessorRoutine, value?: string | null): College | null {
    const v = String(value || '').trim();
    if (!v) return null;
    return r.colleges.find(c => c.id === v || c.keys.includes(v)) || null;
}

/** May the professor plan classes of `collegeId` on `date`? (single-college professors: always) */
export function dayEditable(r: ProfessorRoutine, date: string, collegeId: string) {
    if (!r.multi) return true;
    const d = r.days.find(x => x.date === date);
    if (!d || !d.assigned) return true;
    if (d.assigned === 'WFH') return r.colleges.some(c => c.id === collegeId);
    return d.assigned === collegeId;
}

/** Employee-friendly explanation for a locked day */
export function lockedDayMessage(r: ProfessorRoutine, date: string, selected: College) {
    const d = r.days.find(x => x.date === date);
    const assigned = d?.assignedName || 'another college';
    const when = `${longDayOf(date)} (${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })})`;
    return `Your clock-in location for ${when} has been assigned to ${assigned} by HR. You can create or edit the ${assigned} Sprint Plan for this date, but not the ${selected.name} Sprint Plan.`;
}

/** Does this saved plan belong to `college`? (plans saved before multi-college have the Original Location or no college) */
export function planIsFor(plan: any, college: College, r: ProfessorRoutine) {
    const pc = String(plan?.college || '').trim();
    if (!pc) return !!r.original && r.original.id === college.id;
    return college.id === pc || college.keys.includes(pc);
}

/**
 * The college a plan belongs to. Plans of a multi-college professor are saved with `collegeFixed`
 * (their college is the one the professor picked). Every other plan keeps the old rule:
 * the professor's Original Location, else the plan's college.
 */
export function planCollegeOf(plan: any, profLocation?: string | null) {
    if (plan?.collegeFixed && plan?.college) return String(plan.college);
    return String(profLocation || plan?.college || '');
}

/**
 * May the viewer see this plan of `prof`? `prof` comes from professorsInScope (it carries _planScope).
 * Professors passed in any other way (own plans, org-wide lists) → always visible, as before.
 * A plan of another college (collegeFixed) needs that college in the viewer's scope; every other plan needs
 * the professor's Original Location in scope (exactly the old rule for professors who were already in scope).
 */
export function planVisibleFor(prof: any, plan: any) {
    const ps = prof?._planScope;
    if (!ps || ps.all) return true;
    const keys: string[] = (ps.keys || []).map(String);
    if (plan?.collegeFixed && plan?.college) return keys.includes(String(plan.college));
    return keys.includes(String(prof.location || plan?.college || ''));
}