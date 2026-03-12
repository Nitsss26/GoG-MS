"use client";
import { COLLEGES as INITIAL_COLLEGES, College } from "@/lib/colleges";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    sendMail,
    getAuthorityEmails,
    getTicketTemplate,
    getLeaveTemplate,
    getMisbehaviourTemplate,
    getPIPAddTemplate,
    getReimbursementTemplate,
    getMoMTemplate,
    getAdditionalResponsibilityTemplate,
    getDressCodeWarningTemplate,
    getMarkAsPresentTemplate,
    getWorkScheduleTemplate,
    getHolidayTemplate,
    getRatingTemplate,
    getBirthdayTemplate,
    getAnnouncementTemplate,
    getSOPUpdateTemplate
} from "@/lib/mail";

// ─── TYPES ───
export type Role = "FOUNDER" | "HR" | "AD" | "TL" | "HOI" | "OM" | "FACULTY" | "PROFESSOR";

export interface PortalNotification {
    id: string; from: string; fromName: string; to: string; toName: string;
    message: string; type: "leave" | "ticket" | "flag" | "holiday" | "attendance" | "general";
    read: boolean; createdAt: string;
}

export interface User {
    id: string; name: string; email: string; role: Role; isOnboarded: boolean;
    photoUrl?: string;
}
export interface EducationRecord { degree: string; institution: string; yearOfPassing: string; percentage: string; }
export interface ExperienceRecord { company: string; role: string; duration: string; lastSalary: number; payslipRef?: string; }
export interface Employee extends User {
    dept: string;
    designation: string;
    status: "Active" | "On Leave" | "On Site" | "Resigned";
    joiningDate: string;
    salary: number;
    location: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    phone?: string;
    address?: string;
    chancesRemaining: number;
    reportsTo?: string | string[];
    managerLevel?: string;
    password?: string;
    // Database Fields
    fines?: {
        total: number;
        records: { amount: number; reason: string; date: string; }[];
    };
    biWeeklyScores?: {
        score: number;
        period: string;
        date?: string;
        points: number;
        status?: string;
    }[];
    // Bank Details
    bankAccountName?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    // Institutional Docs
    resumeUrl?: string;
    bachelorCertUrl?: string;
    masterCertUrl?: string;
    bachelorMarksheetUrl?: string;
    masterMarksheetUrl?: string;
    marksheet10Url?: string;
    marksheet12Url?: string;
    aadharCardUrl?: string;
    panCardUrl?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    passportPhotoUrl?: string;
    bankPassbookUrl?: string;
    expLetterUrl?: string;
    // Additional Info
    fatherMotherName?: string;
    parentsPhone?: string;
    linkedinId?: string;
    collegeName?: string;
    bachelorQual?: string;
    masterQual?: string;
    // Metrics
    markPresentUsed?: number;
    dressCodeDefaults?: number;
    designationDate?: string;
    // Legacy Compatibility
    education?: any[];
    experience?: any[];
    bankName?: string;
    accountNumber?: string;
    // Database Snake Case Mapping (Direct from MongoDB)
    full_name?: string;
    phone_no_?: string;
    father_name_or_mother_name?: string;
    parents_phone_no_?: string;
    permanent_address?: string;
    bachelor_s_qualification____ex___b_tech__cse____iit_guwahati_?: string;
    master_s_qualification____ex___m_tech__cse____iit_guwahati_?: string;
    you_are_from_?: string;
    current_designation_at_gog?: string;
    upload_your_resume?: string;
    upload_your_bachelor_s_passing_certificate?: string;
    upload_your_master_s_passing_certificate?: string;
    linkedin_id?: string;
    bank_account_number?: string;
    ifsc_code?: string;
    account_holder_name?: string;
    upi_id?: string;
    "10th_marksheet"?: string;
    "12th_marksheet"?: string;
    aadhar_card?: string;
    pan_card?: string;
    passport_size_photo?: string;
    bank_passbook___cancelled_cheque?: string;
    experience_letter__if_any_?: string;
    which_college_are_you_from_?: string;
    date_of_birth?: string;
    blood_group?: string;
    upload_your_bachelor_s_marksheet__all_marksheet_together_?: string;
    upload_your_masters_marksheet__all_marksheet_together_?: string;
}
export interface LeaveRequest {
    id: string; employeeId: string; employeeName: string; type: string;
    startDate: string; endDate: string; days: number;
    status: "Pending" | "Approved" | "Rejected"; classification: "Paid" | "Unpaid";
    leaveType: "Planned" | "Emergency"; reason?: string; proofUrls?: string[];
    lossOfPayDays?: number;
    emergencyCategory?: "Accident" | "Death" | "In Hospital";
    appliedAt?: string;
    reasonForAction?: string;
}
export interface MeetingRequest {
    id: string; employeeId: string; employeeName: string; targetName: string;
    purpose: string; date: string; time: string;
    status: "Pending" | "Scheduled" | "Completed" | "Rescheduled";
    googleLink?: string;
    agenda?: string;
    attendees?: { id: string; name: string; status?: 'Present' | 'Absent (Genuine)' | 'Absent (Non-Genuine)'; reason?: string }[];
    screenshotUrls?: string[];
    createdAt?: string;
}
export interface Notice {
    id: string; title: string; content: string;
    category: "General" | "Policy" | "Event" | "Urgent" | "Update" | "HR" | "Achievement" | "Training" | "Birthday" | "Welcome";
    createdBy: string; createdAt: string;
    readBy?: string[]; isEdited?: boolean; editedAt?: string; imageUrls?: string[];
}
export interface PayrollRecord {
    id: string; employeeId: string; month: string; year: string; amount: number;
    deductions: { tax: number; pf: number; other: number }; reimbursements: number; generatedAt: string;
}
export interface SOP { id: string; title: string; version: string; content: string; lastUpdated: string; updatedBy: string; previousContent?: string; changeType: "new" | "updated" | "deleted"; changelog?: string; }
export interface SOPNotification { id: string; sopId: string; title: string; changeType: "new" | "updated" | "deleted"; changedBy: string; changedAt: string; readBy: string[]; changelog?: string; previousContent?: string; newContent?: string; }
export interface MarkAsPresentRequest {
    id: string; employeeId: string; employeeName: string; date: string;
    reason: string; proofUrls?: string[];
    status: "Pending" | "Approved" | "Rejected";
    appliedAt: string;
}
export interface AttendanceRecord {
    id: string; employeeId: string; date: string; clockIn: string; clockOut?: string;
    location: string; status: "Present" | "Absent" | "Half-day" | "On Leave" | "Holiday" | "Mark As Present Request";
    flags: { late?: boolean; earlyOut?: boolean; locationDiff?: boolean; misconduct?: boolean; dressCode?: boolean; meetingAbsent?: boolean; performance?: boolean; };
    isApprovedByHR: boolean; dressCodeImageUrl?: string;
    dressCodeStatus?: "Pending" | "Approved" | "Rejected" | "N/A";
}
export interface Ticket {
    id: string; raisedBy: string; employeeName: string; targetCategory: string;
    subject: string; content: string; proofUrls?: string[];
    status: "Open" | "In Progress" | "Resolved" | "Closed"; createdAt: string;
    resolvedAt?: string; assignedTo?: string; cc?: string[]; resolutionNotes?: string;
    routeTo?: string;
    targetEmployeeId?: string;
    targetDate?: string;
}
export interface Holiday {
    id: string; name: string; date: string; collegeId?: string;
    status: "Proposed" | "Approved"; proposedBy: string; proposedByName?: string;
    proofUrl?: string; customMessage?: string; forAll?: boolean;
}
export interface PIPRecord {
    id: string; employeeId: string; employeeName: string; reason: string;
    startDate: string; status: "Active" | "Completed" | "Failed"; warnings: number; disclaimer: string;
    resolvedReason?: string; resolvedProofs?: string[]; resolvedAt?: string;
}
export interface PerformanceStar { employeeId: string; stars: number; rating: number; badges: string[]; }
export interface MOM { id: string; meetingId: string; content: string; decision: string; attendees: { employeeId: string; present: boolean; reason?: string }[]; sentToCC: string[]; }
export interface ReimbursementClaim {
    id: string; employeeId: string; employeeName: string; email: string; phone: string;
    type: string; amount: number; monthYear: string; description: string;
    driveLink?: string; proofUrls?: string[];
    status: "Pending" | "Approved - Pending Payment" | "Approved - Payment Done" | "Rejected";
    rejectionReason?: string; hrRemarks?: string; date: string;
}
export interface WorkSchedule {
    employeeId: string; employeeName?: string; approvedByHR?: boolean;
    assignedBy?: string; assignedByName?: string; reason?: string;
    dayWise: { [key: string]: { location: string; clockInTime: string; clockOutTime: string; }; };
}
export interface MisbehaviourReport {
    id: string; reportedBy: string; reportedByName: string; employeeId: string; employeeName: string;
    type: "Behavioral" | "Performance" | "Meeting Absent";
    description: string; date: string; ccList: string[];
    meetingScheduled?: boolean; meetingStep?: number;
    propagationChain?: { level: string; name: string; notified: boolean }[];
}
export interface Rating {
    id: string; employeeId: string; employeeName: string; ratedBy: string; ratedByName: string;
    score: number; period: string; comment?: string; date: string;
}
export interface AdditionalResponsibility {
    id: string; employeeId: string; employeeName: string; addedBy: string;
    description: string; date: string;
    status: "Pending" | "Approved" | "Rejected";
    points: number;
}
export interface OrgNode {
    id: string; name: string; designation: string; level: "C-Suite" | "Management" | "Leadership" | "OM" | "Faculty";
    parentId?: string; photoInitial: string; dept: string;
}
// ─── LEGACY INTERFACES (for backward compat) ───
export interface JobPosting { id: string; title: string; department: string; location: string; type: string; status: "Active" | "Closed"; postedBy: string; postedAt: string; description: string; requirements: string[]; }
export interface AchievementCertificate { id: string; employeeId: string; employeeName: string; type: string; description: string; issuedAt: string; issuedBy: string; }
export interface ResignationRequest { id: string; employeeId: string; employeeName: string; reason: string; lastWorkingDate: string; status: "Pending" | "Approved" | "Rejected"; appliedAt: string; noticePeriod: number; }
export interface Asset { id: string; name: string; type: string; serialNumber: string; assignedTo?: string; status: "Available" | "Assigned" | "Maintenance"; }
export interface AssetRequest { id: string; employeeId: string; employeeName: string; assetType: string; reason: string; status: "Pending" | "Approved" | "Rejected"; requestedAt: string; }

