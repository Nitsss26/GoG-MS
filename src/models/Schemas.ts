import mongoose, { Schema } from 'mongoose';

// Notice Schema - defined early to avoid ReferenceError
const NoticeSchema = new Schema({
    id: { type: String, unique: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: String, required: true },
    readBy: [String],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: String },
    imageUrls: [String]
});

// Employee Schema
const EmployeeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    photoUrl: { type: String },
    isOnboarded: { type: Boolean, default: false },
    dept: { type: String },
    designation: { type: String },
    status: { type: String, default: "Active" },
    joiningDate: { type: String },
    salary: { type: Number },
    location: { type: String }, // Refers to Location id
    dateOfBirth: { type: String },
    phone: { type: String },
    gender: { type: String },
    bloodGroup: { type: String },
    reportsTo: { type: [String] }, // Array of manager IDs
    managerLevel: { type: String },
    chancesRemaining: { type: Number, default: 3 }, // MAP Credits
    fines: {
        total: { type: Number, default: 0 },
        records: [{
            amount: { type: Number },
            reason: { type: String },
            date: { type: String }
        }]
    },
    biWeeklyScores: [{
        score: { type: Number },
        period: { type: String },
        date: { type: String },
        points: { type: Number }
    }],
    education: [{
        degree: String,
        institution: String,
        yearOfPassing: String,
        percentage: String
    }],
    experience: [{
        company: String,
        role: String,
        duration: String,
        lastSalary: Number
    }],
    panNumber: String,
    aadhaarNumber: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    password: { type: String, default: "26082001" },
    
    // --- ONBOARDING FIELDS ---
    full_name: String,
    phone_no_: String,
    father_name_or_mother_name: String,
    parents_phone_no_: String,
    permanent_address: String,
    bachelor_s_qualification: String,
    master_s_qualification: String,
    you_are_from_: { type: String, enum: ["IIT", "NIT", "Other College"] },
    current_designation_at_gog: String,
    upload_your_resume: String,
    upload_your_bachelor_s_passing_certificate: String,
    upload_your_master_s_passing_certificate: String,
    linkedin_id: String,
    upi_id: String,
    ten_marksheet: String, // 10th
    twelve_marksheet: String, // 12th
    aadhar_card: String,
    pan_card: String,
    passport_size_photo: String,
    bank_passbook_cancelled_cheque: String,
    experience_letter: String,
    which_college_are_you_from_: String,
    t_shirt_size: String,
    bachelor_marksheet_all: String,
    master_marksheet_all: String,
    
    // --- HR VERIFICATION ---
    onboardingStatus: { type: String, default: "Pending Creation", enum: ["Pending Creation", "Form Pending", "Verification Pending", "Approved"] },
    onboardingChecklist: {
        aadharCheck: { type: Boolean, default: false },
        qualificationCheck: { type: Boolean, default: false },
        bankDetailsCheck: { type: Boolean, default: false },
        slackOnboarded: { type: Boolean, default: false },
        slackChannelsAdded: { type: Boolean, default: false },
        waGroupsAdded: { type: Boolean, default: false },
        hrMeetingCompleted: { type: Boolean, default: false },
        hrMeetingScreenshot: String,
        managerMeetingCompleted: { type: Boolean, default: false },
        adMeetingCompleted: { type: Boolean, default: false }
    },
    onboardingSubmittedAt: Date,
    onboardingApprovedAt: Date
});

// Attendance Schema
const AttendanceSchema = new Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    clockIn: { type: String }, // Can be empty if on leave
    clockOut: { type: String },
    location: { type: String },
    status: { type: String, required: true, enum: ["Present", "On Leave", "Late", "Absent"] },
    flags: {
        late: { type: Boolean, default: false },
        earlyOut: { type: Boolean, default: false },
        locationDiff: { type: Boolean, default: false },
        misconduct: { type: Boolean, default: false },
        dressCode: { type: Boolean, default: false },
        meetingAbsent: { type: Boolean, default: false },
        performance: { type: Boolean, default: false },
        overridden: { type: Boolean, default: false }
    },
    isApprovedByHR: { type: Boolean, default: false },
    dressCodeImageUrl: { type: String },
    dressCodeStatus: { type: String, default: "Pending", enum: ["Pending", "Approved", "Rejected", "N/A"] },
    mapRequestId: { type: String } // Reference to MarkAsPresentRequest
});

