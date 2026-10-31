/**
 * SERVER-ONLY: Email Management — HR / HR Executive (and Founder) send four employee emails by hand:
 *
 *   dress_code     Dress Code Rejection   — after a dress code is rejected (reasons + remarks saved on the attendance)
 *   late_clock_in  Late Clock-In warning  — only after the late justification is REJECTED; the warning level
 *                                           (1st / 2nd / 3rd …) is worked out at send time with the existing
 *                                           escalation policy (same month, approved / waived lates not counted)
 *   no_clock_in    No Clock-In            — scheduled employee, no clock-in, after the 11:59 AM clock-in cutoff,
 *                                           not on leave / holiday / weekly off
 *   no_clock_out   No Clock-Out           — the existing Missing Clock-Out detection (final clock-out of the day only)
 *
 * Detection / rejection never sends these mails any more; it only makes the row appear here. Every send:
 * re-checks eligibility → claims the send (unique lock row: one send even if HR and HR Executive click together)
 * → sends with the existing mail service → saves the status, sender and role (history).
 * All other automatic emails are unchanged.
 */
import { Attendance, AttendanceViolation, Employee, Holiday, LeaveRequest, Location, WorkSchedule } from '@/models/Schemas';
import { LateJustification } from '@/models/LateJustification';
import { ManualEmail, ManualEmailLock } from '@/models/ManualEmail';
import { sendMailInternal } from '@/lib/mail-server';
import { composeViolationMail, escalation, fmtDuration, istNow, NOT_COUNTED } from '@/lib/attendance-violations';
import { FlagRemoval } from '@/models/SalaryModule';

/** Late clock-in violation ids removed through Flag Removal (they no longer count and need no email) */
async function removedLateIds(employeeIds: string[]) {
    if (!employeeIds.length) return new Set<string>();
    const rows: any[] = await FlagRemoval.find({ employeeId: { $in: employeeIds }, source: 'VIOLATION', flagType: 'LATE_IN' }).select('sourceId').lean();
    return new Set(rows.map(r => String(r.sourceId)));
}
import { getExpectedTimingInternal } from '@/lib/attendance-utils';
import { DRESS_CODE_REASONS, dressReasonText } from '@/lib/dress-code-reasons';

export type EmailCategory = 'dress_code' | 'late_clock_in' | 'no_clock_in' | 'no_clock_out';
export const CATEGORIES: EmailCategory[] = ['dress_code', 'late_clock_in', 'no_clock_in', 'no_clock_out'];
export const CATEGORY_LABEL: Record<EmailCategory, string> = {
    dress_code: 'Dress Code Rejection', late_clock_in: 'Late Clock-In', no_clock_in: 'No Clock-In', no_clock_out: 'No Clock-Out',
};
/** Row statuses: the five email statuses + the two "on hold" states of a late clock-in */
export type RowStatus = 'not_sent' | 'sending' | 'sent' | 'failed' | 'not_required' | 'pending_review' | 'awaiting_justification';
export const STATUS_LABEL: Record<RowStatus, string> = {
    not_sent: 'Not Sent', sending: 'Sending', sent: 'Sent', failed: 'Failed', not_required: 'Not Required',
    pending_review: 'Pending Justification Review', awaiting_justification: 'Awaiting Justification',
};

/** HR, HR Executive (session role "HR") and Founder — identical access */
export const canManageEmails = (actor: any) => !!actor && ['HR', 'FOUNDER'].includes(actor.role);
export const senderRole = (actor: any) =>
    actor?.hrExecutive || actor?.session?.actualRole === 'HR_EXECUTIVE' ? 'HR Executive' : actor?.role === 'FOUNDER' ? 'Founder' : 'HR';

