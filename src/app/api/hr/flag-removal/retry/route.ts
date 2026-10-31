import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { FlagRemoval } from '@/models/SalaryModule';
import { canRemoveFlags, sendFlagRemovalEmail } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/** POST { removalId } — send the flag-removal email again (only when the last attempt failed) */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canRemoveFlags(actor)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const { removalId } = await req.json().catch(() => ({}));
        const r: any = await FlagRemoval.findOne({ id: String(removalId || '') }).select('emailStatus').lean();
        if (!r) return NextResponse.json({ error: 'Removal not found.' }, { status: 404 });
        if (r.emailStatus === 'SENT') return NextResponse.json({ error: 'The email was already sent.' }, { status: 409 });
        const res = await sendFlagRemovalEmail(String(removalId), actor.id);
        return NextResponse.json({ success: !!res.ok, emailStatus: res.status, message: res.ok ? 'Email sent.' : 'The email could not be sent. Try again later.' }, { status: res.ok ? 200 : 502 });
    } catch (e: any) {
        console.error('flag-removal retry', e);
        return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 });
    }
}