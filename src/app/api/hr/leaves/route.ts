import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { Employee, LeaveRequest } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * HR: directly approve or reject a pending leave request (no HOI approval needed first).
 * Body: { id: string, action: "approve" | "reject", remarks?: string }
 *
 * This is an additional HR capability. The existing /api/leaves flow is not changed.
 */
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (session.role !== "HR" && session.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can directly approve or reject leave.' }, { status: 403 });
        }

        await dbConnect();
        const { id, action, remarks } = await request.json();

        if (!id || (action !== "approve" && action !== "reject")) {
            return NextResponse.json({ error: 'Leave id and a valid action (approve / reject) are required' }, { status: 400 });
        }

        const leave = await LeaveRequest.findOne({ id });
        if (!leave) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }
        if (leave.status !== "Pending" && leave.status !== "Pending HOI Approval") {
            return NextResponse.json({ error: `This leave is already ${leave.status}` }, { status: 409 });
        }

        // Who is acting: the session stores the Mongo _id (or the employee id as fallback)
        let approver: any = null;
        if (mongoose.isValidObjectId(session.userId)) approver = await Employee.findById(session.userId);
        if (!approver) approver = await Employee.findOne({ id: session.userId });
        if (!approver) approver = await Employee.findOne({ email: session.email });
        const approverId = approver?.id || session.userId;
        const approverName = approver?.name || session.email;
        const now = new Date().toISOString();

        // HR cannot decide their own leave: another HR or a Founder has to do it
        if (leave.employeeId === approverId) {
            return NextResponse.json({ error: 'You cannot approve or reject your own leave.' }, { status: 403 });
        }

        const updates: any = {
            hrApproverId: approverId,
            hrApprovedAt: now,
        };
        if (remarks) updates.reasonForAction = remarks;

        if (action === "approve") {
            updates.status = "Approved";
            updates.hrApproval = "Approved";
            updates.approvedBy = approverId;
            updates.approvedByName = approverName;
            updates.approvedByRole = session.role;
            updates.approvedAt = now;
        } else {
            updates.status = "Rejected";
            updates.hrApproval = "Rejected";
            updates.rejectedBy = approverId;
            updates.rejectedByName = approverName;
            updates.rejectedByRole = session.role;
            updates.rejectedAt = now;
        }

        const updated = await LeaveRequest.findOneAndUpdate({ id }, { $set: updates }, { new: true });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
