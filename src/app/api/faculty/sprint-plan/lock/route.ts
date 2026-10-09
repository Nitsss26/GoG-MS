import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { performPlanAction } from '@/lib/sprint-plan-workflow';

// POST — Lock a submitted sprint plan (HOI / CL / CH / AD of the professor's college)
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { facultyId, weekStartDate } = await req.json();

        if (!facultyId || !weekStartDate) {
            return NextResponse.json({ error: "facultyId and weekStartDate required" }, { status: 400 });
        }

        const plan = await SprintPlan.findOne({ facultyId, weekStartDate });
        if (!plan) return NextResponse.json({ error: "Sprint plan not found" }, { status: 404 });

        const result = await performPlanAction(actor, String(plan._id), 'lock');
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ message: result.message, plan: result.plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