// Work Schedule Schema
const WorkScheduleSchema = new Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true }, // For day-specific locations/times
    location: { type: String, required: true },
    clockInTime: { type: String, default: "09:30" },
    clockOutTime: { type: String, default: "18:30" },
    assignedBy: { type: String },
    status: { type: String, default: "Approved", enum: ["Pending", "Approved", "Rejected"] },
    reason: { type: String }
});

// Mark As Present Request Schema
const MarkAsPresentRequestSchema = new Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    reason: { type: String, required: true },
    requestType: { type: String },
    proofUrls: [String],
    status: { type: String, default: "Pending", enum: ["Pending", "Approved", "Rejected"] },
    approvals: [{
        role: String,
        approverId: String,
        status: String,
        date: String
    }],
    createdAt: { type: String, required: true }
});

// Attendance Override Request Schema
const OverrideRequestSchema = new Schema({
    employeeId: { type: String, required: true }, // Targeted employee
    requestedBy: { type: String, required: true }, // Manager ID
    date: { type: String, required: true },
    reason: { type: String, required: true },
    proofUrls: [String],
    status: { type: String, default: "Pending", enum: ["Pending", "Approved", "Rejected"] },
    approvals: [{
        role: String,
        approverId: String,
        status: String,
        date: String
    }],
    createdAt: { type: String, required: true }
});

// Performance Star Schema
const PerformanceStarSchema = new Schema({
    employeeId: { type: String, required: true },
    stars: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    badges: [String]
});

// Leave Request Schema
const LeaveRequestSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    type: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true },
    status: { type: String, default: "Pending" },
    classification: { type: String, required: true },
    leaveType: { type: String, required: true },
    reason: { type: String },
    proofUrls: [String],
    lossOfPayDays: { type: Number, default: 0 },
    appliedAt: { type: String },
    location: { type: String }, // For filtering at HOI level
    reasonForAction: { type: String }
});

// Ticket Schema
const TicketSchema = new Schema({
    id: { type: String, unique: true },
    raisedBy: { type: String, required: true },
    employeeName: { type: String, required: true },
    targetCategory: { type: String, required: true },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    proofUrls: [String],
    status: { type: String, default: "Open" },
    createdAt: { type: String, required: true },
    resolvedAt: { type: String },
    assignedTo: { type: String },
    cc: [String],
    resolutionNotes: { type: String },
    routeTo: { type: String },
    targetEmployeeId: { type: String },
    targetDate: { type: String }
});

// Reimbursement Schema
const ReimbursementClaimSchema = new Schema({
    id: { type: String, unique: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    monthYear: { type: String },
    description: { type: String },
    proofUrls: [String],
    status: { type: String, default: "Pending" },
    rejectionReason: { type: String },
    hrRemarks: { type: String },
    date: { type: String, required: true }
});
const HolidaySchema = new Schema({
    id: { type: String, unique: true },
    name: { type: String, required: true },
    date: { type: String, required: true },
    collegeIds: [String],
    status: { type: String, default: "Proposed", enum: ["Proposed", "Approved"] },
    proposedBy: { type: String },
    proposedByName: { type: String },
    proofUrl: { type: String },
    customMessage: { type: String },
    forAll: { type: Boolean, default: false }
});

const PIPRecordSchema = new Schema({ id: { type: String, unique: true }, employeeId: String, employeeName: String, reason: String, startDate: String, status: String, warnings: Number, disclaimer: String });
const AdditionalResponsibilitySchema = new Schema({ id: { type: String, unique: true }, employeeId: String, employeeName: String, addedBy: String, description: String, date: String, status: String, points: Number });

// Meeting Request Schema
const MeetingRequestSchema = new Schema({
    id: { type: String, unique: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    targetName: { type: String, required: true },
    purpose: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    googleLink: { type: String },
    agenda: { type: String },
    status: { type: String, default: "Pending" },
    createdAt: { type: String, required: true },
    isFinalized: { type: Boolean, default: false },
    screenshotUrls: [String],
    content: { type: String },
    decision: { type: String },
    attendees: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        joinedAt: { type: String },
        status: { type: String, enum: ['Present', 'Absent', 'Absent (Genuine)', 'Absent (Non-Genuine)'], default: 'Absent' },
        reason: { type: String }
    }]
});


