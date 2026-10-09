import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Notification } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

/** The logged-in user's notifications (newest first). ?unread=1 returns only the unread count. */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const unreadCount = await Notification.countDocuments({ recipientId: actor.id, read: false });
        if (searchParams.get('unread') === '1') return NextResponse.json({ unreadCount });
        const items = await Notification.find({ recipientId: actor.id }).sort({ createdAt: -1 }).limit(200).lean();
        return NextResponse.json({ unreadCount, notifications: items });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** Mark as read: { id } for one, { all: true } for all of the user's notifications */
export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id, all } = await req.json().catch(() => ({}));
        const filter: any = { recipientId: actor.id, read: false };
        if (!all) {
            if (!id) return NextResponse.json({ error: 'id or all is required' }, { status: 400 });
            filter.id = id;
        }
        const res = await Notification.updateMany(filter, { $set: { read: true, readAt: new Date().toISOString() } });
        return NextResponse.json({ success: true, updated: res.modifiedCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
