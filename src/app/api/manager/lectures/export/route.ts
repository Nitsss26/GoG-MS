import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { LectureReport } from '@/models/Schemas';
import { resolveManager, reporteesOf } from '@/lib/manager-reportees';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const managerId = searchParams.get('managerId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');


        // The logged-in manager (see src/lib/manager-reportees.ts)
        const who = await resolveManager(managerId);
        if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status });
        const manager = who.manager;

        // 2. Find reportees (Same logic as academic-data/route.ts)
        const reportees: any[] = await reporteesOf(who as any);
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
