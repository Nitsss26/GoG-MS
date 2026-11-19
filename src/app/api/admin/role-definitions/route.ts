import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canManageRoles, saveDefinition, definitionAction } from '@/lib/role-config-server';

export const dynamic = 'force-dynamic';

const guard = async () => {
    await dbConnect();
    const actor = await getSessionUser({ ignoreDelegation: true });
    if (!actor) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!canManageRoles(actor)) return { res: NextResponse.json({ error: 'Only HR and the Founder can manage roles.' }, { status: 403 }) };
    return { actor };
};
const out = (r: any) => (r.ok ? NextResponse.json({ success: true, definition: r.definition }) : NextResponse.json({ error: r.error }, { status: r.status }));

/** Create Role: save a new draft — { roleId, label, description, baseRole, org, hidden, blocked } */
export async function POST(req: Request) {
    try {
        const g = await guard(); if (g.res) return g.res;
        return out(await saveDefinition(g.actor, await req.json().catch(() => ({})), 'create'));
    } catch (e: any) { return NextResponse.json({ error: e.message || 'Could not save' }, { status: 500 }); }
}

/** Edit a role (draft: everything; published: name, description, Org Chart place, restrictions) */
export async function PUT(req: Request) {
    try {
        const g = await guard(); if (g.res) return g.res;
        return out(await saveDefinition(g.actor, await req.json().catch(() => ({})), 'update'));
    } catch (e: any) { return NextResponse.json({ error: e.message || 'Could not save' }, { status: 500 }); }
}

/** { roleId, action: publish | unpublish | delete } */
export async function PATCH(req: Request) {
    try {
        const g = await guard(); if (g.res) return g.res;
        const b = await req.json().catch(() => ({}));
        return out(await definitionAction(g.actor, String(b.roleId || ''), String(b.action || '')));
    } catch (e: any) { return NextResponse.json({ error: e.message || 'Could not save' }, { status: 500 }); }
}