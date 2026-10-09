import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { performClassAction } from '@/lib/class-record-workflow';

/**
 * HOI audit decision from Academic Monitoring.
 * "Approved" = HOI final verification (record must have passed OM and CL/CH) → COMPLETED.
 * "Flagged"  = HOI sends the record back to CL/CH with a comment.
 */
export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HOI') return NextResponse.json({ error: 'Only the HOI can give the final verification.' }, { status: 403 });

        const { reportId, status, comment } = await req.json();

        if (!reportId || !status) {
            return NextResponse.json({ error: "reportId and status required" }, { status: 400 });
        }

        if (!['Approved', 'Flagged'].includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const result = await performClassAction(actor, report, status === 'Approved'
            ? { action: 'final_verify', comment: comment || '' }
            : { action: 'final_revert', revertTo: 'PROFESSOR', comment: comment || 'Flagged by HOI during the audit.' });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

        return NextResponse.json({ message: result.message, report: result.record });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
