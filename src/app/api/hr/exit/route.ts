import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, ExitRecord, ReimbursementClaim, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { removeEmployeeFromPortal } from '@/lib/employee-removal';
import { newId } from '@/lib/academic';

export const dynamic = 'force-dynamic';

/**
 * HR → Workforce → ⋮ → Delete Employee: mandatory exit checklist.
 *   GET  ?employeeId=…                     employee details (database), saved checklist, outstanding obligations
 *   POST { employeeId, action: "save" }    save the checklist as pending (any answers)
 *   POST { employeeId, action: "complete" } every mandatory item answered "Yes", no pending reimbursements
 *                                          in the database → checklist COMPLETED + soft removal
 */
const LEAVING_REASONS = ['Resigned', 'Terminated', 'Contract Completed', 'Retirement', 'Employee Record Created by Mistake', 'Other'];
const FINAL_STATUS: Record<string, string> = {
    'Resigned': 'Resigned', 'Terminated': 'Terminated', 'Contract Completed': 'Contract Completed',
    'Retirement': 'Retired', 'Employee Record Created by Mistake': 'Removed', 'Other': 'Exited',
};
const YN = ['YES', 'NO'];
const LABELS: Record<string, string> = {
    documentsSent: 'Offer / experience letter not sent',
    salarySettled: 'Salary settlement pending',
    assetsReturned: 'Company assets not returned',
    reimbursementsCleared: 'Reimbursement claims not cleared',
};

async function details(employeeId: string) {
    const emp: any = await Employee.findOne({ id: employeeId }).lean();
    if (!emp) return null;
    const loc: any = emp.location ? await Location.findOne({ $or: [{ id: emp.location }, { name: emp.location }, { shortName: emp.location }] }).select('name').lean() : null;
    return {
        id: emp.id, name: emp.name, email: emp.email, role: emp.role, dept: emp.dept || '', designation: emp.designation || '',
        location: loc?.name || emp.location || '', status: emp.status || 'Active',
    };
}
async function dbOutstanding(employeeId: string) {
    const pendingClaims = await ReimbursementClaim.countDocuments({ employeeId, status: 'Pending' });
    return { pendingReimbursements: pendingClaims };
}

