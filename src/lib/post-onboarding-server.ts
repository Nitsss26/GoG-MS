/**
 * SERVER-ONLY: post-onboarding checklist creation and the optional Slack / Google Workspace checks.
 * Tokens are read from the environment on the server only and are never returned to the browser or logged.
 */
import { Employee } from '@/models/Schemas';
import { newChecklist } from '@/lib/post-onboarding';
import { notifySafe } from '@/lib/academic';

/** Employees whose onboarding form was submitted (the checklist applies to them) */
export const isChecklistApplicable = (e: any) =>
    !!e && !e.isRemoved && !!e.onboardingSubmittedAt && ['Verification Pending', 'Approved'].includes(String(e.onboardingStatus || ''));

/**
 * Create the checklist once (idempotent: only when it does not exist yet — a resubmitted form never creates a second one
 * and never overwrites completed items). Returns true when it was created now.
 */
export async function ensureChecklist(employeeId: string, opts: { notify?: boolean } = {}): Promise<boolean> {
    const emp: any = await Employee.findOne({ id: employeeId }).select('id name email role isRemoved onboardingStatus onboardingSubmittedAt').lean();
    if (!emp) return false;
    const res: any = await Employee.updateOne(
        { id: employeeId, $or: [{ postOnboardingChecklist: { $exists: false } }, { postOnboardingChecklist: null }] },
        { $set: { postOnboardingChecklist: newChecklist(new Date().toISOString(), emp.email) } },
    );
    const created = (res?.modifiedCount ?? res?.nModified ?? 0) > 0;
    if (created && opts.notify) {
        await notifySafe({
            recipients: [emp], title: 'Onboarding form submitted',
            message: 'Your onboarding form has been submitted successfully. Please complete your six mandatory post-onboarding activities.',
            type: 'POST_ONBOARDING', link: '/', entityType: 'Employee', entityId: emp.id, actor: { id: '', name: 'GoG OMS' }, email: false,
        });
    }
    return created;
}

/** Slack membership check (users.lookupByEmail) — only when SLACK_BOT_TOKEN is configured */
export async function checkSlack(email: string): Promise<{ configured: boolean; found?: boolean; slackUserId?: string; deleted?: boolean; error?: string }> {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return { configured: false };
    try {
        const r = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const d: any = await r.json();
        if (!d.ok) return { configured: true, found: false, error: d.error === 'users_not_found' ? undefined : String(d.error || 'Slack API error') };
        return { configured: true, found: true, slackUserId: d.user?.id, deleted: !!d.user?.deleted };
    } catch (e: any) {
        return { configured: true, error: 'Slack is not reachable' };
    }
}

/**
 * Google Workspace account check (Admin SDK Directory users.get) — only when an authorised server-side access token is
 * configured (GOOGLE_WORKSPACE_ACCESS_TOKEN). Reads account existence, suspension and last login; never passwords.
 */
export async function checkGoogle(email: string): Promise<{ configured: boolean; exists?: boolean; suspended?: boolean; firstLoginDone?: boolean; lastLoginTime?: string; error?: string }> {
    const token = process.env.GOOGLE_WORKSPACE_ACCESS_TOKEN;
    if (!token) return { configured: false };
    try {
        const r = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=basic`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (r.status === 404) return { configured: true, exists: false };
        if (!r.ok) return { configured: true, error: `Google API error (${r.status})` };
        const d: any = await r.json();
        const last = String(d.lastLoginTime || '');
        return { configured: true, exists: true, suspended: !!d.suspended, lastLoginTime: last, firstLoginDone: !!last && !last.startsWith('1970') };
    } catch {
        return { configured: true, error: 'Google is not reachable' };
    }
}