import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, professorsInScope } from '@/lib/academic';
import { performClassAction, recordInScope } from '@/lib/class-record-workflow';
import { getClassStatus, CL_CH_ROLES, VERIFICATION_ROLES } from '@/lib/academic-status';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!VERIFICATION_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { searchParams } = new URL(req.url);
        const campus = searchParams.get('campus');
        const date = searchParams.get('date');
        const facultyId = searchParams.get('facultyId');
        const status = searchParams.get('status');

        // Only professors inside the viewer's college scope (Module 24)
        const scope = await getAcademicScope(actor);
        const scopedFaculties: any[] = await professorsInScope(scope, campus && campus !== "All" ? campus : null);
        const allowedIds = scopedFaculties.map((f: any) => f.id);

        const query: any = { facultyId: { $in: facultyId ? allowedIds.filter(id => id === facultyId) : allowedIds } };
        if (date) query.date = date;
        if (status && status !== "All") {
            if (status === "Verified") {
                query.clVerificationStatus = "Verified";
            } else if (status === "Pending") {
                query.clVerificationStatus = { $ne: "Verified" };
            }
        }

        const reports = await LectureReport.find(query)
            .sort({ date: -1, lectureNumber: 1 })
            .lean();

        return NextResponse.json({
            success: true,
            reports: reports.map((r: any) => ({ ...r, pipelineStatus: getClassStatus(r) })),
            faculties: scopedFaculties
        });
    } catch (error: any) {
        console.error("Curriculum Lectures GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * CL / CH checks from the Lecture Quality Hub.
 * Notes / assignment remarks are kept as before; the overall "Good to Go" and "Reject" are the CL/CH stage of the
 * verification pipeline (Professor → OM → final verification by CL / CH / HOI), so they work only when OM has verified the record.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!CL_CH_ROLES.includes(actor.role)) return NextResponse.json({ error: 'Only CL / CH can verify lectures.' }, { status: 403 });

        const body = await req.json();
        const { reportId, notesStatus, notesRemarks, assignmentStatus, assignmentRemarks, overallRemarks } = body;
        const act = String(body.action || '').toLowerCase();

        if (!reportId) {
            return NextResponse.json({ error: "reportId is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Lecture report not found" }, { status: 404 });
        }
        if (!(await recordInScope(actor, report))) {
            return NextResponse.json({ error: "This lecture is not in your college." }, { status: 403 });
        }

        const now = new Date().toISOString();

        if (act === "verify_notes" || act === "verify_assignment") {
            if (act === "verify_notes") {
                report.lectureNotes = report.lectureNotes || {};
                report.lectureNotes.verificationStatus = notesStatus?.toUpperCase() === "NEEDS_REVISION" ? "Needs Revision" : "Approved";
                report.lectureNotes.leadRemarks = notesRemarks || "";
                report.lectureNotes.verifiedBy = actor.id;
                report.lectureNotes.verifiedByName = actor.name;
                report.lectureNotes.verifiedAt = now;
            } else {
                report.assignment = report.assignment || {};
                report.assignment.verificationStatus = assignmentStatus?.toUpperCase() === "NEEDS_REVISION" ? "Needs Revision" : "Approved";
                report.assignment.leadRemarks = assignmentRemarks || "";
                report.assignment.verifiedBy = actor.id;
                report.assignment.verifiedByName = actor.name;
                report.assignment.verifiedAt = now;
            }
            await report.save();

            // Auto-check rule: notes approved AND (no assignment OR assignment approved) → CL/CH verification of the record
            const notesApproved = ["approved", "verified"].includes(report.lectureNotes?.verificationStatus?.toLowerCase());
            const assignmentApproved = !report.assignment?.hasAssignment || ["approved", "verified"].includes(report.assignment?.verificationStatus?.toLowerCase());
            if (notesApproved && assignmentApproved && ["PENDING_CL_CH", "PENDING_HOI"].includes(getClassStatus(report))) {
                const r = await performClassAction(actor, report, { action: "clch_verify", comment: overallRemarks || notesRemarks || "" });
                if (r.ok) return NextResponse.json({ success: true, report: r.record, message: r.message });
            }
            return NextResponse.json({ success: true, report, message: "Lecture verification updated successfully" });
        }

        if (act === "verify_all_good_to_go" || act === "verify_good_to_go") {
            const r = await performClassAction(actor, report, { action: "clch_verify", comment: overallRemarks || "Verified. Good to Go." });
            if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
            return NextResponse.json({ success: true, report: r.record, message: r.message });
        }

        if (act === "reject" || act === "request_changes" || act === "request_revision") {
            const comment = overallRemarks || notesRemarks || assignmentRemarks || "Revisions required by Curriculum Lead.";
            const r = await performClassAction(actor, report, { action: "clch_revert", comment, revertTo: body.revertTo || "PROFESSOR" });
            if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
            const fresh: any = await LectureReport.findById(reportId);
            if (notesRemarks) { fresh.lectureNotes.verificationStatus = "Needs Revision"; fresh.lectureNotes.leadRemarks = notesRemarks; }
            if (assignmentRemarks && fresh.assignment?.hasAssignment) { fresh.assignment.verificationStatus = "Needs Revision"; fresh.assignment.leadRemarks = assignmentRemarks; }
            await fresh.save();
            return NextResponse.json({ success: true, report: fresh, message: r.message });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (error: any) {
        console.error("Curriculum Lectures POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
