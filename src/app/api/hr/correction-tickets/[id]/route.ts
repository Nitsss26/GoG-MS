import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { CorrectionTicket } from '@/models/SalaryModule';
import { canManageTickets, TICKET_STATUSES, nowIso, actorRoleLabel, notifyEmployee, monthLabel } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/**
 * PATCH — HR review of a correction ticket.
 * { status?, response?, internalComment?, resolutionNote? }
 *  - status change (with a response to the employee) → history + in-app + email to the employee
 *  - internalComment → HR-only note
 * A decision here never changes attendance, leave, payable days or penalties: an approved correction is applied
 * through the existing workflows (Attendance Override, Leave Management, attendance violation review…).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageTickets(actor)) return NextResponse.json({ error: 'Only HR or HR Executive can update correction tickets (Founders can view them).' }, { status: 403 });
        const { id } = await params;
        const b = await req.json().catch(() => ({}));
        const t: any = await CorrectionTicket.findOne({ id }).lean();
        if (!t) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        if (t.employeeId === actor.id) return NextResponse.json({ error: 'You cannot review your own correction ticket.' }, { status: 403 });
        const now = nowIso();
        const role = actorRoleLabel(actor);

        const comment = String(b.internalComment || '').trim();
        if (comment) {
            const upd: any = await CorrectionTicket.findOneAndUpdate({ id }, { $set: { updatedAt: now }, $push: { internalComments: { at: now, by: actor.id, byName: actor.name, text: comment.slice(0, 3000) } } }, { new: true }).lean();
            return NextResponse.json({ success: true, message: 'Internal comment added.', ticket: upd });
        }

        const status = String(b.status || '');
        if (!TICKET_STATUSES.includes(status) || status === 'Open') return NextResponse.json({ error: 'Choose a valid status.' }, { status: 400 });
        if (['Resolved', 'Rejected'].includes(t.status) && t.status === status) return NextResponse.json({ error: `The ticket is already ${status}.` }, { status: 409 });
        const response = String(b.response || '').trim().slice(0, 3000);
        if (['Additional Information Required', 'Rejected', 'Approved', 'Resolved'].includes(status) && response.length < 3) {
            return NextResponse.json({ error: 'Write a response for the employee.' }, { status: 400 });
        }
        const resolutionNote = String(b.resolutionNote || '').trim().slice(0, 3000);
        const set: any = { status, updatedAt: now, ...(response ? { hrResponse: response } : {}) };
        if (status === 'Resolved' || status === 'Rejected') Object.assign(set, { resolvedAt: now, resolvedBy: actor.id, resolvedByName: actor.name, resolutionNote: resolutionNote || response });
        const upd: any = await CorrectionTicket.findOneAndUpdate(
            { id, status: t.status },
            { $set: set, $push: { history: { at: now, by: actor.id, byName: actor.name, role, action: `Status: ${status}`, fromStatus: t.status, toStatus: status, note: response } } },
            { new: true }
        ).lean();
        if (!upd) return NextResponse.json({ error: 'The ticket was changed meanwhile. Refresh and try again.' }, { status: 409 });
        const emp: any = await Employee.findOne({ id: t.employeeId }).lean();
        if (emp) {
            await notifyEmployee(emp, `Salary correction ticket ${t.id}: ${status}`,
                status === 'Additional Information Required' ? `HR needs more information on your ticket ${t.id}. Please reply from My Salary & Payable Days.` : `Your correction ticket ${t.id} is now "${status}".`,
                `/my-payable-days?ticket=${t.id}`,
                [{ label: 'Ticket ID', value: t.id }, { label: 'Category', value: t.category }, { label: 'Month', value: t.month ? monthLabel(t.month) : '' }, { label: 'Status', value: status }, { label: 'HR Response', value: response }, { label: 'Updated By', value: `${actor.name} (${role})` }],
                actor, t.id);
        }
        return NextResponse.json({ success: true, message: `Ticket ${t.id} is now ${status}. The employee has been informed.`, ticket: upd });
    } catch (e: any) {
        console.error('hr ticket PATCH', e);
        return NextResponse.json({ error: 'Could not update the ticket.' }, { status: 500 });
    }
}