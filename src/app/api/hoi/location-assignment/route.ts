import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { reporteeTree } from '@/lib/academic';

export const dynamic = 'force-dynamic';

/**
 * HOI → Work Location → "Location Assignment".
 * The HOI sets the Original Location (Employee.location) of the people under them in the reporting
 * hierarchy (faculty, OMs, other staff and anyone under those, at any depth) — the same field HR sets
 * from HR → Work Location → Location Assignment. Scope is enforced here on the server.
 *
 * GET → { employees, locations }   (only the HOI's own reportees; active locations from the Locations database)
 * PUT → { employeeId, location }   (location = Location id, "" removes it)
 */
async function hoiOrError() {
    const actor = await getSessionUser();
    if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (actor.role !== 'HOI') return { error: NextResponse.json({ error: 'Only an HOI can use this page.' }, { status: 403 }) };
    return { actor };
}

const pub = (e: any) => ({
    id: e.id, name: e.name, role: e.role, designation: e.designation || '', location: e.location || '',
    reportsTo: Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : [],
});

export async function GET() {
    try {
        await dbConnect();
        const { actor, error } = await hoiOrError();
        if (error) return error;
        const tree = await reporteeTree(actor!.id);
        const ids = tree.filter((e: any) => e.status !== 'Inactive').map((e: any) => e.id);
        const [emps, locations, hois] = await Promise.all([
            ids.length ? Employee.find({ id: { $in: ids } }).select('id name role designation location reportsTo').lean() : [],
            Location.find({ active: { $ne: false }, isDeleted: { $ne: true } }).lean(),
            Employee.find({ role: 'HOI' }).select('id name').lean(),
        ]);
        return NextResponse.json({
            employees: (emps as any[]).map(pub),
            locations,
            hois: (hois as any[]).map(h => ({ id: h.id, name: h.name })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const { actor, error } = await hoiOrError();
        if (error) return error;
        const { employeeId, location } = await req.json().catch(() => ({}));
        if (!employeeId || typeof employeeId !== 'string') return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        if (typeof location !== 'string') return NextResponse.json({ error: 'Location is required' }, { status: 400 });

        // Only people under this HOI in the reporting hierarchy
        const tree = await reporteeTree(actor!.id);
        if (!tree.some((e: any) => e.id === employeeId)) {
            return NextResponse.json({ error: 'This employee is not under you in the reporting hierarchy.' }, { status: 403 });
        }
        if (location !== '') {
            const loc: any = await Location.findOne({ id: location }).lean();
            if (!loc || loc.active === false || loc.isDeleted) return NextResponse.json({ error: 'Selected location does not exist' }, { status: 400 });
        }
        const updated: any = await Employee.findOneAndUpdate(
            { id: employeeId },
            { $set: { location } },
            { new: true },
        ).lean();
        if (!updated) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        return NextResponse.json({ success: true, employee: pub(updated) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}