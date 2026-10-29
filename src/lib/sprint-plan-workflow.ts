/**
 * SERVER-ONLY: sprint plan lifecycle (Modules 2–4, 26, 27).
 *
 *   DRAFT ──submit──▶ SUBMITTED ──lock──▶ LOCKED ──request_unlock──▶ UNLOCK_REQUESTED
 *      ▲                                                     │ unlock            │ reject_unlock
 *      │                                                     ▼                   ▼
 *      │                                       UNLOCKED_FOR_REVISION        (back to LOCKED / LOCKED_AGAIN)
 *      │                                                     │ submit
 *      │                                                     ▼
 *      └──────────────── (professor edits) ─────────── RESUBMITTED ──lock──▶ LOCKED_AGAIN
 *
 *   SUBMITTED / RESUBMITTED ──return (reason)──▶ UNLOCKED_FOR_REVISION   (reviewer asks for corrections before locking)
 *
 * Professor self-locking (current flow, no HOI approval):
 *   DRAFT / SUBMITTED ──self_lock──▶ LOCKED ──self_unlock──▶ UNLOCKED_FOR_REVISION ("Unlocked for Editing")
 *   UNLOCKED_FOR_REVISION ──self_lock──▶ LOCKED_AGAIN ("Updated & Re-Locked")
 *   HOI is told when the plan is locked; HOI + CL / CH are told when it is unlocked, changed and re-locked
 *   (with the list of classes added / changed / removed).
 *
 * Who: professor (owner) — save draft, lock, unlock (older: submit, request unlock).
 *      HOI / CL / CH / AD (and Founder) in the plan's college scope — lock, unlock, reject an unlock request.
 * Every step is written to plan.history; every submission keeps a copy of the entries in plan.revisions.
 * Transitions are atomic (the update only matches when the plan is still in the expected status).
 */
import { SprintPlan } from '@/models/Schemas';
import {
    getPlanStatus, PLAN_STATUS_LABEL, PLAN_AUTHORITY_ROLES, PROFESSOR_ROLES, LOCKED_PLAN_STATUSES,
    approvalTypeForRole, APPROVAL_LABEL,
} from '@/lib/academic-status';
import {
    getAcademicScope, scopeAllowsProfessor, collegeRecipients, employeesByIds, notifySafe, nowISO, weekLabel, collegeName,
} from '@/lib/academic';
import { Employee } from '@/models/Schemas';
import { validateSprintEntries } from '@/lib/time-utils';
import { checkEntries, collegeOfEmployee, diffEntries, fmtDate } from '@/lib/sprint-plan-rules';

/** "26 October – 1 November 2026" (Mon–Sun) */
function weekText(start: string, end?: string) {
    const f = (ymd: string, y: boolean) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', ...(y ? { year: 'numeric' } : {}), timeZone: 'UTC' });
    const sunday = (() => { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })();
    return `${f(start, false)} – ${f(end && end > sunday ? end : sunday, true)}`;
}
const istTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const plainEntries = (plan: any) => (plan?.entries || []).map((e: any) => (e.toObject ? e.toObject() : e));
/** HOI (campus + reporting line) — and CL / CH when `withClCh` */
async function planRecipients(plan: any, withClCh: boolean) {
    const prof: any = await Employee.findOne({ id: plan.facultyId }).select('location').lean();
    const college = prof?.location || plan.college;
    return { college, recipients: await collegeRecipients(college, withClCh ? ['HOI', 'CURRICULUM_LEAD', 'CURRICULUM_HEAD'] : ['HOI'], plan.facultyId) };
}

export type Actor = { id: string; name: string; role: string; employee?: any };
export type PlanActionResult = { ok: true; plan: any; message: string } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): PlanActionResult => ({ ok: false, status, error });

function historyItem(actor: Actor, action: string, fromStatus: string, toStatus: string, note?: string) {
    return { action, fromStatus, toStatus, by: actor.id, byName: actor.name, role: actor.role, at: nowISO(), note: note || '' };
}

/** Can this actor lock / unlock this plan? (role + college scope of the plan's professor) */
export async function canManagePlan(actor: Actor, plan: any): Promise<boolean> {
    if (!PLAN_AUTHORITY_ROLES.includes(actor.role)) return false;
    const scope = await getAcademicScope(actor);
    if (scope.orgWide) return true;
    const prof: any = await Employee.findOne({ id: plan.facultyId }).select('location').lean();
    return scopeAllowsProfessor(scope, plan.facultyId, prof?.location || plan.college);
}

