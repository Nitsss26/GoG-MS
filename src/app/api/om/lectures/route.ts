import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, SprintPlan, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, professorsInScope, selectableColleges } from '@/lib/academic';
import { recordInScope, ensureRecordForClass, classesOfDay } from '@/lib/class-record-workflow';
import { getPlanStatus, getClassStatus } from '@/lib/academic-status';

// Who may open the daily lecture timings page / record entry & exit times
const VIEW_ROLES = ["OM", "HOI", "AD", "FOUNDER", "CURRICULUM_LEAD", "CURRICULUM_HEAD"];
const WRITE_ROLES = ["OM"]; // HOI / AD / CL / CH: read-only here

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!VIEW_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { searchParams } = new URL(req.url);
        const campus = searchParams.get('campus');
        const date = searchParams.get('date');

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const targetDate = date || (istTime.getFullYear() + "-" +
            (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" +
            istTime.getDate().toString().padStart(2, '0'));

        const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const dayIdx = new Date(targetDate).getDay();
        const targetDay = dayNames[dayIdx];

        // Faculties of the viewer's college only (backend scope); the campus filter can only narrow it
        const scope = await getAcademicScope(actor);
        let faculties: any[] = await professorsInScope(scope);
        if (campus && campus !== "All") {
            faculties = await professorsInScope(scope, campus);
        }
        const facultyIds = faculties.map(f => f.id);

        // Fetch sprint plans containing targetDate
        const plans = await SprintPlan.find({
            facultyId: { $in: facultyIds },
            weekStartDate: { $lte: targetDate },
            weekEndDate: { $gte: targetDate }
        }).lean();

        // Fetch existing lecture reports for targetDate
        const reports = await LectureReport.find({
            date: targetDate,
            facultyId: { $in: facultyIds }
        }).lean();

        // Build combined daily lecture records for OM
        const combinedLectures: any[] = [];

        faculties.forEach(fac => {
            const facPlan = plans.find(p => p.facultyId === fac.id && getPlanStatus(p) !== 'DRAFT');
            const facReports = reports.filter(r => r.facultyId === fac.id);

            // Sprint entries for today
            const todayEntries = facPlan ? classesOfDay(facPlan, targetDate) : [];

            if (todayEntries.length > 0) {
                todayEntries.forEach((entry: any, idx: number) => {
                    const lecNum = idx + 1;
                    const existingReport = facReports.find(r => r.sprintEntryId && r.sprintEntryId === String(entry._id)) || facReports.find(r =>
                        !r.sprintEntryId && (r.lectureNumber === lecNum ||
                        (r.courseName === entry.subjectName && r.topicsCovered === entry.topics))
                    );

                    // Check if assignment is approved by CL but not yet shared in prof group by OM
                    const isAssignmentApprovedByCL = Boolean(existingReport?.assignment?.hasAssignment &&
                        ["approved", "verified"].includes(existingReport?.assignment?.verificationStatus?.toLowerCase()));
                    const isSharedInGroup = Boolean(existingReport?.assignment?.isSharedInProfGroup);
                    const isNotesApprovedByCL = Boolean(["approved", "verified"].includes(existingReport?.lectureNotes?.verificationStatus?.toLowerCase()));

                    combinedLectures.push({
                        id: existingReport?._id?.toString() || `${fac.id}-${targetDate}-${lecNum}`,
                        reportId: existingReport?._id?.toString(),
                        facultyId: fac.id,
                        facultyName: fac.name,
                        college: fac.location || "Campus",
                        date: targetDate,
                        day: targetDay,
                        lectureNumber: lecNum,
                        courseName: entry.subjectName || "Subject",
                        topicsCovered: entry.topics || "Topics",
                        timeStart: entry.timeStart || "09:20",
                        timeStop: entry.timeStop || "10:10",
                        stream: entry.stream || "",
                        section: entry.section || "",
                        semester: entry.semester || "",
                        // OM Timings
                        actualInTime: existingReport?.actualInTime || "",
                        actualOutTime: existingReport?.actualOutTime || "",
                        isLate: existingReport?.isLate || false,
                        remarksWhyLate: existingReport?.remarksWhyLate || "",
                        // Lecture Notes
                        lectureNotes: existingReport?.lectureNotes || {
                            isSharedWithStudents: false,
                            notSharedRemarks: "",
                            verificationStatus: "Pending"
                        },
                        isNotesApprovedByCL,
                        // Assignment
                        assignment: existingReport?.assignment || {
                            hasAssignment: false,
                            verificationStatus: "Pending",
                            isSharedInProfGroup: false
                        },
                        isAssignmentApprovedByCL,
                        isSharedInGroup,
                        // Bother flag: assignment verified by CL but OM hasn't shared it yet!
                        needsOMAssignmentShare: isAssignmentApprovedByCL && !isSharedInGroup,
                        // Overall green verification
                        clVerificationStatus: existingReport?.clVerificationStatus || "Pending",
                        isGoodToGo: existingReport?.clVerificationStatus === "Verified",
                        recordingUrl: existingReport?.recordingUrl,
                        status: existingReport?.status || "Scheduled",
                        sprintEntryId: String(entry._id || ""),
                        pipelineStatus: getClassStatus(existingReport),
                        submittedToGroup: Boolean(existingReport?.submittedToGroup),
                        submittedToGroupByName: existingReport?.submittedToGroupByName || "",
                        submittedToGroupAt: existingReport?.submittedToGroupAt || "",
                        omVerification: existingReport?.omVerification || null,
                        clChVerification: existingReport?.clChVerification || null,
                        hoiVerification: existingReport?.hoiVerification || null,
                        finalVerification: existingReport?.finalVerification || null,
                        omTimesUpdatedByName: existingReport?.omTimesUpdatedByName || "",
                        omTimesUpdatedAt: existingReport?.omTimesUpdatedAt || ""
                    });
                });
            } else if (facReports.length > 0) {
                // If reports were submitted without formal sprint entries
                facReports.forEach((r: any) => {
                    const isAssignmentApprovedByCL = Boolean(r.assignment?.hasAssignment &&
                        ["approved", "verified"].includes(r.assignment?.verificationStatus?.toLowerCase()));
                    const isSharedInGroup = Boolean(r.assignment?.isSharedInProfGroup);

                    combinedLectures.push({
                        id: r._id.toString(),
                        reportId: r._id.toString(),
                        facultyId: fac.id,
                        facultyName: fac.name,
                        college: r.college || fac.location,
                        date: targetDate,
                        day: targetDay,
                        lectureNumber: r.lectureNumber,
                        courseName: r.courseName,
                        topicsCovered: r.topicsCovered,
                        timeStart: r.classStartTime || "09:20",
                        timeStop: r.classEndTime || "10:10",
                        stream: r.stream || "",
                        section: "",
                        semester: r.semester || "",
                        actualInTime: r.actualInTime || "",
                        actualOutTime: r.actualOutTime || "",
                        isLate: r.isLate || false,
                        remarksWhyLate: r.remarksWhyLate || "",
                        lectureNotes: r.lectureNotes || { isSharedWithStudents: false, notSharedRemarks: "" },
                        isNotesApprovedByCL: r.lectureNotes?.verificationStatus === "Approved",
                        assignment: r.assignment || { hasAssignment: false, isSharedInProfGroup: false },
                        isAssignmentApprovedByCL,
                        isSharedInGroup,
                        needsOMAssignmentShare: isAssignmentApprovedByCL && !isSharedInGroup,
                        clVerificationStatus: r.clVerificationStatus || "Pending",
                        isGoodToGo: r.clVerificationStatus === "Verified",
                        recordingUrl: r.recordingUrl,
                        status: r.status || "Completed",
                        pipelineStatus: getClassStatus(r),
                        submittedToGroup: Boolean(r.submittedToGroup),
                        submittedToGroupByName: r.submittedToGroupByName || "",
                        submittedToGroupAt: r.submittedToGroupAt || "",
                        omTimesUpdatedByName: r.omTimesUpdatedByName || "",
                        omTimesUpdatedAt: r.omTimesUpdatedAt || "",
                        omVerification: r.omVerification || null,
                        clChVerification: r.clChVerification || null,
                        hoiVerification: r.hoiVerification || null,
                        finalVerification: r.finalVerification || null
                    });
                });
            }
        });

        return NextResponse.json({
            success: true,
            date: targetDate,
            day: targetDay,
            lectures: combinedLectures,
            colleges: await selectableColleges(scope)
        });
    } catch (error: any) {
        console.error("OM Lectures GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!WRITE_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Only the OM can update lecture timings.' }, { status: 403 });
        const body = await req.json();
        const {
            reportId,
            facultyId,
            date,
            lectureNumber,
            courseName,
            topicsCovered,
            actualInTime,
            actualOutTime,
            isLate,
            remarksWhyLate,
            notesShared,
            notesNotSharedRemarks,
            assignmentSharedInProfGroup,
        } = body;

        const now = new Date().toISOString();

        let report: any = null;
        if (reportId) {
            report = await LectureReport.findById(reportId);
        }
        if (!report && facultyId && date && lectureNumber) {
            report = await LectureReport.findOne({ facultyId, date, lectureNumber });
        }

        // College check before anything is created or changed
        if (!(await recordInScope(actor, report || { facultyId, college: '' }))) {
            return NextResponse.json({ error: 'This professor is not in your college.' }, { status: 403 });
        }

        if (!report && facultyId && date) {
            // Placeholder record linked to the sprint plan entry (pending the professor's submission)
            report = await ensureRecordForClass(facultyId, date, lectureNumber, body.sprintEntryId);
        }
        if (!report) {
            // Find faculty
            const faculty = await Employee.findOne({ id: facultyId });
            report = new LectureReport({
                facultyId,
                facultyName: faculty?.name || "Professor",
                college: faculty?.location || "Main Campus",
                date,
                lectureNumber: lectureNumber || 1,
                courseName: courseName || "Academic Session",
                topicsCovered: topicsCovered || "Class Discussion",
                scheduledDuration: 50,
                status: "Scheduled",
                pipelineStatus: "PENDING_PROFESSOR"
            });
        }
        const by = { by: actor.id, byName: actor.name, role: actor.role, at: now };
        const omName = actor.name, omId = actor.id;

        const st = getClassStatus(report);
        if (st === 'COMPLETED') {
            return NextResponse.json({ error: 'This class record is already completed (verified by HOI).' }, { status: 409 });
        }
        report.pipelineHistory = report.pipelineHistory || [];
        // Update OM In/Out and remarks (who and when is stored — Module 13)
        if (actualInTime !== undefined || actualOutTime !== undefined || isLate !== undefined || remarksWhyLate !== undefined) {
            if (actualInTime !== undefined) report.actualInTime = actualInTime;
            if (actualOutTime !== undefined) report.actualOutTime = actualOutTime;
            if (isLate !== undefined) report.isLate = Boolean(isLate);
            if (remarksWhyLate !== undefined) report.remarksWhyLate = remarksWhyLate;
            report.omTimesUpdatedBy = actor.id;
            report.omTimesUpdatedByName = actor.name;
            report.omTimesUpdatedAt = now;
            report.pipelineHistory.push({ action: `Entry/exit time recorded (${report.actualInTime || '—'} / ${report.actualOutTime || '—'})`, fromStatus: st, toStatus: st, ...by, comment: '' });
        }

        // Update lecture notes sharing
        if (notesShared !== undefined) {
            report.lectureNotes = report.lectureNotes || {};
            report.lectureNotes.isSharedWithStudents = Boolean(notesShared);
            report.lectureNotes.sharedWithStudentsTickedBy = omName || omId;
            if (notesNotSharedRemarks !== undefined) {
                report.lectureNotes.notSharedRemarks = notesNotSharedRemarks;
            }
            // Same tick as "Submitted to Groups" on the Class Verification page (Module 12)
            report.submittedToGroup = Boolean(notesShared);
            report.submittedToGroupBy = actor.id;
            report.submittedToGroupByName = actor.name;
            report.submittedToGroupAt = now;
            report.pipelineHistory.push({ action: notesShared ? 'Marked "Submitted to Groups"' : 'Unmarked "Submitted to Groups"', fromStatus: st, toStatus: st, ...by, comment: notesNotSharedRemarks || '' });
        }

        // Update assignment shared in Professor group by OM
        if (assignmentSharedInProfGroup !== undefined) {
            report.assignment = report.assignment || {};
            report.assignment.isSharedInProfGroup = Boolean(assignmentSharedInProfGroup);
            report.assignment.sharedInProfGroupBy = omName || omId;
            report.assignment.sharedInProfGroupAt = now;
        }

        await report.save();

        return NextResponse.json({
            success: true,
            report,
            message: "Lecture tracking updated by Operations Manager"
        });
    } catch (error: any) {
        console.error("OM Lectures POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
