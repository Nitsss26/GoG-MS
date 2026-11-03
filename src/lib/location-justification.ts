/**
 * SERVER-ONLY: Location Mismatch Justification (HOI / OM with assigned attendance locations).
 *
 *  - Scheduled location of the day = Work Location schedule (date first, then weekday) → otherwise Original Location.
 *  - Clock-in at an assigned location other than the scheduled one → a justification is mandatory BEFORE the
 *    clock-in is recorded (the clock-in API refuses without it); it is saved here as "pending".
 *  - Reviewers: HOI → HR / HR Executive / AD (Founder); OM → the OM's respective HOI(s) and HR / HR Executive (Founder).
 *  - One decision (atomic while pending). Reject = one primary action: warning / custom / penalty (₹) / half_day / full_day.
 *  - Half-Day / Full-Day → payable-day deduction (Salary: payable days); ₹ penalty → separate Monetary Penalties list.
 *  - No email is sent automatically: after a rejection the reviewer previews it and sends it by hand.
 */
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { Employee, Location, WorkSchedule, Attendance } from '@/models/Schemas';
import { LocationJustification, LocationJustificationLock } from '@/models/LocationJustification';
import { hoisAbove, notifySafe } from '@/lib/academic';
import { sendMailInternal } from '@/lib/mail-server';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';

