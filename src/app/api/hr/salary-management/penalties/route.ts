import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { HrMonetaryPenalty } from '@/models/SalaryModule';
import { getSessionUser } from '@/lib/session-user';
import { canCorrectPayable, isYmd, isMonth, monthLabel, istToday, nowIso, actorRoleLabel, payableDaysFor, notifySalaryAdjustment, fmtDate, meaningfulReason, PENALTY_REASONS, MAX_PENALTY_AMOUNT } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

/**
 * HR monetary penalty (₹) for one employee and date — listed with the other Monetary Penalties of the month.
 * Payable days and the attendance record are never changed by it.
 *   POST  { employeeId, date, amount, reasonCategory, explanation }                  → apply (for one day)
 *   POST  { employeeId, month, wholeMonth: true, amount, reasonCategory, explanation } → apply for the whole month (no day)
 *   PATCH { id, action: 'edit', amount, reasonCategory, explanation, note }           → correct (audit kept)
 *   PATCH { id, action: 'reverse', reason }                                           → reverse (record kept as REVERSED)
 */
const fmtInr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const keyOf = (employeeId: string, date: string, amount: number, reason: string) => `${employeeId}:${date}:${amount.toFixed(2)}:${reason}`;
const link = (month: string) => `/my-payable-days?month=${month}`;
/** "19/11/2026" — or "the month of November 2026" for a whole-month penalty (no date) */
const whenOf = (date: string | undefined, month: string) => (date ? fmtDate(date) : `the month of ${monthLabel(month)}`);
const whenRow = (date: string | undefined, month: string) => (date ? { label: 'Date', value: fmtDate(date) } : { label: 'Month', value: `${monthLabel(month)} (whole month)` });

/** amount / reason / explanation checks shared by apply and edit */
function readFields(b: any): { amount: number; reasonCategory: string; explanation: string } | { error: string } {
    const raw = typeof b.amount === 'number' ? b.amount : Number(String(b.amount ?? '').trim());
    if (!Number.isFinite(raw) || raw <= 0) return { error: 'Enter a penalty amount greater than ₹0.' };
    if (!/^\d+(\.\d{1,2})?$/.test(String(b.amount).trim())) return { error: 'The amount can have at most 2 decimal places.' };
    if (raw > MAX_PENALTY_AMOUNT) return { error: `The amount cannot be more than ${fmtInr(MAX_PENALTY_AMOUNT)}.` };
    const reasonCategory = String(b.reasonCategory || '');
    if (!PENALTY_REASONS.includes(reasonCategory)) return { error: 'Choose the penalty reason.' };
    const explanation = String(b.explanation || '').trim().replace(/[ \t]+/g, ' ').slice(0, 3000);
    if (!explanation) return { error: reasonCategory === 'Other' ? 'Write the reason for "Other".' : 'Explain why this penalty is being applied.' };
    return { amount: Math.round(raw * 100) / 100, reasonCategory, explanation };
}

async function actorOrError() {
    await dbConnect();
    const actor: any = await getSessionUser({ ignoreDelegation: true });
    if (!actor) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!canCorrectPayable(actor)) return { res: NextResponse.json({ error: 'Only HR or HR Executive can apply or change monetary penalties.' }, { status: 403 }) };
    return { actor };
}

