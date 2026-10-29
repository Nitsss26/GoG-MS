/**
 * SERVER-ONLY: shared college timings + scheduling rules for the Sprint Plan / dynamic timetable.
 *
 *  - College timings: one start / end time per college (Location id) in CollegeTiming. Any professor of that
 *    college can set or change it; it is used for every week until it is changed again.
 *  - Scheduling conflicts (checked on the server for every save and lock):
 *      · the same professor cannot have two overlapping classes on a date
 *      · the same class + section cannot have two overlapping lectures on a date (any professor of the college)
 *      · a class must lie inside the college start / end time (when the college timing is set)
 *    Different professors teaching different classes at the same time is fine.
 *  - Change summaries: classes added / changed / removed between two versions of a plan.
 */
import { Employee, SprintPlan } from '@/models/Schemas';
import { CollegeTiming } from '@/models/CollegeTiming';
import { resolveCollege } from '@/lib/academic';
import { PROFESSOR_ROLES } from '@/lib/academic-status';

export const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
export const toMin = (t?: string) => { if (!t || !HM_RE.test(t)) return NaN; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** "15:00" → "3:00 PM" */
export const fmt12 = (t?: string) => {
    const m = toMin(t); if (isNaN(m)) return t || '—';
    const h = Math.floor(m / 60), mm = m % 60;
    return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
/** "2026-10-29" → "29 Oct 2026" */
export const fmtDate = (ymd?: string) => (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)
    ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ymd || '');

/** Class / section identity used for clash checks and the class filter: the class name (stream + year + section) */
export const classKeyOf = (e: any) => String(e?.className || [e?.stream, e?.year, e?.section].filter(Boolean).join(' ')).trim().toLowerCase();

export type CollegeRef = { id: string; name: string; keys: string[] };

/** The professor's college from the existing employee → Location mapping (Employee.location) */
export async function collegeOfEmployee(emp: any): Promise<CollegeRef | null> {
    const loc = emp?.location;
    if (!loc) return null;
    const c = await resolveCollege(loc);
    return c ? { id: c.id, name: c.name, keys: c.keys } : { id: String(loc), name: String(loc), keys: [String(loc)] };
}

export async function getCollegeTiming(collegeId?: string | null) {
    if (!collegeId) return null;
    return CollegeTiming.findOne({ collegeId }).lean() as Promise<any>;
}

/** Ids of the professors of a college */
export async function collegeProfessorIds(keys: string[]) {
    if (!keys.length) return [] as string[];
    const rows: any[] = await Employee.find({ role: { $in: PROFESSOR_ROLES }, location: { $in: keys } }).select('id').lean();
    return rows.map(r => String(r.id));
}

const overlaps = (a: any, b: any) => toMin(a.timeStart) < toMin(b.timeStop) && toMin(b.timeStart) < toMin(a.timeStop);
const label = (e: any) => `${e.subjectName || 'Class'} (${fmtDate(e.date)}, ${fmt12(e.timeStart)} – ${fmt12(e.timeStop)})`;

export type CheckResult = { ok: true } | { ok: false; status: number; error: string; invalidIndices?: number[] };

/**
 * Scheduling rules for one professor's week (server side). `entries` are the plan's classes after the save.
 */
export async function checkEntries(input: { facultyId: string; college: CollegeRef | null; weekStartDate: string; weekEndDate?: string; entries: any[] }): Promise<CheckResult> {
    const { facultyId, college, entries } = input;
    // 1. the professor's own overlapping classes
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            if (entries[i].date === entries[j].date && overlaps(entries[i], entries[j])) {
                return { ok: false, status: 400, invalidIndices: [i, j], error: `Scheduling Conflict: You already have a class scheduled during this time — ${label(entries[i])} overlaps ${label(entries[j])}.` };
            }
        }
    }
    if (!college) return { ok: true };
    // 2. inside the college hours
    const timing: any = await getCollegeTiming(college.id);
    if (timing?.startTime && timing?.endTime) {
        const s = toMin(timing.startTime), e = toMin(timing.endTime);
        const out = entries.findIndex(x => toMin(x.timeStart) < s || toMin(x.timeStop) > e);
        if (out >= 0) {
            return { ok: false, status: 400, invalidIndices: [out], error: `${label(entries[out])} is outside the college hours (${fmt12(timing.startTime)} – ${fmt12(timing.endTime)}). Change the class time or update the college timings.` };
        }
    }
    // 3. the same class + section taught by another professor of the college at the same time
    const withSection = entries.map((x, i) => ({ x, i })).filter(({ x }) => String(x.section || '').trim() && classKeyOf(x));
    if (withSection.length) {
        const ids = (await collegeProfessorIds(college.keys)).filter(id => id !== facultyId);
        if (ids.length) {
            const others: any[] = await SprintPlan.find({ facultyId: { $in: ids }, weekStartDate: input.weekStartDate }).select('facultyId facultyName entries').lean();
            for (const { x, i } of withSection) {
                for (const p of others) {
                    const hit = (p.entries || []).find((o: any) => o.date === x.date && classKeyOf(o) === classKeyOf(x) && overlaps(o, x));
                    if (hit) {
                        return { ok: false, status: 400, invalidIndices: [i], error: `Scheduling Conflict: ${x.className || classKeyOf(x)} already has ${hit.subjectName || 'a class'} with ${p.facultyName} on ${fmtDate(x.date)} (${fmt12(hit.timeStart)} – ${fmt12(hit.timeStop)}).` };
                    }
                }
            }
        }
    }
    return { ok: true };
}

