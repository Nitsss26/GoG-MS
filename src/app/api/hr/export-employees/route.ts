import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session || (session.role !== "HR" && session.role !== "FOUNDER")) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        await dbConnect();
        const employees = await Employee.find({}).lean();
        
        // Use request headers to determine the base URL
        const host = request.headers.get("host") || "";
        const protocol = host.includes("localhost") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;

        // Format relative URLs into absolute URLs
        const formatUrl = (url: string | undefined | null) => {
            if (!url) return "N/A";
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        };

        const headers = [
            "Employee ID", "Name", "Email", "Role", "Department", "Designation", 
            "Onboarding Status", "Status", "Mobile", "Father/Mother Name", "College", 
            "Qualification", "Account Name", "Account Number", "IFSC", "UPI", 
            "Resume Link", "Aadhar Link", "PAN Link", "10th Marksheet", 
            "12th Marksheet", "Bachelor Passing Cert", "Master Passing Cert", 
            "Bachelor Marksheet", "Master Marksheet", "Experience Letter", "HR Meeting SS"
        ];

        const rows = employees.map((emp: any) => [
            `"${(emp.id || '').replace(/"/g, '""')}"`,
            `"${(emp.name || emp.full_name || '').replace(/"/g, '""')}"`,
            `"${(emp.email || '').replace(/"/g, '""')}"`,
            `"${(emp.role || '').replace(/"/g, '""')}"`,
            `"${(emp.dept || '').replace(/"/g, '""')}"`,
            `"${(emp.designation || '').replace(/"/g, '""')}"`,
            `"${(emp.onboardingStatus || '').replace(/"/g, '""')}"`,
            `"${(emp.status || '').replace(/"/g, '""')}"`,
            `"${(emp.phone_no_ || emp.phone || '').replace(/"/g, '""')}"`,
            `"${(emp.father_name_or_mother_name || emp.fatherMotherName || '').replace(/"/g, '""')}"`,
            `"${(emp.which_college_are_you_from_ || emp.collegeName || '').replace(/"/g, '""')}"`,
            `"${(emp.bachelor_s_qualification || emp.bachelorQual || '').replace(/"/g, '""')}"`,
            `"${(emp.account_holder_name || emp.bankAccountName || '').replace(/"/g, '""')}"`,
            `"${(emp.bank_account_number || emp.bankAccountNumber || '').replace(/"/g, '""')}"`,
            `"${(emp.ifsc_code || emp.ifscCode || '').replace(/"/g, '""')}"`,
            `"${(emp.upi_id || emp.upiId || '').replace(/"/g, '""')}"`,
            `"${formatUrl(emp.upload_your_resume || emp.resumeUrl)}"`,
            `"${formatUrl(emp.aadhar_card || emp.aadharCardUrl)}"`,
            `"${formatUrl(emp.pan_card || emp.panCardUrl)}"`,
            `"${formatUrl(emp.ten_marksheet || emp.marksheet10Url)}"`,
            `"${formatUrl(emp.twelve_marksheet || emp.marksheet12Url)}"`,
            `"${formatUrl(emp.upload_your_bachelor_s_passing_certificate || emp.bachelorCertUrl)}"`,
            `"${formatUrl(emp.upload_your_master_s_passing_certificate || emp.masterCertUrl)}"`,
            `"${formatUrl(emp.bachelor_marksheet_all || emp.upload_your_bachelor_s_marksheet__all_marksheet_together_)}"`,
            `"${formatUrl(emp.master_marksheet_all || emp.upload_your_masters_marksheet__all_marksheet_together_)}"`,
            `"${formatUrl(emp.experience_letter || emp.experience_letter__if_any_ || emp.expLetterUrl)}"`,
            `"${formatUrl(emp.onboardingChecklist?.hrMeetingScreenshot)}"`,
        ]);

        const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="Full_Onboarding_Details.csv"'
            }
        });

    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
