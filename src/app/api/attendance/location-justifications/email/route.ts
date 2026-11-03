import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { previewEmail, sendEmail } from '@/lib/location-justification';

export const dynamic = 'force-dynamic';

/** GET ?id= → preview of the rejection email (To / CC / subject / body). POST { id } → send it (manual, once). */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const r: any = await previewEmail(actor, new URL(req.url).searchParams.get('id') || '');
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ preview: r.preview, emailStatus: r.emailStatus });
    } catch (e: any) {
        console.error('location-justification email GET', e);
        return NextResponse.json({ error: 'Could not prepare the email.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const r: any = await sendEmail(actor, String(body.id || ''));
        if (!r.ok) return NextResponse.json({ error: r.error, item: r.item }, { status: r.status });
        return NextResponse.json({ message: r.message, item: r.item });
    } catch (e: any) {
        console.error('location-justification email POST', e);
        return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 });
    }
}