// ─────────────────────────── change summaries ───────────────────────────
const FIELDS: [string, string][] = [
    ['date', 'Date'], ['timeStart', 'Start'], ['timeStop', 'End'], ['subjectName', 'Subject'], ['topics', 'Topic'],
    ['section', 'Section'], ['className', 'Class'], ['stream', 'Branch'], ['year', 'Year'], ['semester', 'Semester'],
    ['lectureType', 'Lecture Type'], ['unitNumber', 'Unit'], ['content', 'Content'],
];
const pick = (e: any) => Object.fromEntries(FIELDS.map(([k]) => [k, e?.[k] ?? ''])) as Record<string, any>;
const idOf = (e: any) => (e?._id ? String(e._id) : '');
const when = (e: any) => `${fmtDate(e.date)}, ${fmt12(e.timeStart)} to ${fmt12(e.timeStop)}`;

export type EntryChange = { action: 'class_added' | 'class_updated' | 'class_removed'; entryId: string; previousData?: any; updatedData?: any; summary: string };

/** Classes added / changed / removed between two versions (matched by class row id) */
export function diffEntries(before: any[] = [], after: any[] = []): EntryChange[] {
    const out: EntryChange[] = [];
    const prev = new Map(before.filter(idOf).map(e => [idOf(e), e]));
    const seen = new Set<string>();
    for (const e of after) {
        const id = idOf(e);
        const old = id ? prev.get(id) : null;
        if (!old) {
            out.push({ action: 'class_added', entryId: id, updatedData: pick(e), summary: `Added ${e.subjectName || 'class'} — ${when(e)}${e.topics ? ` (Topic: ${e.topics})` : ''}${e.className ? ` · ${e.className}` : ''}` });
            continue;
        }
        seen.add(id);
        const a = pick(old), b = pick(e);
        const changed = FIELDS.filter(([k]) => String(a[k] ?? '') !== String(b[k] ?? ''));
        if (changed.length) {
            const parts = changed.map(([k, l]) => (k === 'timeStart' || k === 'timeStop')
                ? `${l} ${fmt12(a[k])} → ${fmt12(b[k])}` : k === 'date' ? `${l} ${fmtDate(a[k])} → ${fmtDate(b[k])}` : `${l} "${a[k] || '—'}" → "${b[k] || '—'}"`);
            out.push({ action: 'class_updated', entryId: id, previousData: a, updatedData: b, summary: `Changed ${old.subjectName || 'class'} (${when(old)}): ${parts.join('; ')}` });
        }
    }
    for (const [id, old] of prev) {
        if (!seen.has(id) && !after.some(e => idOf(e) === id)) {
            out.push({ action: 'class_removed', entryId: id, previousData: pick(old), summary: `Removed ${old.subjectName || 'class'} — ${when(old)}` });
        }
    }
    return out;
}