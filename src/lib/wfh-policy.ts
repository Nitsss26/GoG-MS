/**
 * Work From Home approval policy (shared by API and pages — no server-only imports).
 * Who may APPLY and who may APPROVE are separate permissions.
 *   - Apply: every active employee, any role (Owner/Founder, HR, HR Executive, TL, Tech Team, Professors, …).
 *   - Approve: HR / Founder for anyone; a reporting manager (HOI / AD / TL / OM) for their own reporting
 *     hierarchy — the same mapping the leave approvals use. Nobody approves their own application.
 * HR Executive acts with the HR permissions here.
 */
export const WFH_POLICY = {
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
/** Is a date (YYYY-MM-DD) inside an application's range? */
export const wfhCovers = (a: { startDate: string; endDate: string }, ymd: string) => a.startDate <= ymd && ymd <= a.endDate;
