import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, professorsInScope, selectableColleges, nowISO } from '@/lib/academic';
import { performPlanAction, canManagePlan } from '@/lib/sprint-plan-workflow';
import { getPlanStatus, CL_CH_ROLES, PROFESSOR_ROLES } from '@/lib/academic-status';

export const dynamic = 'force-dynamic';

/**
 * Campus sprint plans for the timetable grid.
 * Only plans of professors inside the viewer's college scope are returned (Module 24);
 * drafts are private to their professor until submitted.
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const weekStartDate = searchParams.get('weekStartDate');
        const campus = searchParams.get('campus');
        const facultyId = searchParams.get('facultyId');

        const scope = await getAcademicScope(actor);
        const faculties = await professorsInScope(scope, campus);
        const facultyMap = new Map<string, any>();
        faculties.forEach((f: any) => facultyMap.set(f.id, f));

        const ids = Array.from(facultyMap.keys()).filter(id => !facultyId || id === facultyId);
        const query: any = { facultyId: { $in: ids } };
        if (weekStartDate) query.weekStartDate = weekStartDate;

        const rawPlans = await SprintPlan.find(query).sort({ weekStartDate: -1 }).lean();
        const visible = rawPlans.filter((p: any) => getPlanStatus(p) !== 'DRAFT' || p.facultyId === actor.id);
        const plans = await Promise.all(visible.map(async (p: any) => ({
            ...p,
            status: getPlanStatus(p),
            canManage: await canManagePlan(actor, p),
        })));

        // Flatten entries for the campus timetable grid
        const allEntries: any[] = [];
        plans.forEach((plan: any) => {
            const fac = facultyMap.get(plan.facultyId);
            const planCollege = fac?.location || plan.college || "Main Campus";
            (plan.entries || []).forEach((e: any) => {
                allEntries.push({
                    ...e,
                    facultyId: plan.facultyId,
                    facultyName: plan.facultyName || fac?.name || "Professor",
                    college: planCollege,
                    location: planCollege,
                    isLocked: plan.isLocked,
                    planStatus: plan.status,
                    isVerifiedByCL: plan.isVerifiedByCL,
                    clRemarks: plan.clRemarks
                });
            });
        });

        return NextResponse.json({
            success: true,
            plans,
            allEntries,
            faculties: PROFESSOR_ROLES.includes(actor.role) ? faculties.map((f: any) => ({ id: f.id, name: f.name, location: f.location })) : faculties,
            colleges: await selectableColleges(scope),
            orgWide: scope.orgWide,
        });
    } catch (error: any) {
        console.error("Curriculum Sprint Plan GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Lock / unlock / verify plans.
 * action: "lock" | "VERIFY_AND_LOCK_PLAN" | "unlock" | "UNLOCK_PLAN" | "reject_unlock" | "verify"  (with planId)
 *         "VERIFY_AND_LOCK_CAMPUS" | "UNLOCK_CAMPUS"                                             (with campus + weekStartDate)
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { planId, campus, weekStartDate, clRemarks, note } = body;
        const action = String(body.action || '');
        const isClCh = CL_CH_ROLES.includes(actor.role);

        // CL/CH "verified" flag (existing feature) — recorded together with a lock by CL/CH
        const markVerified = async (id: any) => {
            if (!isClCh) return;
            const set: any = { isVerifiedByCL: true, verifiedBy: actor.id, verifiedByName: actor.name, verifiedAt: nowISO() };
            if (clRemarks) set.clRemarks = clRemarks;
            await SprintPlan.updateOne({ _id: id }, { $set: set });
        };

        if (planId) {
            if (action === 'verify') {
                const plan = await SprintPlan.findById(planId).catch(() => null);
                if (!plan) return NextResponse.json({ error: 'Sprint plan not found' }, { status: 404 });
                if (!isClCh || !(await canManagePlan(actor, plan))) return NextResponse.json({ error: 'Only CL / CH of this college can verify.' }, { status: 403 });
                await markVerified(plan._id);
                return NextResponse.json({ success: true, plan: await SprintPlan.findById(planId) });
            }
            const map: Record<string, string> = { lock: 'lock', VERIFY_AND_LOCK_PLAN: 'lock', unlock: 'unlock', UNLOCK_PLAN: 'unlock', reject_unlock: 'reject_unlock' };
            const step = map[action];
            if (!step) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
            const result = await performPlanAction(actor, String(planId), step, { note: note || clRemarks });
            if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
            if (step === 'lock') await markVerified(result.plan._id);
            return NextResponse.json({ success: true, message: result.message, plan: await SprintPlan.findById(planId) });
        }

        if ((action === 'VERIFY_AND_LOCK_CAMPUS' || action === 'UNLOCK_CAMPUS' || action === 'lock' || action === 'unlock') && campus && weekStartDate) {
            const scope = await getAcademicScope(actor);
            const faculties = await professorsInScope(scope, campus);
            const plans = await SprintPlan.find({ weekStartDate, facultyId: { $in: faculties.map((f: any) => f.id) } });
            const locking = action === 'VERIFY_AND_LOCK_CAMPUS' || action === 'lock';
            let done = 0; const skipped: string[] = [];
            for (const p of plans) {
                const st = getPlanStatus(p);
                const eligible = locking ? ['SUBMITTED', 'RESUBMITTED'].includes(st) : ['LOCKED', 'LOCKED_AGAIN', 'UNLOCK_REQUESTED'].includes(st);
                if (!eligible) { skipped.push(`${p.facultyName} (${st})`); continue; }
                const r = await performPlanAction(actor, String(p._id), locking ? 'lock' : 'unlock', { note: clRemarks });
                if (r.ok) { done++; if (locking) await markVerified(p._id); }
                else skipped.push(`${p.facultyName}: ${r.error}`);
            }
            return NextResponse.json({ success: true, modifiedCount: done, skipped });
        }

        return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
    } catch (error: any) {
        console.error("Curriculum Sprint Plan POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
