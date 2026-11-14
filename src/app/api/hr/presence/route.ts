import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { presenceFor, PRESENCE_WINDOW_MS } from '@/lib/presence';

export const dynamic = 'force-dynamic';

/**
 * GET [?id=EMPID] — OMS Status / Last Login / Last Seen (HR and HR Executive only: Workforce).
 * Employees without a row have never logged in since tracking started. Only timestamps are returned.
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HR') return NextResponse.json({ error: 'Only HR can view OMS presence.' }, { status: 403 });
        const id = new URL(req.url).searchParams.get('id');
        const rows = await presenceFor(id ? [id] : undefined);
        return NextResponse.json({ now: new Date().toISOString(), windowMs: PRESENCE_WINDOW_MS, rows }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e: any) {
        console.error('hr presence GET', e?.message);
        return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
    }
}