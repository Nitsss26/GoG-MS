/**
 * SERVER-ONLY: My Salary & Payable Days, Correction Tickets and Flag Removal.
 * Reads the existing OMS records (attendance, leave, holidays, attendance violations, dress code) — it never
 * writes to them. Calculation rules: src/lib/payable-days.ts.
 */
import { Employee, Attendance, LeaveRequest, Holiday, AttendanceViolation, ExitRecord, Location, Notification } from '@/models/Schemas';
import { FlagRemoval, SalaryCounter, PayableCorrection } from '@/models/SalaryModule';
import { calculatePayableDays, daysInMonth, CATEGORY_OF, TYPE_LABEL, LEVEL_LABEL, VIOLATION_CLOSED, ladder } from '@/lib/payable-days';
import { sendMailInternal, MAIN_ADMIN_EMAIL } from '@/lib/mail-server';
import { getAcademicNotificationTemplate } from '@/lib/mail-templates';
import { hoisAbove, collegeName } from '@/lib/academic';

// ─────────────────────────── access ───────────────────────────
/** HR, HR Executive (role HR in the session) and Founders */
export const canRemoveFlags = (actor: any) => !!actor && ['HR', 'FOUNDER'].includes(actor.role);
export const canManageTickets = (actor: any) => !!actor && actor.role === 'HR';                 // HR + HR Executive (role HR in session)
export const canViewSalaryAdmin = (actor: any) => !!actor && ['HR', 'FOUNDER'].includes(actor.role); // Founders: monitoring only
export const canCorrectPayable = (actor: any) => !!actor && actor.role === 'HR';
export const actorRoleLabel = (actor: any) =>
    actor?.hrExecutive || actor?.session?.actualRole === 'HR_EXECUTIVE' ? 'HR Executive' : actor?.role === 'FOUNDER' ? 'Founder' : actor?.role === 'HR' ? 'HR' : String(actor?.role || '');

