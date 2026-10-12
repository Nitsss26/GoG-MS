import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';

/**
 * GET /api/auth/session
 * Validates the current session cookie and returns user data.
 * No sensitive data (passwords, etc.) is returned to the client.
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);

        if (!sessionCookie?.value) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const payload = verifySessionToken(sessionCookie.value);
        if (!payload) {
            return NextResponse.json({ authenticated: false, error: 'Session expired or invalid' }, { status: 401 });
        }

        // Fetch fresh user data from database (never trust the token for full data)
        await dbConnect();
        // The record of the designation this session was opened with (one email may hold several)
        const mongoose = (await import('mongoose')).default;
        let employee: any = mongoose.isValidObjectId(payload.userId) ? await Employee.findById(payload.userId) : null;
        if (!employee) employee = await Employee.findOne({ id: payload.userId });
        if (!employee) {
            const escaped = String(payload.email || '').replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
            employee = await Employee.findOne({ email: { $regex: new RegExp(`^${escaped}$`, 'i') }, role: payload.actualRole || payload.role });
        }
        if (employee && employee.role !== (payload.actualRole || payload.role)) employee = null;

        if (!employee) {
            return NextResponse.json({ authenticated: false, error: 'Account not found' }, { status: 404 });
        }

        // Return sanitized user data — NEVER include password
        const userData = employee.toObject();
        delete userData.password;

        return NextResponse.json({
            authenticated: true,
            user: {
                ...userData,
                id: userData.employeeId || userData.id,
            }
        });
    } catch (error: any) {
        console.error('Session validation error:', error);
        return NextResponse.json({ authenticated: false, error: 'Server error' }, { status: 500 });
    }
}