// Sprint Plan Schema — Weekly teaching schedule uploaded by faculty
const SprintPlanSchema = new Schema({
    facultyId: { type: String, required: true },
    facultyName: { type: String, required: true },
    college: { type: String, required: true },
    weekStartDate: { type: String, required: true },
    weekEndDate: { type: String, required: true },
    stream: { type: String },
    year: { type: String },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: String },
    entries: [{
        day: { type: String, required: true },
        date: { type: String, required: true },
        timeStart: { type: String, required: true },
        timeStop: { type: String, required: true },
        stream: { type: String },
        year: { type: String },
        semester: { type: String },
        subjectCode: { type: String },
        subjectName: { type: String, required: true },
        topics: { type: String, required: true }
    }],
    changeRequests: [{
        requestedAt: { type: String },
        reason: { type: String },
        status: { type: String, default: "Pending", enum: ["Pending", "Approved", "Rejected"] },
        approvedBy: { type: String },
        approvedAt: { type: String },
        changes: { type: String }
    }]
}, { timestamps: true });

// Lecture Report Schema — Daily lecture record per session
const LectureReportSchema = new Schema({
    facultyId: { type: String, required: true },
    facultyName: { type: String, required: true },
    date: { type: String, required: true },
    college: { type: String, required: true },
    lectureNumber: { type: Number, required: true },
    sprintPlanId: { type: String },
    courseName: { type: String, required: true },
    topicsCovered: { type: String, required: true },
    scheduledDuration: { type: Number },
    stream: { type: String },
    year: { type: String },
    semester: { type: String },
    classStartTime: { type: String },
    classEndTime: { type: String },
    actualDurationMinutes: { type: Number },
    numberOfAttendees: { type: Number },
    totalStudents: { type: Number },
    classPhotoUrl: { type: String },
    classPhotoLat: { type: Number },
    classPhotoLng: { type: Number },
    issuesFaced: { type: String },
    reasonForLessAttendance: { type: String },
    recordingUrl: { type: String },
    recordingDurationSeconds: { type: Number },
    transcription: { type: String },
    summary: { type: String },
    aiAnalysisAt: { type: String },
    analysis: {
        segmentedReport: [{
            timeSegment: String,
            topic: String,
            score: Number,
            observations: String
        }],
        sentimentAnalysis: String,
        deadAirAlerts: [String],
        complianceCheck: {
            opening: { type: Boolean, default: false },
            engagement: { type: Boolean, default: false },
            accuracy: { type: Boolean, default: false }
        },
        finalScorecard: {
            clarity: { type: Number, default: 0 },
            engagement: { type: Number, default: 0 },
            accuracy: { type: Number, default: 0 },
            totalAuditScore: { type: Number, default: 0 }
        }
    },
    keywords: [{ type: String }],
    status: { type: String, default: "Scheduled", enum: ["Scheduled", "In Progress", "Completed"] },
    warnings: [{ type: String }]
}, { timestamps: true });

// Location Schema for Campus / University Geo-Coordinates
const LocationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusKm: { type: Number, default: 2 },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true }
});

export const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
export const WorkSchedule = mongoose.models.WorkSchedule || mongoose.model('WorkSchedule', WorkScheduleSchema);
export const MarkAsPresentRequest = mongoose.models.MarkAsPresentRequest || mongoose.model('MarkAsPresentRequest', MarkAsPresentRequestSchema);
export const OverrideRequest = mongoose.models.OverrideRequest || mongoose.model('OverrideRequest', OverrideRequestSchema);
export const PerformanceStar = mongoose.models.PerformanceStar || mongoose.model('PerformanceStar', PerformanceStarSchema);
export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
export const Notice = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
export const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
export const ReimbursementClaim = mongoose.models.ReimbursementClaim || mongoose.model('ReimbursementClaim', ReimbursementClaimSchema);
export const PIPRecord = mongoose.models.PIPRecord || mongoose.model('PIPRecord', PIPRecordSchema);
export const AdditionalResponsibility = mongoose.models.AdditionalResponsibility || mongoose.model('AdditionalResponsibility', AdditionalResponsibilitySchema);
export const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema);
export const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema);
export const SprintPlan = mongoose.models.SprintPlan || mongoose.model('SprintPlan', SprintPlanSchema);
export const LectureReport = mongoose.models.LectureReport || mongoose.model('LectureReport', LectureReportSchema);
export const MeetingRequest = mongoose.models.MeetingRequest || mongoose.model('MeetingRequest', MeetingRequestSchema);
