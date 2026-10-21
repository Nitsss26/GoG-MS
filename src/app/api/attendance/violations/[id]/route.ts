import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AttendanceViolation, Attendance } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { sendDecisionEmail, sendViolationEmail } from '@/lib/attendance-violations';

export const dynamic = 'force-dynamic';

/**
 * PUT body:
 *   { action: "explain", explanation, proofUrls[] }        employee (own Missing Clock-Out alert)
 *   { action: "approve" | "reject", remarks }              HR: decide a Missing Clock-Out explanation
 *   { action: "payroll" | "waive", remarks }               HR: Half-Day / Full-Day deduction → Approved for Payroll / Waived
 *   { action: "resend" }                                   HR: retry a failed email
 * Approve regularises the attendance (clock-out = scheduled clock-out) with an audit entry; nothing else is changed.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const v: any = await AttendanceViolation.findOne({ id }).lean();
        if (!v) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
        const body = await req.json().catch(() => ({}));
        const action = String(body.action || '');
        const remarks = String(body.remarks || '').trim().slice(0, 1000);
        const isHr = actor.role === 'HR' || actor.role === 'FOUNDER';
        const now = new Date().toISOString();

        if (action === 'explain') {
            if (v.employeeId !== actor.id) return NextResponse.json({ error: 'You can only explain your own attendance.' }, { status: 403 });
            if (v.type !== 'MISSING_OUT') return NextResponse.json({ error: 'An explanation is only needed for a Missing Clock-Out.' }, { status: 400 });
            if (!['Awaiting Explanation', 'Pending HR Verification'].includes(v.hrStatus)) return NextResponse.json({ error: 'HR has already decided this.' }, { status: 409 });
            const explanation = String(body.explanation || '').trim();
            const proofUrls = (Array.isArray(body.proofUrls) ? body.proofUrls : []).filter((u: any) => typeof u === 'string' && /^https:\/\//i.test(u) && u.length < 2048).slice(0, 5);
            if (explanation.length < 10) return NextResponse.json({ error: 'Please write your explanation (at least 10 characters).' }, { status: 400 });
            if (!proofUrls.length) return NextResponse.json({ error: 'Please upload supporting proof.' }, { status: 400 });
            const updated = await AttendanceViolation.findOneAndUpdate({ id }, { $set: { explanation, proofUrls, explanationAt: now, hrStatus: 'Pending HR Verification' } }, { new: true }).lean();
            return NextResponse.json({ success: true, violation: updated });
        }

        if (!isHr) return NextResponse.json({ error: 'Only HR can do this.' }, { status: 403 });
        if (v.employeeId === actor.id && action !== 'resend') return NextResponse.json({ error: 'You cannot decide your own attendance action.' }, { status: 403 });

        if (action === 'resend') {
            if (v.emailStatus === 'Sent') return NextResponse.json({ error: 'The email was already sent.' }, { status: 409 });
            await AttendanceViolation.updateOne({ id, emailStatus: { $ne: 'Sending' } }, { $set: { emailStatus: 'Failed', emailAttempts: 0 } });
            const r = await sendViolationEmail(id);
            return NextResponse.json({ success: r.sent, message: r.sent ? 'Email sent.' : 'Email could not be sent.' }, { status: r.sent ? 200 : 502 });
        }

        const decision: Record<string, string> = { approve: 'Approved', reject: 'Rejected', payroll: 'Approved for Payroll', waive: 'Waived' };
        if (!decision[action]) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        if ((action === 'approve' || action === 'reject') && v.type !== 'MISSING_OUT') return NextResponse.json({ error: 'Approve / Reject is for Missing Clock-Out explanations.' }, { status: 400 });
        if ((action === 'payroll' || action === 'waive') && v.hrStatus !== 'Pending HR Verification') return NextResponse.json({ error: 'Only a deduction pending HR verification can be approved for payroll or waived.' }, { status: 400 });
        if ((action === 'payroll' || action === 'waive') && v.type === 'MISSING_OUT') return NextResponse.json({ error: 'Use Approve / Reject for a Missing Clock-Out.' }, { status: 400 });
        if (action === 'reject' && remarks.length < 3) return NextResponse.json({ error: 'Please give the reason.' }, { status: 400 });

        // atomic: decided once
        const updated: any = await AttendanceViolation.findOneAndUpdate(
            { id, hrStatus: v.hrStatus },
            { $set: { hrStatus: decision[action], hrDecisionBy: actor.id, hrDecisionByName: actor.name, hrDecisionAt: now, hrRemarks: remarks } },
            { new: true }).lean();
        if (!updated) return NextResponse.json({ error: 'This was just decided by someone else.' }, { status: 409 });

        if (action === 'approve') {
            // Regularise through the audited HR path: clock-out = scheduled clock-out (only if still missing)
            const rec: any = await Attendance.findOne({ employeeId: v.employeeId, date: v.date }).lean();
            if (rec && !rec.clockOut) {
                await Attendance.updateOne({ _id: rec._id }, {
                    $set: { clockOut: v.scheduledTime, clockOutRegularized: true, isApprovedByHR: true },
                    $push: { attendanceAudit: { fromStatus: rec.status, toStatus: rec.status, previousClockIn: rec.clockIn || '', previousClockOut: '', by: actor.id, byName: actor.name, role: actor.session?.actualRole || actor.role, at: now, remarks: `Missing Clock-Out regularised (${id})${remarks ? ': ' + remarks : ''}` } },
                });
            }
        }
        const mailed = await sendDecisionEmail(updated, decision[action], remarks);
        return NextResponse.json({ success: true, violation: { ...updated, decisionEmailStatus: mailed ? 'Sent' : 'Failed' }, emailed: mailed });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}