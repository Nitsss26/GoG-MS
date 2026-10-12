import { cookies, headers } from 'next/headers';
import { resolveDelegation } from '@/lib/access-control';
import { ACCESS_HEADER } from '@/lib/access-hubs';
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
export async function getSessionUser(opts: { ignoreDelegation?: boolean } = {}): Promise<{ session: SessionPayload; id: string; name: string; role: string; employee: any; baseRole?: string; hrExecutive?: boolean; delegation?: import('@/lib/access-control').Delegation } | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie?.value) return null;
    const session = verifySessionToken(sessionCookie.value);
    if (!session) return null;

    let employee: any = null;
    if (mongoose.isValidObjectId(session.userId)) employee = await Employee.findById(session.userId);
    if (!employee) employee = await Employee.findOne({ id: session.userId });
    const storedRole = session.actualRole || session.role; // HR Executive: HR_EXECUTIVE on the record, HR permissions
    if (!employee) employee = await Employee.findOne({ email: session.email, role: storedRole });

    // No active employee record (deleted or removed from the portal) => not logged in
    if (!employee) return null;
    // Role changed by HR after this login => log in again
    if (employee.role !== storedRole) return null;

    const base = {
        session,
        id: employee?.id || session.userId,
        name: employee?.name || session.email,
        role: session.role,
        employee,
        ...(session.hrExecutive ? { hrExecutive: true } : {}),
    };
    if (opts.ignoreDelegation) return base as any;

    // Give Access: a page inside a delegated hub asks to act with that hub's access (checked against the DB)
    let header: string | null = null;
    try { header = (await headers()).get(ACCESS_HEADER); } catch { header = null; }
    const delegated = header ? await resolveDelegation(base, header) : null;
    return (delegated || base) as any;
}