import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee, Location } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Roles that show up in an HOI's employee/faculty list (same list the HOI portal uses)
const HOI_ASSIGNABLE_ROLES = ["FACULTY", "PROFESSOR", "OM", "MARKETING_TEAM", "TECH_TEAM"];

/**
 * HR: assign / change an employee's location and/or HOI.
 * Body: { employeeId: string, location?: string (Location id), hoiId?: string ("" removes the HOI) }
 *
 * - Location is stored in the existing Employee.location field.
 * - HOI is stored in the existing Employee.reportsTo array, so the HOI portal picks it up
 *   through the reporting relationship it already uses. An employee has at most one HOI:
 *   any previous HOI id is replaced, other reporting managers are kept.
 */
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (session.role !== "HR" && session.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can assign location or HOI.' }, { status: 403 });
        }

        await dbConnect();
        const { employeeId, location, hoiId, attendanceLocations } = await request.json();

        if (!employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }
        if (location === undefined && hoiId === undefined && attendanceLocations === undefined) {
            return NextResponse.json({ error: 'Nothing to assign' }, { status: 400 });
        }

        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const updates: any = {};

        if (location !== undefined) {
            if (location !== "") {
                const loc = await Location.findOne({ id: location });
                if (!loc) {
                    return NextResponse.json({ error: 'Selected location does not exist' }, { status: 400 });
                }
            }
            updates.location = location;
        }

        // HOI / OM only: authorised clock-in / clock-out locations (separate from the Original Location above)
        let locationLogEntry: any = null;
        if (attendanceLocations !== undefined) {
            if (employee.role !== "HOI" && employee.role !== "OM") {
                return NextResponse.json({ error: 'Multiple attendance locations are available for the HOI and OM roles only.' }, { status: 400 });
            }
            if (!Array.isArray(attendanceLocations) || attendanceLocations.some((v: any) => typeof v !== 'string' || !v)) {
                return NextResponse.json({ error: 'attendanceLocations must be a list of location ids.' }, { status: 400 });
            }
            const ids = Array.from(new Set(attendanceLocations as string[]));
            const found = await Location.find({ id: { $in: ids } }).select('id');
            const missing = ids.filter(id => !found.some((l: any) => l.id === id));
            if (missing.length) {
                return NextResponse.json({ error: `Unknown location(s): ${missing.join(', ')}` }, { status: 400 });
            }
            updates.attendanceLocations = ids;
            const before: string[] = Array.isArray(employee.attendanceLocations) ? employee.attendanceLocations : [];
            if (before.length !== ids.length || before.some(id => !ids.includes(id))) {
                const actor: any = await Employee.findById(session.userId).select('id name').lean().catch(() => null);
                locationLogEntry = { at: new Date().toISOString(), by: actor?.id || session.userId || '', byName: actor?.name || '', from: before, to: ids };
            }
        }

        if (hoiId !== undefined) {
            if (!HOI_ASSIGNABLE_ROLES.includes(employee.role)) {
                return NextResponse.json({ error: `An HOI cannot be assigned to role ${employee.role}` }, { status: 400 });
            }
            if (hoiId !== "") {
                const hoi = await Employee.findOne({ id: hoiId, role: "HOI" });
                if (!hoi) {
                    return NextResponse.json({ error: 'Selected HOI does not exist' }, { status: 400 });
                }
            }

            const allHois = await Employee.find({ role: "HOI" }).select('id');
            const hoiIds = new Set(allHois.map((h: any) => h.id));
            const current: string[] = Array.isArray(employee.reportsTo) ? employee.reportsTo : [];
            const otherManagers = current.filter(id => id && !hoiIds.has(id));

            // New HOI first, other managers kept, no duplicates
            updates.reportsTo = Array.from(new Set(hoiId ? [hoiId, ...otherManagers] : otherManagers));
        }

        const updated = await Employee.findOneAndUpdate(
            { id: employeeId },
            { $set: updates, ...(locationLogEntry ? { $push: { attendanceLocationLog: locationLogEntry } } : {}) },
            { new: true }
        );

        const data = updated.toObject();
        delete data.password;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}