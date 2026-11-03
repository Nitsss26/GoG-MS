import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { decide } from '@/lib/full-attire';

export const dynamic = 'force-dynamic';

/**
 * POST { reviewId, action: "accept" | "reject", reasons?, other?, explanation?, evidenceUrl?, remarks? }
 * HR / HR Executive / Founder decide ONE professor of a submission. No email is sent here — the email is
 * prepared in Email Management → Full Attire and sent by hand.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r = await decide(actor, String(body?.reviewId || '').slice(0, 120), body);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ success: true, review: r.review, message: r.message });
    } catch (e: any) {
        console.error('[full-attire review]', e?.message);
        return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });
    }
}