// ─────────────────────────── dates ───────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
export function istToday(): string {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
}
export const isMonth = (m: any) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const isYmd = (d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
export const monthLabel = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
export const fmtDate = (ymd?: string) => (ymd && isYmd(ymd) ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ymd || '');
export const istDateTime = (iso: string) => {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
        time: d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
    };
};
export const nowIso = () => new Date().toISOString();
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
export const IMAGE_URL_RE = /^https:\/\/[^\s"'<>]+$/i;
const appUrl = (path: string) => (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '') + path;

export const employeeCard = (e: any, locName?: string) => ({
    id: e.id, name: e.name, email: e.email || '', role: e.role, dept: e.dept || '',
    designation: e.designation || e.current_designation_at_gog || '', location: e.location || '', locationName: locName || '',
});

// ─────────────────────────── payable days ───────────────────────────
/** TO_NON_PAYABLE / TO_PAYABLE — also for records saved without "direction" (older model still loaded): the
 *  updated status / negative adjustment tell the direction */
export const correctionDirection = (c: any) =>
    c?.direction === 'TO_NON_PAYABLE' || c?.updatedPayableStatus === 'Non-Payable' || Number(c?.adjustment) < 0 ? 'TO_NON_PAYABLE' : 'TO_PAYABLE';

/** One calculation for many employees (same rules everywhere: employee page, HR, HR Executive, Founders) */
export async function payableForMany(emps: any[], month: string) {
    const start = `${month}-01`, end = `${month}-${pad(daysInMonth(month))}`;
    const ids = emps.map(e => e.id);
    if (!ids.length) return new Map<string, ReturnType<typeof calculatePayableDays>>();
    const [att, leaves, hol, viol, exits, removed, corr] = await Promise.all([
        Attendance.find({ employeeId: { $in: ids }, date: { $gte: start, $lte: end } })
            .select('_id employeeId date status clockIn clockOut workMode location dressCodeStatus dressCodeRejectionReasons').lean(),
        LeaveRequest.find({ employeeId: { $in: ids }, startDate: { $lte: end }, endDate: { $gte: start } }).select('employeeId id type leaveType startDate endDate days status').lean(),
        Holiday.find({ date: { $gte: start, $lte: end }, status: 'Approved' }).select('date forAll collegeIds').lean(),
        AttendanceViolation.find({ employeeId: { $in: ids }, date: { $gte: start, $lte: end } }).select('employeeId id date type level instance proposedDeduction hrStatus scheduledTime actualTime').lean(),
        ExitRecord.find({ employeeId: { $in: ids } }).select('employeeId lastWorkingDay').lean(),
        FlagRemoval.find({ employeeId: { $in: ids }, flagDate: { $gte: start, $lte: end } }).select('employeeId flagId removedAt removedByName removalReason').lean(),
        PayableCorrection.find({ employeeId: { $in: ids }, month, status: 'ACTIVE' }).lean(),
    ]);
    const by = (rows: any[]) => { const m = new Map<string, any[]>(); for (const r of rows) { if (!m.has(r.employeeId)) m.set(r.employeeId, []); m.get(r.employeeId)!.push(r); } return m; };
    const A = by(att as any[]), L = by(leaves as any[]), V = by(viol as any[]), R = by(removed as any[]), C = by(corr as any[]);
    const lwd = new Map((exits as any[]).filter(x => x.lastWorkingDay).map(x => [x.employeeId, x.lastWorkingDay]));
    const today = istToday();
    const asOf = month === today.slice(0, 7) ? today : undefined;
    const out = new Map<string, ReturnType<typeof calculatePayableDays>>();
    for (const emp of emps) {
        const holidays = (hol as any[]).filter(h => h.forAll || !h.collegeIds?.length || (emp.location && h.collegeIds.includes(emp.location))).map(h => h.date);
        out.set(emp.id, calculatePayableDays({
            month, asOf,
            joiningDate: emp.joiningDate || undefined,
            exitDate: emp.noticePeriod?.lastWorkingDay || lwd.get(emp.id) || undefined,
            attendance: A.get(emp.id) || [], leaves: L.get(emp.id) || [], holidays, violations: V.get(emp.id) || [],
            removed: new Map((R.get(emp.id) || []).map(r => [r.flagId, { removedAt: r.removedAt, removedByName: r.removedByName, removalReason: r.removalReason }])),
            corrections: new Map((C.get(emp.id) || []).map(c => [c.date, { id: c.id, direction: correctionDirection(c), correctionCategory: c.correctionCategory, correctionReason: c.correctionReason, correctedByName: c.correctedByName, correctedByRole: c.correctedByRole, correctedAt: c.correctedAt, relatedTicketId: c.relatedTicketId }])),
        }));
    }
    return out;
}

export async function payableDaysFor(emp: any, month: string) {
    return (await payableForMany([emp], month)).get(emp.id)!;
}

/** Employees who are on the salary list for a month (joined by month end, not exited / removed before it) */
export async function salaryEmployees(month: string) {
    const start = `${month}-01`, end = `${month}-${pad(daysInMonth(month))}`;
    const emps: any[] = await Employee.find({}).select('id name email role dept designation current_designation_at_gog location joiningDate status reportsTo noticePeriod mailsStopped').lean();
    return emps.filter(e => {
        if (e.role === 'FOUNDER') return false;
        if (e.joiningDate && String(e.joiningDate) > end) return false;
        const exit = e.noticePeriod?.lastWorkingDay;
        if (exit && exit < start) return false;
        return !/^(inactive|removed|exited|resigned|terminated)$/i.test(String(e.status || '')) || (exit && exit >= start);
    });
}

// ─────────────────────────── flags (HR view) ───────────────────────────
export type FlagRow = {
    flagId: string; source: 'VIOLATION' | 'DRESS_CODE'; sourceId: string;
    employeeId: string; employeeName: string; dept: string; designation: string; location: string; locationName: string; role: string;
    category: string; type: string; typeLabel: string; date: string; level: string; levelLabel: string; deduction: string; hrStatus: string;
    detail: string; status: 'Active' | 'Removed'; removal?: any;
};

/** Resolve one flag from its id (the original record, read only) */
export async function resolveFlag(flagId: string): Promise<{ row: FlagRow; snapshot: any } | null> {
    const [kind, ...rest] = String(flagId || '').split(':');
    const sid = rest.join(':');
    if (!sid) return null;
    if (kind === 'VIO') {
        const v: any = await AttendanceViolation.findOne({ id: sid }).lean();
        if (!v) return null;
        const rows = await toRows([], [v]);
        return rows[0] ? { row: rows[0], snapshot: { level: v.level, instance: v.instance, proposedDeduction: v.proposedDeduction, hrStatus: v.hrStatus, scheduledTime: v.scheduledTime, actualTime: v.actualTime, type: v.type } } : null;
    }
    if (kind === 'DRESS') {
        if (!/^[0-9a-f]{24}$/i.test(sid)) return null;
        const a: any = await Attendance.findById(sid).select('_id employeeId date dressCodeStatus dressCodeRejectionReasons dressCodeReviewedByName dressCodeReviewedAt').lean();
        if (!a || a.dressCodeStatus !== 'Rejected') return null;
        const rows = await toRows([a], []);
        return rows[0] ? { row: rows[0], snapshot: { dressCodeStatus: a.dressCodeStatus, reasons: a.dressCodeRejectionReasons || [], reviewedByName: a.dressCodeReviewedByName, reviewedAt: a.dressCodeReviewedAt, level: rows[0].level, deduction: rows[0].deduction } } : null;
    }
    return null;
}

/** Dress-code ladder position (rejections in the same month before this one, removed ones excluded) */
async function dressLevels(dress: any[]) {
    const out = new Map<string, { level: string; deduction: string; instance: number }>();
    const groups = new Map<string, any[]>();
    for (const a of dress) { const k = `${a.employeeId}|${String(a.date).slice(0, 7)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(a); }
    for (const [k, list] of groups) {
        const [employeeId, month] = k.split('|');
        const all: any[] = await Attendance.find({ employeeId, date: { $gte: `${month}-01`, $lte: `${month}-31` }, dressCodeStatus: 'Rejected' }).select('_id date').lean();
        const removed = new Set(((await FlagRemoval.find({ employeeId, source: 'DRESS_CODE', flagDate: { $gte: `${month}-01`, $lte: `${month}-31` } }).select('flagId').lean()) as any[]).map(r => r.flagId));
        let n = 0;
        for (const a of all.sort((x, y) => x.date.localeCompare(y.date))) {
            if (removed.has(`DRESS:${String(a._id)}`)) continue;
            n++;
            const l = ladder(n);
            out.set(String(a._id), { ...l, instance: n });
        }
        void list;
    }
    return out;
}

async function toRows(dress: any[], viol: any[]): Promise<FlagRow[]> {
    const ids = Array.from(new Set([...dress.map(d => d.employeeId), ...viol.map(v => v.employeeId)]));
    const emps: any[] = ids.length ? await Employee.find({ id: { $in: ids } }).select('id name role dept designation current_designation_at_gog location').lean() : [];
    const empMap = new Map(emps.map(e => [e.id, e]));
    const locIds = Array.from(new Set(emps.map(e => e.location).filter(Boolean)));
    const locs: any[] = locIds.length ? await Location.find({ $or: [{ id: { $in: locIds } }, { name: { $in: locIds } }] }).select('id name').lean() : [];
    const locName = (v: string) => locs.find(l => l.id === v || l.name === v)?.name || v || '';
    const flagIds = [...viol.map(v => `VIO:${v.id}`), ...dress.map(d => `DRESS:${String(d._id)}`)];
    const removals: any[] = flagIds.length ? await FlagRemoval.find({ flagId: { $in: flagIds } }).lean() : [];
    const remMap = new Map(removals.map(r => [r.flagId, r]));
    const levels = await dressLevels(dress);
    const base = (empId: string) => {
        const e = empMap.get(empId) || {};
        return { employeeId: empId, employeeName: e.name || empId, dept: e.dept || '', designation: e.designation || e.current_designation_at_gog || '', location: e.location || '', locationName: locName(e.location), role: e.role || '' };
    };
    const rows: FlagRow[] = [];
    for (const v of viol) {
        const flagId = `VIO:${v.id}`, rem = remMap.get(flagId);
        rows.push({
            flagId, source: 'VIOLATION', sourceId: v.id, ...base(v.employeeId),
            category: CATEGORY_OF[v.type] || 'OTHER', type: v.type, typeLabel: TYPE_LABEL[v.type] || v.type, date: v.date,
            level: v.level || '', levelLabel: LEVEL_LABEL[v.level] || v.level || '', deduction: v.proposedDeduction || 'None', hrStatus: v.hrStatus || '',
            detail: [v.scheduledTime ? `Scheduled ${v.scheduledTime}` : '', v.actualTime ? `Actual ${v.actualTime}` : '', v.instance ? `Instance ${v.instance}` : ''].filter(Boolean).join(' · '),
            status: rem ? 'Removed' : 'Active', ...(rem ? { removal: publicRemoval(rem) } : {}),
        });
    }
    for (const a of dress) {
        const flagId = `DRESS:${String(a._id)}`, rem = remMap.get(flagId), lv = levels.get(String(a._id));
        rows.push({
            flagId, source: 'DRESS_CODE', sourceId: String(a._id), ...base(a.employeeId),
            category: 'DRESS_CODE', type: 'DRESS_CODE', typeLabel: 'Dress Code', date: a.date,
            level: lv?.level || '', levelLabel: lv ? LEVEL_LABEL[lv.level] : (rem ? (rem.originalSnapshot?.level ? LEVEL_LABEL[rem.originalSnapshot.level] || '' : '') : ''),
            deduction: lv?.deduction || rem?.originalSnapshot?.deduction || 'None', hrStatus: 'Rejected',
            detail: Array.isArray(a.dressCodeRejectionReasons) && a.dressCodeRejectionReasons.length ? `Reasons: ${a.dressCodeRejectionReasons.join(', ')}` : '',
            status: rem ? 'Removed' : 'Active', ...(rem ? { removal: publicRemoval(rem) } : {}),
        });
    }
    return rows;
}

export const publicRemoval = (r: any) => ({
    id: r.id, removalReason: r.removalReason, supportingImageUrl: r.supportingImageUrl || '', removedByName: r.removedByName, removedByRole: r.removedByRole,
    removedAt: r.removedAt, emailStatus: r.emailStatus, emailError: r.emailError || '', notificationRecipients: r.notificationRecipients,
});

export async function listFlags(f: { from?: string; to?: string }) {
    const date: any = {};
    if (f.from) date.$gte = f.from;
    if (f.to) date.$lte = f.to;
    const dq = Object.keys(date).length ? { date } : {};
    const [viol, dress] = await Promise.all([
        AttendanceViolation.find({ ...dq, hrStatus: { $nin: VIOLATION_CLOSED } }).select('id employeeId date type level instance proposedDeduction hrStatus scheduledTime actualTime').lean(),
        Attendance.find({ ...dq, dressCodeStatus: 'Rejected' }).select('_id employeeId date dressCodeStatus dressCodeRejectionReasons').lean(),
    ]);
    return toRows(dress as any[], viol as any[]);
}

// ─────────────────────────── recipients + email ───────────────────────────
const activeEmails = (rows: any[]) => rows
    .filter(r => r && !r.isRemoved && !r.mailsStopped && !/^(inactive|removed|exited|resigned|terminated)$/i.test(String(r.status || '')))
    .map(r => String(r.email || '').trim().toLowerCase())
    .filter(e => EMAIL_RE.test(e) && !e.endsWith('@gog.com'));

/** TO: employee + technical admin. CC: HR, HR Executive, all Founders, and (professors) their own HOI(s). */
export async function flagRemovalRecipients(emp: any) {
    const to = new Set<string>(activeEmails([emp]));
    if (EMAIL_RE.test(MAIN_ADMIN_EMAIL)) to.add(MAIN_ADMIN_EMAIL.toLowerCase());
    const team: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE', 'FOUNDER'] } }).select('email status mailsStopped isRemoved').lean();
    const cc = new Set<string>(activeEmails(team));
    if (['PROFESSOR', 'FACULTY'].includes(emp.role)) {
        // the professor's HOI(s): reporting hierarchy (HR "Appoint HOI") + the HOI who heads the professor's campus
        const hois: any[] = await hoisAbove(emp.id);
        if (emp.location) {
            const loc: any = await Location.findOne({ $or: [{ id: emp.location }, { name: emp.location }] }).select('hoiId').lean();
            if (loc?.hoiId) { const h: any = await Employee.findOne({ id: loc.hoiId, role: 'HOI' }).select('email status mailsStopped isRemoved').lean(); if (h) hois.push(h); }
        }
        activeEmails(hois).forEach(e => cc.add(e));
    }
    to.forEach(e => cc.delete(e));
    return { to: Array.from(to), cc: Array.from(cc) };
}

export async function sendFlagRemovalEmail(removalId: string, actorId: string) {
    const r: any = await FlagRemoval.findOne({ id: removalId }).lean();
    if (!r) return { ok: false, error: 'Removal not found' };
    const emp: any = await Employee.findOne({ id: r.employeeId }).lean();
    const recipients = emp ? await flagRemovalRecipients(emp) : { to: [MAIN_ADMIN_EMAIL], cc: [] as string[] };
    const when = istDateTime(r.removedAt);
    const tpl = getAcademicNotificationTemplate({
        title: `GOG OMS | Employee Flag Removed — ${r.employeeName}`,
        intro: 'Dear Team, this is to inform you that an employee flag has been removed from the GOG OMS following an authorized review.',
        rows: [
            { label: 'Employee Name', value: r.employeeName }, { label: 'Employee ID', value: r.employeeId },
            { label: 'Department', value: r.dept || '—' }, { label: 'College / Location', value: r.locationName || r.location || '—' },
            { label: 'Flag Category', value: r.flagLabel }, { label: 'Flag Date', value: fmtDate(r.flagDate) },
            { label: 'Original Flag Status', value: 'Active' }, { label: 'Updated Flag Status', value: 'Removed' },
            { label: 'Removed By', value: `${r.removedByName} (${r.removedByRole})` }, { label: 'Designation', value: r.removedByDesignation || r.removedByRole },
            { label: 'Removal Date', value: when.date }, { label: 'Removal Time', value: when.time },
            { label: 'Reason for Removal', value: r.removalReason },
            { label: 'Supporting Evidence', value: r.supportingImageUrl || 'Not provided' },
        ],
        note: 'The flag-removal action has been recorded in the GOG OMS audit history. Regards, GOG OMS — Automated Notification System.',
        color: '#10b981',
    });
    let res: any;
    if (!recipients.to.length && !recipients.cc.length) res = { success: false, error: 'No valid recipient email address' };
    else res = await sendMailInternal({ to: recipients.to, cc: recipients.cc, subject: tpl.subject, html: tpl.html, noAutoCc: true } as any);
    const status = res?.success ? 'SENT' : 'FAILED';
    await FlagRemoval.updateOne({ id: removalId }, {
        $set: { notificationRecipients: recipients, emailStatus: status, emailError: res?.success ? '' : String(res?.error || 'Unknown error').slice(0, 300), ...(res?.success ? { emailSentAt: nowIso() } : {}) },
        $inc: { emailAttempts: 1 },
        $push: { emailLog: { at: nowIso(), by: actorId, status, error: res?.success ? '' : String(res?.error || '').slice(0, 300) } },
    });
    // in-app notice for the employee
    try {
        await Notification.create({
            id: `NTF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            recipientId: r.employeeId, recipientName: r.employeeName, title: `Flag removed — ${r.flagLabel} (${fmtDate(r.flagDate)})`,
            message: `Your ${r.flagLabel} flag of ${fmtDate(r.flagDate)} was removed by ${r.removedByName}. Reason: ${r.removalReason}`,
            type: 'FLAG_REMOVED', link: `/my-payable-days?month=${String(r.flagDate).slice(0, 7)}`, entityType: 'FlagRemoval', entityId: r.id,
            actorId, actorName: r.removedByName, read: false, createdAt: nowIso(), emailStatus: status,
        });
    } catch { /* notice is best effort */ }
    return { ok: res?.success, status, recipients };
}

