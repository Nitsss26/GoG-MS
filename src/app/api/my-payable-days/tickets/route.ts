import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { CorrectionTicket } from '@/models/SalaryModule';
import { TICKET_CATEGORIES, isMonth, istToday, nextTicketId, nowIso, employeeCard, collegeName, notifyHrNewTicket, IMAGE_URL_RE, forEmployee } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/** GET — my correction tickets (own only) */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const list: any[] = await CorrectionTicket.find({ employeeId: actor.id }).sort({ createdAt: -1 }).lean();
        return NextResponse.json({ tickets: list.map(forEmployee), categories: TICKET_CATEGORIES });
    } catch (e: any) {
        console.error('my tickets GET', e);
        return NextResponse.json({ error: 'Could not load your tickets.' }, { status: 500 });
    }
}

/** POST — raise a correction ticket. Never changes attendance, leave, payable days or penalties. */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const b = await req.json().catch(() => ({}));
        const category = String(b.category || '');
        if (!TICKET_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Choose an issue category.' }, { status: 400 });
        const month = String(b.month || '');
        if (!isMonth(month) || month > istToday().slice(0, 7)) return NextResponse.json({ error: 'Choose the month of the issue.' }, { status: 400 });
        const reason = String(b.reason || '').trim();
        if (reason.length < 10) return NextResponse.json({ error: 'Please explain the reason (at least 10 characters).' }, { status: 400 });
        const evidenceUrls = (Array.isArray(b.evidenceUrls) ? b.evidenceUrls : []).map((u: any) => String(u || '').trim()).filter(Boolean);
        if (evidenceUrls.length > 5 || evidenceUrls.some((u: string) => !IMAGE_URL_RE.test(u) || u.length > 2048)) {
            return NextResponse.json({ error: 'Evidence must be uploaded files (up to 5).' }, { status: 400 });
        }
        const affectedDates = Array.from(new Set((Array.isArray(b.affectedDates) ? b.affectedDates : []).map((d: any) => String(d || '').trim()).filter(Boolean))) as string[];
        if (affectedDates.length > 31 || affectedDates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d) || !d.startsWith(month) || d > istToday())) {
            return NextResponse.json({ error: 'Affected dates must be days of the chosen month (not in the future).' }, { status: 400 });
        }
        const emp = actor.employee?.toObject ? actor.employee.toObject() : actor.employee;
        const now = nowIso();
        const ticket = {
            id: await nextTicketId(), employeeId: actor.id,
            employee: { ...employeeCard(emp, await collegeName(emp.location)) },
            category, month,
            currentValue: String(b.currentValue || '').trim().slice(0, 200),
            expectedValue: String(b.expectedValue || '').trim().slice(0, 200),
            reason: reason.slice(0, 3000), evidenceUrls, affectedDates: affectedDates.sort(), correctionIds: [], status: 'Open',
            history: [{ at: now, by: actor.id, byName: actor.name, role: 'Employee', action: 'Ticket raised', fromStatus: '', toStatus: 'Open', note: '', evidenceUrls }],
            internalComments: [], createdAt: now, updatedAt: now,
        };
        await CorrectionTicket.create(ticket);
        await notifyHrNewTicket(ticket);
        return NextResponse.json({ success: true, message: `Ticket ${ticket.id} raised. HR will review it.`, ticket: forEmployee(ticket) });
    } catch (e: any) {
        console.error('my tickets POST', e);
        return NextResponse.json({ error: 'Could not raise the ticket.' }, { status: 500 });
    }
}