import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { omOverview, createGrant, revokeGrant } from '@/lib/temp-access';

export const dynamic = 'force-dynamic';

/**
 * OM Given Access (Full Attire only).
 *   GET                       OM: eligible employees + grants this OM gave (status worked out from the dates)
 *   POST  { employeeId, startDate, endDate, reason? }      OM: give access
 *   PATCH { id, action: 'revoke' }                         granting OM, or HR / Founder: revoke / cancel
 * Only an OM's own login can give access (never through Give Access hubs, never a person who only has a grant).
 */
const deny = (m: string, s = 403) => NextResponse.json({ error: m }, { status: s });

export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return deny('Unauthorized', 401);
        if (actor.role !== 'OM') return deny('Only an Operations Manager can give Full Attire access.');
        return NextResponse.json(await omOverview(actor));
    } catch (e: any) {
        console.error('[temp-access GET]', e?.message);
        return NextResponse.json({ error: 'Could not load access.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return deny('Unauthorized', 401);
        const r = await createGrant(actor, await req.json().catch(() => ({})));
        if (!r.ok) return deny(r.error, r.status);
        return NextResponse.json({ success: true, grant: r.grant });
    } catch (e: any) {
        console.error('[temp-access POST]', e?.message);
        return NextResponse.json({ error: 'Could not give access.' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return deny('Unauthorized', 401);
        const b = await req.json().catch(() => ({}));
        if (b?.action !== 'revoke') return deny('Unknown action.', 400);
        const r = await revokeGrant(actor, String(b?.id || '').slice(0, 80));
        if (!r.ok) return deny(r.error, r.status);
        return NextResponse.json({ success: true, grant: r.grant });
    } catch (e: any) {
        console.error('[temp-access PATCH]', e?.message);
        return NextResponse.json({ error: 'Could not revoke access.' }, { status: 500 });
    }
}