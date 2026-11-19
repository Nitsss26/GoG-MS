import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { publishedRoles } from '@/lib/role-config-server';

export const dynamic = 'force-dynamic';

/**
 * Published roles HR created in Role Management (id, name, base role, Org Chart place) — for the login dropdown,
 * the onboarding dropdown and the Org Chart. Nothing about access or employees. Empty list when there are none.
 */
export async function GET() {
    try {
        await dbConnect();
        return NextResponse.json({ roles: await publishedRoles() });
    } catch {
        return NextResponse.json({ roles: [] });
    }
}