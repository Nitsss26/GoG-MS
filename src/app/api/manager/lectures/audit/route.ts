import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';

export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const { reportId, status } = await req.json();

        if (!reportId || !status) {
            return NextResponse.json({ error: "reportId and status required" }, { status: 400 });
        }

        if (!['Pending', 'Approved', 'Flagged'].includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        const report = await LectureReport.findByIdAndUpdate(
            reportId,
            { $set: { auditStatus: status } },
            { new: true }
        );

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Audit status updated", report });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
