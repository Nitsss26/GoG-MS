import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { canView, profilePayload, applyProfileEdit, ProfileError } from '@/lib/profile-server';

export const dynamic = 'force-dynamic';

/**
 * My Profile → Edit Profile, and HR edits from the Employee Directory (same employee record).
 * GET  ?id=<employeeId>  (default: the logged-in employee)  → profile as the viewer may see it
 * PATCH { id, fields: { key: value }, documents: { key: fileUrl } } → saves only changed, permitted values
 * Employees: own profile only (no employment details, ID, role, performance or attendance). HR / Founder: any employee.
 */
async function actorOrNull() {
    await dbConnect();
    return getSessionUser({ ignoreDelegation: true });
}

export async function GET(req: Request) {
    try {
        const actor = await actorOrNull();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const id = new URL(req.url).searchParams.get('id') || actor.id;
        if (!canView(actor, id)) return NextResponse.json({ error: 'You can only view your own profile.' }, { status: 403 });
        const emp: any = await Employee.findOne({ id, isRemoved: { $ne: true } }).lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        return NextResponse.json(await profilePayload(emp, actor), { headers: { 'Cache-Control': 'no-store' } });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const actor = await actorOrNull();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const b = await req.json().catch(() => ({}));
        const id = String(b.id || actor.id);
        const { changed, employee } = await applyProfileEdit(actor, id, { fields: b.fields, documents: b.documents, ...(b.photoUrl !== undefined ? { photoUrl: b.photoUrl } : {}) });
        return NextResponse.json({ success: true, changed, profile: await profilePayload(employee, actor) });
    } catch (e: any) {
        if (e instanceof ProfileError) return NextResponse.json({ error: e.message }, { status: e.status });
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}