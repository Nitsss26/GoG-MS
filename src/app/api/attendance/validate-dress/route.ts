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
        if (status === "Rejected") {
            attendance.flags.dressCode = true;

            // Send warning email
            const employee = await Employee.findOne({ id: attendance.employeeId });
            if (employee && employee.email) {
                const template = getDressCodeWarningTemplate(employee, 1); // For now hardcoding count to 1, can be dynamic
                await sendMailInternal({
                    to: employee.email,
                    subject: template.subject,
                    html: template.html
                });
            }
        } else {
            attendance.flags.dressCode = false;
        }

        await attendance.save();
        return NextResponse.json({ message: `Dress code ${status}`, attendance });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
