/**
 * SERVER-ONLY: automated attendance violation emails (Late Clock-In, Early Clock-Out, Missing Clock-Out).
 *
 * - One AttendanceViolation row per employee + type + date (unique key) → an event is recorded and emailed once.
 * - Instance count = number of violations of the same type in the tracking period (calendar month, IST),
 *   not counting violations HR waived / approved. Each type is counted separately.
 * - Late / Early: 1st, 2nd, Final warning → 4th Half-Day → 5th+ Full-Day (proposed; "Pending HR Verification",
 *   nothing is deducted until HR approves it for payroll).
 * - Missing Clock-Out: alert 30 min after the scheduled clock-out; the employee explains with proof; HR approves
 *   (attendance regularised, audited) or rejects (record kept for attendance action).
 * - Emails use the existing SMTP sender (src/lib/mail-server.ts). Delivery status is saved on the row; failed
 *   emails are retried (max 3 attempts) by the sweep, with an atomic claim so a mail is not sent twice.
 */
import { randomBytes } from 'crypto';
import { AttendanceViolation, Attendance, Employee, WorkSchedule } from '@/models/Schemas';
import { sendMailInternal } from '@/lib/mail-server';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';

export type ViolationType = 'LATE_IN' | 'EARLY_OUT' | 'MISSING_OUT';
export const VIOLATION_LABEL: Record<ViolationType, string> = { LATE_IN: 'Late Clock-In', EARLY_OUT: 'Early Clock-Out', MISSING_OUT: 'Missing Clock-Out' };
export const MISSING_GRACE_MINS = 30;
const MAX_ATTEMPTS = 3;
const TZ = 'Asia/Kolkata';
/** HR statuses that remove a violation from the instance count */
const NOT_COUNTED = ['Waived', 'Approved'];

const appUrl = (path: string) => (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '') + path;
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);

/** Current date / minutes in IST */
export function istNow(at: Date = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(at).map(x => [x.type, x.value]));
    const hour = Number(p.hour) % 24;
    return { ymd: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute) };
}
const toMins = (t?: string) => { if (!t) return NaN; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
/** "13:05" / "13:05:22" → "01:05 PM" */
export function fmt12(t?: string) {
    const m = toMins(t); if (isNaN(m)) return t || '—';
    const h = Math.floor(m / 60), mm = m % 60;
    return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
export const fmtDuration = (mins?: number) => (mins == null || isNaN(mins) ? '—' : mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`);
const fmtDate = (ymd: string) => ymd.split('-').reverse().join('-');
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

/** Escalation for Late / Early by instance */
export function escalation(instance: number) {
    if (instance <= 1) return { level: 'FIRST_WARNING', proposedDeduction: 'None', hrStatus: 'Not Required' };
    if (instance === 2) return { level: 'SECOND_WARNING', proposedDeduction: 'None', hrStatus: 'Not Required' };
    if (instance === 3) return { level: 'FINAL_WARNING', proposedDeduction: 'None', hrStatus: 'Not Required' };
    if (instance === 4) return { level: 'HALF_DAY', proposedDeduction: 'Half-Day', hrStatus: 'Pending HR Verification' };
    return { level: 'FULL_DAY', proposedDeduction: 'Full-Day', hrStatus: 'Pending HR Verification' };
}
export const LEVEL_LABEL: Record<string, string> = {
    FIRST_WARNING: 'First Warning', SECOND_WARNING: 'Second Warning', FINAL_WARNING: 'Final Warning',
    HALF_DAY: 'Half-Day Deduction', FULL_DAY: 'Full-Day Deduction', MISSING_ALERT: 'Missing Clock-Out Alert',
};

/** Scheduled clock-in / clock-out of an employee on a date (same source as the clock-in / clock-out APIs) */
export async function scheduledTiming(emp: any, ymd: string) {
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${ymd}T12:00:00+05:30`).getUTCDay()];
    const schedule: any = await WorkSchedule.findOne({ employeeId: emp.id, $or: [{ date: ymd }, { date: dayName }] }).lean();
    if (schedule?.clockInTime || schedule?.clockOutTime) return { in: schedule.clockInTime || '09:30', out: schedule.clockOutTime || '18:30' };
    const t = getExpectedTimingInternal(emp.name, emp.location || 'Bhopal', ymd);
    return { in: t.in, out: t.out };
}