/** Validates the answers; returns missing fields (unanswered) and outstanding items (answered "No") */
function check(b: any) {
    const missing: string[] = [];
    const outstanding: string[] = [];
    for (const k of ['documentsSent', 'salarySettled', 'assetsReturned', 'reimbursementsCleared']) {
        if (!YN.includes(b[k])) missing.push(k);
        else if (b[k] === 'NO') outstanding.push(LABELS[k]);
    }
    if (!b.lastWorkingDay || !/^\d{4}-\d{2}-\d{2}$/.test(b.lastWorkingDay) || isNaN(new Date(b.lastWorkingDay + 'T00:00:00Z').getTime())) missing.push('lastWorkingDay');
    if (!LEAVING_REASONS.includes(b.leavingReason)) missing.push('leavingReason');
    else if (b.leavingReason === 'Other' && String(b.leavingReasonOther || '').trim().length < 3) missing.push('leavingReasonOther');
    return { missing, outstanding };
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['HR', 'FOUNDER'].includes(actor.role)) return NextResponse.json({ error: 'Only HR can manage employee exits.' }, { status: 403 });
        const employeeId = new URL(req.url).searchParams.get('employeeId') || '';
        const employee = await details(employeeId);
        if (!employee) return NextResponse.json({ error: 'Active employee not found.' }, { status: 404 });
        const record = await ExitRecord.findOne({ employeeId, status: 'PENDING' }).sort({ createdAt: -1 }).lean();
        return NextResponse.json({ employee, record, db: await dbOutstanding(employeeId), reasons: LEAVING_REASONS });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['HR', 'FOUNDER'].includes(actor.role)) return NextResponse.json({ error: 'Only HR can manage employee exits.' }, { status: 403 });

        const b = await req.json().catch(() => ({}));
        const employeeId = String(b.employeeId || '');
        const action = String(b.action || '');
        if (!['save', 'complete'].includes(action)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
        const employee = await details(employeeId);
        if (!employee) return NextResponse.json({ error: 'Active employee not found (already removed?).' }, { status: 404 });
        if (employeeId === actor.id) return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
        if (employee.role === 'FOUNDER' && actor.role !== 'FOUNDER') return NextResponse.json({ error: 'Only a Founder can remove a Founder account.' }, { status: 403 });

        const answers = {
            documentsSent: YN.includes(b.documentsSent) ? b.documentsSent : undefined,
            salarySettled: YN.includes(b.salarySettled) ? b.salarySettled : undefined,
            assetsReturned: YN.includes(b.assetsReturned) ? b.assetsReturned : undefined,
            reimbursementsCleared: YN.includes(b.reimbursementsCleared) ? b.reimbursementsCleared : undefined,
            lastWorkingDay: typeof b.lastWorkingDay === 'string' ? b.lastWorkingDay : undefined,
            leavingReason: LEAVING_REASONS.includes(b.leavingReason) ? b.leavingReason : undefined,
            leavingReasonOther: b.leavingReason === 'Other' ? String(b.leavingReasonOther || '').trim().slice(0, 300) : '',
            remarks: String(b.remarks || '').trim().slice(0, 2000),
        };
        const { missing, outstanding } = check(answers);
        const db = await dbOutstanding(employeeId);
        if (db.pendingReimbursements > 0) outstanding.push(`${db.pendingReimbursements} reimbursement claim(s) still pending in the portal`);
        const now = new Date().toISOString();

        // one open checklist per employee: update it, or start one
        let record: any = await ExitRecord.findOne({ employeeId, status: 'PENDING' });
        if (!record) {
            record = new ExitRecord({ id: newId('EXIT'), employeeId, createdBy: actor.id, createdByName: actor.name, createdAt: now, history: [] });
        }
        Object.assign(record, answers, {
            employeeSnapshot: employee, outstanding: [...missing.map(m => `Missing: ${m}`), ...outstanding],
            updatedBy: actor.id, updatedByName: actor.name, updatedAt: now,
        });

        if (action === 'save') {
            record.history.push({ action: 'Saved as pending', by: actor.id, byName: actor.name, role: actor.role, at: now, note: outstanding.join('; ') });
            await record.save();
            return NextResponse.json({ success: true, message: 'Exit checklist saved. It can be completed later.', record, missing, outstanding });
        }

        // complete → strict
        if (missing.length) return NextResponse.json({ error: 'Answer every mandatory item before deleting.', missing, outstanding }, { status: 400 });
        if (outstanding.length) {
            record.history.push({ action: 'Deletion blocked', by: actor.id, byName: actor.name, role: actor.role, at: now, note: outstanding.join('; ') });
            await record.save();
            return NextResponse.json({ error: 'Exit formalities are still pending. The checklist was saved as pending.', missing, outstanding, record }, { status: 409 });
        }
        const finalStatus = FINAL_STATUS[answers.leavingReason!] || 'Exited';
        const removal = await removeEmployeeFromPortal(actor, employeeId, finalStatus);
        if (!removal.ok) return NextResponse.json({ error: removal.error }, { status: removal.status });

        Object.assign(record, {
            status: 'COMPLETED', outstanding: [], finalEmployeeStatus: `Removed from portal (${finalStatus})`,
            completedBy: actor.id, completedByName: actor.name, completedByRole: actor.role, completedAt: now,
        });
        record.history.push({ action: 'Exit completed — employee removed', by: actor.id, byName: actor.name, role: actor.role, at: now, note: `Last working day ${answers.lastWorkingDay}; reason ${answers.leavingReason}${answers.leavingReasonOther ? ` (${answers.leavingReasonOther})` : ''}` });
        await record.save();
        return NextResponse.json({ success: true, message: `${employee.name} was removed from the portal.`, record, cleaned: removal.cleaned });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
