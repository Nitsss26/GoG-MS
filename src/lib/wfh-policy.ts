/**
 * Work From Home approval policy (shared by API and pages — no server-only imports).
 * Who may APPLY and who may APPROVE are separate permissions.
 *   - Apply: Tech Lead, Tech Team, HR, HR Executive, OM and Owner/Founder (WFH_POLICY.applyRoles).
 *     Applications made earlier by other roles stay as they are.
 *   - Approve: HR / Founder for anyone; a reporting manager (HOI / AD / TL / OM) for their own reporting
 *     hierarchy — the same mapping the leave approvals use. Nobody approves their own application.
 * HR Executive acts with the HR permissions here.
 */
export const WFH_POLICY = {
    /** Roles that may apply for Work From Home (HR Executive works with the HR role) */
    applyRoles: ["TL", "TECH_TEAM", "HR", "HR_EXECUTIVE", "OM", "FOUNDER"],
    adminApproverRoles: ["HR", "FOUNDER"],
    managerApproverRoles: ["HOI", "AD", "TL", "OM"],
    allowSelfApproval: false,
    maxDaysPerApplication: 31,
};
export const WFH_TYPE_LABEL: Record<string, string> = { FULL_DAY: "Full Day", HALF_DAY: "Half Day" };
export const WFH_STATUS_STYLE: Record<string, string> = {
    Pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    Cancelled: "bg-zinc-800 text-zinc-400 border-zinc-700",
};
/** May this user apply for Work From Home? */
export const canApplyWfh = (u: { role?: string; actualRole?: string } | null | undefined) =>
    !!u && (WFH_POLICY.applyRoles.includes(String(u.role || "")) || WFH_POLICY.applyRoles.includes(String(u.actualRole || "")));
/** Attendance status label of a Work From Home record */
export const wfhAttendanceLabel = (s?: string) =>
    s === "Approved" ? "WFH – Approved" : s === "Pending" ? "WFH – Pending Approval" : s === "Rejected" || s === "Cancelled" ? "WFH – Under Review" : "WFH";
/** Is a date (YYYY-MM-DD) inside an application's range? */
export const wfhCovers = (a: { startDate: string; endDate: string }, ymd: string) => a.startDate <= ymd && ymd <= a.endDate;