const CLOCK_IN_CUTOFF = '11:59';          // existing policy: after 11:59 AM clock-in closes (Mark-as-Present request only)
const STALE_SENDING_MS = 2 * 60000;       // a "sending" that never finished (server restart) can be retried after this
const MAX_RANGE_DAYS = 62;
const MAX_NO_CLOCK_IN_DAYS = 31;
const MAX_ROWS = 1000;                   // rows returned per list (narrow the filters for more)
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const ORG = 'Geeks of Gurukul';
const PHOTO_URL_RE = /^https?:\/\/[^\s"'<>]+$/i;
const PHOTO_CID = 'dresscode-photo@gog';

const nowIso = () => new Date().toISOString();
const isYmd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
/** 2026-10-28 → 28 October 2026 */
export const longDate = (ymd: string) => (isYmd(ymd) ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ymd);
const ordinalWord = (n: number) => ['', 'First', 'Second', 'Third'][n] || `${n}th`;
export const lateCategoryLabel = (n: number) => (n <= 3 ? `${ordinalWord(n)} Late Clock-In` : n === 4 ? 'Late Clock-In (4th — Half-Day)' : `Late Clock-In (${n}th — Full-Day)`);

// ─────────────────────────── dress code rejection input ───────────────────────────
export function parseDressRejection(r: any): { ok: true; fields: Record<string, any> } | { ok: false; error: string } {
    const reasons = Array.from(new Set((Array.isArray(r?.reasons) ? r.reasons : []).map((x: any) => String(x)).filter((x: string) => (DRESS_CODE_REASONS as readonly string[]).includes(x)))) as string[];
    if (!reasons.length) return { ok: false, error: 'Select at least one rejection reason.' };
    const other = String(r?.other || '').trim().slice(0, 300);
    if (reasons.includes('Other') && other.length < 2) return { ok: false, error: 'Please write the reason for "Other".' };
    const remarks = String(r?.remarks || '').trim().slice(0, 1000);
    // optional photo from the reviewer (uploaded file URL) — attached to the rejection email
    const photo = String(r?.photoUrl || '').trim();
    if (photo && (!PHOTO_URL_RE.test(photo) || photo.length > 2048)) return { ok: false, error: 'The photo must be an uploaded JPG, PNG or WEBP image.' };
    return { ok: true, fields: { dressCodeRejectionReasons: reasons, dressCodeRejectionOther: reasons.includes('Other') ? other : '', dressCodeRejectionRemarks: remarks, dressCodeRejectionPhoto: photo } };
}

// ─────────────────────────── email bodies ───────────────────────────
function renderMail(name: string, paragraphs: string[], rows: [string, string][] = [], afterRows: string[] = []) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#18181b;line-height:1.55;max-width:620px">
<p>Dear ${esc(name)},</p>
${paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
${rows.length ? `<table style="border-collapse:collapse;margin:12px 0">${rows.map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#52525b;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table>` : ''}
${afterRows.map(p => `<p>${esc(p)}</p>`).join('')}
<p>Regards,<br/>HR Team<br/>${ORG}</p></div>`;
    const text = [`Dear ${name},`, '', ...paragraphs.flatMap(p => [p, '']), ...rows.map(([k, v]) => `${k}: ${v}`), ...(rows.length ? [''] : []), ...afterRows.flatMap(p => [p, '']), 'Regards,', 'HR Team', ORG].join('\n');
    return { html, text };
}

function dressMail(row: any): { subject: string; html: string; text: string; storedHtml?: string; attachments?: any[] } {
    const subject = `Dress Code Non-Compliance Notification — ${ORG}`;
    const { html, text } = renderMail(row.employeeName,
        [`This is to inform you that your dress code submission for ${longDate(row.date)} has been reviewed and marked as non-compliant.`],
        [['Reason for Rejection', row.details.reasonText || '—'], ['Additional Remarks', row.details.remarks || '—']],
        ["You are requested to ensure compliance with the organization's prescribed dress code guidelines.", 'Please take the necessary corrective measures to avoid similar issues in the future.']);
    const photo = row.details.photoUrl;
    if (!photo) return { subject, html, text };
    // reviewer's photo: shown in the email body and attached as a file
    const ext = (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.exec(photo)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const block = (src: string) => `<p style="font-family:Arial,sans-serif;font-size:14px;color:#18181b"><b>Reference Photo:</b></p><img src="${src}" alt="Dress code photo" style="max-width:420px;width:100%;border:1px solid #e4e4e7;border-radius:6px"/>`;
    const at = html.lastIndexOf('<p>Regards,');
    const withPhoto = (src: string) => html.slice(0, at) + block(src) + '\n' + html.slice(at);
    return {
        subject, html: withPhoto(`cid:${PHOTO_CID}`), storedHtml: withPhoto(esc(photo)),
        text: text.replace('Regards,', 'Reference Photo: attached\n\nRegards,'),
        attachments: [{ filename: `dress-code-photo-${row.date}.${ext}`, path: photo, cid: PHOTO_CID }],
    };
}
function noClockInMail(row: any) {
    const subject = `No Clock-In Recorded — ${longDate(row.date)} | ${ORG}`;
    const { html, text } = renderMail(row.employeeName, [
        `Our attendance records indicate that no clock-in has been recorded for you on ${longDate(row.date)}.`,
        'You are requested to review your attendance status in the GOG OMS portal.',
        'If you have already reported to work or are experiencing a technical issue, please inform the HR Team and submit the necessary attendance clarification.',
    ]);
    return { subject, html, text };
}
function noClockOutMail(row: any) {
    const subject = `Missing Clock-Out Notification — ${longDate(row.date)} | ${ORG}`;
    const { html, text } = renderMail(row.employeeName, [
        `Our attendance records indicate that your clock-out for ${longDate(row.date)} has not been recorded in the GOG OMS portal.`,
        'You are requested to review your attendance and complete the necessary correction or clarification through the prescribed process.',
        'If this is due to a technical issue, please inform the HR Team.',
    ]);
    return { subject, html, text };
}

// ─────────────────────────── shared lookups ───────────────────────────
type Filters = { from: string; to: string; q?: string; dept?: string; location?: string; status?: string; employeeId?: string; relatedRecordId?: string };

export function normalizeRange(fromIn?: string | null, toIn?: string | null, maxDays = MAX_RANGE_DAYS) {
    const today = istNow().ymd;
    let to = isYmd(toIn) ? String(toIn) : today;
    let from = isYmd(fromIn) ? String(fromIn) : addDays(to, -6);
    if (from > to) [from, to] = [to, from];
    if (addDays(from, maxDays - 1) < to) from = addDays(to, -(maxDays - 1));
    return { from, to };
}

/** Active employees (not removed, not hidden from attendance, mails not stopped) */
async function employeeMap(ids?: string[]) {
    const q: any = ids ? { id: { $in: ids } } : {};
    const rows: any[] = await Employee.find(q).select('id name email role dept designation location status joiningDate hideFromAttendance mailsStopped').lean();
    return new Map(rows.filter(e => !e.hideFromAttendance && !e.mailsStopped).map(e => [e.id, e]));
}
async function locationNames() {
    const rows: any[] = await Location.find({}).select('id name shortName').lean();
    const m = new Map<string, string>();
    rows.forEach(l => { m.set(l.id, l.name); if (l.shortName) m.set(l.shortName, l.name); m.set(l.name, l.name); });
    return m;
}
async function manualDocs(keys: string[]) {
    if (!keys.length) return new Map<string, any>();
    const docs: any[] = await ManualEmail.find({ key: { $in: keys } }).select('-attempts').lean();
    return new Map(docs.map(d => [d.key, d]));
}

/** Email status of a sendable row from its ManualEmail record */
function emailState(doc: any): RowStatus {
    if (!doc) return 'not_sent';
    if (doc.emailStatus === 'sent') return 'sent';
    if (doc.emailStatus === 'sending') return Date.now() - Date.parse(doc.sendingAt || 0) < STALE_SENDING_MS ? 'sending' : 'failed';
    if (doc.emailStatus === 'failed') return 'failed';
    return 'not_sent';
}

function baseRow(category: EmailCategory, relatedRecordId: string, emp: any, date: string, locs: Map<string, string>) {
    return {
        category, categoryLabel: CATEGORY_LABEL[category], relatedRecordId, key: `${category}:${relatedRecordId}`,
        employeeId: emp.id, employeeName: emp.name, email: emp.email || '', dept: emp.dept || '', designation: emp.designation || '', role: emp.role || '',
        location: emp.location || '', locationName: locs.get(emp.location) || emp.location || '', date,
    };
}
function withEmail(row: any, status: RowStatus, doc: any, extra: any = {}) {
    const sendable = status === 'not_sent' || status === 'failed';
    return {
        ...row, status, statusLabel: STATUS_LABEL[status], canSend: sendable,
        subject: doc?.subject || '', sentAt: doc?.sentAt || '', sentBy: doc?.triggeredByName || '', sentByRole: doc?.triggeredByRole || '',
        lastError: doc?.emailStatus === 'failed' ? doc?.errorMessage || '' : '', attemptCount: doc?.attemptCount || 0,
        hasSentCopy: !!doc?.html, ...extra,
    };
}

// ─────────────────────────── Dress code ───────────────────────────
async function dressRows(f: Filters, locs: Map<string, string>) {
    const q: any = { dressCodeStatus: 'Rejected', date: { $gte: f.from, $lte: f.to } };
    if (f.employeeId) q.employeeId = f.employeeId;
    const recs: any[] = await Attendance.find(q).select('employeeId date clockIn dressCodeImageUrl dressCodeReviewedAt dressCodeReviewedByName dressCodeReviewedByRole dressCodeRejectionReasons dressCodeRejectionOther dressCodeRejectionRemarks dressCodeRejectionPhoto').lean();
    const emps = await employeeMap(Array.from(new Set(recs.map(r => r.employeeId))));
    const docs = await manualDocs(recs.map(r => `dress_code:${String(r._id)}`));
    const out: any[] = [];
    for (const r of recs) {
        const emp = emps.get(r.employeeId);
        if (!emp) continue;
        const id = String(r._id);
        const doc = docs.get(`dress_code:${id}`);
        const reasons: string[] = Array.isArray(r.dressCodeRejectionReasons) ? r.dressCodeRejectionReasons : [];
        const details = {
            reasons, other: r.dressCodeRejectionOther || '', remarks: r.dressCodeRejectionRemarks || '', photoUrl: r.dressCodeRejectionPhoto || '', reasonText: dressReasonText(reasons, r.dressCodeRejectionOther),
            clockIn: r.clockIn || '', imageUrl: r.dressCodeImageUrl || '', reviewedAt: r.dressCodeReviewedAt || '', reviewedBy: r.dressCodeReviewedByName || '', reviewedByRole: r.dressCodeReviewedByRole || '',
        };
        const row = baseRow('dress_code', id, emp, r.date, locs);
        // Rejected before Email Management existed (no reasons saved): the warning email went out automatically then
        if (!reasons.length && !doc) { out.push(withEmail(row, 'sent', null, { details, sentBy: 'System (automatic)', sentByRole: 'Automatic', canSend: false, statusLabel: 'Sent (automatic)' })); continue; }
        out.push(withEmail(row, emailState(doc), doc, { details }));
    }
    return out;
}

// ─────────────────────────── Late clock-in ───────────────────────────
/**
 * Warning level at send time (existing policy: counted per calendar month, i.e. resets every month):
 * 1 + earlier late clock-ins of the same month that are still unjustified — not waived / approved, and whose
 * justification is not waiting for HR review.
 */
async function lateLevel(v: any) {
    const [earlier, pending, removed]: [any[], any[], Set<string>] = await Promise.all([
        AttendanceViolation.find({ employeeId: v.employeeId, type: 'LATE_IN', period: v.period, date: { $lt: v.date }, hrStatus: { $nin: NOT_COUNTED } }).select('id date').lean() as Promise<any[]>,
        LateJustification.find({ employeeId: v.employeeId, date: { $gte: `${v.period}-01`, $lt: v.date }, justificationStatus: 'pending' }).select('date').lean() as Promise<any[]>,
        removedLateIds([v.employeeId]),
    ]);
    const onHold = new Set(pending.map(j => j.date));
    return earlier.filter(x => !onHold.has(x.date) && !removed.has(String(x.id))).length + 1;
}

async function lateRows(f: Filters, locs: Map<string, string>) {
    const q: any = { type: 'LATE_IN', date: { $gte: f.from, $lte: f.to } };
    if (f.employeeId) q.employeeId = f.employeeId;
    const vs: any[] = await AttendanceViolation.find(q).lean();
    if (!vs.length) return [];
    const empIds = Array.from(new Set(vs.map(v => v.employeeId)));
    const [emps, js, recs, docs, all] = await Promise.all([
        employeeMap(empIds),
        // justifications of these months (this row's own + earlier ones on hold, for the warning level)
        LateJustification.find({ employeeId: { $in: empIds }, date: { $gte: `${vs.map(v => v.period).sort()[0]}-01`, $lte: f.to } }).lean() as Promise<any[]>,
        Attendance.find({ employeeId: { $in: empIds }, date: { $gte: f.from, $lte: f.to } }).select('employeeId date clockIn flags status').lean() as Promise<any[]>,
        manualDocs(vs.map(v => `late_clock_in:${v.id}`)),
        // all late clock-ins of these months, for the warning level
        AttendanceViolation.find({ type: 'LATE_IN', employeeId: { $in: empIds }, period: { $in: Array.from(new Set(vs.map(v => v.period))) } }).select('id employeeId date period hrStatus').lean() as Promise<any[]>,
    ]);
    const removed = await removedLateIds(empIds);
    const jBy = new Map(js.map(j => [j.key, j]));
    const recBy = new Map(recs.map(r => [`${r.employeeId}:${r.date}`, r]));
    const out: any[] = [];
    for (const v of vs) {
        const emp = emps.get(v.employeeId);
        if (!emp) continue;
        const j = jBy.get(`${v.employeeId}:${v.date}`);
        const rec = recBy.get(`${v.employeeId}:${v.date}`);
        const doc = docs.get(`late_clock_in:${v.id}`);
        const level = 1 + all.filter(x => x.employeeId === v.employeeId && x.period === v.period && x.date < v.date && !NOT_COUNTED.includes(x.hrStatus)
            && !removed.has(String(x.id)) && jBy.get(`${x.employeeId}:${x.date}`)?.justificationStatus !== 'pending').length;
        const details = {
            clockIn: v.actualTime || rec?.clockIn || '', scheduled: v.scheduledTime || '', lateMinutes: v.durationMins, lateText: fmtDuration(v.durationMins),
            justificationStatus: j?.justificationStatus || 'not_submitted', justificationReason: j?.justificationReason || '', supportingDocument: j?.supportingDocument || '',
            hrDecisionBy: j?.reviewedByName || '', hrDecisionRole: j?.reviewedByRole || '', hrDecisionAt: j?.reviewedAt || '', rejectionReason: j?.rejectionReason || '',
            violationStatus: v.hrStatus || '',
        };
        const row = baseRow('late_clock_in', v.id, emp, v.date, locs);
        const sentLevel = doc?.warningLevel;
        if (doc?.emailStatus === 'sent') { out.push(withEmail(row, 'sent', doc, { details, warningLevel: sentLevel, warningLabel: lateCategoryLabel(sentLevel || level) })); continue; }
        // excused: justification approved / violation waived / late flag removed (e.g. HR attendance override)
        const excused = j?.justificationStatus === 'approved' || NOT_COUNTED.includes(v.hrStatus) || removed.has(String(v.id)) || (rec && rec.flags?.late === false) || rec?.status === 'Absent' || rec?.status === 'On Leave';
        if (excused) { out.push(withEmail(row, 'not_required', doc, { details, warningLevel: null, warningLabel: '—' })); continue; }
        // emailed automatically before Email Management existed
        if (v.emailStatus === 'Sent') { out.push(withEmail(row, 'sent', null, { details, warningLevel: v.instance, warningLabel: lateCategoryLabel(v.instance || 1), sentAt: v.emailSentAt || '', sentBy: 'System (automatic)', sentByRole: 'Automatic', canSend: false, statusLabel: 'Sent (automatic)' })); continue; }
        if (j?.justificationStatus === 'pending') { out.push(withEmail(row, 'pending_review', doc, { details, warningLevel: null, warningLabel: '—', canSend: false })); continue; }
        if (!j) { out.push(withEmail(row, 'awaiting_justification', doc, { details, warningLevel: null, warningLabel: '—', canSend: false })); continue; }
        // rejected → eligible
        out.push(withEmail(row, emailState(doc), doc, { details, warningLevel: level, warningLabel: lateCategoryLabel(level) }));
    }
    return out;
}

// ─────────────────────────── No clock-in ───────────────────────────
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (ymd: string) => DAY[new Date(`${ymd}T12:00:00Z`).getUTCDay()];

async function noClockInRows(f: Filters, locs: Map<string, string>) {
    const now = istNow();
    const nowHm = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;
    const range = normalizeRange(f.from, f.to, MAX_NO_CLOCK_IN_DAYS);
    const dates: string[] = [];
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
        if (d > now.ymd) break;
        if (d === now.ymd && nowHm < CLOCK_IN_CUTOFF) continue; // before the clock-in cutoff nobody is "No Clock-In" yet
        dates.push(d);
    }
    if (!dates.length) return [];
    const emps = await employeeMap(f.employeeId ? [f.employeeId] : undefined);
    const list = Array.from(emps.values()).filter(e => e.role !== 'FOUNDER' && !/^(resigned|inactive|terminated|exited|relieved)$/i.test(String(e.status || '')));
    if (!list.length) return [];
    const ids = list.map(e => e.id);
    const first = dates[0], last = dates[dates.length - 1];
    const [recs, leaves, holidays, schedules] = await Promise.all([
        Attendance.find({ employeeId: { $in: ids }, date: { $gte: first, $lte: last } }).select('employeeId date clockIn status').lean() as Promise<any[]>,
        LeaveRequest.find({ employeeId: { $in: ids }, startDate: { $lte: last }, endDate: { $gte: first }, status: { $ne: 'Rejected' } }).select('employeeId startDate endDate status').lean() as Promise<any[]>,
        Holiday.find({ date: { $in: dates }, status: 'Approved' }).select('date forAll collegeIds').lean() as Promise<any[]>,
        WorkSchedule.find({ employeeId: { $in: ids }, date: { $in: [...dates, ...DAY] } }).select('employeeId date location clockInTime clockOutTime').lean() as Promise<any[]>,
    ]);
    const recBy = new Map<string, any[]>();
    recs.forEach(r => { const k = `${r.employeeId}:${r.date}`; recBy.set(k, [...(recBy.get(k) || []), r]); });
    const schedBy = new Map(schedules.map(s => [`${s.employeeId}:${s.date}`, s]));
    const keys: string[] = [];
    const candidates: any[] = [];
    for (const d of dates) {
        const dn = dayName(d);
        for (const emp of list) {
            if (emp.joiningDate && isYmd(emp.joiningDate) && emp.joiningDate > d) continue;
            const rs = recBy.get(`${emp.id}:${d}`) || [];
            if (rs.some(r => r.clockIn) || rs.some(r => r.status === 'On Leave')) continue;
            const sched = schedBy.get(`${emp.id}:${d}`) || schedBy.get(`${emp.id}:${dn}`);
            const t = getExpectedTimingInternal(emp.name, emp.location || 'Bhopal', d);
            const location = sched?.location || t.location;
            if (/^(holiday|off|week ?off|weekly ?off|leave)$/i.test(String(location || ''))) continue; // weekly off (Sunday) / scheduled off
            if (!sched && dn === 'Sun') continue;
            if (holidays.some(h => h.date === d && (h.forAll || (h.collegeIds || []).includes(location) || (h.collegeIds || []).includes(emp.location)))) continue;
            if (leaves.some(l => l.employeeId === emp.id && l.startDate <= d && d <= l.endDate)) continue; // approved / requested leave (as on the roster)
            const relatedRecordId = `${emp.id}:${d}`;
            keys.push(`no_clock_in:${relatedRecordId}`);
            candidates.push({ emp, d, relatedRecordId, scheduled: sched?.clockInTime || t.in, location, markedAbsent: rs.some(r => r.status === 'Absent') });
        }
    }
    const docs = await manualDocs(keys);
    return candidates.map(c => withEmail(baseRow('no_clock_in', c.relatedRecordId, c.emp, c.d, locs), emailState(docs.get(`no_clock_in:${c.relatedRecordId}`)), docs.get(`no_clock_in:${c.relatedRecordId}`), {
        details: { scheduled: c.scheduled, scheduledLocation: locs.get(c.location) || c.location || '', attendanceStatus: c.markedAbsent ? 'Absent (marked by HR)' : 'No Clock-In', wfh: c.location === 'WFH' },
    }));
}

// ─────────────────────────── No clock-out ───────────────────────────
async function noClockOutRows(f: Filters, locs: Map<string, string>) {
    const q: any = { type: 'MISSING_OUT', date: { $gte: f.from, $lte: f.to } };
    if (f.employeeId) q.employeeId = f.employeeId;
    const vs: any[] = await AttendanceViolation.find(q).lean();
    if (!vs.length) return [];
    const empIds = Array.from(new Set(vs.map(v => v.employeeId)));
    const [emps, recs, docs] = await Promise.all([
        employeeMap(empIds),
        Attendance.find({ employeeId: { $in: empIds }, date: { $gte: f.from, $lte: f.to } }).select('employeeId date clockIn clockOut status locationVisits').lean() as Promise<any[]>,
        manualDocs(vs.map(v => `no_clock_out:${v.id}`)),
    ]);
    const recBy = new Map<string, any[]>();
    recs.forEach(r => { const k = `${r.employeeId}:${r.date}`; recBy.set(k, [...(recBy.get(k) || []), r]); });
    const out: any[] = [];
    for (const v of vs) {
        const emp = emps.get(v.employeeId);
        if (!emp) continue;
        const rs = recBy.get(`${v.employeeId}:${v.date}`) || [];
        const doc = docs.get(`no_clock_out:${v.id}`);
        const clockedOut = rs.some(r => r.clockOut) || !!v.laterClockOut;
        const visits = rs.reduce((n, r) => n + (Array.isArray(r.locationVisits) ? r.locationVisits.length : 0), 0);
        const details = {
            clockIn: v.actualTime || rs[0]?.clockIn || '', expectedOut: v.scheduledTime || '', clockOut: rs.find(r => r.clockOut)?.clockOut || v.laterClockOut || '',
            attendanceStatus: clockedOut ? 'Clock-out recorded later' : v.hrStatus === 'Approved' ? 'Explanation approved' : 'No Clock-Out', violationStatus: v.hrStatus || '', locationVisits: visits,
            explanation: v.explanation || '',
        };
        const row = baseRow('no_clock_out', v.id, emp, v.date, locs);
        if (doc?.emailStatus === 'sent') { out.push(withEmail(row, 'sent', doc, { details })); continue; }
        if (clockedOut || v.hrStatus === 'Approved' || !rs.length || rs.every(r => r.status === 'Absent' || r.status === 'On Leave')) { out.push(withEmail(row, 'not_required', doc, { details })); continue; }
        if (v.emailStatus === 'Sent') { out.push(withEmail(row, 'sent', null, { details, sentAt: v.emailSentAt || '', sentBy: 'System (automatic)', sentByRole: 'Automatic', canSend: false, statusLabel: 'Sent (automatic)' })); continue; }
        out.push(withEmail(row, emailState(doc), doc, { details }));
    }
    return out;
}

// ─────────────────────────── list / overview / history ───────────────────────────
function applyFilters(rows: any[], f: Filters) {
    const q = (f.q || '').trim().toLowerCase();
    return rows.filter(r =>
        (!q || `${r.employeeName} ${r.employeeId} ${r.email}`.toLowerCase().includes(q)) &&
        (!f.dept || r.dept === f.dept) &&
        (!f.location || r.location === f.location || r.locationName === f.location) &&
        (!f.status || (f.status === 'on_hold' ? r.status === 'pending_review' || r.status === 'awaiting_justification' : r.status === f.status)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.employeeName.localeCompare(b.employeeName));
}

export async function listRows(category: EmailCategory, fIn: Filters) {
    const f = { ...fIn, ...normalizeRange(fIn.from, fIn.to) };
    const locs = await locationNames();
    const rows = category === 'dress_code' ? await dressRows(f, locs)
        : category === 'late_clock_in' ? await lateRows(f, locs)
            : category === 'no_clock_in' ? await noClockInRows(f, locs)
                : await noClockOutRows(f, locs);
    const all = applyFilters(rows, f);
    return { from: f.from, to: f.to, total: all.length, rows: all.slice(0, MAX_ROWS) };
}

export async function overview(fIn: Filters) {
    const f = { ...fIn, ...normalizeRange(fIn.from, fIn.to) };
    const locs = await locationNames();
    const [d, l, ni, no] = await Promise.all([dressRows(f, locs), lateRows(f, locs), noClockInRows(f, locs), noClockOutRows(f, locs)]);
    const pending = (rows: any[]) => rows.filter(r => r.status === 'not_sent' || r.status === 'failed').length;
    const today = istNow().ymd;
    const sentDocs: any[] = await ManualEmail.find({ emailStatus: 'sent' }).select('sentAt').lean();
    const sentToday = sentDocs.filter(x => x.sentAt && istNow(new Date(x.sentAt)).ymd === today).length;
    const failed = await ManualEmail.countDocuments({ emailStatus: 'failed' });
    const all = [...d, ...l, ...ni, ...no];
    return {
        from: f.from, to: f.to,
        cards: { dress_code: pending(d), late_clock_in: pending(l), no_clock_in: pending(ni), no_clock_out: pending(no), sentToday, failed },
        departments: Array.from(new Set(all.map(r => r.dept).filter(Boolean))).sort(),
        locations: Array.from(new Map(all.filter(r => r.location).map(r => [r.location, r.locationName])).entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    };
}

/** Every send attempt, newest first (immutable audit) */
export async function history(fIn: Filters & { category?: string }) {
    const f = { ...fIn, ...normalizeRange(fIn.from, fIn.to, 366) };
    const q: any = {};
    if (fIn.category && (CATEGORIES as string[]).includes(fIn.category)) q.category = fIn.category;
    const docs: any[] = await ManualEmail.find(q).select('-html').sort({ updatedAt: -1 }).limit(2000).lean();
    const emps = await employeeMap(Array.from(new Set(docs.map(d => d.employeeId))));
    const locs = await locationNames();
    const out: any[] = [];
    for (const d of docs) {
        const emp: any = emps.get(d.employeeId) || {};
        for (const a of (d.attempts || [])) {
            const day = istNow(new Date(a.at)).ymd;
            if (day < f.from || day > f.to) continue;
            out.push({
                key: d.key, category: d.category, categoryLabel: d.category === 'late_clock_in' ? lateCategoryLabel(a.warningLevel || d.warningLevel || 1) : CATEGORY_LABEL[d.category as EmailCategory],
                employeeId: d.employeeId, employeeName: d.employeeName, email: a.email || d.recipientEmail, dept: emp.dept || '', location: emp.location || '', locationName: locs.get(emp.location) || emp.location || '',
                subject: a.subject || d.subject, relatedDate: d.relatedDate, triggeredBy: a.byName, triggeredById: a.byId, senderRole: a.byRole,
                at: a.at, status: a.status, statusLabel: a.status === 'sent' ? 'Sent' : 'Failed', error: a.error || '', messageId: a.messageId || '', canRetry: d.emailStatus === 'failed',
                relatedRecordId: d.relatedRecordId, hasSentCopy: a.status === 'sent',
            });
        }
    }
    const s = (f.q || '').trim().toLowerCase();
    return {
        from: f.from, to: f.to,
        rows: out.filter(r => (!s || `${r.employeeName} ${r.employeeId} ${r.email} ${r.subject}`.toLowerCase().includes(s))
            && (!f.dept || r.dept === f.dept) && (!f.location || r.location === f.location)
            && (!f.status || r.status === f.status)).sort((a, b) => String(b.at).localeCompare(String(a.at))),
    };
}

/** The email as it was sent (stored copy) */
export async function sentCopy(key: string) {
    const d: any = await ManualEmail.findOne({ key }).select('key subject recipientEmail sentAt triggeredByName triggeredByRole html emailStatus').lean();
    if (!d || !d.html) return null;
    return { subject: d.subject, email: d.recipientEmail, sentAt: d.sentAt, by: d.triggeredByName, role: d.triggeredByRole, html: d.html };
}

// ─────────────────────────── send ───────────────────────────
/** The single row of a related record, freshly computed (eligibility re-check) */
async function freshRow(category: EmailCategory, relatedRecordId: string) {
    let employeeId = '', date = '';
    if (category === 'no_clock_in') {
        const m = /^(.+):(\d{4}-\d{2}-\d{2})$/.exec(relatedRecordId);
        if (!m) return null;
        employeeId = m[1]; date = m[2];
    } else if (category === 'dress_code') {
        if (!/^[a-f0-9]{24}$/i.test(relatedRecordId)) return null;
        const r: any = await Attendance.findById(relatedRecordId).select('employeeId date').lean();
        if (!r) return null;
        employeeId = r.employeeId; date = r.date;
    } else {
        const v: any = await AttendanceViolation.findOne({ id: relatedRecordId, type: category === 'late_clock_in' ? 'LATE_IN' : 'MISSING_OUT' }).select('employeeId date').lean();
        if (!v) return null;
        employeeId = v.employeeId; date = v.date;
    }
    const f: Filters = { from: date, to: date, employeeId };
    const locs = await locationNames();
    const rows = category === 'dress_code' ? await dressRows(f, locs) : category === 'late_clock_in' ? await lateRows(f, locs) : category === 'no_clock_in' ? await noClockInRows(f, locs) : await noClockOutRows(f, locs);
    return rows.find(r => r.relatedRecordId === relatedRecordId) || null;
}

type SendResult = { ok: boolean; status: number; error?: string; message?: string; row?: any };

export async function sendManualEmail(actor: any, categoryIn: string, relatedRecordId: string): Promise<SendResult> {
    if (!canManageEmails(actor)) return { ok: false, status: 403, error: 'Only HR or HR Executive can send these emails.' };
    if (!(CATEGORIES as string[]).includes(categoryIn)) return { ok: false, status: 400, error: 'Unknown email category.' };
    const category = categoryIn as EmailCategory;
    relatedRecordId = String(relatedRecordId || '').slice(0, 200);
    if (!relatedRecordId) return { ok: false, status: 400, error: 'Missing record.' };

    // 1. eligibility re-check on the current data
    const row = await freshRow(category, relatedRecordId);
    if (!row) return { ok: false, status: 409, error: 'This employee is no longer eligible for this email (the record changed). Refresh the list.' };
    if (row.status === 'sent') return { ok: false, status: 409, error: 'This email was already sent.', row };
    if (row.status === 'sending') return { ok: false, status: 409, error: 'This email is being sent right now.', row };
    if (!row.canSend) return { ok: false, status: 409, error: `Email not allowed: ${row.statusLabel}.`, row };

    // 2. claim (one send even when two people click at the same moment)
    const key = row.key;
    await Promise.all([ManualEmail.init().catch(() => {}), ManualEmailLock.init().catch(() => {})]);
    const now = nowIso();
    await ManualEmail.create({
        key, category, relatedRecordId, relatedDate: row.date, employeeId: row.employeeId, employeeName: row.employeeName,
        recipientEmail: row.email, emailStatus: 'not_sent', attemptCount: 0, attempts: [], createdAt: now, updatedAt: now,
    }).catch(() => {}); // already exists
    const doc: any = await ManualEmail.findOne({ key }).select('emailStatus sendingAt attemptCount').lean();
    if (!doc) return { ok: false, status: 500, error: 'Could not prepare the email.' };
    if (doc.emailStatus === 'sent') return { ok: false, status: 409, error: 'This email was already sent.' };
    if (doc.emailStatus === 'sending' && Date.now() - Date.parse(doc.sendingAt || 0) < STALE_SENDING_MS) return { ok: false, status: 409, error: 'This email is being sent right now.' };
    const attemptNo = (doc.attemptCount || 0) + 1;
    const claimed = await ManualEmailLock.create({ key: `${key}#${attemptNo}`, byId: actor.id, at: now }).then(() => true).catch(() => false);
    if (!claimed) return { ok: false, status: 409, error: 'This email is already being sent by someone else.' };
    const byRole = senderRole(actor);
    await ManualEmail.updateOne({ key }, { $set: { emailStatus: 'sending', sendingAt: now, attemptCount: attemptNo, updatedAt: now } });

    // 3. compose with the current data
    let mail: { subject: string; html: string; text: string; storedHtml?: string; attachments?: any[] };
    let warningLevel: number | undefined;
    if (category === 'late_clock_in') {
        const v: any = await AttendanceViolation.findOne({ id: relatedRecordId }).lean();
        warningLevel = await lateLevel(v);
        const lvl = escalation(warningLevel);
        mail = composeViolationMail({ ...v, instance: warningLevel, level: lvl.level, proposedDeduction: lvl.proposedDeduction, hrStatus: warningLevel >= 4 ? (v.hrStatus === 'Approved for Payroll' ? v.hrStatus : 'Pending HR Verification') : v.hrStatus });
    } else mail = category === 'dress_code' ? dressMail(row) : category === 'no_clock_in' ? noClockInMail(row) : noClockOutMail(row);

    // 4. send (existing mail service)
    const email = String(row.email || '').trim();
    let res: any;
    if (!EMAIL_RE.test(email)) res = { success: false, error: 'Employee has no valid email address.' };
    else {
        res = await sendMailInternal({ to: email, subject: mail.subject, html: mail.html, text: mail.text, ...(mail.attachments ? { attachments: mail.attachments } : {}) }).catch((e: any) => ({ success: false, error: String(e?.message || e) }));
        if (res?.success && res.messageId === 'skipped-mails-stopped') res = { success: false, error: 'Emails are stopped for this employee.' };
    }
    const at = nowIso();
    const attempt: any = { at, status: res?.success ? 'sent' : 'failed', subject: mail.subject, email, byId: actor.id, byName: actor.name, byRole, messageId: res?.messageId || '', error: res?.success ? '' : String(res?.error || 'Send failed').slice(0, 300), ...(warningLevel ? { warningLevel } : {}) };
    const set: any = {
        emailStatus: attempt.status, subject: mail.subject, recipientEmail: email, triggeredBy: actor.id, triggeredByName: actor.name, triggeredByRole: byRole,
        errorMessage: attempt.error, updatedAt: at, ...(warningLevel ? { warningLevel, categoryLabel: lateCategoryLabel(warningLevel) } : { categoryLabel: CATEGORY_LABEL[category] }),
        ...(res?.success ? { sentAt: at, providerMessageId: res.messageId || '', html: mail.storedHtml || mail.html } : {}),
    };
    await ManualEmail.updateOne({ key }, { $set: set, $push: { attempts: attempt } });
    // keep the attendance alert's own email status in step (Attendance → alerts boards)
    if (res?.success && (category === 'late_clock_in' || category === 'no_clock_out')) {
        await AttendanceViolation.updateOne({ id: relatedRecordId }, { $set: { emailStatus: 'Sent', emailSentAt: at, emailMessageId: res.messageId || '', emailError: '' } }).catch(() => {});
    }
    const fresh = await freshRow(category, relatedRecordId).catch(() => null);
    if (!res?.success) return { ok: false, status: 502, error: `Email could not be sent: ${attempt.error}`, row: fresh };
    return { ok: true, status: 200, message: `Email sent to ${row.employeeName}.`, row: fresh };
}