/** Can this actor see this plan? */
export async function canViewPlan(actor: Actor, plan: any): Promise<boolean> {
    if (plan.facultyId === actor.id) return true;
    if (PROFESSOR_ROLES.includes(actor.role)) return false;
    const scope = await getAcademicScope(actor);
    if (scope.orgWide) return true;
    const prof: any = await Employee.findOne({ id: plan.facultyId }).select('location').lean();
    return scopeAllowsProfessor(scope, plan.facultyId, prof?.location || plan.college);
}

/** Atomic status change: only applied while the plan is still in one of `from` */
async function transition(planId: any, from: string[], update: any) {
    // Old plans have no status field yet; their derived status is matched through isLocked
    const or: any[] = [{ status: { $in: from } }];
    const legacyLocked = from.includes('LOCKED');
    const legacyOpen = from.includes('SUBMITTED') || from.includes('DRAFT');
    if (legacyLocked) or.push({ status: { $exists: false }, isLocked: true });
    if (legacyOpen) or.push({ status: { $exists: false }, isLocked: { $ne: true } });
    return SprintPlan.findOneAndUpdate({ _id: planId, $or: or }, update, { new: true });
}

async function planDetails(plan: any) {
    return [
        { label: 'Professor', value: plan.facultyName },
        { label: 'College', value: await collegeName(plan.college) },
        { label: 'Week', value: weekLabel(plan.weekStartDate, plan.weekEndDate) },
        { label: 'Sprint Plan', value: `${plan.entries?.length || 0} class(es) · Plan ID ${plan._id}` },
    ];
}

