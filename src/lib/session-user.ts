import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { Employee } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME, SessionPayload } from '@/lib/session';

/**
 * Resolve the logged-in user from the session cookie (server side only).
 * Call after dbConnect(). Returns null when there is no valid session.
 *
 * The session stores the Mongo _id (or the employee id as a fallback), so the
 * employee record is looked up to get the real employee id and name.
 */
export async function getSessionUser(): Promise<{ session: SessionPayload; id: string; name: string; role: string; employee: any } | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie?.value) return null;
    const session = verifySessionToken(sessionCookie.value);
    if (!session) return null;

    let employee: any = null;
    if (mongoose.isValidObjectId(session.userId)) employee = await Employee.findById(session.userId);
    if (!employee) employee = await Employee.findOne({ id: session.userId });
    if (!employee) employee = await Employee.findOne({ email: session.email });

    // No active employee record (deleted or removed from the portal) => not logged in
    if (!employee) return null;
    // Role changed by HR after this login => log in again
    if (employee.role !== session.role) return null;

    return {
        session,
        id: employee?.id || session.userId,
        name: employee?.name || session.email,
        role: session.role,
        employee,
    };
}
