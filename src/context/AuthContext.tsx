"use client";
import { COLLEGES as INITIAL_COLLEGES, College } from "@/lib/colleges";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useRouter } from "next/navigation";

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
    reportsTo?: string;
    managerLevel?: string;
    password?: string;
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
    // Legacy Compatibility
    education?: any[];
    experience?: any[];
    bankName?: string;
    accountNumber?: string;
}
export interface LeaveRequest {
    id: string; employeeId: string; employeeName: string; type: string;
    startDate: string; endDate: string; days: number;
    status: "Pending" | "Approved" | "Rejected"; classification: "Paid" | "Unpaid";
    leaveType: "Planned" | "Emergency"; reason?: string; proofUrls?: string[];
    lossOfPayDays?: number;
    emergencyCategory?: "Accident" | "Death" | "In Hospital";
    appliedAt?: string;
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
    id: string; name: string; designation: string; level: "C-Suite" | "Leadership" | "HOI" | "OM" | "Faculty";
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
    // ─── FOUNDERS (Superadmins) ───
    { id: "FND001", name: "CEO", email: "ceo@gog.com", role: "FOUNDER", isOnboarded: true, dept: "C-Suite", designation: "Chief Executive Officer", status: "Active", joiningDate: "2023-01-01", salary: 500000, location: "Bhopal", dateOfBirth: "1980-01-15", phone: "9000000001", gender: "Male", bloodGroup: "O+", chancesRemaining: 3 },
    { id: "FND002", name: "CTO", email: "cto@gog.com", role: "FOUNDER", isOnboarded: true, dept: "C-Suite", designation: "Chief Technology Officer", status: "Active", joiningDate: "2023-01-01", salary: 450000, location: "Bhopal", dateOfBirth: "1982-05-20", phone: "9000000002", gender: "Male", bloodGroup: "A+", chancesRemaining: 3 },
    { id: "FND003", name: "COO", email: "coo@gog.com", role: "FOUNDER", isOnboarded: true, dept: "C-Suite", designation: "Chief Operating Officer", status: "Active", joiningDate: "2023-01-01", salary: 450000, location: "Bhopal", dateOfBirth: "1983-08-10", phone: "9000000003", gender: "Male", bloodGroup: "B+", chancesRemaining: 3 },
    // ─── HR ───
    { id: "HR001", name: "Vivek Yadav", email: "vivek@gog.com", role: "HR", isOnboarded: true, dept: "HR", designation: "HR Manager", status: "Active", joiningDate: "2024-03-01", salary: 95000, location: "Bhopal", dateOfBirth: "1992-05-15", phone: "9876543212", gender: "Male", bloodGroup: "A+", reportsTo: undefined, panNumber: "VYVPD5678G", aadhaarNumber: "2345-6789-0123", bankName: "SBI", accountNumber: "30100987654321", ifscCode: "SBIN0005678", education: [{ degree: "MBA HR", institution: "XLRI", yearOfPassing: "2016", percentage: "82%" }], chancesRemaining: 3 },
    // ─── AD ───
    { id: "AD001", name: "Raj Kumar Sahoo", email: "raj@gog.com", role: "AD", isOnboarded: true, dept: "Management", designation: "Associate Director", status: "Active", joiningDate: "2024-01-15", salary: 150000, location: "Bhopal", dateOfBirth: "1985-06-12", phone: "9876543210", gender: "Male", bloodGroup: "O+", managerLevel: "AD", reportsTo: undefined, panNumber: "ABCDE1234F", aadhaarNumber: "1234-5678-9012", bankName: "HDFC Bank", accountNumber: "50100123456789", ifscCode: "HDFC0001234", education: [{ degree: "MBA", institution: "IIM Indore", yearOfPassing: "2010", percentage: "78%" }], experience: [{ company: "TCS", role: "Manager", duration: "5 years", lastSalary: 120000 }], chancesRemaining: 3 },
    // ─── TL ───
    { id: "TL001", name: "Nitesh", email: "nitesh@gog.com", role: "TL", isOnboarded: true, dept: "Engineering", designation: "Tech Lead", status: "Active", joiningDate: "2024-02-10", salary: 140000, location: "Bhopal", dateOfBirth: "1998-12-05", phone: "9876543211", gender: "Male", bloodGroup: "B+", managerLevel: "TL", reportsTo: undefined, chancesRemaining: 3 },
    // ─── HOIs ───
    { id: "HOI001", name: "Ayush Chauhan", email: "ayush@gog.com", role: "HOI", isOnboarded: true, dept: "Academics", designation: "Head of Institute", status: "Active", joiningDate: "2024-02-01", salary: 85000, location: "Bhopal", dateOfBirth: "1996-03-10", phone: "9876543213", gender: "Male", bloodGroup: "AB+", managerLevel: "HOI", chancesRemaining: 3 },
    { id: "HOI002", name: "Sachin Kumar Gupta", email: "sachin@gog.com", role: "HOI", isOnboarded: true, dept: "Admissions", designation: "Head of Institute", status: "Active", joiningDate: "2024-04-05", salary: 90000, location: "Bhopal", dateOfBirth: "1994-08-22", phone: "9876543214", gender: "Male", bloodGroup: "O-", managerLevel: "HOI", chancesRemaining: 3 },
    { id: "HOI003", name: "Sidhartha Paikaray", email: "sidhartha@gog.com", role: "HOI", isOnboarded: true, dept: "Operations", designation: "Head of Institute", status: "Active", joiningDate: "2024-03-15", salary: 88000, location: "Bhopal", dateOfBirth: "1999-11-30", phone: "9876543215", gender: "Male", bloodGroup: "B-", managerLevel: "HOI", chancesRemaining: 3 },
    // ─── OMs ───
    { id: "OM001", name: "Arjun Sharma", email: "arjun@gog.com", role: "OM", isOnboarded: true, dept: "Engineering", designation: "Operations Manager", status: "Active", joiningDate: "2024-01-10", salary: 70000, location: "Bhopal", dateOfBirth: "1995-02-24", phone: "9876543216", gender: "Male", bloodGroup: "A-", reportsTo: "HOI003", chancesRemaining: 3 },
    { id: "OM002", name: "Kavitha Nair", email: "kavitha@gog.com", role: "OM", isOnboarded: true, dept: "HR", designation: "Operations Manager", status: "Active", joiningDate: "2024-03-15", salary: 55000, location: "Bhopal", dateOfBirth: "1997-07-18", phone: "9876543217", gender: "Female", bloodGroup: "O+", reportsTo: "HOI001", chancesRemaining: 3 },
    { id: "OM003", name: "Amit Patel", email: "amit@gog.com", role: "OM", isOnboarded: true, dept: "Product", designation: "Operations Manager", status: "Active", joiningDate: "2024-01-20", salary: 65000, location: "Bhopal", dateOfBirth: "1992-05-15", phone: "9876543218", gender: "Male", bloodGroup: "AB-", reportsTo: "HOI002", chancesRemaining: 3 },
    // ─── FACULTY ───
    { id: "FAC001", name: "Anil Kumar", email: "anil@gog.com", role: "FACULTY", isOnboarded: true, dept: "Academics", designation: "Senior Faculty", status: "Active", joiningDate: "2024-04-01", salary: 45000, location: "Bhopal", dateOfBirth: "1993-09-12", phone: "9876543219", gender: "Male", bloodGroup: "B+", reportsTo: "OM001", panNumber: "ANILK1234H", aadhaarNumber: "3456-7890-1234", bankName: "ICICI Bank", accountNumber: "40200567890123", ifscCode: "ICIC0003456", education: [{ degree: "M.Tech", institution: "NIT Bhopal", yearOfPassing: "2018", percentage: "85%" }, { degree: "B.Tech", institution: "RGPV", yearOfPassing: "2015", percentage: "78%" }], experience: [{ company: "Infosys", role: "Software Engineer", duration: "3 years", lastSalary: 35000 }], chancesRemaining: 3 },
    { id: "FAC002", name: "Meera Das", email: "meera@gog.com", role: "FACULTY", isOnboarded: true, dept: "Academics", designation: "Associate Faculty", status: "Active", joiningDate: "2024-05-10", salary: 38000, location: "Bhopal", dateOfBirth: "1996-01-22", phone: "9876543220", gender: "Female", bloodGroup: "A+", reportsTo: "OM001", chancesRemaining: 3 },
    { id: "FAC003", name: "Priya Singh", email: "priya@gog.com", role: "FACULTY", isOnboarded: true, dept: "Design", designation: "Senior Faculty", status: "Active", joiningDate: "2024-03-20", salary: 42000, location: "Bhopal", dateOfBirth: "1994-04-05", phone: "9876543221", gender: "Female", bloodGroup: "O+", reportsTo: "OM002", chancesRemaining: 3 },
    { id: "FAC004", name: "Rahul Das", email: "rahul@gog.com", role: "FACULTY", isOnboarded: true, dept: "Marketing", designation: "Associate Faculty", status: "Active", joiningDate: "2024-06-01", salary: 36000, location: "Bhopal", dateOfBirth: "1997-08-14", phone: "9876543222", gender: "Male", bloodGroup: "B-", reportsTo: "OM002", chancesRemaining: 3 },
    { id: "FAC005", name: "Sneha Reddy", email: "sneha@gog.com", role: "FACULTY", isOnboarded: true, dept: "Engineering", designation: "Senior Faculty", status: "Active", joiningDate: "2024-02-15", salary: 44000, location: "Bhopal", dateOfBirth: "1995-12-28", phone: "9876543223", gender: "Female", bloodGroup: "AB+", reportsTo: "OM003", chancesRemaining: 3 },
    { id: "FAC006", name: "Vikram Deshmukh", email: "vikram@gog.com", role: "FACULTY", isOnboarded: true, dept: "Engineering", designation: "Associate Faculty", status: "Active", joiningDate: "2024-07-01", salary: 35000, location: "Bhopal", dateOfBirth: "1998-03-17", phone: "9876543224", gender: "Male", bloodGroup: "O-", reportsTo: "OM003", chancesRemaining: 3 },
];

