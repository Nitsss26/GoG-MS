import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan, LectureReport } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, professorsInScope, selectableColleges, mondayOf, addDays, zonedNow, isValidYmd, hasClassEnded } from '@/lib/academic';
import { effectiveEntries } from '@/lib/class-record-workflow';
import { getPlanStatus, getClassStatus, CALENDAR_ROLES, PROFESSOR_ROLES } from '@/lib/academic-status';

export const dynamic = 'force-dynamic';

/**
 * Weekly Calendar (Modules 21–23): classes of submitted / locked sprint plans for one Mon–Sat week.
 * Query: week (any date in the week, default this week), view = mine | college, college, facultyId
 * The college scope is applied here on the server; filters in the page only narrow what the server allowed.
 * A plan that is being revised (Unlocked for Revision) shows its last submitted version.
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!CALENDAR_ROLES.includes(actor.role)) return NextResponse.json({ error: 'The weekly calendar is not available for your role.' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const weekParam = searchParams.get('week');
        const anyDay = weekParam && isValidYmd(weekParam) ? weekParam : zonedNow().ymd;
        const weekStart = mondayOf(anyDay);
        const weekEnd = addDays(weekStart, 5);
        const isProf = PROFESSOR_ROLES.includes(actor.role);
        const view = isProf && searchParams.get('view') !== 'college' ? 'mine' : 'college';

        const scope = await getAcademicScope(actor);
        let professors: any[] = view === 'mine' ? [actor.employee] : await professorsInScope(scope, searchParams.get('college'));
        const allProfessors = professors.map((p: any) => ({ id: p.id, name: p.name, location: p.location }));
        const facultyId = searchParams.get('facultyId');
        if (facultyId && facultyId !== 'All') professors = professors.filter((p: any) => p.id === facultyId);
        const profMap = new Map(professors.map((p: any) => [p.id, p]));

        const plans: any[] = await SprintPlan.find({
            facultyId: { $in: Array.from(profMap.keys()) },
            weekStartDate: { $lte: weekEnd }, weekEndDate: { $gte: weekStart },
        }).lean();
        const reports: any[] = await LectureReport.find({
            facultyId: { $in: Array.from(profMap.keys()) }, date: { $gte: weekStart, $lte: weekEnd },
        }).select('facultyId date lectureNumber sprintEntryId pipelineStatus status notesMissing assignment.hasAssignment numberOfAttendees totalStudents').lean();

        const classes: any[] = [];
        for (const plan of plans) {
            const status = getPlanStatus(plan);
            // Only submitted / approved plans appear (a professor also sees their own draft in "My Schedule")
            if (status === 'DRAFT' && !(view === 'mine' && plan.facultyId === actor.id)) continue;
            const entries = effectiveEntries(plan);
            const prof: any = profMap.get(plan.facultyId);
            const byDate: Record<string, number> = {};
            entries.forEach((e: any) => {
                if (!e.date || e.date < weekStart || e.date > weekEnd) return;
                byDate[e.date] = (byDate[e.date] || 0) + 1;
                const num = byDate[e.date];
                const rep = reports.find(r => r.facultyId === plan.facultyId && r.date === e.date && (r.sprintEntryId ? r.sprintEntryId === String(e._id) : r.lectureNumber === num));
                classes.push({
                    id: `${plan._id}-${e._id}`,
                    planId: String(plan._id), planStatus: status, sprintEntryId: String(e._id), lectureNumber: num,
                    facultyId: plan.facultyId, facultyName: plan.facultyName || prof?.name, college: prof?.location || plan.college,
                    day: e.day, date: e.date, timeStart: e.timeStart, timeStop: e.timeStop,
                    subjectCode: e.subjectCode, subjectName: e.subjectName, topics: e.topics, content: e.content,
                    lectureType: e.lectureType, unitNumber: e.unitNumber, className: e.className,
                    section: e.section, branch: e.stream, year: e.year, semester: e.semester,
                    recordId: rep ? String(rep._id) : null,
                    recordStatus: rep ? getClassStatus(rep) : 'PENDING_PROFESSOR',
                    notesMissing: !!rep?.notesMissing,
                    hasAssignment: !!rep?.assignment?.hasAssignment,
                    attendance: rep?.totalStudents ? `${rep.numberOfAttendees}/${rep.totalStudents}` : null,
                    classEnded: hasClassEnded(e.date, e.timeStop),
                });
            });
        }
        classes.sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart));

        return NextResponse.json({
            success: true, weekStart, weekEnd, view, classes,
            professors: allProfessors,
            colleges: isProf ? scope.colleges : await selectableColleges(scope),
            orgWide: scope.orgWide,
        });
    } catch (error: any) {
        console.error('weekly-calendar GET error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
