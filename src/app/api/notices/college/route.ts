import { NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { ANNOUNCEMENT_TYPES, HR_CATEGORIES, hoiColleges, allColleges, validateSelection, validateHrSelection, professorsOf, employeesOf, createAnnouncement, createHrAnnouncement, deliver, history, retry } from '@/lib/college-announcements';

export const dynamic = 'force-dynamic';

/**
 * HOI college-wise announcements (part of the existing Announcements).
 *   GET                         → HOI: its colleges + types + its announcement history (HR / Founder: all history)
 *   GET ?recipients=a,b         → HOI: number of professors that would receive it (backend count, no addresses)
 *   POST { announcementType, customType, collegeIds[], title, description, effectiveDate, additionalDetails, imageUrls }
 *   PUT  { id, action: "retry" } → resend failed e-mails only
 * HR / HR Executive / Founder (Announcements → Add Announcement):
 *   GET                         → every college + categories + history
 *   GET ?recipients=a,b | ?scope=GENERAL → number of employees that would get the e-mail
 *   POST { scope: GENERAL|COLLEGES, collegeIds[], category, title, content, holidayDate (Holiday), imageUrls }
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isAdmin = ['HR', 'FOUNDER'].includes(actor.role);
        if (actor.role !== 'HOI' && !isAdmin) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const sp = new URL(req.url).searchParams;
        if (isAdmin && (sp.has('recipients') || sp.get('scope') === 'GENERAL')) {
            const general = sp.get('scope') === 'GENERAL';
            const sel = await validateHrSelection(general ? 'GENERAL' : 'COLLEGES', (sp.get('recipients') || '').split(',').filter(Boolean));
            if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: sel.status });
            const emps = await employeesOf(general ? 'GENERAL' : sel.ids);
            return NextResponse.json({ count: emps.length, perCollege: sel.colleges.map(c => ({ id: c.id, name: c.name, count: emps.filter(p => p.colleges.includes(c.id)).length })) });
        }
        if (sp.has('recipients')) {
            if (actor.role !== 'HOI') return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
            const sel = await validateSelection(actor, (sp.get('recipients') || '').split(',').filter(Boolean));
            if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: sel.status });
            const profs = await professorsOf(sel.ids);
            return NextResponse.json({ count: profs.length, perCollege: sel.colleges.map(c => ({ id: c.id, name: c.name, count: profs.filter(p => p.colleges.includes(c.id)).length })) });
        }
        return NextResponse.json({
            colleges: actor.role === 'HOI' ? await hoiColleges(actor) : await allColleges(),
            types: isAdmin ? HR_CATEGORIES : ANNOUNCEMENT_TYPES, history: await history(actor),
        });
    } catch (e: any) {
        console.error('college announcements GET', e);
        return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r: any = ['HR', 'FOUNDER'].includes(actor.role) ? await createHrAnnouncement(actor, body) : await createAnnouncement(actor, body);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        // e-mails after the response (one per professor; logged per recipient)
        after(async () => { try { await deliver(r.id); } catch (e: any) { console.error('[college-announcement] delivery', e?.message); } });
        return NextResponse.json({ id: r.id, recipients: r.recipients, message: `Announcement published. E-mail to ${r.recipients} ${['HR', 'FOUNDER'].includes(actor.role) ? 'employee' : 'professor / OM'}${r.recipients === 1 ? '' : 's'}.` });
    } catch (e: any) {
        console.error('college announcements POST', e);
        return NextResponse.json({ error: 'Could not publish the announcement.' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        if (body.action !== 'retry') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        const r: any = await retry(actor, String(body.id || ''));
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ sent: r.sent, failed: r.failed, message: r.failed ? `${r.sent} sent, ${r.failed} still failing.` : `${r.sent} e-mail(s) sent.` });
    } catch (e: any) {
        console.error('college announcements PUT', e);
        return NextResponse.json({ error: 'Could not retry.' }, { status: 500 });
    }
}