import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { notifySafe } from '@/lib/academic';
import { CHECKLIST_ITEMS, CHECKLIST_TOTAL, SLACK_STATUSES, GOOGLE_STATUSES, ID_CARD_STATUSES, SLACK_DONE, GOOGLE_DONE, ID_CARD_DONE, summarize, statusLabel, type ChecklistItemKey } from '@/lib/post-onboarding';
import { ensureChecklist, isChecklistApplicable, checkSlack, checkGoogle } from '@/lib/post-onboarding-server';

export const dynamic = 'force-dynamic';

/**
 * Post-onboarding checklist (six mandatory activities).
 *   GET  ?employeeId=   — one checklist (the employee themself, or HR / Founder)
 *   GET               — HR / Founder: every applicable employee (missing checklists are created once, safely)
 *   PUT  { employeeId, item, completed? | status?, reason?, remarks? } — HR / Founder only (idCard: status YES / NO, NO needs a reason)
 *   POST { employeeId, item: "slackWorkspace" | "googleWorkspace" } — HR / Founder: read the integration status (if configured)
 * The employee can only read; every change is recorded in checklist.history with who and when (server time).
 */
const isHR = (a: any) => a.role === 'HR' || a.role === 'FOUNDER';
const FIELDS = 'id name email role designation dept onboardingStatus onboardingSubmittedAt isRemoved postOnboardingChecklist';
const view = (e: any) => {
    const c = e.postOnboardingChecklist || null;
    return {
        employee: { id: e.id, name: e.name, designation: e.designation || '', dept: e.dept || '', role: e.role, officialEmail: e.email, onboardingStatus: e.onboardingStatus, onboardingSubmittedAt: e.onboardingSubmittedAt || null },
        checklist: c, summary: c ? summarize(c) : null,
    };
};

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const employeeId = new URL(req.url).searchParams.get('employeeId');

        if (employeeId || !isHR(actor)) {
            const id = employeeId || actor.id;
            if (id !== actor.id && !isHR(actor)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
            let e: any = await Employee.findOne({ id }).select(FIELDS).lean();
            if (!e) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
            if (!e.postOnboardingChecklist && isChecklistApplicable(e)) {
                await ensureChecklist(id);
                e = await Employee.findOne({ id }).select(FIELDS).lean();
            }
            return NextResponse.json(view(e));
        }

        // HR list: initialise missing checklists for employees whose onboarding form was submitted (never overwrites)
        const candidates: any[] = await Employee.find({ onboardingSubmittedAt: { $exists: true, $ne: '' }, onboardingStatus: { $in: ['Verification Pending', 'Approved'] } }).select(FIELDS).lean();
        for (const e of candidates) if (!e.postOnboardingChecklist && isChecklistApplicable(e)) await ensureChecklist(e.id);
        const rows: any[] = await Employee.find({ postOnboardingChecklist: { $exists: true, $ne: null } }).select(FIELDS).lean();
        return NextResponse.json({ rows: rows.map(view).sort((a, b) => String(b.employee.onboardingSubmittedAt || '').localeCompare(String(a.employee.onboardingSubmittedAt || ''))) });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isHR(actor)) return NextResponse.json({ error: 'Only HR can update the post-onboarding checklist.' }, { status: 403 });
        const { employeeId, item, completed, status, reason, remarks } = await req.json().catch(() => ({}));
        if (employeeId === actor.id) return NextResponse.json({ error: 'You cannot verify your own checklist.' }, { status: 403 });
        const def = CHECKLIST_ITEMS.find(i => i.key === item);
        if (!def) return NextResponse.json({ error: 'Unknown checklist item.' }, { status: 400 });
        const emp: any = await Employee.findOne({ id: employeeId }).select(FIELDS).lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        if (!emp.postOnboardingChecklist) {
            if (!isChecklistApplicable(emp)) return NextResponse.json({ error: 'This employee has not submitted the onboarding form yet.' }, { status: 409 });
            await ensureChecklist(employeeId);
        }
        const fresh: any = await Employee.findOne({ id: employeeId }).select(FIELDS).lean();
        const c = fresh.postOnboardingChecklist;
        const cur = c[item as ChecklistItemKey] || {};
        const now = new Date().toISOString();
        const by = { id: actor.id, name: actor.name, role: actor.session?.actualRole || actor.role };
        const note = String(remarks || '').trim();
        const set: any = {};
        let from = '', to = '';

        if (def.kind === 'call') {
            if (typeof completed !== 'boolean') return NextResponse.json({ error: 'completed (true / false) is required.' }, { status: 400 });
            if (!!cur.completed === completed) return NextResponse.json({ ...view(fresh), unchanged: true });
            from = cur.completed ? 'Completed' : 'Pending'; to = completed ? 'Completed' : 'Pending';
            set[`postOnboardingChecklist.${item}`] = completed
                ? { completed: true, completedBy: by.id, completedByName: by.name, completedAt: now }
                : { completed: false, completedBy: null, completedByName: null, completedAt: null };
        } else if (def.kind === 'idcard') {
            if (!ID_CARD_STATUSES.some(s => s.value === status)) return NextResponse.json({ error: 'Select whether the ID card was given (Yes / No).' }, { status: 400 });
            const why = String(reason || '').trim();
            if (status === 'NO' && why.length < 3) return NextResponse.json({ error: 'Enter the reason why the ID card was not given.' }, { status: 400 });
            const newReason = status === 'NO' ? why : null;
            if ((cur.status || 'NOT_UPDATED') === status && (cur.reason || null) === newReason) return NextResponse.json({ ...view(fresh), unchanged: true });
            const done = status === ID_CARD_DONE;
            from = statusLabel(ID_CARD_STATUSES, cur.status || 'NOT_UPDATED') + (cur.reason ? ` (${cur.reason})` : '');
            to = statusLabel(ID_CARD_STATUSES, status) + (newReason ? ` (${newReason})` : '');
            set[`postOnboardingChecklist.${item}`] = { status, completed: done, reason: newReason, updatedBy: by.id, updatedByName: by.name, updatedAt: now };
        } else {
            const list = def.kind === 'slack' ? SLACK_STATUSES : GOOGLE_STATUSES;
            if (!list.some(s => s.value === status)) return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
            if (cur.status === status) return NextResponse.json({ ...view(fresh), unchanged: true });
            const done = status === (def.kind === 'slack' ? SLACK_DONE : GOOGLE_DONE);
            from = statusLabel(list, cur.status); to = statusLabel(list, status);
            const base = `postOnboardingChecklist.${item}`;
            set[`${base}.status`] = status;
            set[`${base}.completed`] = done;
            if (def.kind === 'slack') {
                set[`${base}.invitationStatus`] = ['INVITED', 'JOINED', 'VERIFIED'].includes(status) ? 'INVITED' : status;
                set[`${base}.membershipStatus`] = status === 'VERIFIED' ? 'VERIFIED' : status === 'JOINED' ? 'JOINED_NOT_VERIFIED' : 'NOT_VERIFIED';
            } else {
                set[`${base}.accountStatus`] = status === 'NOT_CREATED' ? 'NOT_CREATED' : status === 'ACCOUNT_CREATED' ? 'CREATED' : 'ENABLED';
                set[`${base}.activationStatus`] = done ? 'VERIFIED' : status === 'NOT_CREATED' ? 'NOT_VERIFIED' : 'ACTIVATION_PENDING';
            }
            // Verified by HR (the integration result, if any, is stored separately and never claimed as the verifier)
            set[`${base}.verifiedBy`] = done ? by.id : null;
            set[`${base}.verifiedByName`] = done ? by.name : null;
            set[`${base}.verifiedAt`] = done ? now : null;
            set[`${base}.verificationSource`] = done ? 'HR' : null;
        }
        const history = { item, label: def.label, from, to, by: by.id, byName: by.name, role: by.role, at: now, remarks: note };
        // progress after this change
        const after = JSON.parse(JSON.stringify(c));
        after[item] = after[item] || {};
        if (def.kind === 'call') after[item].completed = completed;
        else if (def.kind === 'idcard') after[item].completed = set[`postOnboardingChecklist.${item}`].completed;
        else after[item].completed = set[`postOnboardingChecklist.${item}.completed`];
        const sum = summarize(after);
        set['postOnboardingChecklist.progress'] = { completed: sum.completed, total: CHECKLIST_TOTAL };
        set['postOnboardingChecklist.status'] = sum.status;
        set['postOnboardingChecklist.updatedAt'] = now;
        if (sum.status === 'Completed' && !c.completedAt) set['postOnboardingChecklist.completedAt'] = now;

        await Employee.updateOne({ id: employeeId }, { $set: set, $push: { 'postOnboardingChecklist.history': history } });
        const updated: any = await Employee.findOne({ id: employeeId }).select(FIELDS).lean();

        // Notify the employee (in-app) when an item becomes completed, and once when all are done
        const nowDone = def.kind === 'call' ? completed === true : def.kind === 'idcard' ? !!after[item].completed && !cur.completed : !!set[`postOnboardingChecklist.${item}.completed`];
        if (nowDone) {
            const message = def.kind === 'slack' ? 'Your Slack workspace membership has been verified.'
                : def.kind === 'google' ? 'Your Google Workspace account activation has been verified.'
                    : def.kind === 'idcard' ? 'Your ID card has been marked as given.'
                        : `Your ${def.label} has been marked as completed.`;
            await notifySafe({ recipients: [emp], title: 'Post-onboarding activity completed', message, type: 'POST_ONBOARDING', link: '/', entityType: 'Employee', entityId: emp.id, actor: by, email: false });
            if (sum.status === 'Completed' && !c.completedAt) {
                await notifySafe({ recipients: [emp], title: 'Post-onboarding checklist completed', message: 'Congratulations! All six mandatory post-onboarding activities have been completed.', type: 'POST_ONBOARDING', link: '/', entityType: 'Employee', entityId: emp.id, actor: by, email: false });
            }
        }
        return NextResponse.json(view(updated));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** Read the actual Slack / Google Workspace status from the integration (when configured). Never completes the item by itself. */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isHR(actor)) return NextResponse.json({ error: 'Only HR can check integrations.' }, { status: 403 });
        const { employeeId, item } = await req.json().catch(() => ({}));
        const emp: any = await Employee.findOne({ id: employeeId }).select('id email postOnboardingChecklist').lean();
        if (!emp?.postOnboardingChecklist) return NextResponse.json({ error: 'No checklist for this employee.' }, { status: 404 });
        const now = new Date().toISOString();
        let result: any;
        if (item === 'slackWorkspace') result = await checkSlack(emp.email);
        else if (item === 'googleWorkspace') result = await checkGoogle(emp.email);
        else return NextResponse.json({ error: 'Unknown integration.' }, { status: 400 });
        const integration = { ...result, checkedAt: now, checkedBy: actor.name };
        await Employee.updateOne({ id: employeeId }, { $set: { [`postOnboardingChecklist.${item}.integration`]: integration, ...(item === 'slackWorkspace' && result.slackUserId ? { 'postOnboardingChecklist.slackWorkspace.slackUserId': result.slackUserId } : {}) } });
        return NextResponse.json({ integration });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}