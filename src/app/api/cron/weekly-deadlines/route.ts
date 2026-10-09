import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { runWeeklyDeadlines } from '@/lib/weekly-deadlines';

export const dynamic = 'force-dynamic';

/**
 * Saturday 10:00 AM deadline checks, for a hosting scheduler (Vercel Cron, GitHub Actions, cron-job.org …).
 * Protected by CRON_SECRET:  Authorization: Bearer <CRON_SECRET>   (or header x-cron-secret: <CRON_SECRET>)
 *
 * Optional query (for controlled tests):
 *   at=2026-10-10T10:05:00+05:30   evaluate as if it were that time
 *   force=1                        run for the latest Saturday even if the time is not Saturday ≥ 10:00
 *   dryRun=1                       only list what would be sent
 * Emails are never sent twice for the same deadline (see src/lib/weekly-deadlines.ts).
 */
async function handle(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured on the server.' }, { status: 503 });
    const auth = req.headers.get('authorization') || '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers.get('x-cron-secret') || '');
    const a = Buffer.from(given), b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const atParam = searchParams.get('at');
    const at = atParam ? new Date(atParam) : new Date();
    if (isNaN(at.getTime())) return NextResponse.json({ error: 'Invalid "at" time' }, { status: 400 });

    try {
        await dbConnect();
        const result = await runWeeklyDeadlines({
            at, trigger: 'cron-url', force: searchParams.get('force') === '1', dryRun: searchParams.get('dryRun') === '1',
        });
        return NextResponse.json({ success: true, ...result });
    } catch (e: any) {
        console.error('[cron] weekly deadlines failed:', e?.message);
        return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
    }
}

export const GET = handle;
export const POST = handle;
