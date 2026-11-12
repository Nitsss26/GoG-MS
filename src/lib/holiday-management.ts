/**
 * SERVER-ONLY: Announcements → Holiday Management (HR / HR Executive / Founder and HOI).
 *
 * Reads the existing Holiday records (one record per day; collegeIds = colleges, forAll / no college = all colleges,
 * employeeIds = assigned manually to those employees) and shows them as rows:
 *   • College-wise — one row per college of the record (or one "All colleges" row)
 *   • Manual       — one row per employee of an employee-only record
 *
 * Who sees what
 *   HR / HR Executive / Founder → every holiday.
 *   HOI → only its colleges (the same "assigned colleges" the HOI announces to) and the employees of those colleges.
 * Who may remove
 *   HR / HR Executive / Founder → any holiday (as before: HR manages holidays).
 *   HOI → only a holiday the HOI announced itself, only for its own colleges / their employees.
 *
 * Remove (the holiday record is deleted or changed — no "Cancelled" status, as decided):
 *   • one college of a record  → that college is taken out of the record (record deleted when none is left)
 *   • "All colleges" record    → the day record is deleted
 *   • one employee, manual     → the employee is taken out of the record (record deleted when none is left)
 *   • one employee of a college-wide holiday → the employee is added to excludedEmployeeIds: the holiday no longer
 *     applies to that employee only (every holiday reader honours it), other employees keep it.
 * Every removal is written to HolidayAudit (who, when, the record before), and the attendance flags that were removed
 * only because of that holiday become active again (restoreFlagsAfterHolidayRemoval).
 * Announcements are never changed here.
 */
import { Holiday, Employee, Location } from '@/models/Schemas';
import { HolidayAudit } from '@/models/HolidayAudit';
import { hoiColleges } from '@/lib/college-announcements';
import { holidayCoversEmployee, restoreFlagsAfterHolidayRemoval } from '@/lib/holiday-flag-removal';

const INACTIVE = ['Inactive', 'Removed', 'Exited', 'Resigned', 'Terminated'];
export const isHolidayAdmin = (a: any) => !!a && ['HR', 'FOUNDER'].includes(a.role);
export const canOpenHolidayManagement = (a: any) => isHolidayAdmin(a) || a?.role === 'HOI';

type Ctx = {
    admin: boolean;
    colleges: { id: string; name: string }[];             // colleges this user may see
    mine: Set<string>;                                     // ids of those colleges
    nameOf: (id: string) => string;
    collegeOf: (location?: string) => string;              // employee location (id / name / short name) → college id
    emps: any[];                                           // active employees (with .college)
    empById: Map<string, any>;
};

async function context(actor: any): Promise<Ctx> {
    const admin = isHolidayAdmin(actor);
    const locs: any[] = await Location.find({}).select('id name shortName').lean();
    const keyToId = new Map<string, string>();
    locs.forEach(l => [l.id, l.name, l.shortName].filter(Boolean).forEach(k => keyToId.set(String(k), String(l.id))));
    const collegeOf = (v?: string) => (v ? keyToId.get(String(v)) || String(v) : '');
    const names = new Map(locs.map(l => [String(l.id), String(l.name || l.shortName || l.id)]));
    const colleges = admin ? locs.map(l => ({ id: String(l.id), name: String(l.name || l.shortName || l.id) })).sort((a, b) => a.name.localeCompare(b.name)) : await hoiColleges(actor);
    const raw: any[] = await Employee.find({ status: { $nin: INACTIVE } }).select('id name role location designation').lean();
    const emps = raw.map(e => ({ id: e.id, name: e.name, role: e.role, designation: e.designation || '', location: e.location || '', college: collegeOf(e.location) }));
    return {
        admin, colleges, mine: new Set(colleges.map(c => c.id)),
        nameOf: (id: string) => names.get(id) || colleges.find(c => c.id === id)?.name || id,
        collegeOf, emps, empById: new Map(emps.map(e => [e.id, e])),
    };
}

const isAllColleges = (h: any) => !(h.employeeIds || []).length && (!!h.forAll || !(h.collegeIds || []).length);
const statusLabel = (s?: string) => (s === 'Approved' ? 'Active' : s === 'Proposed' ? 'Pending Approval' : s === 'Rejected' ? 'Rejected' : String(s || ''));
const ROLE_LABEL: Record<string, string> = { HR: 'HR', HR_EXECUTIVE: 'HR Executive', FOUNDER: 'Founder', HOI: 'HOI', AD: 'AD' };