// ─── INITIAL DATA ───
const INITIAL_EMPLOYEES: Employee[] = [
    {
        id: "EMP127",
        name: "Nitesh",
        email: "nitesh@geeksofgurukul.com",
        role: "TL",
        photoUrl: "https://res.cloudinary.com/dwaepohvf/image/upload/v1773050409/sdgubdunfbltriwqhddr.jpg",
        isOnboarded: true,
        dept: "NIT",
        designation: "TL",
        status: "Active",
        joiningDate: "01-01-2024",
        salary: 50000,
        location: "sage-bhopal",
        dateOfBirth: "26/08/2001",
        phone: "7009090762",
        bloodGroup: "A-",
        reportsTo: ["FND001"],
        chancesRemaining: 3,
        password: "26082001",
        address: "H.no 31 New Mahindra Colony, Amritsar",
        bankAccountName: "Nitesh",
        bankAccountNumber: "506402010521771",
        ifscCode: "UBIN0550647",
        upiId: "niteshshr123@oksbi",
        collegeName: "NIT",
        // Additional mapping from provided JSON
        father_name_or_mother_name: "Ashok Kumar",
        parents_phone_no_: "9781681700",
        permanent_address: "H.no 31 New Mahindra Colony, Amritsar",
        bachelor_s_qualification____ex___b_tech__cse____iit_guwahati_: "B.Tech (ECE) Major : NIT Jalandhar, B.Tech (CSE) Minor : NIT Jalandhar",
        master_s_qualification____ex___m_tech__cse____iit_guwahati_: "NA",
        you_are_from_: "NIT",
        current_designation_at_gog: "TL",
        upload_your_resume: "https://drive.google.com/open?id=13zk7FlZ6TffLQ2QAhcvpH1hSO02xQIFr",
        upload_your_bachelor_s_passing_certificate: "https://drive.google.com/open?id=10Yk0jv-hmut2B_adfmPv6J13inXgpo_p",
        upload_your_master_s_passing_certificate: "",
        linkedin_id: "https://www.linkedin.com/in/nitesh-shr-304539281?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
        bank_account_number: "506402010521771",
        ifsc_code: "UBIN0550647",
        account_holder_name: "Nitesh",
        upi_id: "niteshshr123@oksbi",
        "10th_marksheet": "https://drive.google.com/open?id=1YSGezocgsOC1OgYY7hRaC2OAT1mmqunN",
        "12th_marksheet": "https://drive.google.com/open?id=1-Q_KQ_mukFANYyxoWjJuJzYJMKTvLv6w",
        aadhar_card: "https://drive.google.com/open?id=1v2JZ_rk-0xvWeWsROhrX0s7whQUBYY1R",
        pan_card: "https://drive.google.com/open?id=1cwyx0nhkuUUq6lolWl6LboYNh8vo-QFQ",
        passport_size_photo: "https://drive.google.com/open?id=1qyVg149Y__iOMj9qfTIgbpX0wKA4x1Yd",
        bank_passbook___cancelled_cheque: "https://drive.google.com/open?id=1DtXUChLNmuuFUR-Pg7hcWUl6Fe1rf2vV",
        experience_letter__if_any_: "",
        which_college_are_you_from_: "NIT",
        date_of_birth: "26/08/2001",
        blood_group: "A-",
        upload_your_bachelor_s_marksheet__all_marksheet_together_: "https://drive.google.com/open?id=1WP5H6us9EkJfdqdJlXaAb3gpDbTCHM2v",
        upload_your_masters_marksheet__all_marksheet_together_: "",
        biWeeklyScores: [
            { period: "Mar 01 - Mar 15, 2026", score: 4.2, points: 35, status: "Recorded" },
            { period: "Feb 15 - Feb 28, 2026", score: 3.5, points: -45, status: "Recorded" },
            { period: "Feb 01 - Feb 14, 2026", score: 4.8, points: 50, status: "Recorded" },
            { period: "Jan 15 - Jan 31, 2026", score: 3, points: -80, status: "Recorded" }
        ],
        designationDate: "01-12-2025",
        fines: {
            total: 2500,
            records: [
                { amount: 100, reason: "Late Arrival", date: "2026-03-03" },
                { amount: 100, reason: "Late Arrival", date: "2026-03-02" },
                { amount: 200, reason: "Dress Code Violation", date: "2026-02-23" },
                { amount: 200, reason: "Dress Code Violation", date: "2026-02-21" },
                { amount: 100, reason: "Late Arrival", date: "2026-02-18" },
                { amount: 100, reason: "Late Arrival", date: "2026-02-17" },
                { amount: 100, reason: "Late Arrival", date: "2026-02-12" },
                { amount: 200, reason: "Dress Code Violation", date: "2026-02-11" },
                { amount: 200, reason: "Dress Code Violation", date: "2026-02-07" },
                { amount: 100, reason: "Late Arrival", date: "2026-02-03" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-23" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-21" },
                { amount: 200, reason: "Dress Code Violation", date: "2026-01-19" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-17" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-15" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-14" },
                { amount: 200, reason: "Dress Code Violation", date: "2026-01-13" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-12" },
                { amount: 100, reason: "Late Arrival", date: "2026-01-08" }
            ]
        }
    },
    {
        id: "EMP100",
        name: "Anirudha Rajodiya",
        email: "anirudha@geeksofgurukul.com",
        role: "PROFESSOR",
        photoUrl: "https://drive.google.com/open?id=1Bnxj1GQwbBvUM-ywSJHJVaOAg8Og7XXN",
        isOnboarded: true,
        dept: "IIT",
        designation: "SDE & Professor",
        status: "Active",
        joiningDate: "2024-01-01",
        salary: 50000,
        location: "sage-bhopal",
        dateOfBirth: "?",
        phone: "7869751211",
        bloodGroup: "?",
        reportsTo: ["EMP135"],
        chancesRemaining: 3,
        password: "26082001",
        address: "Khejra road, Gomati Marriage Garden, Gulab Ganj Cantt, Guna, 473001, Madhya Pradesh",
        bankAccountName: "Anirudha Rajodiya",
        bankAccountNumber: "157869751211",
        ifscCode: "INDB0000069",
        upiId: "7869751211@pthdfc",
        collegeName: "IIT",
        fatherMotherName: "Devendra Kumar Rajodiya",
        parentsPhone: "6260744385",
        bachelorQual: "B.Tech (AGFE) IIT KHARAGPUR",
        masterQual: "M.Tech (AGFE) IIT KHARAGPUR",
        linkedinId: "www.linkedin.com/in/anirudha-rajodiya-6356b5221",
        resumeUrl: "https://drive.google.com/open?id=11I0VWsYzVjPmkf08f5k3zMqObeaQgk3-",
        bachelorCertUrl: "https://drive.google.com/open?id=1YTlb0MDrM_9FEC3Iz02LLZIYymz1TNy2",
        masterCertUrl: "https://drive.google.com/open?id=1ENCMDOgsT0LZ0Q0HV7F_9Bned-OTJaNX",
        marksheet10Url: "https://drive.google.com/open?id=1QltZjpZi_zMayWGpt1M8uQwxFc2RTlHu",
        marksheet12Url: "https://drive.google.com/open?id=1g20oyaIyxPYwFeuGmYO8YkRaDgvLyDqb",
        aadharCardUrl: "https://drive.google.com/open?id=1UA0dYmFBUlIxtJlJlKL_n2Bd4kX9Hhht",
        panCardUrl: "https://drive.google.com/open?id=1mG0Ma-zEhmQqR2VUkfe3wCx1QZlzmfrO",
        passportPhotoUrl: "https://drive.google.com/open?id=1Bnxj1GQwbBvUM-ywSJHJVaOAg8Og7XXN",
        bankPassbookUrl: "https://drive.google.com/open?id=1PgHGUzgBUMmJ3bJyASP0dqO9jsQkDXpD",
        biWeeklyScores: [
            { period: "Feb 15 - Feb 28, 2026", score: 4.9, points: 490, date: "2026-02-28" },
            { period: "Feb 01 - Feb 14, 2026", score: 4.8, points: 480, date: "2026-02-14" }
        ],
        designationDate: "2024-01-01"
    }
];
const MASTER_SOP_CONTENT = `
    ** Mandatory Dress Code **

    All employees must strictly adhere to the following dress code during working hours:

- ** White formal shirt with collar **
- ** Black Pant with Belt **
- ** Black formal blazer **
- ** Formal shoes **

    Casual attire is ** strictly prohibited ** unless specifically approved by Management for official events.

### Dress Code Violation \u2013 Disciplinary Process(For All Professors)

Non - compliance with the prescribed dress code will result in ** progressive disciplinary action **, applicable to ** all Professors **, and will be recorded in HR records:

1. ** 1st Instance ** \u2013 First warning via email.Entry recorded in HR records.
2. ** 2nd Instance ** \u2013 Second warning via email.Entry recorded in HR records.
3. ** 3rd Instance ** \u2013 Third warning via email. ** 10 % fine deducted from one day\u2019s gross salary.**
    4. ** 4th Instance ** \u2013 Fourth warning via email. ** 20 % fine deducted from one day\u2019s gross salary.**
        5. ** 5th Instance and Subsequent Violations ** \u2013 Fifth warning via email. ** 30 % fine deducted from one day\u2019s gross salary.** Further disciplinary action may be initiated at the Management\u2019s discretion.

> ** Important Notes:** Penalties will be applied per day of non - compliance.Repeated violations may adversely impact performance reviews and disciplinary records.The Management reserves the right to take strict disciplinary action in cases of habitual non - compliance.

## 3.2 Attendance Timing

    - ** General Attendance Requirements:** All faculty members are required to post their geotag attendance in their respective Attendance Channel within the office premises at the official office hours, as per the schedule shared by the HR department.A grace period of 2 minutes will be allowed.Any attendance marked beyond this will be considered late.

- ** Late Arrival Procedure:** If an employee is unable to post their attendance at office time, they must submit a separate attendance post with a valid reason explaining the delay.

** Late Arrivals Policy:**
- ** 4th instance ** \u2013 Half - day pay cut
    - ** 5th instance ** \u2013 Full - day pay cut
        - ** 6th instance and onwards ** \u2013 2 days\u2019 pay cut

            ** Additional Rules & Penalties:**
                - If any employee forgets to upload attendance(Clock -in and Clock - out), a ** fine of Rs. 500 ** will be charged.
- A photo must be uploaded on Slack within ** 30 minutes of Clock -in**.Failure more than 2 instances in a month without proper reason will result in a ** fine of Rs. 100 ** for each instance thereafter.
- Clock -in and Clock - out photos must be taken inside the college premises.

## 3.3 Office Premises and Hours

    - All employees have to be present within the office premises during working hours, unless permission for an exception is granted.
- Employees are allowed to leave the premises ** only ** during the designated lunch break.
- If Employees are going out during lunch break, they need to mention: ** "Going for Lunch" ** and ** "Returned to college after Lunch" ** in the attendance channel thread.

## 3.4 Office Work and Conduct

    - During office hours, employees must remain focused on official tasks, such as preparing lecture notes, assignments, or any other work - related duties.
- Employees should refrain from engaging in any personal or non - work - related activities within the office premises.
- Faculty members must maintain professional boundaries with students.

## 3.5 Professionalism with College Administration

    - Employees must maintain professionalism when interacting with the college administration.
- Employees are prohibited from spreading negativity about the organization.
- Any instances of office politics or rumours must be reported directly to HR.

## 3.6 Availability during Office Hours

    - During office hours, all faculty members must be available for communication via phone calls, Slack and emails.
- If unable to join a scheduled Google Meet, inform ** at least 10 minutes in advance ** in their respective college channel on Slack by tagging the reporting manager and HR.
- If absent in the meeting without informing, ** disciplinary action will be taken **.

## 3.7 Leave Policy for SDE & Professor & HoI\u2019s

    - ** Total 12 Paid Leave ** provided in ** 1 Year ** that starts from date of joining.
- They can avail ** 1 Paid Leave in 1 Month **.More than 1 Leave will be considered as Un - Paid Leave.

** 1. Casual Leave:** The employee must obtain permission from the HoI at least 18 hours in advance.After receiving approval, send email to HR(hr@geeksofgurukul.com) with CC to HoI, Academic Lead, CTO, COO before 6pm.

** 2. Emergency Leave:** In case of emergency, inform reporting manager via call first.After recovering, send emergency leave email to HR with valid proof.If proof not provided, leave will be unpaid and fine of Rs. 500 applicable.

** 3. College Employee Leave Criteria:** Only one professor from each college shall be permitted to take leave on the same day.Unauthorized leave = two - days unpaid leave for every one day.

## 3.8 Leave Policy for Operation Manager & Associate

    - ** Total 12 Paid Leave ** provided in ** 1 Year ** that starts from date of joining.
- They can avail ** 1 Paid Leave in 1 Month **.More than 1 Leave = Un - Paid Leave.

** 1. Casual Leave:** Submit application via mail to HoI at least 24 hours in advance.After HOI approval, email HR with CC HoI, CTO, COO before 6pm.

** 2. Emergency Leave:** Send leave request via email to HR with CC to HoI, CTO, COO.After emergency, reply in same email thread with valid proof.

## 3.9 Work from Home(WFH) Policy for Operation Manager & Associate

    - OM may be permitted to work from home in case of emergencies with evidence.
- HoI will assign specific tasks; if not completed, day will be marked as leave.
- All tasks must be submitted by 9:00 PM on the day of WFH.
- Each employee is required to attend at least one Ops meeting during WFH.
- Must inform HR and Reporting Manager at least 15 hours before(before 6:00 PM previous day).
- OMs who WFH will receive ** half - day pay **.

## 3.10 General Mandatory Protocols for OM / Interns

1. ** Meeting Communication:** Inform HoI at least 10 minutes in advance via call or Slack if unable to join scheduled Ops meeting.
2. ** Minutes of Meeting(MoM):** Mandatory to mention presence / absence of OM in MoM.
3. ** Dashboard Updates:** Every OM must regularly and accurately update their respective dashboard channel.

## 3.11 Prohibition of Smoking and Chewing Tobacco

Smoking and the use of chewing tobacco are strictly prohibited within the office premises.Violation will result in disciplinary action, including possible suspension.

## 3.12 Harassment - Free Workplace

    - ** Zero Tolerance for Harassment:** All employees must maintain a respectful, harassment - free work environment.
- Employees must immediately report any harassment incidents to HR.
- Employees found guilty will face strict disciplinary actions, including suspension or termination.

## 3.13 Probation & Notice Period

    - All new employees will be on a ** 6 - month probation period **.Notice period will be either 7 days or 30 days.
- ** Full and Final(FNF) Settlement:** Completed within a maximum of 45 calendar days from last working day.Disbursement between the 15th and 20th of the following month.

## 3.14 Performance - Based Termination Policy for SDEs & Professors

    - If student rating below 4.2 for three consecutive weeks \u2192 three formal warnings.
- If no improvement \u2192 may be terminated with a 7 - day notice period.
- Decision jointly taken by HoI and HR.

## 4. Responsibility

    - ** Employees:** Follow all policies outlined in this SOP.
- ** HR Department:** Enforce this SOP, handle disciplinary actions.
- ** Reporting Managers:** Ensure all employees adhere to the SOP.

## 5. Review and Revision

This SOP will be reviewed quarterly by the HR department and the administration.

## 6. Effective Date

This SOP will be effective as of: ** 1st April 2025 **

    ---

* Approved by: ** Ajay Katana **, Co - Founder & CTO, Geeks of Gurukul * `;

const INITIAL_SOPS: SOP[] = [
    { id: "sop1", title: "Dress Code Policy (3.1)", version: "2.1", content: "All employees must wear formal attire. White shirt, black pant, black blazer, formal shoes. Smart casuals not allowed except with Management approval. Progressive fines: 1st-2nd warning, 3rd=10%, 4th=20%, 5th+=30% of daily salary.", lastUpdated: "2024-02-25", updatedBy: "Vivek Yadav", changeType: "updated", changelog: "Updated fine percentages for dress code violations" },
    { id: "sop2", title: "Attendance & Timing (3.2)", version: "1.4", content: "Geotag attendance required at official hours. 2-min grace period. Late 4th instance=half-day cut, 5th=full-day, 6th+=2 days. Forgot upload=Rs.500 fine. Photo within 30min of clock-in.", lastUpdated: "2024-02-20", updatedBy: "Vivek Yadav", changeType: "new" },
    { id: "sop3", title: "Leave Policy - Faculty (3.7)", version: "1.2", content: "12 paid leaves/year, 1/month. Casual leave: 18hrs advance to HoI, email HR with CC. Emergency: call manager first, email proof after recovery. Only 1 professor per college per day.", lastUpdated: "2024-02-18", updatedBy: "Vivek Yadav", changeType: "new" },
    { id: "sop4", title: "Leave Policy - OM (3.8)", version: "1.0", content: "12 paid leaves/year, 1/month. Casual: 24hrs advance email to HoI. Emergency: email HR with CC to HoI, CTO, COO. Reply with proof in same thread.", lastUpdated: "2024-02-18", updatedBy: "Vivek Yadav", changeType: "new" },
    { id: "sop5", title: "WFH Policy - OM (3.9)", version: "1.0", content: "Emergency WFH only with evidence. HoI assigns tasks, uncompleted=leave. Tasks due by 9PM. Must attend 1 Ops meeting. Inform HR 15hrs before. WFH=half-day pay.", lastUpdated: "2024-02-15", updatedBy: "Vivek Yadav", changeType: "new" },
    { id: "sop6", title: "Harassment-Free Workplace (3.12)", version: "1.0", content: "Zero tolerance for harassment. Report to HR immediately. Guilty employees face suspension or termination.", lastUpdated: "2024-02-10", updatedBy: "Vivek Yadav", changeType: "new" },
];

const INITIAL_SOP_NOTIFICATIONS: SOPNotification[] = [
    { id: "sopn1", sopId: "sop1", title: "Dress Code Policy (3.1)", changeType: "updated", changedBy: "Vivek Yadav", changedAt: "2024-02-25", readBy: [] },
    { id: "sopn2", sopId: "sop2", title: "Attendance & Timing (3.2)", changeType: "new", changedBy: "Vivek Yadav", changedAt: "2024-02-20", readBy: [] },
];

// Helper to generate Feb 2026 attendance (Mon-Sat working, Sun off)
const FEB26_WORKING = ["02", "03", "04", "05", "06", "07", "09", "10", "11", "12", "13", "14", "16", "17", "18", "19", "20", "21", "23", "24", "25", "26", "27", "28"];
const _a = (id: string, eid: string, day: string, ci: string, co: string, loc: string, fl: any): AttendanceRecord => ({ id, employeeId: eid, date: `2026-02 - ${day} `, clockIn: ci, clockOut: co, location: loc, status: "Present", flags: fl, isApprovedByHR: true });
const INITIAL_ATTENDANCE: AttendanceRecord[] = [
    // FAC001 - Anil Kumar (SAGE Bhopal) — has late, earlyOut, dressCode flags
    ...FEB26_WORKING.map((d, i) => _a(`a1_${i} `, "FAC001", d,
        ["10", "17"].includes(d) ? "10:20" : "09:05",
        ["06", "20"].includes(d) ? "16:00" : "18:10",
        "SAGE Bhopal", {
        late: ["10", "17"].includes(d),
        earlyOut: ["06", "20"].includes(d),
        dressCode: d === "12",
        misconduct: d === "25",
    })),
    // FAC002 - Meera Das (SAGE Indore, Wed WFH) — has performance, meetingAbsent
    ...FEB26_WORKING.filter(d => d !== "11").map((d, i) => _a(`a2_${i} `, "FAC002", d,
        d === "16" ? "10:45" : "09:00",
        d === "19" ? "16:30" : "18:00",
        ["04", "11", "18", "25"].includes(d) ? "WFH" : "SAGE Indore", {
        late: d === "16",
        earlyOut: d === "19",
        performance: d === "23",
        meetingAbsent: d === "09",
    })),
    // FAC003 - Priya Singh (Barkatullah, Fri WFH) — has misconduct, locationDiff
    ...FEB26_WORKING.filter(d => d !== "17").map((d, i) => _a(`a3_${i} `, "FAC003", d,
        d === "03" ? "10:30" : "09:00",
        d === "24" ? "15:30" : "17:10",
        ["06", "13", "20", "27"].includes(d) ? "WFH" : "BU Bhopal", {
        late: d === "03",
        earlyOut: d === "24",
        locationDiff: d === "10",
        misconduct: d === "18",
    })),
    // FAC004 - Rahul Das — has dressCode, performance, meetingAbsent
    ...FEB26_WORKING.filter(d => !["14", "21"].includes(d)).map((d, i) => _a(`a4_${i} `, "FAC004", d,
        d === "05" ? "10:15" : "09:10",
        d === "26" ? "16:00" : "18:00",
        "SAGE Bhopal", {
        late: d === "05",
        earlyOut: d === "26",
        dressCode: ["09", "16"].includes(d),
        performance: d === "19",
        meetingAbsent: d === "12",
    })),
    // FAC005 - Sneha Reddy — has late, misconduct
    ...FEB26_WORKING.map((d, i) => _a(`a5_${i} `, "FAC005", d,
        ["04", "18"].includes(d) ? "10:40" : "08:55",
        d === "13" ? "15:45" : "18:05",
        "SAGE Indore", {
        late: ["04", "18"].includes(d),
        earlyOut: d === "13",
        misconduct: d === "27",
    })),
    // FAC006 - Vikram Deshmukh — has dressCode, meetingAbsent
    ...FEB26_WORKING.filter(d => d !== "07").map((d, i) => _a(`a6_${i} `, "FAC006", d,
        d === "23" ? "10:10" : "09:00",
        "18:00", "Centurion", {
        late: d === "23",
        dressCode: d === "11",
        meetingAbsent: d === "20",
    })),
    // OM001 - Arjun Sharma (Centurion, Sat WFH) — has late, performance
    ...FEB26_WORKING.map((d, i) => _a(`a7_${i} `, "OM001", d,
        d === "02" ? "10:00" : "09:30",
        d === "27" ? "16:30" : "18:30",
        ["07", "14", "21", "28"].includes(d) ? "WFH" : "Centurion", {
        late: d === "02",
        earlyOut: d === "27",
        performance: d === "16",
    })),
    // OM002 - Kavitha Nair (Scope Global) — has dressCode, late
    ...FEB26_WORKING.map((d, i) => _a(`a8_${i} `, "OM002", d,
        ["06", "19"].includes(d) ? "10:25" : "09:00",
        d === "12" ? "16:15" : "18:00",
        "Scope Global", {
        late: ["06", "19"].includes(d),
        earlyOut: d === "12",
        dressCode: d === "24",
    })),
    // OM003 - Amit Patel — has meetingAbsent, locationDiff
    ...FEB26_WORKING.filter(d => d !== "28").map((d, i) => _a(`a9_${i} `, "OM003", d,
        d === "10" ? "10:35" : "09:05",
        "18:00", "SAGE Bhopal", {
        late: d === "10",
        meetingAbsent: d === "17",
        locationDiff: d === "05",
    })),
    // HOI001 - Ayush Chauhan — has late
    ...FEB26_WORKING.map((d, i) => _a(`a10_${i} `, "HOI001", d,
        d === "11" ? "10:00" : "09:00",
        "19:00", "SAGE Bhopal", {
        late: d === "11",
    })),
    // HOI002 - Sachin Kumar — has earlyOut
    ...FEB26_WORKING.map((d, i) => _a(`a11_${i} `, "HOI002", d,
        "09:00",
        d === "20" ? "15:00" : "18:30",
        "SAGE Indore", {
        earlyOut: d === "20",
    })),
    // HOI003 - Sidhartha Paikaray — clean month
    ...FEB26_WORKING.map((d, i) => _a(`a12_${i} `, "HOI003", d, "09:00", "18:30", "Centurion", {})),
    // HR001 - Vivek Yadav — has late
    ...FEB26_WORKING.map((d, i) => _a(`a13_${i} `, "HR001", d,
        d === "09" ? "10:15" : "09:00", "18:00", "SAGE Bhopal", { late: d === "09" })),
    // AD001 - Raj Kumar Sahoo — clean
    ...FEB26_WORKING.map((d, i) => _a(`a14_${i} `, "AD001", d, "08:50", "19:00", "SAGE Bhopal", {})),
    // EMP127 - Nitesh — has various flags from Jan to Mar 8
    ...(() => {
        const records: AttendanceRecord[] = [];
        const generateMonth = (m: number, year: number, flagDays: Record<number, any>, leaveDays: number[] = []) => {
            const daysInMonth = new Date(year, m, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayOfWeek = new Date(year, m - 1, d).getDay();
                if (dayOfWeek === 0) continue; // Skip Sundays

                if (m === 3 && d > 10) continue; // Only up to March 10 for Nitesh requested logs

                if (leaveDays.includes(d)) {
                    records.push({ id: `att_n_${m}_${d}`, employeeId: "EMP127", date, clockIn: "—", clockOut: "—", location: "—", status: "On Leave", flags: {}, isApprovedByHR: true });
                } else {
                    const isLate = flagDays[d]?.late;
                    const isDress = flagDays[d]?.dressCode;
                    records.push({
                        id: `att_n_${m}_${d}`, employeeId: "EMP127", date,
                        clockIn: isLate ? "10:15" : "09:00",
                        clockOut: "18:00",
                        location: "SAGE Bhopal",
                        status: "Present",
                        flags: flagDays[d] || {},
                        isApprovedByHR: true
                    });
                }
            }
        };

        // JAN 2026 Flags
        generateMonth(1, 2026, {
            8: { late: true }, 12: { late: true }, 13: { dressCode: true }, 14: { late: true },
            15: { late: true }, 17: { late: true }, 19: { dressCode: true, late: true }, // Multiple flags
            21: { late: true }, 23: { late: true }
        });
        // FEB 2026 Flags
        generateMonth(2, 2026, {
            3: { late: true }, 7: { dressCode: true }, 11: { dressCode: true }, 12: { late: true },
            17: { late: true }, 18: { late: true }, 21: { dressCode: true }, 23: { dressCode: true, misconduct: true }
        });
        // MAR 2026 Flags
        generateMonth(3, 2026, {
            2: { late: true }, 3: { late: true }, 4: { dressCode: true },
            7: { late: true, dressCode: true },
            8: { meetingAbsent: true, performance: true, misconduct: true },
            9: { earlyOut: true, locationDiff: true, late: true },
            10: { misconduct: true, dressCode: true, meetingAbsent: true, performance: true }
        }, [6]); // March 6 as Leave

        return records;
    })(),
];

const INITIAL_MEETINGS: MeetingRequest[] = [
    {
        id: "m1", employeeId: "HR001", employeeName: "Vivek Yadav", targetName: "All Faculty",
        purpose: "Weekly Progress Review", date: "2024-03-10", time: "11:00",
        status: "Scheduled", googleLink: "https://meet.google.com/abc-defg-hij",
        agenda: "Reviewing faculty performance and dress code adherence.",
        attendees: [
            { id: "FAC001", name: "Anil Kumar" },
            { id: "FAC002", name: "Meera Das" }
        ],
        createdAt: "2024-03-05T10:00:00Z"
    },
];

const INITIAL_LEAVES: LeaveRequest[] = [
    { id: "lv1", employeeId: "FAC001", employeeName: "Anil Kumar", type: "Casual", startDate: "2024-03-05", endDate: "2024-03-05", days: 1, status: "Approved", classification: "Paid", leaveType: "Planned", reason: "Personal work" },
    { id: "lv2", employeeId: "FAC003", employeeName: "Priya Singh", type: "Sick", startDate: "2024-03-10", endDate: "2024-03-11", days: 2, status: "Pending", classification: "Paid", leaveType: "Emergency", reason: "Fever and cold" },
    { id: "lv3", employeeId: "OM001", employeeName: "Arjun Sharma", type: "Casual", startDate: "2024-03-15", endDate: "2024-03-15", days: 1, status: "Pending", classification: "Paid", leaveType: "Planned", reason: "Family function" },
    { id: "lv4", employeeId: "FAC005", employeeName: "Sneha Reddy", type: "Privilege", startDate: "2024-04-01", endDate: "2024-04-05", days: 5, status: "Pending", classification: "Paid", leaveType: "Planned", reason: "Vacation" },
];

const INITIAL_TICKETS: Ticket[] = [
    { id: "TKT001", raisedBy: "FAC001", employeeName: "Anil Kumar", targetCategory: "Technical", subject: "Laptop Screen Flickering", content: "My laptop screen has been flickering for the past 2 days. Unable to work properly.", status: "Open", createdAt: "2024-02-25T10:30:00", routeTo: "TL001", cc: ["OM001", "HOI003", "HR001"] },
    { id: "TKT002", raisedBy: "FAC003", employeeName: "Priya Singh", targetCategory: "HR Desk", subject: "Salary Slip Query", content: "My February salary slip shows incorrect deductions. Please review.", status: "In Progress", createdAt: "2024-02-24T14:00:00", routeTo: "HR001", cc: ["AD001"] },
];

const INITIAL_REIMBURSEMENTS: ReimbursementClaim[] = [
    { id: "RMB001", employeeId: "FAC001", employeeName: "Anil Kumar", email: "anil@gog.com", phone: "9876543219", type: "Travel", amount: 2500, monthYear: "2026-03", description: "Auto fare for client meeting at Vijay Nagar campus", status: "Pending", date: "2026-03-03" },
    { id: "RMB002", employeeId: "OM001", employeeName: "Arjun Sharma", email: "arjun@gog.com", phone: "9876543216", type: "Internet", amount: 1000, monthYear: "2026-03", description: "Monthly internet recharge for WFH days", status: "Approved - Pending Payment", hrRemarks: "Verified WFH records. Approved for this month.", date: "2026-03-01" },
    { id: "RMB003", employeeId: "HOI001", employeeName: "Ayush Chauhan", email: "ayush@gog.com", phone: "9876543213", type: "Food", amount: 800, monthYear: "2026-02", description: "Team lunch expense for project kickoff", status: "Approved - Payment Done", hrRemarks: "Payment processed via NEFT.", date: "2026-02-25" },
    { id: "RMB004", employeeId: "FAC002", employeeName: "Sneha Reddy", email: "sneha@gog.com", phone: "9876543220", type: "Medical", amount: 4500, monthYear: "2026-03", description: "OPD consultation and prescribed medicines", status: "Pending", date: "2026-03-04" },
    { id: "RMB005", employeeId: "OM002", employeeName: "Kavitha Nair", email: "kavitha@gog.com", phone: "9876543217", type: "Stationery", amount: 650, monthYear: "2026-02", description: "Notebooks, pens & whiteboard markers for training sessions", status: "Approved - Payment Done", hrRemarks: "Receipts verified. Paid.", date: "2026-02-18" },
    { id: "RMB006", employeeId: "FAC003", employeeName: "Priya Singh", email: "priya@gog.com", phone: "9876543221", type: "Books & Certification", amount: 3200, monthYear: "2026-03", description: "AWS Cloud Practitioner exam fee", status: "Pending", date: "2026-03-02" },
    { id: "RMB007", employeeId: "OM001", employeeName: "Arjun Sharma", email: "arjun@gog.com", phone: "9876543216", type: "Equipment", amount: 1800, monthYear: "2026-02", description: "Wireless mouse and keyboard for office use", status: "Rejected", rejectionReason: "Equipment should be requisitioned through IT department, not reimbursement.", date: "2026-02-10" },
    { id: "RMB008", employeeId: "FAC004", employeeName: "Meera Das", email: "meera@gog.com", phone: "9876543222", type: "Travel", amount: 1200, monthYear: "2026-03", description: "Cab fare for student placement drive at TCS office", status: "Pending", date: "2026-03-05" },
    { id: "RMB009", employeeId: "FAC001", employeeName: "Anil Kumar", email: "anil@gog.com", phone: "9876543219", type: "Phone & Data", amount: 500, monthYear: "2026-02", description: "Mobile recharge for official calls", status: "Approved - Pending Payment", hrRemarks: "Approved. Will process by month end.", date: "2026-02-20" },
    { id: "RMB010", employeeId: "HOI001", employeeName: "Ayush Chauhan", email: "ayush@gog.com", phone: "9876543213", type: "Fuel", amount: 3500, monthYear: "2026-03", description: "Petrol expense for campus visits during surprise audits", status: "Pending", date: "2026-03-04" },
];

const INITIAL_HOLIDAYS: Holiday[] = [
    { id: "hol1", name: "Republic Day", date: "2026-01-26", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
    { id: "hol2", name: "Holi", date: "2026-03-03", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true, customMessage: "Happy Holi! Office remains closed. Enjoy the festival of colors!" },
    { id: "hol3", name: "Holi (Dhuleti)", date: "2026-03-04", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
    { id: "hol4", name: "Ram Navami", date: "2026-04-02", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
    { id: "hol5", name: "Good Friday", date: "2026-04-03", status: "Proposed", proposedBy: "HOI001", proposedByName: "Ayush Chauhan", collegeId: "sage-bhopal" },
    { id: "hol6", name: "Independence Day", date: "2026-08-15", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
    { id: "hol7", name: "Gandhi Jayanti", date: "2026-10-02", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
    { id: "hol8", name: "Dussehra", date: "2026-10-02", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
    { id: "hol9", name: "Diwali", date: "2026-10-21", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true, customMessage: "Happy Diwali! May the festival of lights bring joy to all." },
    { id: "hol10", name: "Christmas", date: "2026-12-25", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
];

const INITIAL_PIP: PIPRecord[] = [
    { id: "pip1", employeeId: "FAC004", employeeName: "Rahul Das", reason: "Consistent low performance in assessments", startDate: "2024-02-15", status: "Active", warnings: 1, disclaimer: "You are currently under Performance Improvement Plan. Your conduct and output are being closely monitored." },
];

const INITIAL_STARS: PerformanceStar[] = [
    { employeeId: "FAC001", stars: 4, rating: 4.5, badges: ["On Time", "Good Dress Code", "0 Flags"] },
    { employeeId: "FAC002", stars: 3, rating: 3.5, badges: [] },
    { employeeId: "FAC003", stars: 3, rating: 4.2, badges: ["On Time", "Good Dress Code"] },
    { employeeId: "FAC004", stars: 2, rating: 2.8, badges: [] },
    { employeeId: "FAC005", stars: 4, rating: 4.3, badges: ["On Time", "0 Flags"] },
    { employeeId: "FAC006", stars: 3, rating: 3.8, badges: [] },
    { employeeId: "OM001", stars: 5, rating: 4.8, badges: ["On Time", "Good Dress Code", "0 Flags", "Additional Responsibilities"] },
    { employeeId: "OM002", stars: 3, rating: 3.9, badges: ["Good Dress Code"] },
    { employeeId: "OM003", stars: 4, rating: 4.1, badges: ["On Time"] },
    { employeeId: "HOI001", stars: 5, rating: 4.7, badges: ["On Time", "0 Flags", "Good Dress Code"] },
    { employeeId: "HOI002", stars: 4, rating: 4.1, badges: ["On Time"] },
    { employeeId: "HOI003", stars: 4, rating: 4.4, badges: ["On Time", "Good Dress Code"] },
];

const INITIAL_RATINGS: Rating[] = [
    { id: "r1", employeeId: "OM001", employeeName: "Arjun Sharma", ratedBy: "HOI003", ratedByName: "Sidhartha Paikaray", score: 4.5, period: "Feb 1-15", comment: "Excellent coordination", date: "2024-02-16" },
    { id: "r2", employeeId: "FAC001", employeeName: "Anil Kumar", ratedBy: "HOI003", ratedByName: "Sidhartha Paikaray", score: 4.2, period: "Feb 1-15", comment: "Good teaching quality", date: "2024-02-16" },
    { id: "r3", employeeId: "FAC002", employeeName: "Meera Das", ratedBy: "HOI003", ratedByName: "Sidhartha Paikaray", score: 3.5, period: "Feb 1-15", comment: "Needs improvement in punctuality", date: "2024-02-16" },
];

const INITIAL_MISBEHAVIOURS: MisbehaviourReport[] = [
    { id: "mb1", reportedBy: "HOI001", reportedByName: "Ayush Chauhan", employeeId: "FAC004", employeeName: "Rahul Das", type: "Performance", description: "Failed to submit assignment reports for 2 consecutive weeks.", date: "2024-02-10", ccList: ["AD001", "HR001"], meetingScheduled: true, meetingStep: 2 },
];

const INITIAL_SCHEDULES: WorkSchedule[] = [
    { employeeId: "FAC001", employeeName: "Anil Kumar", approvedByHR: true, assignedBy: "HOI001", assignedByName: "Ayush Chauhan", dayWise: { Mon: { location: "sage-bhopal", clockInTime: "09:00", clockOutTime: "18:00" }, Tue: { location: "sage-bhopal", clockInTime: "09:00", clockOutTime: "18:00" }, Wed: { location: "sage-bhopal", clockInTime: "09:00", clockOutTime: "18:00" }, Thu: { location: "sage-bhopal", clockInTime: "09:00", clockOutTime: "18:00" }, Fri: { location: "sage-bhopal", clockInTime: "09:00", clockOutTime: "18:00" }, Sat: { location: "sage-bhopal", clockInTime: "09:00", clockOutTime: "14:00" } } },
    { employeeId: "FAC002", employeeName: "Sneha Reddy", approvedByHR: true, assignedBy: "HOI001", assignedByName: "Ayush Chauhan", dayWise: { Mon: { location: "sage-indore", clockInTime: "09:00", clockOutTime: "18:00" }, Tue: { location: "sage-indore", clockInTime: "09:00", clockOutTime: "18:00" }, Wed: { location: "WFH", clockInTime: "09:00", clockOutTime: "18:00" }, Thu: { location: "sage-indore", clockInTime: "09:00", clockOutTime: "18:00" }, Fri: { location: "sage-indore", clockInTime: "09:00", clockOutTime: "18:00" }, Sat: { location: "sage-indore", clockInTime: "09:00", clockOutTime: "14:00" } } },
    { employeeId: "OM001", employeeName: "Arjun Sharma", approvedByHR: true, assignedBy: "HOI003", assignedByName: "Sidhartha Paikaray", dayWise: { Mon: { location: "centurion", clockInTime: "09:30", clockOutTime: "18:30" }, Tue: { location: "centurion", clockInTime: "09:30", clockOutTime: "18:30" }, Wed: { location: "centurion", clockInTime: "09:30", clockOutTime: "18:30" }, Thu: { location: "centurion", clockInTime: "09:30", clockOutTime: "18:30" }, Fri: { location: "centurion", clockInTime: "09:30", clockOutTime: "18:30" }, Sat: { location: "WFH", clockInTime: "10:00", clockOutTime: "14:00" } } },
    { employeeId: "FAC003", employeeName: "Priya Singh", approvedByHR: true, assignedBy: "HOI001", assignedByName: "Ayush Chauhan", dayWise: { Mon: { location: "barkatullah", clockInTime: "09:00", clockOutTime: "17:00" }, Tue: { location: "barkatullah", clockInTime: "09:00", clockOutTime: "17:00" }, Wed: { location: "barkatullah", clockInTime: "09:00", clockOutTime: "17:00" }, Thu: { location: "barkatullah", clockInTime: "09:00", clockOutTime: "17:00" }, Fri: { location: "WFH", clockInTime: "09:00", clockOutTime: "17:00" }, Sat: { location: "barkatullah", clockInTime: "09:00", clockOutTime: "14:00" } } },
    { employeeId: "OM002", employeeName: "Kavitha Nair", approvedByHR: true, assignedBy: "HOI001", assignedByName: "Ayush Chauhan", dayWise: { Mon: { location: "scope-global", clockInTime: "09:00", clockOutTime: "18:00" }, Tue: { location: "scope-global", clockInTime: "09:00", clockOutTime: "18:00" }, Wed: { location: "scope-global", clockInTime: "09:00", clockOutTime: "18:00" }, Thu: { location: "scope-global", clockInTime: "09:00", clockOutTime: "18:00" }, Fri: { location: "scope-global", clockInTime: "09:00", clockOutTime: "18:00" }, Sat: { location: "scope-global", clockInTime: "09:00", clockOutTime: "14:00" } } },
];

const FALLBACK_TIMINGS: Record<string, { in: string; out: string }> = {
    "BGI Kokta": { in: "09:30", out: "16:20" },
    "BGI Mandideep": { in: "10:00", out: "16:30" },
    "BGI Indore": { in: "09:30", out: "16:00" },
    "OUI": { in: "09:30", out: "16:00" },
    "SGSU": { in: "10:00", out: "16:00" },
    "SUB": { in: "10:10", out: "15:40" },
    "SUI": { in: "10:10", out: "15:40" },
    "CUTM": { in: "09:30", out: "16:00" },
    "BBSR": { in: "09:30", out: "16:00" },
    "PKD": { in: "09:30", out: "16:00" },
    "VZM": { in: "09:30", out: "16:00" },
    "BCE Mandideep": { in: "10:00", out: "16:00" },
};

const CUSTOM_SCHEDULE_RULES = [
    { nameRegex: /Ravi Ranjan/i, location: "BBSR", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Vipul Kumar/i, location: "BBSR", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Aman/i, location: "BBSR", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Verman/i, location: "BBSR", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Siddharda/i, location: "BBSR", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Mriganka/i, location: "PKD", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Sushant/i, location: "PKD", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Chandan/i, location: "PKD", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Jeet/i, location: "VZM", in: "09:30", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /K\. Revanth/i, location: "VZM", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Ankit Singh/i, location: "SUB", in: "08:30", out: "15:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], wfhDays: ["Sat"] },
    { nameRegex: /Ayush Sahu/i, location: "SUB", in: "10:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], wfhDays: ["Sat"] },
    { nameRegex: /Ravi Bhushan Pratap/i, location: "SGSU", in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], wfhDays: ["Sat"] },
    { nameRegex: /Suman Rajak/i, location: "SGSU", in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], wfhDays: ["Sat"] },
    { nameRegex: /Sahil Burde/i, location: "BGI Kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Pranjul Sahu/i, location: "BGI Kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Mukesh Kumar/i, location: "BGI Kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Amit Singh Patel/i, location: "BGI Kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Mayank Choudhary/i, location: "BGI Kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Priyanka Kumawat/i, location: "BGI Kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Sujal Verma/i, location: "BCE Mandideep", in: "10:00", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    { nameRegex: /Prerna Saluja/i, location: "BGI Kokta", in: "09:35", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], thirdSatWFH: true },
    {
        nameRegex: /Abhishek Tiwari/i,
        multiLocation: [
            { location: "SUB", in: "10:15", out: "16:30", days: ["Tue", "Thu", "Fri"] },
            { location: "SGSU", in: "10:15", out: "16:00", days: ["Mon", "Wed"] },
        ],
        wfhDays: ["Sat"]
    },
    { nameRegex: /Nitesh/i, location: "sage-bhopal", in: "09:30", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] }
];

const INITIAL_RESPONSIBILITIES: AdditionalResponsibility[] = [
    { id: "ar1", employeeId: "OM001", employeeName: "Arjun Sharma", addedBy: "HOI003", description: "Coordinating inter-department tech workshops", date: "2024-02-20", status: "Approved", points: 15 },
];

const INITIAL_NOTICES: Notice[] = [
    {
        id: "n1",
        title: "SOP Update: Dress Code (3.1)",
        content: "Reminder: White formal shirt, black pants, and black blazer are mandatory. 3rd violation results in a 10% daily salary fine. Please adhere to professional standards.",
        category: "Update",
        createdBy: "HR001",
        createdAt: "2026-03-01T09:00:00Z"
    },
    {
        id: "n2",
        title: "Birthday Celebration!",
        content: "Happy Birthday to all team members born in March! Join us for a cake cutting ceremony in the main hall at 4:00 PM today.",
        category: "Birthday",
        createdBy: "HR001",
        createdAt: "2026-03-05T10:30:00Z"
    },
    {
        id: "n3",
        title: "Attendance Timing Reminder",
        content: "Ref SOP 3.2: A 2-minute grace period is allowed for geotagging. 4th late instance leads to a half-day pay cut. Please ensure clock-in is done within premises.",
        category: "Urgent",
        createdBy: "HR001",
        createdAt: "2026-03-02T08:45:00Z"
    },
    {
        id: "n4",
        title: "Holi Celebration & Holiday",
        content: "The office will remain closed on 14th March for Holi. We will have a small pre-Holi celebration on the 13th afternoon.",
        category: "Event",
        createdBy: "FND001",
        createdAt: "2026-03-04T11:00:00Z"
    },
    {
        id: "n5",
        title: "Bi-Weekly Performance Scores",
        content: "Performance scores for the period Feb 15 - Feb 28 are now live. Please check your dashboard to view your stars and feedback.",
        category: "General",
        createdBy: "AD001",
        createdAt: "2026-03-01T15:00:00Z"
    },
    {
        id: "n6",
        title: "Leave Policy Reminder (3.7)",
        content: "Faculty members must obtain HOI permission 18 hours in advance for casual leaves. Only one professor per college is permitted on leave per day.",
        category: "Policy",
        createdBy: "HR001",
        createdAt: "2026-03-03T12:00:00Z"
    },
    {
        id: "n7",
        title: "Mandatory Safety Training",
        content: "All employees must complete the fire safety and first-aid training module by the end of this week. Check the Training tab for details.",
        category: "Training",
        createdBy: "OM001",
        createdAt: "2026-03-06T09:30:00Z"
    },
    {
        id: "n8",
        title: "Welcome New Joiners!",
        content: "We are excited to welcome 5 new faculty members to our SAGE Bhopal and Indore campuses this week. Let's make them feel at home!",
        category: "Welcome",
        createdBy: "FND001",
        createdAt: "2026-03-08T10:00:00Z"
    },
    {
        id: "n9",
        title: "System Maintenance Notice",
        content: "The HRMS portal will be under scheduled maintenance on 10th March from 11:00 PM to 1:00 AM. Access will be temporarily unavailable.",
        category: "Update",
        createdBy: "AD001",
        createdAt: "2026-03-07T18:00:00Z"
    },
    {
        id: "n10",
        title: "Tobacco-Free Campus Policy",
        content: "Strict Reminder (SOP 3.11): Smoking and chewing tobacco are strictly prohibited within office premises. Violations will result in immediate suspension.",
        category: "Policy",
        createdBy: "HR001",
        createdAt: "2026-03-04T09:15:00Z"
    }

];
const INITIAL_NOTIFICATIONS: PortalNotification[] = [];

// Helper for 3rd Saturday logic
const isThirdSaturday = (date: Date) => {
    const day = date.getDay();
    if (day !== 6) return false;
    const dateNum = date.getDate();
    return dateNum > 14 && dateNum <= 21;
};

// ─── CONTEXT TYPE ───
interface AuthContextType {
    user: User | null; employees: Employee[]; leaves: LeaveRequest[]; meetings: MeetingRequest[];
    notices: Notice[]; payrollRecords: PayrollRecord[]; sops: SOP[];
    attendanceRecords: AttendanceRecord[]; tickets: Ticket[]; holidays: Holiday[];
    pipRecords: PIPRecord[]; workSchedules: WorkSchedule[]; performanceStars: PerformanceStar[];
    moms: MOM[]; reimbursements: ReimbursementClaim[]; orgHierarchy: OrgNode[];
    ratings: Rating[]; misbehaviourReports: MisbehaviourReport[];
    additionalResponsibilities: AdditionalResponsibility[];
    notifications: PortalNotification[];
    markAsPresentRequests: MarkAsPresentRequest[];
    colleges: College[];
    // Legacy arrays
    jobPostings: JobPosting[]; certificates: AchievementCertificate[]; resignationRequests: ResignationRequest[]; assets: Asset[]; assetRequests: AssetRequest[];
    login: (email: string, password?: string, role?: string) => { success: boolean, msg?: string }; logout: () => void;
    addNotice: (notice: Omit<Notice, "id" | "createdBy" | "createdAt">) => void;
    addAnnouncement: (notice: Omit<Notice, "id" | "createdBy" | "createdAt">) => void;
    editNotice: (id: string, data: { title?: string; content?: string; category?: Notice["category"] }) => void;
    markAnnouncementRead: (noticeId: string) => void;
    updateProfile: (data: Partial<Employee>) => void; // Added updateProfile
    clockIn: (location: string, time: string, dressCodeImageUrl?: string) => void;
    clockOut: (time: string) => void;
    raiseTicket: (targetCategory: string, subject: string, content: string, routeTo?: string, cc?: string[], proofUrls?: string[], targetEmployeeId?: string, targetDate?: string) => void;
    resolveTicket: (id: string, notes: string) => void;
    addLeaveRequest: (req: Omit<LeaveRequest, "id" | "status" | "employeeId" | "employeeName">) => void;
    approveLeave: (id: string, reason?: string) => void;
    rejectLeave: (id: string, applyLOP?: boolean, reason?: string) => void;
    addReimbursement: (claim: Omit<ReimbursementClaim, "id" | "status" | "date" | "employeeId" | "employeeName">) => void;
    updateReimbursementStatus: (id: string, status: ReimbursementClaim["status"], reason?: string, remarks?: string) => void;
    proposeHoliday: (h: Omit<Holiday, "id" | "proposedBy" | "status" | "proposedByName">) => void;
    approveHoliday: (id: string, customMessage?: string) => void;
    updateSOP: (sop: Omit<SOP, "id" | "lastUpdated">) => void;
    deleteSOP: (id: string) => void;
    sopNotifications: SOPNotification[];
    masterSopContent: string;
    updateMasterSop: (content: string, changelog?: string) => void;
    markSOPNotificationRead: (sopNotifId: string) => void;
    markAllSOPNotificationsRead: () => void;
    addToPIP: (employeeId: string, reason: string) => void;
    removeFromPIP: (pipId: string, reason: string, proofs?: string[]) => void;
    deductChance: (employeeId: string, reason: string) => void;
    resetChances: (employeeId: string) => void;
    markAttendanceOverride: (employeeId: string, date: string, reason: string) => void;
    giveCredit: (employeeId: string, reason: string) => void;
    reportMisbehaviour: (employeeId: string, type: MisbehaviourReport["type"], description: string, ccList: string[], propagationChain: any[]) => void;
    addRating: (employeeId: string, ratedBy: string, score: number, period: string, comment?: string) => void;
    assignWorkSchedule: (schedule: WorkSchedule) => void;
    approveWorkSchedule: (employeeId: string) => void;
    addCollege: (college: Omit<College, "id">) => void;
    updateCollege: (id: string, updates: Partial<College>) => void;
    deleteCollege: (id: string) => void;
    addAdditionalResponsibility: (employeeId: string, description: string, points: number) => void;
    approveAdditionalResponsibility: (id: string, status: "Approved" | "Rejected") => void;
    addMarkAsPresentRequest: (req: Omit<MarkAsPresentRequest, "id" | "status" | "appliedAt" | "employeeName">) => void;
    resolveMarkAsPresentRequest: (id: string, status: "Approved" | "Rejected") => void;
    resolveDressCodeCheck: (recordId: string, status: "Approved" | "Rejected") => void;
    addBiWeeklyRating: (employeeId: string, score: number, period: string, points: number) => void;
    addMeetingRequest: (req: Omit<MeetingRequest, "id" | "status" | "employeeId" | "employeeName" | "createdAt">) => void;
    updateMeetingStatus: (id: string, status: MeetingRequest["status"], MOMData?: { screenshotUrls: string[], attendees: MeetingRequest["attendees"] }) => void;
    getReportees: (managerId: string) => Employee[];
    getManagerChain: (employeeId: string) => Employee[];
    generatePayroll: (month: string, year: string) => void;
    addEmployee: (emp: Omit<Employee, "id" | "isOnboarded">) => void;
    updateOnboarding: (userId: string, data: any) => void;
    // Legacy methods
    addJobPosting: (job: Omit<JobPosting, "id" | "postedBy" | "postedAt" | "status">) => void;
    closeJobPosting: (id: string) => void;
    generateCertificate: (employeeId: string, type: string, description: string) => void;
    submitResignation: (reason: string, lastWorkingDate: string) => void;
    approveResignation: (id: string) => void;
    requestAsset: (assetType: string, reason: string) => void;
    assignAsset: (assetId: string, employeeId: string) => void;
    updateAssetRequestStatus: (id: string, status: AssetRequest["status"]) => void;
    addNotification: (to: string, toName: string, message: string, type: PortalNotification["type"]) => void;
    markNotificationRead: (id: string) => void;
    getMyNotifications: () => PortalNotification[];
    activityLogs: PortalNotification[];
    getExpectedTiming: (employeeId: string, date?: string | Date) => { in: string; out: string; location: string };
    authLoading: boolean;
    restoreAttendanceCredits: (employeeId: string) => void;
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; msg: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── PROVIDER ───
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
    const [leaves, setLeaves] = useState<LeaveRequest[]>(INITIAL_LEAVES);
    const [meetings, setMeetings] = useState<MeetingRequest[]>(INITIAL_MEETINGS);
    const [notices, setNotices] = useState<Notice[]>(INITIAL_NOTICES);
    const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
    const [sops, setSops] = useState<SOP[]>(INITIAL_SOPS);
    const [sopNotifications, setSopNotifications] = useState<SOPNotification[]>(INITIAL_SOP_NOTIFICATIONS);
    const [masterSopContent, setMasterSopContent] = useState<string>(MASTER_SOP_CONTENT);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
    const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
    const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
    const [pipRecords, setPipRecords] = useState<PIPRecord[]>(INITIAL_PIP);
    const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>(INITIAL_SCHEDULES);
    const [colleges, setColleges] = useState<College[]>(INITIAL_COLLEGES);
    const [performanceStars, setPerformanceStars] = useState<PerformanceStar[]>(INITIAL_STARS);
    const [moms, setMoms] = useState<MOM[]>([]);
    const [reimbursements, setReimbursements] = useState<ReimbursementClaim[]>(INITIAL_REIMBURSEMENTS);
    const orgHierarchy = useMemo<OrgNode[]>(() => {
        return employees.map(emp => {
            let level: OrgNode["level"] = "Faculty"; // Default
            if (emp.role === "FOUNDER") level = "C-Suite";
            else if (emp.role === "AD" || emp.role === "HR" || emp.role === "TL") level = "Management";
            else if (emp.role === "HOI") level = "Leadership";
            else if (emp.role === "OM") level = "OM";
            else if (emp.role === "FACULTY" || emp.role === "PROFESSOR") level = "Faculty";

            return {
                id: emp.id,
                name: emp.name,
                designation: emp.designation || emp.role,
                level,
                parentId: Array.isArray(emp.reportsTo) ? emp.reportsTo[0] : emp.reportsTo,
                photoInitial: emp.name?.[0]?.toUpperCase() || "U",
                dept: emp.dept || "Unassigned"
            };
        });
    }, [employees]);
    const [ratings, setRatings] = useState<Rating[]>(INITIAL_RATINGS);
    const [misbehaviourReports, setMisbehaviourReports] = useState<MisbehaviourReport[]>(INITIAL_MISBEHAVIOURS);
    const [additionalResponsibilities, setAdditionalResponsibilities] = useState<AdditionalResponsibility[]>(INITIAL_RESPONSIBILITIES);
    const [notifications, setNotifications] = useState<PortalNotification[]>(INITIAL_NOTIFICATIONS);
    const [markAsPresentRequests, setMarkAsPresentRequests] = useState<MarkAsPresentRequest[]>([]);
    // Legacy state
    const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
    const [certificates, setCertificates] = useState<AchievementCertificate[]>([]);
    const [resignationRequests, setResignationRequests] = useState<ResignationRequest[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [assetRequests, setAssetRequests] = useState<AssetRequest[]>([]);
    const router = useRouter();

    // ─── PERSISTENCE ───
    const DATA_VERSION = "v3_holidays";
    useEffect(() => {
        const s = (k: string) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
        // Check data version — if old data exists, clear it to load new RBAC employee IDs
        const storedVersion = localStorage.getItem("gog_data_version");
        if (storedVersion !== DATA_VERSION) {
            // Clear all old data keys to force fresh load
            const keysToRemove = ["gog_user", "gog_employees", "gog_leaves", "gog_meetings", "gog_notices", "gog_payroll", "gog_sops", "gog_attendance", "gog_tickets", "gog_holidays", "gog_pip", "gog_schedules", "gog_stars", "gog_moms", "gog_reimbursements", "gog_ratings", "gog_misbehaviours", "gog_responsibilities", "gog_notifications", "gog_mark_present", "gog_hierarchy"];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            localStorage.setItem("gog_data_version", DATA_VERSION);
        }
        const su = s("gog_user"); 
        if (su) {
            // Persistence: 60 Day Expiry (60 * 24 * 60 * 60 * 1000)
            const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const lastActive = su.lastActive || 0;
            
            if (now - lastActive > SIXTY_DAYS) {
                localStorage.removeItem("gog_user");
                setUser(null);
            } else {
                // Update lastActive to implement sliding window
                const updatedUser = { ...su, lastActive: now };
                setUser(updatedUser);
                localStorage.setItem("gog_user", JSON.stringify(updatedUser));
            }
        }
        setAuthLoading(false);
        const se = s("gog_employees"); if (se) setEmployees(se);
        const sl = s("gog_leaves"); if (sl) setLeaves(sl);
        const sm = s("gog_meetings"); if (sm) setMeetings(sm);
        const sn = s("gog_notices"); if (sn) setNotices(sn);
        const sp = s("gog_payroll"); if (sp) setPayrollRecords(sp);
        const ss = s("gog_sops"); if (ss) setSops(ss);
        const sa = s("gog_attendance"); if (sa) setAttendanceRecords(sa);
        const st = s("gog_tickets"); if (st) setTickets(st);
        const sh = s("gog_holidays"); if (sh) setHolidays(sh);
        const spi = s("gog_pip"); if (spi) setPipRecords(spi);
        const sw = s("gog_schedules"); if (sw) setWorkSchedules(sw);
        const sst = s("gog_stars"); if (sst) setPerformanceStars(sst);
        const smo = s("gog_moms"); if (smo) setMoms(smo);
        const sr = s("gog_reimbursements"); if (sr) setReimbursements(sr);
        const srt = s("gog_ratings"); if (srt) setRatings(srt);
        const smb = s("gog_misbehaviours"); if (smb) setMisbehaviourReports(smb);
        const sar = s("gog_responsibilities"); if (sar) setAdditionalResponsibilities(sar);
        const sno = s("gog_notifications"); if (sno) setNotifications(sno);
        const smpr = s("gog_mark_present"); if (smpr) setMarkAsPresentRequests(smpr);
    }, []);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await fetch("/api/employees");
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Merge DB employees over initial employees, prioritizing DB.
                    const dbEmployees = data.map((dbEmp: any) => ({
                        ...dbEmp,
                        id: dbEmp.employeeId || dbEmp.id
                    }));
                    
                    setEmployees(prev => {
                        const merged = [...prev];
                        dbEmployees.forEach(dbE => {
                            const index = merged.findIndex(e => e.id === dbE.id || (e.email && dbE.email && e.email === dbE.email));
                            if (index !== -1) {
                                merged[index] = { ...merged[index], ...dbE };
                            } else {
                                merged.push(dbE);
                            }
                        });
                        // Save merged employees (with DB passwords) to localStorage
                        // so they are available immediately on next page load
                        try { localStorage.setItem("gog_employees", JSON.stringify(merged)); } catch {}
                        return merged;
                    });
                }
            } catch (err) {
                console.error("Failed to fetch employees from database:", err);
            }
        };
        const fetchLocations = async () => {
            try {
                const res = await fetch("/api/locations");
                const data = await res.json();
                if (Array.isArray(data)) {
                    setColleges(data);
                }
            } catch (err) {
                console.error("Failed to fetch locations:", err);
            }
        };
        const fetchAttendance = async () => {
            if (!user) return;
            try {
                const res = await fetch(`/api/attendance?userId=${user.id}&role=${user.role}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    // For Nitesh (EMP127), ensure hardcoded March 7-10 logs are preserved
                    if (user.id === "EMP127") {
                        const hardcodedDates = ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"];
                        const hLogs = INITIAL_ATTENDANCE.filter(r => r.employeeId === "EMP127" && hardcodedDates.includes(r.date));
                        const apiDates = new Set(data.map(r => r.date));
                        const missingInApi = hLogs.filter(h => !apiDates.has(h.date));
                        setAttendanceRecords([...missingInApi, ...data]);
                    } else {
                        setAttendanceRecords(data);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch attendance:", err);
            }
        };

        fetchEmployees();
        fetchLocations();
        if (user) fetchAttendance();
    }, [user]);

    useEffect(() => {
        if (user) localStorage.setItem("gog_user", JSON.stringify(user)); else localStorage.removeItem("gog_user");
        localStorage.setItem("gog_employees", JSON.stringify(employees));
        localStorage.setItem("gog_leaves", JSON.stringify(leaves));
        localStorage.setItem("gog_meetings", JSON.stringify(meetings));
        localStorage.setItem("gog_notices", JSON.stringify(notices));
        localStorage.setItem("gog_payroll", JSON.stringify(payrollRecords));
        localStorage.setItem("gog_sops", JSON.stringify(sops));
        localStorage.setItem("gog_attendance", JSON.stringify(attendanceRecords));
        localStorage.setItem("gog_tickets", JSON.stringify(tickets));
        localStorage.setItem("gog_holidays", JSON.stringify(holidays));
        localStorage.setItem("gog_pip", JSON.stringify(pipRecords));
        localStorage.setItem("gog_schedules", JSON.stringify(workSchedules));
        localStorage.setItem("gog_stars", JSON.stringify(performanceStars));
        localStorage.setItem("gog_moms", JSON.stringify(moms));
        localStorage.setItem("gog_reimbursements", JSON.stringify(reimbursements));
        localStorage.setItem("gog_ratings", JSON.stringify(ratings));
        localStorage.setItem("gog_misbehaviours", JSON.stringify(misbehaviourReports));
        localStorage.setItem("gog_responsibilities", JSON.stringify(additionalResponsibilities));
        localStorage.setItem("gog_notifications", JSON.stringify(notifications));
        localStorage.setItem("gog_mark_present", JSON.stringify(markAsPresentRequests));
    }, [user, employees, leaves, meetings, notices, payrollRecords, sops, attendanceRecords, tickets, holidays, pipRecords, workSchedules, performanceStars, moms, reimbursements, ratings, misbehaviourReports, additionalResponsibilities, notifications, markAsPresentRequests]);

    // Sync performanceStars for all OMs and Professors
    useEffect(() => {
        const eligible = employees.filter(e => ["OM", "PROFESSOR", "FACULTY"].includes(e.role));
        setPerformanceStars(prev => {
            const next = [...prev];
            let changed = false;
            eligible.forEach(emp => {
                if (!next.find(s => s.employeeId === emp.id)) {
                    next.push({ employeeId: emp.id, stars: 3, rating: 0, badges: [] });
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [employees]);

    // ─── HELPERS ───
    const getExpectedTiming = useCallback((employeeId: string, date: string | Date = new Date()) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = d.toISOString().split('T')[0];

        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return { in: "09:30", out: "18:00", location: "Office" };

        // 1. Check Custom Rules (regex-based as requested)
        for (const rule of CUSTOM_SCHEDULE_RULES) {
            if (rule.nameRegex.test(emp.name)) {
                // Multi-location Logic
                if ((rule as any).multiLocation) {
                    const locRule = (rule as any).multiLocation.find((l: any) => l.days.includes(weekday));
                    if (locRule) return { in: locRule.in, out: locRule.out, location: locRule.location };
                }

                // WFH Logic (including 3rd Saturday)
                if ((rule as any).wfhDays?.includes(weekday)) return { in: "09:30", out: "18:00", location: "WFH" };
                if ((rule as any).thirdSatWFH && weekday === "Sat" && isThirdSaturday(d)) {
                    return { in: (rule as any).in || "09:30", out: (rule as any).out || "18:00", location: "WFH" };
                }

                // Standard Custom Days
                if ((rule as any).days?.includes(weekday)) {
                    return { in: (rule as any).in as string, out: (rule as any).out as string, location: (rule as any).location as string };
                }
            }
        }

        // 2. User-assigned Schedules (via Manager Interface)
        const userSchedule = workSchedules.find(s => s.employeeId === employeeId);
        if (userSchedule?.dayWise) {
            if (userSchedule.dayWise[dateStr]) {
                const s = userSchedule.dayWise[dateStr];
                return { in: s.clockInTime, out: s.clockOutTime, location: s.location };
            }
            if (userSchedule.dayWise[weekday]) {
                const s = userSchedule.dayWise[weekday];
                return { in: s.clockInTime, out: s.clockOutTime, location: s.location };
            }
        }

        // 3. Fallback by College Location/Shortname
        const collegeShortName = emp.location || emp.collegeName;
        if (collegeShortName) {
            // Priority 1: Match from FALLBACK_TIMINGS dictionary
            const fb = FALLBACK_TIMINGS[collegeShortName as keyof typeof FALLBACK_TIMINGS];
            if (fb) return { in: fb.in, out: fb.out, location: collegeShortName };

            // Priority 2: Try resolving through formal COLLEGES list
            const resolved = INITIAL_COLLEGES.find(c =>
                c.shortName.toLowerCase() === collegeShortName.toLowerCase() ||
                c.name.toLowerCase().includes(collegeShortName.toLowerCase())
            );
            if (resolved && FALLBACK_TIMINGS[resolved.shortName as keyof typeof FALLBACK_TIMINGS]) {
                const fb2 = FALLBACK_TIMINGS[resolved.shortName as keyof typeof FALLBACK_TIMINGS];
                return { in: fb2.in, out: fb2.out, location: resolved.shortName };
            }
        }

        // Default Last Resort
        return { in: "09:30", out: "18:00", location: emp.location || "Office" };
    }, [employees, workSchedules]);

    const uid = () => Math.random().toString(36).substr(2, 8).toUpperCase();
    const getReportees = (managerId: string) => {
        const manager = employees.find(e => e.id === managerId);
        if (!manager) return [];

        if (manager.role === "FOUNDER") {
            return employees.filter(e => e.role !== "FOUNDER");
        }
        if (manager.role === "HR") {
            return employees.filter(e => ["AD", "TL", "HOI", "OM", "FACULTY", "PROFESSOR"].includes(e.role));
        }
        if (manager.role === "AD") {
            return employees.filter(e => ["HOI", "OM", "FACULTY", "PROFESSOR"].includes(e.role));
        }
        if (manager.role === "HOI") {
            // HOI can manage ALL OMs and Faculties/Professors as requested (30+ employees)
            return employees.filter(e => ["OM", "FACULTY", "PROFESSOR"].includes(e.role));
        }

        // Default reportsTo logic for others
        return employees.filter(e => e.reportsTo && (Array.isArray(e.reportsTo) ? e.reportsTo.includes(managerId) : e.reportsTo === managerId));
    };
    const getManagerChain = (employeeId: string): Employee[] => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp || !emp.reportsTo) return [];

        const managerIds = Array.isArray(emp.reportsTo) ? emp.reportsTo : [emp.reportsTo];
        const managers = employees.filter(e => managerIds.includes(e.id));

        let chain: Employee[] = [...managers];
        managers.forEach(mgr => {
            chain = [...chain, ...getManagerChain(mgr.id)];
        });

        // Return unique managers by ID
        return Array.from(new Map(chain.map(m => [m.id, m])).values());
    };

    // ─── AUTH ───
    const login = (email: string, password?: string, role?: string) => {
        const emp = employees.find(e => e.email && e.email.toLowerCase().trim() === email.toLowerCase().trim());
        if (!emp) return { success: false, msg: "Institutional account not found." };
        const expectedPw = emp.password || "26082001";
        if (password && password !== expectedPw) return { success: false, msg: "Incorrect passkey." };
        if (role && emp.role !== role) return { success: false, msg: "Institutional role mismatch." };

        const userWithExpiry = { ...emp, lastActive: Date.now() };
        setUser(userWithExpiry);
        localStorage.setItem("gog_user", JSON.stringify(userWithExpiry));
        router.push("/");
        return { success: true };
    };
    const logout = () => { setUser(null); localStorage.removeItem("gog_user"); router.push("/login"); };
    const updateOnboarding = (userId: string, data: any) => {
        setEmployees(prev => prev.map(e => e.id === userId ? { ...e, ...data, isOnboarded: true } : e));
        if (user?.id === userId) {
            const updatedUser = { ...user, ...data, isOnboarded: true } as Employee;
            setUser(updatedUser);
            localStorage.setItem("gog_user", JSON.stringify(updatedUser));
        }
    };

    const changePassword = async (currentPassword: string, newPassword: string) => {
        if (!user) return { success: false, msg: "Not authenticated" };
        try {
            const res = await fetch('/api/employees/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send both id and email so the API can find the employee reliably
                body: JSON.stringify({ employeeId: user.id, employeeEmail: user.email, currentPassword, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                const updatedUser = { ...user, password: newPassword } as Employee;
                setUser(updatedUser);
                setEmployees(prev => {
                    const updated = prev.map(e => (e.id === user.id || e.email === user.email) ? { ...e, password: newPassword } : e);
                    localStorage.setItem("gog_employees", JSON.stringify(updated));
                    return updated;
                });
                localStorage.setItem("gog_user", JSON.stringify(updatedUser));
                return { success: true, msg: "Password changed successfully! Login with your new password next time." };
            } else {
                return { success: false, msg: data.error || "Failed to update password" };
            }
        } catch (error: any) {
            return { success: false, msg: "Network error. Please try again." };
        }
    };

    const addEmployee = (emp: Omit<Employee, "id" | "isOnboarded">) => {
        setEmployees(prev => [...prev, { ...emp, id: `EMP${uid()} `, isOnboarded: false }]);
    };

    // ─── NOTICES ───
    const addNotice = (notice: Omit<Notice, "id" | "createdBy" | "createdAt">) => {
        if (!user) return;
        const newNotice: Notice = { ...notice, id: `N${uid()} `, createdBy: user.name, createdAt: new Date().toISOString().split("T")[0], readBy: [] };
        setNotices(prev => [newNotice, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const allEmails = employees.filter(e => e.email && e.status === "Active").map(e => e.email);
        const { subject: mailSub, html: mailHtml } = getAnnouncementTemplate(newNotice);
        sendMail({ to: allEmails, subject: mailSub, html: mailHtml });

        try { localStorage.setItem("announcement_update", JSON.stringify({ id: newNotice.id, ts: Date.now() })); } catch { }
    };
    const addAnnouncement = addNotice;

    const editNotice = (id: string, data: { title?: string; content?: string; category?: Notice["category"] }) => {
        if (!user) return;
        setNotices(prev => prev.map(n => n.id === id ? { ...n, ...data, isEdited: true, editedAt: new Date().toISOString().split("T")[0] } : n));
        try { localStorage.setItem("announcement_update", JSON.stringify({ id, action: "edit", ts: Date.now() })); } catch { }
    };

    const markAnnouncementRead = (noticeId: string) => {
        if (!user) return;
        setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, readBy: [...(n.readBy || []), user.id] } : n));
    };

    // ─── ATTENDANCE ───
    // ─── ATTENDANCE ───
    const clockIn = async (location: string, time: string, dressCodeImageUrl?: string) => {
        if (!user) return;

        // Founders skip all restrictions
        if (user.role === "FOUNDER") {
            try {
                const res = await fetch("/api/attendance/clock-in", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employeeId: user.id, location, time, dressCodeImageUrl, role: user.role, skipChecks: true })
                });
                const data = await res.json();
                if (data.record) setAttendanceRecords(prev => [...prev, data.record]);
                return;
            } catch (err) { console.error(err); return; }
        }

        // Enforce Shift Timing Block
        const expected = getExpectedTiming(user.id);
        const startTime = expected.in;

        if (time > startTime) {
            alert(`Clock-in Disabled: You are late (Start: ${startTime}). You are now marked as 'On Leave' for today. Please use 'Mark as Present' credits to appeal.`);
            return;
        }

        // Image Requirement
        if (!dressCodeImageUrl) {
            alert("Selfie/Dress-code image is mandatory for clock-in.");
            return;
        }

        try {
            const res = await fetch("/api/attendance/clock-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: user.id, location, time, dressCodeImageUrl, role: user.role })
            });
            const data = await res.json();
            if (data.record) {
                setAttendanceRecords(prev => [...prev, data.record]);
            } else {
                alert(data.error || "Clock-in failed");
            }
        } catch (err) {
            console.error("Clock-in error:", err);
        }
    };

    const clockOut = async (time: string) => {
        if (!user) return;
        try {
            await fetch("/api/attendance/clock-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: user.id, time })
            });
            const today = new Date().toISOString().split("T")[0];
            setAttendanceRecords(prev => prev.map(r =>
                r.employeeId === user.id && r.date === today ? { ...r, clockOut: time } : r
            ));
        } catch (err) { console.error(err); }
    };

    const markAttendanceOverride = (employeeId: string, date: string, reason: string) => {
        setAttendanceRecords(prev => {
            const existing = prev.find(r => r.employeeId === employeeId && r.date === date);
            if (existing) return prev.map(r => r.id === existing.id ? { ...r, status: "Present", isApprovedByHR: true } : r);
            return [...prev, { id: `ATT${uid()}`, employeeId, date, clockIn: "09:00", location: "Override", status: "Present" as any, flags: {}, isApprovedByHR: true }];
        });
    };

    const addMarkAsPresentRequest = async (req: Omit<MarkAsPresentRequest, "id" | "status" | "appliedAt" | "employeeName">) => {
        if (!user) return;

        const emp = employees.find(e => e.id === user.id);
        if (emp && (emp.chancesRemaining || 0) <= 0) {
            alert("Insufficient Credits: You have used all 3 chances.");
            return;
        }

        if (!req.proofUrls || req.proofUrls.length === 0) {
            alert("Mandatory: Please upload proofs.");
            return;
        }

        try {
            const res = await fetch("/api/attendance/requests/map", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...req, employeeId: user.id })
            });
            const data = await res.json();
            if (data.request) {
                setMarkAsPresentRequests(prev => [data.request, ...prev]);
                setEmployees(prev => prev.map(e => e.id === user.id ? { ...e, chancesRemaining: (e.chancesRemaining || 1) - 1 } : e));
                setUser(prev => prev ? { ...prev, chancesRemaining: ((prev as any).chancesRemaining || 1) - 1 } : null);

                const chain = getManagerChain(user.id);
                const authorities = getAuthorityEmails(emp, employees);
                chain.forEach(mgr => addNotification(mgr.id, mgr.name, `MAP Request from ${user.name}`, "attendance"));
                const { subject, html } = getMarkAsPresentTemplate(data.request, "Pending");
                sendMail({ to: authorities, subject, html });
            }
        } catch (err) { console.error(err); }
    };

    const resolveMarkAsPresentRequest = (id: string, status: "Approved" | "Rejected") => {
        setMarkAsPresentRequests(prev => {
            const req = prev.find(r => r.id === id);
            if (req) {
                if (status === "Approved") {
                    markAttendanceOverride(req.employeeId, req.date, req.reason);
                    const emp = employees.find(e => e.id === req.employeeId);
                    const newUsed = (emp?.markPresentUsed || 0) + 1;
                    setEmployees(prev => prev.map(e => {
                        if (e.id === req.employeeId) {
                            let fines = e.fines || { total: 0, records: [] };
                            if (newUsed > 3) {
                                fines = {
                                    total: fines.total + 500,
                                    records: [...fines.records, { amount: 500, reason: `Excessive MAP (Attempt ${newUsed})`, date: new Date().toISOString().split('T')[0] }]
                                };
                            }
                            return { ...e, markPresentUsed: newUsed, fines };
                        }
                        return e;
                    }));
                }
                const emp = employees.find(e => e.id === req.employeeId);
                const { subject, html } = getMarkAsPresentTemplate(req, status);
                if (emp?.email) sendMail({ to: emp.email, cc: getAuthorityEmails(emp, employees), subject, html });
            }
            return prev.map(r => r.id === id ? { ...r, status } : r);
        });
    };

    const resolveDressCodeCheck = (recordId: string, status: "Approved" | "Rejected") => {
        setAttendanceRecords(prev => {
            const record = prev.find(r => r.id === recordId);
            if (record && status === "Rejected") {
                setEmployees(emps => emps.map(e => {
                    if (e.id === record.employeeId) {
                        const newDefaults = (e.dressCodeDefaults || 0) + 1;
                        const { subject, html } = getDressCodeWarningTemplate(e, newDefaults);
                        sendMail({ to: e.email, cc: getAuthorityEmails(e, employees), subject, html });
                        return { ...e, dressCodeDefaults: newDefaults };
                    }
                    return e;
                }));
            }
            return prev.map(r => r.id === recordId ? { ...r, dressCodeStatus: status, flags: { ...r.flags, dressCode: status === "Rejected" } } : r);
        });
    };

    // ─── BIRTHDAY AUTOMATION ───
    useEffect(() => {
        if (!employees.length) return;
        const now = new Date();
        const todayDDMM = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        employees.forEach(emp => {
            if (emp.dateOfBirth && emp.dateOfBirth.startsWith(todayDDMM)) {
                const key = `bday_sent_${emp.id}_${now.getFullYear()}`;
                if (typeof window !== "undefined" && !localStorage.getItem(key)) {
                    const template = getBirthdayTemplate(emp);
                    sendMail({ to: emp.email, cc: getAuthorityEmails(emp, employees), subject: template.subject, html: template.html });
                    localStorage.setItem(key, "true");
                }
            }
        });
    }, [employees]);

    const addBiWeeklyRating = (employeeId: string, score: number, period: string, points: number) => {
        const clampedPoints = Math.min(50, Math.max(-80, points));
        setEmployees(prev => prev.map(e => {
            if (e.id === employeeId) {
                const newScore = { score, period, date: new Date().toISOString().split('T')[0], points: clampedPoints };
                const scores = [...(e.biWeeklyScores || []), newScore];
                const emp = employees.find(emp => emp.id === employeeId);
                const authorities = getAuthorityEmails(emp, employees);
                const template = getRatingTemplate({ ...newScore, employeeName: emp?.name, ratedByName: user?.name ?? "Manager" });
                sendMail({ to: emp?.email || "", cc: authorities, subject: `[BI-WEEKLY] ${emp?.name} - Score: ${score}/5`, html: template.html });
                return { ...e, biWeeklyScores: scores };
            }
            return e;
        }));
    };

    const addCollege = async (college: Omit<College, "id">) => {
        try {
            const res = await fetch("/api/locations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...college, id: `COL${uid()}` })
            });
            const data = await res.json();
            if (data.id) setColleges(prev => [...prev, data]);
        } catch (err) { console.error(err); }
    };

    const updateCollege = async (id: string, updates: Partial<College>) => {
        try {
            const res = await fetch(`/api/locations/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.id) setColleges(prev => prev.map(c => c.id === id ? data : c));
        } catch (err) { console.error(err); }
    };

    const deleteCollege = async (id: string) => {
        try {
            const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.message) setColleges(prev => prev.filter(c => c.id !== id));
        } catch (err) { console.error(err); }
    };

    const restoreAttendanceCredits = (employeeId: string) => {
        setEmployees(prev => prev.map(emp => {
            if (emp.id === employeeId) {
                return {
                    ...emp,
                    chancesRemaining: Math.min(3, (emp.chancesRemaining || 0) + 1),
                    markPresentUsed: Math.max(0, (emp.markPresentUsed || 0) - 1)
                };
            }
            return emp;
        }));
    };

    const giveCredit = (employeeId: string, reason: string) => {
        setEmployees(prev => prev.map(emp => {
            if (emp.id === employeeId) {
                const currentUsed = emp.markPresentUsed || 0;
                // Reduce the used counter by 1 to effectively "give" a credit back, max 0
                const updatedUsed = Math.max(0, currentUsed - 1);

                // Determine founders email
                const founders = prev.filter(e => e.role === "FOUNDER" && e.email).map(e => e.email!);

                // Email employee and CC founders
                if (emp.email) {
                    sendMail({
                        to: emp.email,
                        cc: founders,
                        subject: `Attendance Override Credit Granted - ${emp.name} `,
                        html: `
    < div style = "font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;" >
                                <h2 style="color: #10b981;">Credit Allotted</h2>
                                <p>Hi ${emp.name},</p>
                                <p>You have been granted an attendance override credit by HR.</p>
                                <p><strong>Reason:</strong> ${reason}</p>
                                <p>Your used credits have been reduced, giving you an additional chance this month.</p>
                                <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Geeks of Gurukul HRMS</p>
                            </div >
    `
                    });
                }

                return { ...emp, markPresentUsed: updatedUsed };
            }
            return emp;
        }));
    };

    // ─── LEAVES ───
    const addLeaveRequest = (req: Omit<LeaveRequest, "id" | "status" | "employeeId" | "employeeName">) => {
        if (!user) return;
        const now = new Date();
        const appliedAt = now.toISOString();

        const newLeave: LeaveRequest = {
            ...req,
            id: `LV${uid()} `,
            status: "Pending",
            employeeId: user.id,
            employeeName: user.name,
            lossOfPayDays: 0,
            appliedAt
        };

        setLeaves(prev => [newLeave, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const raiser = employees.find(e => e.id === user.id);
        const ccEmails = getAuthorityEmails(raiser, employees);
        const hr = employees.find(e => e.role === "HR");
        const rm = raiser?.reportsTo ? employees.find(e => e.id === raiser.reportsTo) : null;

        const { subject: mailSub, html: mailHtml } = getLeaveTemplate(newLeave, "Pending");

        // Ensure HOI and AD are also emailed 
        const chain = getManagerChain(user.id);
        const hoi = employees.find(e => e.role === "HOI" && chain.some(c => c.id === e.id));
        const ad = employees.find(e => e.role === "AD" && chain.some(c => c.id === e.id));

        const toList = [hr?.email, rm?.email, hoi?.email, ad?.email].filter(Boolean) as string[];
        const finalCC = [...new Set([...ccEmails, raiser?.email].filter(Boolean) as string[])];

        if (toList.length > 0) {
            sendMail({
                to: toList,
                cc: finalCC,
                subject: mailSub,
                html: mailHtml
            });
        }
    };
    const approveLeave = (id: string, reason?: string) => setLeaves(prev => {
        return prev.map(l => {
            if (l.id === id) {
                const updated = { ...l, status: "Approved" as const, reasonForAction: reason };

                // --- EMAIL NOTIFICATION ---
                const emp = employees.find(e => e.id === l.employeeId);
                const ccEmails = getAuthorityEmails(emp, employees);
                const { subject: mailSub, html: mailHtml } = getLeaveTemplate(updated, "Approved");

                if (emp?.email) {
                    sendMail({
                        to: emp.email,
                        cc: ccEmails,
                        subject: mailSub,
                        html: mailHtml
                    });
                }
                return updated;
            }
            return l;
        });
    });
    const rejectLeave = (id: string, applyLOP: boolean = false, reason?: string) => setLeaves(prev => {
        return prev.map(l => {
            if (l.id === id) {
                // Point 7: If emergency leave rejected, 2 day LOP
                const finalApplyLOP = applyLOP || (l.leaveType === "Emergency");
                const updated = { ...l, status: "Rejected" as const, lossOfPayDays: finalApplyLOP ? 2 : (l.lossOfPayDays || 0), reasonForAction: reason };

                // --- EMAIL NOTIFICATION ---
                const emp = employees.find(e => e.id === l.employeeId);
                const ccEmails = getAuthorityEmails(emp, employees);
                const { subject: mailSub, html: mailHtml } = getLeaveTemplate(updated, "Rejected");

                if (emp?.email) {
                    sendMail({
                        to: emp.email,
                        cc: ccEmails,
                        subject: mailSub,
                        html: mailHtml
                    });
                }
                return updated;
            }
            return l;
        });
    });

    // ─── TICKETS ───
    const raiseTicket = (targetCategory: string, subject: string, content: string, routeTo?: string, cc?: string[], proofUrls?: string[], targetEmployeeId?: string, targetDate?: string) => {
        if (!user) return;

        // Point 8: Include Proof Mandatory
        if (!proofUrls || proofUrls.length === 0) {
            alert("Proof is mandatory for raising a ticket. Please upload supporting documents.");
            return;
        }

        const targetCategoryNormalized = targetCategory.toLowerCase();

        let finalRouteTo = routeTo;
        let finalCC = cc || [];

        // Enhanced Automatic routing and CC logic based on Req.md
        const managerChain = getManagerChain(user.id);
        const empRecord = employees.find(e => e.id === user.id);
        const rm = empRecord?.reportsTo;
        const hrEmployees = employees.filter(e => e.role === "HR");
        const hrId = hrEmployees[0]?.id || "HR001";
        const hrEmails = hrEmployees.map(h => h.email!).filter(Boolean);
        const founders = employees.filter(e => e.role === "FOUNDER").map(f => f.id);
        const founderEmails = employees.filter(e => e.role === "FOUNDER" && e.email).map(f => f.email!);

        const isEmployee = ["OM", "FACULTY", "PROFESSOR", "BDE"].includes(user.role);
        const isHOI = user.role === "HOI";
        const isAD = user.role === "AD";

        if (targetCategoryNormalized.includes("hr") || targetCategoryNormalized.includes("account") || targetCategoryNormalized.includes("attendance")) {
            // HR issues [Accounts/HR] - To HR, CC: Founders
            finalRouteTo = hrId;
            finalCC = [...new Set([...finalCC, ...founders])];
        } else if (targetCategoryNormalized.includes("misconduct") || targetCategoryNormalized.includes("academic") || targetCategoryNormalized.includes("student")) {
            // Misconduct/Institute Issues/Academic - To RM, CC: All above RM, HR
            finalRouteTo = (Array.isArray(rm) ? rm[0] : (rm || hrId));
            const aboveRM = managerChain.slice(1).map(m => m.id);
            finalCC = [...new Set([...finalCC, ...aboveRM, ...hrEmployees.map(h => h.id)])];
        } else if (targetCategoryNormalized.includes("technical")) {
            // Technical Issues - To TL, CC: RM, All above RM, HR
            const tl = employees.find(e => e.role === "TL")?.id;
            finalRouteTo = tl || (Array.isArray(rm) ? rm[0] : (rm || hrId));
            finalCC = [...new Set([...finalCC, ...(Array.isArray(rm) ? rm : [rm || ""]), ...managerChain.slice(1).map(m => m.id), ...hrEmployees.map(h => h.id)].filter(Boolean))];
        } else {
            // Default ticket routing
            finalRouteTo = (Array.isArray(rm) ? rm[0] : (rm || hrId));
            finalCC = [...new Set([...finalCC])];
        }

        // Enforce resolution authority rules based on raiser
        // If employee raises, resolvable by HOI/AD/HR. Target is RM (usually HOI)
        // If HOI raises, resolvable by HR/AD. Target is AD or HR
        if (isHOI && finalRouteTo && !employees.find(e => e.id === finalRouteTo && ["HR", "AD", "FOUNDER"].includes(e.role))) {
            finalRouteTo = employees.find(e => e.role === "AD")?.id || hrId;
        }

        const newTicket: Ticket = {
            id: `TKT${uid()} `,
            raisedBy: user.id,
            employeeName: user.name,
            targetCategory,
            subject,
            content,
            status: "Open",
            createdAt: new Date().toISOString(),
            routeTo: finalRouteTo,
            cc: finalCC,
            proofUrls,
            targetEmployeeId,
            targetDate
        };

        setTickets(prev => [newTicket, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const targetEmp = employees.find(e => e.id === finalRouteTo);
        const raiser = employees.find(e => e.id === user.id);
        const ccEmails = getAuthorityEmails(raiser, employees);
        const { subject: mailSub, html: mailHtml } = getTicketTemplate(newTicket, 'raised');

        if (targetEmp?.email) {
            const finalCC = [...new Set([...ccEmails, raiser?.email].filter(Boolean) as string[])];
            sendMail({
                to: targetEmp.email,
                cc: finalCC,
                subject: mailSub,
                html: mailHtml
            });
        }
    };
    const resolveTicket = (id: string, notes: string) => {
        setTickets(prev => {
            const ticket = prev.find(t => t.id === id);
            if (ticket) {
                const isOverride = ticket.targetCategory === "Attendance Override Request";
                const isAppeal = ticket.targetCategory === "Attendance Appeal";

                if (isOverride || isAppeal) {
                    const targetEmpId = isOverride ? ticket.targetEmployeeId : ticket.raisedBy;
                    const targetDate = isOverride ? ticket.targetDate : (ticket.targetDate || ticket.createdAt.split('T')[0]);

                    if (targetEmpId && targetDate) {
                        // Auto-override attendance
                        markAttendanceOverride(targetEmpId, targetDate, `Approved via Ticket ${id} `);

                        // Reverse PIP warnings if any
                        setPipRecords(pips => pips.map(p =>
                            p.employeeId === targetEmpId && p.status === "Active"
                                ? { ...p, warnings: Math.max(0, p.warnings - 1) }
                                : p
                        ));
                    }
                }
            }
            return prev.map(t => {
                if (t.id === id) {
                    const updated = { ...t, status: "Resolved" as const, resolvedAt: new Date().toISOString(), resolutionNotes: notes };

                    // --- EMAIL NOTIFICATION ---
                    const raiser = employees.find(e => e.id === t.raisedBy);
                    const ccEmails = getAuthorityEmails(raiser, employees);
                    const { subject: mailSub, html: mailHtml } = getTicketTemplate(updated, 'resolved');

                    if (raiser?.email) {
                        sendMail({
                            to: raiser.email,
                            cc: ccEmails,
                            subject: mailSub,
                            html: mailHtml
                        });
                    }

                    return updated;
                }
                return t;
            });
        });
    };

    // ─── REIMBURSEMENTS ───
    const addReimbursement = (claim: Omit<ReimbursementClaim, "id" | "status" | "date" | "employeeId" | "employeeName">) => {
        if (!user) return;
        const newClaim: ReimbursementClaim = { ...claim, id: `RMB${uid()} `, employeeId: user.id, employeeName: user.name, status: "Pending", date: new Date().toISOString().split("T")[0] };
        setReimbursements(prev => [newClaim, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const emp = employees.find(e => e.id === user.id);
        const authorities = getAuthorityEmails(emp, employees);
        const { subject: mailSub, html: mailHtml } = getReimbursementTemplate(newClaim);

        // Ensure HR and TL (raiser) are on the list
        const hrEmails = employees.filter(e => e.role === "HR").map(e => e.email).filter(Boolean) as string[];
        const finalCC = [...new Set([...authorities, emp?.email].filter(Boolean) as string[])];

        sendMail({ to: hrEmails, cc: finalCC, subject: mailSub, html: mailHtml });
    };
    const updateReimbursementStatus = (id: string, status: ReimbursementClaim["status"], reason?: string, remarks?: string) => {
        setReimbursements(prev => prev.map(r => {
            if (r.id === id) {
                const updated = { ...r, status, rejectionReason: reason || r.rejectionReason, hrRemarks: remarks || r.hrRemarks };

                // --- EMAIL NOTIFICATION ---
                const emp = employees.find(e => e.id === r.employeeId);
                const ccEmails = getAuthorityEmails(emp, employees);
                const { subject: mailSub, html: mailHtml } = getReimbursementTemplate(updated);

                if (emp?.email) {
                    sendMail({
                        to: emp.email,
                        cc: ccEmails,
                        subject: mailSub,
                        html: mailHtml
                    });
                }
                return updated;
            }
            return r;
        }));
    };

    // ─── HOLIDAYS ───
    const proposeHoliday = (h: Omit<Holiday, "id" | "proposedBy" | "status" | "proposedByName">) => {
        if (!user) return;
        const newHol: Holiday = { ...h, id: `HOL${uid()} `, proposedBy: user.id, proposedByName: user.name, status: "Proposed" };
        setHolidays(prev => [...prev, newHol]);

        // --- EMAIL NOTIFICATION ---
        const ccEmails = getAuthorityEmails(user, employees);
        const { subject: mailSub, html: mailHtml } = getHolidayTemplate(newHol, "Proposed");
        const hr = employees.find(e => e.role === "HR");

        if (hr?.email) {
            sendMail({
                to: hr.email,
                cc: ccEmails,
                subject: mailSub,
                html: mailHtml
            });
        }
    };
    const approveHoliday = (id: string, customMessage?: string) => {
        setHolidays(prev => prev.map(h => {
            if (h.id === id) {
                const updated = { ...h, status: "Approved" as const, customMessage: customMessage || h.customMessage };

                // --- EMAIL NOTIFICATION ---
                const ccEmails = getAuthorityEmails(user, employees);
                const { subject: mailSub, html: mailHtml } = getHolidayTemplate(updated, "Approved");

                // All employees should technically be notified, but for now we'll send to RM/HOIs or just founders
                const founders = employees.filter(e => e.role === "FOUNDER").map(f => f.email).filter(Boolean) as string[];

                sendMail({
                    to: founders,
                    cc: ccEmails,
                    subject: mailSub,
                    html: mailHtml
                });

                return updated;
            }
            return h;
        }));

        // Auto-announce
        const hol = holidays.find(h => h.id === id);
        if (hol) {
            const msg = customMessage || `${hol.name} on ${hol.date} has been approved as an official holiday.`;
            setNotices(prev => [{ id: `N${uid()} `, title: `Holiday: ${hol.name} `, content: msg, category: "General" as const, createdBy: user?.name || "HR", createdAt: new Date().toISOString().split("T")[0] }, ...prev]);
        }
    };

    // ─── SOP ───
    const updateSOP = (sop: Omit<SOP, "id" | "lastUpdated">) => {
        if (!user) return;
        const existing = sops.find(s => s.title === sop.title);
        const newId = existing ? existing.id : `SOP${uid()} `;
        const updatedSop: SOP = {
            ...sop,
            id: newId,
            lastUpdated: new Date().toISOString().split("T")[0],
            previousContent: existing?.content,
            changeType: existing ? "updated" as const : "new" as const,
        };
        setSops(prev => existing ? prev.map(s => s.id === newId ? updatedSop : s) : [updatedSop, ...prev]);
        const notif: SOPNotification = {
            id: `sopn${uid()} `, sopId: newId, title: sop.title,
            changeType: existing ? "updated" : "new",
            changedBy: user.name, changedAt: new Date().toISOString().split("T")[0], readBy: [],
        };
        setSopNotifications(prev => [notif, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const allEmails = employees.filter(e => e.email && e.status === "Active").map(e => e.email).filter(Boolean) as string[];
        const { subject: mailSub, html: mailHtml } = getSOPUpdateTemplate({
            title: updatedSop.title,
            version: updatedSop.version,
            changelog: updatedSop.changelog || (existing ? 'Updated SOP' : 'New SOP'),
            changedBy: user.name
        }, existing ? 'updated' : 'new');
        sendMail({ to: allEmails, subject: mailSub, html: mailHtml });

        // Inter-portal communication via localStorage
        try { localStorage.setItem("sop_update", JSON.stringify({ ...notif, ts: Date.now() })); } catch { }
    };

    const deleteSOP = (id: string) => {
        if (!user) return;
        const sop = sops.find(s => s.id === id);
        if (!sop) return;
        setSops(prev => prev.filter(s => s.id !== id));
        const notif: SOPNotification = {
            id: `sopn${uid()} `, sopId: id, title: sop.title,
            changeType: "deleted", changedBy: user.name,
            changedAt: new Date().toISOString().split("T")[0], readBy: [],
        };
        setSopNotifications(prev => [notif, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const allEmails = employees.filter(e => e.email && e.status === "Active").map(e => e.email).filter(Boolean) as string[];
        const { subject: mailSub, html: mailHtml } = getSOPUpdateTemplate({
            title: sop.title,
            version: sop.version,
            changedBy: user.name
        }, 'deleted');
        sendMail({ to: allEmails, subject: mailSub, html: mailHtml });

        try { localStorage.setItem("sop_update", JSON.stringify({ ...notif, ts: Date.now() })); } catch { }
    };

    const markSOPNotificationRead = (sopNotifId: string) => {
        if (!user) return;
        setSopNotifications(prev => prev.map(n => n.id === sopNotifId ? { ...n, readBy: [...n.readBy, user.id] } : n));
    };

    const markAllSOPNotificationsRead = () => {
        if (!user) return;
        setSopNotifications(prev => prev.map(n => n.readBy.includes(user.id) ? n : { ...n, readBy: [...n.readBy, user.id] }));
    };

    const updateMasterSop = (content: string, changelog?: string) => {
        if (!user) return;
        const oldContent = masterSopContent;
        setMasterSopContent(content);
        const notif: SOPNotification = {
            id: `sopn${uid()} `, sopId: "master", title: "Full SOP Document",
            changeType: "updated", changedBy: user.name,
            changedAt: new Date().toISOString().split("T")[0], readBy: [],
            changelog: changelog || "SOP document updated",
            previousContent: oldContent.slice(0, 800),
            newContent: content.slice(0, 800),
        };
        setSopNotifications(prev => [notif, ...prev]);

        // --- EMAIL NOTIFICATION ---
        const allEmails = employees.filter(e => e.email && e.status === "Active").map(e => e.email).filter(Boolean) as string[];
        const { subject: mailSub, html: mailHtml } = getSOPUpdateTemplate({
            title: notif.title,
            version: "Master",
            changelog: notif.changelog,
            changedBy: user.name
        }, 'updated');
        sendMail({ to: allEmails, subject: mailSub, html: mailHtml });

        try {
            localStorage.setItem("sop_update", JSON.stringify({ ...notif, ts: Date.now() }));
            localStorage.setItem("master_sop_content", content);
        } catch { }
    };

    // ─── PIP ───
    const addToPIP = (employeeId: string, reason: string) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;
        const pip = { id: `PIP${uid()} `, employeeId, employeeName: emp.name, reason, startDate: new Date().toISOString().split("T")[0], status: "Active" as const, warnings: 0, disclaimer: "You are currently under Performance Improvement Plan." };
        setPipRecords(prev => [...prev, pip]);

        // --- EMAIL NOTIFICATION ---
        const ccEmails = getAuthorityEmails(emp, employees);
        const { subject: mailSub, html: mailHtml } = getPIPAddTemplate(pip);

        if (emp.email) {
            sendMail({
                to: emp.email,
                cc: ccEmails,
                subject: mailSub,
                html: mailHtml
            });
        }
    };

    const removeFromPIP = (pipId: string, reason: string, proofs?: string[]) => {
        setPipRecords(prev => prev.map(p => p.id === pipId ? {
            ...p,
            status: "Completed",
            resolvedReason: reason,
            resolvedProofs: proofs,
            resolvedAt: new Date().toISOString()
        } : p));

        // Reset chances when removed from PIP
        const record = pipRecords.find(p => p.id === pipId);
        if (record) resetChances(record.employeeId);
    };

    const deductChance = (employeeId: string, reason: string) => {
        setEmployees(prev => prev.map(e => {
            if (e.id === employeeId) {
                const newChances = Math.max(0, e.chancesRemaining - 1);
                if (newChances === 0) {
                    // Auto enroll in PIP if chances hit 0
                    setTimeout(() => addToPIP(employeeId, `Automated PIP: Chances exhausted.Last reason: ${reason} `), 0);
                }
                return { ...e, chancesRemaining: newChances };
            }
            return e;
        }));
    };

    const resetChances = (employeeId: string) => {
        setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, chancesRemaining: 3 } : e));
    };

    const reportMisbehaviour = (employeeId: string, type: MisbehaviourReport["type"], description: string, ccList: string[], propagationChain: any[]) => {
        if (!user) return;
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;

        const report: MisbehaviourReport = {
            id: `MB${uid()} `,
            reportedBy: user.id,
            reportedByName: user.name,
            employeeId,
            employeeName: emp.name,
            type,
            description,
            date: new Date().toISOString().split("T")[0],
            ccList,
            propagationChain
        };

        setMisbehaviourReports(prev => [...prev, report]);

        // --- EMAIL NOTIFICATION ---
        const ccEmails = getAuthorityEmails(emp, employees);
        const { subject: mailSub, html: mailHtml } = getMisbehaviourTemplate(report);

        if (emp.email) {
            const finalCC = [...new Set([...ccEmails, user.email].filter(Boolean) as string[])];
            sendMail({
                to: emp.email,
                cc: finalCC,
                subject: mailSub,
                html: mailHtml
            });
        }
    };

    const recalculatePerformance = (employeeId: string) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;

        const empRatings = ratings.filter(r => r.employeeId === employeeId);
        const avgRating = empRatings.length > 0 ? empRatings.reduce((sum, r) => sum + r.score, 0) / empRatings.length : 0;

        const empAttendance = attendanceRecords.filter(a => a.employeeId === employeeId);
        const onTimeCount = empAttendance.filter(a => !a.flags.late).length;
        const dressCodeCount = empAttendance.filter(a => !a.flags.dressCode).length;
        const onTimeRate = empAttendance.length > 0 ? (onTimeCount / empAttendance.length) : 1;

        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const recentAttendance = empAttendance.filter(a => new Date(a.date) >= twoMonthsAgo);
        const hasFlags = recentAttendance.some(a => Object.values(a.flags).some(v => v === true));

        const approvedResp = additionalResponsibilities.filter(r => r.employeeId === employeeId && r.status === "Approved");
        const respPoints = approvedResp.reduce((sum, r) => sum + (r.points || 0), 0);

        // Core score calculation (Base 0-5)
        // Rating (Weight 30%)
        // On Time (Weight 20%)
        // Dress Code (Weight 15%)
        // No Flags (Weight 15%)
        // Responsibilities (Bonus Points)

        let score = (avgRating * 0.4) + (onTimeRate * 5 * 0.2) + (dressCodeCount / (empAttendance.length || 1) * 5 * 0.15);
        if (!hasFlags && empAttendance.length > 0) score += 0.75; // 15% of 5

        // Bonus for approved responsibilities (0.2 stars per 10 points, max 1 star bonus)
        const bonus = Math.min(1, (respPoints / 50));
        score += bonus;

        const stars = Math.min(5, Math.ceil(score));
        const badges: string[] = [];
        if (onTimeRate > 0.95) badges.push("On Time");
        if (dressCodeCount === empAttendance.length && empAttendance.length > 5) badges.push("Good Dress Code");
        if (avgRating >= 4.2) badges.push("Top Performer");
        if (!hasFlags && empAttendance.length > 0) badges.push("0 Flags");
        if (respPoints > 0) badges.push("Additional Responsibilities");

        setPerformanceStars(prev => {
            const existing = prev.find(s => s.employeeId === employeeId);
            const updated = { employeeId, stars, rating: parseFloat(avgRating.toFixed(1)), badges };
            if (existing) return prev.map(s => s.employeeId === employeeId ? updated : s);
            return [...prev, updated];
        });
    };

    // ─── RATINGS ───
    const addRating = (employeeId: string, ratedBy: string, score: number, period: string, comment?: string) => {
        if (!user) return;
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;

        const newRating: Rating = {
            id: `RT${uid()} `,
            employeeId,
            employeeName: emp.name,
            ratedBy: user.id,
            ratedByName: user.name,
            score,
            period,
            comment,
            date: new Date().toISOString().split("T")[0]
        };

        // Send Email Notification
        const { subject, html } = getRatingTemplate(newRating);
        const authorities = getAuthorityEmails(emp, employees);
        sendMail({ to: emp.email, cc: authorities, subject, html });

        setRatings(prev => {
            const next = [...prev, newRating];
            // Recalculate stars using the new ratings list
            setTimeout(() => recalculatePerformance(employeeId), 100);
            return next;
        });
    };

    // ─── WORK SCHEDULE ───
    const assignWorkSchedule = (schedule: WorkSchedule) => {
        const enriched = { ...schedule, assignedBy: user?.id, assignedByName: user?.name, approvedByHR: false };
        setWorkSchedules(prev => {
            const existing = prev.findIndex(s => s.employeeId === schedule.employeeId);
            if (existing >= 0) { const nw = [...prev]; nw[existing] = enriched; return nw; }
            return [...prev, enriched];
        });

        // --- EMAIL NOTIFICATION ---
        const emp = employees.find(e => e.id === schedule.employeeId);
        const ccEmails = getAuthorityEmails(emp, employees);
        const { subject: mailSub, html: mailHtml } = getWorkScheduleTemplate(enriched, false);

        if (emp?.email) {
            sendMail({
                to: emp.email,
                cc: ccEmails,
                subject: mailSub,
                html: mailHtml
            });
        }
    };
    const approveWorkSchedule = (employeeId: string) => {
        setWorkSchedules(prev => prev.map(s => s.employeeId === employeeId ? { ...s, approvedByHR: true } : s));
    };


    // ─── ADDITIONAL RESPONSIBILITIES ───
    const addAdditionalResponsibility = (employeeId: string, description: string, points: number) => {
        if (!user) return;
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;
        const resp = {
            id: `AR${uid()} `,
            employeeId,
            employeeName: emp.name,
            addedBy: user.id,
            description,
            date: new Date().toISOString().split("T")[0],
            status: "Pending" as const,
            points
        };
        setAdditionalResponsibilities(prev => [...prev, resp]);

        // --- EMAIL NOTIFICATION ---
        const ccEmails = getAuthorityEmails(emp, employees);
        const { subject: mailSub, html: mailHtml } = getAdditionalResponsibilityTemplate(resp);

        if (emp.email) {
            sendMail({
                to: emp.email,
                cc: ccEmails,
                subject: mailSub,
                html: mailHtml
            });
        }
    };

    const approveAdditionalResponsibility = (id: string, status: "Approved" | "Rejected") => {
        setAdditionalResponsibilities(prev => {
            const item = prev.find(r => r.id === id);
            if (item && status === "Approved") {
                setTimeout(() => recalculatePerformance(item.employeeId), 100);
            }
            return prev.map(r => r.id === id ? { ...r, status } : r);
        });
    };

    // ─── MEETINGS ───
    const addMeetingRequest = (req: Omit<MeetingRequest, "id" | "status" | "employeeId" | "employeeName" | "createdAt">) => {
        if (!user) return;
        const newMeeting: MeetingRequest = {
            ...req,
            id: `MTG${uid()} `,
            status: "Pending",
            employeeId: user.id,
            employeeName: user.name,
            createdAt: new Date().toISOString()
        };
        setMeetings(prev => [newMeeting, ...prev]);

        // Notify attendees
        req.attendees?.forEach(att => {
            addNotification(att.id, att.name, `New meeting scheduled: ${req.purpose} `, "ticket");
        });

        // Notify management chain
        const chain = getManagerChain(user.id);
        const mgtEmails = chain.filter(m => m.email).map(m => m.email!);
        chain.forEach(mgr => {
            addNotification(mgr.id, mgr.name, `${user.name} scheduled a meeting: ${req.purpose}`, "ticket");
        });

        // Email notification for meeting
        const toEmails = req.attendees?.map(att => employees.find(e => e.id === att.id)?.email).filter(Boolean) as string[] || [];
        if (toEmails.length > 0 || mgtEmails.length > 0) {
            sendMail({
                to: toEmails,
                cc: [...new Set([...mgtEmails, user.email].filter(Boolean) as string[])],
                subject: `[MEETING SCHEDULED] ${req.purpose}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #10b981;">New Meeting Scheduled</h2>
                        <p><strong>Proposed By:</strong> ${user.name}</p>
                        <p><strong>Purpose:</strong> ${req.purpose}</p>
                        <p><strong>Date:</strong> ${req.date} | <strong>Time:</strong> ${req.time}</p>
                        ${req.googleLink ? `<p><strong>Google Meet:</strong> <a href="${req.googleLink}">${req.googleLink}</a></p>` : ''}
                        <p>This is an automated mail from GOG Meeting Portal.</p>
                    </div>
                `
            });
        }
    };

    const updateMeetingStatus = (id: string, status: MeetingRequest["status"], MOMData?: { screenshotUrls: string[], attendees: MeetingRequest["attendees"] }) => {
        setMeetings(prev => prev.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, status, ...MOMData };

            if (status === "Completed" && MOMData) {
                // --- EMAIL NOTIFICATION ---
                const reportee = employees.find(e => e.id === m.attendees?.[0]?.id || m.employeeId);
                const ccEmails = getAuthorityEmails(reportee, employees);
                const { subject: mailSub, html: mailHtml } = getMoMTemplate(m, { content: "Meeting successfully completed and MoM uploaded.", decision: "Please refer to the dashboard for detailed decisions." });

                if (reportee?.email) {
                    sendMail({
                        to: reportee.email,
                        cc: ccEmails,
                        subject: mailSub,
                        html: mailHtml
                    });
                }
            }

            return updated;
        }));
    };

    // ─── PAYROLL ───
    const generatePayroll = (month: string, year: string) => {
        const newRecords: PayrollRecord[] = employees.map(emp => {
            const basic = emp.salary / 12; const tax = basic * 0.1; const pf = basic * 0.12;
            return { id: `PR${uid()} `, employeeId: emp.id, month, year, amount: basic, deductions: { tax, pf, other: 0 }, reimbursements: 0, generatedAt: new Date().toISOString().split("T")[0] };
        });
        setPayrollRecords(prev => [...newRecords, ...prev]);
    };

    // ─── LEGACY METHODS ───
    const addJobPosting = (job: Omit<JobPosting, "id" | "postedBy" | "postedAt" | "status">) => { if (!user) return; setJobPostings(prev => [{ ...job, id: `JP${uid()} `, postedBy: user.name, postedAt: new Date().toISOString().split("T")[0], status: "Active" }, ...prev]); };
    const closeJobPosting = (id: string) => setJobPostings(prev => prev.map(j => j.id === id ? { ...j, status: "Closed" as const } : j));
    const generateCertificate = (employeeId: string, type: string, description: string) => { if (!user) return; const emp = employees.find(e => e.id === employeeId); setCertificates(prev => [...prev, { id: `CERT${uid()} `, employeeId, employeeName: emp?.name || "", type, description, issuedAt: new Date().toISOString().split("T")[0], issuedBy: user.name }]); };
    const submitResignation = (reason: string, lastWorkingDate: string) => { if (!user) return; setResignationRequests(prev => [...prev, { id: `RES${uid()} `, employeeId: user.id, employeeName: user.name, reason, lastWorkingDate, status: "Pending", appliedAt: new Date().toISOString().split("T")[0], noticePeriod: 30 }]); };
    const approveResignation = (id: string) => setResignationRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Approved" as const } : r));
    const requestAsset = (assetType: string, reason: string) => { if (!user) return; setAssetRequests(prev => [...prev, { id: `AR${uid()} `, employeeId: user.id, employeeName: user.name, assetType, reason, status: "Pending", requestedAt: new Date().toISOString().split("T")[0] }]); };
    const assignAsset = (assetId: string, employeeId: string) => setAssets(prev => prev.map(a => a.id === assetId ? { ...a, assignedTo: employeeId, status: "Assigned" as const } : a));
    const updateAssetRequestStatus = (id: string, status: AssetRequest["status"]) => setAssetRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

    const updateProfile = (data: Partial<Employee>) => {
        if (!user) return;
        setEmployees(prev => prev.map(e => e.id === user.id ? { ...e, ...data } : e));
        setUser(prev => prev ? { ...prev, ...data } : null);
    };

    // ─── NOTIFICATIONS ───
    const addNotification = (to: string, toName: string, message: string, type: PortalNotification["type"]) => {
        if (!user) return;
        setNotifications(prev => [{ id: `NTF${uid()} `, from: user.id, fromName: user.name, to, toName, message, type, read: false, createdAt: new Date().toISOString() }, ...prev]);
    };
    const markNotificationRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };
    const getMyNotifications = () => {
        if (!user) return [];
        return notifications.filter(n => n.to === user.id || n.to === "ALL");
    };
    const activityLogs = notifications;

    return (
        <AuthContext.Provider value={{
            user, employees, leaves, meetings, notices, payrollRecords, sops, attendanceRecords,
            tickets, holidays, pipRecords, workSchedules, performanceStars, moms, reimbursements,
            orgHierarchy, ratings, misbehaviourReports, additionalResponsibilities, notifications, activityLogs, colleges,
            jobPostings, certificates, resignationRequests, assets, assetRequests,
            login, logout, addNotice, addAnnouncement, editNotice, markAnnouncementRead, updateProfile, clockIn, clockOut, raiseTicket, resolveTicket,
            addLeaveRequest, approveLeave, rejectLeave, addReimbursement, updateReimbursementStatus,
            proposeHoliday, approveHoliday, updateSOP, deleteSOP, addToPIP, markAttendanceOverride,
            sopNotifications, masterSopContent, updateMasterSop, markSOPNotificationRead, markAllSOPNotificationsRead,
            reportMisbehaviour, addRating, assignWorkSchedule, approveWorkSchedule, addCollege,
            updateCollege,
            deleteCollege,
            addAdditionalResponsibility,
            approveAdditionalResponsibility, addMeetingRequest, updateMeetingStatus,
            getReportees, getManagerChain, generatePayroll, addEmployee, updateOnboarding,
            removeFromPIP, deductChance, resetChances,
            addBiWeeklyRating,
            addJobPosting, closeJobPosting, generateCertificate, submitResignation, approveResignation,
            requestAsset, assignAsset, updateAssetRequestStatus,
            addNotification, markNotificationRead, getMyNotifications,
            markAsPresentRequests, addMarkAsPresentRequest, resolveMarkAsPresentRequest, resolveDressCodeCheck, giveCredit,
            getExpectedTiming, restoreAttendanceCredits, changePassword, authLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
