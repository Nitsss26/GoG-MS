import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { SprintPlan, WorkSchedule } from '@/models/Schemas';
import { validateSprintEntries } from '@/lib/time-utils';
import { getSessionUser } from '@/lib/session-user';
import { saveDraft, canViewPlan, canManagePlan } from '@/lib/sprint-plan-workflow';
import { getPlanStatus, PROFESSOR_ROLES } from '@/lib/academic-status';
import { getAcademicScope, professorIfInScope } from '@/lib/academic';

// GET — Fetch sprint plans for a faculty (the professor themself, or a role whose college scope includes them)
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('facultyId');
        const weekStartDate = searchParams.get('weekStartDate');

        if (!facultyId) return NextResponse.json({ error: "facultyId required" }, { status: 400 });

        if (facultyId !== actor.id) {
            if (PROFESSOR_ROLES.includes(actor.role)) {
                return NextResponse.json({ error: 'You can only open your own sprint plan here.' }, { status: 403 });
            }
            const scope = await getAcademicScope(actor);
            if (!(await professorIfInScope(scope, facultyId))) {
                return NextResponse.json({ error: 'This professor is not in your campus or reporting hierarchy.' }, { status: 403 });
            }
        }

        const query: any = { facultyId };
        if (weekStartDate) query.weekStartDate = weekStartDate;

        const plans = await SprintPlan.find(query).sort({ weekStartDate: -1 }).lean();
        // Status for plans saved before the lifecycle existed, and what the viewer may do
        const withStatus = await Promise.all(plans.map(async (p: any) => ({
            ...p,
            status: getPlanStatus(p),
            canManage: await canManagePlan(actor, p),
        })));

        // Fetch WorkSchedule for the given faculty
        let schedules: any[] = [];
        if (facultyId) {
            // Find all schedules for the faculty to account for both specific dates and weekdays (Mon, Tue, etc.)
            const weekEntries = await WorkSchedule.find({
                employeeId: facultyId
            }).sort({ date: 1 }).limit(20);

            schedules = weekEntries;
        }

        return NextResponse.json({ plans: withStatus, schedules });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create or update the logged-in professor's own sprint plan (only while it is not locked)
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { facultyId, weekStartDate, weekEndDate, entries, stream, year } = body;

        if (!weekStartDate || !weekEndDate) {
            return NextResponse.json({ error: "weekStartDate, weekEndDate required" }, { status: 400 });
        }
        if (!PROFESSOR_ROLES.includes(actor.role)) {
            return NextResponse.json({ error: "Only FACULTY/PROFESSOR can create sprint plans" }, { status: 403 });
        }
        // A professor can only write their own plan
        if (facultyId && facultyId !== actor.id) {
            return NextResponse.json({ error: "You can only edit your own sprint plan." }, { status: 403 });
        }

        // Server-side validation
        const validation = validateSprintEntries(entries || []);
        if (!validation.valid) {
            return NextResponse.json({
                error: validation.error,
                invalidIndices: validation.invalidIndices
            }, { status: 400 });
        }
        // Every class must be inside this week
        const outside = (entries || []).findIndex((e: any) => !e.date || e.date < weekStartDate || e.date > weekEndDate);
        if (outside >= 0) {
            return NextResponse.json({ error: `Class ${outside + 1} is not inside this week.`, invalidIndices: [outside] }, { status: 400 });
        }

        const result = await saveDraft(actor, { weekStartDate, weekEndDate, entries: entries || [], stream, year });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        const plan: any = result.plan.toObject ? result.plan.toObject() : result.plan;
        return NextResponse.json({ message: result.message, plan: { ...plan, status: getPlanStatus(plan), canManage: false } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
