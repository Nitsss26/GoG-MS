import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { canManageProfiles, directoryRows, employeeView, employeeReport, DIRECTORY_COLS, isMonth } from '@/lib/profile-server';

export const dynamic = 'force-dynamic';

/**
 * Employee Directory (HR, HR Executive, Founder).
 * GET                       → all employees on the portal (one row each)
 * GET ?id=<id>&month=YYYY-MM → View sheet: complete profile (bank masked for HR Executive) + attendance
 * POST { action: "export", ids? }               → directory export rows (no bank / identity / documents)
 * POST { action: "employee", id, month }        → one employee's report (bank / identity masked, no document links)
 */
const thisMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);

async function hrActor() {
    await dbConnect();
    const actor = await getSessionUser({ ignoreDelegation: true });
    if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!canManageProfiles(actor)) return { error: NextResponse.json({ error: 'Only HR, HR Executive and Founder can open the Employee Directory.' }, { status: 403 }) };
    return { actor };
}
const by = (a: any) => `${a.name} (${a.hrExecutive ? 'HR Executive' : a.role})`;

export async function GET(req: Request) {
    try {
        const { actor, error } = await hrActor(); if (error) return error;
        const sp = new URL(req.url).searchParams;
        const id = sp.get('id');
        const noStore = { headers: { 'Cache-Control': 'no-store' } };
        if (id) {
            const month = isMonth(sp.get('month')) ? sp.get('month')! : thisMonth();
            const v = await employeeView(actor!, id, month);
            if (!v) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
            return NextResponse.json(v, noStore);
        }
        return NextResponse.json(await directoryRows(), noStore);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { actor, error } = await hrActor(); if (error) return error;
        const b = await req.json().catch(() => ({}));
        if (b.action === 'employee') {
            const month = isMonth(b.month) ? b.month : thisMonth();
            const r = await employeeReport(actor!, String(b.id || ''), month);
            if (!r) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
            return NextResponse.json({ ...r, generatedBy: by(actor), generatedAt: new Date().toISOString() });
        }
        if (b.action === 'export') {
            const { rows } = await directoryRows();
            const ids: string[] | null = Array.isArray(b.ids) ? b.ids.map(String) : null;
            const order = ids ? new Map(ids.map((id, i) => [id, i])) : null;
            const list = (ids ? rows.filter(r => order!.has(r.id)).sort((x, y) => order!.get(x.id)! - order!.get(y.id)!) : rows)
                .map(r => ({ ...r, roles: r.roles.join(', ') }));
            return NextResponse.json({
                title: 'Employee Directory', scope: ids ? `Filtered employees (${list.length})` : `All employees (${list.length})`,
                generatedBy: by(actor), generatedAt: new Date().toISOString(), cols: DIRECTORY_COLS, rows: list,
            });
        }
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}