// ─────────────────────────── email templates ───────────────────────────
type Mail = { subject: string; paragraphs: string[]; rows: [string, string][]; status?: string; action: string };

function buildMail(v: any): Mail {
    const sched = fmt12(v.scheduledTime), actual = fmt12(v.actualTime), n = v.instance;
    const status = v.hrStatus === 'Approved for Payroll' ? 'Approved for Payroll' : 'Pending HR Verification';
    if (v.type === 'LATE_IN') {
        const base: [string, string][] = [['Attendance Date', fmtDate(v.date)], ['Scheduled Reporting Time', sched], ['Actual Clock-In Time', actual]];
        if (n <= 1) return { subject: 'First Warning – Late Clock-In', rows: [...base, ['Late Duration', fmtDuration(v.durationMins)], ['Late Arrival Instance', '1']],
            paragraphs: [`This is to inform you that your attendance record for ${fmtDate(v.date)} indicates a late clock-in.`, 'This is your first warning. Kindly ensure that you report on time to avoid further disciplinary action under the Attendance SOP.'],
            action: 'Report on time from your next working day.' };
        if (n === 2) return { subject: 'Second Warning – Repeated Late Clock-In', rows: [...base, ['Late Duration', fmtDuration(v.durationMins)], ['Late Arrival Instance', '2']],
            paragraphs: ['Our attendance records indicate that you have reported late for the second time during the applicable attendance tracking period.', 'This is your second warning. Further late arrivals may result in a final warning followed by salary deductions according to the approved Attendance SOP.'],
            action: 'Report on time from your next working day.' };
        if (n === 3) return { subject: 'Final Warning – Late Clock-In', rows: [...base, ['Late Duration', fmtDuration(v.durationMins)], ['Late Arrival Instance', '3']],
            paragraphs: ['This email serves as your final warning regarding repeated late arrivals.', 'Please note that another late arrival may result in a Half-Day salary deduction, subject to the approved Attendance SOP and applicable payroll authorization.'],
            action: 'Report on time; a further late arrival leads to a salary deduction.' };
        if (n === 4) return { subject: 'Attendance Action – Half-Day Salary Deduction', rows: [...base, ['Late Duration', fmtDuration(v.durationMins)], ['Late Arrival Instance', '4']], status,
            paragraphs: ['Our attendance system has recorded your fourth Late Clock-In instance.', 'As per the approved Attendance SOP, this instance has reached the Half-Day salary deduction threshold.', 'The deduction will be finalized only after the required HR verification and payroll authorization.'],
            action: 'Contact HR if you believe this record is incorrect.' };
        return { subject: 'Attendance Action – Full-Day Salary Deduction', rows: [...base, ['Late Duration', fmtDuration(v.durationMins)], ['Late Arrival Instance', String(n)]], status,
            paragraphs: [`Our attendance system has recorded your ${ordinal(n)} Late Clock-In instance.`, 'As per the approved Attendance SOP, this instance has reached the Full-Day salary deduction threshold.', 'The deduction will be finalized after the required HR verification and payroll authorization.'],
            action: 'Contact HR if you believe this record is incorrect.' };
    }
    if (v.type === 'EARLY_OUT') {
        const base: [string, string][] = [['Attendance Date', fmtDate(v.date)], ['Scheduled Clock-Out Time', sched], ['Actual Clock-Out Time', actual], ['Early Departure Duration', fmtDuration(v.durationMins)]];
        if (n <= 1) return { subject: 'First Warning – Early Clock-Out', rows: [...base, ['Early Clock-Out Instance', '1']],
            paragraphs: ['Your attendance record indicates that you clocked out before your scheduled shift-ending time.', 'This is your first warning. Kindly ensure that you complete your assigned working hours.'],
            action: 'Complete your assigned working hours.' };
        if (n === 2) return { subject: 'Second Warning – Repeated Early Clock-Out', rows: [...base, ['Early Clock-Out Instance', '2']],
            paragraphs: ['Our records indicate that you have clocked out before your scheduled shift-ending time for the second time.', 'This is your second warning. Further violations may lead to additional action under the approved Attendance SOP.'],
            action: 'Complete your assigned working hours.' };
        if (n === 3) return { subject: 'Final Warning – Early Clock-Out', rows: [...base, ['Early Clock-Out Instance', '3']],
            paragraphs: ['This email serves as your final warning regarding repeated Early Clock-Out instances.', 'Another Early Clock-Out instance may result in a Half-Day salary deduction, subject to the approved Attendance SOP and applicable payroll authorization.'],
            action: 'Complete your assigned working hours; a further early clock-out leads to a salary deduction.' };
        if (n === 4) return { subject: 'Attendance Action – Half-Day Salary Deduction for Early Clock-Out', rows: [...base, ['Early Clock-Out Instance', '4']], status,
            paragraphs: ['Our attendance system has recorded your fourth Early Clock-Out instance.', 'This instance has reached the Half-Day salary deduction threshold under the approved Attendance SOP.', 'Any deduction will be finalized according to the approved payroll process.'],
            action: 'Contact HR if you believe this record is incorrect.' };
        return { subject: 'Attendance Action – Full-Day Salary Deduction for Early Clock-Out', rows: [...base, ['Early Clock-Out Instance', String(n)]], status,
            paragraphs: [`Our attendance system has recorded your ${ordinal(n)} Early Clock-Out instance.`, 'This instance has reached the Full-Day salary deduction threshold under the approved Attendance SOP.', 'Any deduction will be finalized according to the approved payroll process.'],
            action: 'Contact HR if you believe this record is incorrect.' };
    }
    return { subject: 'Attendance Alert – Missing Clock-Out',
        rows: [['Attendance Date', fmtDate(v.date)], ['Clock-In Time', fmt12(v.actualTime)], ['Scheduled Clock-Out Time', sched], ['Grace Period', `${MISSING_GRACE_MINS} Minutes`], ['Missing Clock-Out Instance', String(n)]],
        paragraphs: ['Our Attendance Management System has detected that your clock-out has not been recorded.', 'You are required to submit a valid explanation and supporting proof confirming your presence at the workplace during the scheduled working hours.', 'Your explanation will be reviewed by HR.', 'Failure to provide satisfactory justification within the specified response period may result in your attendance being marked as Half-Day, subject to HR verification and the approved Attendance SOP.'],
        action: `Submit your explanation and proof in GOG OMS → Attendance → My Attendance Alerts: ${appUrl('/attendance?tab=alerts')}` };
}

