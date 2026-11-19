import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { restrictionOfUser } from '@/lib/role-config-server';

export const dynamic = 'force-dynamic';

/** The logged-in designation's Role Management restrictions (sidebar) — empty when nothing is restricted */
export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json(await restrictionOfUser(actor));
    } catch {
        return NextResponse.json({ hidden: [], blocked: [] });
    }
}