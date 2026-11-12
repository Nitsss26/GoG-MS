import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Notice, Holiday } from '@/models/Schemas';
import { isHolidayNotice, holidaysOfNotice } from '@/lib/holiday-announcement-delete';
import { getSessionUser } from '@/lib/session-user';
import { visibleNotices } from '@/lib/notice-visibility';
import { restoreFlagsAfterHolidayRemoval, holidayCoversEmployee } from '@/lib/holiday-flag-removal';

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
        const visible = await visibleNotices(notices, actor);
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

/**
 * PATCH { ids: string[] } — the logged-in user has read these announcements (stored in readBy, used by the
 * sidebar unread badge). Only the user's own id is added; nothing else on the announcement changes.
 */
export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).filter((x: any) => typeof x === 'string' && x).slice(0, 500);
        if (!ids.length) return NextResponse.json({ error: 'Announcement id is required' }, { status: 400 });
        const r: any = await Notice.updateMany({ id: { $in: ids }, readBy: { $ne: actor.id } }, { $addToSet: { readBy: actor.id } });
        return NextResponse.json({ success: true, marked: r?.modifiedCount ?? 0 });
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

/**
 * Delete an announcement.
 * Holiday announcement (HR / HR Executive / Founder only): its holiday days are removed too, so those dates become
 * normal days again everywhere (attendance, payable days, timetables read the Holiday records).
 * ?preview=1 → only lists the holiday dates that would be removed (nothing is deleted).
 */
export async function DELETE(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const notice: any = id ? await Notice.findOne({ id }).lean() : null;
        if (notice && isHolidayNotice(notice)) {
            const actor: any = await getSessionUser().catch(() => null);
            if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            if (!['HR', 'FOUNDER'].includes(actor.role)) return NextResponse.json({ error: 'Only HR / HR Executive can delete a holiday announcement.' }, { status: 403 });
            const days = await holidaysOfNotice(notice);
            const dates = Array.from(new Set(days.map(h => h.date))); // one per date (a college-wise holiday has a record per college)
            if (searchParams.get('preview') === '1') return NextResponse.json({ holidayDates: dates, holidayName: days[0]?.name || '' });
            if (days.length) await Holiday.deleteMany({ id: { $in: days.map(h => h.id) } });
            // attendance flags removed only because of these holiday days are active again
            for (const h of days) await restoreFlagsAfterHolidayRemoval(h.date, emp => holidayCoversEmployee(h, emp));
            await Notice.findOneAndDelete({ id });
            return NextResponse.json({ message: dates.length ? `Announcement deleted. ${dates.length} holiday day${dates.length === 1 ? '' : 's'} removed — ${dates.length === 1 ? 'it is' : 'they are'} normal day${dates.length === 1 ? '' : 's'} again.` : 'Announcement deleted.', removedHolidayDates: dates });
        }
        await Notice.findOneAndDelete({ id });
        return NextResponse.json({ message: 'Deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}