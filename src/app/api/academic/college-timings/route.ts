import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan } from '@/models/Schemas';
import { CollegeTiming } from '@/models/CollegeTiming';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, resolveCollege, nowISO, zonedNow, mondayOf } from '@/lib/academic';
import { PROFESSOR_ROLES } from '@/lib/academic-status';
import { HM_RE, toMin, fmt12, fmtDate, collegeOfEmployee, collegeProfessorIds } from '@/lib/sprint-plan-rules';

export const dynamic = 'force-dynamic';

/**
 * Shared college timings for the Sprint Plan timetable (one start / end time per college).
 *  GET  → the viewer's college + its timing. Professors always get their own college (Employee.location);
 *         org-wide roles / HOI may pass ?college=<location id or name> inside their scope.
 *  PUT  { startTime, endTime, version } → a professor of that college sets / updates it for every week.
 *         Blocked (409) when today's or future classes of that college would fall outside the new hours,
 *         or when someone else changed the timing meanwhile (version mismatch).
 */
async function targetCollege(actor: any, requested: string | null) {
    if (PROFESSOR_ROLES.includes(actor.role) || !requested) return collegeOfEmployee(actor.employee);
    const c = await resolveCollege(requested);
    if (!c) return null;
    const scope = await getAcademicScope(actor);
    if (!scope.orgWide && !scope.colleges.some(x => x.id === c.id)) return 'forbidden' as const;
    return { id: c.id, name: c.name, keys: c.keys };
}

const view = (t: any) => t ? {
    startTime: t.startTime, endTime: t.endTime, version: t.version || 1,
    configuredByName: t.configuredByName, configuredAt: t.configuredAt,
    updatedByName: t.updatedByName, updatedAt: t.updatedAt,
    history: (t.history || []).slice(-10).reverse(),
} : null;

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const college = await targetCollege(actor, new URL(req.url).searchParams.get('college'));
        if (college === 'forbidden') return NextResponse.json({ error: 'This college is outside your access.' }, { status: 403 });
        if (!college) return NextResponse.json({ success: true, college: null, timing: null, canEdit: false });
        const timing = await CollegeTiming.findOne({ collegeId: college.id }).lean();
        const mine = PROFESSOR_ROLES.includes(actor.role) && (await collegeOfEmployee(actor.employee))?.id === college.id;
        return NextResponse.json({ success: true, college: { id: college.id, name: college.name }, timing: view(timing), canEdit: mine });
    } catch (e: any) {
        console.error('college-timings GET', e);
        return NextResponse.json({ error: 'Could not load college timings.' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!PROFESSOR_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Only professors of the college can set its timings.' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const college = await collegeOfEmployee(actor.employee);
        if (!college) return NextResponse.json({ error: 'Your college is not set in your profile. Ask HR to set your location.' }, { status: 400 });
        // A professor can only change their own college — a college sent by the browser is ignored unless it is theirs
        if (body.college && body.college !== college.id && body.college !== college.name) {
            return NextResponse.json({ error: 'You can only set the timings of your own college.' }, { status: 403 });
        }
        const startTime = String(body.startTime || '').trim(), endTime = String(body.endTime || '').trim();
        if (!HM_RE.test(startTime) || !HM_RE.test(endTime)) return NextResponse.json({ error: 'Enter a valid start and end time.' }, { status: 400 });
        if (toMin(startTime) >= toMin(endTime)) return NextResponse.json({ error: 'The college start time must be before the end time.' }, { status: 400 });

        // Classes of this college from today onwards that would be outside the new hours
        const today = zonedNow().ymd;
        const ids = await collegeProfessorIds(college.keys);
        const plans: any[] = ids.length ? await SprintPlan.find({ facultyId: { $in: ids }, weekStartDate: { $gte: mondayOf(today) } }).select('facultyName entries').lean() : [];
        const outside: string[] = [];
        for (const p of plans) for (const e of p.entries || []) {
            if (e.date >= today && (toMin(e.timeStart) < toMin(startTime) || toMin(e.timeStop) > toMin(endTime))) {
                outside.push(`${p.facultyName} — ${e.subjectName || 'Class'}, ${fmtDate(e.date)} ${fmt12(e.timeStart)} – ${fmt12(e.timeStop)}`);
            }
        }
        if (outside.length) {
            return NextResponse.json({
                error: `${outside.length} scheduled class(es) would be outside ${fmt12(startTime)} – ${fmt12(endTime)}. Move those classes first, or choose wider hours.`,
                conflicts: outside.slice(0, 50),
            }, { status: 409 });
        }

        const now = nowISO();
        const existing: any = await CollegeTiming.findOne({ collegeId: college.id }).lean();
        if (!existing) {
            try {
                const created = await CollegeTiming.create({
                    collegeId: college.id, collegeName: college.name, startTime, endTime,
                    configuredBy: actor.id, configuredByName: actor.name, configuredAt: now,
                    updatedBy: actor.id, updatedByName: actor.name, updatedAt: now, version: 1,
                    history: [{ at: now, by: actor.id, byName: actor.name, fromStart: '', fromEnd: '', toStart: startTime, toEnd: endTime }],
                });
                return NextResponse.json({ success: true, message: 'College timings saved for all weeks.', timing: view(created.toObject()) });
            } catch (e: any) {
                if (e?.code === 11000) return NextResponse.json({ error: 'Another professor just set the college timings. Refresh to see them.' }, { status: 409 });
                throw e;
            }
        }
        if (existing.startTime === startTime && existing.endTime === endTime) {
            return NextResponse.json({ success: true, message: 'No change — the college timings are the same.', timing: view(existing) });
        }
        const version = Number(body.version);
        if (!Number.isFinite(version) || version !== (existing.version || 1)) {
            return NextResponse.json({ error: `The college timings were changed by ${existing.updatedByName || 'another professor'} meanwhile (now ${fmt12(existing.startTime)} – ${fmt12(existing.endTime)}). Refresh and try again.`, timing: view(existing) }, { status: 409 });
        }
        const updated: any = await CollegeTiming.findOneAndUpdate(
            { collegeId: college.id, version: existing.version || 1 },
            {
                $set: { startTime, endTime, collegeName: college.name, updatedBy: actor.id, updatedByName: actor.name, updatedAt: now, version: (existing.version || 1) + 1 },
                $push: { history: { at: now, by: actor.id, byName: actor.name, fromStart: existing.startTime, fromEnd: existing.endTime, toStart: startTime, toEnd: endTime } },
            },
            { new: true }
        ).lean();
        if (!updated) return NextResponse.json({ error: 'The college timings were changed by another professor meanwhile. Refresh and try again.' }, { status: 409 });
        return NextResponse.json({ success: true, message: 'College timings updated for all weeks.', timing: view(updated) });
    } catch (e: any) {
        console.error('college-timings PUT', e);
        return NextResponse.json({ error: 'Could not save college timings.' }, { status: 500 });
    }
}