import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import dbConnect from '@/lib/mongodb';
import { Holiday, Employee, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { isValidYmd, addDays } from '@/lib/academic';
import { removeFlagsForHolidays } from '@/lib/holiday-flag-removal';

export const dynamic = 'force-dynamic';

/**
 * HR / HR Executive / Founder → "Manually Assign Holiday" (Holiday Approval page). NO e-mail, NO announcement.
 * The holiday is saved like every other approved holiday (one record per day), so it shows everywhere holidays are
 * used: attendance, payable days / salary, dashboards, flag calendar.
 *   POST { name, date, endDate?, scope: 'ALL' | 'COLLEGES' | 'EMPLOYEES', collegeIds?, employeeIds?, reason?, preview? }
 *   preview: true → only the plan (which college / person + date is new, which is "Already assigned"); nothing saved.
 * Days that already have a holiday for that college / person are never created twice — they show "Already assigned".
 */
const MAX_DAYS = 31;
const INACTIVE = ['Inactive', 'Removed', 'Exited', 'Resigned', 'Terminated']; // same list as college announcements

type Target = { key: string; label: string; forAll: boolean; collegeIds: string[]; employeeIds: string[]; employeeNames: string[]; empLocation?: string };

/** existing holiday covers everyone (all-college) — the same reading payable days use */
const isAll = (h: any) => !(h.employeeIds || []).length && (h.forAll || !(h.collegeIds || []).length);
const covers = (h: any, t: Target) => {
    const emp = h.employeeIds || [];
    if (t.forAll) return isAll(h);
    if (t.employeeIds.length) return emp.includes(t.employeeIds[0]) || (!emp.length && !(h.excludedEmployeeIds || []).includes(t.employeeIds[0]) && (isAll(h) || (!!t.empLocation && (h.collegeIds || []).includes(t.empLocation))));
    return !emp.length && (isAll(h) || (h.collegeIds || []).includes(t.collegeIds[0]));
};

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['HR', 'FOUNDER'].includes(actor.role)) return NextResponse.json({ error: 'Only HR / HR Executive can assign a holiday.' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const name = String(body.name || '').trim().slice(0, 200);
        const date = String(body.date || '');
        const endDate = body.endDate ? String(body.endDate) : date;
        const reason = String(body.reason || '').trim().slice(0, 500);
        const scope = String(body.scope || '');
        if (name.length < 2) return NextResponse.json({ error: 'Enter the holiday name.' }, { status: 400 });
        if (!isValidYmd(date)) return NextResponse.json({ error: 'Select the "From" date.' }, { status: 400 });
        if (!isValidYmd(endDate)) return NextResponse.json({ error: 'Select a valid "To" date.' }, { status: 400 });
        if (endDate < date) return NextResponse.json({ error: 'The "To" date cannot be before the "From" date.' }, { status: 400 });
        const dates: string[] = [];
        for (let d = date; d <= endDate; d = addDays(d, 1)) { dates.push(d); if (dates.length > MAX_DAYS) return NextResponse.json({ error: `A holiday can cover at most ${MAX_DAYS} days.` }, { status: 400 }); }

        // Who gets the holiday
        const targets: Target[] = [];
        if (scope === 'ALL') targets.push({ key: 'ALL', label: 'All colleges (everyone)', forAll: true, collegeIds: [], employeeIds: [], employeeNames: [] });
        else if (scope === 'COLLEGES') {
            const ids = Array.from(new Set((Array.isArray(body.collegeIds) ? body.collegeIds : []).map((x: any) => String(x || '')).filter(Boolean))) as string[];
            if (!ids.length) return NextResponse.json({ error: 'Select at least one college.' }, { status: 400 });
            const locs: any[] = await Location.find({ id: { $in: ids } }).select('id name shortName').lean();
            if (locs.length !== ids.length) return NextResponse.json({ error: 'Unknown college selected.' }, { status: 400 });
            ids.forEach(id => { const l = locs.find(x => x.id === id); targets.push({ key: id, label: l?.name || l?.shortName || id, forAll: false, collegeIds: [id], employeeIds: [], employeeNames: [] }); });
        } else if (scope === 'EMPLOYEES') {
            const ids = Array.from(new Set((Array.isArray(body.employeeIds) ? body.employeeIds : []).map((x: any) => String(x || '')).filter(Boolean))) as string[];
            if (!ids.length) return NextResponse.json({ error: 'Select at least one employee.' }, { status: 400 });
            if (ids.length > 300) return NextResponse.json({ error: 'Select at most 300 employees at a time.' }, { status: 400 });
            const emps: any[] = await Employee.find({ id: { $in: ids }, isRemoved: { $ne: true }, status: { $nin: INACTIVE } }).select('id name location').lean();
            if (emps.length !== ids.length) return NextResponse.json({ error: 'Some selected employees were not found or are not active.' }, { status: 400 });
            // an employee's college may be stored as its name / short name → match holidays by the Location id
            const locs: any[] = await Location.find({}).select('id name shortName').lean();
            const locId = (v?: string) => (v ? (locs.find(l => l.id === v || l.name === v || l.shortName === v)?.id || v) : '');
            ids.forEach(id => { const e = emps.find(x => x.id === id); targets.push({ key: id, label: `${e.name} (${id})`, forAll: false, collegeIds: [], employeeIds: [id], employeeNames: [e.name], empLocation: locId(e.location) }); });
        } else return NextResponse.json({ error: 'Choose who gets the holiday: all colleges, colleges or employees.' }, { status: 400 });

        // Plan: every target × date → new, or already assigned (an approved holiday already covers it)
        const existing: any[] = await Holiday.find({ date: { $in: dates }, status: 'Approved' }).select('id name date forAll collegeIds employeeIds excludedEmployeeIds').lean();
        const plan = targets.flatMap(t => dates.map(d => {
            const hit = existing.find(h => h.date === d && covers(h, t));
            return { target: t.key, label: t.label, date: d, status: hit ? 'ALREADY' as const : 'NEW' as const, existingName: hit?.name || '' };
        }));
        const toCreate = plan.filter(p => p.status === 'NEW');
        const summary = { newCount: toCreate.length, alreadyCount: plan.length - toCreate.length };
        if (body.preview) return NextResponse.json({ plan, ...summary });
        if (!toCreate.length) return NextResponse.json({ error: 'Already assigned — every selected college / employee already has a holiday on these dates.', plan, ...summary }, { status: 409 });

        const now = new Date().toISOString();
        const batchId = `HM${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.toUpperCase();
        const created: string[] = [];
        try {
            for (const p of toCreate) {
                const t = targets.find(x => x.key === p.target)!;
                const id = `HOLM-${batchId}-${t.key}-${p.date}`;
                await Holiday.create({
                    id, name, date: p.date, status: 'Approved', forAll: t.forAll, collegeIds: t.collegeIds,
                    ...(t.employeeIds.length ? { employeeIds: t.employeeIds, employeeNames: t.employeeNames } : {}),
                    source: 'HR_MANUAL', assignedManually: true, batchId, reason, customMessage: reason, description: reason,
                    proposedBy: actor.id, proposedByName: actor.name, proposedAt: now, approvedBy: actor.id, approvedByName: actor.name, approvedAt: now, createdAt: now,
                    // no e-mail for a manual assignment (nothing is ever sent for it)
                });
                created.push(id);
            }
        } catch (e) {
            if (created.length) await Holiday.deleteMany({ id: { $in: created } }).catch(() => { });
            throw e;
        }
        const days = await Holiday.find({ id: { $in: created } }).lean();
        // the attendance flags of these holiday days are removed (no e-mail) — payable days and the warning ladder skip them
        const flags = await removeFlagsForHolidays(days as any[], actor);
        return NextResponse.json({ success: true, batchId, created: created.length, plan, ...summary, days, flagsRemoved: flags.removed,
            message: `Holiday assigned: ${created.length} day${created.length === 1 ? '' : 's'} added${summary.alreadyCount ? `, ${summary.alreadyCount} already assigned (skipped)` : ''}${flags.removed ? `, ${flags.removed} attendance flag${flags.removed === 1 ? '' : 's'} removed` : ''}. No e-mail was sent.` });
    } catch (error: any) {
        console.error('manual holiday', error);
        return NextResponse.json({ error: 'Could not assign the holiday.' }, { status: 500 });
    }
}