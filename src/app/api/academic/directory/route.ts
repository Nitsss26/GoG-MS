import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { Employee, Location, SprintPlan, LectureReport } from '@/models/Schemas';
import {
    getAcademicScope, professorsInScope, scopeAllowsProfessor, zonedNow, mondayOf, addDays, isValidYmd,
} from '@/lib/academic';
import { buildClassList } from '@/lib/class-record-workflow';
import {
    PLAN_AUTHORITY_ROLES, PROFESSOR_ROLES, CL_CH_ROLES, getPlanStatus, PLAN_STATUS_LABEL, planApproval,
    FINAL_PENDING_CLASS_STATUSES, SUBMITTED_PLAN_STATUSES, LOCKED_PLAN_STATUSES,
} from '@/lib/academic-status';

export const dynamic = 'force-dynamic';

const INACTIVE = /inactive|terminated|resigned|exited|relieved/i;
const active = (e: any) => !INACTIVE.test(String(e?.status || ''));

/**
 * GET /api/academic/directory?week=YYYY-MM-DD
 * Organisation-wide academic directory for the CL / CH Portal and the AD Portal (HOI gets the same view, scoped).
 * Everything is read from the existing collections (Employee, Location, SprintPlan, LectureReport) and filtered
 * on the server by the caller's academic scope — CL / CH / AD / Founder are organisation-wide, HOI is limited
 * to its own campus + appointed professors. No confidential HR fields are returned.
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!PLAN_AUTHORITY_ROLES.includes(actor.role)) return NextResponse.json({ error: 'The academic directory is available to HOI, CL, CH, AD and Founder.' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const reqWeek = searchParams.get('week');
        const week = mondayOf(isValidYmd(reqWeek) ? reqWeek : zonedNow().ymd);
        const weekEnd = addDays(week, 6);

        const scope = await getAcademicScope(actor);
        const isAdmin = ['AD', 'FOUNDER'].includes(actor.role) && !actor.delegation;

        const locations: any[] = await Location.find({}).select('id name shortName').lean();
        const campusOf = (v?: string) => {
            if (!v) return null;
            const l = locations.find(x => [x.id, x.name, x.shortName].includes(v));
            return l ? { id: String(l.id), name: String(l.name) } : { id: v, name: v };
        };

        // ── people (only the fields the academic views need) ──
        const fields = 'id name role designation location reportsTo status';
        const profs: any[] = (await professorsInScope(scope)).filter(active);
        const profIds = profs.map(p => p.id);
        const profFull: any[] = await Employee.find({ id: { $in: profIds } }).select(fields).lean();
        const profById = new Map(profFull.map(p => [p.id, p]));

        let hois: any[]; let oms: any[];
        if (scope.orgWide) {
            hois = (await Employee.find({ role: 'HOI' }).select(fields).lean()).filter(active);
            oms = (await Employee.find({ role: 'OM' }).select(fields).lean()).filter(active);
        } else {
            // HOI: itself + OMs of its campus(es) or appointed under it
            hois = (await Employee.find({ id: actor.id, role: 'HOI' }).select(fields).lean());
            oms = (await Employee.find({ role: 'OM', $or: [{ location: { $in: scope.keys } }, { reportsTo: actor.id }] }).select(fields).lean()).filter(active);
        }
        const clchPeople: any[] = isAdmin ? (await Employee.find({ role: { $in: CL_CH_ROLES } }).select(fields).lean()).filter(active) : [];
        const hoiById = new Map(hois.map(h => [h.id, h]));
        const hoisOf = (e: any) => (e?.reportsTo || []).filter((id: string) => hoiById.has(id)).map((id: string) => ({ id, name: hoiById.get(id).name }));

        // ── this week's sprint plans and classes ──
        const plans: any[] = await SprintPlan.find({ facultyId: { $in: profIds }, weekStartDate: week })
            .select('facultyId facultyName weekStartDate weekEndDate status isLocked entries approval lockedById lockedByName lockedByRole lockedAt lockedBy submittedAt resubmittedAt').lean();
        const planByProf = new Map(plans.map(p => [p.facultyId, p]));
        const classes: any[] = profs.length ? await buildClassList(profs, week, weekEnd, { includePlanned: true }) : [];
        const classesByProf = new Map<string, any[]>();
        classes.forEach(c => { if (!classesByProf.has(c.facultyId)) classesByProf.set(c.facultyId, []); classesByProf.get(c.facultyId)!.push(c); });

        const classStats = (list: any[]) => {
            const st = (c: any) => c.pipelineStatus;
            const submitted = list.filter(c => !c.virtual && st(c) !== 'PENDING_PROFESSOR');
            const withAtt = submitted.filter(c => Number(c.totalStudents) > 0);
            return {
                scheduled: list.length,
                submitted: submitted.length,
                pendingProfessor: list.filter(c => st(c) === 'PENDING_PROFESSOR').length,
                pendingOM: list.filter(c => st(c) === 'PENDING_OM').length,
                pendingFinal: list.filter(c => FINAL_PENDING_CLASS_STATUSES.includes(st(c))).length,
                completed: list.filter(c => st(c) === 'COMPLETED').length,
                reverted: list.filter(c => ['OM_REVERTED', 'CL_CH_REVERTED'].includes(st(c))).length,
                attendancePct: withAtt.length ? Math.round(withAtt.reduce((a, c) => a + Math.min(1, Number(c.numberOfAttendees || 0) / Number(c.totalStudents)), 0) / withAtt.length * 100) : null,
                notesSubmitted: submitted.filter(c => !c.notesMissing && (c.lectureNotes?.notesUrl || c.lectureNotes?.notesContent)).length,
                photos: submitted.filter(c => c.classPhotoUrl).length,
                notesMissing: submitted.filter(c => c.notesMissing).length,
                assignments: submitted.filter(c => c.assignment?.hasAssignment).length,
            };
        };
        const verificationStatus = (s: ReturnType<typeof classStats>) =>
            !s.scheduled ? 'No Classes'
                : s.reverted ? 'Reverted'
                    : s.pendingOM ? 'Pending OM'
                        : s.pendingFinal ? 'Pending Final'
                            : s.completed && s.completed === s.submitted && !s.pendingProfessor ? 'Completed'
                                : s.completed ? 'In Progress' : 'Not Started';

        const planView = (p: any) => {
            if (!p) return null;
            const status = getPlanStatus(p);
            return {
                _id: String(p._id), status, statusLabel: PLAN_STATUS_LABEL[status] || status,
                classes: (p.entries || []).length, approval: planApproval(p),
                submittedAt: p.resubmittedAt || p.submittedAt || null,
            };
        };

        const professors = profs.map(p => {
            const full = profById.get(p.id) || p;
            const s = classStats(classesByProf.get(p.id) || []);
            const campus = campusOf(full.location);
            return {
                id: p.id, name: p.name, designation: full.designation || 'Professor',
                campus: campus?.name || 'Not Assigned', campusId: campus?.id || '',
                hois: hoisOf(full),
                plan: planView(planByProf.get(p.id)),
                classes: s, verificationStatus: verificationStatus(s),
                canManage: scope.orgWide || scopeAllowsProfessor(scope, p.id, full.location),
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const profsUnder = (hoiId: string) => professors.filter(p => p.hois.some((h: any) => h.id === hoiId));
        const hoiRows = hois.map(h => {
            const mine = profsUnder(h.id);
            const done = mine.reduce((a, p) => a + p.classes.completed, 0);
            const sched = mine.reduce((a, p) => a + p.classes.scheduled, 0);
            return {
                id: h.id, name: h.name, designation: h.designation || 'HOI', campus: campusOf(h.location)?.name || 'Not Assigned',
                professors: mine.length,
                oms: oms.filter(o => (o.reportsTo || []).includes(h.id)).length,
                activePlans: mine.filter(p => p.plan && p.plan.status !== 'DRAFT').length,
                pendingApprovals: mine.filter(p => p.plan && ['SUBMITTED', 'RESUBMITTED', 'UNLOCK_REQUESTED'].includes(p.plan.status)).length,
                pendingVerifications: mine.reduce((a, p) => a + p.classes.pendingOM + p.classes.pendingFinal, 0),
                progressPct: sched ? Math.round(done / sched * 100) : null,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const omRows = oms.map(o => ({
            id: o.id, name: o.name, designation: o.designation || 'Operation Manager', campus: campusOf(o.location)?.name || 'Not Assigned',
            hois: hoisOf(o),
            pendingOM: professors.filter(p => p.campusId && p.campusId === campusOf(o.location)?.id && p.hois.some((h: any) => (o.reportsTo || []).includes(h.id)))
                .reduce((a, p) => a + p.classes.pendingOM, 0),
        })).sort((a, b) => a.name.localeCompare(b.name));

        // ── CL / CH management (AD / Founder): who approved / verified / reverted what ──
        let clch: any[] | null = null;
        if (isAdmin) {
            const ids = clchPeople.map(c => c.id);
            // plain finds + counting here (works on every MongoDB-compatible backend)
            const [approvedPlans, recentPlans, finalRecords] = await Promise.all([
                SprintPlan.find({ $or: [{ 'approval.byId': { $in: ids } }, { lockedById: { $in: ids } }] }).select('approval lockedById').lean(),
                SprintPlan.find({ 'history.by': { $in: ids } }).select('facultyName weekStartDate history').sort({ updatedAt: -1 }).limit(300).lean(),
                LectureReport.find({ 'finalVerification.by': { $in: ids } }).select('facultyName date courseName finalVerification').sort({ updatedAt: -1 }).limit(500).lean(),
            ]);
            const approvalsBy = (id: string) => approvedPlans.filter((p: any) => (p.approval?.byId || p.lockedById) === id).length;
            const finalBy = (id: string, st: string) => finalRecords.filter((r: any) => r.finalVerification?.by === id && r.finalVerification?.status === st).length;
            const recentClasses = finalRecords;
            const orgPending = professors.reduce((a, p) => a + p.classes.pendingFinal, 0)
                + professors.filter(p => p.plan && ['SUBMITTED', 'RESUBMITTED', 'UNLOCK_REQUESTED'].includes(p.plan.status)).length;
            clch = clchPeople.map(c => {
                const history = [
                    ...recentPlans.flatMap((p: any) => (p.history || []).filter((h: any) => h.by === c.id && h.action !== 'Created' && h.action !== 'Modified')
                        .map((h: any) => ({ kind: 'Sprint Plan', what: `${h.action} · ${p.facultyName} · week ${p.weekStartDate}`, at: h.at }))),
                    ...recentClasses.filter((r: any) => r.finalVerification?.by === c.id)
                        .map((r: any) => ({ kind: 'Class Record', what: `${r.finalVerification.status === 'VERIFIED' ? 'Final verification' : 'Reverted'} · ${r.facultyName} · ${r.courseName || ''} ${r.date}`, at: r.finalVerification.at })),
                ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10);
                return {
                    id: c.id, name: c.name, role: c.role, designation: c.role === 'CURRICULUM_HEAD' ? 'CH' : 'CL',
                    jobTitle: c.designation || '', campus: campusOf(c.location)?.name || 'All Campuses',
                    approvals: approvalsBy(c.id), verifications: finalBy(c.id, 'VERIFIED'), reverts: finalBy(c.id, 'REVERTED'),
                    pending: orgPending, lastActivity: history[0]?.at || null, history,
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
        }

        const allPlans = professors.map(p => p.plan).filter(Boolean) as any[];
        const sum = (k: keyof ReturnType<typeof classStats>) => professors.reduce((a, p) => a + (Number(p.classes[k]) || 0), 0);
        const campusIds = new Set([...professors.map(p => p.campusId), ...hois.map(h => campusOf(h.location)?.id), ...oms.map(o => campusOf(o.location)?.id)].filter(Boolean));
        const summary = {
            hois: hoiRows.length,
            clch: isAdmin ? (clch || []).length : (await Employee.countDocuments({ role: { $in: CL_CH_ROLES }, status: { $not: INACTIVE } })),
            professors: professors.length,
            oms: omRows.length,
            campuses: scope.orgWide ? locations.length : campusIds.size,
            sprintPlans: allPlans.filter(p => SUBMITTED_PLAN_STATUSES.includes(p.status)).length,
            pendingApprovals: allPlans.filter(p => ['SUBMITTED', 'RESUBMITTED', 'UNLOCK_REQUESTED'].includes(p.status)).length,
            lockedPlans: allPlans.filter(p => LOCKED_PLAN_STATUSES.includes(p.status)).length,
            scheduledClasses: sum('scheduled'),
            completedClasses: sum('submitted'),
            pendingOM: sum('pendingOM'),
            pendingFinal: sum('pendingFinal'),
            completedVerifications: sum('completed'),
        };

        return NextResponse.json({
            role: actor.role, orgWide: scope.orgWide, isAdmin, week, weekEnd,
            campuses: (scope.orgWide ? locations.map(l => ({ id: String(l.id), name: String(l.name) })) : Array.from(campusIds).map(id => campusOf(String(id))!)).sort((a, b) => a.name.localeCompare(b.name)),
            summary, professors, hois: hoiRows, oms: omRows, clch,
        });
    } catch (error: any) {
        console.error('Academic directory error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
