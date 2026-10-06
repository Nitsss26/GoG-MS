import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const campus = searchParams.get('campus');
        const date = searchParams.get('date');
        const facultyId = searchParams.get('facultyId');
        const status = searchParams.get('status');

        const query: any = {};
        if (date) query.date = date;
        if (facultyId) query.facultyId = facultyId;
        if (campus && campus !== "All") {
            query.college = { $regex: new RegExp(campus.trim(), 'i') };
        }
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

        // Also fetch faculties for metadata
        const faculties = await Employee.find({
            role: { $in: ["FACULTY", "PROFESSOR"] }
        }).select('id name location designation').lean();

        return NextResponse.json({
            success: true,
            reports,
            faculties
        });
    } catch (error: any) {
        console.error("Curriculum Lectures GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const {
            reportId,
            action, // "verify_notes" | "verify_assignment" | "verify_all_good_to_go" | "reject"
            notesStatus,
            notesRemarks,
            assignmentStatus,
            assignmentRemarks,
            overallRemarks,
            verifierId,
            verifierName
        } = body;

        if (!reportId) {
            return NextResponse.json({ error: "reportId is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Lecture report not found" }, { status: 404 });
        }

        const now = new Date().toISOString();

        const act = action?.toLowerCase();
        if (act === "verify_notes") {
            report.lectureNotes = report.lectureNotes || {};
            report.lectureNotes.verificationStatus = notesStatus?.toUpperCase() === "NEEDS_REVISION" ? "Needs Revision" : "Approved";
            report.lectureNotes.leadRemarks = notesRemarks || "";
            report.lectureNotes.verifiedBy = verifierId;
            report.lectureNotes.verifiedByName = verifierName;
            report.lectureNotes.verifiedAt = now;
        } else if (act === "verify_assignment") {
            report.assignment = report.assignment || {};
            report.assignment.verificationStatus = assignmentStatus?.toUpperCase() === "NEEDS_REVISION" ? "Needs Revision" : "Approved";
            report.assignment.leadRemarks = assignmentRemarks || "";
            report.assignment.verifiedBy = verifierId;
            report.assignment.verifiedByName = verifierName;
            report.assignment.verifiedAt = now;
        } else if (act === "verify_all_good_to_go" || act === "verify_good_to_go") {
            // Notes verified
            report.lectureNotes = report.lectureNotes || {};
            report.lectureNotes.verificationStatus = "Approved";
            if (notesRemarks) report.lectureNotes.leadRemarks = notesRemarks;
            report.lectureNotes.verifiedBy = verifierId;
            report.lectureNotes.verifiedByName = verifierName;
            report.lectureNotes.verifiedAt = now;

            // If assignment present, also verify assignment
            if (report.assignment && report.assignment.hasAssignment) {
                report.assignment.verificationStatus = "Approved";
                if (assignmentRemarks) report.assignment.leadRemarks = assignmentRemarks;
                report.assignment.verifiedBy = verifierId;
                report.assignment.verifiedByName = verifierName;
                report.assignment.verifiedAt = now;
            }

            // Overall good to go (turns green)
            report.clVerificationStatus = "Verified";
            report.clRemarks = overallRemarks || "Verified by Curriculum Lead. Good to Go.";
            report.auditStatus = "Approved";
        } else if (act === "reject" || act === "request_changes" || act === "request_revision") {
            report.clVerificationStatus = "Needs Revision";
            report.clRemarks = overallRemarks || "Revisions required by Curriculum Lead.";
            if (notesRemarks) {
                report.lectureNotes = report.lectureNotes || {};
                report.lectureNotes.verificationStatus = "Needs Revision";
                report.lectureNotes.leadRemarks = notesRemarks;
            }
            if (assignmentRemarks && report.assignment) {
                report.assignment.verificationStatus = "Needs Revision";
                report.assignment.leadRemarks = assignmentRemarks;
            }
        }

        // Auto-check rule: if notes are approved AND (either no assignment OR assignment is approved), turn green!
        const notesApproved = ["approved", "verified"].includes(report.lectureNotes?.verificationStatus?.toLowerCase());
        const assignmentApproved = !report.assignment?.hasAssignment || ["approved", "verified"].includes(report.assignment?.verificationStatus?.toLowerCase());
        if (notesApproved && assignmentApproved && act !== "reject" && act !== "request_changes" && act !== "request_revision") {
            report.clVerificationStatus = "Verified";
            report.auditStatus = "Approved";
        }

        await report.save();

        return NextResponse.json({
            success: true,
            report,
            message: "Lecture verification updated successfully"
        });
    } catch (error: any) {
        console.error("Curriculum Lectures POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
