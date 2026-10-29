import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { sendManualEmail } from '@/lib/email-management';

export const dynamic = 'force-dynamic';

/**
 * POST { category: "dress_code" | "late_clock_in" | "no_clock_in" | "no_clock_out", relatedRecordId }
 * HR, HR Executive or Founder. Re-checks eligibility, sends once (concurrent clicks → one email), records the result.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r = await sendManualEmail(actor, String(body.category || ''), String(body.relatedRecordId || ''));
        return NextResponse.json(r.ok ? { success: true, message: r.message, row: r.row } : { error: r.error, row: r.row }, { status: r.status });
    } catch (e: any) {
        console.error('[hr/email-management/send]', e?.message);
        return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 });
    }
}