const INITIAL_NOTICES: Notice[] = [
    { id: "n1", title: "Office Timings Updated", content: "New office hours are 9:30 AM to 6:30 PM effective from next Monday.", category: "Policy", createdBy: "Vivek Yadav", createdAt: "2024-02-20" },
    { id: "n2", title: "Holi Celebration", content: "Office will remain closed on 14th March for Holi. Celebrations in office on 13th.", category: "Event", createdBy: "Vivek Yadav", createdAt: "2024-02-18" },
    { id: "n3", title: "Quarterly Review Meeting", content: "All department heads please submit Q4 reports by 28th Feb.", category: "General", createdBy: "Raj Kumar Sahoo", createdAt: "2024-02-15" },

    { id: "n6", title: "Mandatory Safety Training", content: "All employees must complete fire safety and first-aid training by 15th March. Schedule available on portal.", category: "Training", createdBy: "Vivek Yadav", createdAt: "2024-02-22" },
    { id: "n7", title: "Leave Policy Reminder", content: "Planned leaves must be applied 1 day before. Emergency leaves same day. Incorrect usage leads to paycut.", category: "HR", createdBy: "Vivek Yadav", createdAt: "2024-02-17" },
    { id: "n8", title: "System Maintenance Notice", content: "HRMS portal will be under maintenance on 2nd March from 11 PM to 5 AM. Please plan accordingly.", category: "Update", createdBy: "Raj Kumar Sahoo", createdAt: "2024-02-26" },
];

