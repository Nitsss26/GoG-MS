/**
 * SERVER-ONLY: "Accept Leave / Reject Leave" from the leave-application e-mail.
 *
 *  - Each authorised approver gets their own e-mail with a signed link (HMAC-SHA256) bound to
 *    that approver and that leave, valid for LINK_VALID_DAYS. Other recipients get the same e-mail
 *    without buttons — being on the mail never gives permission.
 *  - Opening the link only shows a confirmation page (GET is read-only, so mail scanners that open
 *    links change nothing). The decision is a POST from the logged-in approver (the session must be
 *    the same employee the link was sent to), and goes through the same decision steps as the OMS
 *    (src/lib/leave-decision.ts), so a leave already processed cannot be decided again.
 *  - Every e-mail decision is written to the LeaveEmailAction audit log; a link can be used once.
 */
import crypto from 'crypto';
import { Employee, LeaveRequest } from '@/models/Schemas';
import { LeaveEmailAction } from '@/models/LeaveEmailAction';
import { getLeaveTemplate, getAuthorityEmails } from '@/lib/mail-templates';
import { sendMailInternal } from '@/lib/mail-server';
import { hrDecideLeave, managerDecideLeave, managerCanDecide, LEAVE_FINAL_ROLES, PENDING_LEAVE_STATUSES } from '@/lib/leave-decision';
import { LEAVE_MANAGER_ROLES } from '@/lib/leave-scope';

export const LINK_VALID_DAYS = 7;

// Same server secret as the login session (src/lib/session.ts), with its own purpose label
const KEY = crypto.createHmac('sha256', process.env.JWT_SECRET || process.env.MONGODB_URI || 'gog-oms-fallback-secret-change-in-production')
    .update('gog-oms:leave-email-action:v1').digest();

export type LinkPayload = { l: string; u: string; n: string; exp: number };

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (body: string) => crypto.createHmac('sha256', KEY).update(body).digest('base64url');

export function createActionToken(leaveId: string, approverId: string) {
    const payload: LinkPayload = { l: leaveId, u: approverId, n: crypto.randomBytes(12).toString('base64url'), exp: Date.now() + LINK_VALID_DAYS * 86400000 };
    const body = b64(JSON.stringify(payload));
    return `${body}.${sign(body)}`;
}

export function verifyActionToken(token: unknown): { ok: true; payload: LinkPayload } | { ok: false; error: string; status: number } {
    if (typeof token !== 'string' || token.length > 2000 || !token.includes('.')) return { ok: false, status: 400, error: 'This link is not valid.' };
    const [body, sig] = token.split('.');
    const expected = sign(body);
    if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { ok: false, status: 400, error: 'This link is not valid.' };
    let payload: LinkPayload;
    try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false, status: 400, error: 'This link is not valid.' }; }
    if (!payload?.l || !payload?.u || !payload?.n || typeof payload.exp !== 'number') return { ok: false, status: 400, error: 'This link is not valid.' };
    if (Date.now() > payload.exp) return { ok: false, status: 410, error: `This link has expired (links are valid for ${LINK_VALID_DAYS} days). Please open the leave in GOG OMS → Leave.` };
    return { ok: true, payload };
}

/** The step this person may take on the leave right now: final (HR / Founder), HOI step, or none */
export async function stepFor(person: { id: string; role: string; employee?: any }, leave: any): Promise<'final' | 'hoi' | null> {
    if (!leave || !PENDING_LEAVE_STATUSES.includes(leave.status) || leave.employeeId === person.id) return null;
    if (LEAVE_FINAL_ROLES.includes(person.role)) return 'final';
    if (LEAVE_MANAGER_ROLES.includes(person.role) && leave.status === 'Pending HOI Approval' && (await managerCanDecide(person, leave))) return 'hoi';
    return null;
}

export function appBaseUrl(req: Request) {
    const fromEnv = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    if (fromEnv) return fromEnv;
    try { return new URL(req.url).origin; } catch { return ''; }
}

