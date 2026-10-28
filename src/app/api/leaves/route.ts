import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LeaveRequest } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { LEAVE_ADMIN_ROLES, managedEmployeeIds } from '@/lib/leave-scope';
import { managerDecideLeave } from '@/lib/leave-decision';

export const dynamic = 'force-dynamic';

/**
 * Leave requests. Who sees / decides what is worked out from the session on the server —
 * query parameters (userId, role) sent by older clients are ignored for authorization.
 */
export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let query: any = {};
        if (!LEAVE_ADMIN_ROLES.includes(actor.role)) {
            const managed = Array.from(await managedEmployeeIds(actor));
            query = { employeeId: { $in: [actor.id, ...managed] } };
        }
        const leaves = await LeaveRequest.find(query).sort({ appliedAt: -1 });
        return NextResponse.json(leaves);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** Apply for leave — always for the logged-in employee */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        if (body.employeeId && body.employeeId !== actor.id) {
            return NextResponse.json({ error: 'You can only apply for your own leave.' }, { status: 403 });
        }
        // Fields only an approver may set are never taken from the applicant
        const { approvedBy, approvedByName, approvedByRole, approvedAt, rejectedBy, rejectedByName, rejectedByRole, rejectedAt,
            hoiApproverId, hrApproverId, hoiApprovedAt, hrApprovedAt, reasonForAction, lossOfPayDays, ...rest } = body;
        const status = ['Pending', 'Pending HOI Approval'].includes(rest.status) ? rest.status : 'Pending';
        const leave = await LeaveRequest.create({
            ...rest,
            status,
            employeeId: actor.id,
            employeeName: actor.name,
            location: actor.employee?.location || rest.location,
            hoiApproval: status === 'Pending HOI Approval' ? 'Pending' : (rest.hoiApproval === 'Approved' ? 'Approved' : 'Pending'),
            hrApproval: 'Pending',
            lossOfPayDays: 0,
        });
        return NextResponse.json(leave);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Decide a leave.
 *  - HR / FOUNDER: any update (existing HR flows, including "approve as HOI").
 *  - HOI / AD / TL / OM: only the HOI step of a request from someone in their scope that is still
 *    "Pending HOI Approval" → "Pending" (on to HR) or "Rejected". The approver is always the session user.
 */
export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { id, ...updates } = body;
        if (!id) return NextResponse.json({ error: 'Leave id is required' }, { status: 400 });
        const leave: any = await LeaveRequest.findOne({ id }).lean();
        if (!leave) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });

        if (LEAVE_ADMIN_ROLES.includes(actor.role)) {
            const updated = await LeaveRequest.findOneAndUpdate({ id }, updates, { new: true });
            return NextResponse.json(updated);
        }

        // HOI step — same decision step as the e-mail "Accept / Reject Leave" links (src/lib/leave-decision.ts)
        const result = await managerDecideLeave(actor, leave, updates);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        const updated = result.leave;
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}