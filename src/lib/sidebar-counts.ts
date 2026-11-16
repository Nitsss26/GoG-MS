/**
 * SERVER-ONLY: sidebar notification badge counts for the logged-in user (GET /api/sidebar-counts).
 *
 * Each count uses the same records and the same "waiting for me" rule as the page the sidebar item opens,
 * and is only worked out for roles that have that sidebar item. Nothing here changes any record.
 *
 *  Pending (until approved / rejected / resolved) — opening a page never lowers these:
 *    /hr/leave-management            HR, HR Executive, Founder: leave requests waiting (Pending / Pending HOI Approval), not own
 *    /manager/leave-approval         HOI, AD, TL: "Pending HOI Approval" requests of their team · Founder: as HR
 *    /hr/reimbursements              HR, Founder (not HR Executive): Pending claims
 *    /hr/wfh-management              HR, HR Executive, Founder: Pending WFH applications, not own
 *    /hr/holiday-approval            HR, HR Executive, Founder: Proposed holidays
 *    /hr/dress-code                  HR, HR Executive, Founder: dress code photos waiting for verification
 *    /hr/full-attire                 HR, HR Executive, Founder: Full Attire submissions with photos still to review
 *    /meetings                       HR, HR Executive, Founder: meeting requests waiting to be scheduled
 *    /hr/salary-management           HR, HR Executive, Founder: pending payable-day correction tickets (Open / Under Review / Additional Information Required)
 *    /manager/responsibility-approvals AD, Founder: Pending responsibilities submitted by someone else
 *    /academic/verification          OM: OM queue · CL / CH / HOI / AD: final verification queue (last 90 days, like the page)
 *    /attendance/location-justifications HOI, AD: Pending justifications they can review
 *    /tickets                        HR / HR Executive: every unresolved ticket · others: unresolved tickets assigned to them
 *    /faculty/lecture-report         Professor: reports due + reverted reports (last 31 days, like the page)
 *  Unread (until read):
 *    /announcements                  everyone: announcements they can see and have not read (not their own)
 *    /curriculum/sprint-plans        HOI: locked plans not marked as read yet (the page's "Mark as Read")
 */
import {
    LeaveRequest, ReimbursementClaim, WorkFromHome, Holiday, Attendance, MeetingRequest, AdditionalResponsibility,
    LectureReport, SprintPlan, Ticket, Notice, Employee,
} from '@/models/Schemas';
import { FullAttireSubmission, FullAttireReview } from '@/models/FullAttire';
import { managedEmployeeIds, LEAVE_ADMIN_ROLES } from '@/lib/leave-scope';
import { PENDING_LEAVE_STATUSES } from '@/lib/leave-decision';
import { WFH_POLICY } from '@/lib/wfh-policy';
import { CorrectionTicket } from '@/models/SalaryModule';
import { getAcademicScope, professorsInScope, zonedNow, addDays, hasClassEnded } from '@/lib/academic';
import { planVisibleFor } from '@/lib/professor-routine';
import { getClassStatus, getPlanStatus, FINAL_PENDING_CLASS_STATUSES, FINAL_VERIFIER_ROLES, PROFESSOR_ROLES, CL_CH_ROLES } from '@/lib/academic-status';
import { listForReviewer } from '@/lib/location-justification';
import { visibleNotices } from '@/lib/notice-visibility';

export type SidebarCounts = Record<string, number>;

const ADMIN = ['HR', 'FOUNDER'];
const UNRESOLVED_TICKET = ['Open', 'In Progress'];

/** Same sidebar rules as Sidebar.tsx (which sections / items a role has) */
const has = {
    hr: (a: any) => ADMIN.includes(a.role),
    manager: (a: any) => ['FOUNDER', 'AD', 'HOI', 'OM'].includes(a.role),
    faculty: (a: any) => PROFESSOR_ROLES.includes(a.role),
};

// ── pending ──

/** Salary Management → Correction Tickets: same "Pending" as the page's Pending filter */
export const PENDING_CORRECTION_TICKET = ['Open', 'Under Review', 'Additional Information Required'];
const correctionTickets = () => CorrectionTicket.countDocuments({ status: { $in: PENDING_CORRECTION_TICKET } });

