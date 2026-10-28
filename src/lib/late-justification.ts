/**
 * SERVER-ONLY: Late Clock-In Justification workflow (one backend for HR and HR Executive).
 *
 *  - Late detection is unchanged: the clock-in API sets Attendance.flags.late (existing reporting time + grace rules).
 *  - The employee submits a reason (+ optional document) for a late day → status "pending", HR and HR Executive notified.
 *  - HR or HR Executive (or a Founder) decides once — approval by either is enough:
 *      approved → Attendance.flags.late = false (effective Normal Clock-In everywhere), audit entry on the attendance,
 *                 the day's Late Clock-In violation is waived (no longer counted / deducted). Clock-in time is not changed.
 *      rejected → nothing changes on the attendance; the reason is saved.
 *  - The original clock-in time and the original late classification stay on the LateJustification record.
 */
import { randomBytes } from 'crypto';
import { Attendance, AttendanceViolation, Employee } from '@/models/Schemas';
import { LateJustification, LateJustificationDecision } from '@/models/LateJustification';
import { scheduledTiming, fmt12, fmtDuration } from '@/lib/attendance-violations';
import { notifySafe } from '@/lib/academic';

/** HR Executive works with the session role "HR", so HR and HR Executive have exactly the same access here */
export const REVIEWER_ROLES = ['HR', 'FOUNDER'];
export const canReview = (actor: any) => !!actor && REVIEWER_ROLES.includes(actor.role);
export const reviewerRoleLabel = (actor: any) =>
    actor?.hrExecutive || actor?.session?.actualRole === 'HR_EXECUTIVE' ? 'HR Executive' : actor?.role === 'FOUNDER' ? 'Founder' : 'HR';

