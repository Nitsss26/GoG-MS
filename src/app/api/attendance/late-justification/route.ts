import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { myLateDays, submitJustification } from '@/lib/late-justification';

export const dynamic = 'force-dynamic';

/** GET — own late clock-in days with their justification status (employee attendance history / reminder) */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const emp = actor.employee?.toObject ? actor.employee.toObject() : actor.employee;
        return NextResponse.json({ days: await myLateDays(emp) });
    } catch (e: any) {
        console.error('[late-justification GET]', e?.message);
        return NextResponse.json({ error: 'Could not load late clock-in justifications.' }, { status: 500 });
    }
}

/** POST { date, reason, documentUrl? } — submit a justification for an own late clock-in */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r = await submitJustification(actor, { date: body.date, reason: body.reason, documentUrl: body.documentUrl });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ success: true, justification: r.justification, message: 'Justification submitted. HR will review it.' });
    } catch (e: any) {
        console.error('[late-justification POST]', e?.message);
        return NextResponse.json({ error: 'Could not submit the justification.' }, { status: 500 });
    }
}