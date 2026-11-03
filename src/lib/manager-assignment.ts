/**
 * SERVER-ONLY: Assign Manager — one manager per employee, picked by name (stored by employee id).
 *
 * The page replaces "Assign HOI". Where the manager is kept depends on who is picked, so every HOI workflow keeps
 * working exactly as before:
 *   - an HOI for an HOI-managed role (Professor, OM, Tech Team, Marketing Team) → the existing HOI mapping
 *     (Employee.reportsTo — same rule as before: the previous HOI is replaced, other entries are kept)
 *   - anyone else → ReportingManager (general reporting manager; adds no approval rights by itself)
 * Professors / Faculty / OMs can only get an HOI (academic workflows depend on it). Existing HOI assignments are
 * read as each employee's current manager and are never changed unless HR reassigns that employee.
 * Every change is logged (ManagerAssignmentLog) and emailed after it is saved.
 */
import { Employee } from '@/models/Schemas';
import { ReportingManager, ManagerAssignmentLog } from '@/models/ManagerAssignment';
import { sendMailInternal, MAIN_ADMIN_EMAIL } from '@/lib/mail-server';
import { getAcademicNotificationTemplate } from '@/lib/mail-templates';

export const INACTIVE_STATUS = /inactive|terminated|resigned|exited|relieved|left|removed|separated/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ROLE_TITLE: Record<string, string> = {
    FOUNDER: 'Founder', HR: 'HR', HR_EXECUTIVE: 'HR Executive', AD: 'Associate Director', TL: 'Tech Lead', HOI: 'HOI',
    OM: 'Operations Manager', FACULTY: 'Professor', PROFESSOR: 'Professor', MARKETING_TEAM: 'Marketing Team',
    TECH_TEAM: 'Tech Team', TECH_INTERN: 'Tech Intern', CURRICULUM_HEAD: 'Curriculum Head', CURRICULUM_LEAD: 'Curriculum Lead',
};
export const roleTitle = (r?: string) => ROLE_TITLE[String(r || '')] || String(r || '').replace(/_/g, ' ');
const designationOf = (e: any) => String(e?.designation || e?.current_designation_at_gog || '').trim() || roleTitle(e?.role);

/** Roles an HOI can be assigned to (same list as the former Assign HOI page / /api/hr/assign) */
export const HOI_ASSIGNABLE_ROLES = ['FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM'];
/** Academic roles: their manager is always an HOI */
export const HOI_ONLY_ROLES = ['FACULTY', 'PROFESSOR', 'OM'];

/** Who may assign managers: HR (incl. HR Executive, who acts with the HR role) and Founders */
export const canAssignManagers = (actor: { role: string } | null | undefined) => !!actor && ['HR', 'FOUNDER'].includes(actor.role);

export const isActiveEmployee = (e: any) => !!e && e.isRemoved !== true && !INACTIVE_STATUS.test(String(e.status || 'Active'));

export const nowIso = () => new Date().toISOString();
export const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const fmtDate = (ymd?: string) => { if (!ymd) return '—'; const [y, m, d] = ymd.slice(0, 10).split('-'); return `${d}-${m}-${y}`; };
const istDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const reportsToOf = (e: any): string[] => (Array.isArray(e?.reportsTo) ? e.reportsTo : e?.reportsTo ? [e.reportsTo] : []).filter(Boolean).map(String);

/** Public card of an employee (no password / personal data) */
export function personCard(e: any) {
    return {
        id: String(e.id), name: String(e.name || e.id), email: String(e.email || ''), role: String(e.role || ''),
        roleLabel: roleTitle(e.role), designation: designationOf(e), dept: String(e.dept || ''), location: String(e.location || ''),
        status: String(e.status || 'Active'),
    };
}

/** employeeId → ReportingManager row (general managers only; used by the Organization Chart) */
export async function currentManagerMap(): Promise<Map<string, any>> {
    const rows: any[] = await ReportingManager.find({}).lean();
    return new Map(rows.map(r => [String(r.employeeId), r]));
}

/**
 * Current manager of every employee: the assigned HOI (existing HOI mapping) when there is one, otherwise the
 * general reporting manager. employeeId → { managerId, source: 'HOI' | 'MANAGER', row? }
 */
export async function combinedManagerMap(employees?: any[]) {
    const list: any[] = employees || await Employee.find({}).select('id role reportsTo').lean();
    const hoiIds = new Set(list.filter(e => e.role === 'HOI').map(e => String(e.id)));
    const general = await currentManagerMap();
    const map = new Map<string, { managerId: string; source: 'HOI' | 'MANAGER'; row?: any }>();
    for (const e of list) {
        const id = String(e.id);
        const hoi = reportsToOf(e).find(x => hoiIds.has(x));
        if (hoi && HOI_ASSIGNABLE_ROLES.includes(e.role)) map.set(id, { managerId: hoi, source: 'HOI' });
        else if (general.has(id)) map.set(id, { managerId: general.get(id).managerId, source: 'MANAGER', row: general.get(id) });
    }
    return map;
}