async function hrLeaves(a: any) {
    return LeaveRequest.countDocuments({ status: { $in: PENDING_LEAVE_STATUSES }, employeeId: { $ne: a.id } });
}
async function managerLeaves(a: any) {
    if (LEAVE_ADMIN_ROLES.includes(a.role)) return hrLeaves(a);
    const ids = Array.from(await managedEmployeeIds(a));
    if (!ids.length) return 0;
    return LeaveRequest.countDocuments({ status: 'Pending HOI Approval', employeeId: { $in: ids } });
}
const reimbursements = () => ReimbursementClaim.countDocuments({ status: 'Pending' });
const wfh = (a: any) => WorkFromHome.countDocuments({ status: 'Pending', ...(WFH_POLICY.allowSelfApproval ? {} : { employeeId: { $ne: a.id } }) });
const holidayRequests = () => Holiday.countDocuments({ status: 'Proposed' });
async function dressCode() {
    // the page lists photos of employees in the workforce list only
    const emps: any[] = await Employee.find({}).select('id').lean();
    return Attendance.countDocuments({ dressCodeStatus: 'Pending', dressCodeImageUrl: { $nin: [null, ''] }, employeeId: { $in: emps.map(e => e.id) } });
}
async function fullAttire() {
    // same as the page's Pending tab: submissions (latest 500) with at least one photo still pending
    const subs: any[] = await FullAttireSubmission.find({}).sort({ submittedAt: -1 }).limit(500).select('id').lean();
    if (!subs.length) return 0;
    const pending: any[] = await FullAttireReview.find({ submissionId: { $in: subs.map(s => s.id) }, status: 'pending' }).select('submissionId').lean();
    return new Set(pending.map(r => r.submissionId)).size;
}
const meetings = () => MeetingRequest.countDocuments({ status: 'Pending' });
const responsibilities = (a: any) => AdditionalResponsibility.countDocuments({ status: 'Pending', addedBy: { $ne: a.id } });

async function verification(a: any) {
    // the page's queue: OM → PENDING_OM; CL / CH / HOI / AD → final verification + late-added assignments
    const final = FINAL_VERIFIER_ROLES.includes(a.role);
    if (a.role !== 'OM' && !final) return 0;
    const keys = a.role === 'OM' ? ['PENDING_OM'] : FINAL_PENDING_CLASS_STATUSES;
    const profs: any[] = await professorsInScope(await getAcademicScope(a), null);
    if (!profs.length) return 0;
    const today = zonedNow().ymd;
    let rows: any[] = await LectureReport.find({ facultyId: { $in: profs.map(p => p.id) }, date: { $gte: addDays(today, -90), $lte: today } })
        .select('facultyId sprintPlanId pipelineStatus status assignment.hasAssignment assignment.addedLater assignment.verificationStatus').lean();
    // multi-college professors: only the class records of colleges in this scope (same as the verification page)
    if (profs.some((p: any) => p._planScope && !p._planScope.all)) {
        const byId = new Map(profs.map((p: any) => [p.id, p]));
        const pids = Array.from(new Set(rows.map(r => String(r.sprintPlanId || '')).filter(Boolean)));
        const planById = new Map((await SprintPlan.find({ _id: { $in: pids } }).select('facultyId college collegeFixed').lean()).map((p: any) => [String(p._id), p]));
        rows = rows.filter(r => {
            const fac: any = byId.get(r.facultyId), ps = fac?._planScope;
            if (!ps || ps.all) return true;
            const pl = planById.get(String(r.sprintPlanId || ''));
            return pl ? planVisibleFor(fac, pl) : (ps.keys || []).includes(String(fac.location || ''));
        });
    }
    return rows.filter(r => {
        const ps = getClassStatus(r);
        if (keys.includes(ps)) return true;
        return final && ps === 'COMPLETED' && r.assignment?.hasAssignment && r.assignment?.addedLater && r.assignment?.verificationStatus === 'Pending';
    }).length;
}

async function locationJustifications(a: any) {
    const rows = await listForReviewer(a, { status: 'pending' });
    return (rows || []).filter((r: any) => r.canReview).length;
}

