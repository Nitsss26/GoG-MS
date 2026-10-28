/**
 * SERVER-ONLY: the leave decision steps, shared by the OMS pages and the e-mail Accept / Reject links.
 *
 *  - hrDecideLeave      → HR / FOUNDER final decision (was inline in PUT /api/hr/leaves)
 *  - managerDecideLeave → HOI step by HOI / AD / TL / OM (was inline in PUT /api/leaves)
 *
 * The rules are unchanged; both updates only apply while the leave is still waiting for that step,
 * so two approvers (or an old e-mail link) can never overwrite a decision already recorded.
 */
import { LeaveRequest } from '@/models/Schemas';
import { LEAVE_MANAGER_ROLES, managedEmployeeIds } from '@/lib/leave-scope';
import { LeaveEmailAction } from '@/models/LeaveEmailAction';

/**
 * One decision per step: a unique row is claimed before the update, so two approvers acting at the same
 * moment (OMS or e-mail) cannot both decide. A claim left behind by a request that failed half-way, or for a
 * leave HR later put back to pending, is released after 2 minutes if the leave is still waiting for that step.
 */
async function claimStep(leaveId: string, step: string, status: string, actorId: string) {
    const key = `claim:${leaveId}:${step}`;
    await LeaveEmailAction.init().catch(() => {}); // unique index on `key` is in place before the first claim
    const row = { key, kind: 'DECISION_CLAIM', leaveId, approverId: actorId, previousStatus: status, at: new Date().toISOString() };
    if (await LeaveEmailAction.create(row).then(() => true).catch(() => false)) return true;
    const old: any = await LeaveEmailAction.findOne({ key }).lean();
    const current: any = await LeaveRequest.findOne({ id: leaveId }).select('status').lean();
    if (old && current?.status === status && Date.now() - new Date(old.at).getTime() > 120000) {
        await LeaveEmailAction.deleteOne({ key, at: old.at });
        return LeaveEmailAction.create(row).then(() => true).catch(() => false);
    }
    return false;
}
const releaseStep = (leaveId: string, step: string) => LeaveEmailAction.deleteOne({ key: `claim:${leaveId}:${step}` }).catch(() => {});

export type DecisionResult =
    | { ok: true; leave: any; previousStatus: string }
    | { ok: false; status: number; error: string };

const fail = (status: number, error: string): DecisionResult => ({ ok: false, status, error });

export const LEAVE_FINAL_ROLES = ['HR', 'FOUNDER'];
export const PENDING_LEAVE_STATUSES = ['Pending', 'Pending HOI Approval'];

/** HR / FOUNDER: approve or reject a pending leave directly (no HOI approval needed first) */
export async function hrDecideLeave(actor: { id: string; name: string; role: string }, input: { id: string; action: string; remarks?: string }): Promise<DecisionResult> {
    if (!LEAVE_FINAL_ROLES.includes(actor.role)) return fail(403, 'Only HR can directly approve or reject leave.');
    const { id, action, remarks } = input;
    if (!id || (action !== 'approve' && action !== 'reject')) return fail(400, 'Leave id and a valid action (approve / reject) are required');

    const leave: any = await LeaveRequest.findOne({ id }).lean();
    if (!leave) return fail(404, 'Leave request not found');
    if (!PENDING_LEAVE_STATUSES.includes(leave.status)) return fail(409, `This leave is already ${leave.status}`);
    // HR cannot decide their own leave: another HR or a Founder has to do it
    if (leave.employeeId === actor.id) return fail(403, 'You cannot approve or reject your own leave.');

    const now = new Date().toISOString();
    const updates: any = { hrApproverId: actor.id, hrApprovedAt: now };
    if (remarks) updates.reasonForAction = remarks;
    if (action === 'approve') {
        Object.assign(updates, { status: 'Approved', hrApproval: 'Approved', approvedBy: actor.id, approvedByName: actor.name, approvedByRole: actor.role, approvedAt: now });
    } else {
        Object.assign(updates, { status: 'Rejected', hrApproval: 'Rejected', rejectedBy: actor.id, rejectedByName: actor.name, rejectedByRole: actor.role, rejectedAt: now });
    }
    if (!(await claimStep(id, 'final', leave.status, actor.id))) return fail(409, 'This leave request has already been processed.');
    // Atomic: only while it is still pending (two approvers, or an old e-mail link, at the same time)
    const updated = await LeaveRequest.findOneAndUpdate({ id, status: { $in: PENDING_LEAVE_STATUSES } }, { $set: updates }, { new: true });
    if (!updated) { await releaseStep(id, 'final'); return fail(409, 'This leave request has already been processed.'); }
    return { ok: true, leave: updated, previousStatus: leave.status };
}

/** May this manager take the HOI step of this leave? (reportee in scope, not their own leave) */
export async function managerCanDecide(actor: any, leave: any) {
    return LEAVE_MANAGER_ROLES.includes(actor.role) && leave.employeeId !== actor.id && (await managedEmployeeIds(actor)).has(leave.employeeId);
}

/**
 * HOI step: "Pending HOI Approval" → "Pending" (on to HR) or "Rejected". The approver is always the session user.
 * updates: { status: 'Rejected' | anything else (= approve), reasonForAction?, lossOfPayDays? }
 */
export async function managerDecideLeave(actor: any, leave: any, updates: any): Promise<DecisionResult> {
    if (!(await managerCanDecide(actor, leave))) return fail(403, 'You can only decide leave requests of your reportees.');
    if (leave.status !== 'Pending HOI Approval') return fail(409, `This request is "${leave.status}" — it is no longer waiting for your approval.`);
    const next = updates.status === 'Rejected' ? 'Rejected' : 'Pending';
    const set: any = {
        status: next,
        hoiApproval: next === 'Rejected' ? 'Rejected' : 'Approved',
        hoiApproverId: actor.id,
        hoiApprovedAt: new Date().toISOString(),
        reasonForAction: typeof updates.reasonForAction === 'string' ? updates.reasonForAction : undefined,
    };
    if (next === 'Rejected') {
        set.rejectedBy = actor.id; set.rejectedByName = actor.name; set.rejectedByRole = actor.role; set.rejectedAt = set.hoiApprovedAt;
        if (typeof updates.lossOfPayDays === 'number') set.lossOfPayDays = Math.max(0, Math.min(2, updates.lossOfPayDays));
    }
    Object.keys(set).forEach(k => set[k] === undefined && delete set[k]);
    if (!(await claimStep(leave.id, 'hoi', leave.status, actor.id))) return fail(409, 'This request was already decided by someone else.');
    // Atomic: only while it is still waiting for the HOI step (two managers clicking at once)
    const updated = await LeaveRequest.findOneAndUpdate({ id: leave.id, status: 'Pending HOI Approval' }, { $set: set }, { new: true });
    if (!updated) { await releaseStep(leave.id, 'hoi'); return fail(409, 'This request was already decided by someone else.'); }
    return { ok: true, leave: updated, previousStatus: leave.status };
}