const INITIAL_HIERARCHY: OrgNode[] = [
    { id: "FND001", name: "CEO", designation: "Chief Executive Officer", level: "C-Suite", photoInitial: "C", dept: "C-Suite" },
    { id: "FND002", name: "CTO", designation: "Chief Technology Officer", level: "C-Suite", photoInitial: "C", dept: "C-Suite" },
    { id: "FND003", name: "COO", designation: "Chief Operating Officer", level: "C-Suite", photoInitial: "C", dept: "C-Suite" },
    { id: "AD001", name: "Raj Kumar Sahoo", designation: "Associate Director", level: "Leadership", parentId: "FND001", photoInitial: "R", dept: "Management" },
    { id: "TL001", name: "Nitesh", designation: "Tech Lead", level: "Leadership", parentId: "FND002", photoInitial: "N", dept: "Engineering" },
    { id: "HR001", name: "Vivek Yadav", designation: "HR Manager", level: "Leadership", parentId: "FND001", photoInitial: "V", dept: "HR" },
    { id: "HOI001", name: "Ayush Chauhan", designation: "Head of Institute", level: "HOI", parentId: "AD001", photoInitial: "A", dept: "Academics" },
    { id: "HOI002", name: "Sachin Kumar Gupta", designation: "Head of Institute", level: "HOI", parentId: "AD001", photoInitial: "S", dept: "Admissions" },
    { id: "HOI003", name: "Sidhartha Paikaray", designation: "Head of Institute", level: "HOI", parentId: "AD001", photoInitial: "S", dept: "Operations" },
    { id: "OM001", name: "Arjun Sharma", designation: "Operations Manager", level: "OM", parentId: "HOI003", photoInitial: "A", dept: "Engineering" },
    { id: "OM002", name: "Kavitha Nair", designation: "Operations Manager", level: "OM", parentId: "HOI001", photoInitial: "K", dept: "HR" },
    { id: "OM003", name: "Amit Patel", designation: "Operations Manager", level: "OM", parentId: "HOI002", photoInitial: "A", dept: "Product" },
    { id: "FAC001", name: "Anil Kumar", designation: "Senior Faculty", level: "Faculty", parentId: "OM001", photoInitial: "A", dept: "Academics" },
    { id: "FAC002", name: "Meera Das", designation: "Associate Faculty", level: "Faculty", parentId: "OM001", photoInitial: "M", dept: "Academics" },
    { id: "FAC003", name: "Priya Singh", designation: "Senior Faculty", level: "Faculty", parentId: "OM002", photoInitial: "P", dept: "Design" },
    { id: "FAC004", name: "Rahul Das", designation: "Associate Faculty", level: "Faculty", parentId: "OM002", photoInitial: "R", dept: "Marketing" },
    { id: "FAC005", name: "Sneha Reddy", designation: "Senior Faculty", level: "Faculty", parentId: "OM003", photoInitial: "S", dept: "Engineering" },
    { id: "FAC006", name: "Vikram Deshmukh", designation: "Associate Faculty", level: "Faculty", parentId: "OM003", photoInitial: "V", dept: "Engineering" },
];

