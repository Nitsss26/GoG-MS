import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { CorrectionTicket } from '@/models/SalaryModule';
import { nowIso, IMAGE_URL_RE } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/** PATCH — the employee answers "Additional Information Required" on their own ticket → back to "Under Review" */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const b = await req.json().catch(() => ({}));
        const t: any = await CorrectionTicket.findOne({ id }).lean();
        if (!t || t.employeeId !== actor.id) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        if (t.status !== 'Additional Information Required') return NextResponse.json({ error: 'HR has not asked for more information on this ticket.' }, { status: 409 });
        const note = String(b.note || '').trim();
        if (note.length < 3) return NextResponse.json({ error: 'Please write your reply.' }, { status: 400 });
        const evidenceUrls = (Array.isArray(b.evidenceUrls) ? b.evidenceUrls : []).map((u: any) => String(u || '').trim()).filter(Boolean);
        if (evidenceUrls.length > 5 || evidenceUrls.some((u: string) => !IMAGE_URL_RE.test(u))) return NextResponse.json({ error: 'Evidence must be uploaded files (up to 5).' }, { status: 400 });
        const now = nowIso();
        const upd: any = await CorrectionTicket.findOneAndUpdate(
            { id, employeeId: actor.id, status: 'Additional Information Required' },
            {
                $set: { status: 'Under Review', updatedAt: now },
                $push: { history: { at: now, by: actor.id, byName: actor.name, role: 'Employee', action: 'Employee replied', fromStatus: t.status, toStatus: 'Under Review', note: note.slice(0, 3000), evidenceUrls }, ...(evidenceUrls.length ? { evidenceUrls: { $each: evidenceUrls } } : {}) },
            },
            { new: true }
        ).lean();
        if (!upd) return NextResponse.json({ error: 'The ticket was changed meanwhile. Refresh and try again.' }, { status: 409 });
        const { internalComments, ...rest } = upd; void internalComments;
        return NextResponse.json({ success: true, message: 'Reply sent to HR.', ticket: rest });
    } catch (e: any) {
        console.error('my ticket PATCH', e);
        return NextResponse.json({ error: 'Could not send the reply.' }, { status: 500 });
    }
}