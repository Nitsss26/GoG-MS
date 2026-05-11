import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { 
    Employee, Attendance, LectureReport, LeaveRequest, 
    Ticket, ReimbursementClaim, Holiday, MeetingRequest, Notice 
} from '@/models/Schemas';

export async function GET() {
    try {
        await dbConnect();

        const assets: any[] = [];

        // 1. Employee Assets (Profile & Documents)
        const employees = await Employee.find({}, 'id name photoUrl onboardingDocs aadhar_card pan_card passport_size_photo resume upload_your_resume');
        employees.forEach(emp => {
            if (emp.photoUrl) {
                assets.push({
                    url: emp.photoUrl,
                    empId: emp.id,
                    name: emp.name,
                    category: 'Profile Image',
                    date: 'N/A',
                    fileName: `Profile_${emp.id}_${emp.name.replace(/\s+/g, '_')}`
                });
            }
            // Add documents if they exist
            const docs = [
                { url: emp.aadhar_card, type: 'Aadhar' },
                { url: emp.pan_card, type: 'PAN' },
                { url: emp.passport_size_photo, type: 'PassportPhoto' },
                { url: emp.upload_your_resume || emp.resume, type: 'Resume' }
            ];
            docs.forEach(doc => {
                if (doc.url) {
                    assets.push({
                        url: doc.url,
                        empId: emp.id,
                        name: emp.name,
                        category: 'Onboarding Doc',
                        date: 'N/A',
                        fileName: `${emp.id}_Doc_${doc.type}`
                    });
                }
            });
        });

        // 2. Attendance Assets
        const attendance = await Attendance.find({ dressCodeImageUrl: { $exists: true, $ne: null } });
        attendance.forEach(att => {
            assets.push({
                url: att.dressCodeImageUrl,
                empId: att.employeeId,
                category: 'Attendance',
                date: att.date,
                fileName: `${att.date}_${att.employeeId}_Attendance`
            });
        });

        // 3. Lecture Reports (Recordings & Photos)
        const lectures = await LectureReport.find({ $or: [{ recordingUrl: { $exists: true } }, { classPhotoUrl: { $exists: true } }] });
        lectures.forEach(lec => {
            if (lec.recordingUrl) {
                assets.push({
                    url: lec.recordingUrl,
                    empId: lec.facultyId,
                    name: lec.facultyName,
                    category: 'Lecture Recording',
                    date: lec.date,
                    college: lec.college,
                    fileName: `${lec.date}_${lec.facultyId}_Lecture_Recording_${lec.courseName.replace(/\s+/g, '_')}`
                });
            }
            if (lec.classPhotoUrl) {
                assets.push({
                    url: lec.classPhotoUrl,
                    empId: lec.facultyId,
                    name: lec.facultyName,
                    category: 'Lecture Photo',
                    date: lec.date,
                    college: lec.college,
                    fileName: `${lec.date}_${lec.facultyId}_Lecture_Photo_${lec.courseName.replace(/\s+/g, '_')}`
                });
            }
        });

        // 4. Leave Proofs
        const leaves = await LeaveRequest.find({ proofUrls: { $exists: true, $ne: [] } });
        leaves.forEach(l => {
            l.proofUrls.forEach((url: string, idx: number) => {
                assets.push({
                    url,
                    empId: l.employeeId,
                    name: l.employeeName,
                    category: 'Leave Proof',
                    date: l.startDate,
                    fileName: `${l.startDate}_${l.employeeId}_Leave_Proof_${idx + 1}`
                });
            });
        });

        // 5. Ticket Assets
        const tickets = await Ticket.find({ proofUrls: { $exists: true, $ne: [] } });
        tickets.forEach(t => {
            t.proofUrls.forEach((url: string, idx: number) => {
                assets.push({
                    url,
                    empId: t.raisedBy,
                    name: t.employeeName,
                    category: 'Ticket Attachment',
                    date: t.createdAt.split('T')[0],
                    fileName: `${t.createdAt.split('T')[0]}_${t.raisedBy}_Ticket_${idx + 1}`
                });
            });
        });

        // 6. Reimbursements
        const reimbursements = await ReimbursementClaim.find({ proofUrls: { $exists: true, $ne: [] } });
        reimbursements.forEach(r => {
            r.proofUrls.forEach((url: string, idx: number) => {
                assets.push({
                    url,
                    empId: r.employeeId,
                    name: r.employeeName,
                    category: 'Reimbursement Proof',
                    date: r.date,
                    fileName: `${r.date}_${r.employeeId}_Reimb_Proof_${idx + 1}`
                });
            });
        });

        return NextResponse.json({ success: true, assets });
    } catch (error: any) {
        console.error("Asset fetch error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