/** Ids whose tickets a non-admin sees on the Tickets page (own + reportees — same rule as AuthContext.getReportees) */
function ticketPageRaisers(me: any, emps: any[]) {
    const mgrsOf = (e: any) => (Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : []);
    const hoiIds = new Set(emps.filter(e => e.role === 'HOI').map(e => e.id));
    const ok = (e: any) => {
        const isReportee = mgrsOf(e).includes(me.id);
        if (me.role === 'FOUNDER') return true;
        if (me.role === 'CURRICULUM_HEAD') return ['CURRICULUM_LEAD', 'FACULTY', 'PROFESSOR'].includes(e.role);
        if (me.role === 'CURRICULUM_LEAD') return ['FACULTY', 'PROFESSOR'].includes(e.role);
        if (me.role === 'HR') return ['AD', 'HOI', 'FACULTY', 'PROFESSOR', 'OM', 'CURRICULUM_HEAD', 'CURRICULUM_LEAD'].includes(e.role);
        if (me.role === 'AD') return ['HOI', 'FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM', 'PLACEMENT_INTERN_HEAD', 'CURRICULUM_HEAD', 'CURRICULUM_LEAD'].includes(e.role) && isReportee;
        if (me.role === 'HOI') {
            const loc = me.employee?.location;
            const hasAssignedHoi = mgrsOf(e).some((id: string) => hoiIds.has(id));
            return ['FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM', 'PLACEMENT_INTERN_HEAD'].includes(e.role) && (isReportee || (!hasAssignedHoi && !!loc && e.location === loc));
        }
        if (['OM', 'MARKETING_TEAM', 'TECH_TEAM', 'PLACEMENT_INTERN_HEAD', 'TECH_INTERN'].includes(me.role)) return ['FACULTY', 'PROFESSOR'].includes(e.role) && isReportee;
        return isReportee;
    };
    return new Set([me.id, ...emps.filter(ok).map(e => e.id)]);
}
async function tickets(a: any) {
    // HR (and HR Executive) work on every ticket
    if (a.role === 'HR') return Ticket.countDocuments({ status: { $in: UNRESOLVED_TICKET } });
    // everyone else: tickets assigned to them that are not resolved yet (the page's Resolve / Mark In Progress buttons)
    const mine: any[] = await Ticket.find({ routeTo: a.id, status: { $in: UNRESOLVED_TICKET } }).select('raisedBy').lean();
    if (!mine.length) return 0;
    if (['FOUNDER', 'AD'].includes(a.role)) return mine.length; // they see every ticket
    const emps: any[] = await Employee.find({}).select('id role reportsTo location').lean();
    const visible = ticketPageRaisers(a, emps);
    return mine.filter(t => visible.has(t.raisedBy)).length;
}

/** Professor → Lecture Report: "Report Pending" + "Reverted" of the page's default range (today − 30 … today) */
async function lectureReports(a: any) {
    const today = zonedNow().ymd;
    const from = addDays(today, -30);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const REVERTED = ['OM_REVERTED', 'CL_CH_REVERTED'];
    const plans: any[] = await SprintPlan.find({ facultyId: a.id, weekStartDate: { $lte: today }, weekEndDate: { $gte: from } })
        .select('weekStartDate weekEndDate entries status isLocked isSubmitted').sort({ weekStartDate: -1 }).lean();
    const reports: any[] = await LectureReport.find({ facultyId: a.id, date: { $gte: from, $lte: today } })
        .select('date status pipelineStatus sprintEntryId sprintPlanId lectureNumber courseName topicsCovered').lean();
    let count = 0;
    const tally = (ps: string, recorded: boolean, ended: boolean) => { if (REVERTED.includes(ps) || (!recorded && ended)) count++; };
    for (let d = from; d <= today; d = addDays(d, 1)) {
        // same matching as GET /api/faculty/lectures
        const dayName = dayNames[new Date(d).getDay()].toUpperCase().substring(0, 3);
        // one plan per college for a multi-college professor (lecture number = position in its own plan), as in GET /api/faculty/lectures
        const items: { entry: any; plan: any; num: number }[] = [];
        plans.filter(p => d >= p.weekStartDate && d <= p.weekEndDate && getPlanStatus(p) !== 'DRAFT').forEach(pl =>
            (pl.entries || []).filter((e: any) => e.date === d || e.day?.toUpperCase()?.substring(0, 3) === dayName).forEach((entry: any, i: number) => items.push({ entry, plan: pl, num: i + 1 })));
        const dayReports = reports.filter(r => r.date === d);
        const used = new Set<string>();
        items.forEach(({ entry, plan, num }) => {
            const free = (r: any) => !used.has(String(r._id));
            let rep = dayReports.find(r => free(r) && r.sprintEntryId && r.sprintEntryId === entry._id?.toString());
            if (!rep) rep = dayReports.find(r => free(r) && !r.sprintEntryId && ((r.sprintPlanId === plan?._id?.toString() && r.lectureNumber === num) || (r.date === d && r.lectureNumber === num)));
            if (!rep) rep = dayReports.find(r => free(r) && r.courseName === entry.subjectName && r.topicsCovered === entry.topics);
            if (rep) used.add(String(rep._id));
            const ps = rep ? getClassStatus(rep) : 'PENDING_PROFESSOR';
            const recorded = !!rep && (rep.status === 'Completed' || ps !== 'PENDING_PROFESSOR');
            tally(ps, recorded, hasClassEnded(d, entry.timeStop));
        });
        dayReports.filter(r => !used.has(String(r._id)) && (r.status === 'Completed' || r.pipelineStatus !== 'PENDING_PROFESSOR')).forEach(r => {
            const ps = getClassStatus(r);
            tally(ps, r.status === 'Completed' || ps !== 'PENDING_PROFESSOR', true);
        });
    }
    return count;
}

