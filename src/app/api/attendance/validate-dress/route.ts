import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { parseDressRejection } from '@/lib/email-management';

export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const { attendanceId, status, validatorId, rejection } = await req.json();
        // Rejection: reason(s) are required (Footwear / Blazer / Waistcoat / Grooming / Full Attire / Other + text)
        const parsed = status === "Rejected" ? parseDressRejection(rejection) : null;
        if (parsed && !parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

        attendance.dressCodeStatus = status;
        // Who reviewed it and when (server time); the submission time and createdAt are never changed
        const reviewer: any = await getSessionUser().catch(() => null);
        const reviewerEmp: any = reviewer ? null : (validatorId ? await Employee.findOne({ id: validatorId }).select('id name role').lean() : null);
        attendance.dressCodeReviewedAt = new Date().toISOString();
        attendance.dressCodeReviewedBy = reviewer?.id || reviewerEmp?.id || validatorId || '';
        attendance.dressCodeReviewedByName = reviewer?.name || reviewerEmp?.name || '';
        attendance.dressCodeReviewedByRole = reviewer ? (reviewer.session?.actualRole || reviewer.role) : (reviewerEmp?.role || '');
        const points = status === "Approved" ? 2 : -5;
        
        if (status === "Rejected") {
            attendance.flags.dressCode = true;
            // No automatic email: HR / HR Executive send the rejection email from Email Management (Send Email)
        } else if (status === "Approved") {
            attendance.flags.dressCode = false;
        }

        await attendance.save();
        if (parsed?.ok) {
            // reasons are stored on the attendance record (fields outside the schema → strict: false)
            await Attendance.updateOne({ _id: attendance._id }, { $set: parsed.fields }, { strict: false } as any);
        }

        // Update Employee Points
        const currentPeriod = "Mar 01 - Mar 15, 2026";
        const employeeUpdate = await Employee.findOneAndUpdate(
            { id: attendance.employeeId, "monthlyScores.period": currentPeriod },
            { $inc: { "monthlyScores.$.points": points } },
            { new: true }
        );

        if (!employeeUpdate) {
            await Employee.findOneAndUpdate(
                { id: attendance.employeeId },
                {
                    $push: {
                        monthlyScores: {
                            period: currentPeriod,
                            score: 0,
                            points: points,
                            status: "Recording"
                        }
                    }
                }
            );
        }

        const saved: any = parsed?.ok ? { ...attendance.toObject(), ...parsed.fields } : attendance;
        return NextResponse.json({ message: `Dress code ${status}`, attendance: saved, pointsAwarded: points });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}