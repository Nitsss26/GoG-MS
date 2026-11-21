import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canCapture, canReview, captureList, createSubmission, listSubmissions, reviewHistory, notUploaded } from '@/lib/full-attire';
import { DRESS_CODE_REASONS } from '@/lib/dress-code-reasons';

export const dynamic = 'force-dynamic';

/**
 * Full Attire Management.
 *   GET  ?view=om                         OM: own college professors + own submissions (with HR decisions)
 *                                         (also a Professor / HOI with an active OM Given Access grant: the granting
 *                                          OM's professors + themselves; `delegated` lists the grants)
 *   GET  ?view=review&status=pending|reviewed|all&q=   HR / HR Executive / Founder: submissions to review
 *   GET  ?history=<professorId>           HR / HR Executive / Founder: one professor's review history
 *   GET  ?view=review&...&date=YYYY-MM-DD  the same, only submissions of that day (IST)
 *   GET  ?view=not-uploaded&date=YYYY-MM-DD   HR: OMs + their professors with no Full Attire photo that day
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
            const ctx = await captureList(actor);
            if (!ctx) return NextResponse.json({ error: canCapture(actor) ? 'Full Attire is not available.' : 'Full Attire capture is for Operations Managers. If your OM gave you access, it is not active right now.' }, { status: 403 });
            const mine = await listSubmissions(actor, { mine: true });
            return NextResponse.json({
                ...ctx.list, submissions: mine,
                // OM Given Access: which grants are in use (shown on the page) — absent for an OM
                ...(ctx.delegated ? { delegated: { grants: ctx.delegated.grants.map(g => ({ id: g.id, grantedByName: g.grantedByName, startDate: g.startDate, endDate: g.endDate })) } } : {}),
            });
        }
        if (!canReview(actor)) return NextResponse.json({ error: 'Only HR, HR Executive or Founders can review Full Attire.' }, { status: 403 });
        const hist = sp.get('history');
        if (hist) return NextResponse.json({ history: await reviewHistory(hist.slice(0, 60)) });
        if (sp.get('view') === 'not-uploaded') {
            const date = String(sp.get('date') || '');
            return NextResponse.json({ date, people: await notUploaded(date) });
        }
        const status = sp.get('status') || 'pending';
        const date = String(sp.get('date') || '');
        const subs = await listSubmissions(actor, { status, q: (sp.get('q') || '').slice(0, 100), date });
        const all = status === 'all' ? await listSubmissions(actor, { status: 'all', date }) : await listSubmissions(actor, { status: 'all', date });
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