import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { managedEmployeeIds } from '@/lib/leave-scope';
import { hoisAbove } from '@/lib/academic';
import { sendMailInternal } from '@/lib/mail-server';
import { getFeedbackUpdatedTemplate } from '@/lib/mail-templates';

export const dynamic = 'force-dynamic';

/** Roles that may give / update monthly feedback (same as the Monthly Feedback page) */
const RATER_ROLES = ['FOUNDER', 'AD', 'HOI', 'TL'];

/**
 * PUT { employeeId, period, score, points, comment, screenshotUrl }
 * Updates the EXISTING monthly feedback of that employee for that period (no new record, other months untouched).
 * Only a rater whose reporting scope contains the employee (Founder: everyone); never one's own feedback.
 * Keeps the original submission date; stores updated-by / updated-at and the previous values in history.
 * When something changed: one e-mail → To: the employee, CC: the employee's own HOI(s) (from MongoDB).
 */
export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!RATER_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Only an authorised HOI / manager can update monthly feedback.' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const employeeId = String(body.employeeId || ''), period = String(body.period || '');
        if (!employeeId || !period) return NextResponse.json({ error: 'Employee and period are required.' }, { status: 400 });
        if (employeeId === actor.id) return NextResponse.json({ error: 'You cannot update your own feedback.' }, { status: 403 });
        if (actor.role !== 'FOUNDER') {
            const scope = await managedEmployeeIds(actor);
            if (!scope.has(employeeId)) return NextResponse.json({ error: 'This employee is not in your reporting scope.' }, { status: 403 });
        }
        const score = Number(body.score), points = Math.round(Number(body.points));
        if (!(score >= 1 && score <= 5) || !Number.isFinite(points)) return NextResponse.json({ error: 'Invalid score or points.' }, { status: 400 });
        const comment = String(body.comment ?? '').slice(0, 4000);
        const screenshotUrl = String(body.screenshotUrl ?? '');
        if (screenshotUrl && !/^https:\/\//i.test(screenshotUrl)) return NextResponse.json({ error: 'Invalid screenshot link.' }, { status: 400 });

        const emp: any = await Employee.findOne({ id: employeeId }).select('id name email monthlyScores').lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        const scores: any[] = Array.isArray(emp.monthlyScores) ? emp.monthlyScores : [];
        const idx = scores.findIndex(s => s.period === period);
        if (idx < 0) return NextResponse.json({ error: 'No feedback exists for this month yet — use Give Feedback.' }, { status: 404 });
        const old = scores[idx];
        const changed = Number(old.score) !== score || Number(old.points) !== points || String(old.comment || '') !== comment || String(old.screenshotUrl || '') !== screenshotUrl;
        if (!changed) return NextResponse.json({ success: true, unchanged: true, message: 'No changes to save.', feedback: old });

        const now = new Date().toISOString();
        const updatedEntry = {
            ...old, score, points, comment, screenshotUrl,          // date (original submission) and ratedBy are kept
            updatedAt: now, updatedBy: actor.id, updatedByName: actor.name,
            history: [...(old.history || []), { at: now, by: actor.id, byName: actor.name, previous: { score: old.score, points: old.points, comment: old.comment || '', screenshotUrl: old.screenshotUrl || '', updatedAt: old.updatedAt || old.date } }],
        };
        const next = scores.map((s, i) => (i === idx ? updatedEntry : s));
        // only this employee's record; the period entry is replaced in place (no duplicate, other months unchanged)
        const res = await Employee.updateOne({ id: employeeId, 'monthlyScores.period': period }, { $set: { monthlyScores: next } });
        if (!res.matchedCount) return NextResponse.json({ error: 'The feedback changed meanwhile. Please reload.' }, { status: 409 });

        // E-mail: employee + own HOI(s) only
        let emailStatus = 'NO_EMAIL';
        if (emp.email) {
            const hois = (await hoisAbove(employeeId)).filter((h: any) => h.email && h.id !== employeeId);
            const { subject, html } = getFeedbackUpdatedTemplate({ employeeName: emp.name, employeeId, period, updatedByName: actor.name, updatedAt: now });
            const r: any = await sendMailInternal({ to: emp.email, cc: hois.map((h: any) => h.email), subject, html });
            emailStatus = r?.success ? 'SENT' : 'FAILED';
            console.log(`[monthly-feedback] update ${employeeId} ${period} → employee + ${hois.length} HOI: ${r?.success ? 'accepted by SMTP' : 'failed'}`);
        }
        const saved = { ...updatedEntry, updateEmailStatus: emailStatus };
        await Employee.updateOne({ id: employeeId }, { $set: { monthlyScores: next.map((s, i) => (i === idx ? saved : s)) } });
        return NextResponse.json({ success: true, message: 'Feedback Updated Successfully', feedback: saved, monthlyScores: next.map((s, i) => (i === idx ? saved : s)), emailStatus });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}