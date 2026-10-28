import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, LeaveRequest } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { verifyActionToken, stepFor, leaveView, processedBy, decideFromEmail, linkApprover } from '@/lib/leave-email-action';
import { PENDING_LEAVE_STATUSES } from '@/lib/leave-decision';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

/**
 * Leave e-mail "Accept / Reject": the link opens GOG OMS (login first if needed) and the decision is saved
 * right away for the logged-in approver — who must be the person the link was sent to.
 *   GET ?t=<token>  read-only: the leave and whether the link's approver can decide it now (opening a link changes nothing)
 *   POST { t, action: approve | reject, reason?, applyLOP? }  the decision, sent by the /leave-action page
 */
/** The logged-in user must be the approver the link was sent to */
async function sessionMatches(payload: any): Promise<{ approver: any } | { error: string; code: string; status: number }> {
    const actor: any = await getSessionUser({ ignoreDelegation: true });
    if (!actor) return { error: 'Please log in to continue.', code: 'login', status: 401 };
    const approver = await linkApprover(payload);
    if (!approver) return { error: 'This link is no longer valid for your account.', code: 'invalid', status: 403 };
    if (actor.id !== approver.id) return { error: `This link was sent to ${approver.name}. Log in with that account to continue.`, code: 'wrong-user', status: 403 };
    return { approver };
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const v = verifyActionToken(new URL(req.url).searchParams.get('t'));
        if (!v.ok) return NextResponse.json({ error: v.error, code: v.status === 410 ? 'expired' : 'invalid' }, { status: v.status, headers: noStore });
        const who = await sessionMatches(v.payload);
        if ('error' in who) return NextResponse.json({ error: who.error, code: who.code }, { status: who.status, headers: noStore });
        const approver = who.approver;
        const leave: any = await LeaveRequest.findOne({ id: v.payload.l }).lean();
        if (!leave) return NextResponse.json({ error: 'Leave request not found.', code: 'not-found' }, { status: 404, headers: noStore });
        const applicant: any = await Employee.findOne({ id: leave.employeeId }).select('dept designation role').lean();
        const step = await stepFor(approver, leave);
        const processed = !PENDING_LEAVE_STATUSES.includes(leave.status);
        return NextResponse.json({
            leave: leaveView(leave, applicant), step, canDecide: !!step,
            approver: { name: approver.name, role: approver.role },
            message: processed ? 'This leave request has already been processed.'
                : !step ? (leave.status === 'Pending' ? 'This leave request has already been processed at your level — it is now waiting for HR.' : 'You are not authorised to decide this leave request.') : '',
            processedBy: processed ? processedBy(leave) : '',
        }, { headers: noStore });
    } catch (error: any) {
        console.error('[leaves/email-action GET]', error?.message);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: noStore });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json().catch(() => ({}));
        const v = verifyActionToken(body.t);
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status, headers: noStore });
        const who = await sessionMatches(v.payload);
        if ('error' in who) return NextResponse.json({ error: who.error, code: who.code }, { status: who.status, headers: noStore });
        const r: any = await decideFromEmail(v.payload, { action: body.action, reason: body.reason, applyLOP: !!body.applyLOP });
        if (!r.ok) return NextResponse.json({ error: r.error, ...(r.leave ? { leave: leaveView(r.leave), processedBy: processedBy(r.leave) } : {}) }, { status: r.status, headers: noStore });
        return NextResponse.json({
            ok: true, leave: leaveView(r.leave),
            message: r.leave.status === 'Approved' ? 'Leave Approved' : r.leave.status === 'Rejected' ? 'Leave Rejected' : 'Approved at your level — the request now goes to HR for the final approval.',
        }, { headers: noStore });
    } catch (error: any) {
        console.error('[leaves/email-action POST]', error?.message);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: noStore });
    }
}