// ── unread ──

async function announcements(a: any) {
    const all: any[] = await Notice.find({ readBy: { $ne: a.id } }).select('id collegeIds source createdById').lean();
    const unread = all.filter(n => n.createdById !== a.id);
    return (await visibleNotices(unread, a)).length;
}

async function sprintPlansToRead(a: any) {
    if (a.role !== 'HOI') return 0;
    const profs: any[] = await professorsInScope(await getAcademicScope(a), null);
    if (!profs.length) return 0;
    const recent = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const byId = new Map(profs.map((p: any) => [p.id, p]));
    const plans: any[] = await SprintPlan.find({ facultyId: { $in: profs.map(p => p.id) } })
        .select('facultyId college collegeFixed status isLocked isSubmitted weekStartDate weekEndDate version hoiReads').lean();
    // same rule as the approvals queue (GET /api/curriculum/sprint-plan?queue=1 → toRead), incl. multi-college plans of this scope only
    return plans.filter(p => planVisibleFor(byId.get(p.facultyId), p) && ['LOCKED', 'LOCKED_AGAIN'].includes(getPlanStatus(p))
        && (p.weekEndDate || p.weekStartDate || '') >= recent
        && !(p.hoiReads || []).some((r: any) => r.byId === a.id && r.version === (p.version || 1))).length;
}

/** All counts for this user (a count that fails is left out — its badge is simply not shown) */
export async function sidebarCounts(a: any): Promise<SidebarCounts> {
    const jobs: Record<string, () => Promise<number>> = { '/announcements': () => announcements(a), '/tickets': () => tickets(a) };
    if (has.hr(a)) {
        jobs['/hr/leave-management'] = () => hrLeaves(a);
        jobs['/hr/wfh-management'] = () => wfh(a);
        jobs['/hr/holiday-approval'] = holidayRequests;
        jobs['/hr/dress-code'] = dressCode;
        jobs['/hr/full-attire'] = fullAttire;
        jobs['/meetings'] = meetings;
        jobs['/hr/salary-management'] = correctionTickets;
        if (!a.hrExecutive) jobs['/hr/reimbursements'] = reimbursements;
    }
    if ((has.manager(a) && a.role !== 'OM') || a.role === 'TL') jobs['/manager/leave-approval'] = () => managerLeaves(a);
    if (['AD', 'FOUNDER'].includes(a.role)) jobs['/manager/responsibility-approvals'] = () => responsibilities(a);
    if (['OM', 'HOI', 'AD', ...CL_CH_ROLES].includes(a.role)) jobs['/academic/verification'] = () => verification(a);
    if (['HOI', 'AD'].includes(a.role)) jobs['/attendance/location-justifications'] = () => locationJustifications(a);
    if (a.role === 'HOI') jobs['/curriculum/sprint-plans'] = () => sprintPlansToRead(a);
    if (has.faculty(a)) jobs['/faculty/lecture-report'] = () => lectureReports(a);

    const out: SidebarCounts = {};
    await Promise.all(Object.entries(jobs).map(async ([path, fn]) => {
        try {
            const n = await fn();
            if (Number.isFinite(n) && n > 0) out[path] = n;
        } catch (e: any) {
            console.error(`[sidebar-counts] ${path}:`, e?.message);
        }
    }));
    return out;
}