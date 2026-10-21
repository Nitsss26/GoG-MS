/**
 * Academic workflow statuses, labels and role groups.
 * Shared by the API (server) and the pages (client) — keep this file free of server-only imports.
 */

// ── Sprint plan lifecycle ──
export const PLAN_STATUS = {
    DRAFT: "DRAFT",
    SUBMITTED: "SUBMITTED",
    LOCKED: "LOCKED",
    UNLOCK_REQUESTED: "UNLOCK_REQUESTED",
    UNLOCKED_FOR_REVISION: "UNLOCKED_FOR_REVISION",
    RESUBMITTED: "RESUBMITTED",
    LOCKED_AGAIN: "LOCKED_AGAIN",
} as const;
export type PlanStatus = typeof PLAN_STATUS[keyof typeof PLAN_STATUS];

export const PLAN_STATUS_LABEL: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    LOCKED: "Locked",
    UNLOCK_REQUESTED: "Unlock Requested",
    UNLOCKED_FOR_REVISION: "Unlocked for Revision",
    RESUBMITTED: "Re-submitted",
    LOCKED_AGAIN: "Locked Again",
};

export const PLAN_STATUS_STYLE: Record<string, string> = {
    DRAFT: "bg-zinc-800 text-zinc-300 border-zinc-700",
    SUBMITTED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    LOCKED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    UNLOCK_REQUESTED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    UNLOCKED_FOR_REVISION: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    RESUBMITTED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    LOCKED_AGAIN: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

/** Plan states in which the content is frozen (nobody can edit) */
export const LOCKED_PLAN_STATUSES: string[] = ["LOCKED", "LOCKED_AGAIN", "UNLOCK_REQUESTED"];
/** Plan states in which the professor can still change the entries */
export const EDITABLE_PLAN_STATUSES: string[] = ["DRAFT", "SUBMITTED", "UNLOCKED_FOR_REVISION", "RESUBMITTED"];
/** Plan states that count as "submitted" for the weekly calendar and the Saturday check */
export const SUBMITTED_PLAN_STATUSES: string[] = ["SUBMITTED", "LOCKED", "UNLOCK_REQUESTED", "UNLOCKED_FOR_REVISION", "RESUBMITTED", "LOCKED_AGAIN"];

/**
 * Status of a plan, including plans saved before the lifecycle existed:
 * old plans were "saved = submitted to HOI", so an old unlocked plan counts as SUBMITTED.
 */
export function getPlanStatus(plan: any): PlanStatus {
    if (plan?.status) return plan.status as PlanStatus;
    if (plan?.isLocked) return "LOCKED";
    return (plan?.entries?.length ? "SUBMITTED" : "DRAFT");
}

// ── Class record pipeline ──
export const CLASS_STATUS = {
    PENDING_PROFESSOR: "PENDING_PROFESSOR",
    SUBMITTED: "SUBMITTED",
    PENDING_OM: "PENDING_OM",
    OM_VERIFIED: "OM_VERIFIED",
    OM_REVERTED: "OM_REVERTED",
    PENDING_CL_CH: "PENDING_CL_CH",
    CL_CH_VERIFIED: "CL_CH_VERIFIED",
    CL_CH_REVERTED: "CL_CH_REVERTED",
    PENDING_HOI: "PENDING_HOI",
    COMPLETED: "COMPLETED",
} as const;
export type ClassStatus = typeof CLASS_STATUS[keyof typeof CLASS_STATUS];

export const CLASS_STATUS_LABEL: Record<string, string> = {
    PENDING_PROFESSOR: "Pending Professor",
    SUBMITTED: "Submitted",
    PENDING_OM: "Pending OM",
    OM_VERIFIED: "OM Verified",
    OM_REVERTED: "Reverted by OM",
    PENDING_CL_CH: "OM Verified · Pending Final (CL/CH/HOI/AD)",
    CL_CH_VERIFIED: "CL/CH Verified",
    CL_CH_REVERTED: "Reverted at Final Verification",
    PENDING_HOI: "CL/CH Verified · Pending Final",
    COMPLETED: "Completed",
};

export const CLASS_STATUS_STYLE: Record<string, string> = {
    PENDING_PROFESSOR: "bg-zinc-800 text-zinc-300 border-zinc-700",
    SUBMITTED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PENDING_OM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    OM_VERIFIED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    OM_REVERTED: "bg-red-500/10 text-red-400 border-red-500/20",
    PENDING_CL_CH: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    CL_CH_VERIFIED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    CL_CH_REVERTED: "bg-red-500/10 text-red-400 border-red-500/20",
    PENDING_HOI: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

/** Records waiting for the final verification — any ONE of CL / CH / HOI can complete them */
export const FINAL_PENDING_CLASS_STATUSES: string[] = ["PENDING_CL_CH", "PENDING_HOI"];
/** Roles that can do the final verification */
export const FINAL_VERIFIER_ROLES = ["CURRICULUM_LEAD", "CURRICULUM_HEAD", "HOI", "AD"];

/** "Final Verification Done by CL (Rahul Sharma) on 09 Oct 2026 at 11:30 AM" — from the stored audit fields */
export function finalVerificationText(record: any, timeZone = "Asia/Kolkata"): string {
    const f = record?.finalVerification?.status === "VERIFIED" ? record.finalVerification
        : record?.hoiVerification?.status === "VERIFIED" ? record.hoiVerification : null; // older records: HOI did the final step
    if (!f?.at) return "";
    const d = new Date(f.at);
    const date = d.toLocaleDateString("en-GB", { timeZone, day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true });
    return `Final Verification Done by ${roleShort(f.role)}${f.byName ? ` (${f.byName})` : ""} on ${date} at ${time}`;
}

/** Record states in which the professor may (re)submit the class record */
export const PROFESSOR_EDITABLE_CLASS_STATUSES: string[] = ["PENDING_PROFESSOR", "OM_REVERTED", "CL_CH_REVERTED"];

/**
 * Status of a class record, including records submitted before the pipeline existed.
 * Old submitted reports (status "Completed" without a pipeline status) wait for OM.
 */
export function getClassStatus(report: any): ClassStatus {
    if (!report) return "PENDING_PROFESSOR";
    if (report.pipelineStatus) return report.pipelineStatus as ClassStatus;
    return report.status === "Completed" ? "PENDING_OM" : "PENDING_PROFESSOR";
}

// ── Role groups ──
export const PROFESSOR_ROLES = ["FACULTY", "PROFESSOR"];
/** May lock / unlock sprint plans (Module 29) */
export const PLAN_AUTHORITY_ROLES = ["HOI", "CURRICULUM_LEAD", "CURRICULUM_HEAD", "AD", "FOUNDER"];
export const CL_CH_ROLES = ["CURRICULUM_LEAD", "CURRICULUM_HEAD"];
/** May open the college weekly calendar */
export const CALENDAR_ROLES = ["FACULTY", "PROFESSOR", "OM", "AD", "CURRICULUM_LEAD", "CURRICULUM_HEAD", "HOI", "FOUNDER"];
/** May open the class verification page */
export const VERIFICATION_ROLES = ["OM", "CURRICULUM_LEAD", "CURRICULUM_HEAD", "HOI", "AD", "FOUNDER"];

export const ROLE_SHORT: Record<string, string> = {
    CURRICULUM_LEAD: "CL",
    CURRICULUM_HEAD: "CH",
    FACULTY: "Professor",
    PROFESSOR: "Professor",
};
export const roleShort = (r?: string) => (r ? ROLE_SHORT[r] || r : "");

// ── Role-specific approval (sprint plan "lock" = approval) ──
/** Stored approval type for the approving role. CL and CH share one label. */
export function approvalTypeForRole(role?: string): string {
    if (role === "CURRICULUM_LEAD" || role === "CURRICULUM_HEAD") return "CL_CH_APPROVED";
    if (role === "HOI") return "HOI_APPROVED";
    if (role === "AD") return "AD_APPROVED";
    if (role === "FOUNDER") return "FOUNDER_APPROVED";
    return "APPROVED";
}
export const APPROVAL_LABEL: Record<string, string> = {
    CL_CH_APPROVED: "CL/CH Approved",
    HOI_APPROVED: "HOI Approved",
    AD_APPROVED: "AD Approved",
    FOUNDER_APPROVED: "Founder Approved",
    APPROVED: "Approved",
};
export const APPROVAL_STYLE: Record<string, string> = {
    CL_CH_APPROVED: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    HOI_APPROVED: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    AD_APPROVED: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    FOUNDER_APPROVED: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};
/**
 * The approval behind a locked plan, from the stored approval record (older plans: the lock fields).
 * Returns null while the plan is not approved (draft, submitted, returned or unlocked for revision).
 */
export function planApproval(plan: any): { type: string; label: string; byId?: string; byName?: string; byRole?: string; byDesignation?: string; at?: string; remarks?: string } | null {
    const st = getPlanStatus(plan);
    if (!LOCKED_PLAN_STATUSES.includes(st)) return null;
    const a = plan?.approval;
    if (a && a.state === "APPROVED" && a.type) {
        return { type: a.type, label: APPROVAL_LABEL[a.type] || a.label || "Approved", byId: a.byId, byName: a.byName, byRole: a.byRole, byDesignation: a.byDesignation, at: a.at, remarks: a.remarks };
    }
    if (plan?.lockedByRole || plan?.lockedByName) {
        const type = approvalTypeForRole(plan.lockedByRole);
        return { type, label: APPROVAL_LABEL[type], byId: plan.lockedById, byName: plan.lockedByName || plan.lockedBy, byRole: plan.lockedByRole, at: plan.lockedAt };
    }
    return null;
}

// ── Lecture plan master values (no master collection exists in the project for these) ──
export const LECTURE_TYPES = ["Theory", "Practical / Lab", "Tutorial", "Revision", "Assessment / Test", "Doubt Session", "Project"];
export const UNIT_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Default class strength when the project has no stored strength for that class (Module 7) */
export const DEFAULT_CLASS_STRENGTH = 60;

/** OM entry / exit check: minutes of grace before a late entry or an early exit needs a reason */
export const OM_TIME_GRACE_MINUTES = 5;
export const LATE_ENTRY_REASONS = [
    "Previous class / lecture ran over",
    "Traffic / commute delay",
    "Official meeting or duty",
    "Health / personal emergency",
    "Classroom or technical setup issue",
];
/** Where the OM shared the lecture notes (Notes Submitted to Groups) */
export const NOTES_GROUP_TYPES: { value: string; label: string }[] = [
    { value: "TELEGRAM", label: "Telegram Group" },
    { value: "WHATSAPP", label: "WhatsApp Group" },
    { value: "BOTH", label: "Telegram & WhatsApp Groups" },
];
export const notesGroupLabel = (v?: string) => NOTES_GROUP_TYPES.find(g => g.value === v)?.label || "";
export const EARLY_EXIT_REASONS = [
    "Next class / lecture scheduled",
    "Session content completed early",
    "Official meeting or duty",
    "Health / personal emergency",
    "Students left early (event / exam)",
];