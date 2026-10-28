import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, LeaveRequest } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { verifyActionToken, stepFor, leaveView, processedBy, decideFromEmail } from '@/lib/leave-email-action';
import { PENDING_LEAVE_STATUSES } from '@/lib/leave-decision';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * GET ?t=<token> — read-only: the leave and whether the logged-in approver can decide it now
 * (used by the /leave-action confirmation page; opening a link never changes anything).
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const v = verifyActionToken(new URL(req.url).searchParams.get('t'));
        if (!v.ok) return NextResponse.json({ error: v.error, code: v.status === 410 ? 'expired' : 'invalid' }, { status: v.status, headers: noStore });
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Please log in to continue.', code: 'login' }, { status: 401, headers: noStore });
        if (actor.id !== v.payload.u) {
            const intended: any = await Employee.findOne({ id: v.payload.u }).select('name role').lean();
            return NextResponse.json({ error: `This link was sent to ${intended?.name || 'another approver'}${intended?.role ? ` (${intended.role})` : ''}. Log in with that account to continue.`, code: 'wrong-user' }, { status: 403, headers: noStore });
        }
        const leave: any = await LeaveRequest.findOne({ id: v.payload.l }).lean();
        if (!leave) return NextResponse.json({ error: 'Leave request not found.', code: 'not-found' }, { status: 404, headers: noStore });
        const applicant: any = await Employee.findOne({ id: leave.employeeId }).select('dept designation role').lean();
        const step = await stepFor(actor, leave);
        const processed = !PENDING_LEAVE_STATUSES.includes(leave.status);
        return NextResponse.json({
            leave: leaveView(leave, applicant), step, canDecide: !!step,
            approver: { name: actor.name, role: actor.role },
            message: processed ? 'This leave request has already been processed.'
                : !step ? (leave.status === 'Pending' ? 'This leave request has already been processed at your level — it is now waiting for HR.' : 'You are not authorised to decide this leave request.') : '',
            processedBy: processed ? processedBy(leave) : '',
        }, { headers: noStore });
    } catch (error: any) {
        console.error('[leaves/email-action GET]', error?.message);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: noStore });
    }
}

/** POST { t, action: approve | reject, reason?, applyLOP? } — the decision, by the logged-in approver the link was sent to */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json().catch(() => ({}));
        const v = verifyActionToken(body.t);
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Please log in to continue.' }, { status: 401 });
        const r: any = await decideFromEmail(actor, v.payload, { action: body.action, reason: body.reason, applyLOP: !!body.applyLOP });
        if (!r.ok) return NextResponse.json({ error: r.error, ...(r.leave ? { leave: leaveView(r.leave), processedBy: processedBy(r.leave) } : {}) }, { status: r.status });
        return NextResponse.json({
            ok: true, leave: leaveView(r.leave),
            message: r.leave.status === 'Approved' ? 'Leave approved.' : r.leave.status === 'Rejected' ? 'Leave rejected.' : 'Approved at your level — the request now goes to HR for the final approval.',
        });
    } catch (error: any) {
        console.error('[leaves/email-action POST]', error?.message);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
}