const nowIso = () => new Date().toISOString();
const ymd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dmy = (s: string) => s.split('-').reverse().join('-');
const toMins = (t?: string) => { if (!t) return NaN; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
const DOC_RE = /^https:\/\/[^\s]+$/i;
const DOC_EXT_RE = /\.(pdf|jpe?g|png)(\?|#|$)/i;

/** Scheduled / actual / late minutes of a late day (the same numbers the Late Clock-In alert used) */
async function lateInfo(emp: any, rec: any) {
    const v: any = await AttendanceViolation.findOne({ key: `LATE_IN:${emp.id}:${rec.date}` }).select('id scheduledTime actualTime durationMins hrStatus').lean();
    const scheduled = v?.scheduledTime || (await scheduledTiming(emp, rec.date)).in;
    const actual = rec.clockIn || v?.actualTime || '';
    const mins = typeof v?.durationMins === 'number' ? v.durationMins : Math.max(0, toMins(actual) - toMins(scheduled));
    return { scheduled, actual, lateMinutes: isNaN(mins) ? undefined : mins, violation: v };
}

const view = (j: any) => ({
    id: j.id, employeeId: j.employeeId, employeeName: j.employeeName, department: j.department || '', date: j.date,
    scheduledClockIn: j.scheduledClockIn, actualClockIn: j.actualClockIn, lateDurationMinutes: j.lateDurationMinutes,
    originalIsLate: j.originalIsLate !== false, effectiveIsLate: j.effectiveIsLate !== false,
    justificationReason: j.justificationReason || '', supportingDocument: j.supportingDocument || '',
    justificationStatus: j.justificationStatus, reviewedBy: j.reviewedBy || '', reviewedByName: j.reviewedByName || '',
    reviewedByRole: j.reviewedByRole || '', reviewedAt: j.reviewedAt || '', rejectionReason: j.rejectionReason || '', createdAt: j.createdAt || '',
});

/** Employee: own late days (last `days` days) with their justification status (not_submitted / pending / approved / rejected) */
export async function myLateDays(emp: any, days = 62) {
    const from = new Date(Date.now() - days * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);
    const [recs, js]: [any[], any[]] = await Promise.all([
        Attendance.find({ employeeId: emp.id, date: { $gte: from }, 'flags.late': true, clockIn: { $exists: true, $nin: [null, ''] } }).select('date clockIn flags status').lean(),
        LateJustification.find({ employeeId: emp.id, date: { $gte: from } }).lean(),
    ]);
    const byDate = new Map(js.map(j => [j.date, j]));
    const out: any[] = [];
    for (const r of recs) {
        if (byDate.has(r.date) || r.status === 'Absent') continue;
        const info = await lateInfo(emp, r);
        out.push({ date: r.date, scheduledClockIn: info.scheduled, actualClockIn: info.actual, lateDurationMinutes: info.lateMinutes, justificationStatus: 'not_submitted' });
    }
    js.forEach(j => out.push(view(j)));
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Employee submits a justification for their own late clock-in on `date` */
export async function submitJustification(actor: any, input: { date?: string; reason?: string; documentUrl?: string }) {
    const date = input.date;
    if (!ymd(date)) return { ok: false as const, status: 400, error: 'Choose the attendance date.' };
    const reason = String(input.reason || '').trim().slice(0, 2000);
    if (reason.length < 5) return { ok: false as const, status: 400, error: 'Please explain the reason for your late arrival.' };
    const doc = String(input.documentUrl || '').trim();
    if (doc && (!DOC_RE.test(doc) || doc.length > 2048 || !DOC_EXT_RE.test(doc))) return { ok: false as const, status: 400, error: 'The supporting document must be a PDF, JPG, JPEG or PNG file.' };

    const emp: any = actor.employee?.toObject ? actor.employee.toObject() : actor.employee;
    const rec: any = await Attendance.findOne({ employeeId: actor.id, date }).lean();
    if (!rec?.clockIn || !rec?.flags?.late || rec.status === 'Absent') return { ok: false as const, status: 400, error: 'There is no late clock-in on this date.' };
    const info = await lateInfo(emp, rec);
    const now = nowIso();
    const j = {
        id: `LJ-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(), key: `${actor.id}:${date}`,
        employeeId: actor.id, employeeName: actor.name, department: emp?.dept || emp?.department || '',
        attendanceId: String(rec._id), date, scheduledClockIn: info.scheduled, actualClockIn: info.actual, lateDurationMinutes: info.lateMinutes,
        originalIsLate: true, effectiveIsLate: true, justificationReason: reason, ...(doc ? { supportingDocument: doc } : {}),
        justificationStatus: 'pending', violationId: info.violation?.id || '', createdAt: now, updatedAt: now,
    };
    await LateJustification.init().catch(() => {});
    try { await LateJustification.create(j); }
    catch (e: any) { if (e?.code === 11000) return { ok: false as const, status: 409, error: 'You have already submitted a justification for this date.' }; throw e; }

    // HR and HR Executive both receive the request
    const reviewers: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE'] }, isRemoved: { $ne: true }, id: { $ne: actor.id } }).select('id name email role').lean();
    await notifySafe({
        recipients: reviewers, title: 'Late Clock-In Justification Request',
        message: 'An employee has submitted a late clock-in justification for review.',
        type: 'LATE_JUSTIFICATION_SUBMITTED', link: '/attendance?tab=late-justifications', entityType: 'LateJustification', entityId: j.id,
        actor: { id: actor.id, name: actor.name },
        rows: [{ label: 'Employee Name', value: `${actor.name} (${actor.id})` }, { label: 'Date', value: dmy(date!) },
        { label: 'Scheduled / Actual Clock-In', value: `${fmt12(j.scheduledClockIn)} / ${fmt12(j.actualClockIn)}` },
        { label: 'Late Duration', value: fmtDuration(j.lateDurationMinutes) }, { label: 'Submitted Reason', value: reason },
        { label: 'Supporting Document', value: doc ? 'Attached' : 'None' }],
    });
    return { ok: true as const, justification: view(j) };
}

/** HR / HR Executive (/ Founder): list of justifications */
export async function listJustifications(filter: { status?: string; from?: string; to?: string }) {
    const q: any = {};
    if (['pending', 'approved', 'rejected'].includes(filter.status || '')) q.justificationStatus = filter.status;
    if (ymd(filter.from) || ymd(filter.to)) q.date = { ...(ymd(filter.from) ? { $gte: filter.from } : {}), ...(ymd(filter.to) ? { $lte: filter.to } : {}) };
    const rows: any[] = await LateJustification.find(q).sort({ createdAt: -1 }).limit(1000).lean();
    return rows.map(view);
}

/**
 * HR / HR Executive decision — the same function for both roles. Decided once: a unique decision row is claimed
 * first, then the request is updated only while it is still pending.
 */
export async function decideJustification(actor: any, id: string, action: string, reasonIn?: string) {
    if (!canReview(actor)) return { ok: false as const, status: 403, error: 'Only HR or HR Executive can review late clock-in justifications.' };
    if (action !== 'approve' && action !== 'reject') return { ok: false as const, status: 400, error: 'Choose Approve or Reject.' };
    const j: any = await LateJustification.findOne({ id }).lean();
    if (!j) return { ok: false as const, status: 404, error: 'Request not found.' };
    if (j.employeeId === actor.id) return { ok: false as const, status: 403, error: 'You cannot review your own justification.' };
    const processed = () => ({ ok: false as const, status: 409, error: 'This request has already been processed.' });
    if (j.justificationStatus !== 'pending') return { ...processed(), justification: view(j) };
    const reason = String(reasonIn || '').trim().slice(0, 1000);
    if (action === 'reject' && reason.length < 3) return { ok: false as const, status: 400, error: 'Please give the reason for rejection.' };

    const now = nowIso();
    const byRole = reviewerRoleLabel(actor);
    const decision = action === 'approve' ? 'approved' : 'rejected';
    await LateJustificationDecision.init().catch(() => {});
    const claimed = await LateJustificationDecision.create({ key: `decision:${id}`, justificationId: id, employeeId: j.employeeId, date: j.date, decision, byId: actor.id, byName: actor.name, byRole, ...(reason ? { reason } : {}), at: now })
        .then(() => true).catch(() => false);
    if (!claimed) {
        const fresh: any = await LateJustification.findOne({ id }).lean();
        return { ...processed(), justification: fresh ? view(fresh) : undefined };
    }

    const set: any = { justificationStatus: decision, reviewedBy: actor.id, reviewedByName: actor.name, reviewedByRole: byRole, reviewedAt: now, updatedAt: now };
    if (action === 'reject') set.rejectionReason = reason;
    else set.effectiveIsLate = false;
    const updated: any = await LateJustification.findOneAndUpdate({ id, justificationStatus: 'pending' }, { $set: set }, { new: true }).lean();
    if (!updated) { await LateJustificationDecision.deleteOne({ key: `decision:${id}` }).catch(() => {}); return processed(); }

    if (action === 'approve') {
        // Effective classification → Normal Clock-In; the clock-in time itself is not changed
        const rec: any = await Attendance.findOne({ employeeId: j.employeeId, date: j.date }).lean();
        if (rec) {
            await Attendance.updateOne({ _id: rec._id }, {
                $set: { 'flags.late': false },
                $push: { attendanceAudit: { fromStatus: rec.status, toStatus: rec.status, previousClockIn: rec.clockIn || '', previousClockOut: rec.clockOut || '', by: actor.id, byName: actor.name, role: byRole, at: now, remarks: `Late clock-in excused — justification ${id} approved (clock-in ${rec.clockIn || ''}, scheduled ${j.scheduledClockIn || ''})${reason ? ': ' + reason : ''}` } },
            });
        }
        // The day's Late Clock-In violation no longer counts (instance count) or deducts
        const v: any = await AttendanceViolation.findOne({ key: `LATE_IN:${j.employeeId}:${j.date}` }).select('id hrStatus').lean();
        if (v && v.hrStatus !== 'Waived') {
            await AttendanceViolation.updateOne({ id: v.id }, { $set: { hrStatus: 'Waived', hrDecisionBy: actor.id, hrDecisionByName: actor.name, hrDecisionAt: now, hrRemarks: `Late clock-in justification approved by ${byRole}` } });
            await LateJustification.updateOne({ id }, { $set: { violationId: v.id, violationStatusBefore: v.hrStatus } });
        }
    }

    const emp: any = await Employee.findOne({ id: j.employeeId }).select('id name email role').lean();
    if (emp) {
        await notifySafe({
            recipients: [emp], actor: { id: actor.id, name: actor.name },
            title: action === 'approve' ? 'Late Clock-In Justification Approved' : 'Late Clock-In Justification Rejected',
            message: action === 'approve'
                ? 'Your late clock-in justification has been approved by HR. Your attendance has been updated to Normal Clock-In.'
                : 'Your late clock-in justification has been rejected by HR. Your original late attendance status will remain applicable.',
            type: action === 'approve' ? 'LATE_JUSTIFICATION_APPROVED' : 'LATE_JUSTIFICATION_REJECTED', link: '/attendance',
            entityType: 'LateJustification', entityId: id,
            rows: [{ label: 'Date', value: dmy(j.date) }, { label: 'Scheduled / Actual Clock-In', value: `${fmt12(j.scheduledClockIn)} / ${fmt12(j.actualClockIn)}` },
            { label: 'Reviewed by', value: `${actor.name} (${byRole})` }, ...(action === 'reject' ? [{ label: 'Reason', value: reason }] : [])],
        });
    }
    return { ok: true as const, justification: view({ ...j, ...set }) };
}