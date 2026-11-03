import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { listForReviewer, listOwn, decide, isReviewerRole } from '@/lib/location-justification';

export const dynamic = 'force-dynamic';

/**
 * Location Mismatch Justifications.
 * GET            → reviewer list (HR / HR Executive / Founder: all; AD: HOIs; HOI: their OMs) ?status=&from=&to=&q=
 * GET ?mine=1    → the logged-in employee's own justifications
 * PUT { id, action: approve|reject, rejectAction, customAction, penaltyAmount, reason, remarks }
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const sp = new URL(req.url).searchParams;
        if (sp.get('mine')) return NextResponse.json({ items: await listOwn(actor.id) });
        if (!isReviewerRole(actor)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const items = await listForReviewer(actor, { status: sp.get('status') || '', from: sp.get('from') || '', to: sp.get('to') || '', q: sp.get('q') || '' });
        if (!items) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        return NextResponse.json({ items, role: actor.role });
    } catch (e: any) {
        console.error('location-justifications GET', e);
        return NextResponse.json({ error: 'Could not load the justifications.' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r: any = await decide(actor, String(body.id || ''), body);
        if (!r.ok) return NextResponse.json({ error: r.error, item: r.item }, { status: r.status });
        return NextResponse.json({ item: r.item });
    } catch (e: any) {
        console.error('location-justifications PUT', e);
        return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });
    }
}