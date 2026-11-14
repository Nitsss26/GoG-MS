import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { recordHeartbeat } from '@/lib/presence';

export const dynamic = 'force-dynamic';

/**
 * POST — heartbeat of the logged-in employee (an open, visible OMS tab, about every 60 s).
 * The employee comes only from the session cookie (an expired / invalid session gets 401 and stops counting as Active).
 * Nothing from the browser is stored; the time is the server's.
 */
export async function POST() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await recordHeartbeat(actor.id);
        return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e: any) {
        console.error('presence heartbeat', e?.message);
        return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
    }
}