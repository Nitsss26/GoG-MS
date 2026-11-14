/**
 * SERVER-ONLY: My Profile (Edit Profile) and the HR / HR Executive Employee Directory.
 * Both read and write the same Employee record. Document links never leave the server (files open through
 * /api/documents/view after a permission check). HR Executive sees bank / identity numbers masked.
 */
import { Employee, Attendance, Location } from '@/models/Schemas';
import { payableForMany } from '@/lib/salary-module';
import { daysInMonth } from '@/lib/payable-days';
import {
    PROFILE_FIELDS, PROFILE_DOCS, readField, fieldByKey, docByKey, maskTail, missingItems, profileStatus,
    validateField, cleanValue, SECTION_LABEL, type ProfileField, type ProfileDoc,
} from '@/lib/profile-fields';

export type Actor = { id: string; name: string; role: string; hrExecutive?: boolean; employee?: any };

const ROLE_LABEL: Record<string, string> = {
    FOUNDER: 'Founder', HR: 'HR', HR_EXECUTIVE: 'HR Executive', AD: 'AD', TL: 'Tech Lead', HOI: 'HOI', OM: 'OM', FACULTY: 'Faculty', PROFESSOR: 'Professor',
    MARKETING_TEAM: 'Marketing Team', TECH_TEAM: 'Tech Team', TECH_INTERN: 'Tech Intern', CURRICULUM_HEAD: 'Curriculum Head', CURRICULUM_LEAD: 'Curriculum Lead',
};
export const roleLabel = (r?: string) => (r ? ROLE_LABEL[r] || r : '');
/** HR (incl. HR Executive) and Founder manage employee profiles — same as the existing employee update rules */
export const canManageProfiles = (a?: Actor | null) => !!a && (a.role === 'HR' || a.role === 'FOUNDER');
/** HR Executive: bank / identity numbers masked, bank documents restricted */
export const masksSensitive = (a: Actor) => a.role === 'HR' && !!a.hrExecutive;

const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const ymOf = (d: string) => d.slice(0, 7);
const addMonths = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
export const isMonth = (m: any) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

async function lookups() {
    const [locs, all]: any[] = await Promise.all([
        Location.find({}).select('id name shortName').lean(),
        Employee.find({ isRemoved: { $ne: true } }).select('id email role').lean(),
    ]);
    const loc = new Map<string, string>();
    (locs as any[]).forEach(l => [l.id, l.name, l.shortName].filter(Boolean).forEach((k: string) => loc.set(k, l.name)));
    const rolesByEmail = new Map<string, string[]>();
    (all as any[]).forEach(e => {
        const k = String(e.email || '').toLowerCase(); if (!k) return;
        rolesByEmail.set(k, Array.from(new Set([...(rolesByEmail.get(k) || []), roleLabel(e.role)])));
    });
    return {
        colleges: (locs as any[]).map(l => ({ id: l.id, name: l.name })).sort((a, b) => String(a.name).localeCompare(String(b.name))),
        campus: (v?: string) => (v ? loc.get(v) || v : ''),
        roles: (e: any) => (e.email && rolesByEmail.get(String(e.email).toLowerCase())) || [roleLabel(e.role)],
    };
}

/** May this viewer open this employee's profile? */
export function canView(actor: Actor, targetId: string) { return actor.id === targetId || canManageProfiles(actor); }

/** Fields this viewer may change on this employee */
export function editableFields(actor: Actor, targetId: string): ProfileField[] {
    const self = actor.id === targetId;
    const hr = canManageProfiles(actor);
    return PROFILE_FIELDS.filter(f => {
        if (f.edit === 'none') return false;
        if (hr) return !(f.sensitive && masksSensitive(actor));
        return self && f.edit === 'self';
    });
}
export function editableDocs(actor: Actor, targetId: string): ProfileDoc[] {
    const self = actor.id === targetId;
    if (canManageProfiles(actor)) return PROFILE_DOCS.filter(d => !(d.sensitive && masksSensitive(actor)));
    return self ? PROFILE_DOCS : [];
}

