import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, SprintPlan, Employee } from '@/models/Schemas';
import { processLectureWithAI } from '@/lib/gemini';

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

            // Find active sprint plan containing targetDate
            let activePlan = plans.find(p => targetDate >= p.weekStartDate && targetDate <= p.weekEndDate);

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
            const dayLectures = dayEntries.map((entry: any, idx: number) => {
                const lecNum = idx + 1;
                const existing = existingReports.find((r: any) => 
                    (r.sprintPlanId === activePlan?._id?.toString() && r.lectureNumber === lecNum) ||
                    (r.date === targetDate && r.lectureNumber === lecNum) ||
                    (r.courseName === entry.subjectName && r.topicsCovered === entry.topics)
                );

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
                    status: existing ? existing.status : "Scheduled"
                };
            });
            allLectures.push(...dayLectures);
        }

        return NextResponse.json({ 
            lectures: allLectures, 
            date: targetDates[0], 
            sprintPlanId: plans[0]?._id?.toString() 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Submit a completed lecture report
export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { facultyId, date, lectureNumber, courseName, topicsCovered, stream, year, semester,
            numberOfAttendees, totalStudents, issuesFaced, reasonForLessAttendance,
            classPhotoUrl, classPhotoLat, classPhotoLng,
            recordingUrl, recordingDurationSeconds, sprintPlanId, scheduledDuration } = body;

        if (!facultyId || !courseName || !topicsCovered) {
            return NextResponse.json({ error: "facultyId, courseName, topicsCovered required" }, { status: 400 });
        }

        const faculty = await Employee.findOne({ id: facultyId });
        if (!faculty) return NextResponse.json({ error: "Faculty not found" }, { status: 404 });

        // Use provided date or default to today IST
        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const reportDate = date || (istTime.getFullYear() + "-" +
            (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" +
            istTime.getDate().toString().padStart(2, '0'));

        // Strictly use provided lectureNumber or calculate if absolutely missing
        let lecNum = lectureNumber;
        if (!lecNum) {
            const count = await LectureReport.countDocuments({ facultyId, date: reportDate });
            lecNum = count + 1;
        }

        // Validate recording duration (must be ≥ 90% of session)
        const warnings: string[] = [];
        if (recordingDurationSeconds && scheduledDuration) {
            const scheduledSeconds = scheduledDuration * 60;
            const ratio = recordingDurationSeconds / scheduledSeconds;
            if (ratio < 0.9) {
                warnings.push(`Recording coverage: ${Math.round(ratio * 100)}% (min 90% required)`);
            }
        }

        // Attendance Percentage Validation (50% rule)
        const attendeeCount = parseInt(numberOfAttendees);
        const totalCount = parseInt(totalStudents);
        
        if (!isNaN(attendeeCount) && !isNaN(totalCount) && totalCount > 0) {
            const percentage = (attendeeCount / totalCount) * 100;
            if (percentage < 50 && !reasonForLessAttendance) {
                warnings.push(`Attendance: ${Math.round(percentage)}% (below 50%) — reason required`);
            }
        } else if (!totalCount && attendeeCount < 50 && !reasonForLessAttendance && attendeeCount > 0) {
             warnings.push("Attendance below 50 students — reason required");
        }

        const report = await LectureReport.findOneAndUpdate(
            { facultyId, date: reportDate, lectureNumber: lecNum },
            {
                $set: {
                    facultyName: faculty.name,
                    college: faculty.location || "",
                    courseName,
                    topicsCovered,
                    scheduledDuration: scheduledDuration || 0,
                    stream: stream || "",
                    year: year || "",
                    semester: semester || "",
                    numberOfAttendees: attendeeCount,
                    totalStudents: totalCount,
                    classPhotoUrl,
                    classPhotoLat,
                    classPhotoLng,
                    issuesFaced: issuesFaced || "",
                    reasonForLessAttendance: reasonForLessAttendance || "",
                    recordingUrl,
                    recordingDurationSeconds,
                    sprintPlanId: sprintPlanId || "",
                    status: "Completed",
                    auditStatus: "Pending",
                    warnings
                }
            },
            { upsert: true, new: true }
        );

        // TRIGGER AI ANALYSIS ASYNCHRONOUSLY
        if (recordingUrl && !report.aiAnalysisAt) {
            processLectureWithAI(recordingUrl).then(async (result) => {
                if (result) {
                    await LectureReport.findByIdAndUpdate(report._id, {
                        $set: {
                            transcription: result.transcription,
                            summary: result.summary,
                            keywords: result.keywords,
                            analysis: result.analysis,
                            aiAnalysisAt: result.aiAnalysisAt
                        }
                    });
                }
            }).catch(err => console.error(`[AI] Failed analysis for report ${report._id}:`, err));
        }

        return NextResponse.json({ message: "Lecture report submitted", report, warnings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
