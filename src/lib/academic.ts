/**
 * SERVER-ONLY helpers for the academic workflow:
 * college scope (data isolation), recipients, notifications (in-app + email), dates in the institution time zone.
 *
 * College mapping used everywhere: Employee.location = Location.id (older records hold the Location name or
 * short name, so all three are accepted). No separate college mapping is created.
 */
import { randomBytes } from 'crypto';
import { Employee, Location, Notification } from '@/models/Schemas';
import { sendMailInternal } from '@/lib/mail-server';
import { getAcademicNotificationTemplate } from '@/lib/mail-templates';
import { PROFESSOR_ROLES } from '@/lib/academic-status';

// ─────────────────────────── time ───────────────────────────
/** Institution time zone (Module 5): ACADEMIC_TIMEZONE if set, otherwise Asia/Kolkata */
export const ACADEMIC_TZ = process.env.ACADEMIC_TIMEZONE || 'Asia/Kolkata';
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Date / time parts of an instant in the institution time zone */
export function zonedNow(at: Date = new Date(), tz: string = ACADEMIC_TZ) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(at);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    const ymd = `${get('year')}-${get('month')}-${get('day')}`;
    const hour = get('hour') === '24' ? '00' : get('hour');
    const hm = `${hour}:${get('minute')}`;
    const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return { ymd, hm, dow, dayCode: DAY_CODES[dow], minutes: parseInt(hour) * 60 + parseInt(get('minute')) };
}

