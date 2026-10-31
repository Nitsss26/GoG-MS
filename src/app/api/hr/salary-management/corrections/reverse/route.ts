import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { CorrectionTicket, PayableCorrection } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { canCorrectPayable, nowIso, actorRoleLabel, payableDaysFor, notifyEmployee, fmtDate, monthLabel, meaningfulReason } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/** POST { correctionId, reason } — HR / HR Executive reverses a wrong correction (the record is kept as REVERSED) */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canCorrectPayable(actor)) return NextResponse.json({ error: 'Only HR or HR Executive can reverse a correction.' }, { status: 403 });
        const b = await req.json().catch(() => ({}));
        const reason = String(b.reason || '').trim();
        if (!meaningfulReason(reason)) return NextResponse.json({ error: 'Write a proper reversal reason (at least 20 characters, a full sentence).' }, { status: 400 });
        const c: any = await PayableCorrection.findOne({ id: String(b.correctionId || '') }).lean();
        if (!c) return NextResponse.json({ error: 'Correction not found.' }, { status: 404 });
        if (c.employeeId === actor.id) return NextResponse.json({ error: 'You cannot change your own payable days.' }, { status: 403 });
        if (c.status !== 'ACTIVE') return NextResponse.json({ error: 'This correction is already reversed.' }, { status: 409 });
        const emp: any = await Employee.findOne({ id: c.employeeId }).lean();
        const before = emp ? await payableDaysFor(emp, c.month) : null;
        const now = nowIso(), role = actorRoleLabel(actor);
        const upd: any = await PayableCorrection.findOneAndUpdate({ id: c.id, status: 'ACTIVE' }, {
            $set: { status: 'REVERSED', activeKey: `${c.employeeId}:${c.date}:REVERSED:${c.id}`, reversedBy: actor.id, reversedByName: actor.name, reversedByRole: role, reversedAt: now, reversalReason: reason.slice(0, 3000) },
        }, { new: true }).lean();
        if (!upd) return NextResponse.json({ error: 'This correction is already reversed.' }, { status: 409 });
        const after = emp ? await payableDaysFor(emp, c.month) : null;
        if (c.relatedTicketId) {
            await CorrectionTicket.updateOne({ id: c.relatedTicketId }, { $push: { history: { at: now, by: actor.id, byName: actor.name, role, action: `Correction for ${fmtDate(c.date)} (${c.direction === 'TO_NON_PAYABLE' ? 'non-payable' : 'payable'}) reversed`, fromStatus: '', toStatus: '', note: reason.slice(0, 3000) } }, $set: { updatedAt: now } });
        }
        if (emp && before && after) {
            await notifyEmployee(emp, 'Payable Day Correction Reversed',
                `HR reversed the payable-day correction for ${fmtDate(c.date)}. Your payable days for ${monthLabel(c.month)} are now ${after.payableDays}.`,
                `/my-payable-days?month=${c.month}`,
                [{ label: 'Date', value: fmtDate(c.date) }, { label: 'Previous Monthly Payable Days', value: String(before.payableDays) }, { label: 'Updated Monthly Payable Days', value: String(after.payableDays) }, { label: 'Reason', value: reason }, { label: 'Reversed By', value: role }],
                actor, c.id);
        }
        return NextResponse.json({ success: true, message: `Correction for ${fmtDate(c.date)} reversed (${before?.payableDays} → ${after?.payableDays} payable days). The employee has been notified.`, updatedPayableDays: after?.payableDays });
    } catch (e: any) {
        console.error('payable correction reverse', e);
        return NextResponse.json({ error: 'Could not reverse the correction.' }, { status: 500 });
    }
}