export const actionUrl = (base: string, token: string, a: 'approve' | 'reject') => `${base}/leave-action?a=${a}&t=${encodeURIComponent(token)}`;

/**
 * The leave-application e-mail. `recipients` is the existing recipient list (worked out exactly as before).
 * Authorised approvers among them get their own copy with Accept / Reject; everyone else gets the
 * e-mail without buttons. Sent once per leave.
 */
export async function sendLeaveApplicationEmails(leave: any, recipients: string[], base: string) {
    await LeaveEmailAction.init().catch(() => {});
    const claimed = await LeaveEmailAction.create({ key: `mail:${leave.id}`, kind: 'APPLICATION_MAIL', leaveId: leave.id, employeeId: leave.employeeId, at: new Date().toISOString(), recipients: recipients.length })
        .then(() => true).catch(() => false);
    if (!claimed) return { sent: false, reason: 'already-sent' };

    const applicant: any = await Employee.findOne({ id: leave.employeeId }).select('id name dept designation role').lean();
    const status = leave.status;
    const plain: string[] = [];
    const personal: { email: string; approver: any }[] = [];
    // One query for all recipients; one e-mail address can hold several designation records
    const byEmail = new Map<string, any[]>();
    (await Employee.find({ isRemoved: { $ne: true }, email: { $exists: true, $ne: '' } }).select('id name email role location reportsTo').lean() as any[])
        .forEach(e => { const k = String(e.email).toLowerCase(); if (!byEmail.has(k)) byEmail.set(k, []); byEmail.get(k)!.push(e); });
    for (const email of recipients) {
        // the link goes to a record of this address that may decide the leave now
        const records: any[] = byEmail.get(email.toLowerCase()) || [];
        let approver: any = null;
        for (const r of records.sort((a, b) => Number(LEAVE_FINAL_ROLES.includes(b.role)) - Number(LEAVE_FINAL_ROLES.includes(a.role)))) {
            if (await stepFor({ id: r.id, role: r.role, employee: r }, leave)) { approver = r; break; }
        }
        if (approver) personal.push({ email, approver }); else plain.push(email);
    }

    const results: any[] = [];
    if (plain.length) {
        const { subject, html } = getLeaveTemplate(leave, status, { employee: applicant || {} });
        results.push(await sendMailInternal({ to: plain, subject, html }));
    }
    // personal copies, a few at a time
    for (let i = 0; i < personal.length; i += 5) {
        results.push(...await Promise.all(personal.slice(i, i + 5).map(p => {
            const token = createActionToken(leave.id, p.approver.id);
            const { subject, html } = getLeaveTemplate(leave, status, { employee: applicant || {}, actions: { approveUrl: actionUrl(base, token, 'approve'), rejectUrl: actionUrl(base, token, 'reject') } });
            return sendMailInternal({ to: p.email, subject, html });
        })));
    }
    await LeaveEmailAction.updateOne({ key: `mail:${leave.id}` }, { $set: { actionLinks: personal.length } }).catch(() => {});
    return { sent: true, plain: plain.length, withActions: personal.length, failed: results.filter(r => !r?.success).length };
}

/** Public view of a leave for the confirmation page (only what the approver needs) */
export const leaveView = (leave: any, applicant?: any) => ({
    id: leave.id, employeeId: leave.employeeId, employeeName: leave.employeeName,
    dept: applicant?.dept || '', designation: applicant?.designation || applicant?.role || '',
    type: leave.type, leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate, days: leave.days,
    reason: leave.reason || '', appliedAt: leave.appliedAt || '', status: leave.status, reasonForAction: leave.reasonForAction || '',
    proofCount: (leave.proofUrls || []).length,
});

/** Who decided a leave that is no longer pending (for "already processed") */
export function processedBy(leave: any) {
    if (leave.status === 'Approved') return leave.approvedByName ? `${leave.approvedByName} (${leave.approvedByRole || ''})` : '';
    if (leave.status === 'Rejected') return leave.rejectedByName ? `${leave.rejectedByName} (${leave.rejectedByRole || ''})` : '';
    return '';
}

