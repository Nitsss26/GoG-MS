import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { hrDecideLeave, adFinalDecideLeave } from '@/lib/leave-decision';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

/**
 * HR: directly approve or reject a pending leave request (no HOI approval needed first).
 * Body: { id: string, action: "approve" | "reject", remarks?: string }
 *
 * This is an additional HR capability. The existing /api/leaves flow is not changed.
 * AD: the same final decision for employees who report directly to the AD (checked on the server);
 *     applyLOP on reject → 2-day loss of pay (as for the manager reject).
 */
export async function PUT(request: Request) {
    try {
        await dbConnect();
        // Session user (also an HR delegate working through Give Access → HR Hub)
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (actor.role === "AD") {
            const { id, action, remarks, applyLOP } = await request.json();
            const r = await adFinalDecideLeave(actor, { id, action, remarks, applyLOP: !!applyLOP });
            if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
            return NextResponse.json(r.leave);
        }
        if (actor.role !== "HR" && actor.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can directly approve or reject leave.' }, { status: 403 });
        }

        const { id, action, remarks } = await request.json();
        // Same decision step as the e-mail "Accept / Reject Leave" links (src/lib/leave-decision.ts)
        const result = await hrDecideLeave(actor, { id, action, remarks });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        const updated = result.leave;
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}