import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { sidebarCounts } from '@/lib/sidebar-counts';

export const dynamic = 'force-dynamic';

/**
 * GET — sidebar notification badge counts of the logged-in user: { userId, counts: { "<sidebar path>": n } }.
 * Always the user's own designation (never a delegated hub), worked out on the server from the session.
 */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const counts = await sidebarCounts(actor);
        return NextResponse.json({ userId: actor.id, counts }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e: any) {
        console.error('sidebar-counts GET', e?.message);
        return NextResponse.json({ error: 'Could not load the counts.' }, { status: 500 });
    }
}