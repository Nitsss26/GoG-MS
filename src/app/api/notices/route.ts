import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Notice, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope } from '@/lib/academic';

/** Location ids a user belongs to: Original Location, HOI authorised attendance locations, colleges an HOI manages */
async function myCollegeIds(actor: any): Promise<Set<string>> {
    const ids = new Set<string>();
    const emp: any = actor?.employee;
    if (emp?.location) {
        const loc: any = await Location.findOne({ $or: [{ id: emp.location }, { name: emp.location }, { shortName: emp.location }] }).select('id').lean();
        ids.add(loc?.id || emp.location);
    }
    (emp?.attendanceLocations || []).forEach((x: string) => ids.add(x));
    if (actor?.role === 'HOI') (await getAcademicScope({ role: 'HOI', employee: emp })).colleges.forEach(c => ids.add(c.id));
    return ids;
}

/**
 * Announcements. Existing announcements (no college scope) are visible to everyone, as before.
 * College-scoped announcements (e.g. an HOI holiday announcement) are visible to that college's employees,
 * the HOI who manages it, its author, and HR / Founder / AD.
 */
export async function GET() {
    try {
        await dbConnect();
        const notices: any[] = await Notice.find({}).sort({ createdAt: -1 }).lean();
        const actor: any = await getSessionUser().catch(() => null);
        const seesAll = actor && ['HR', 'FOUNDER', 'AD'].includes(actor.role);
        const mine = actor && !seesAll ? await myCollegeIds(actor) : new Set<string>();
        const visible = notices.filter(n => {
            const scope: string[] = n.collegeIds || [];
            if (!scope.length) return true;
            if (!actor) return false;
            return seesAll || n.createdById === actor.id || scope.some(id => mine.has(id));
        });
        // newest first (holiday announcements carry a date; ties keep the stored order)
        return NextResponse.json(visible);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const notice = await Notice.create(body);
        return NextResponse.json(notice);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const notice = await Notice.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(notice);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        await Notice.findOneAndDelete({ id });
        return NextResponse.json({ message: 'Deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}