const MASTER_SOP_CONTENT = `# Standard Operating Procedure (SOP) || Geeks of Gurukul

**Organization:** Skillscan Edtech India Pvt. Ltd. (*Known as* **"Geeks of Gurukul"**)

## 1. Purpose

The purpose of this SOP is to establish clear and professional guidelines for all employees regarding dress code, attendance, conduct, leaves and other office-related policies. It aims to create a respectful, productive, and organized environment at Geeks of Gurukul.

## 2. Scope

This SOP applies to all employees *(which includes SDE & Professors, Operation Manager, HoI, Interns and other employees of different dept.)* at Geeks of Gurukul, including those engaged in administrative roles, academic staff, support staff etc.

## 3.1 Dress Code Policy

**Mandatory Dress Code**

All employees must strictly adhere to the following dress code during working hours:

- **White formal shirt with collar**
- **Black Pant with Belt**
- **Black formal blazer**
- **Formal shoes**

Casual attire is **strictly prohibited** unless specifically approved by Management for official events.

### Dress Code Violation \u2013 Disciplinary Process (For All Professors)

Non-compliance with the prescribed dress code will result in **progressive disciplinary action**, applicable to **all Professors**, and will be recorded in HR records:

1. **1st Instance** \u2013 First warning via email. Entry recorded in HR records.
2. **2nd Instance** \u2013 Second warning via email. Entry recorded in HR records.
3. **3rd Instance** \u2013 Third warning via email. **10% fine deducted from one day\u2019s gross salary.**
4. **4th Instance** \u2013 Fourth warning via email. **20% fine deducted from one day\u2019s gross salary.**
5. **5th Instance and Subsequent Violations** \u2013 Fifth warning via email. **30% fine deducted from one day\u2019s gross salary.** Further disciplinary action may be initiated at the Management\u2019s discretion.

> **Important Notes:** Penalties will be applied per day of non-compliance. Repeated violations may adversely impact performance reviews and disciplinary records. The Management reserves the right to take strict disciplinary action in cases of habitual non-compliance.

## 3.2 Attendance Timing

- **General Attendance Requirements:** All faculty members are required to post their geotag attendance in their respective Attendance Channel within the office premises at the official office hours, as per the schedule shared by the HR department. A grace period of 2 minutes will be allowed. Any attendance marked beyond this will be considered late.

- **Late Arrival Procedure:** If an employee is unable to post their attendance at office time, they must submit a separate attendance post with a valid reason explaining the delay.

**Late Arrivals Policy:**
- **4th instance** \u2013 Half-day pay cut
- **5th instance** \u2013 Full-day pay cut
- **6th instance and onwards** \u2013 2 days\u2019 pay cut

**Additional Rules & Penalties:**
- If any employee forgets to upload attendance (Clock-in and Clock-out), a **fine of Rs. 500** will be charged.
- A photo must be uploaded on Slack within **30 minutes of Clock-in**. Failure more than 2 instances in a month without proper reason will result in a **fine of Rs. 100** for each instance thereafter.
- Clock-in and Clock-out photos must be taken inside the college premises.

## 3.3 Office Premises and Hours

- All employees have to be present within the office premises during working hours, unless permission for an exception is granted.
- Employees are allowed to leave the premises **only** during the designated lunch break.
- If Employees are going out during lunch break, they need to mention: **"Going for Lunch"** and **"Returned to college after Lunch"** in the attendance channel thread.

## 3.4 Office Work and Conduct

- During office hours, employees must remain focused on official tasks, such as preparing lecture notes, assignments, or any other work-related duties.
- Employees should refrain from engaging in any personal or non-work-related activities within the office premises.
- Faculty members must maintain professional boundaries with students.

## 3.5 Professionalism with College Administration

- Employees must maintain professionalism when interacting with the college administration.
- Employees are prohibited from spreading negativity about the organization.
- Any instances of office politics or rumours must be reported directly to HR.

## 3.6 Availability during Office Hours

- During office hours, all faculty members must be available for communication via phone calls, Slack and emails.
- If unable to join a scheduled Google Meet, inform **at least 10 minutes in advance** in their respective college channel on Slack by tagging the reporting manager and HR.
- If absent in the meeting without informing, **disciplinary action will be taken**.

## 3.7 Leave Policy for SDE & Professor & HoI\u2019s

- **Total 12 Paid Leave** provided in **1 Year** that starts from date of joining.
- They can avail **1 Paid Leave in 1 Month**. More than 1 Leave will be considered as Un-Paid Leave.

**1. Casual Leave:** The employee must obtain permission from the HoI at least 18 hours in advance. After receiving approval, send email to HR (hr@geeksofgurukul.com) with CC to HoI, Academic Lead, CTO, COO before 6pm.

**2. Emergency Leave:** In case of emergency, inform reporting manager via call first. After recovering, send emergency leave email to HR with valid proof. If proof not provided, leave will be unpaid and fine of Rs. 500 applicable.

**3. College Employee Leave Criteria:** Only one professor from each college shall be permitted to take leave on the same day. Unauthorized leave = two-days unpaid leave for every one day.

## 3.8 Leave Policy for Operation Manager & Associate

- **Total 12 Paid Leave** provided in **1 Year** that starts from date of joining.
- They can avail **1 Paid Leave in 1 Month**. More than 1 Leave = Un-Paid Leave.

**1. Casual Leave:** Submit application via mail to HoI at least 24 hours in advance. After HOI approval, email HR with CC HoI, CTO, COO before 6pm.

**2. Emergency Leave:** Send leave request via email to HR with CC to HoI, CTO, COO. After emergency, reply in same email thread with valid proof.

## 3.9 Work from Home (WFH) Policy for Operation Manager & Associate

- OM may be permitted to work from home in case of emergencies with evidence.
- HoI will assign specific tasks; if not completed, day will be marked as leave.
- All tasks must be submitted by 9:00 PM on the day of WFH.
- Each employee is required to attend at least one Ops meeting during WFH.
- Must inform HR and Reporting Manager at least 15 hours before (before 6:00 PM previous day).
- OMs who WFH will receive **half-day pay**.

## 3.10 General Mandatory Protocols for OM/Interns

1. **Meeting Communication:** Inform HoI at least 10 minutes in advance via call or Slack if unable to join scheduled Ops meeting.
2. **Minutes of Meeting (MoM):** Mandatory to mention presence/absence of OM in MoM.
3. **Dashboard Updates:** Every OM must regularly and accurately update their respective dashboard channel.

## 3.11 Prohibition of Smoking and Chewing Tobacco

Smoking and the use of chewing tobacco are strictly prohibited within the office premises. Violation will result in disciplinary action, including possible suspension.

## 3.12 Harassment-Free Workplace

- **Zero Tolerance for Harassment:** All employees must maintain a respectful, harassment-free work environment.
- Employees must immediately report any harassment incidents to HR.
- Employees found guilty will face strict disciplinary actions, including suspension or termination.

## 3.13 Probation & Notice Period

- All new employees will be on a **6-month probation period**. Notice period will be either 7 days or 30 days.
- **Full and Final (FNF) Settlement:** Completed within a maximum of 45 calendar days from last working day. Disbursement between the 15th and 20th of the following month.

## 3.14 Performance-Based Termination Policy for SDEs & Professors

- If student rating below 4.2 for three consecutive weeks \u2192 three formal warnings.
- If no improvement \u2192 may be terminated with a 7-day notice period.
- Decision jointly taken by HoI and HR.

## 4. Responsibility

- **Employees:** Follow all policies outlined in this SOP.
- **HR Department:** Enforce this SOP, handle disciplinary actions.
- **Reporting Managers:** Ensure all employees adhere to the SOP.

## 5. Review and Revision

This SOP will be reviewed quarterly by the HR department and the administration.

## 6. Effective Date

This SOP will be effective as of: **1st April 2025**

---

*Approved by: **Ajay Katana**, Co-Founder & CTO, Geeks of Gurukul*`;

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
const _a = (id: string, eid: string, day: string, ci: string, co: string, loc: string, fl: any): AttendanceRecord => ({ id, employeeId: eid, date: `2026-02-${day}`, clockIn: ci, clockOut: co, location: loc, status: "Present", flags: fl, isApprovedByHR: true });
const INITIAL_ATTENDANCE: AttendanceRecord[] = [
    // FAC001 - Anil Kumar (SAGE Bhopal) — has late, earlyOut, dressCode flags
    ...FEB26_WORKING.map((d, i) => _a(`a1_${i}`, "FAC001", d,
        ["10", "17"].includes(d) ? "10:20" : "09:05",
        ["06", "20"].includes(d) ? "16:00" : "18:10",
        "SAGE Bhopal", {
        late: ["10", "17"].includes(d),
        earlyOut: ["06", "20"].includes(d),
        dressCode: d === "12",
        misconduct: d === "25",
    })),
    // FAC002 - Meera Das (SAGE Indore, Wed WFH) — has performance, meetingAbsent
    ...FEB26_WORKING.filter(d => d !== "11").map((d, i) => _a(`a2_${i}`, "FAC002", d,
        d === "16" ? "10:45" : "09:00",
        d === "19" ? "16:30" : "18:00",
        ["04", "11", "18", "25"].includes(d) ? "WFH" : "SAGE Indore", {
        late: d === "16",
        earlyOut: d === "19",
        performance: d === "23",
        meetingAbsent: d === "09",
    })),
    // FAC003 - Priya Singh (Barkatullah, Fri WFH) — has misconduct, locationDiff
    ...FEB26_WORKING.filter(d => d !== "17").map((d, i) => _a(`a3_${i}`, "FAC003", d,
        d === "03" ? "10:30" : "09:00",
        d === "24" ? "15:30" : "17:10",
        ["06", "13", "20", "27"].includes(d) ? "WFH" : "BU Bhopal", {
        late: d === "03",
        earlyOut: d === "24",
        locationDiff: d === "10",
        misconduct: d === "18",
    })),
    // FAC004 - Rahul Das — has dressCode, performance, meetingAbsent
    ...FEB26_WORKING.filter(d => !["14", "21"].includes(d)).map((d, i) => _a(`a4_${i}`, "FAC004", d,
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
    ...FEB26_WORKING.map((d, i) => _a(`a5_${i}`, "FAC005", d,
        ["04", "18"].includes(d) ? "10:40" : "08:55",
        d === "13" ? "15:45" : "18:05",
        "SAGE Indore", {
        late: ["04", "18"].includes(d),
        earlyOut: d === "13",
        misconduct: d === "27",
    })),
    // FAC006 - Vikram Deshmukh — has dressCode, meetingAbsent
    ...FEB26_WORKING.filter(d => d !== "07").map((d, i) => _a(`a6_${i}`, "FAC006", d,
        d === "23" ? "10:10" : "09:00",
        "18:00", "Centurion", {
        late: d === "23",
        dressCode: d === "11",
        meetingAbsent: d === "20",
    })),
    // OM001 - Arjun Sharma (Centurion, Sat WFH) — has late, performance
    ...FEB26_WORKING.map((d, i) => _a(`a7_${i}`, "OM001", d,
        d === "02" ? "10:00" : "09:30",
        d === "27" ? "16:30" : "18:30",
        ["07", "14", "21", "28"].includes(d) ? "WFH" : "Centurion", {
        late: d === "02",
        earlyOut: d === "27",
        performance: d === "16",
    })),
    // OM002 - Kavitha Nair (Scope Global) — has dressCode, late
    ...FEB26_WORKING.map((d, i) => _a(`a8_${i}`, "OM002", d,
        ["06", "19"].includes(d) ? "10:25" : "09:00",
        d === "12" ? "16:15" : "18:00",
        "Scope Global", {
        late: ["06", "19"].includes(d),
        earlyOut: d === "12",
        dressCode: d === "24",
    })),
    // OM003 - Amit Patel — has meetingAbsent, locationDiff
    ...FEB26_WORKING.filter(d => d !== "28").map((d, i) => _a(`a9_${i}`, "OM003", d,
        d === "10" ? "10:35" : "09:05",
        "18:00", "SAGE Bhopal", {
        late: d === "10",
        meetingAbsent: d === "17",
        locationDiff: d === "05",
    })),
    // HOI001 - Ayush Chauhan — has late
    ...FEB26_WORKING.map((d, i) => _a(`a10_${i}`, "HOI001", d,
        d === "11" ? "10:00" : "09:00",
        "19:00", "SAGE Bhopal", {
        late: d === "11",
    })),
    // HOI002 - Sachin Kumar — has earlyOut
    ...FEB26_WORKING.map((d, i) => _a(`a11_${i}`, "HOI002", d,
        "09:00",
        d === "20" ? "15:00" : "18:30",
        "SAGE Indore", {
        earlyOut: d === "20",
    })),
    // HOI003 - Sidhartha Paikaray — clean month
    ...FEB26_WORKING.map((d, i) => _a(`a12_${i}`, "HOI003", d, "09:00", "18:30", "Centurion", {})),
    // HR001 - Vivek Yadav — has late
    ...FEB26_WORKING.map((d, i) => _a(`a13_${i}`, "HR001", d,
        d === "09" ? "10:15" : "09:00", "18:00", "SAGE Bhopal", { late: d === "09" })),
    // AD001 - Raj Kumar Sahoo — clean
    ...FEB26_WORKING.map((d, i) => _a(`a14_${i}`, "AD001", d, "08:50", "19:00", "SAGE Bhopal", {})),
    // TL001 - Nitesh — has dressCode, performance
    ...FEB26_WORKING.map((d, i) => _a(`a15_${i}`, "TL001", d,
        d === "13" ? "10:20" : "09:00", "18:00", "SAGE Bhopal", {
        late: d === "13",
        dressCode: d === "21",
        performance: d === "26",
    })),
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
    { id: "hol2", name: "Holi", date: "2026-03-10", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true, customMessage: "Happy Holi! Office remains closed. Enjoy the festival of colors!" },
    { id: "hol3", name: "Holi (Dhuleti)", date: "2026-03-14", status: "Approved", proposedBy: "HR001", proposedByName: "Vivek Yadav", forAll: true },
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
    { employeeId: "FAC003", stars: 3, rating: 4.2, badges: ["On Time", "Good Dress Code"] },
    { employeeId: "OM001", stars: 5, rating: 4.8, badges: ["On Time", "Good Dress Code", "0 Flags", "Additional Responsibilities"] },
    { employeeId: "OM002", stars: 3, rating: 3.9, badges: ["Good Dress Code"] },
    { employeeId: "FAC005", stars: 4, rating: 4.3, badges: ["On Time", "0 Flags"] },
    { employeeId: "FAC002", stars: 2, rating: 3.5, badges: [] },
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

const INITIAL_RESPONSIBILITIES: AdditionalResponsibility[] = [
    { id: "ar1", employeeId: "OM001", employeeName: "Arjun Sharma", addedBy: "HOI003", description: "Coordinating inter-department tech workshops", date: "2024-02-20", status: "Approved", points: 15 },
];

const INITIAL_NOTIFICATIONS: PortalNotification[] = [];

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
    approveLeave: (id: string) => void;
    rejectLeave: (id: string, applyLOP?: boolean) => void;
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
    reportMisbehaviour: (employeeId: string, type: MisbehaviourReport["type"], description: string) => void;
    addRating: (employeeId: string, ratedBy: string, score: number, period: string, comment?: string) => void;
    assignWorkSchedule: (schedule: WorkSchedule) => void;
    approveWorkSchedule: (employeeId: string) => void;
    addCollege: (college: Omit<College, "id">) => void;
    updateCollege: (id: string, updates: Partial<College>) => void;
    addAdditionalResponsibility: (employeeId: string, description: string, points: number) => void;
    approveAdditionalResponsibility: (id: string, status: "Approved" | "Rejected") => void;
    addMarkAsPresentRequest: (req: Omit<MarkAsPresentRequest, "id" | "status" | "appliedAt" | "employeeName">) => void;
    resolveMarkAsPresentRequest: (id: string, status: "Approved" | "Rejected") => void;
    resolveDressCodeCheck: (recordId: string, status: "Approved" | "Rejected") => void;
    restoreAttendanceCredits: (employeeId: string) => void;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── PROVIDER ───
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
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
    const [orgHierarchy] = useState<OrgNode[]>(INITIAL_HIERARCHY);
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
    const DATA_VERSION = "v2_rbac";
    useEffect(() => {
        const s = (k: string) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
        // Check data version — if old data exists, clear it to load new RBAC employee IDs
        const storedVersion = localStorage.getItem("gog_data_version");
        if (storedVersion !== DATA_VERSION) {
            // Clear all old data keys to force fresh load
            const keysToRemove = ["gog_user", "gog_employees", "gog_leaves", "gog_meetings", "gog_notices", "gog_payroll", "gog_sops", "gog_attendance", "gog_tickets", "gog_holidays", "gog_pip", "gog_schedules", "gog_stars", "gog_moms", "gog_reimbursements", "gog_ratings", "gog_misbehaviours", "gog_responsibilities", "gog_notifications", "gog_mark_present", "gog_hierarchy"];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            localStorage.setItem("gog_data_version", DATA_VERSION);
            return; // Use initial data from the constants
        }
        const su = s("gog_user"); if (su) setUser(su);
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

    // ─── HELPERS ───
    const uid = () => Math.random().toString(36).substr(2, 8).toUpperCase();
    const getReportees = (managerId: string) => employees.filter(e => e.reportsTo === managerId);
    const getManagerChain = (employeeId: string): Employee[] => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp || !emp.reportsTo) return [];
        const mgr = employees.find(e => e.id === emp.reportsTo);
        if (!mgr) return [];
        return [mgr, ...getManagerChain(mgr.id)];
    };

    // ─── AUTH ───
    const login = (email: string, password?: string, role?: string) => {
        const emp = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
        if (!emp) return { success: false, msg: "Institutional account not found." };
        if (password && emp.password !== password) return { success: false, msg: "Incorrect passkey." };
        if (role && emp.role !== role) return { success: false, msg: "Institutional role mismatch." };

        setUser(emp);
        router.push("/");
        return { success: true };
    };
    const logout = () => { setUser(null); localStorage.removeItem("gog_user"); router.push("/login"); };
    const updateOnboarding = (userId: string, data: any) => {
        setEmployees(prev => prev.map(e => e.id === userId ? { ...e, ...data, isOnboarded: true } : e));
        if (user?.id === userId) setUser(prev => prev ? { ...prev, ...data, isOnboarded: true } : null);
    };
    const addEmployee = (emp: Omit<Employee, "id" | "isOnboarded">) => {
        setEmployees(prev => [...prev, { ...emp, id: `EMP${uid()}`, isOnboarded: false }]);
    };

    // ─── NOTICES ───
    const addNotice = (notice: Omit<Notice, "id" | "createdBy" | "createdAt">) => {
        if (!user) return;
        const newNotice: Notice = { ...notice, id: `N${uid()}`, createdBy: user.name, createdAt: new Date().toISOString().split("T")[0], readBy: [] };
        setNotices(prev => [newNotice, ...prev]);
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
    const clockIn = (location: string, time: string, dressCodeImageUrl?: string) => {
        if (!user) return;
        const today = new Date().toISOString().split("T")[0];
        setAttendanceRecords(prev => [...prev, {
            id: `ATT${uid()}`, employeeId: user.id, date: today, clockIn: time, location,
            status: "Present", flags: { late: parseInt(time.split(":")[0]) >= 10, locationDiff: location !== "Main Office" },
            isApprovedByHR: false, dressCodeImageUrl,
            dressCodeStatus: dressCodeImageUrl ? "Pending" : "N/A"
        }]);
    };
    const clockOut = (time: string) => {
        if (!user) return;
        const today = new Date().toISOString().split("T")[0];
        setAttendanceRecords(prev => prev.map(r =>
            r.employeeId === user.id && r.date === today ? { ...r, clockOut: time, flags: { ...r.flags, earlyOut: parseInt(time.split(":")[0]) < 18 } } : r
        ));
    };
    const markAttendanceOverride = (employeeId: string, date: string, reason: string) => {
        setAttendanceRecords(prev => {
            const existing = prev.find(r => r.employeeId === employeeId && r.date === date);
            if (existing) return prev.map(r => r.id === existing.id ? { ...r, status: "Present", isApprovedByHR: true } : r);
            return [...prev, { id: `ATT${uid()}`, employeeId, date, clockIn: "09:00", location: "Override", status: "Present" as any, flags: {}, isApprovedByHR: true }];
        });
    };

    const addMarkAsPresentRequest = (req: Omit<MarkAsPresentRequest, "id" | "status" | "appliedAt" | "employeeName">) => {
        if (!user) return;
        setMarkAsPresentRequests(prev => [{ ...req, id: `MAP${uid()}`, employeeName: user.name, status: "Pending", appliedAt: new Date().toISOString() }, ...prev]);
        setAttendanceRecords(prev => [...prev, { id: `ATT${uid()}`, employeeId: user.id, date: req.date, clockIn: "-", location: "Appealed", status: "Mark As Present Request" as any, flags: {}, isApprovedByHR: false }]);
    };

    const resolveMarkAsPresentRequest = (id: string, status: "Approved" | "Rejected") => {
        setMarkAsPresentRequests(prev => {
            const req = prev.find(r => r.id === id);
            if (req && status === "Approved") {
                markAttendanceOverride(req.employeeId, req.date, req.reason);
                setEmployees(emps => emps.map(e => e.id === req.employeeId ? { ...e, markPresentUsed: (e.markPresentUsed || 0) + 1 } : e));
            }
            return prev.map(r => r.id === id ? { ...r, status } : r);
        });
    };

    const resolveDressCodeCheck = (recordId: string, status: "Approved" | "Rejected") => {
        setAttendanceRecords(prev => {
            const record = prev.find(r => r.id === recordId);
            if (record && status === "Rejected") {
                setEmployees(emps => emps.map(e => e.id === record.employeeId ? { ...e, dressCodeDefaults: (e.dressCodeDefaults || 0) + 1 } : e));
            }
            return prev.map(r => r.id === recordId ? { ...r, dressCodeStatus: status, flags: { ...r.flags, dressCode: status === "Rejected" } } : r);
        });
    };

    const restoreAttendanceCredits = (employeeId: string) => {
        setEmployees(emps => emps.map(e => e.id === employeeId ? { ...e, markPresentUsed: Math.max(0, (e.markPresentUsed || 0) - 1), dressCodeDefaults: Math.max(0, (e.dressCodeDefaults || 0) - 1) } : e));
        setAttendanceRecords(prev => prev.map(r => r.employeeId === employeeId ? { ...r, flags: { ...r.flags, late: false, earlyOut: false, locationDiff: false, dressCode: false } } : r));
    };

    // ─── LEAVES ───
    const addLeaveRequest = (req: Omit<LeaveRequest, "id" | "status" | "employeeId" | "employeeName">) => {
        if (!user) return;
        const now = new Date();
        const appliedAt = now.toISOString();

        setLeaves(prev => [{
            ...req,
            id: `LV${uid()}`,
            status: "Pending",
            employeeId: user.id,
            employeeName: user.name,
            lossOfPayDays: 0,
            appliedAt
        }, ...prev]);
    };
    const approveLeave = (id: string) => setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: "Approved" } : l));
    const rejectLeave = (id: string, applyLOP: boolean = false) => setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: "Rejected", lossOfPayDays: applyLOP ? 2 : (l.lossOfPayDays || 0) } : l));

    // ─── TICKETS ───
    const raiseTicket = (targetCategory: string, subject: string, content: string, routeTo?: string, cc?: string[], proofUrls?: string[], targetEmployeeId?: string, targetDate?: string) => {
        if (!user) return;

        let finalRouteTo = routeTo;
        let finalCC = cc || [];

        // Automatic routing and CC logic based on Req.md
        const managerChain = getManagerChain(user.id);
        const empRecord = employees.find(e => e.id === user.id);
        const rm = empRecord?.reportsTo;
        const founders = employees.filter(e => e.role === "FOUNDER").map(f => f.id);
        const hr = employees.filter(e => e.role === "HR").map(h => h.id);

        if (targetCategory === "HR Desk" || targetCategory === "Attendance Override Request") {
            finalRouteTo = hr[0] || "HR001";
            finalCC = [...new Set([...finalCC, ...founders])];
        } else if (targetCategory === "Misconduct" || targetCategory === "Academic") {
            finalRouteTo = rm || hr[0];
            // CC all above RM + HR
            const aboveRM = managerChain.slice(1).map(m => m.id);
            finalCC = [...new Set([...finalCC, ...aboveRM, ...hr])];
        } else if (targetCategory === "Technical") {
            const tl = employees.find(e => e.role === "TL")?.id;
            finalRouteTo = tl || rm;
            finalCC = [...new Set([...finalCC, rm || "", ...managerChain.slice(1).map(m => m.id), ...hr].filter(Boolean))];
        }

        setTickets(prev => [{
            id: `TKT${uid()}`,
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
        }, ...prev]);
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
                        markAttendanceOverride(targetEmpId, targetDate, `Approved via Ticket ${id}`);

                        // Reverse PIP warnings if any
                        setPipRecords(pips => pips.map(p =>
                            p.employeeId === targetEmpId && p.status === "Active"
                                ? { ...p, warnings: Math.max(0, p.warnings - 1) }
                                : p
                        ));
                    }
                }
            }
            return prev.map(t => t.id === id ? { ...t, status: "Resolved", resolvedAt: new Date().toISOString(), resolutionNotes: notes } : t);
        });
    };

    // ─── REIMBURSEMENTS ───
    const addReimbursement = (claim: Omit<ReimbursementClaim, "id" | "status" | "date" | "employeeId" | "employeeName">) => {
        if (!user) return;
        setReimbursements(prev => [{ ...claim, id: `RMB${uid()}`, employeeId: user.id, employeeName: user.name, status: "Pending", date: new Date().toISOString().split("T")[0] }, ...prev]);
    };
    const updateReimbursementStatus = (id: string, status: ReimbursementClaim["status"], reason?: string, remarks?: string) => {
        setReimbursements(prev => prev.map(r => r.id === id ? { ...r, status, rejectionReason: reason || r.rejectionReason, hrRemarks: remarks || r.hrRemarks } : r));
    };

    // ─── HOLIDAYS ───
    const proposeHoliday = (h: Omit<Holiday, "id" | "proposedBy" | "status" | "proposedByName">) => {
        if (!user) return;
        setHolidays(prev => [...prev, { ...h, id: `HOL${uid()}`, proposedBy: user.id, proposedByName: user.name, status: "Proposed" }]);
    };
    const approveHoliday = (id: string, customMessage?: string) => {
        setHolidays(prev => prev.map(h => h.id === id ? { ...h, status: "Approved" as const, customMessage: customMessage || h.customMessage } : h));
        // Auto-announce
        const hol = holidays.find(h => h.id === id);
        if (hol) {
            const msg = customMessage || `${hol.name} on ${hol.date} has been approved as an official holiday.`;
            setNotices(prev => [{ id: `N${uid()}`, title: `Holiday: ${hol.name}`, content: msg, category: "General" as const, createdBy: user?.name || "HR", createdAt: new Date().toISOString().split("T")[0] }, ...prev]);
        }
    };

    // ─── SOP ───
    const updateSOP = (sop: Omit<SOP, "id" | "lastUpdated">) => {
        if (!user) return;
        const existing = sops.find(s => s.title === sop.title);
        const newId = existing ? existing.id : `SOP${uid()}`;
        const updatedSop: SOP = {
            ...sop,
            id: newId,
            lastUpdated: new Date().toISOString().split("T")[0],
            previousContent: existing?.content,
            changeType: existing ? "updated" as const : "new" as const,
        };
        setSops(prev => existing ? prev.map(s => s.id === newId ? updatedSop : s) : [updatedSop, ...prev]);
        const notif: SOPNotification = {
            id: `sopn${uid()}`, sopId: newId, title: sop.title,
            changeType: existing ? "updated" : "new",
            changedBy: user.name, changedAt: new Date().toISOString().split("T")[0], readBy: [],
        };
        setSopNotifications(prev => [notif, ...prev]);
        // Inter-portal communication via localStorage
        try { localStorage.setItem("sop_update", JSON.stringify({ ...notif, ts: Date.now() })); } catch { }
    };

    const deleteSOP = (id: string) => {
        if (!user) return;
        const sop = sops.find(s => s.id === id);
        if (!sop) return;
        setSops(prev => prev.filter(s => s.id !== id));
        const notif: SOPNotification = {
            id: `sopn${uid()}`, sopId: id, title: sop.title,
            changeType: "deleted", changedBy: user.name,
            changedAt: new Date().toISOString().split("T")[0], readBy: [],
        };
        setSopNotifications(prev => [notif, ...prev]);
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
            id: `sopn${uid()}`, sopId: "master", title: "Full SOP Document",
            changeType: "updated", changedBy: user.name,
            changedAt: new Date().toISOString().split("T")[0], readBy: [],
            changelog: changelog || "SOP document updated",
            previousContent: oldContent.slice(0, 800),
            newContent: content.slice(0, 800),
        };
        setSopNotifications(prev => [notif, ...prev]);
        try {
            localStorage.setItem("sop_update", JSON.stringify({ ...notif, ts: Date.now() }));
            localStorage.setItem("master_sop_content", content);
        } catch { }
    };

    // ─── PIP ───
    const addToPIP = (employeeId: string, reason: string) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;
        setPipRecords(prev => [...prev, { id: `PIP${uid()}`, employeeId, employeeName: emp.name, reason, startDate: new Date().toISOString().split("T")[0], status: "Active", warnings: 0, disclaimer: "You are currently under Performance Improvement Plan." }]);
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
                    setTimeout(() => addToPIP(employeeId, `Automated PIP: Chances exhausted. Last reason: ${reason}`), 0);
                }
                return { ...e, chancesRemaining: newChances };
            }
            return e;
        }));
    };

    const resetChances = (employeeId: string) => {
        setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, chancesRemaining: 3 } : e));
    };

    // ─── MISBEHAVIOUR ───
    const reportMisbehaviour = (employeeId: string, type: MisbehaviourReport["type"], description: string) => {
        if (!user) return;
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;
        const chain = getManagerChain(employeeId);
        const ccList = [...chain.map(c => c.id), "HR001"];
        // Build propagation chain: HOI → AD → HR
        const propagationChain: { level: string; name: string; notified: boolean }[] = [];
        const hoi = chain.find(c => c.managerLevel === "HOI");
        const ad = chain.find(c => c.managerLevel === "AD");
        const hr = employees.find(e => e.role === "HR");
        if (hoi) propagationChain.push({ level: "HOI", name: hoi.name, notified: true });
        if (ad) propagationChain.push({ level: "AD", name: ad.name, notified: true });
        if (hr) propagationChain.push({ level: "HR", name: hr.name, notified: true });
        setMisbehaviourReports(prev => [...prev, { id: `MB${uid()}`, reportedBy: user.id, reportedByName: user.name, employeeId, employeeName: emp.name, type, description, date: new Date().toISOString().split("T")[0], ccList, propagationChain }]);
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
            id: `RT${uid()}`,
            employeeId,
            employeeName: emp.name,
            ratedBy: user.id,
            ratedByName: user.name,
            score,
            period,
            comment,
            date: new Date().toISOString().split("T")[0]
        };

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
    };
    const approveWorkSchedule = (employeeId: string) => {
        setWorkSchedules(prev => prev.map(s => s.employeeId === employeeId ? { ...s, approvedByHR: true } : s));
    };

    // ─── COLLEGES ───
    const addCollege = (college: Omit<College, "id">) => {
        const id = college.shortName.toLowerCase().replace(/\s+/g, "-");
        setColleges(prev => [...prev, { ...college, id }]);
    };
    const updateCollege = (id: string, updates: Partial<College>) => {
        setColleges(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    // ─── ADDITIONAL RESPONSIBILITIES ───
    const addAdditionalResponsibility = (employeeId: string, description: string, points: number) => {
        if (!user) return;
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;
        setAdditionalResponsibilities(prev => [...prev, {
            id: `AR${uid()}`,
            employeeId,
            employeeName: emp.name,
            addedBy: user.id,
            description,
            date: new Date().toISOString().split("T")[0],
            status: "Pending",
            points
        }]);
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
            id: `MTG${uid()}`,
            status: "Pending",
            employeeId: user.id,
            employeeName: user.name,
            createdAt: new Date().toISOString()
        };
        setMeetings(prev => [newMeeting, ...prev]);

        // Notify attendees
        req.attendees?.forEach(att => {
            addNotification(att.id, att.name, `New meeting scheduled: ${req.purpose}`, "ticket");
        });

        // Notify management chain
        const chain = getManagerChain(user.id);
        chain.forEach(mgr => {
            addNotification(mgr.id, mgr.name, `${user.name} scheduled a meeting: ${req.purpose}`, "ticket");
        });
    };

    const updateMeetingStatus = (id: string, status: MeetingRequest["status"], MOMData?: { screenshotUrls: string[], attendees: MeetingRequest["attendees"] }) => {
        setMeetings(prev => prev.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, status, ...MOMData };

            if (status === "Completed" && MOMData) {
                // When completed, notify the management chain of the reporter
                const chain = getManagerChain(m.employeeId);
                chain.forEach(mgr => {
                    addNotification(mgr.id, mgr.name, `Meeting MOM Uploaded: ${m.purpose}`, "ticket");
                });

                // Also notify HR and Founders
                const hrAndFounders = employees.filter(e => e.role === "HR" || e.role === "FOUNDER");
                hrAndFounders.forEach(ef => {
                    addNotification(ef.id, ef.name, `Meeting MOM Uploaded: ${m.purpose}`, "ticket");
                });
            }

            return updated;
        }));
    };

    // ─── PAYROLL ───
    const generatePayroll = (month: string, year: string) => {
        const newRecords: PayrollRecord[] = employees.map(emp => {
            const basic = emp.salary / 12; const tax = basic * 0.1; const pf = basic * 0.12;
            return { id: `PR${uid()}`, employeeId: emp.id, month, year, amount: basic, deductions: { tax, pf, other: 0 }, reimbursements: 0, generatedAt: new Date().toISOString().split("T")[0] };
        });
        setPayrollRecords(prev => [...newRecords, ...prev]);
    };

    // ─── LEGACY METHODS ───
    const addJobPosting = (job: Omit<JobPosting, "id" | "postedBy" | "postedAt" | "status">) => { if (!user) return; setJobPostings(prev => [{ ...job, id: `JP${uid()}`, postedBy: user.name, postedAt: new Date().toISOString().split("T")[0], status: "Active" }, ...prev]); };
    const closeJobPosting = (id: string) => setJobPostings(prev => prev.map(j => j.id === id ? { ...j, status: "Closed" as const } : j));
    const generateCertificate = (employeeId: string, type: string, description: string) => { if (!user) return; const emp = employees.find(e => e.id === employeeId); setCertificates(prev => [...prev, { id: `CERT${uid()}`, employeeId, employeeName: emp?.name || "", type, description, issuedAt: new Date().toISOString().split("T")[0], issuedBy: user.name }]); };
    const submitResignation = (reason: string, lastWorkingDate: string) => { if (!user) return; setResignationRequests(prev => [...prev, { id: `RES${uid()}`, employeeId: user.id, employeeName: user.name, reason, lastWorkingDate, status: "Pending", appliedAt: new Date().toISOString().split("T")[0], noticePeriod: 30 }]); };
    const approveResignation = (id: string) => setResignationRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Approved" as const } : r));
    const requestAsset = (assetType: string, reason: string) => { if (!user) return; setAssetRequests(prev => [...prev, { id: `AR${uid()}`, employeeId: user.id, employeeName: user.name, assetType, reason, status: "Pending", requestedAt: new Date().toISOString().split("T")[0] }]); };
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
        setNotifications(prev => [{ id: `NTF${uid()}`, from: user.id, fromName: user.name, to, toName, message, type, read: false, createdAt: new Date().toISOString() }, ...prev]);
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
            reportMisbehaviour, addRating, assignWorkSchedule, approveWorkSchedule, addCollege, updateCollege,
            addAdditionalResponsibility, approveAdditionalResponsibility, addMeetingRequest, updateMeetingStatus,
            getReportees, getManagerChain, generatePayroll, addEmployee, updateOnboarding,
            removeFromPIP, deductChance, resetChances,
            addJobPosting, closeJobPosting, generateCertificate, submitResignation, approveResignation,
            requestAsset, assignAsset, updateAssetRequestStatus,
            addNotification, markNotificationRead, getMyNotifications,
            markAsPresentRequests, addMarkAsPresentRequest, resolveMarkAsPresentRequest, resolveDressCodeCheck, restoreAttendanceCredits
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
