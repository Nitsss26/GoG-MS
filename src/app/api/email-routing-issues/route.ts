import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ReminderLog, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

/**
 * E-mail recipient routing problems (e.g. an employee with no HOI in the reporting line, a ticket with no
 * responsible HR). Recorded instead of mailing everyone; one entry per employee / issue per day.
 *   POST { employeeId, issue }  logged-in users (the mail flows report it)
 *   GET                         HR / Founder: the last 200 entries
 * Stored in the existing ReminderLog collection (type EMAIL_ROUTING_ISSUE).
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { employeeId, issue } = await req.json().catch(() => ({}));
        const id = String(employeeId || '').slice(0, 64), text = String(issue || '').slice(0, 300);
        if (!id || !text) return NextResponse.json({ error: 'employeeId and issue are required' }, { status: 400 });
        if (!(await Employee.exists({ id }))) return NextResponse.json({ error: 'Unknown employee' }, { status: 404 });
        const day = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
        const key = `EMAIL_ROUTING:${id}:${text.slice(0, 40)}:${day}`;
        await ReminderLog.updateOne({ key }, { $setOnInsert: { key, type: 'EMAIL_ROUTING_ISSUE', recipientId: id, details: { issue: text, reportedBy: actor.id }, status: 'OPEN', createdAt: new Date().toISOString() } }, { upsert: true });
        console.warn(`[email-routing] ${id}: ${text}`);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HR' && actor.role !== 'FOUNDER') return NextResponse.json({ error: 'Only HR can view routing issues.' }, { status: 403 });
        const rows = await ReminderLog.find({ type: 'EMAIL_ROUTING_ISSUE' }).sort({ createdAt: -1 }).limit(200).lean();
        return NextResponse.json({ issues: rows });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}