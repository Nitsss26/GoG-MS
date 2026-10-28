import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canReview, listJustifications, decideJustification } from '@/lib/late-justification';

export const dynamic = 'force-dynamic';

/**
 * Late Clock-In Justifications — HR and HR Executive have exactly the same access (one backend workflow).
 *   GET ?status=pending|approved|rejected&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   PUT { id, action: "approve" | "reject", reason? }   (reason required to reject)
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canReview(actor)) return NextResponse.json({ error: 'Only HR or HR Executive can view late clock-in justifications.' }, { status: 403 });
        const q = new URL(req.url).searchParams;
        const rows = await listJustifications({ status: q.get('status') || '', from: q.get('from') || '', to: q.get('to') || '' });
        return NextResponse.json({ justifications: rows });
    } catch (e: any) {
        console.error('[hr late-justifications GET]', e?.message);
        return NextResponse.json({ error: 'Could not load the justifications.' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r: any = await decideJustification(actor, String(body.id || ''), String(body.action || ''), body.reason);
        if (!r.ok) return NextResponse.json({ error: r.error, ...(r.justification ? { justification: r.justification } : {}) }, { status: r.status });
        return NextResponse.json({ success: true, justification: r.justification, message: body.action === 'approve' ? 'Justification approved — attendance updated to Normal Clock-In.' : 'Justification rejected.' });
    } catch (e: any) {
        console.error('[hr late-justifications PUT]', e?.message);
        return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });
    }
}