/** Would `managerId` → … chain reach `employeeId`? (prevents circular reporting) */
export function createsCycle(employeeId: string, managerId: string, map: Map<string, { managerId: string }>) {
    const seen = new Set<string>();
    let cur: string | undefined = managerId;
    while (cur && !seen.has(cur)) {
        if (cur === employeeId) return true;
        seen.add(cur);
        cur = map.get(cur)?.managerId;
    }
    return false;
}

async function activeEmailsOf(list: any[]) {
    return list.filter(e => e && isActiveEmployee(e) && !e.mailsStopped && EMAIL_RE.test(String(e.email || '').trim()))
        .map(e => String(e.email).trim().toLowerCase());
}

/** TO: employee + new manager · CC: previous manager (reassignment), HR, HR Executive, Technical Admin (deduplicated) */
export async function assignmentRecipients(emp: any, manager: any, previous: any | null) {
    const to = new Set<string>(await activeEmailsOf([emp, manager]));
    const team: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE'] } }).select('email status mailsStopped isRemoved').lean();
    const cc = new Set<string>([...(previous ? await activeEmailsOf([previous]) : []), ...(await activeEmailsOf(team))]);
    if (EMAIL_RE.test(MAIN_ADMIN_EMAIL)) cc.add(MAIN_ADMIN_EMAIL.toLowerCase());
    to.forEach(e => cc.delete(e));
    return { to: Array.from(to), cc: Array.from(cc) };
}

export type AssignInput = { employeeId: string; managerId: string; effectiveDate?: string; reason?: string };
type Actor = { id: string; name: string; role: string; employee?: any; hrExecutive?: boolean };
export type AssignResult = { ok: true; message: string; log: any; current: any } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): AssignResult => ({ ok: false, status, error });