// ─────────────────────────── tickets ───────────────────────────
export const TICKET_CATEGORIES = [
    'Payable Days Incorrect', 'Paid Leave Not Counted', 'Unpaid Leave Incorrect', 'Attendance Incorrect',
    'Dress Code Fine Incorrect', 'Clock-In / Clock-Out Penalty', 'Flag-Related Issue', 'Other Salary-Related Issue',
];
export const TICKET_STATUSES = ['Open', 'Under Review', 'Additional Information Required', 'Approved', 'Rejected', 'Resolved'];

/** What the employee may see of a ticket (no HR-internal comments) */
export const forEmployee = (t: any) => {
    const { internalComments, _id, __v, ...rest } = t || {};
    void internalComments; void _id; void __v;
    return rest;
};

export async function nextTicketId() {
    const year = istToday().slice(0, 4);
    const c: any = await SalaryCounter.findOneAndUpdate({ key: `OMS-PAY-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
    return `OMS-PAY-${year}-${String(c.seq).padStart(5, '0')}`;
}

/** In-app + email to one employee (best effort) */
export async function notifyEmployee(emp: any, title: string, message: string, link: string, rows: { label: string; value: any }[], actor: any, entityId: string) {
    let emailStatus = 'SKIPPED';
    try {
        if (activeEmails([emp]).length) {
            const tpl = getAcademicNotificationTemplate({ title, intro: message, rows, link: appUrl(link) ? appUrl(link) : undefined });
            const res: any = await sendMailInternal({ to: emp.email, subject: tpl.subject, html: tpl.html });
            emailStatus = res?.success ? 'SENT' : 'FAILED';
        }
    } catch { emailStatus = 'FAILED'; }
    try {
        await Notification.create({
            id: `NTF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            recipientId: emp.id, recipientName: emp.name, recipientRole: emp.role, title, message, type: 'SALARY_TICKET', link,
            entityType: 'CorrectionTicket', entityId, actorId: actor?.id, actorName: actor?.name, read: false, createdAt: nowIso(), emailStatus,
        });
    } catch { /* best effort */ }
    return emailStatus;
}

