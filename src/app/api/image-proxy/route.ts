import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

/**
 * Same-origin copy of an employee photo, so the browser can draw it into a downloaded image / PDF
 * (Org Chart → Download). Photo hosts usually do not allow other websites to read their images (CORS).
 * Logged-in users only; only image files from the photo hosts below; max 5 MB; nothing is stored.
 */
const ALLOWED_HOSTS = [/\.amazonaws\.com$/i, /^res\.cloudinary\.com$/i, /^i\.ibb\.co$/i, /\.googleusercontent\.com$/i];
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(req: Request) {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const raw = new URL(req.url).searchParams.get('url') || '';
    let target: URL;
    try { target = new URL(raw); } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }); }
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.some(h => h.test(target.hostname))) {
        return NextResponse.json({ error: 'This image host is not allowed.' }, { status: 400 });
    }
    try {
        const r = await fetch(target.toString(), { redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!r.ok) return NextResponse.json({ error: `Image not available (${r.status})` }, { status: 502 });
        const type = r.headers.get('content-type') || '';
        if (!type.startsWith('image/')) return NextResponse.json({ error: 'Not an image.' }, { status: 415 });
        const buf = await r.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Image too large.' }, { status: 413 });
        return new NextResponse(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
    } catch {
        return NextResponse.json({ error: 'Could not load the image.' }, { status: 502 });
    }
}