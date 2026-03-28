import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, SprintPlan, Employee } from '@/models/Schemas';
import { processLectureWithAI } from '@/lib/gemini';

// GET — Fetch today's lectures for a faculty (auto-fetched from sprint plan)
export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('facultyId');
        const date = searchParams.get('date');

        if (!facultyId) return NextResponse.json({ error: "facultyId required" }, { status: 400 });

        // Get today's date in IST
        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const today = date || (istTime.getFullYear() + "-" +
            (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" +
            istTime.getDate().toString().padStart(2, '0'));

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayIdx = date ? new Date(date).getDay() : istTime.getDay();
        const todayDayName = dayNames[dayIdx]?.toUpperCase()?.substring(0, 3) || "MON";

        // Find active sprint plan containing today
        const plans = await SprintPlan.find({ facultyId }).sort({ weekStartDate: -1 });
        let activePlan = plans.find(p => today >= p.weekStartDate && today <= p.weekEndDate);

        // Get entries for today
        let todayEntries: any[] = [];
        if (activePlan) {
            todayEntries = activePlan.entries.filter((e: any) =>
                e.date === today || e.day?.toUpperCase()?.substring(0, 3) === todayDayName
            );
        }

        // Check if lecture reports already exist for today
        const existingReports = await LectureReport.find({ facultyId, date: today });

        // Merge sprint plan entries with existing reports
        const lectures = todayEntries.map((entry: any, idx: number) => {
            const existing = existingReports.find((r: any) =>
                r.lectureNumber === (idx + 1) ||
                (r.courseName === entry.subjectName && r.topicsCovered === entry.topics)
            );

            const timeStartParts = entry.timeStart?.split(':').map(Number) || [0, 0];
            const timeStopParts = entry.timeStop?.split(':').map(Number) || [0, 0];
            const scheduledDuration = (timeStopParts[0] * 60 + timeStopParts[1]) - (timeStartParts[0] * 60 + timeStartParts[1]);

            return {
                lectureNumber: idx + 1,
                sprintPlanId: activePlan?._id?.toString(),
                courseName: entry.subjectName,
                topicsCovered: entry.topics,
                subjectCode: entry.subjectCode,
                stream: entry.stream || activePlan?.stream || "",
                year: entry.year || activePlan?.year || "",
                semester: entry.semester || "",
                timeStart: entry.timeStart,
                timeStop: entry.timeStop,
                scheduledDuration,
                // Existing report data
                ...(existing ? {
                    _id: existing._id,
                    status: existing.status,
                    classStartTime: existing.classStartTime,
                    classEndTime: existing.classEndTime,
                    actualDurationMinutes: existing.actualDurationMinutes,
                    numberOfAttendees: existing.numberOfAttendees,
                    totalStudents: existing.totalStudents || entry.totalStudents || 40, // Default to sprint plan or 40
                    recordingUrl: existing.recordingUrl,
                    classPhotoUrl: existing.classPhotoUrl,
                    warnings: existing.warnings,
                    summary: existing.summary,
                    transcription: existing.transcription,
                    keywords: existing.keywords,
                    aiAnalysisAt: existing.aiAnalysisAt
                } : {
                    status: "Scheduled",
                    totalStudents: entry.totalStudents || 40 // Default for scheduled
                })
            };
        });

        return NextResponse.json({ lectures, date: today, sprintPlanId: activePlan?._id?.toString() });
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

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const today = date || (istTime.getFullYear() + "-" +
            (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" +
            istTime.getDate().toString().padStart(2, '0'));

        // Calculate lecture number if not provided
        let lecNum = lectureNumber;
        if (!lecNum) {
            const count = await LectureReport.countDocuments({ facultyId, date: today });
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
        } else if (!totalCount && attendeeCount < 50 && !reasonForLessAttendance) {
             // Fallback for missing totalStudents
             warnings.push("Attendance below 50 students — reason required");
        }

        const report = await LectureReport.findOneAndUpdate(
            { facultyId, date: today, lectureNumber: lecNum },
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
                    warnings
                }
            },
            { upsert: true, new: true }
        );

        // TRIGGER AI ANALYSIS ASYNCHRONOUSLY
        // If recording exists and not yet analyzed
        if (recordingUrl && !report.aiAnalysisAt) {
            console.log(`[AI] Triggering analysis for report ${report._id}`);
            processLectureWithAI(recordingUrl).then(async (result) => {
                if (result) {
                    await LectureReport.findByIdAndUpdate(report._id, {
                        $set: {
                            transcription: result.transcription,
                            summary: result.summary,
                            keywords: (result as any).keywords,
                            aiAnalysisAt: result.aiAnalysisAt
                        }
                    });
                    console.log(`[AI] Successfully updated report ${report._id} with transcription/summary`);
                }
            }).catch(err => {
                console.error(`[AI] Failed analysis for report ${report._id}:`, err);
            });
        }

        return NextResponse.json({ message: "Lecture report submitted", report, warnings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
