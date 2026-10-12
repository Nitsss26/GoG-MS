import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retired: Tech Leads no longer need a per-hub permission from the Founder.
 * Founder and every Tech Lead have the same Give Access rights (see ACCESS_ADMIN_ROLES in src/lib/access-control.ts).
 */
export async function POST() {
    return NextResponse.json({ error: 'Tech Leads already have full Give Access rights; there is nothing to configure.' }, { status: 410 });
}