export async function performPlanAction(actor: Actor, planId: string, action: string, payload: { reason?: string; comment?: string; note?: string } = {}): Promise<PlanActionResult> {
    const plan: any = await SprintPlan.findById(planId).catch(() => null);
    if (!plan) return fail(404, 'Sprint plan not found.');
    const status = getPlanStatus(plan);
    const isOwner = plan.facultyId === actor.id && PROFESSOR_ROLES.includes(actor.role);
    const now = nowISO();

    switch (action) {
        // ── Professor: submit the complete week (first time, or after an unlock) ──
        case 'submit': {
            if (!isOwner) return fail(403, 'Only the professor who owns this plan can submit it.');
            if (!['DRAFT', 'UNLOCKED_FOR_REVISION'].includes(status)) {
                return fail(409, `This plan is already ${PLAN_STATUS_LABEL[status]}.`);
            }
            if (!plan.entries?.length) return fail(400, 'Add at least one class before submitting the week.');
            const v = validateSprintEntries(plan.entries.map((e: any) => e.toObject ? e.toObject() : e));
            if (!v.valid) return fail(400, v.error || 'Some classes have invalid times.');
            const missing = plan.entries.findIndex((e: any) => !e.subjectName || !e.topics);
            if (missing >= 0) return fail(400, `Class ${missing + 1} (${plan.entries[missing].day}) needs a Subject and a Topic before submitting.`);

            const to = status === 'DRAFT' ? 'SUBMITTED' : 'RESUBMITTED';
            const version = status === 'DRAFT' ? (plan.version || 1) : (plan.version || 1) + 1;
            const updated = await transition(plan._id, [status], {
                $set: {
                    status: to, isLocked: false, version,
                    ...(to === 'SUBMITTED' ? { submittedAt: now } : { resubmittedAt: now }),
                },
                $push: {
                    history: historyItem(actor, to === 'SUBMITTED' ? 'Submitted' : 'Re-submitted', status, to, payload.note),
                    revisions: { version, status: to, entries: plan.entries.map((e: any) => e.toObject ? e.toObject() : e), savedAt: now, savedBy: actor.id, savedByName: actor.name, note: to },
                },
            });
            if (!updated) return fail(409, 'The plan was changed by someone else. Refresh and try again.');

            // In-app + email to the reviewers: HOI (campus + reporting hierarchy), CL, CH, AD
            const subProf: any = await Employee.findOne({ id: plan.facultyId }).select('location').lean();
            const reviewers = await collegeRecipients(subProf?.location || plan.college, ['HOI', 'CURRICULUM_LEAD', 'CURRICULUM_HEAD', 'AD'], plan.facultyId);
            await notifySafe({
                recipients: reviewers,
                title: `Sprint Plan ${to === 'SUBMITTED' ? 'Submitted' : 'Re-submitted'} — ${plan.facultyName}`,
                message: `${plan.facultyName} ${to === 'SUBMITTED' ? 'submitted' : 're-submitted'} the sprint plan for the week ${weekLabel(plan.weekStartDate, plan.weekEndDate)}. Please review and lock it.`,
                type: 'SPRINT_SUBMITTED',
                link: `/curriculum/sprint-plans?week=${plan.weekStartDate}&plan=${plan._id}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: subProf?.location || plan.college,
                actor,
                rows: [...(await planDetails(plan)), { label: 'Submitted At', value: new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }],
            });
            return { ok: true, plan: updated, message: to === 'SUBMITTED' ? 'Sprint plan submitted for locking.' : 'Revised sprint plan re-submitted for locking.' };
        }

        // ── HOI / CL / CH / AD: lock a submitted plan ──
        case 'lock': {
            if (!(await canManagePlan(actor, plan))) return fail(403, 'You are not allowed to lock this sprint plan.');
            if (!['SUBMITTED', 'RESUBMITTED'].includes(status)) {
                if (status === 'DRAFT') return fail(409, 'The professor has not submitted this plan yet.');
                if (status === 'UNLOCKED_FOR_REVISION') return fail(409, 'The plan is being revised. Lock it after the professor re-submits.');
                const a = plan.approval?.state === 'APPROVED' ? plan.approval : null;
                return fail(409, a ? `This plan is already ${a.label || PLAN_STATUS_LABEL[status]} by ${a.byName}.` : `This plan is already ${PLAN_STATUS_LABEL[status]}.`);
            }
            const to = status === 'SUBMITTED' ? 'LOCKED' : 'LOCKED_AGAIN';
            // Locking is the approval: store who approved it and as which role (one final approval; the atomic
            // transition below means a second reviewer gets "already Locked" instead of approving twice)
            const type = approvalTypeForRole(actor.role);
            const approval = {
                state: 'APPROVED', type, label: APPROVAL_LABEL[type],
                byId: actor.id, byName: actor.name, byRole: actor.role,
                byDesignation: actor.employee?.designation || actor.role, at: now,
                remarks: String(payload.note || payload.comment || '').trim(),
            };
            const updated = await transition(plan._id, [status], {
                $set: {
                    status: to, isLocked: true, lockedAt: now, lockedBy: actor.name, lockedById: actor.id,
                    lockedByName: actor.name, lockedByRole: actor.role, approval,
                },
                // action stays "Locked" / "Re-locked" (existing audit trail); the note names the role-specific approval
                $push: { history: historyItem(actor, to === 'LOCKED' ? 'Locked' : 'Re-locked', status, to, `${APPROVAL_LABEL[type]}${approval.remarks ? ` — ${approval.remarks}` : ''}`) },
            });
            if (!updated) {
                const fresh: any = await SprintPlan.findById(plan._id).lean();
                const a = fresh?.approval?.state === 'APPROVED' ? fresh.approval : null;
                return fail(409, a ? `Already ${a.label} by ${a.byName}.` : 'The plan was changed by someone else. Refresh and try again.');
            }
            return { ok: true, plan: updated, message: `${APPROVAL_LABEL[type]} — sprint plan ${to === 'LOCKED' ? 'locked' : 'locked again'}.` };
        }

        // ── HOI / CL / CH / AD: return a submitted plan for correction (before locking) ──
        case 'return': {
            if (!(await canManagePlan(actor, plan))) return fail(403, 'You are not allowed to review this sprint plan.');
            if (!['SUBMITTED', 'RESUBMITTED'].includes(status)) return fail(409, `Only a submitted plan can be returned (this plan is ${PLAN_STATUS_LABEL[status]}).`);
            const note = String(payload.note || payload.comment || '').trim();
            if (note.length < 5) return fail(400, 'Please tell the professor what to correct (at least 5 characters).');
            const updated = await transition(plan._id, [status], {
                $set: {
                    status: 'UNLOCKED_FOR_REVISION', isLocked: false,
                    unlockedAt: now, unlockedBy: actor.id, unlockedByName: actor.name, unlockedByRole: actor.role,
                    returnedAt: now, returnNote: note,
                },
                $push: { history: historyItem(actor, 'Returned for correction', status, 'UNLOCKED_FOR_REVISION', note) },
            });
            if (!updated) return fail(409, 'The plan was changed by someone else. Refresh and try again.');
            const [owner] = await employeesByIds([plan.facultyId]);
            await notifySafe({
                recipients: owner ? [owner] : [],
                title: 'Sprint Plan Returned for Correction',
                message: `${actor.name} returned your sprint plan for the week ${weekLabel(plan.weekStartDate, plan.weekEndDate)} for correction. Please update it and re-submit it for locking.`,
                type: 'SPRINT_RETURNED',
                link: `/faculty/sprint-plan?week=${plan.weekStartDate}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: plan.college, actor,
                rows: [...(await planDetails(plan)), { label: 'Returned By', value: `${actor.name} (${actor.role})` }, { label: 'Corrections Needed', value: note }],
            });
            return { ok: true, plan: updated, message: 'Sprint plan returned to the professor for correction.' };
        }

        // ── Professor: ask to unlock a locked plan (plan stays locked) ──
        case 'request_unlock': {
            if (!isOwner) return fail(403, 'Only the professor who owns this plan can request an unlock.');
            if (!['LOCKED', 'LOCKED_AGAIN'].includes(status)) {
                if (status === 'UNLOCK_REQUESTED') return fail(409, 'An unlock request is already waiting for approval.');
                return fail(409, 'Only a locked plan needs an unlock request. This plan can be edited directly.');
            }
            const reason = String(payload.reason || '').trim();
            if (reason.length < 5) return fail(400, 'Please give the reason for the change (at least 5 characters).');
            const comment = String(payload.comment || '').trim();
            const updated = await transition(plan._id, [status], {
                $set: { status: 'UNLOCK_REQUESTED', statusBeforeUnlockRequest: status, unlockRequestedAt: now, isLocked: true },
                $push: {
                    history: historyItem(actor, 'Unlock requested', status, 'UNLOCK_REQUESTED', reason + (comment ? ` — ${comment}` : '')),
                    changeRequests: {
                        requestedAt: now, requestedAtISO: now, reason, comment, status: 'Pending',
                        requestedBy: actor.id, requestedByName: actor.name, approvedBy: '', approvedAt: '', changes: '{}',
                    },
                },
            });
            if (!updated) return fail(409, 'The plan was changed by someone else. Refresh and try again.');

            // Email + in-app: HOI + CL + CH + AD of the professor's college
            const prof: any = await Employee.findOne({ id: plan.facultyId }).select('location').lean();
            const recipients = await collegeRecipients(prof?.location || plan.college, ['HOI', 'CURRICULUM_LEAD', 'CURRICULUM_HEAD', 'AD'], plan.facultyId);
            await notifySafe({
                recipients,
                title: `Sprint Plan Unlock Request — ${plan.facultyName}`,
                message: `${plan.facultyName} has requested to unlock the locked sprint plan for the week ${weekLabel(plan.weekStartDate, plan.weekEndDate)}.`,
                type: 'SPRINT_UNLOCK_REQUESTED',
                link: `/curriculum/sprint-plans?week=${plan.weekStartDate}&plan=${plan._id}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: prof?.location || plan.college,
                actor,
                rows: [
                    ...(await planDetails(plan)),
                    { label: 'Requested At', value: new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
                    { label: 'Reason for Unlock', value: reason },
                    { label: 'Details', value: comment },
                ],
                note: 'The plan stays locked until an authorised HOI / CL / CH / AD unlocks it.',
            });
            return { ok: true, plan: updated, message: `Unlock request sent to ${recipients.length} reviewer(s). The plan stays locked until it is approved.` };
        }

        // ── HOI / CL / CH / AD: unlock for revision ──
        case 'unlock': {
            if (!(await canManagePlan(actor, plan))) return fail(403, 'You are not allowed to unlock this sprint plan.');
            if (!LOCKED_PLAN_STATUSES.includes(status)) return fail(409, `This plan is not locked (${PLAN_STATUS_LABEL[status]}).`);
            const note = String(payload.note || payload.comment || '').trim();
            const set: any = {
                // the approval record is kept for the audit trail; only its state changes
                'approval.state': 'UNLOCKED',
                status: 'UNLOCKED_FOR_REVISION', isLocked: false, lockedAt: null, lockedBy: null,
                unlockedAt: now, unlockedBy: actor.id, unlockedByName: actor.name, unlockedByRole: actor.role,
            };
            // Close the pending request (if any) as approved
            const idx = (plan.changeRequests || []).map((c: any) => c.status).lastIndexOf('Pending');
            if (idx >= 0) {
                Object.assign(set, {
                    [`changeRequests.${idx}.status`]: 'Approved',
                    [`changeRequests.${idx}.approvedBy`]: actor.id,
                    [`changeRequests.${idx}.approvedAt`]: now,
                    [`changeRequests.${idx}.processedBy`]: actor.id,
                    [`changeRequests.${idx}.processedByName`]: actor.name,
                    [`changeRequests.${idx}.processedByRole`]: actor.role,
                    [`changeRequests.${idx}.processedAt`]: now,
                    [`changeRequests.${idx}.decisionNote`]: note,
                });
            }
            const updated = await transition(plan._id, [status], {
                $set: set,
                $push: { history: historyItem(actor, 'Unlocked for revision', status, 'UNLOCKED_FOR_REVISION', note) },
            });
            if (!updated) return fail(409, 'The plan was changed by someone else. Refresh and try again.');

            const [prof] = await employeesByIds([plan.facultyId]);
            await notifySafe({
                recipients: prof ? [prof] : [],
                title: 'Sprint Plan Unlocked for Revision',
                message: `Your sprint plan for the week ${weekLabel(plan.weekStartDate, plan.weekEndDate)} was unlocked by ${actor.name}. You can now edit it and re-submit it for locking.`,
                type: 'SPRINT_UNLOCKED',
                link: `/faculty/sprint-plan?week=${plan.weekStartDate}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: plan.college, actor,
                rows: [...(await planDetails(plan)), { label: 'Unlocked By', value: `${actor.name} (${actor.role})` }, { label: 'Note', value: note }],
            });
            return { ok: true, plan: updated, message: 'Sprint plan unlocked for revision. The professor has been notified.' };
        }

        // ── HOI / CL / CH / AD: refuse an unlock request (plan stays locked) ──
        case 'reject_unlock': {
            if (!(await canManagePlan(actor, plan))) return fail(403, 'You are not allowed to process this request.');
            if (status !== 'UNLOCK_REQUESTED') return fail(409, 'There is no pending unlock request for this plan.');
            const note = String(payload.note || payload.comment || '').trim();
            if (note.length < 3) return fail(400, 'Please give a reason for rejecting the request.');
            const back = plan.statusBeforeUnlockRequest === 'LOCKED_AGAIN' ? 'LOCKED_AGAIN' : 'LOCKED';
            const set: any = { status: back, isLocked: true };
            const idx = (plan.changeRequests || []).map((c: any) => c.status).lastIndexOf('Pending');
            if (idx >= 0) {
                Object.assign(set, {
                    [`changeRequests.${idx}.status`]: 'Rejected',
                    [`changeRequests.${idx}.approvedBy`]: actor.id,
                    [`changeRequests.${idx}.approvedAt`]: now,
                    [`changeRequests.${idx}.processedBy`]: actor.id,
                    [`changeRequests.${idx}.processedByName`]: actor.name,
                    [`changeRequests.${idx}.processedByRole`]: actor.role,
                    [`changeRequests.${idx}.processedAt`]: now,
                    [`changeRequests.${idx}.decisionNote`]: note,
                });
            }
            const updated = await transition(plan._id, ['UNLOCK_REQUESTED'], {
                $set: set,
                $push: { history: historyItem(actor, 'Unlock request rejected', status, back, note) },
            });
            if (!updated) return fail(409, 'The plan was changed by someone else. Refresh and try again.');
            const [prof] = await employeesByIds([plan.facultyId]);
            await notifySafe({
                recipients: prof ? [prof] : [],
                title: 'Sprint Plan Unlock Request Rejected',
                message: `Your request to unlock the sprint plan for the week ${weekLabel(plan.weekStartDate, plan.weekEndDate)} was rejected by ${actor.name}. The plan stays locked.`,
                type: 'SPRINT_UNLOCK_REJECTED',
                link: `/faculty/sprint-plan?week=${plan.weekStartDate}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: plan.college, actor,
                rows: [...(await planDetails(plan)), { label: 'Reason', value: note }],
            });
            return { ok: true, plan: updated, message: 'Unlock request rejected. The plan stays locked.' };
        }

        // ── Professor: Finalize & Lock / Save & Re-Lock their own plan (no HOI approval) ──
        case 'self_lock': {
            if (!isOwner) return fail(403, 'Only the professor who owns this plan can lock it.');
            if (!['DRAFT', 'SUBMITTED', 'RESUBMITTED', 'UNLOCKED_FOR_REVISION'].includes(status)) {
                return fail(409, `This plan is already ${PLAN_STATUS_LABEL[status]}.`);
            }
            const entries = plainEntries(plan);
            if (!entries.length) return fail(400, 'Add at least one class before locking the plan.');
            const v = validateSprintEntries(entries);
            if (!v.valid) return fail(400, v.error || 'Some classes have invalid times.');
            const missing = entries.findIndex((e: any) => !e.subjectName || !e.topics);
            if (missing >= 0) return fail(400, `Class ${missing + 1} (${entries[missing].day} ${fmtDate(entries[missing].date)}) needs a Subject and a Topic before locking.`);
            const college = await collegeOfEmployee(actor.employee);
            const chk = await checkEntries({ facultyId: plan.facultyId, college, weekStartDate: plan.weekStartDate, weekEndDate: plan.weekEndDate, entries });
            if (!chk.ok) return fail(chk.status, chk.error);

            const lean: any = await SprintPlan.findById(plan._id).select('unlockSnapshot history').lean();
            const relock = status === 'UNLOCKED_FOR_REVISION' || status === 'RESUBMITTED' || !!lean?.unlockSnapshot;
            const to = relock ? 'LOCKED_AGAIN' : 'LOCKED';
            const version = relock ? (plan.version || 1) + 1 : (plan.version || 1);
            const changes = relock ? diffEntries(lean?.unlockSnapshot || [], entries) : [];
            const updated = await transition(plan._id, [status], {
                $set: {
                    status: to, isLocked: true, version, lockedAt: now, lockedBy: actor.name, lockedById: actor.id, lockedByName: actor.name, lockedByRole: actor.role,
                    approval: { state: 'APPROVED', type: 'SELF_LOCKED', label: 'Locked by Professor', byId: actor.id, byName: actor.name, byRole: actor.role, byDesignation: actor.employee?.designation || actor.role, at: now, remarks: '' },
                    ...(plan.submittedAt ? {} : { submittedAt: now }),
                },
                $unset: { unlockSnapshot: 1 },
                $push: {
                    history: historyItem(actor, relock ? 'Updated & Re-Locked' : 'Locked', status, to, relock ? (changes.length ? changes.map(c => c.summary).join('\n') : 'No classes changed') : `${entries.length} class(es)`),
                    revisions: { version, status: to, entries, savedAt: now, savedBy: actor.id, savedByName: actor.name, note: to },
                },
            });
            if (!updated) return fail(409, 'The plan was changed meanwhile. Refresh and try again.');
            const { college: col, recipients } = await planRecipients(plan, relock);
            const rows = [
                { label: 'Professor', value: plan.facultyName },
                { label: 'College', value: await collegeName(col) },
                { label: 'Sprint Week', value: weekText(plan.weekStartDate, plan.weekEndDate) },
                { label: 'Status', value: relock ? 'Updated & Re-Locked' : 'Locked' },
                { label: relock ? 'Re-Locked At' : 'Locked At', value: istTime(now) },
                { label: 'Classes', value: String(entries.length) },
            ];
            await notifySafe({
                recipients,
                title: relock ? `Sprint Plan Re-Locked — ${plan.facultyName}` : `Sprint Plan Locked — ${plan.facultyName}`,
                message: relock
                    ? `${plan.facultyName} finalized the updated sprint plan for ${weekText(plan.weekStartDate, plan.weekEndDate)}.`
                    : `${plan.facultyName} finalized and locked the sprint plan for ${weekText(plan.weekStartDate, plan.weekEndDate)}. No approval is needed.`,
                type: relock ? 'SPRINT_RELOCKED' : 'SPRINT_LOCKED',
                link: `/curriculum/sprint-plans?week=${plan.weekStartDate}&plan=${plan._id}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: col, actor, rows,
                ...(relock ? { listItems: changes.length ? changes.map(c => c.summary) : ['No classes were changed after unlocking.'] } : {}),
            });
            return { ok: true, plan: updated, message: relock ? 'Sprint plan updated and re-locked. HOI and CL / CH have been informed.' : 'Sprint plan locked. HOI has been informed.' };
        }

        // ── Professor: unlock their own locked plan straight away (no request / approval) ──
        case 'self_unlock': {
            if (!isOwner) return fail(403, 'Only the professor who owns this plan can unlock it.');
            if (!LOCKED_PLAN_STATUSES.includes(status)) return fail(409, `This plan is not locked (${PLAN_STATUS_LABEL[status]}).`);
            const set: any = {
                status: 'UNLOCKED_FOR_REVISION', isLocked: false, lockedAt: null, lockedBy: null,
                unlockedAt: now, unlockedBy: actor.id, unlockedByName: actor.name, unlockedByRole: actor.role,
                unlockSnapshot: plainEntries(plan),
            };
            if (plan.approval?.state) set['approval.state'] = 'UNLOCKED';
            const idx = (plan.changeRequests || []).map((c: any) => c.status).lastIndexOf('Pending');
            if (idx >= 0) {
                Object.assign(set, {
                    [`changeRequests.${idx}.status`]: 'Approved', [`changeRequests.${idx}.approvedBy`]: actor.id, [`changeRequests.${idx}.approvedAt`]: now,
                    [`changeRequests.${idx}.processedBy`]: actor.id, [`changeRequests.${idx}.processedByName`]: actor.name,
                    [`changeRequests.${idx}.processedByRole`]: actor.role, [`changeRequests.${idx}.processedAt`]: now,
                    [`changeRequests.${idx}.decisionNote`]: 'Unlocked by the professor',
                });
            }
            const note = String(payload.note || payload.comment || payload.reason || '').trim().slice(0, 500);
            const updated = await transition(plan._id, [status], { $set: set, $push: { history: historyItem(actor, 'Unlocked for Editing', status, 'UNLOCKED_FOR_REVISION', note) } });
            if (!updated) return fail(409, 'The plan was changed meanwhile. Refresh and try again.');
            const { college: col, recipients } = await planRecipients(plan, true);
            await notifySafe({
                recipients,
                title: `Sprint Plan Unlocked — ${plan.facultyName}`,
                message: `${plan.facultyName} unlocked the sprint plan for ${weekText(plan.weekStartDate, plan.weekEndDate)} to make changes. You will get the list of changes when they are saved.`,
                type: 'SPRINT_SELF_UNLOCKED',
                link: `/curriculum/sprint-plans?week=${plan.weekStartDate}&plan=${plan._id}`,
                entityType: 'SprintPlan', entityId: String(plan._id), college: col, actor,
                rows: [
                    { label: 'Professor', value: plan.facultyName }, { label: 'College', value: await collegeName(col) },
                    { label: 'Sprint Week', value: weekText(plan.weekStartDate, plan.weekEndDate) }, { label: 'Status', value: 'Unlocked for Editing' },
                    { label: 'Unlocked At', value: istTime(now) }, ...(note ? [{ label: 'Note', value: note }] : []),
                ],
            });
            return { ok: true, plan: updated, message: 'Sprint plan unlocked. Make your changes, then Save & Re-Lock. HOI and CL / CH have been informed.' };
        }

        default:
            return fail(400, 'Unknown action.');
    }
}