export const REJECT_ACTIONS = ['warning', 'custom', 'penalty', 'half_day', 'full_day'] as const;
export const ACTION_LABEL: Record<string, string> = {
    warning: 'Warning Only', custom: 'Custom Action', penalty: 'Monetary Penalty', half_day: 'Half-Day Deduction', full_day: 'Full-Day Deduction',
};
export const REVIEW_LINK = '/attendance/location-justifications';
const STALE_SENDING_MS = 2 * 60000;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const ORG = 'Geeks of Gurukul';
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const nowIso = () => new Date().toISOString();
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
export const longDate = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ymd);
const fmt12 = (t?: string) => { if (!t) return '—'; const [h, m] = String(t).split(':').map(Number); if (isNaN(h)) return String(t); return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const roleLabel = (actor: any) => actor?.hrExecutive || actor?.session?.actualRole === 'HR_EXECUTIVE' ? 'HR Executive' : actor?.role === 'FOUNDER' ? 'Founder' : actor?.role === 'AD' ? 'AD' : actor?.role === 'HOI' ? 'HOI' : 'HR';
const isAdmin = (actor: any) => !!actor && ['HR', 'FOUNDER'].includes(actor.role);
const locName = (l: any) => l?.shortName || l?.name || l?.id || '';

/** Scheduled location id of an employee on a date (Work Location schedule → date, then weekday → Original Location) */
export async function scheduledLocationOf(emp: any, date: string) {
    const dayName = DAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const rows: any[] = await WorkSchedule.find({ employeeId: emp.id, date: { $in: [date, dayName] } }).select('date location').lean();
    const s = rows.find(r => r.date === date) || rows.find(r => r.date === dayName);
    // same order as the clock-in API: schedule → existing timing rules (Original Location)
    return String(s?.location || getExpectedTimingInternal(emp.name || '', emp.location || '', date).location || emp.location || '');
}

/** Can this actor review this justification? */
export function canReviewItem(actor: any, j: any) {
    if (!actor || !j || j.employeeId === actor.id) return false;
    if (isAdmin(actor)) return true;
    if (actor.role === 'AD') return j.employeeRole === 'HOI';
    if (actor.role === 'HOI') return j.employeeRole === 'OM' && (j.reviewerHoiIds || []).includes(actor.id);
    return false;
}
export const isReviewerRole = (actor: any) => !!actor && ['HR', 'FOUNDER', 'AD', 'HOI'].includes(actor.role);

/** Backend scope of the review list */
function scopeQuery(actor: any): any | null {
    if (isAdmin(actor)) return { employeeId: { $ne: actor.id } };
    if (actor.role === 'AD') return { employeeRole: 'HOI', employeeId: { $ne: actor.id } };
    if (actor.role === 'HOI') return { employeeRole: 'OM', reviewerHoiIds: actor.id };
    return null;
}

export const view = (j: any, actor?: any) => ({
    id: j.id, employeeId: j.employeeId, employeeName: j.employeeName, employeeRole: j.employeeRole, designation: j.designation || '',
    date: j.date, clockIn: j.clockIn || '', scheduledLocationId: j.scheduledLocationId, scheduledLocationName: j.scheduledLocationName,
    actualLocationId: j.actualLocationId, actualLocationName: j.actualLocationName, assignedLocations: j.assignedLocations || [],
    lateAlso: !!j.lateAlso, justification: j.justification, status: j.status,
    reviewedByName: j.reviewedByName || '', reviewedByRole: j.reviewedByRole || '', reviewedAt: j.reviewedAt || '',
    action: j.action || '', actionLabel: j.action ? ACTION_LABEL[j.action] : '', customAction: j.customAction || '',
    penaltyAmount: typeof j.penaltyAmount === 'number' ? j.penaltyAmount : null, decisionReason: j.decisionReason || '', remarks: j.remarks || '',
    emailStatus: j.emailStatus || 'not_sent', emailSentAt: j.emailSentAt || '', emailAttempts: (j.emailAttempts || []).map((a: any) => ({ at: a.at, status: a.status, byName: a.byName, error: a.error || '' })),
    history: j.history || [], createdAt: j.createdAt || '',
    ...(actor ? { canReview: j.status === 'pending' && canReviewItem(actor, j), canEmail: j.status === 'rejected' && canReviewItem(actor, j) } : {}),
});

/** OM: the respective HOI(s) — reporting line first, otherwise the HOI(s) of the OM's location */
async function omHois(om: any, actualLocationId?: string) {
    const above = await hoisAbove(om.id);
    if (above.length) return above;
    const locs = [om.location, actualLocationId].filter(Boolean);
    return Employee.find({ role: 'HOI', status: { $ne: 'Inactive' }, isRemoved: { $ne: true }, $or: [{ location: { $in: locs } }, { attendanceLocations: { $in: locs } }] }).select('id name email role').lean();
}

/**
 * Clock-in API: save the justification BEFORE the attendance is written (removed again by `discardAtClockIn`
 * when the attendance cannot be saved). Returns the new id.
 */
export async function createAtClockIn(emp: any, input: {
    date: string; scheduledLocationId: string; actual: any; assignedIds: string[]; clockIn: string; at: Date;
    lat?: number; lng?: number; accuracy?: number; justification: string; lateAlso: boolean;
}) {
    const locs: any[] = await Location.find({ id: { $in: Array.from(new Set([input.scheduledLocationId, ...input.assignedIds])) } }).select('id name shortName').lean();
    const nameOf = (id: string) => locName(locs.find(l => l.id === id)) || id;
    const hois = emp.role === 'OM' ? await omHois(emp, input.actual?.id) : [];
    const now = nowIso();
    const doc = {
        id: `LMJ-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(), key: `${emp.id}:${input.date}`,
        employeeId: emp.id, employeeName: emp.name, employeeRole: emp.role, employeeEmail: emp.email || '',
        designation: emp.current_designation_at_gog || emp.designation || '',
        date: input.date, scheduledLocationId: input.scheduledLocationId, scheduledLocationName: nameOf(input.scheduledLocationId),
        actualLocationId: input.actual?.id, actualLocationName: locName(input.actual),
        assignedLocations: input.assignedIds.map(id => ({ id, name: nameOf(id) })),
        clockIn: input.clockIn, clockInAt: input.at,
        ...(typeof input.lat === 'number' ? { lat: input.lat } : {}), ...(typeof input.lng === 'number' ? { lng: input.lng } : {}),
        ...(typeof input.accuracy === 'number' ? { accuracyMeters: Math.round(input.accuracy) } : {}),
        lateAlso: input.lateAlso, justification: input.justification.slice(0, 2000),
        reviewerHoiIds: hois.map((h: any) => h.id), status: 'pending', emailStatus: 'not_sent',
        history: [{ at: now, by: emp.id, byName: emp.name, role: emp.role, action: 'Submitted', note: 'Submitted before clock-in' }],
        createdAt: now, updatedAt: now,
    };
    await LocationJustification.init().catch(() => {});
    // a leftover from a clock-in that failed after saving (no attendance linked) is replaced
    await LocationJustification.deleteOne({ key: doc.key, attendanceId: { $in: [null, ''] }, status: 'pending' }).catch(() => {});
    await LocationJustification.create(doc);
    return { id: doc.id, hois };
}
export async function discardAtClockIn(id: string) { await LocationJustification.deleteOne({ id }).catch(() => {}); }

/** After the attendance is saved: link it and notify the reviewers */
export async function finishAtClockIn(id: string, attendanceId: string, lateJustificationId: string | undefined, hois: any[]) {
    await LocationJustification.updateOne({ id }, { $set: { attendanceId, ...(lateJustificationId ? { lateJustificationId } : {}) } });
    const j: any = await LocationJustification.findOne({ id }).lean();
    if (!j) return;
    // The day's attendance shows the change: actual location (attendance.location) + the scheduled (original) one
    if (/^[0-9a-f]{24}$/i.test(String(attendanceId))) {
        await Attendance.collection.updateOne({ _id: new Types.ObjectId(String(attendanceId)) },
            { $set: { locationChanged: true, scheduledLocationId: j.scheduledLocationId || '', scheduledLocationName: j.scheduledLocationName || '', locationJustificationId: id } }).catch(() => {});
    }
    const roles = j.employeeRole === 'HOI' ? ['HR', 'HR_EXECUTIVE', 'AD'] : ['HR', 'HR_EXECUTIVE'];
    const staff: any[] = await Employee.find({ role: { $in: roles }, isRemoved: { $ne: true }, id: { $ne: j.employeeId } }).select('id name email role').lean();
    // not awaited: the clock-in answer does not wait for the e-mails (in-app + mail are sent in the background)
    void notifySafe({
        recipients: [...staff, ...hois.filter((h: any) => h.id !== j.employeeId)],
        title: 'Location Mismatch Justification', message: `${j.employeeName} (${j.employeeRole}) clocked in at a location other than the scheduled one and submitted a justification for review.`,
        type: 'LOCATION_JUSTIFICATION_SUBMITTED', link: REVIEW_LINK, entityType: 'LocationJustification', entityId: id,
        actor: { id: j.employeeId, name: j.employeeName },
        rows: [{ label: 'Employee', value: `${j.employeeName} (${j.employeeId}) · ${j.employeeRole}` }, { label: 'Date', value: longDate(j.date) },
        { label: 'Clock-In', value: fmt12(j.clockIn) }, { label: 'Scheduled Location', value: j.scheduledLocationName || '—' },
        { label: 'Actual Location', value: j.actualLocationName || '—' }, { label: 'Justification', value: j.justification }],
    });
}

export async function listForReviewer(actor: any, f: { status?: string; from?: string; to?: string; q?: string }) {
    const base = scopeQuery(actor);
    if (!base) return null;
    const q: any = { ...base };
    if (['pending', 'approved', 'rejected'].includes(f.status || '')) q.status = f.status;
    const ymd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (ymd(f.from) || ymd(f.to)) q.date = { ...(ymd(f.from) ? { $gte: f.from } : {}), ...(ymd(f.to) ? { $lte: f.to } : {}) };
    let rows: any[] = await LocationJustification.find(q).sort({ date: -1, createdAt: -1 }).limit(1000).lean();
    const s = String(f.q || '').trim().toLowerCase();
    if (s) rows = rows.filter(r => `${r.employeeName} ${r.employeeId} ${r.actualLocationName} ${r.scheduledLocationName}`.toLowerCase().includes(s));
    return rows.map(r => view(r, actor));
}
export async function listOwn(empId: string) {
    const rows: any[] = await LocationJustification.find({ employeeId: empId }).sort({ date: -1 }).limit(200).lean();
    return rows.map(r => view(r));
}

type Decision = { action?: string; rejectAction?: string; customAction?: string; penaltyAmount?: any; reason?: string; remarks?: string };
export async function decide(actor: any, id: string, d: Decision) {
    const j: any = await LocationJustification.findOne({ id }).lean();
    if (!j) return { ok: false as const, status: 404, error: 'Justification not found.' };
    if (!canReviewItem(actor, j)) return { ok: false as const, status: 403, error: 'You are not allowed to review this justification.' };
    if (j.status !== 'pending') return { ok: false as const, status: 409, error: 'This justification has already been reviewed.', item: view(j, actor) };
    if (d.action !== 'approve' && d.action !== 'reject') return { ok: false as const, status: 400, error: 'Choose Approve or Reject.' };
    const now = nowIso();
    const set: any = { status: d.action === 'approve' ? 'approved' : 'rejected', reviewedBy: actor.id, reviewedByName: actor.name, reviewedByRole: roleLabel(actor), reviewedAt: now, updatedAt: now };
    let note = '';
    if (d.action === 'reject') {
        const act = String(d.rejectAction || '');
        if (!(REJECT_ACTIONS as readonly string[]).includes(act)) return { ok: false as const, status: 400, error: 'Choose one rejection action.' };
        const reason = String(d.reason || '').trim();
        if (!reason) return { ok: false as const, status: 400, error: 'The rejection reason is mandatory.' };
        set.action = act; set.decisionReason = reason.slice(0, 2000);
        const remarks = String(d.remarks || '').trim();
        if (remarks) set.remarks = remarks.slice(0, 2000);
        if (act === 'custom') {
            const c = String(d.customAction || '').trim();
            if (!c) return { ok: false as const, status: 400, error: 'Describe the custom action.' };
            set.customAction = c.slice(0, 500);
        }
        if (act === 'penalty') {
            const amt = Number(d.penaltyAmount);
            if (!(typeof d.penaltyAmount === 'number' || (typeof d.penaltyAmount === 'string' && /^\s*\d+(\.\d{1,2})?\s*$/.test(d.penaltyAmount))) || !isFinite(amt) || amt <= 0 || amt > 1000000)
                return { ok: false as const, status: 400, error: 'Enter a valid positive penalty amount (₹).' };
            set.penaltyAmount = Math.round(amt * 100) / 100;
        }
        note = `${ACTION_LABEL[act]}${set.penaltyAmount ? ` ₹${set.penaltyAmount}` : ''}${set.customAction ? `: ${set.customAction}` : ''} — ${set.decisionReason}`;
    }
    // claim the decision first (unique key) — two reviewers at the same moment: only one decides
    await LocationJustificationLock.init().catch(() => {});
    const claimed = await LocationJustificationLock.create({ key: `decision:${id}`, byId: actor.id, at: now }).then(() => true).catch(() => false);
    if (!claimed) {
        const fresh: any = await LocationJustification.findOne({ id }).lean();
        return { ok: false as const, status: 409, error: 'This justification has already been reviewed.', item: fresh ? view(fresh, actor) : undefined };
    }
    const updated: any = await LocationJustification.findOneAndUpdate(
        { id, status: 'pending' },
        { $set: set, $push: { history: { at: now, by: actor.id, byName: actor.name, role: roleLabel(actor), action: d.action === 'approve' ? 'Approved' : 'Rejected', note } } },
        { new: true }).lean();
    if (!updated) {
        await LocationJustificationLock.deleteOne({ key: `decision:${id}` }).catch(() => {});
        const fresh: any = await LocationJustification.findOne({ id }).lean();
        return { ok: false as const, status: 409, error: 'This justification has already been reviewed.', item: fresh ? view(fresh, actor) : undefined };
    }
    // in-app only — the rejection email is sent by hand from the review panel
    const emp: any = await Employee.findOne({ id: j.employeeId }).select('id name email role').lean();
    if (emp) await notifySafe({
        recipients: [emp], email: false, actor: { id: actor.id, name: actor.name },
        title: d.action === 'approve' ? 'Location Justification Approved' : 'Location Justification Rejected',
        message: d.action === 'approve'
            ? `Your location mismatch justification for ${longDate(j.date)} has been approved.`
            : `Your location mismatch justification for ${longDate(j.date)} has been rejected — ${ACTION_LABEL[set.action]}${set.penaltyAmount ? ` (₹${set.penaltyAmount})` : ''}.`,
        type: d.action === 'approve' ? 'LOCATION_JUSTIFICATION_APPROVED' : 'LOCATION_JUSTIFICATION_REJECTED', link: '/attendance',
        entityType: 'LocationJustification', entityId: id,
    });
    return { ok: true as const, item: view(updated, actor) };
}

/* ─────────────── manual rejection email ─────────────── */
async function recipients(j: any) {
    const emp: any = await Employee.findOne({ id: j.employeeId }).select('email').lean();
    const to = String(emp?.email || j.employeeEmail || '').trim().toLowerCase();
    const staff: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE', 'AD'] }, isRemoved: { $ne: true }, mailsStopped: { $ne: true } }).select('email').lean();
    let hoiEmails: string[] = [];
    if (j.employeeRole === 'OM' && j.reviewerHoiIds?.length) {
        const h: any[] = await Employee.find({ id: { $in: j.reviewerHoiIds } }).select('email').lean();
        hoiEmails = h.map(x => String(x.email || '').trim().toLowerCase());
    }
    const cc = Array.from(new Set([...staff.map(s => String(s.email || '').trim().toLowerCase()), ...hoiEmails]))
        .filter(e => EMAIL_RE.test(e) && !e.endsWith('@gog.com') && e !== to);
    return { to, cc };
}

export function composeMail(j: any) {
    const subject = `Attendance Justification Review — ${j.employeeName} — ${longDate(j.date)}`;
    const actionLine = j.action === 'penalty' ? `Monetary Penalty of ₹${Number(j.penaltyAmount).toLocaleString('en-IN')}`
        : j.action === 'custom' ? `Custom Action: ${j.customAction}` : ACTION_LABEL[j.action] || '—';
    const rows: [string, string][] = [
        ['Employee', `${j.employeeName} (${j.employeeId})`], ['Role', j.employeeRole], ['Date', longDate(j.date)], ['Clock-In Time', fmt12(j.clockIn)],
        ['Scheduled Location', j.scheduledLocationName || '—'], ['Actual Location', j.actualLocationName || '—'],
        ['Submitted Justification', j.justification], ['Review Decision', 'Rejected'], ['Action Taken', actionLine],
        ['Reason', j.decisionReason || '—'], ...(j.remarks ? [['Additional Remarks', j.remarks] as [string, string]] : []),
        ['Reviewed By', `${j.reviewedByName || ''}${j.reviewedByRole ? ` (${j.reviewedByRole})` : ''}`],
    ];
    const effect = j.action === 'half_day' ? 'A half-day deduction will be applied to your payable days for this date.'
        : j.action === 'full_day' ? 'A full-day deduction will be applied to your payable days for this date.'
            : j.action === 'penalty' ? 'The monetary penalty above will be recorded against your salary.'
                : j.action === 'warning' ? 'This is a warning. Please make sure you clock in at your scheduled location.' : 'Please follow the action stated above.';
    const intro = 'Your justification for clocking in at a location other than your scheduled work location has been reviewed and rejected.';
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#18181b;line-height:1.55;max-width:620px">
<p>Dear ${esc(j.employeeName)},</p><p>${esc(intro)}</p>
<table style="border-collapse:collapse;margin:12px 0">${rows.map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#52525b;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table>
<p>${esc(effect)}</p><p>Regards,<br/>HR Team<br/>${ORG}</p></div>`;
    const text = [`Dear ${j.employeeName},`, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', effect, '', 'Regards,', 'HR Team', ORG].join('\n');
    return { subject, html, text };
}

export async function previewEmail(actor: any, id: string) {
    const j: any = await LocationJustification.findOne({ id }).lean();
    if (!j) return { ok: false as const, status: 404, error: 'Justification not found.' };
    if (!canReviewItem(actor, j)) return { ok: false as const, status: 403, error: 'Not allowed.' };
    if (j.status !== 'rejected') return { ok: false as const, status: 400, error: 'An email is prepared only for a rejected justification.' };
    const { to, cc } = await recipients(j);
    return { ok: true as const, preview: { to, cc, ...composeMail(j) }, emailStatus: j.emailStatus || 'not_sent' };
}

export async function sendEmail(actor: any, id: string) {
    const j: any = await LocationJustification.findOne({ id }).lean();
    if (!j) return { ok: false as const, status: 404, error: 'Justification not found.' };
    if (!canReviewItem(actor, j)) return { ok: false as const, status: 403, error: 'Not allowed.' };
    if (j.status !== 'rejected') return { ok: false as const, status: 400, error: 'An email is sent only for a rejected justification.' };
    if (j.emailStatus === 'sent') return { ok: false as const, status: 409, error: 'This email was already sent.', item: view(j, actor) };
    const now = nowIso();
    // claim: one send at a time (a stale "sending" can be retried)
    const staleBefore = new Date(Date.now() - STALE_SENDING_MS).toISOString();
    const claimed: any = await LocationJustification.findOneAndUpdate(
        { id, status: 'rejected', $or: [{ emailStatus: { $in: ['not_sent', 'failed', null] } }, { emailStatus: { $exists: false } }, { emailStatus: 'sending', emailSendingAt: { $lt: staleBefore } }] },
        { $set: { emailStatus: 'sending', emailSendingAt: now } }, { new: true }).lean();
    // unique claim per attempt (two clicks at the same moment → one email)
    const attemptNo = (claimed?.emailAttempts || []).length + 1;
    await LocationJustificationLock.init().catch(() => {});
    const lockKey = `email:${id}#${attemptNo}`;
    const tryLock = () => LocationJustificationLock.create({ key: lockKey, byId: actor.id, at: now }).then(() => true).catch(() => false);
    let locked = claimed ? await tryLock() : false;
    if (claimed && !locked) {
        // a send that stopped half-way (server restart) leaves its claim behind: a stale one is cleared once
        const old: any = await LocationJustificationLock.findOne({ key: lockKey }).lean();
        if (old && old.at < staleBefore) { await LocationJustificationLock.deleteOne({ key: lockKey, at: old.at }).catch(() => {}); locked = await tryLock(); }
    }
    if (!claimed || !locked) {
        const fresh: any = await LocationJustification.findOne({ id }).lean();
        return { ok: false as const, status: 409, error: fresh?.emailStatus === 'sent' ? 'This email was already sent.' : 'This email is being sent right now.', item: fresh ? view(fresh, actor) : undefined };
    }
    const { to, cc } = await recipients(claimed);
    const mail = composeMail(claimed);
    let res: any;
    if (!EMAIL_RE.test(to)) res = { success: false, error: 'Employee has no valid email address.' };
    else {
        res = await sendMailInternal({ to, cc, subject: mail.subject, html: mail.html, text: mail.text, noAutoCc: true } as any).catch((e: any) => ({ success: false, error: String(e?.message || e) }));
        if (res?.success && res.messageId === 'skipped-mails-stopped') res = { success: false, error: 'Emails are stopped for this employee.' };
    }
    const at = nowIso();
    const attempt = { at, status: res?.success ? 'sent' : 'failed', byId: actor.id, byName: actor.name, error: res?.success ? '' : String(res?.error || 'Send failed').slice(0, 300), messageId: res?.messageId || '', to, cc };
    const updated: any = await LocationJustification.findOneAndUpdate({ id }, {
        $set: { emailStatus: attempt.status, emailSubject: mail.subject, updatedAt: at, ...(res?.success ? { emailSentAt: at } : {}) },
        $push: { emailAttempts: attempt, history: { at, by: actor.id, byName: actor.name, role: roleLabel(actor), action: res?.success ? 'Email Sent' : 'Email Failed', note: res?.success ? `To ${to}` : attempt.error } },
    }, { new: true }).lean();
    if (!res?.success) return { ok: false as const, status: 502, error: `Email could not be sent: ${attempt.error}`, item: view(updated, actor) };
    return { ok: true as const, message: `Email sent to ${claimed.employeeName}.`, item: view(updated, actor) };
}

/* ─────────────── salary integration ─────────────── */
/**
 * Rejected justifications of a month: Half-Day / Full-Day → payable-day deductions (as attendance penalties,
 * never more than the day's payable part); ₹ penalties → a separate Monetary Penalties list (no payable-day change).
 */
export async function locationPenaltiesFor(ids: string[], start: string, end: string) {
    const rows: any[] = ids.length ? await LocationJustification.find({ employeeId: { $in: ids }, date: { $gte: start, $lte: end }, status: 'rejected', action: { $in: ['half_day', 'full_day', 'penalty'] } })
        .select('id employeeId date action penaltyAmount decisionReason reviewedByName reviewedByRole reviewedAt scheduledLocationName actualLocationName clockIn').lean() : [];
    const violations = new Map<string, any[]>(), money = new Map<string, any[]>();
    for (const r of rows) {
        if (r.action === 'penalty') {
            if (!money.has(r.employeeId)) money.set(r.employeeId, []);
            money.get(r.employeeId)!.push({ id: r.id, date: r.date, amount: r.penaltyAmount || 0, reason: r.decisionReason || '', source: 'Location Mismatch', reviewedByName: r.reviewedByName || '', reviewedByRole: r.reviewedByRole || '', reviewedAt: r.reviewedAt || '', detail: `Scheduled ${r.scheduledLocationName || '—'} · Actual ${r.actualLocationName || '—'}` });
        } else {
            if (!violations.has(r.employeeId)) violations.set(r.employeeId, []);
            violations.get(r.employeeId)!.push({ id: r.id, employeeId: r.employeeId, date: r.date, type: 'LOCATION_MISMATCH', level: r.action === 'full_day' ? 'FULL_DAY' : 'HALF_DAY', instance: null, proposedDeduction: r.action === 'full_day' ? 'Full-Day' : 'Half-Day', hrStatus: 'Approved for Payroll', actualTime: r.clockIn || '' });
        }
    }
    return { violations, money };
}