export function addDays(ymd: string, n: number): string {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/** Monday of the Monday–Sunday week that contains ymd */
export function mondayOf(ymd: string): string {
    const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
    return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

export function dayCodeOf(ymd: string): string {
    return DAY_CODES[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
}

export function isValidYmd(v: any): v is string {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(`${v}T00:00:00Z`).getTime());
}

/** True when the class (date + end time, institution time zone) has already finished */
export function hasClassEnded(date: string, timeStop?: string, at: Date = new Date()): boolean {
    const now = zonedNow(at);
    if (date < now.ymd) return true;
    if (date > now.ymd) return false;
    if (!timeStop || !/^\d{1,2}:\d{2}$/.test(timeStop)) return true;
    const [h, m] = timeStop.split(':').map(Number);
    return now.minutes >= h * 60 + m;
}

export const nowISO = () => new Date().toISOString();

export function newId(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();
}

export function appUrl(path: string) {
    const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return base + path;
}

// ─────────────────────────── colleges ───────────────────────────
export type College = { id: string; name: string; keys: string[] };

function collegeFromLocation(loc: any): College {
    const keys = Array.from(new Set([loc.id, loc.name, loc.shortName].filter(Boolean).map(String)));
    return { id: String(loc.id), name: String(loc.name || loc.id), keys };
}

/** Resolve a stored location value (id, name or short name) to the college */
export async function resolveCollege(value?: string | null): Promise<College | null> {
    if (!value) return null;
    const loc = await Location.findOne({ $or: [{ id: value }, { name: value }, { shortName: value }] }).lean();
    if (loc) return collegeFromLocation(loc);
    return null;
}

/** Keys of a college; for a value that is not a known Location, the value itself */
export async function collegeKeysFor(value?: string | null): Promise<string[]> {
    if (!value) return [];
    const c = await resolveCollege(value);
    return c ? c.keys : [value];
}

export async function collegeName(value?: string | null): Promise<string> {
    if (!value) return 'Not assigned';
    const c = await resolveCollege(value);
    return c ? c.name : value;
}

// ─────────────────────────── scope (Module 24) ───────────────────────────
export type AcademicScope = {
    orgWide: boolean;     // may see every college
    colleges: College[];  // the user's own college(s) when not org-wide
    keys: string[];       // all location values that belong to those colleges
};

/**
 * Which colleges a user may see in the academic workflow.
 * - FOUNDER, AD, CURRICULUM_HEAD: cross-college (head-office roles; the existing curriculum pages already
 *   show every campus).
 * - CURRICULUM_LEAD: own college; a CL without a college keeps the existing cross-college access.
 * - HOI, OM, FACULTY, PROFESSOR: own college only.
 * - everyone else: nothing.
 */
export async function getAcademicScope(user: { role: string; employee?: any }): Promise<AcademicScope> {
    const role = user.role;
    if (['FOUNDER', 'AD', 'CURRICULUM_HEAD'].includes(role)) return { orgWide: true, colleges: [], keys: [] };

    const location = user.employee?.location;
    if (role === 'CURRICULUM_LEAD') {
        const c = await resolveCollege(location);
        return c ? { orgWide: false, colleges: [c], keys: c.keys } : { orgWide: true, colleges: [], keys: [] };
    }
    if (role === 'HOI') {
        // Own campus + every campus this HOI heads (Location.hoiId)
        const own = await resolveCollege(location);
        const headed: any[] = user.employee?.id ? await Location.find({ hoiId: user.employee.id }).lean() : [];
        const colleges: College[] = [];
        [...(own ? [own] : []), ...headed.map(collegeFromLocation)].forEach(c => { if (!colleges.some(x => x.id === c.id)) colleges.push(c); });
        if (colleges.length) return { orgWide: false, colleges, keys: Array.from(new Set(colleges.flatMap(c => c.keys))) };
        return { orgWide: false, colleges: [], keys: location ? [location] : [] };
    }
    if (['OM', ...PROFESSOR_ROLES].includes(role)) {
        const c = await resolveCollege(location);
        if (c) return { orgWide: false, colleges: [c], keys: c.keys };
        return { orgWide: false, colleges: [], keys: location ? [location] : [] };
    }
    return { orgWide: false, colleges: [], keys: [] };
}

export function scopeAllows(scope: AcademicScope, locationValue?: string | null) {
    if (scope.orgWide) return true;
    return !!locationValue && scope.keys.includes(locationValue);
}

/**
 * Professors the scope may see. Optional collegeFilter (a Location id/name) narrows it further;
 * a filter outside the scope returns nothing.
 */
export async function professorsInScope(scope: AcademicScope, collegeFilter?: string | null) {
    const query: any = { role: { $in: PROFESSOR_ROLES } };
    let keys: string[] | null = scope.orgWide ? null : scope.keys;
    if (collegeFilter && collegeFilter !== 'All') {
        const filterKeys = await collegeKeysFor(collegeFilter);
        keys = keys ? keys.filter(k => filterKeys.includes(k)) : filterKeys;
        if (keys.length === 0 && !scope.orgWide) return [];
    }
    if (keys) {
        if (keys.length === 0) return [];
        query.location = { $in: keys };
    }
    return Employee.find(query).select('id name email location role designation').lean();
}

/** The professor, if the scope may act on them */
export async function professorIfInScope(scope: AcademicScope, facultyId: string) {
    const prof: any = await Employee.findOne({ id: facultyId, role: { $in: PROFESSOR_ROLES } }).lean();
    if (!prof) return null;
    return scopeAllows(scope, prof.location) ? prof : null;
}

/** Colleges the user can pick in a college filter */
export async function selectableColleges(scope: AcademicScope): Promise<College[]> {
    if (!scope.orgWide) return scope.colleges;
    const locs = await Location.find({}).lean();
    return locs.map(collegeFromLocation);
}

// ─────────────────────────── recipients (Module 25) ───────────────────────────
/**
 * Users of the given roles who are responsible for a college.
 * HOI / OM / CURRICULUM_LEAD: mapped to that college (a CL without a college covers every college).
 * CURRICULUM_HEAD / AD: head-office roles, always included.
 */
export async function collegeRecipients(collegeValue: string | null | undefined, roles: string[]) {
    const keys = await collegeKeysFor(collegeValue);
    const or: any[] = [];
    const local = roles.filter(r => ['HOI', 'OM', 'CURRICULUM_LEAD'].includes(r));
    if (local.length && keys.length) or.push({ role: { $in: local }, location: { $in: keys } });
    // The HOI who heads this campus (Location.hoiId), even when their own location is another campus
    if (roles.includes('HOI') && collegeValue) {
        const loc: any = await Location.findOne({ $or: [{ id: collegeValue }, { name: collegeValue }, { shortName: collegeValue }] }).select('hoiId').lean();
        if (loc?.hoiId) or.push({ role: 'HOI', id: loc.hoiId });
    }
    if (roles.includes('CURRICULUM_LEAD')) or.push({ role: 'CURRICULUM_LEAD', $or: [{ location: { $exists: false } }, { location: null }, { location: '' }] });
    const global = roles.filter(r => ['CURRICULUM_HEAD', 'AD'].includes(r));
    if (global.length) or.push({ role: { $in: global } });
    if (!or.length) return [];
    const list = await Employee.find({ $or: or, status: { $ne: 'Inactive' } }).select('id name email role location').lean();
    const seen = new Set<string>();
    return list.filter((e: any) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

export async function employeesByIds(ids: string[]) {
    if (!ids.length) return [];
    return Employee.find({ id: { $in: ids } }).select('id name email role location').lean();
}

// ─────────────────────────── notifications ───────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotifyInput = {
    recipients: any[];                     // employee docs (id, name, email, role)
    title: string;                         // also the email subject
    message: string;                       // in-app text and email intro
    type: string;
    link?: string;                         // portal path, e.g. /faculty/sprint-plan
    entityType?: string;
    entityId?: string;
    college?: string;
    actor?: { id: string; name: string } | null;
    rows?: { label: string; value: any }[];
    listItems?: string[];
    note?: string;
    email?: boolean;                       // default true
};

/**
 * Save one in-app notification per recipient and email each of them (existing SMTP mailer).
 * Email problems never break the workflow: the result is stored on the notification (emailStatus).
 */
export async function notify(input: NotifyInput) {
    const seen = new Set<string>();
    const recipients = (input.recipients || []).filter((r: any) => r?.id && !seen.has(r.id) && seen.add(r.id));
    if (!recipients.length) return { notified: 0, emailed: 0 };

    const createdAt = nowISO();
    const docs = recipients.map((r: any) => ({
        id: newId('NTF'),
        recipientId: r.id, recipientName: r.name, recipientRole: r.role,
        title: input.title, message: input.message, type: input.type,
        link: input.link, entityType: input.entityType, entityId: input.entityId, college: input.college,
        actorId: input.actor?.id, actorName: input.actor?.name,
        read: false, createdAt,
        emailStatus: input.email === false ? 'SKIPPED' : 'PENDING',
    }));
    await Notification.insertMany(docs);

    let emailed = 0;
    if (input.email !== false) {
        const tpl = getAcademicNotificationTemplate({
            title: input.title,
            intro: input.message,
            rows: input.rows,
            listItems: input.listItems,
            note: input.note,
            link: input.link ? appUrl(input.link) : undefined,
        });
        await Promise.all(recipients.map(async (r: any, i: number) => {
            const email = String(r.email || '').trim();
            // Same placeholder-address rule as /api/send-email
            if (!EMAIL_RE.test(email) || email.toLowerCase().endsWith('@gog.com')) {
                await Notification.updateOne({ id: docs[i].id }, { $set: { emailStatus: 'SKIPPED', emailError: 'No valid email address' } });
                return;
            }
            const res: any = await sendMailInternal({ to: email, subject: tpl.subject, html: tpl.html });
            if (res?.success) emailed++;
            await Notification.updateOne({ id: docs[i].id }, { $set: res?.success ? { emailStatus: 'SENT' } : { emailStatus: 'FAILED', emailError: String(res?.error || 'Unknown error').slice(0, 300) } });
        }));
    }
    return { notified: docs.length, emailed };
}

/** Never let a notification problem undo a workflow step that already succeeded */
export async function notifySafe(input: NotifyInput) {
    try {
        return await notify(input);
    } catch (e: any) {
        console.error('[notify] failed:', e?.message);
        return { notified: 0, emailed: 0 };
    }
}

export function weekLabel(start: string, end?: string) {
    const fmt = (s: string) => { const [y, m, d] = s.split('-'); return `${d}-${m}-${y}`; };
    return end ? `${fmt(start)} to ${fmt(end)}` : fmt(start);
}