/** E-mail the employee about the decision — the same e-mail the OMS sends (employee, CC the usual authorities) */
export async function notifyEmployeeOfDecision(leave: any) {
    try {
        const all: any[] = await Employee.find({ isRemoved: { $ne: true } }).select('id name email role reportsTo').lean();
        const emp = all.find(e => e.id === leave.employeeId);
        if (!emp?.email) return;
        const { subject, html } = getLeaveTemplate(leave, leave.status);
        await sendMailInternal({ to: emp.email, cc: getAuthorityEmails(emp, all), subject, html });
    } catch (e: any) {
        console.error('[leave-email-action] decision mail failed:', e?.message);
    }
}

/** Approve / reject from an e-mail link (after the approver confirmed on the page) */
export async function decideFromEmail(actor: any, payload: LinkPayload, input: { action: string; reason?: string; applyLOP?: boolean }) {
    if (actor.id !== payload.u) return { ok: false as const, status: 403, error: 'This link was sent to another approver. Log in with the account the e-mail was sent to.' };
    if (input.action !== 'approve' && input.action !== 'reject') return { ok: false as const, status: 400, error: 'Choose Accept or Reject.' };
    const used = await LeaveEmailAction.findOne({ key: `action:${payload.n}` }).lean();
    if (used) return { ok: false as const, status: 409, error: 'This link has already been used.' };

    const leave: any = await LeaveRequest.findOne({ id: payload.l }).lean();
    if (!leave) return { ok: false as const, status: 404, error: 'Leave request not found.' };
    if (!PENDING_LEAVE_STATUSES.includes(leave.status)) return { ok: false as const, status: 409, error: 'This leave request has already been processed.', leave };
    const step = await stepFor(actor, leave);
    if (!step) return { ok: false as const, status: 403, error: leave.status === 'Pending' && LEAVE_MANAGER_ROLES.includes(actor.role) ? 'This leave request has already been processed at your level — it is now waiting for HR.' : 'You are not authorised to decide this leave request.', leave };

    const reason = String(input.reason || '').trim().slice(0, 1000) || undefined;
    const result = step === 'final'
        ? await hrDecideLeave(actor, { id: leave.id, action: input.action, remarks: reason })
        : await managerDecideLeave(actor, leave, {
            status: input.action === 'reject' ? 'Rejected' : 'Pending',
            reasonForAction: reason,
            // same rule as the OMS approval board: invalid proof or an emergency leave → 2-day loss of pay
            lossOfPayDays: input.action === 'reject' && (input.applyLOP || leave.leaveType === 'Emergency') ? 2 : undefined,
        });
    if (!result.ok) {
        const fresh: any = await LeaveRequest.findOne({ id: leave.id }).lean();
        return { ...result, error: fresh && !PENDING_LEAVE_STATUSES.includes(fresh.status) ? 'This leave request has already been processed.' : result.error, leave: fresh };
    }
    const updated: any = result.leave.toObject ? result.leave.toObject() : result.leave;
    await LeaveEmailAction.create({
        key: `action:${payload.n}`, kind: 'DECISION', leaveId: leave.id, employeeId: leave.employeeId,
        approverId: actor.id, approverName: actor.name, approverRole: actor.role,
        action: input.action === 'approve' ? 'Approved' : 'Rejected', source: 'Email',
        previousStatus: result.previousStatus, updatedStatus: updated.status,
        ...(reason ? { reason } : {}), ...(typeof updated.lossOfPayDays === 'number' && updated.lossOfPayDays ? { lossOfPayDays: updated.lossOfPayDays } : {}),
        at: new Date().toISOString(),
    }).catch((e: any) => console.error('[leave-email-action] audit write failed:', e?.message));
    await notifyEmployeeOfDecision(updated);
    return { ok: true as const, leave: updated, step };
}