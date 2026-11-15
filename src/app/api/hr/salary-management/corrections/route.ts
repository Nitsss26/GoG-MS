import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { CorrectionTicket, PayableCorrection } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { canCorrectPayable, isYmd, istToday, nowIso, actorRoleLabel, payableDaysFor, notifyEmployee, notifySalaryAdjustment, HALF_DAY_REASONS, fmtDate, monthLabel, CORRECTION_CATEGORIES, NON_PAYABLE_CATEGORIES, IMAGE_URL_RE } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/**
 * POST — HR / HR Executive marks a non-payable (or partly payable) day as payable, or a payable day as non-payable.
 * { employeeId, date, direction?: 'TO_PAYABLE' | 'TO_NON_PAYABLE', category, reason, evidenceUrls?, ticketId? }
 * Half Day Payable: { ..., payableType: 'HALF', halfDayReason, explanation } → the date counts 0.5 (from 0 via Mark Payable, from 1 via Mark Non-Payable).
 * A payroll adjustment on top of the records: attendance and leave are never changed.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canCorrectPayable(actor)) return NextResponse.json({ error: 'Only HR or HR Executive can correct payable days.' }, { status: 403 });
        const b = await req.json().catch(() => ({}));
        const employeeId = String(b.employeeId || ''), date = String(b.date || '');
        if (!isYmd(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
        if (date > istToday()) return NextResponse.json({ error: 'A future date cannot be corrected.' }, { status: 400 });
        if (employeeId === actor.id) return NextResponse.json({ error: 'You cannot correct your own payable days.' }, { status: 403 });
        const direction = b.direction === 'TO_NON_PAYABLE' ? 'TO_NON_PAYABLE' : 'TO_PAYABLE';
        const toPay = direction === 'TO_PAYABLE';
        const half = b.payableType === 'HALF';
        const halfReason = String(b.halfDayReason || '');
        const explanation = String(b.explanation || '').trim().replace(/[ \t]+/g, ' ').slice(0, 3000);
        if (half) {
            if (!HALF_DAY_REASONS.includes(halfReason)) return NextResponse.json({ error: 'Choose the reason for Half Day Payable.' }, { status: 400 });
            if (!explanation) return NextResponse.json({ error: halfReason === 'Other' ? 'Write the reason for "Other".' : 'Write the explanation.' }, { status: 400 });
        }
        const picked = half ? halfReason : String(b.category || '');
        if (!half && !(toPay ? CORRECTION_CATEGORIES : NON_PAYABLE_CATEGORIES).includes(picked)) return NextResponse.json({ error: 'Choose a correction category.' }, { status: 400 });
        // "Other" → HR writes the category by hand
        const otherText = String(b.categoryOther || '').trim().replace(/\s+/g, ' ').slice(0, 150);
        if (!half && picked === 'Other' && otherText.length < 2) return NextResponse.json({ error: 'Write the correction category for "Other".' }, { status: 400 });
        const category = !half && picked === 'Other' ? `Other — ${otherText}` : picked;
        // reason is optional (Full Day); Half Day → the mandatory explanation
        const reason = half ? explanation : String(b.reason || '').trim();
        const evidence = (Array.isArray(b.evidenceUrls) ? b.evidenceUrls : []).map((u: any) => String(u || '').trim()).filter(Boolean);
        if (evidence.length > 5 || evidence.some((u: string) => !IMAGE_URL_RE.test(u) || u.length > 2048)) return NextResponse.json({ error: 'Evidence must be uploaded files (up to 5).' }, { status: 400 });

        const emp: any = await Employee.findOne({ id: employeeId }).lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        const month = date.slice(0, 7);
        const before = await payableDaysFor(emp, month);
        const row: any = before.days.find(d => d.date === date);
        if (!row || row.payableStatus === 'Not Employed') return NextResponse.json({ error: 'The employee was not employed on this date.' }, { status: 400 });
        if (row.payableStatus === 'Upcoming') return NextResponse.json({ error: 'This date has not happened yet.' }, { status: 400 });
        if (row.correction) return NextResponse.json({ error: `This date is already corrected by HR (${row.correction.direction === 'TO_NON_PAYABLE' ? 'non-payable' : 'payable'}). Reverse that correction first.` }, { status: 409 });
        if (toPay && !row.correctable) return NextResponse.json({ error: 'This date already counts as a full payable day.' }, { status: 409 });
        if (!toPay && !row.deductible) return NextResponse.json({ error: 'This date is already non-payable.' }, { status: 409 });
        // Half Day: only a fully non-payable day (0 → 0.5) or a fully payable day (1 → 0.5)
        if (half && toPay && row.payable !== 0) return NextResponse.json({ error: 'Half Day Payable from Mark Payable needs a fully non-payable date.' }, { status: 409 });
        if (half && !toPay && row.payable !== 1) return NextResponse.json({ error: 'Half Day Payable from Mark Non-Payable needs a fully payable date.' }, { status: 409 });

        let ticket: any = null;
        if (b.ticketId) {
            ticket = await CorrectionTicket.findOne({ id: String(b.ticketId) }).lean();
            if (!ticket || ticket.employeeId !== employeeId) return NextResponse.json({ error: 'The ticket does not belong to this employee.' }, { status: 400 });
            if (['Resolved', 'Rejected'].includes(ticket.status)) return NextResponse.json({ error: `The ticket is already ${ticket.status}.` }, { status: 409 });
        }
        const now = nowIso(), role = actorRoleLabel(actor);
        const adjustment = half ? (toPay ? 0.5 : -0.5) : toPay ? Math.round(row.lop * 100) / 100 : -Math.round(row.payable * 100) / 100;
        const newStatus = half ? 'Partly Payable' : toPay ? 'Payable' : 'Non-Payable';
        const doc = {
            id: `PC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            activeKey: `${employeeId}:${date}`, employeeId, employeeName: emp.name, month, date, direction,
            originalAttendance: row.attendance, originalLeave: row.leave || '', originalReason: row.reason,
            previousPayableStatus: row.payableStatus, previousPayableValue: row.payable, updatedPayableStatus: newStatus, updatedPayableValue: half ? 0.5 : toPay ? 1 : 0, adjustment, payableType: half ? 'HALF' : 'FULL',
            previousMonthPayable: before.payableDays, updatedMonthPayable: Math.round((before.payableDays + adjustment) * 100) / 100,
            correctionCategory: category, correctionReason: reason.slice(0, 3000), supportingEvidence: evidence, relatedTicketId: ticket?.id || '',
            correctedBy: actor.id, correctedByName: actor.name, correctedByRole: role, correctedAt: now, status: 'ACTIVE',
        };
        try { await PayableCorrection.create(doc); }
        catch (e: any) { if (e?.code === 11000) return NextResponse.json({ error: 'This date was just corrected by someone else.' }, { status: 409 }); throw e; }
        // keep the direction even if an older model definition is still loaded (field not in its schema)
        await PayableCorrection.collection.updateOne({ id: doc.id }, { $set: { direction, updatedPayableStatus: doc.updatedPayableStatus, updatedPayableValue: doc.updatedPayableValue, adjustment, payableType: doc.payableType } });

        const after = await payableDaysFor(emp, month);
        if (after.payableDays === before.payableDays) console.error('[payable correction] saved but payable days unchanged', doc.id, employeeId, date, direction);
        // ticket: link the correction; resolve once every requested date is payable
        let ticketStatus = '';
        if (ticket) {
            const pendingDates = (ticket.affectedDates || []).filter((d: string) => d.startsWith(month) ? (after.days.find(x => x.date === d)?.payable ?? 1) < 1 : false);
            const otherMonths = (ticket.affectedDates || []).some((d: string) => !d.startsWith(month));
            ticketStatus = pendingDates.length || otherMonths ? 'Under Review' : 'Resolved';
            const set: any = { status: ticketStatus, updatedAt: now, hrResponse: `${fmtDate(date)} marked as ${half ? 'Half Day Payable (0.5)' : toPay ? 'payable' : 'non-payable'} (${category}).${reason ? ` ${reason}` : ''}`.slice(0, 3000) };
            if (ticketStatus === 'Resolved') Object.assign(set, { resolvedAt: now, resolvedBy: actor.id, resolvedByName: actor.name, resolutionNote: `${fmtDate(date)} marked as ${half ? 'Half Day Payable (0.5)' : toPay ? 'payable' : 'non-payable'} (${before.payableDays} → ${after.payableDays} payable days).` });
            await CorrectionTicket.updateOne({ id: ticket.id }, {
                $set: set, $addToSet: { correctionIds: doc.id },
                $push: { history: { at: now, by: actor.id, byName: actor.name, role, action: `Marked ${fmtDate(date)} ${half ? 'Half Day Payable (0.5)' : toPay ? 'payable' : 'non-payable'}`, fromStatus: ticket.status, toStatus: ticketStatus, note: (reason || category).slice(0, 3000) } },
            });
        }
        const notify = half ? await notifySalaryAdjustment(emp, 'Salary Payable Day Adjustment Notification',
            'This is to inform you that a half-day payable adjustment has been recorded for the following date:',
            [
                { label: 'Employee ID', value: emp.id }, { label: 'Date', value: fmtDate(date) }, { label: 'Payable Status', value: 'Half Day (0.5 Day)' },
                { label: 'Reason', value: halfReason }, { label: 'Explanation', value: explanation },
            ], 'This adjustment will be reflected in the applicable salary calculation.', `/my-payable-days?month=${month}`, actor, doc.id)
            : await notifyEmployee(emp, toPay ? 'Payable Day Correction Approved' : 'Payable Day Correction — Marked Non-Payable',
            toPay ? `Your payable day for ${fmtDate(date)} has been reviewed and marked as payable. Your updated payable days for ${monthLabel(month)} are ${after.payableDays}.`
                : `HR reviewed ${fmtDate(date)} and marked it as non-payable. Your updated payable days for ${monthLabel(month)} are ${after.payableDays}. If you think this is wrong, raise a correction ticket.`,
            `/my-payable-days?month=${month}`,
            [
                { label: 'Employee', value: `${emp.name} (${emp.id})` }, { label: 'Date', value: fmtDate(date) },
                { label: 'Previous Status', value: row.payableStatus }, { label: 'Updated Status', value: toPay ? 'Payable' : 'Non-Payable' },
                { label: 'Previous Monthly Payable Days', value: String(before.payableDays) }, { label: 'Updated Monthly Payable Days', value: String(after.payableDays) },
                { label: 'Correction Category', value: category }, { label: 'Correction Reason', value: reason || '—' }, { label: 'Updated By', value: role },
                ...(ticket ? [{ label: 'Ticket', value: `${ticket.id} — ${ticketStatus}` }] : []),
            ], actor, doc.id);
        const doneText = half ? 'Half Day Payable (0.5)' : toPay ? 'payable' : 'non-payable';
        await PayableCorrection.updateOne({ id: doc.id }, { $set: { notifyStatus: notify } });
        return NextResponse.json({
            success: true, correctionId: doc.id, previousPayableDays: before.payableDays, updatedPayableDays: after.payableDays, ticketStatus,
            message: `${fmtDate(date)} marked as ${doneText} for ${emp.name} (${before.payableDays} → ${after.payableDays} payable days).${ticket ? ` Ticket ${ticket.id}: ${ticketStatus}.` : ''} The employee has been notified.`,
        });
    } catch (e: any) {
        console.error('payable correction POST', e);
        return NextResponse.json({ error: 'Could not save the correction.' }, { status: 500 });
    }
}