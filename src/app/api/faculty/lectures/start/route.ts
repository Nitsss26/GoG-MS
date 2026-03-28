import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, Employee } from '@/models/Schemas';

// POST — Start class (record timestamp)
export async function POST(req: Request) {
    try {
        await dbConnect();
        const { facultyId, lectureNumber, courseName, topicsCovered, sprintPlanId, scheduledDuration, stream, semester } = await req.json();

        if (!facultyId || !lectureNumber) {
            return NextResponse.json({ error: "facultyId and lectureNumber required" }, { status: 400 });
        }

        const faculty = await Employee.findOne({ id: facultyId });
        if (!faculty) return NextResponse.json({ error: "Faculty not found" }, { status: 404 });

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const today = istTime.getFullYear() + "-" +
            (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" +
            istTime.getDate().toString().padStart(2, '0');
        const currentTimeStr = istTime.getHours().toString().padStart(2, '0') + ":" +
            istTime.getMinutes().toString().padStart(2, '0') + ":" +
            istTime.getSeconds().toString().padStart(2, '0');

        const report = await LectureReport.findOneAndUpdate(
            { facultyId, date: today, lectureNumber },
            {
                $set: {
                    facultyName: faculty.name,
                    college: faculty.location || "",
                    courseName: courseName || "",
                    topicsCovered: topicsCovered || "",
                    sprintPlanId: sprintPlanId || "",
                    scheduledDuration: scheduledDuration || 0,
                    stream: stream || "",
                    semester: semester || "",
                    classStartTime: currentTimeStr,
                    status: "In Progress"
                }
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({ message: "Class started", report, startTime: currentTimeStr });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