/** Profile as the viewer may see it. Document links are never included — only whether a file is there. */
export async function profilePayload(emp: any, actor: Actor) {
    const L = await lookups();
    const mask = masksSensitive(actor) && actor.id !== emp.id;
    const values: Record<string, string> = {};
    PROFILE_FIELDS.forEach(f => {
        let v = readField(emp, f);
        if (f.key === 'location') v = emp.location || '';
        if (f.key === 'email') v = emp.email || '';
        if (f.key === 'name') v = emp.name || '';
        if (mask && f.sensitive && v && f.key !== 'account_holder_name' && f.key !== 'bankName') v = maskTail(v);
        values[f.key] = v;
    });
    return {
        id: emp.id, name: emp.name || '', email: emp.email || '', photoUrl: emp.photoUrl || '',
        role: emp.role, roleLabel: roleLabel(emp.role), roles: L.roles(emp), status: emp.status || '',
        onboardingStatus: emp.onboardingStatus || (emp.isOnboarded ? 'Approved' : ''),
        college: L.campus(emp.location), colleges: canManageProfiles(actor) ? L.colleges : [],
        values, masked: mask,
        documents: PROFILE_DOCS.map(d => ({ key: d.key, label: d.label, group: d.group, uploaded: !!readField(emp, d), restricted: !!(mask && d.sensitive) })),
        missing: missingItems(emp), profileStatus: profileStatus(emp),
        editable: editableFields(actor, emp.id).map(f => f.key),
        editableDocs: editableDocs(actor, emp.id).map(d => d.key),
        canChangePhoto: canManageProfiles(actor),
        // Performance Metrics are shown read-only (never editable here)
        metrics: { chancesRemaining: emp.chancesRemaining ?? null, markPresentUsed: emp.markPresentUsed ?? 0 },
    };
}

export class ProfileError extends Error { constructor(public status: number, msg: string) { super(msg); } }

/**
 * Save an Edit Profile / HR edit. Only changed values are written; documents can be uploaded or replaced, never removed.
 * Older field names that the record still uses are kept in step, and the change is written to the employee's
 * existing activity log (who, when, which fields — bank / identity values themselves are not logged).
 */
