import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { RoleAuditLog } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { canManageRoles } from '@/lib/role-config-server';

export const dynamic = 'force-dynamic';

/** Admin → Role Activity Logs (newest first; ?role= filters one role) */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageRoles(actor)) return NextResponse.json({ error: 'Only HR and the Founder can see role logs.' }, { status: 403 });
        const role = new URL(req.url).searchParams.get('role');
        const logs: any[] = await RoleAuditLog.find(role ? { role } : {}).sort({ at: -1 }).limit(500).lean();
        return NextResponse.json({ logs: logs.map(({ _id, __v, ...l }: any) => l) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Could not load logs' }, { status: 500 });
    }
}