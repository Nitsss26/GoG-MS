import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { JobRun } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { runAttendanceSweep } from '@/lib/attendance-violations';
import { runTicketEscalations } from '@/lib/ticket-emails';

export const dynamic = 'force-dynamic';

/**
 * Missing Clock-Out check + email retries, pinged by logged-in pages (serverless hosting has no running timer).
 * Runs at most once per 5 minutes for the whole site (JobRun unique key); every alert is unique anyway.
 */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const bucket = Math.floor(Date.now() / (5 * 60000));
        try { await JobRun.create({ key: `attendance-sweep:${bucket}`, job: 'attendance-sweep', trigger: 'page', startedAt: new Date().toISOString(), status: 'RUNNING' }); }
        catch (e: any) { if (e?.code === 11000) return NextResponse.json({ skipped: true }); throw e; }
        const result: any = await runAttendanceSweep();
        result.tickets = await runTicketEscalations(); // 48-hour ticket reminders run with the same periodic check
        await JobRun.updateOne({ key: `attendance-sweep:${bucket}` }, { $set: { status: 'DONE', finishedAt: new Date().toISOString(), result } });
        return NextResponse.json({ success: true, ...result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}