import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canManageCelebrations, managementData, manage } from '@/lib/celebrations';

export const dynamic = 'force-dynamic';

/**
 * Announcements → Celebration Management (HR / HR Executive / Founder only — checked here, not only in the page).
 *   GET  → banner libraries, active banners, employee birthday directory, festival celebrations
 *   POST { action, … } → template_create | template_update | template_delete | set_active |
 *                         employee_config | edit_dob | festival_save | festival_delete
 */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageCelebrations(actor)) return NextResponse.json({ error: 'Only HR can manage celebrations.' }, { status: 403 });
        return NextResponse.json(await managementData());
    } catch (e: any) {
        console.error('celebrations manage GET', e?.message);
        return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageCelebrations(actor)) return NextResponse.json({ error: 'Only HR can manage celebrations.' }, { status: 403 });
        const r: any = await manage(actor, await req.json().catch(() => ({})));
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ success: true, message: r.message, ...(r.id ? { id: r.id } : {}) });
    } catch (e: any) {
        console.error('celebrations manage POST', e?.message);
        return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
    }
}