export async function applyProfileEdit(actor: Actor, targetId: string, body: { fields?: Record<string, any>; documents?: Record<string, any>; photoUrl?: any }) {
    if (!canView(actor, targetId)) throw new ProfileError(403, 'You can only edit your own profile.');
    const emp: any = await Employee.findOne({ id: targetId, isRemoved: { $ne: true } }).lean();
    if (!emp) throw new ProfileError(404, 'Employee not found.');
    const fieldsIn = body.fields && typeof body.fields === 'object' ? body.fields : {};
    const docsIn = body.documents && typeof body.documents === 'object' ? body.documents : {};
    const allowedF = new Set(editableFields(actor, targetId).map(f => f.key));
    const allowedD = new Set(editableDocs(actor, targetId).map(d => d.key));
    const today = todayYmd();
    const $set: Record<string, any> = {};
    const changed: string[] = [], errors: string[] = [];
    const setWithNames = (f: { key: string; aliases?: string[]; mirror?: string[] }, v: string) => {
        $set[f.key] = v;
        (f.mirror || []).forEach(k => {
            // Date of Birth: keep the format the second field already uses (DD-MM-YYYY or YYYY-MM-DD)
            if (k === 'dateOfBirth' && /^\d{2}-\d{2}-\d{4}$/.test(String(emp.dateOfBirth || ''))) { const [y, m, d] = v.split('-'); $set[k] = `${d}-${m}-${y}`; }
            else $set[k] = v;
        });
        (f.aliases || []).forEach(k => { if (k in emp) $set[k] = v; });   // older name still on this record
    };
    for (const [key, raw] of Object.entries(fieldsIn)) {
        const f = fieldByKey(key);
        if (!f) { errors.push(`Unknown field: ${key}`); continue; }
        if (!allowedF.has(key)) throw new ProfileError(403, `${f.label} cannot be changed${actor.id === targetId && !canManageProfiles(actor) ? ' by you — please contact HR' : ''}.`);
        const v = cleanValue(f, raw);
        const before = f.key === 'location' ? String(emp.location || '') : f.key === 'name' ? String(emp.name || '') : readField(emp, f);
        if (v === before) continue;                 // unchanged → not written
        const err = validateField(f, v, today);
        if (err) { errors.push(err); continue; }
        if (f.key === 'location' && v && !(await Location.exists({ id: v }))) { errors.push('Selected college does not exist.'); continue; }
        setWithNames(f, v);
        changed.push(f.label);
    }
    for (const [key, raw] of Object.entries(docsIn)) {
        const d = docByKey(key);
        if (!d) { errors.push(`Unknown document: ${key}`); continue; }
        if (!allowedD.has(key)) throw new ProfileError(403, `${d.label} cannot be changed by you.`);
        const v = String(raw ?? '').trim();
        if (!v) { errors.push(`${d.label}: documents can be replaced but not removed.`); continue; }
        if (!/^https:\/\/[^\s"'<>]+$/i.test(v)) { errors.push(`${d.label}: upload failed (invalid file link).`); continue; }
        if (v === readField(emp, d)) continue;
        setWithNames(d, v);
        changed.push(`${d.label} (${readField(emp, d) ? 'replaced' : 'uploaded'})`);
    }
    // Profile photo (shown everywhere: sidebar, directory, org chart, celebrations): HR / HR Executive / Founder may replace it
    if (body.photoUrl !== undefined) {
        if (!canManageProfiles(actor)) throw new ProfileError(403, 'Only HR can change another employee\'s photo.');
        const v = String(body.photoUrl ?? '').trim();
        if (!v) errors.push('Profile photo: choose an image to upload.');
        else if (!/^https:\/\/[^\s"'<>]+$/i.test(v)) errors.push('Profile photo: upload failed (invalid file link).');
        else if (v !== String(emp.photoUrl || '')) { $set.photoUrl = v; changed.push(emp.photoUrl ? 'Profile Photo (replaced)' : 'Profile Photo (uploaded)'); }
    }
    if (errors.length) throw new ProfileError(400, errors.join(' '));
    if (!changed.length) return { changed: [], employee: emp };
    const isSelf = actor.id === targetId;
    const entry = {
        at: new Date().toISOString(), by: actor.id, byName: actor.name,
        role: actor.hrExecutive ? 'HR_EXECUTIVE' : actor.role,
        action: isSelf ? 'Profile updated by employee (Edit Profile)' : 'Profile updated by HR (Employee Directory)',
        note: changed.join(', ').slice(0, 900),
    };
    // collection update: keeps older field names (not in the schema) in step as well
    await Employee.collection.updateOne({ id: targetId }, { $set, $push: { onboardingActivity: entry } } as any);
    const fresh: any = await Employee.findOne({ id: targetId }).lean();
    return { changed, employee: fresh };
}

// ───────────────────────── Employee Directory ─────────────────────────
export async function directoryRows() {
    const L = await lookups();
    const list: any[] = await Employee.find({ isRemoved: { $ne: true } }).lean();
    return {
        colleges: L.colleges,
        rows: list.map(e => ({
            id: e.id, name: e.name || '', photoUrl: e.photoUrl || '', designation: readField(e, fieldByKey('designation')!),
            role: e.role, roles: L.roles(e), dept: e.dept || '', collegeId: e.location || '', college: L.campus(e.location),
            email: e.email || '', phone: readField(e, fieldByKey('phone_no_')!), joiningDate: e.joiningDate || '',
            status: e.status || '', profileStatus: profileStatus(e), missing: missingItems(e).length,
        })).sort((a, b) => a.name.localeCompare(b.name)),
    };
}

// ───────────────────────── Attendance (existing Attendance module) ─────────────────────────
/**
 * Attendance of one employee, from the same records and the same payable-day calculation the Attendance and
 * Salary Management screens use (nothing is recalculated differently here).
 */
export async function attendanceFor(emp: any, month: string, monthsBack = 6) {
    const cur = ymOf(todayYmd());
    const joinYm = /^\d{4}-\d{2}/.test(String(emp.joiningDate || '')) ? String(emp.joiningDate).slice(0, 7) : '';
    const months: string[] = [];
    for (let i = 0; i < monthsBack; i++) { const m = addMonths(cur, -i); if (joinYm && m < joinYm) break; months.push(m); }
    if (!months.includes(month)) months.unshift(month);
    const calcs = new Map<string, any>();
    for (const m of months) calcs.set(m, (await payableForMany([emp], m)).get(emp.id));
    const lateDates = async (m: string) => {
        const rows: any[] = await Attendance.find({ employeeId: emp.id, date: { $gte: `${m}-01`, $lte: `${m}-${String(daysInMonth(m)).padStart(2, '0')}` }, $or: [{ 'flags.late': true }, { status: 'Late' }] }).select('date').lean();
        return new Set(rows.map(r => r.date));
    };
    const summary = (m: string, c: any, late: number) => ({
        month: m, presentDays: c?.presentDays ?? 0, absentDays: c?.absentDays ?? 0, lateDays: late,
        paidLeaves: c?.paidLeaves ?? 0, unpaidLeaves: c?.unpaidLeaves ?? 0, holidayDays: c?.holidayDays ?? 0, weeklyOffDays: c?.weeklyOffDays ?? 0,
        workingDays: c?.workingDays ?? 0, payableDays: c?.payableDays ?? 0, lopDays: c?.lopDays ?? 0, activeFlags: c?.activeFlags ?? 0, provisional: !!c?.provisional,
    });
    const monthly = [];
    let selected: any = null, days: any[] = [];
    for (const m of months.sort().reverse()) {
        const late = await lateDates(m);
        const c = calcs.get(m);
        monthly.push(summary(m, c, late.size));
        if (m === month) {
            selected = summary(m, c, late.size);
            days = (c?.days || []).map((d: any) => ({
                date: d.date, weekday: d.weekday, attendance: d.attendance || '', clockIn: d.clockIn || '', clockOut: d.clockOut || '',
                late: late.has(d.date), leave: d.leave || '', payableStatus: d.payableStatus, reason: d.reason || '',
            }));
        }
    }
    return { month, selected, days, monthly };
}

/** Full View sheet data for HR / HR Executive */
export async function employeeView(actor: Actor, id: string, month: string) {
    const emp: any = await Employee.findOne({ id, isRemoved: { $ne: true } }).lean();
    if (!emp) return null;
    return { profile: await profilePayload(emp, actor), attendance: await attendanceFor(emp, month) };
}

// ───────────────────────── Exports ─────────────────────────
export const DIRECTORY_COLS = [
    { key: 'name', label: 'Employee Name', width: 24 }, { key: 'id', label: 'Employee ID', width: 13 }, { key: 'designation', label: 'Designation', width: 20 },
    { key: 'roles', label: 'Role(s)', width: 18 }, { key: 'dept', label: 'Department', width: 18 }, { key: 'college', label: 'College', width: 24 },
    { key: 'email', label: 'Email', width: 28 }, { key: 'phone', label: 'Phone', width: 15 }, { key: 'joiningDate', label: 'Joining Date', width: 13 },
    { key: 'profileStatus', label: 'Profile Status', width: 14 },
];

type KV = [string, string];
/** One employee's report: no bank / identity numbers in full (masked), no document links */
export async function employeeReport(actor: Actor, id: string, month: string) {
    const v = await employeeView(actor, id, month);
    if (!v) return null;
    const p = v.profile;
    const kv = (section: string): KV[] => PROFILE_FIELDS.filter(f => f.section === section).map(f => {
        let val = p.values[f.key] || '';
        if (f.key === 'location') val = p.college;
        if (f.sensitive && val && f.key !== 'account_holder_name' && f.key !== 'bankName') val = maskTail(val);
        return [f.label, val];
    });
    const a = v.attendance;
    const monthName = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
    return {
        employee: { id: p.id, name: p.name },
        sections: [
            { title: SECTION_LABEL.personal, kv: [['Employee ID', p.id] as KV, ...kv('personal')] },
            { title: SECTION_LABEL.contact, kv: kv('contact') },
            { title: SECTION_LABEL.employment, kv: [...kv('employment'), ['Role(s)', p.roles.join(', ')] as KV, ['Employment Status', p.status] as KV, ['Onboarding Status', p.onboardingStatus] as KV, ['Profile Status', p.profileStatus] as KV] },
            { title: 'Professional Credentials', kv: [['Resume / CV', p.documents.find(d => d.key === 'upload_your_resume')?.uploaded ? 'Uploaded' : 'Not Uploaded'] as KV, ['Experience Letter', p.documents.find(d => d.key === 'experience_letter')?.uploaded ? 'Uploaded' : 'Not Uploaded'] as KV, ['LinkedIn Profile', p.values.linkedin_id || ''] as KV] },
            { title: SECTION_LABEL.academic, kv: kv('academic') },
            { title: `${SECTION_LABEL.banking} (masked)`, kv: kv('banking') },
            {
                title: 'Document Inventory',
                table: { cols: [{ key: 'name', label: 'Document' }, { key: 'group', label: 'Section' }, { key: 'status', label: 'Status' }],
                    rows: p.documents.map(d => ({ name: d.label, group: d.group === 'personal' ? 'Personal Documents' : 'Institutional Document Vault', status: d.restricted ? 'Restricted' : d.uploaded ? 'Uploaded' : 'Not Uploaded' })) },
            },
            {
                title: 'Attendance Summary (month-wise)',
                table: { cols: [{ key: 'month', label: 'Month' }, { key: 'presentDays', label: 'Present' }, { key: 'absentDays', label: 'Absent' }, { key: 'lateDays', label: 'Late' },
                    { key: 'paidLeaves', label: 'Paid Leave' }, { key: 'unpaidLeaves', label: 'Unpaid Leave' }, { key: 'holidayDays', label: 'Holidays' }, { key: 'payableDays', label: 'Payable Days' }, { key: 'lopDays', label: 'LOP' }],
                    rows: a.monthly.map(m => ({ ...m, month: `${monthName(m.month)}${m.provisional ? ' (till today)' : ''}` })) },
            },
            {
                title: `Attendance Records — ${monthName(a.month)}`,
                table: { cols: [{ key: 'date', label: 'Date' }, { key: 'weekday', label: 'Day' }, { key: 'attendance', label: 'Attendance' }, { key: 'clockIn', label: 'Clock-In' },
                    { key: 'clockOut', label: 'Clock-Out' }, { key: 'late', label: 'Late' }, { key: 'payableStatus', label: 'Payable Status' }, { key: 'reason', label: 'Notes' }],
                    rows: a.days.map(d => ({ ...d, late: d.late ? 'Yes' : '' })) },
            },
        ] as { title: string; kv?: KV[]; table?: { cols: { key: string; label: string }[]; rows: Record<string, any>[] } }[],
    };
}