function assignedBy(h: any, ctx: Ctx) {
    if (h.source === 'HOI_ANNOUNCEMENT') return { name: h.proposedByName || '', role: 'HOI' };
    const byId = h.approvedBy || h.proposedBy;
    const role = ctx.empById.get(String(h.proposedBy || ''))?.role;
    return { name: h.approvedByName || h.proposedByName || '', role: h.assignedManually || h.source === 'HR_MANUAL' ? 'HR' : ROLE_LABEL[role || ''] || (byId ? 'HR' : '') };
}

/** May this user remove (part of) this holiday? `collegeId` / employee college = the part being removed */
export function canRemove(actor: any, h: any, ctx: Ctx, collegeId?: string) {
    if (ctx.admin) return true;
    if (actor?.role !== 'HOI') return false;
    if (h.source !== 'HOI_ANNOUNCEMENT' || h.proposedBy !== actor.id) return false;
    return !!collegeId && ctx.mine.has(collegeId);
}

/** Employees a college-wide row applies to (excluded employees left out) */
function collegeEmployees(h: any, collegeId: string, ctx: Ctx) {
    const ex = new Set<string>(h.excludedEmployeeIds || []);
    return ctx.emps.filter(e => !ex.has(e.id) && (collegeId === 'ALL' ? (ctx.admin || ctx.mine.has(e.college)) : e.college === collegeId));
}

function rowsOf(h: any, ctx: Ctx, actor: any) {
    const by = assignedBy(h, ctx);
    const base = {
        holidayId: h.id, name: h.name, date: h.date, status: statusLabel(h.status), rawStatus: h.status || '',
        assignedBy: by.name, assignedByRole: by.role, source: h.source || '', reason: h.reason || h.customMessage || '',
        excludedCount: (h.excludedEmployeeIds || []).length,
    };
    const out: any[] = [];
    const empIds: string[] = h.employeeIds || [];
    if (empIds.length) {
        empIds.forEach((id, i) => {
            const e = ctx.empById.get(id);
            const college = e?.college || '';
            if (!ctx.admin && !ctx.mine.has(college)) return;
            out.push({ ...base, key: `${h.id}|E|${id}`, type: 'Manual', collegeId: college, collegeName: college ? ctx.nameOf(college) : '—',
                employeeId: id, employeeName: e?.name || (h.employeeNames || [])[i] || id, assignedTo: e?.name || (h.employeeNames || [])[i] || id,
                employeeCount: 1, canRemove: canRemove(actor, h, ctx, college) });
        });
        return out;
    }
    if (isAllColleges(h)) {
        out.push({ ...base, key: `${h.id}|C|ALL`, type: 'College-wise', collegeId: 'ALL', collegeName: 'All colleges', assignedTo: 'All colleges',
            employeeCount: collegeEmployees(h, 'ALL', ctx).length, canRemove: ctx.admin });
        return out;
    }
    (h.collegeIds || []).forEach((cid: string) => {
        if (!ctx.admin && !ctx.mine.has(cid)) return;
        out.push({ ...base, key: `${h.id}|C|${cid}`, type: 'College-wise', collegeId: cid, collegeName: ctx.nameOf(cid), assignedTo: 'College',
            employeeCount: collegeEmployees(h, cid, ctx).length, canRemove: canRemove(actor, h, ctx, cid) });
    });
    return out;
}

/** Every row this user may see, newest date first */
export async function listHolidayRows(actor: any) {
    const ctx = await context(actor);
    const all: any[] = await Holiday.find({}).lean();
    const rows = all.flatMap(h => rowsOf(h, ctx, actor))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.name).localeCompare(String(b.name)) || String(a.collegeName).localeCompare(String(b.collegeName)));
    return { rows, colleges: ctx.colleges, canManageAll: ctx.admin };
}

