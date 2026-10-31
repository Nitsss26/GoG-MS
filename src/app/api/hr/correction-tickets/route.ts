import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { CorrectionTicket } from '@/models/SalaryModule';
import { canViewSalaryAdmin, canManageTickets, TICKET_STATUSES, TICKET_CATEGORIES } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/** GET — every salary correction ticket (HR, HR Executive, Founder). ?status=&q= */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canViewSalaryAdmin(actor)) return NextResponse.json({ error: 'Only HR, HR Executive or Founders can open correction tickets.' }, { status: 403 });
        const sp = new URL(req.url).searchParams;
        const status = sp.get('status') || '';
        const q = (sp.get('q') || '').trim().toLowerCase();
        const all: any[] = await CorrectionTicket.find({}).sort({ createdAt: -1 }).limit(2000).lean();
        const counts = Object.fromEntries(TICKET_STATUSES.map(s => [s, all.filter(t => t.status === s).length]));
        const list = all.filter(t => (!status || status === 'All' || t.status === status)
            && (!q || [t.id, t.employeeId, t.employee?.name, t.category].some(v => String(v || '').toLowerCase().includes(q))));
        return NextResponse.json({ tickets: list.map(({ _id, __v, ...t }) => t), counts, total: all.length, statuses: TICKET_STATUSES, categories: TICKET_CATEGORIES, canEdit: canManageTickets(actor) });
    } catch (e: any) {
        console.error('hr tickets GET', e);
        return NextResponse.json({ error: 'Could not load tickets.' }, { status: 500 });
    }
}