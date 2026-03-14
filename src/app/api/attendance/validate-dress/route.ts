import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee } from '@/models/Schemas';
import { sendMailInternal } from '@/lib/mail-server';
import { getDressCodeWarningTemplate } from '@/lib/mail-templates';

export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const { attendanceId, status, validatorId } = await req.json();

        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

        attendance.dressCodeStatus = status;
        const points = status === "Approved" ? 2 : -5;
        
        if (status === "Rejected") {
            attendance.flags.dressCode = true;
            
            // Send warning email
            const employee = await Employee.findOne({ id: attendance.employeeId });
            if (employee && employee.email) {
                const template = getDressCodeWarningTemplate(employee, 1);
                await sendMailInternal({
                    to: employee.email,
                    subject: template.subject,
                    html: template.html
                });
            }
        } else if (status === "Approved") {
            attendance.flags.dressCode = false;
        }

        await attendance.save();

        // Update Employee Points
        const currentPeriod = "Mar 01 - Mar 15, 2026";
        const employeeUpdate = await Employee.findOneAndUpdate(
            { id: attendance.employeeId, "biWeeklyScores.period": currentPeriod },
            { $inc: { "biWeeklyScores.$.points": points } },
            { new: true }
        );

        if (!employeeUpdate) {
            await Employee.findOneAndUpdate(
                { id: attendance.employeeId },
                {
                    $push: {
                        biWeeklyScores: {
                            period: currentPeriod,
                            score: 0,
                            points: points,
                            status: "Recording"
                        }
                    }
                }
            );
        }

        return NextResponse.json({ message: `Dress code ${status}`, attendance, pointsAwarded: points });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