function renderHtml(name: string, empId: string, violation: string, m: Mail) {
    const rows: [string, string][] = [['Employee Name', name], ['Employee ID', empId], ['Violation Type', violation], ...m.rows, ...(m.status ? [['Action Status', m.status] as [string, string]] : [])];
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#18181b;line-height:1.55;max-width:620px">
<p>Dear ${esc(name)},</p>
${m.paragraphs.slice(0, 1).map(p => `<p>${esc(p)}</p>`).join('')}
<table style="border-collapse:collapse;margin:12px 0">${rows.map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#52525b">${esc(k)}</td><td style="padding:5px 0;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table>
${m.paragraphs.slice(1).map(p => `<p>${esc(p)}</p>`).join('')}
<p><b>Required action:</b> ${esc(m.action)}</p>
<p>Regards,<br/>HR Department<br/>Geeks of Gurukul</p>
<p style="font-size:11px;color:#a1a1aa">This is an automated email from GOG OMS.</p></div>`;
}
function renderText(name: string, empId: string, violation: string, m: Mail) {
    const rows: [string, string][] = [['Employee Name', name], ['Employee ID', empId], ['Violation Type', violation], ...m.rows, ...(m.status ? [['Action Status', m.status] as [string, string]] : [])];
    return [`Dear ${name},`, '', m.paragraphs[0], '', ...rows.map(([k, v]) => `${k}: ${v}`), '', ...m.paragraphs.slice(1).flatMap(p => [p, '']), `Required action: ${m.action}`, '', 'Regards,', 'HR Department', 'Geeks of Gurukul'].join('\n');
}

/** Sends (or retries) the email of a violation. Atomic claim → never two sends at the same time. */
export async function sendViolationEmail(id: string) {
    const v: any = await AttendanceViolation.findOneAndUpdate(
        { id, emailStatus: { $in: ['Pending', 'Failed'] }, emailAttempts: { $lt: MAX_ATTEMPTS } },
        { $set: { emailStatus: 'Sending' }, $inc: { emailAttempts: 1 } }, { new: true }).lean();
    if (!v) return { sent: false, reason: 'not claimable' };
    if (!v.email) {
        await AttendanceViolation.updateOne({ id }, { $set: { emailStatus: 'Failed', emailError: 'Employee has no registered email.' } });
        return { sent: false, reason: 'no email' };
    }
    const m = buildMail(v);
    const label = VIOLATION_LABEL[v.type as ViolationType];
    const res: any = await sendMailInternal({ to: v.email, subject: m.subject, html: renderHtml(v.employeeName, v.employeeId, label, m), text: renderText(v.employeeName, v.employeeId, label, m) });
    if (res?.success) {
        await AttendanceViolation.updateOne({ id }, { $set: { emailStatus: 'Sent', emailSentAt: new Date().toISOString(), emailMessageId: res.messageId || '', emailError: '' } });
        return { sent: true };
    }
    await AttendanceViolation.updateOne({ id }, { $set: { emailStatus: 'Failed', emailError: String(res?.error || 'Send failed').slice(0, 300) } });
    return { sent: false, reason: 'smtp' };
}

/**
 * Records a violation (once per employee + type + date) and emails the employee.
 * Never throws — attendance itself must not fail because of this.
 */
export async function recordViolation(input: { emp: any; type: ViolationType; date: string; scheduledTime?: string; actualTime?: string; durationMins?: number }) {
    try {
        const { emp, type, date } = input;
        if (!emp?.id || emp.role === 'FOUNDER') return null;
        const key = `${type}:${emp.id}:${date}`;
        if (await AttendanceViolation.exists({ key })) return null;
        const period = date.slice(0, 7);
        const previous = await AttendanceViolation.countDocuments({ employeeId: emp.id, type, period, date: { $lt: date }, hrStatus: { $nin: NOT_COUNTED } });
        const instance = previous + 1;
        const lvl = type === 'MISSING_OUT'
            ? { level: 'MISSING_ALERT', proposedDeduction: 'Half-Day (if not justified)', hrStatus: 'Awaiting Explanation' }
            : escalation(instance);
        const doc = {
            id: `AV-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(), key,
            employeeId: emp.id, employeeName: emp.name, email: emp.email || '', type, date, period,
            scheduledTime: input.scheduledTime || '', actualTime: input.actualTime || '', durationMins: input.durationMins,
            instance, ...lvl, emailStatus: 'Pending', emailAttempts: 0, createdAt: new Date().toISOString(),
        };
        try { await AttendanceViolation.create(doc); }
        catch (e: any) { if (e?.code === 11000) return null; throw e; } // same event recorded by a parallel request
        await sendViolationEmail(doc.id);
        return doc;
    } catch (e: any) {
        console.error('[attendance-violations] could not record', input.type, input.emp?.id, e?.message);
        return null;
    }
}

