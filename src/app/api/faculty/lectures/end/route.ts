import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';

// POST — End class (record timestamp, compute duration, validate)
export async function POST(req: Request) {
    try {
        await dbConnect();
        const { facultyId, lectureNumber, date } = await req.json();

        if (!facultyId || !lectureNumber) {
            return NextResponse.json({ error: "facultyId and lectureNumber required" }, { status: 400 });
        }

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const today = date || (istTime.getFullYear() + "-" +
            (istTime.getMonth() + 1).toString().padStart(2, '0') + "-" +
            istTime.getDate().toString().padStart(2, '0'));
        const currentTimeStr = istTime.getHours().toString().padStart(2, '0') + ":" +
            istTime.getMinutes().toString().padStart(2, '0') + ":" +
            istTime.getSeconds().toString().padStart(2, '0');

        const report = await LectureReport.findOne({ facultyId, date: today, lectureNumber });
        if (!report) return NextResponse.json({ error: "Lecture report not found. Did you start the class?" }, { status: 404 });
        if (!report.classStartTime) return NextResponse.json({ error: "Class was not started" }, { status: 400 });
        if (report.classEndTime) return NextResponse.json({ error: "Class already ended" }, { status: 400 });

        // Compute actual duration
        const startParts = report.classStartTime.split(':').map(Number);
        const endParts = currentTimeStr.split(':').map(Number);
        const startMinutes = startParts[0] * 60 + startParts[1];
        const endMinutes = endParts[0] * 60 + endParts[1];
        const actualDuration = endMinutes - startMinutes;

        // Validate against scheduled duration
        const warnings: string[] = [...(report.warnings || [])];
        if (report.scheduledDuration && actualDuration < report.scheduledDuration) {
            const diff = report.scheduledDuration - actualDuration;
            warnings.push(`Class ended ${diff} minutes early (scheduled: ${report.scheduledDuration} min, actual: ${actualDuration} min)`);
        }

        report.classEndTime = currentTimeStr;
        report.actualDurationMinutes = actualDuration;
        report.warnings = warnings;
        await report.save();

        return NextResponse.json({
            message: "Class ended",
            report,
            actualDuration,
            warnings
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