/** New ticket → in-app notice + one email to HR / HR Executive */
export async function notifyHrNewTicket(t: any) {
    const team: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE'] } }).select('id name role email status mailsStopped isRemoved').lean();
    const title = `Salary correction ticket ${t.id} — ${t.employee?.name}`;
    const message = `${t.employee?.name} (${t.employeeId}) raised a "${t.category}" correction for ${t.month ? monthLabel(t.month) : '—'}.`;
    try {
        await Notification.insertMany(team.map(h => ({
            id: `NTF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
            recipientId: h.id, recipientName: h.name, recipientRole: h.role, title, message, type: 'SALARY_TICKET_NEW',
            link: `/hr/salary-management?tab=tickets&ticket=${t.id}`, entityType: 'CorrectionTicket', entityId: t.id, actorId: t.employeeId, actorName: t.employee?.name,
            read: false, createdAt: nowIso(),
        })));
    } catch { /* best effort */ }
    const to = activeEmails(team);
    if (!to.length) return;
    const tpl = getAcademicNotificationTemplate({
        title, intro: message,
        rows: [
            { label: 'Ticket ID', value: t.id }, { label: 'Category', value: t.category }, { label: 'Month', value: t.month ? monthLabel(t.month) : '' },
            { label: 'Currently Displayed', value: t.currentValue }, { label: 'Expected Value', value: t.expectedValue }, { label: 'Reason', value: t.reason },
        ],
        link: appUrl(`/hr/salary-management?tab=tickets&ticket=${t.id}`) || undefined,
    });
    try { await sendMailInternal({ to, subject: tpl.subject, html: tpl.html }); } catch { /* best effort */ }
}

export const CORRECTION_CATEGORIES = [
    'Holiday Not Reflected', 'Employee Was Present but Could Not Clock In', 'Clock-In / Clock-Out Technical Issue',
    'Incorrect Attendance Calculation', 'Incorrect Leave Deduction', 'Approved Paid Leave Not Counted',
    'College Holiday', 'Official Duty / Work Assignment', 'Other',
];
export const NON_PAYABLE_CATEGORIES = [
    'Absent but Attendance Recorded', 'Unauthorized Absence', 'Leave Not Applied / Not Approved', 'Incorrect Attendance Calculation',
    'Holiday Not Applicable', 'Proxy / Invalid Clock-In', 'Other',
];
/** A real explanation: at least 20 characters, 4 words and some variety (not "aaaa" / "ok ok ok ok") */
export function meaningfulReason(r: string) {
    const t = String(r || '').trim();
    const words = t.split(/\s+/).filter(w => /[a-z]/i.test(w));
    const letters = new Set(t.toLowerCase().replace(/[^a-z]/g, ''));
    return t.length >= 20 && words.length >= 4 && new Set(words.map(w => w.toLowerCase())).size >= 3 && letters.size >= 6;
}

export { collegeName };