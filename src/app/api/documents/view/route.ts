import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { canView, masksSensitive, canManageProfiles } from '@/lib/profile-server';
import { docByKey, readField } from '@/lib/profile-fields';

export const dynamic = 'force-dynamic';

/**
 * Secure document preview / download: GET ?employee=<id>&doc=<document key>[&download=1]
 * The file link is read from the employee record on the server (never taken from the browser) after checking
 * that the viewer is the employee or HR / Founder (HR Executive: bank documents restricted).
 * Files on the storage hosts below are streamed from here (same origin → preview and download work);
 * any other link is opened directly.
 */
const ALLOWED_HOSTS = [/\.amazonaws\.com$/i, /^res\.cloudinary\.com$/i, /^i\.ibb\.co$/i, /\.googleusercontent\.com$/i];
const MAX_BYTES = 20 * 1024 * 1024;
const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const sp = new URL(req.url).searchParams;
        const id = sp.get('employee') || actor.id;
        const d = docByKey(sp.get('doc') || '');
        if (!d) return NextResponse.json({ error: 'Unknown document' }, { status: 400 });
        if (!canView(actor, id)) return NextResponse.json({ error: 'You cannot open this document.' }, { status: 403 });
        if (d.sensitive && canManageProfiles(actor) && masksSensitive(actor) && actor.id !== id) return NextResponse.json({ error: 'This document is restricted.' }, { status: 403 });
        const emp: any = await Employee.findOne({ id, isRemoved: { $ne: true } }).lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        const url = readField(emp, d);
        if (!url) return NextResponse.json({ error: 'Not Uploaded' }, { status: 404 });
        let target: URL;
        try { target = new URL(url); } catch { return NextResponse.json({ error: 'The stored link is not valid.' }, { status: 422 }); }
        if (target.protocol !== 'https:' || !ALLOWED_HOSTS.some(h => h.test(target.hostname))) {
            return NextResponse.redirect(target.toString(), 302);
        }
        const r = await fetch(target.toString(), { redirect: 'follow', signal: AbortSignal.timeout(20000) });
        if (!r.ok) return NextResponse.json({ error: `File not available (${r.status})` }, { status: 502 });
        const buf = await r.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) return NextResponse.redirect(target.toString(), 302);
        const type = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
        const fileName = `${emp.id}_${d.label.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}.${EXT[type] || (target.pathname.split('.').pop() || 'file').slice(0, 5)}`;
        return new NextResponse(buf, {
            headers: {
                'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
                // only PDF / plain images open inline; anything else (HTML, SVG, …) is downloaded, never rendered here
                'Content-Disposition': `${sp.get('download') || !(type in EXT) ? 'attachment' : 'inline'}; filename="${fileName}"`,
                // (Chrome's PDF viewer does not run in a sandbox, so PDFs get no sandbox policy)
                ...(type === 'application/pdf' ? {} : { 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }),
                'X-Document-Name': encodeURIComponent(d.label),
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}