export async function assignManager(actor: Actor, input: AssignInput): Promise<AssignResult> {
    if (!canAssignManagers(actor)) return fail(403, 'Only HR can assign reporting managers.');
    const employeeId = String(input.employeeId || '').trim();
    const managerId = String(input.managerId || '').trim();
    if (!employeeId || !managerId) return fail(400, 'Select the employee and the reporting manager.');
    if (employeeId === managerId) return fail(400, 'An employee cannot be their own manager.');
    const effectiveDate = String(input.effectiveDate || istToday()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || isNaN(new Date(`${effectiveDate}T00:00:00Z`).getTime())) return fail(400, 'Enter a valid effective date.');
    const reason = String(input.reason || '').trim().slice(0, 1000);

    const [emp, manager]: any[] = await Promise.all([
        Employee.findOne({ id: employeeId }).lean(),
        Employee.findOne({ id: managerId }).lean(),
    ]);
    if (!emp || !isActiveEmployee(emp)) return fail(404, 'Employee not found (or not active).');
    if (!manager) return fail(400, 'Invalid manager: no employee with this ID.');
    if (!isActiveEmployee(manager)) return fail(400, 'The selected manager is not an active employee.');
    // Same person under another role (same login email) cannot manage themselves either
    if (emp.email && manager.email && String(emp.email).trim().toLowerCase() === String(manager.email).trim().toLowerCase()) {
        return fail(400, 'An employee cannot be assigned as their own manager (same person, different role record).');
    }
    const viaHoi = manager.role === 'HOI' && HOI_ASSIGNABLE_ROLES.includes(emp.role);
    if (HOI_ONLY_ROLES.includes(emp.role) && !viaHoi) return fail(400, `A ${roleTitle(emp.role)} reports to an HOI — please pick an HOI as the manager.`);

    const all: any[] = await Employee.find({}).select('id role reportsTo').lean();
    const map = await combinedManagerMap(all);
    const current = map.get(employeeId) || null;
    if (current && current.managerId === managerId) return fail(409, `${manager.name} is already the manager of ${emp.name}. Nothing changed.`);
    if (createsCycle(employeeId, managerId, map)) return fail(400, `Circular reporting is not allowed: ${manager.name} already reports (directly or indirectly) to ${emp.name}.`);
    // Reason and effective date are optional (the form no longer asks for them; effective date defaults to today)

    const previous: any = current ? await Employee.findOne({ id: current.managerId }).lean() : null;
    const now = nowIso();
    const logId = `MGR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
    const role = actor.hrExecutive ? 'HR Executive' : roleTitle(actor.role);
    const set = { managerId, effectiveDate, assignedBy: actor.id, assignedByName: actor.name, assignedByRole: role, assignedAt: now, reason, logId };
    const hoiIds = new Set(all.filter(e => e.role === 'HOI').map(e => String(e.id)));
    const reportsTo = reportsToOf(emp);
    const otherManagers = reportsTo.filter(x => !hoiIds.has(x));

    let saved: any = null;
    if (viaHoi) {
        // Existing HOI mapping (same rule as /api/hr/assign): new HOI first, other entries kept
        const upd = await Employee.findOneAndUpdate({ id: employeeId, reportsTo: emp.reportsTo ?? { $exists: false } } as any,
            { $set: { reportsTo: Array.from(new Set([managerId, ...otherManagers])) } }, { new: true }).lean().catch(() => null);
        if (!upd) return fail(409, 'The employee was changed meanwhile. Refresh and try again.');
        await ReportingManager.deleteOne({ employeeId });   // one manager per employee
        saved = { employeeId, ...set, source: 'HOI' };
    } else {
        // General reporting manager. An HOI-managed employee moved to a non-HOI manager leaves the HOI mapping.
        if (current?.source === 'HOI') {
            const upd = await Employee.findOneAndUpdate({ id: employeeId, reportsTo: current.managerId } as any, { $set: { reportsTo: otherManagers } }, { new: true }).lean().catch(() => null);
            if (!upd) return fail(409, 'The employee was changed meanwhile. Refresh and try again.');
        }
        try {
            saved = current?.source === 'MANAGER'
                ? await ReportingManager.findOneAndUpdate({ employeeId, managerId: current.managerId }, { $set: set }, { new: true })
                : await ReportingManager.findOneAndUpdate({ employeeId }, { $set: { employeeId, ...set } }, { new: true, upsert: true });
        } catch (e: any) {
            if (e?.code === 11000) return fail(409, 'This employee was just assigned a manager by someone else. Refresh and try again.');
            throw e;
        }
        if (!saved) return fail(409, 'The manager was changed meanwhile. Refresh and try again.');
        saved = { ...(saved.toObject ? saved.toObject() : saved), source: 'MANAGER' };
    }

    const log: any = await ManagerAssignmentLog.create({
        id: logId, employeeId, employeeName: emp.name, employeeRole: emp.role,
        previousManagerId: current?.managerId || '', previousManagerName: previous?.name || (current ? current.managerId : ''),
        newManagerId: managerId, newManagerName: manager.name, action: current ? 'REASSIGNED' : 'ASSIGNED',
        effectiveDate, reason, assignedBy: actor.id, assignedByName: actor.name, assignedByRole: role, assignedAt: now, emailStatus: 'PENDING',
    });

    // Email only after the assignment is saved
    const mail = await sendAssignmentEmail(log.toObject(), emp, manager, previous);
    await ManagerAssignmentLog.updateOne({ id: logId }, { $set: { emailStatus: mail.status, emailError: mail.error || '', emailRecipients: mail.recipients } });

    return {
        ok: true,
        message: `${emp.name} now reports to ${manager.name}.${mail.status === 'SENT' ? ' Email sent.' : mail.status === 'FAILED' ? ' (Email could not be sent — see history.)' : ''}`,
        log: { ...log.toObject(), emailStatus: mail.status, emailRecipients: mail.recipients },
        current: saved,
    };
}

async function sendAssignmentEmail(log: any, emp: any, manager: any, previous: any | null) {
    const recipients = await assignmentRecipients(emp, manager, previous);
    const re = log.action === 'REASSIGNED';
    const tpl = getAcademicNotificationTemplate({
        title: re ? `GOG OMS | Reporting Manager Changed — ${emp.name}` : `GOG OMS | Reporting Manager Assigned — ${emp.name}`,
        intro: re
            ? 'Dear Team, this is to inform you that the reporting manager of the following employee has been changed in GOG OMS.'
            : 'Dear Team, this is to inform you that a reporting manager has been assigned to the following employee in GOG OMS.',
        rows: [
            { label: 'Employee Name', value: emp.name }, { label: 'Employee ID', value: emp.id },
            { label: 'Designation', value: designationOf(emp) }, { label: 'Department', value: emp.dept || '—' },
            ...(re ? [{ label: 'Previous Manager', value: previous ? `${previous.name} (${previous.id}) — ${designationOf(previous)}` : log.previousManagerName || log.previousManagerId }] : []),
            { label: re ? 'New Manager Name' : 'Manager Name', value: manager.name }, { label: 'Manager Employee ID', value: manager.id },
            { label: 'Manager Designation', value: designationOf(manager) }, { label: 'Manager Department', value: manager.dept || '—' },
            { label: 'Effective Date', value: fmtDate(log.effectiveDate) },
            ...(log.reason ? [{ label: re ? 'Reason for Reassignment' : 'Note', value: log.reason }] : []),
            { label: re ? 'Updated By' : 'Assigned By', value: `${log.assignedByName} (${log.assignedByRole})` },
            { label: re ? 'Updated At' : 'Assignment Date', value: istDateTime(log.assignedAt) },
        ],
        note: 'The reporting relationship has been updated in the GOG OMS employee management system and Organization Chart. Regards, GOG OMS — Automated Notification System.',
        color: '#6366f1',
    });
    if (!recipients.to.length && !recipients.cc.length) return { status: 'SKIPPED', error: 'No valid recipient email address', recipients };
    try {
        const res: any = await sendMailInternal({ to: recipients.to.length ? recipients.to : recipients.cc, cc: recipients.to.length ? recipients.cc : [], subject: tpl.subject, html: tpl.html, noAutoCc: true });
        return { status: res?.success ? 'SENT' : 'FAILED', error: res?.success ? '' : String(res?.error || 'Unknown error').slice(0, 300), recipients };
    } catch (e: any) {
        return { status: 'FAILED', error: String(e?.message || e).slice(0, 300), recipients };
    }
}