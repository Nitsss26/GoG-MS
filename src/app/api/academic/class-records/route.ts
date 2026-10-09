import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, professorsInScope, selectableColleges, zonedNow, addDays, isValidYmd } from '@/lib/academic';
import { buildClassList, performClassAction, ensureRecordForClass, recordInScope } from '@/lib/class-record-workflow';
import { PROFESSOR_ROLES, VERIFICATION_ROLES } from '@/lib/academic-status';

export const dynamic = 'force-dynamic';

/**
 * Class records for the verification pages (college-scoped on the server).
 * Query: from, to (YYYY-MM-DD, default last 14 days), college, facultyId, record (one record id), planned=1 (include classes without a record)
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isProf = PROFESSOR_ROLES.includes(actor.role);
        if (!isProf && !VERIFICATION_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const today = zonedNow().ymd;
        const recordId = searchParams.get('record');

        if (recordId) {
            if (!mongoose.isValidObjectId(recordId)) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
            const r: any = await LectureReport.findById(recordId).lean();
            if (!r || !(await recordInScope(actor, r))) return NextResponse.json({ error: 'Record not found in your college.' }, { status: 404 });
            const one = (await buildClassList([{ id: r.facultyId }], r.date, r.date)).find((x: any) => String(x._id) === String(r._id));
            return NextResponse.json({ success: true, records: one ? [one] : [] });
        }

        let from = searchParams.get('from') || addDays(today, -13);
        let to = searchParams.get('to') || today;
        if (!isValidYmd(from) || !isValidYmd(to)) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
        if (from > to) [from, to] = [to, from];
        if (addDays(from, 92) < to) from = addDays(to, -92); // at most ~3 months per request

        const scope = await getAcademicScope(actor);
        let professors: any[] = isProf ? [actor.employee] : await professorsInScope(scope, searchParams.get('college'));
        const facultyId = searchParams.get('facultyId');
        if (facultyId && facultyId !== 'All') professors = professors.filter((p: any) => p.id === facultyId);

        const records = await buildClassList(professors, from, to, { includePlanned: searchParams.get('planned') === '1' });
        return NextResponse.json({
            success: true, from, to, records,
            professors: professors.map((p: any) => ({ id: p.id, name: p.name, location: p.location })),
            colleges: isProf ? [] : await selectableColleges(scope),
            orgWide: scope.orgWide,
        });
    } catch (error: any) {
        console.error('class-records GET error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Actions on a class record.
 * Body: { reportId } or { classRef: { facultyId, date, lectureNumber, sprintEntryId } } (a class without a record yet),
 *       action: om_verify_reason | om_verify | om_revert | submitted_to_group | om_times | clch_verify | clch_revert |
 *               hoi_verify | hoi_revert | flag_delay | resolve_flag | add_assignment | upload_notes
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const { reportId, classRef, ...input } = body || {};
        if (!input.action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

        let record: any = null;
        if (reportId && mongoose.isValidObjectId(reportId)) record = await LectureReport.findById(reportId);
        if (!record && classRef?.facultyId && classRef?.date) {
            if (PROFESSOR_ROLES.includes(actor.role) && classRef.facultyId !== actor.id) {
                return NextResponse.json({ error: 'You can only change your own class records.' }, { status: 403 });
            }
            // Check the college before creating anything for a class that has no record yet
            const probe = { facultyId: classRef.facultyId, college: '' };
            if (!(await recordInScope(actor, probe))) return NextResponse.json({ error: 'This class is not in your college.' }, { status: 403 });
            if (!['om_times', 'flag_delay', 'add_assignment'].includes(input.action)) {
                return NextResponse.json({ error: 'The professor has not submitted this class record yet.' }, { status: 409 });
            }
            record = await ensureRecordForClass(classRef.facultyId, classRef.date, Number(classRef.lectureNumber) || undefined, classRef.sprintEntryId);
        }
        if (!record) return NextResponse.json({ error: 'Class record not found' }, { status: 404 });

        const result = await performClassAction(actor, record, input);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, message: result.message, record: result.record });
    } catch (error: any) {
        console.error('class-records POST error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
