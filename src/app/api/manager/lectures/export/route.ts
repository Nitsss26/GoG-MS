import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { LectureReport, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const managerId = searchParams.get('managerId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!managerId) return NextResponse.json({ error: "managerId required" }, { status: 400 });

        // 1. Find the manager
        const manager = await Employee.findOne({ id: managerId });
        if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

        // 2. Find reportees (Same logic as academic-data/route.ts)
        let reportees;
        if (["AD", "FOUNDER"].includes(manager.role)) {
            reportees = await Employee.find({ role: { $in: ["FACULTY", "PROFESSOR"] } });
        } else {
            const matchingConditions: any[] = [
                { reportsTo: managerId },
                { reportsTo: { $in: [managerId] } }
            ];
            if (manager.role === "HOI" && manager.location) {
                matchingConditions.push({ location: manager.location });
            }
            reportees = await Employee.find({ $or: matchingConditions });
        }
        const reporteeIds = reportees.map(r => r.id);

        if (reporteeIds.length === 0) {
            return NextResponse.json({ success: true, reports: [] });
        }

        // 3. Fetch Lecture Reports with Recording URL
        const reportQuery: any = { 
            facultyId: { $in: reporteeIds },
            recordingUrl: { $exists: true, $ne: "" } // Only reports with recordings
        };

        if (startDate && endDate) {
            reportQuery.date = { $gte: startDate, $lte: endDate };
        } else if (startDate) {
            reportQuery.date = { $gte: startDate };
        } else if (endDate) {
            reportQuery.date = { $lte: endDate };
        }

        const reports = await LectureReport.find(reportQuery).sort({ date: -1, facultyName: 1 });

        return NextResponse.json({ 
            success: true, 
            reports: reports.map(r => ({
                lectureNumber: r.lectureNumber,
                date: r.date,
                facultyName: r.facultyName,
                facultyId: r.facultyId,
                courseName: r.courseName,
                topicsCovered: r.topicsCovered,
                stream: r.stream,
                year: r.year,
                semester: r.semester,
                numberOfAttendees: r.numberOfAttendees,
                totalStudents: r.totalStudents,
                recordingUrl: r.recordingUrl,
                classPhotoUrl: r.classPhotoUrl,
                rating: r.pedagogicalAnalysis?.summary?.overallRating || "Pending Analysis",
                score: r.pedagogicalAnalysis?.summary?.lectureQualityScore || 0
            }))
        });
    } catch (error: any) {
        console.error("[EXPORT_API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
