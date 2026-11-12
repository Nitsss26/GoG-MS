import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { resolveToday, markOpeningSeen } from '@/lib/celebrations';

export const dynamic = 'force-dynamic';

/**
 * The logged-in employee's celebration for today (IST): dashboard banner (birthday / festival / vacation),
 * colleagues' birthdays and the global animation effect. Read only.
 * POST { seen: "<effect key>" } → the opening animation was shown (it runs once per celebration and date).
 */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json(await resolveToday(actor), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e: any) {
        console.error('celebrations today', e?.message);
        return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const b = await req.json().catch(() => ({}));
        if (!(await markOpeningSeen(actor, String(b.seen || '')))) return NextResponse.json({ error: 'Invalid.' }, { status: 400 });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('celebrations seen', e?.message);
        return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
    }
}