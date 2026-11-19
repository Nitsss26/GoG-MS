import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { allRestrictions } from '@/lib/role-config-server';
import { isRulesKey, RULES_HEADER } from '@/lib/role-rules-key';

export const dynamic = 'force-dynamic';

/** Role Management rules for the proxy (server to server only) */
export async function GET(req: Request) {
    if (!isRulesKey(req.headers.get(RULES_HEADER))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
        await dbConnect();
        return NextResponse.json({ roles: await allRestrictions() });
    } catch (e: any) {
        return NextResponse.json({ error: 'Could not load the rules' }, { status: 500 });
    }
}