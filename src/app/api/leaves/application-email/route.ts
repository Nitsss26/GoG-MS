import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LeaveRequest } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { sendLeaveApplicationEmails, appBaseUrl } from '@/lib/leave-email-action';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/**
 * The leave-application e-mail, sent from the server so that authorised approvers can get their own
 * signed Accept / Reject links. Body: { leaveId, recipients } — recipients are worked out in the portal
 * exactly as before (getAuthorityEmails). Only the applicant can trigger it, once per leave.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { leaveId, recipients } = await req.json().catch(() => ({}));
        const leave: any = leaveId ? await LeaveRequest.findOne({ id: leaveId }).lean() : null;
        if (!leave) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        if (leave.employeeId !== actor.id) return NextResponse.json({ error: 'You can only send the e-mail for your own leave.' }, { status: 403 });
        const list = Array.from(new Set((Array.isArray(recipients) ? recipients : []).map((e: any) => String(e || '').trim().toLowerCase()).filter((e: string) => EMAIL_RE.test(e)))).slice(0, 200);
        if (!list.length) return NextResponse.json({ sent: false, reason: 'no-recipients' });
        const result = await sendLeaveApplicationEmails(leave, list, appBaseUrl(req));
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[leaves/application-email]', error?.message);
        return NextResponse.json({ error: 'Could not send the leave e-mail.' }, { status: 500 });
    }
}