/** View Assigned Employees of one row */
export async function assignedEmployees(actor: any, rowKey: string) {
    const [holidayId, kind, part] = String(rowKey || '').split('|');
    const ctx = await context(actor);
    const h: any = await Holiday.findOne({ id: holidayId }).lean();
    if (!h) return { ok: false as const, status: 404, error: 'Holiday not found.' };
    const row = rowsOf(h, ctx, actor).find(r => r.key === rowKey);
    if (!row) return { ok: false as const, status: 404, error: 'This holiday is not in your colleges.' };
    const status = statusLabel(h.status);
    let list: any[] = [];
    if (kind === 'E') {
        const e = ctx.empById.get(part);
        list = [{ employeeId: part, name: row.employeeName, designation: e?.designation || '', collegeName: row.collegeName, type: 'Manual', holidayId: h.id, status, canRemove: row.canRemove }];
    } else {
        list = collegeEmployees(h, part, ctx).map(e => ({ employeeId: e.id, name: e.name, designation: e.designation, collegeName: e.college ? ctx.nameOf(e.college) : '—', type: 'College-wise', holidayId: h.id, status,
            canRemove: canRemove(actor, h, ctx, e.college) }));
        // the same holiday assigned manually to employees of this college on that day
        const same: any[] = await Holiday.find({ date: h.date, id: { $ne: h.id } }).lean();
        const shown = new Set(list.map(x => x.employeeId));
        same.filter(x => (x.employeeIds || []).length && String(x.name || '').trim().toLowerCase() === String(h.name || '').trim().toLowerCase()).forEach(x => {
            (x.employeeIds as string[]).forEach((id, i) => {
                const e = ctx.empById.get(id);
                if (!e || shown.has(id) || (part !== 'ALL' && e.college !== part) || (!ctx.admin && !ctx.mine.has(e.college))) return;
                shown.add(id);
                list.push({ employeeId: id, name: e.name || (x.employeeNames || [])[i] || id, designation: e.designation, collegeName: e.college ? ctx.nameOf(e.college) : '—', type: 'Manual', holidayId: x.id, status: statusLabel(x.status), canRemove: canRemove(actor, x, ctx, e.college) });
            });
        });
        list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    return { ok: true as const, holiday: { id: h.id, name: h.name, date: h.date, status, collegeName: row.collegeName, type: row.type }, employees: list };
}

const nowIso = () => new Date().toISOString();
const auditId = () => `HA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

/** Remove a holiday from one college (collegeId, 'ALL' = the whole all-colleges day) or one employee (employeeId) */
export async function removeHoliday(actor: any, input: { holidayId?: string; collegeId?: string; employeeId?: string }) {
    const holidayId = String(input.holidayId || '');
    const employeeId = String(input.employeeId || '');
    const collegeId = String(input.collegeId || '');
    if (!holidayId || (!employeeId && !collegeId)) return { ok: false as const, status: 400, error: 'Select the holiday and the college or employee.' };
    const ctx = await context(actor);
    const h: any = await Holiday.findOne({ id: holidayId }).lean();
    if (!h) return { ok: false as const, status: 404, error: 'This holiday was already removed.' };
    const by = { by: actor.id, byName: actor.name, byRole: actor.hrExecutive ? 'HR Executive' : ROLE_LABEL[actor.role] || actor.role, at: nowIso() };
    const audit = (x: any) => HolidayAudit.create({ id: auditId(), holidayId: h.id, holidayName: h.name, date: h.date, ...by, before: h, ...x }).catch((e: any) => console.error('[holiday-audit]', e?.message));
    const empIds: string[] = h.employeeIds || [];

    if (employeeId) {
        const e = ctx.empById.get(employeeId) || { id: employeeId, name: (h.employeeNames || [])[empIds.indexOf(employeeId)] || employeeId, college: '' };
        if (!ctx.admin && !ctx.mine.has(e.college)) return { ok: false as const, status: 403, error: 'This employee is not in your colleges.' };
        if (!canRemove(actor, h, ctx, e.college)) return { ok: false as const, status: 403, error: ctx.admin ? 'Not allowed.' : 'You can only remove holidays you announced yourself.' };
        if (empIds.includes(employeeId)) {
            // manual holiday: take this employee out (the others keep it)
            const i = empIds.indexOf(employeeId);
            const ids = empIds.filter(x => x !== employeeId);
            const names = (h.employeeNames || []).filter((_: any, j: number) => j !== i);
            if (ids.length) {
                const r = await Holiday.findOneAndUpdate({ id: h.id, employeeIds: employeeId }, { $set: { employeeIds: ids, employeeNames: names } }, { returnDocument: 'after' }).lean();
                if (!r) return { ok: false as const, status: 409, error: 'This holiday was just changed. Refresh and try again.' };
            } else {
                await Holiday.deleteOne({ id: h.id });
            }
            const restored = h.status === 'Approved' ? await restoreFlagsAfterHolidayRemoval(h.date, x => x.id === employeeId) : 0;
            await audit({ action: 'REMOVE_EMPLOYEE', employeeId, employeeName: e.name, collegeId: e.college, collegeName: e.college ? ctx.nameOf(e.college) : '', flagsRestored: restored });
            return { ok: true as const, restored, message: `Holiday "${h.name}" removed for ${e.name}${restored ? ` · ${restored} attendance flag${restored === 1 ? '' : 's'} active again` : ''}.` };
        }
        // college-wide / all-colleges holiday: this employee only is excluded
        if (empIds.length || !holidayCoversEmployee(h, { id: employeeId, location: e.college })) return { ok: false as const, status: 409, error: 'This holiday is not assigned to this employee.' };
        const r = await Holiday.findOneAndUpdate({ id: h.id, excludedEmployeeIds: { $ne: employeeId } },
            { $addToSet: { excludedEmployeeIds: employeeId }, $push: { excludedEmployees: { id: employeeId, name: e.name, by: by.by, byName: by.byName, at: by.at } } }, { returnDocument: 'after' }).lean();
        if (!r) return { ok: false as const, status: 409, error: 'This holiday was already removed for this employee.' };
        const restored = h.status === 'Approved' ? await restoreFlagsAfterHolidayRemoval(h.date, x => x.id === employeeId) : 0;
        await audit({ action: 'EXCLUDE_EMPLOYEE', employeeId, employeeName: e.name, collegeId: e.college, collegeName: e.college ? ctx.nameOf(e.college) : '', flagsRestored: restored });
        return { ok: true as const, restored, message: `Holiday "${h.name}" removed for ${e.name} only${restored ? ` · ${restored} attendance flag${restored === 1 ? '' : 's'} active again` : ''}.` };
    }

    if (empIds.length) return { ok: false as const, status: 400, error: 'This holiday is assigned to employees — remove it per employee.' };
    if (collegeId === 'ALL') {
        if (!isAllColleges(h)) return { ok: false as const, status: 400, error: 'This holiday is not for all colleges.' };
        if (!ctx.admin) return { ok: false as const, status: 403, error: 'Only HR can remove an all-colleges holiday.' };
        await Holiday.deleteOne({ id: h.id });
        const restored = h.status === 'Approved' ? await restoreFlagsAfterHolidayRemoval(h.date, x => holidayCoversEmployee(h, x)) : 0;
        await audit({ action: 'REMOVE_DAY', collegeId: 'ALL', collegeName: 'All colleges', flagsRestored: restored });
        return { ok: true as const, restored, message: `Holiday "${h.name}" removed for all colleges${restored ? ` · ${restored} attendance flag${restored === 1 ? '' : 's'} active again` : ''}.` };
    }
    const cols: string[] = h.collegeIds || [];
    if (h.forAll || !cols.includes(collegeId)) return { ok: false as const, status: 409, error: 'This holiday is not assigned to this college.' };
    if (!ctx.admin && !ctx.mine.has(collegeId)) return { ok: false as const, status: 403, error: 'This college is not assigned to you.' };
    if (!canRemove(actor, h, ctx, collegeId)) return { ok: false as const, status: 403, error: 'You can only remove holidays you announced yourself.' };
    const rest = cols.filter(c => c !== collegeId);
    if (rest.length) {
        const r = await Holiday.findOneAndUpdate({ id: h.id, collegeIds: collegeId }, { $set: { collegeIds: rest } }, { returnDocument: 'after' }).lean();
        if (!r) return { ok: false as const, status: 409, error: 'This holiday was just changed. Refresh and try again.' };
    } else {
        await Holiday.deleteOne({ id: h.id });
    }
    const keys = new Set<string>([collegeId]);
    ctx.emps.forEach(e => { if (e.college === collegeId && e.location) keys.add(e.location); });
    const restored = h.status === 'Approved' ? await restoreFlagsAfterHolidayRemoval(h.date, x => !!x.location && (keys.has(x.location) || ctx.collegeOf(x.location) === collegeId)) : 0;
    const cname = ctx.nameOf(collegeId);
    await audit({ action: 'REMOVE_COLLEGE', collegeId, collegeName: cname, flagsRestored: restored });
    return { ok: true as const, restored, message: `Holiday "${h.name}" removed from ${cname}${rest.length ? ' (other colleges keep it)' : ''}${restored ? ` · ${restored} attendance flag${restored === 1 ? '' : 's'} active again` : ''}.` };
}
