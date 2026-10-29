import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { ManualEmail } from '@/models/ManualEmail';
import { canManageEmails, CATEGORIES, EmailCategory, history, listRows, overview, sentCopy } from '@/lib/email-management';

export const dynamic = 'force-dynamic';

/**
 * HR → Email Management (HR, HR Executive and Founder — identical access).
 *   GET ?tab=overview                                     summary cards + filter options
 *   GET ?tab=dress_code|late_clock_in|no_clock_in|no_clock_out   rows (from, to, q, dept, location, status)
 *   GET ?tab=history                                      every send attempt (from, to, q, category, dept, location, status)
 *   GET ?tab=copy&key=<key>                               the email as it was sent
 *   GET ?tab=status&category=dress_code&ids=a,b           email status of some records (Dress Code page)
 * Sending: POST /api/hr/email-management/send
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageEmails(actor)) return NextResponse.json({ error: 'Only HR or HR Executive can open Email Management.' }, { status: 403 });
        const sp = new URL(req.url).searchParams;
        const tab = sp.get('tab') || 'overview';
        const f = {
            from: sp.get('from') || '', to: sp.get('to') || '', q: (sp.get('q') || '').slice(0, 100), dept: sp.get('dept') || '',
            location: sp.get('location') || '', status: sp.get('status') || '',
        };
        if (tab === 'overview') return NextResponse.json(await overview(f));
        if (tab === 'history') return NextResponse.json(await history({ ...f, category: sp.get('category') || '' }));
        if (tab === 'copy') {
            const c = await sentCopy(String(sp.get('key') || '').slice(0, 200));
            return c ? NextResponse.json(c) : NextResponse.json({ error: 'No sent copy found.' }, { status: 404 });
        }
        if (tab === 'status') {
            const category = sp.get('category') || '';
            const ids = String(sp.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 300);
            if (!(CATEGORIES as string[]).includes(category)) return NextResponse.json({ error: 'Unknown category.' }, { status: 400 });
            const docs: any[] = await ManualEmail.find({ key: { $in: ids.map(id => `${category}:${id}`) } }).select('relatedRecordId emailStatus sentAt triggeredByName triggeredByRole errorMessage sendingAt').lean();
            return NextResponse.json({ statuses: Object.fromEntries(docs.map(d => [d.relatedRecordId, { emailStatus: d.emailStatus, sentAt: d.sentAt || '', by: d.triggeredByName || '', role: d.triggeredByRole || '', error: d.errorMessage || '', sendingAt: d.sendingAt || '' }])) });
        }
        if ((CATEGORIES as string[]).includes(tab)) return NextResponse.json(await listRows(tab as EmailCategory, f));
        return NextResponse.json({ error: 'Unknown tab.' }, { status: 400 });
    } catch (e: any) {
        console.error('[hr/email-management]', e?.message);
        return NextResponse.json({ error: 'Could not load Email Management.' }, { status: 500 });
    }
}