/**
 * Professor saves the week's classes (create or edit). Allowed only while the plan is editable.
 * Never touches a locked plan.
 */
export async function saveDraft(actor: Actor, body: { weekStartDate: string; weekEndDate: string; entries: any[]; stream?: string; year?: string }) {
    const { weekStartDate, weekEndDate, entries, stream, year } = body;
    const existing: any = await SprintPlan.findOne({ facultyId: actor.id, weekStartDate });
    const status = existing ? getPlanStatus(existing) : 'DRAFT';
    if (existing && LOCKED_PLAN_STATUSES.includes(status)) {
        return fail(403, status === 'UNLOCK_REQUESTED'
            ? 'Your unlock request is waiting for approval. The plan stays locked until it is unlocked.'
            : 'Sprint plan is locked. Use "Unlock Sprint Plan" to make changes.');
    }
    const now = nowISO();
    const before = existing ? plainEntries(existing) : [];
    const beforeById = new Map(before.filter((e: any) => e._id).map((e: any) => [String(e._id), e]));
    let cleanEntries = (entries || []).map((e: any) => ({
        day: e.day, date: e.date, timeStart: e.timeStart, timeStop: e.timeStop,
        stream: e.stream || '', year: e.year || '', semester: e.semester || '',
        subjectCode: e.subjectCode || '', subjectName: e.subjectName || '', topics: e.topics || '', section: e.section || '',
        lectureType: e.lectureType || '', unitNumber: e.unitNumber ? String(e.unitNumber) : '', content: e.content || '', className: e.className || '',
        ...(e._id ? { _id: e._id } : {}),
    }));
    // When each class row was really written / changed (the scheduled date & time are not back-dated into these)
    const changes = diffEntries(before, cleanEntries);
    const changedIds = new Set(changes.filter(c => c.action === 'class_updated').map(c => c.entryId));
    cleanEntries = cleanEntries.map((e: any) => {
        const old: any = e._id ? beforeById.get(String(e._id)) : null;
        if (!old) return { ...e, createdAt: now, createdBy: actor.id, updatedAt: now, updatedBy: actor.id };
        const base = { createdAt: old.createdAt || '', createdBy: old.createdBy || '', updatedAt: old.updatedAt || '', updatedBy: old.updatedBy || '' };
        return changedIds.has(String(e._id)) ? { ...e, ...base, updatedAt: now, updatedBy: actor.id } : { ...e, ...base };
    });
    // Scheduling rules: own overlaps, college hours, the same class + section at the same time
    const faculty = actor.employee;
    const college = await collegeOfEmployee(faculty);
    const chk = await checkEntries({ facultyId: actor.id, college, weekStartDate, weekEndDate, entries: cleanEntries });
    if (!chk.ok) return { ...fail(chk.status, chk.error), invalidIndices: chk.invalidIndices } as any;
    const logItems = changes.map(c => ({ at: now, by: actor.id, byName: actor.name, action: c.action, entryId: c.entryId, previousData: c.previousData, updatedData: c.updatedData, summary: c.summary }));

    if (!existing) {
        const plan = await SprintPlan.create({
            facultyId: actor.id, facultyName: actor.name, college: faculty?.location || '',
            weekStartDate, weekEndDate, stream: stream || '', year: year || '',
            entries: cleanEntries, isLocked: false, status: 'DRAFT', createdById: actor.id, version: 1,
            history: [historyItem(actor, 'Created', '', 'DRAFT')], changeLog: logItems,
        });
        return { ok: true as const, plan, message: 'Sprint plan saved as draft.' };
    }

    // Plans saved before the lifecycle existed get their derived status written once
    const set: any = {
        facultyName: actor.name, college: faculty?.location || existing.college || '',
        weekEndDate, stream: stream || existing.stream || '', year: year || existing.year || '',
        entries: cleanEntries, isLocked: false,
    };
    if (!existing.status) set.status = status;
    const updated = await SprintPlan.findOneAndUpdate(
        { _id: existing._id, $or: [{ status: { $in: ['DRAFT', 'SUBMITTED', 'UNLOCKED_FOR_REVISION', 'RESUBMITTED'] } }, { status: { $exists: false }, isLocked: { $ne: true } }] },
        { $set: set, $push: { history: historyItem(actor, 'Modified', status, status, changes.length ? changes.map(c => c.summary).join('\n') : `${cleanEntries.length} class(es) — no change`), changeLog: { $each: logItems } } },
        { new: true }
    );
    if (!updated) return fail(409, 'The plan was locked meanwhile. Refresh the page.');
    // Unlocked plan changed: HOI + CL / CH get the list of real changes (nothing is sent when nothing changed)
    if (status === 'UNLOCKED_FOR_REVISION' && changes.length) {
        const { college: col, recipients } = await planRecipients(existing, true);
        await notifySafe({
            recipients,
            title: `Sprint Plan Updated — ${actor.name}`,
            message: `${actor.name} changed the unlocked sprint plan for ${weekText(weekStartDate, weekEndDate)}.`,
            type: 'SPRINT_MODIFIED',
            link: `/curriculum/sprint-plans?week=${weekStartDate}&plan=${existing._id}`,
            entityType: 'SprintPlan', entityId: String(existing._id), college: col, actor,
            rows: [{ label: 'Professor', value: actor.name }, { label: 'College', value: await collegeName(col) }, { label: 'Sprint Week', value: weekText(weekStartDate, weekEndDate) }, { label: 'Updated At', value: istTime(now) }],
            listItems: changes.map(c => c.summary),
            note: 'The plan is still unlocked; you will be told again when it is re-locked.',
        });
    }
    const message = status === 'DRAFT' ? 'Sprint plan saved as draft.'
        : status === 'UNLOCKED_FOR_REVISION' ? (changes.length ? 'Changes saved. HOI and CL / CH have the list of changes. Use "Save & Re-Lock" when you are done.' : 'Saved (no class changed). Use "Save & Re-Lock" when you are done.')
            : 'Changes saved.';
    return { ok: true as const, plan: updated, message };
}