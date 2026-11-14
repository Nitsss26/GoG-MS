import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/session';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { recordLogout } from '@/lib/presence';

/**
 * POST /api/auth/logout
 * Clears the session cookie to log the user out.
 */
export async function POST() {
    try {
        // HR → Workforce: this browser goes Offline at once (best effort — never blocks the logout)
        try { await dbConnect(); const actor: any = await getSessionUser({ ignoreDelegation: true }); if (actor) await recordLogout(actor.id); } catch { /* ignore */ }
        const cookieStore = await cookies();
        cookieStore.delete(COOKIE_NAME);

        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
        console.error('Logout error:', error);
        return NextResponse.json({ success: false, error: 'Server error during logout' }, { status: 500 });
    }
}