/**
 * Missing Clock-Out detection + email retries. Safe to run often and from several places (scheduler, cron URL,
 * page ping): every event is unique in the database.
 */
export async function runAttendanceSweep(at: Date = new Date()) {
    const now = istNow(at);
    const yesterday = istNow(new Date(at.getTime() - 86400000)).ymd;
    const open: any[] = await Attendance.find({
        date: { $in: [yesterday, now.ymd] },
        clockIn: { $exists: true, $nin: [null, ''] },
        $or: [{ clockOut: { $exists: false } }, { clockOut: null }, { clockOut: '' }],
        status: { $ne: 'Absent' }, attendanceSource: { $ne: 'HR_MANUAL' },
    }).select('employeeId date clockIn').lean();
    let alerts = 0;
    if (open.length) {
        const emps: any[] = await Employee.find({ id: { $in: Array.from(new Set(open.map(r => r.employeeId))) } }).select('id name email role location').lean();
        const byId = new Map(emps.map(e => [e.id, e]));
        for (const r of open) {
            const emp = byId.get(r.employeeId);
            if (!emp || emp.role === 'FOUNDER') continue;
            if (await AttendanceViolation.exists({ key: `MISSING_OUT:${emp.id}:${r.date}` })) continue;
            const t = await scheduledTiming(emp, r.date);
            const due = toMins(t.out) + MISSING_GRACE_MINS;
            if (isNaN(due)) continue;
            if (r.date === now.ymd && now.minutes < due) continue; // grace period not over yet
            if (await recordViolation({ emp, type: 'MISSING_OUT', date: r.date, scheduledTime: t.out, actualTime: r.clockIn })) alerts++;
        }
    }
    // retry failed / stuck emails
    const stale = new Date(at.getTime() - 2 * 60000).toISOString();
    const retry: any[] = await AttendanceViolation.find({ emailAttempts: { $lt: MAX_ATTEMPTS }, $or: [{ emailStatus: 'Failed' }, { emailStatus: 'Pending', createdAt: { $lt: stale } }] }).select('id').limit(50).lean();
    let retried = 0;
    for (const v of retry) if ((await sendViolationEmail(v.id)).sent) retried++;
    return { checked: open.length, alerts, retried };
}

