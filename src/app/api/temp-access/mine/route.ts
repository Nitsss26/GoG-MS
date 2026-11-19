import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { activeGrantsFor } from '@/lib/temp-access';

export const dynamic = 'force-dynamic';

/** The logged-in employee's OM Given Access right now (sidebar "OM Given Access → Full Attire") */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { grants } = await activeGrantsFor(actor);
        return NextResponse.json({
            fullAttire: grants.length > 0,
            grants: grants.map(g => ({ id: g.id, grantedByName: g.grantedByName, startDate: g.startDate, endDate: g.endDate })),
        });
    } catch {
        return NextResponse.json({ fullAttire: false, grants: [] });
    }
}