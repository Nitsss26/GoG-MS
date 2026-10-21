/**
 * Post-onboarding checklist — six mandatory activities after the onboarding form is submitted.
 * Shared by the API and the pages (no server-only imports). Stored on Employee.postOnboardingChecklist.
 * The stored key "hohCall" is kept for existing records; it is shown as the HOI call.
 */
export type ChecklistItemKey = "hohCall" | "adCall" | "hrSopWalkthrough" | "slackWorkspace" | "googleWorkspace" | "idCard";

export const CHECKLIST_ITEMS: { key: ChecklistItemKey; label: string; short: string; kind: "call" | "slack" | "google" | "idcard" }[] = [
    { key: "hohCall", label: "One-on-One Call with HOI (Head of Institution)", short: "HOI", kind: "call" },
    { key: "adCall", label: "One-on-One Call with AD (Associate Director)", short: "AD", kind: "call" },
    { key: "hrSopWalkthrough", label: "SOP Walkthrough Call with HR (Manager)", short: "SOP", kind: "call" },
    { key: "slackWorkspace", label: "Slack Workspace Joined & Verified", short: "Slack", kind: "slack" },
    { key: "googleWorkspace", label: "Google Workspace Credentials Activated & Verified", short: "Google", kind: "google" },
    { key: "idCard", label: "ID Card Given", short: "ID Card", kind: "idcard" },
];
export const CHECKLIST_TOTAL = CHECKLIST_ITEMS.length;

/** ID card: "Yes" completes the item; "No" needs a reason and keeps the item pending */
export const ID_CARD_STATUSES: { value: string; label: string }[] = [
    { value: "NOT_UPDATED", label: "Not Updated" },
    { value: "YES", label: "Yes – Given" },
    { value: "NO", label: "No – Not Given" },
];
export const ID_CARD_DONE = "YES";

/** Slack: an invitation is not membership — only VERIFIED completes the item */
export const SLACK_STATUSES: { value: string; label: string }[] = [
    { value: "NOT_INVITED", label: "Not Invited" },
    { value: "INVITATION_PENDING", label: "Invitation Pending" },
    { value: "INVITED", label: "Invited" },
    { value: "JOINED", label: "Joined" },
    { value: "VERIFIED", label: "Verified" },
];
/** Google Workspace: account creation is not activation — only ACTIVATED_VERIFIED completes the item */
export const GOOGLE_STATUSES: { value: string; label: string }[] = [
    { value: "NOT_CREATED", label: "Not Created" },
    { value: "ACCOUNT_CREATED", label: "Account Created – Activation Pending" },
    { value: "ACCOUNT_ENABLED", label: "Account Enabled – Activation Pending" },
    { value: "ACTIVATION_PENDING", label: "Activation Pending" },
    { value: "ACTIVATED_VERIFIED", label: "Activated & Verified" },
];
export const SLACK_DONE = "VERIFIED";
export const GOOGLE_DONE = "ACTIVATED_VERIFIED";

export type ChecklistStatus = "Not Started" | "In Progress" | "Completed";

export function itemDone(c: any, key: ChecklistItemKey): boolean {
    return !!c?.[key]?.completed;
}
export function summarize(c: any): { completed: number; total: number; status: ChecklistStatus } {
    const completed = CHECKLIST_ITEMS.filter(i => itemDone(c, i.key)).length;
    return { completed, total: CHECKLIST_TOTAL, status: completed === 0 ? "Not Started" : completed === CHECKLIST_TOTAL ? "Completed" : "In Progress" };
}
export const statusLabel = (list: { value: string; label: string }[], v?: string) => list.find(x => x.value === v)?.label || v || "—";

/** Short state of one item for tables / the employee card */
export function itemState(c: any, key: ChecklistItemKey): string {
    const it = c?.[key] || {};
    if (key === "slackWorkspace") return it.completed ? "Verified" : statusLabel(SLACK_STATUSES, it.status || "NOT_INVITED");
    if (key === "googleWorkspace") return it.completed ? "Verified" : statusLabel(GOOGLE_STATUSES, it.status || "NOT_CREATED");
    if (key === "idCard") return it.completed ? "Given" : it.status === "NO" ? "Not Given" : "Pending";
    return it.completed ? "Completed" : "Pending";
}

/** A new checklist (all pending) */
export function newChecklist(now: string, officialEmail?: string) {
    const call = () => ({ completed: false, completedBy: null, completedByName: null, completedAt: null });
    return {
        createdAt: now,
        onboardingFormStatus: "SUBMITTED",
        hohCall: call(), adCall: call(), hrSopWalkthrough: call(),
        slackWorkspace: { status: "NOT_INVITED", invitationStatus: "NOT_INVITED", membershipStatus: "NOT_VERIFIED", slackUserId: null, completed: false, verifiedBy: null, verifiedByName: null, verifiedAt: null, verificationSource: null, integration: null },
        googleWorkspace: { status: "NOT_CREATED", accountStatus: "NOT_CREATED", activationStatus: "NOT_VERIFIED", officialEmail: officialEmail || null, completed: false, verifiedBy: null, verifiedByName: null, verifiedAt: null, verificationSource: null, integration: null },
        idCard: { status: "NOT_UPDATED", completed: false, reason: null, updatedBy: null, updatedByName: null, updatedAt: null },
        progress: { completed: 0, total: CHECKLIST_TOTAL },
        status: "Not Started",
        history: [] as any[],
    };
}