/** Emails the employee HR's decision (Missing Clock-Out explanation / payroll action) */
export async function sendDecisionEmail(v: any, decision: string, remarks: string) {
    if (!v.email) return false;
    const label = VIOLATION_LABEL[v.type as ViolationType];
    const approved = decision === 'Approved';
    const m: Mail = v.type === 'MISSING_OUT'
        ? { subject: `Missing Clock-Out Explanation – ${approved ? 'Approved' : 'Rejected'}`,
            rows: [['Attendance Date', fmtDate(v.date)], ['Scheduled Clock-Out Time', fmt12(v.scheduledTime)], ['Missing Clock-Out Instance', String(v.instance)], ['HR Decision', approved ? 'Approved' : 'Rejected'], ['HR Remarks', remarks || '—']],
            paragraphs: [`HR has reviewed your explanation for the missing clock-out on ${fmtDate(v.date)}.`,
                approved ? 'Your explanation has been approved and your attendance for this date has been regularised.' : 'Your explanation has not been accepted. The record is kept for attendance action as per the approved Attendance SOP (Half-Day, subject to HR verification).'],
            action: approved ? 'No further action is needed.' : 'Contact HR if you have further information.' }
        : { subject: `Attendance Action Update – ${label}`,
            rows: [['Attendance Date', fmtDate(v.date)], ['Instance', String(v.instance)], ['Proposed Deduction', v.proposedDeduction], ['Action Status', decision], ['HR Remarks', remarks || '—']],
            paragraphs: [`HR has reviewed the ${label} deduction recorded for ${fmtDate(v.date)}.`, decision === 'Approved for Payroll' ? 'The deduction has been approved for payroll as per the approved Attendance SOP.' : 'The deduction has been waived. No salary deduction will be made for this instance.'],
            action: 'Contact HR if you have any questions.' };
    const res: any = await sendMailInternal({ to: v.email, subject: m.subject, html: renderHtml(v.employeeName, v.employeeId, label, m), text: renderText(v.employeeName, v.employeeId, label, m) });
    await AttendanceViolation.updateOne({ id: v.id }, { $set: { decisionEmailStatus: res?.success ? 'Sent' : 'Failed' } });
    return !!res?.success;
}