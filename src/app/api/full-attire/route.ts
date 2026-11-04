import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canCapture, canReview, createSubmission, listSubmissions, omProfessors, reviewHistory } from '@/lib/full-attire';
import { DRESS_CODE_REASONS } from '@/lib/dress-code-reasons';

export const dynamic = 'force-dynamic';

/**
 * Full Attire Management.
 *   GET  ?view=om                         OM: own college professors + own submissions (with HR decisions)
 *   GET  ?view=review&status=pending|reviewed|all&q=   HR / HR Executive / Founder: submissions to review
 *   GET  ?history=<professorId>           HR / HR Executive / Founder: one professor's review history
 *   POST { clientKey, imageUrl, capturedAt, order: [professorId…], reupload? }   OM: submit a live capture
 *        (a professor already uploaded today needs reupload: true — today's pending photo is then replaced)
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const sp = new URL(req.url).searchParams;
        if (sp.get('view') === 'om') {
            if (!canCapture(actor)) return NextResponse.json({ error: 'Full Attire capture is for Operations Managers.' }, { status: 403 });
            const [p, mine] = await Promise.all([omProfessors(actor), listSubmissions(actor, { mine: true })]);
            return NextResponse.json({ ...p, submissions: mine });
        }
        if (!canReview(actor)) return NextResponse.json({ error: 'Only HR, HR Executive or Founders can review Full Attire.' }, { status: 403 });
        const hist = sp.get('history');
        if (hist) return NextResponse.json({ history: await reviewHistory(hist.slice(0, 60)) });
        const status = sp.get('status') || 'pending';
        const subs = await listSubmissions(actor, { status, q: (sp.get('q') || '').slice(0, 100) });
        const all = status === 'all' ? subs : await listSubmissions(actor, { status: 'all' });
        return NextResponse.json({
            submissions: subs, reasons: DRESS_CODE_REASONS,
            counts: { pending: all.filter(s => s.pending > 0).length, reviewed: all.filter(s => s.pending === 0).length, all: all.length, pendingProfessors: all.reduce((a, s) => a + s.pending, 0) },
        });
    } catch (e: any) {
        console.error('[full-attire GET]', e?.message);
        return NextResponse.json({ error: 'Could not load Full Attire.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const r = await createSubmission(actor, await req.json().catch(() => ({})));
        if (!r.ok) return NextResponse.json({ error: r.error, ...((r as any).already ? { already: (r as any).already } : {}) }, { status: r.status });
        return NextResponse.json({ success: true, id: r.id, message: r.message });
    } catch (e: any) {
        console.error('[full-attire POST]', e?.message);
        return NextResponse.json({ error: 'Could not submit the photo.' }, { status: 500 });
    }
}