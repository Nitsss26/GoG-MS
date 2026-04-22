import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Fetch faculty details for the report
        const faculty = await Employee.findOne({ id: report.facultyId });

        return NextResponse.json({ 
            success: true, 
            report,
            faculty: faculty ? {
                name: faculty.name,
                designation: faculty.designation,
                photoUrl: faculty.photoUrl
            } : null
        });
    } catch (error: any) {
        console.error("[LQR_API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
