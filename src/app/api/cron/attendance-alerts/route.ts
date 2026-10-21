import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { runAttendanceSweep } from '@/lib/attendance-violations';
import { runTicketEscalations } from '@/lib/ticket-emails';

export const dynamic = 'force-dynamic';

/**
 * Missing Clock-Out alerts + email retries + 48-hour ticket reminders, for a hosting scheduler (Vercel Cron, cron-job.org …), every 5–15 minutes.
 * Protected by CRON_SECRET:  Authorization: Bearer <CRON_SECRET>   (or header x-cron-secret: <CRON_SECRET>)
 */
async function handle(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured on the server.' }, { status: 503 });
    const auth = req.headers.get('authorization') || '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers.get('x-cron-secret') || '');
    const a = Buffer.from(given), b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        await dbConnect();
        return NextResponse.json({ success: true, ...(await runAttendanceSweep()), tickets: await runTicketEscalations() });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
    }
}
export const GET = handle;
export const POST = handle;