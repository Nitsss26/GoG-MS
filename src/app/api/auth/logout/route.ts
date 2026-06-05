import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/session';

/**
 * POST /api/auth/logout
 * Clears the session cookie to log the user out.
 */
export async function POST() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete(COOKIE_NAME);

        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
        console.error('Logout error:', error);
        return NextResponse.json({ success: false, error: 'Server error during logout' }, { status: 500 });
    }
}
