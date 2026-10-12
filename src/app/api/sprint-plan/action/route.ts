import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { performPlanAction } from '@/lib/sprint-plan-workflow';

export const dynamic = 'force-dynamic';

/**
 * Sprint plan lifecycle actions.
 * Body: { planId, action: "submit" | "lock" | "return" | "request_unlock" | "unlock" | "reject_unlock", reason?, comment?, note? }
 * Role and college checks are done in performPlanAction (src/lib/sprint-plan-workflow.ts).
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { planId, action, reason, comment, note } = await req.json().catch(() => ({}));
        if (!planId || !action) return NextResponse.json({ error: 'planId and action are required' }, { status: 400 });

        const result = await performPlanAction(actor, String(planId), String(action), { reason, comment, note });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, message: result.message, plan: result.plan });
    } catch (error: any) {
        console.error('Sprint plan action error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
