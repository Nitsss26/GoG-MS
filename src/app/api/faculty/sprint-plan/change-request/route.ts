import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { performPlanAction } from '@/lib/sprint-plan-workflow';

/**
 * Kept for compatibility. The change request is now the "Request Unlock" step of the sprint plan lifecycle
 * (src/lib/sprint-plan-workflow.ts), which notifies HOI + CL + CH + AD.
 */

// POST — Professor requests an unlock of their locked sprint plan
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { weekStartDate, reason, comment } = await req.json();

        if (!weekStartDate || !reason) {
            return NextResponse.json({ error: "weekStartDate and reason required" }, { status: 400 });
        }

        const plan = await SprintPlan.findOne({ facultyId: actor.id, weekStartDate });
        if (!plan) return NextResponse.json({ error: "Sprint plan not found" }, { status: 404 });

        const result = await performPlanAction(actor, String(plan._id), 'request_unlock', { reason, comment });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ message: result.message, plan: result.plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — HOI / CL / CH / AD approves (unlocks) or rejects the pending request
export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { facultyId, weekStartDate, action, note } = await req.json();

        if (!facultyId || !weekStartDate || !action) {
            return NextResponse.json({ error: "facultyId, weekStartDate, action required" }, { status: 400 });
        }

        const plan = await SprintPlan.findOne({ facultyId, weekStartDate });
        if (!plan) return NextResponse.json({ error: "Sprint plan not found" }, { status: 404 });

        const result = await performPlanAction(actor, String(plan._id), action === 'approve' ? 'unlock' : 'reject_unlock', { note });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ message: result.message, plan: result.plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
