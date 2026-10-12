import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, SprintPlan, Employee } from '@/models/Schemas';
import { processLectureWithAI } from '@/lib/gemini';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, professorIfInScope, hasClassEnded } from '@/lib/academic';
import { submitClassRecord, classStrength } from '@/lib/class-record-workflow';
import { getPlanStatus, getClassStatus, PROFESSOR_ROLES } from '@/lib/academic-status';

// GET — Fetch lectures for a faculty
export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('facultyId');
        const date = searchParams.get('date');
        const weekStartDate = searchParams.get('weekStartDate');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!facultyId) return NextResponse.json({ error: "facultyId required" }, { status: 400 });

        // Own lectures, or a professor inside the viewer's college scope
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (facultyId !== actor.id) {
            if (PROFESSOR_ROLES.includes(actor.role) || !(await professorIfInScope(await getAcademicScope(actor), facultyId))) {
                return NextResponse.json({ error: 'This professor is not in your campus or reporting hierarchy.' }, { status: 403 });
            }
        }

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        
        const formatDate = (d: Date) => d.getFullYear() + "-" +
            (d.getMonth() + 1).toString().padStart(2, '0') + "-" +
            d.getDate().toString().padStart(2, '0');

        let targetDates: string[] = [];
        if (startDate && endDate) {
            // Custom Range
            const s = new Date(startDate);
            const e = new Date(endDate);
            let curr = new Date(s);
            while (curr <= e) {
                targetDates.push(formatDate(curr));
                curr.setDate(curr.getDate() + 1);
            }
        } else if (weekStartDate) {
            // Generate full week Mon-Sat
            const start = new Date(weekStartDate);
            for (let i = 0; i < 6; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                targetDates.push(formatDate(d));
            }
        } else {
            // Default to today
            targetDates = [date || formatDate(istTime)];
        }

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const plans = await SprintPlan.find({ facultyId }).sort({ weekStartDate: -1 });

        let allLectures: any[] = [];

        for (const targetDate of targetDates) {
            const dayIdx = new Date(targetDate).getDay();
            const targetDayName = dayNames[dayIdx]?.toUpperCase()?.substring(0, 3) || "MON";

            // Find active sprint plan containing targetDate (a draft is not a class schedule yet)
            let activePlan = plans.find(p => targetDate >= p.weekStartDate && targetDate <= p.weekEndDate && getPlanStatus(p) !== 'DRAFT');

            // Get entries for target day
            let dayEntries: any[] = [];
            if (activePlan) {
                dayEntries = activePlan.entries.filter((e: any) =>
                    e.date === targetDate || e.day?.toUpperCase()?.substring(0, 3) === targetDayName
                );
            }

            // Check if lecture reports already exist for this date
            const existingReports = await LectureReport.find({ facultyId, date: targetDate });

            // Merge sprint plan entries with existing reports
            const assignedReportIds = new Set();
            const dayLectures = await Promise.all(dayEntries.map(async (entry: any, idx: number) => {
                const lecNum = idx + 1;
                
                // 0. Exact match on the sprint plan entry
                let existing = existingReports.find((r: any) =>
                    !assignedReportIds.has(r._id.toString()) && r.sprintEntryId && r.sprintEntryId === entry._id?.toString()
                );
                // 1. Primary Match: Sprint Plan ID + Lecture Number OR Date + Lecture Number
                if (!existing) existing = existingReports.find((r: any) =>
                    !assignedReportIds.has(r._id.toString()) && !r.sprintEntryId && (
                        (r.sprintPlanId === activePlan?._id?.toString() && r.lectureNumber === lecNum) ||
                        (r.date === targetDate && r.lectureNumber === lecNum)
                    )
                );

                // 2. Secondary Match (Fallback): Match by Topic only if not already assigned
                if (!existing) {
                    existing = existingReports.find((r: any) => 
                        !assignedReportIds.has(r._id.toString()) && 
                        r.courseName === entry.subjectName && 
                        r.topicsCovered === entry.topics
                    );
                }

                if (existing) {
                    assignedReportIds.add(existing._id.toString());
                }

                const timeStartParts = entry.timeStart?.split(':').map(Number) || [0, 0];
                const timeStopParts = entry.timeStop?.split(':').map(Number) || [0, 0];
                const scheduledDuration = (timeStopParts[0] * 60 + timeStopParts[1]) - (timeStartParts[0] * 60 + timeStartParts[1]);

                return {
                    _id: existing?._id || `${targetDate}-${idx}`,
                    lectureNumber: lecNum,
                    sprintPlanId: activePlan?._id?.toString(),
                    isLocked: activePlan?.isLocked || false,
                    courseName: entry.subjectName,
                    topicsCovered: entry.topics,
                    subjectCode: entry.subjectCode,
                    stream: entry.stream || activePlan?.stream || "",
                    year: entry.year || activePlan?.year || "",
                    semester: entry.semester || "",
                    timeStart: entry.timeStart,
                    timeStop: entry.timeStop,
                    scheduledDuration,
                    date: targetDate,
                    day: targetDayName,
                    report: existing ? existing.toObject() : null,
                    status: existing ? existing.status : "Scheduled",
                    // Class record pipeline
                    sprintEntryId: entry._id?.toString(),
                    planStatus: getPlanStatus(activePlan),
                    section: entry.section || "",
                    className: entry.className || "",
                    lectureType: entry.lectureType || "",
                    unitNumber: entry.unitNumber || "",
                    pipelineStatus: existing ? getClassStatus(existing) : "PENDING_PROFESSOR",
                    classEnded: hasClassEnded(targetDate, entry.timeStop),
                    defaultTotalStudents: existing?.totalStudents || await classStrength(facultyId, entry)
                };
            }));
            
            const unassignedReports = existingReports
                .filter(r => !assignedReportIds.has(r._id.toString()))
                .filter(r => r.status === 'Completed' || r.pipelineStatus !== 'PENDING_PROFESSOR')
                .map(r => ({ ...r.toObject(), report: r.toObject(), pipelineStatus: getClassStatus(r), timeStart: r.timeStart || r.classStartTime, timeStop: r.timeStop || r.classEndTime }));

            allLectures.push(...dayLectures, ...unassignedReports);
        }

        return NextResponse.json({ 
            lectures: allLectures.sort((a, b) => {
                if (a.date !== b.date) {
                    return a.date.localeCompare(b.date);
                }
                return a.lectureNumber - b.lectureNumber;
            }), 
            date: targetDates[0], 
            sprintPlanId: plans[0]?._id?.toString() 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Submit (or re-submit after a revert) the class record of a finished class.
// Validation, attendance, notes / missing-notes reason, pipeline status and notifications: src/lib/class-record-workflow.ts
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        if (body.facultyId && body.facultyId !== actor.id) {
            return NextResponse.json({ error: 'You can only submit your own class records.' }, { status: 403 });
        }

        // Recording coverage warning (existing rule: recording should cover ≥ 90% of the session)
        const warnings: string[] = [];
        if (body.recordingDurationSeconds && body.scheduledDuration) {
            const ratio = body.recordingDurationSeconds / (body.scheduledDuration * 60);
            if (ratio < 0.9) warnings.push(`Recording coverage: ${Math.round(ratio * 100)}% (min 90% required)`);
        }

        const result = await submitClassRecord(actor, body);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

        const t = result.record.totalStudents || 0;
        if (t > 0 && (result.record.numberOfAttendees / t) < 0.5 && !body.reasonForLessAttendance) {
            warnings.push(`Attendance: ${Math.round((result.record.numberOfAttendees / t) * 100)}% (below 50%) — reason required`);
        }
        if (warnings.length) await LectureReport.updateOne({ _id: result.record._id }, { $set: { warnings } });

        // AI Analysis will be triggered manually by managers instead of automatically on upload.
        return NextResponse.json({ message: result.message, report: result.record, warnings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