const monthTotal = async (employeeId: string, month: string) =>
    Math.round(((await HrMonetaryPenalty.find({ employeeId, month, status: 'ACTIVE' }).select('amount').lean()) as any[]).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;

export async function POST(req: Request) {
    try {
        const { actor, res } = await actorOrError(); if (res) return res;
        const b = await req.json().catch(() => ({}));
        const wholeMonth = !b.date && b.wholeMonth === true;
        const employeeId = String(b.employeeId || ''), date = wholeMonth ? '' : String(b.date || '');
        const month = wholeMonth ? String(b.month || '') : date.slice(0, 7);
        if (wholeMonth) {
            if (!isMonth(month)) return NextResponse.json({ error: 'Choose a valid month.' }, { status: 400 });
            if (month > istToday().slice(0, 7)) return NextResponse.json({ error: 'A penalty cannot be applied to a future month.' }, { status: 400 });
        } else {
            if (!isYmd(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
            if (date > istToday()) return NextResponse.json({ error: 'A penalty cannot be applied to a future date.' }, { status: 400 });
        }
        if (employeeId === actor.id) return NextResponse.json({ error: 'You cannot apply a penalty to your own salary.' }, { status: 403 });
        const f = readFields(b);
        if ('error' in f) return NextResponse.json({ error: f.error }, { status: 400 });
        const emp: any = await Employee.findOne({ id: employeeId }).lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        const calc = await payableDaysFor(emp, month);
        if (wholeMonth) {
            if (!calc.days.some((d: any) => d.payableStatus !== 'Not Employed' && d.payableStatus !== 'Upcoming')) return NextResponse.json({ error: 'The employee was not employed in this month.' }, { status: 400 });
        } else {
            const row: any = calc.days.find(d => d.date === date);
            if (!row || row.payableStatus === 'Not Employed') return NextResponse.json({ error: 'The employee was not employed on this date.' }, { status: 400 });
            if (row.payableStatus === 'Upcoming') return NextResponse.json({ error: 'This date has not happened yet.' }, { status: 400 });
        }

        const now = nowIso(), role = actorRoleLabel(actor);
        const before = await monthTotal(employeeId, month);
        const doc = {
            id: `MP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            activeKey: keyOf(employeeId, date || `MONTH-${month}`, f.amount, f.reasonCategory), employeeId, employeeName: emp.name, month, ...(date ? { date } : {}), ...f,
            createdBy: actor.id, createdByName: actor.name, createdByRole: role, createdAt: now, status: 'ACTIVE',
            history: [{ at: now, by: actor.id, byName: actor.name, role, action: 'Applied', before: null, after: f, note: '' }],
        };
        try { await HrMonetaryPenalty.create(doc); }
        catch (e: any) { if (e?.code === 11000) return NextResponse.json({ error: `The same penalty (${fmtInr(f.amount)} · ${f.reasonCategory}) is already applied for ${whenOf(date, month)}.` }, { status: 409 }); throw e; }
        const emailStatus = await notifySalaryAdjustment(emp, 'Salary Deduction Notification',
            'This is to inform you that a monetary deduction has been recorded against your salary.',
            [
                { label: 'Employee ID', value: emp.id }, whenRow(date, month), { label: 'Deduction Amount', value: fmtInr(f.amount) },
                { label: 'Reason', value: f.reasonCategory }, { label: 'Explanation', value: f.explanation },
            ], 'The applicable deduction will be reflected in your salary calculation.', link(month), actor, doc.id);
        await HrMonetaryPenalty.updateOne({ id: doc.id }, { $set: { emailStatus } });
        const after = await monthTotal(employeeId, month);
        return NextResponse.json({ success: true, id: doc.id, previousTotal: before, updatedTotal: after, message: `${fmtInr(f.amount)} penalty applied to ${emp.name} for ${whenOf(date, month)}. The employee has been notified.` });
    } catch (e: any) {
        console.error('monetary penalty POST', e);
        return NextResponse.json({ error: 'Could not apply the penalty.' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { actor, res } = await actorOrError(); if (res) return res;
        const b = await req.json().catch(() => ({}));
        const p: any = await HrMonetaryPenalty.findOne({ id: String(b.id || '') }).lean();
        if (!p) return NextResponse.json({ error: 'Penalty not found.' }, { status: 404 });
        if (p.employeeId === actor.id) return NextResponse.json({ error: 'You cannot change your own salary adjustments.' }, { status: 403 });
        if (p.status !== 'ACTIVE') return NextResponse.json({ error: 'This penalty is already reversed.' }, { status: 409 });
        const emp: any = await Employee.findOne({ id: p.employeeId }).lean();
        const now = nowIso(), role = actorRoleLabel(actor);
        const old = { amount: p.amount, reasonCategory: p.reasonCategory, explanation: p.explanation };

        if (b.action === 'reverse') {
            const reason = String(b.reason || '').trim();
            if (!meaningfulReason(reason)) return NextResponse.json({ error: 'Write a proper reversal reason (at least 20 characters, a full sentence).' }, { status: 400 });
            const upd = await HrMonetaryPenalty.findOneAndUpdate({ id: p.id, status: 'ACTIVE' }, {
                $set: { status: 'REVERSED', activeKey: `${p.activeKey}:REVERSED:${p.id}`, reversedBy: actor.id, reversedByName: actor.name, reversedByRole: role, reversedAt: now, reversalReason: reason.slice(0, 3000) },
                $push: { history: { at: now, by: actor.id, byName: actor.name, role, action: 'Reversed', before: old, after: null, note: reason.slice(0, 3000) } },
            }, { new: true }).lean();
            if (!upd) return NextResponse.json({ error: 'This penalty is already reversed.' }, { status: 409 });
            if (emp) await notifySalaryAdjustment(emp, 'Salary Deduction Reversed',
                'This is to inform you that a monetary deduction recorded against your salary has been reversed.',
                [{ label: 'Employee ID', value: emp.id }, whenRow(p.date, p.month), { label: 'Reversed Amount', value: fmtInr(p.amount) }, { label: 'Reason for Reversal', value: reason }],
                'Your salary calculation will be updated accordingly.', link(p.month), actor, p.id);
            return NextResponse.json({ success: true, updatedTotal: await monthTotal(p.employeeId, p.month), message: `${fmtInr(p.amount)} penalty for ${whenOf(p.date, p.month)} reversed. The employee has been notified.` });
        }

        if (b.action !== 'edit') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        const f = readFields(b);
        if ('error' in f) return NextResponse.json({ error: f.error }, { status: 400 });
        const note = String(b.note || '').trim().slice(0, 3000);
        if (note.length < 10) return NextResponse.json({ error: 'Write why the penalty is being corrected (at least 10 characters).' }, { status: 400 });
        if (f.amount === p.amount && f.reasonCategory === p.reasonCategory && f.explanation === p.explanation) return NextResponse.json({ error: 'Nothing changed.' }, { status: 400 });
        try {
            const upd = await HrMonetaryPenalty.findOneAndUpdate({ id: p.id, status: 'ACTIVE' }, {
                $set: { ...f, activeKey: keyOf(p.employeeId, p.date || `MONTH-${p.month}`, f.amount, f.reasonCategory), updatedBy: actor.id, updatedByName: actor.name, updatedByRole: role, updatedAt: now },
                $push: { history: { at: now, by: actor.id, byName: actor.name, role, action: 'Corrected', before: old, after: f, note } },
            }, { new: true }).lean();
            if (!upd) return NextResponse.json({ error: 'This penalty is already reversed.' }, { status: 409 });
        } catch (e: any) { if (e?.code === 11000) return NextResponse.json({ error: `The same penalty (${fmtInr(f.amount)} · ${f.reasonCategory}) is already applied for ${whenOf(p.date, p.month)}.` }, { status: 409 }); throw e; }
        if (emp) await notifySalaryAdjustment(emp, 'Salary Deduction Notification',
            'This is to inform you that a monetary deduction recorded against your salary has been corrected.',
            [
                { label: 'Employee ID', value: emp.id }, whenRow(p.date, p.month),
                { label: 'Previous Amount', value: fmtInr(p.amount) }, { label: 'Deduction Amount', value: fmtInr(f.amount) },
                { label: 'Reason', value: f.reasonCategory }, { label: 'Explanation', value: f.explanation },
            ], 'The applicable deduction will be reflected in your salary calculation.', link(p.month), actor, p.id);
        return NextResponse.json({ success: true, updatedTotal: await monthTotal(p.employeeId, p.month), message: `Penalty for ${whenOf(p.date, p.month)} corrected (${fmtInr(p.amount)} → ${fmtInr(f.amount)}). The employee has been notified.` });
    } catch (e: any) {
        console.error('monetary penalty PATCH', e);
        return NextResponse.json({ error: 'Could not update the penalty.' }, { status: 500 });
    }
}