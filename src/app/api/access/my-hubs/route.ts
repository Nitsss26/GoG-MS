import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AccessGrant, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { delegatedSources, grantorPermissions } from '@/lib/access-control';
import { hubOf } from '@/lib/access-hubs';

export const dynamic = 'force-dynamic';

/** The logged-in employee's delegated hubs (from the database) + whether they may open Give Access */
export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const grants: any[] = await AccessGrant.find({ recipientId: actor.id, status: 'ACTIVE' }).lean();
        const categories = Array.from(new Set(grants.map(g => g.category))).filter(c => !!hubOf(c));
        const locs: any[] = await Location.find({}).select('id name shortName').lean();
        const locName = (v: string) => locs.find(l => [l.id, l.name, l.shortName].includes(v))?.name || v || '';
        const hubs = [];
        for (const category of categories) {
            const hub = hubOf(category)!;
            const { sources } = await delegatedSources(actor.id, category);
            if (!sources.length) continue;
            const mine = grants.filter(g => g.category === category);
            hubs.push({
                category, label: hub.label, role: hub.role, items: hub.items, note: hub.note || '',
                mode: mine.some(g => g.scopeType === 'ALL_DYNAMIC') ? 'ALL_DYNAMIC' : mine.some(g => g.scopeType === 'ALL') ? 'ALL' : 'SELECTED',
                sources: sources.map((s: any) => ({ id: s.id, name: s.name, role: s.role, campus: locName(s.location) })),
            });
        }
        const perm = await grantorPermissions(actor);
        return NextResponse.json({ hubs, canManageAccess: perm.canManage }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
