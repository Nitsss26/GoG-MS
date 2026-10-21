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
    imageUrls: [String],
    // Optional scope (older announcements have none and stay visible to everyone)
    collegeIds: [String],
    holidayId: { type: String },
    createdById: { type: String },
    createdByRole: { type: String },
    status: { type: String }
});

// Employee Schema
const EmployeeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    // Not unique on its own: one person may hold several designation records with the same email.
    // Unique per (email, role) among active records — see src/lib/db-startup.ts
    email: { type: String, required: true },
    role: { type: String, required: true },
    // HOI: authorised clock-in / clock-out locations (Location ids) — separate from Original Location (`location`)
    attendanceLocations: [String],
    // Slack workspace invite link entered by HR when onboarding; shown to the joinee before the onboarding form
    slackInviteLink: { type: String, default: "" },
    // Five mandatory post-onboarding activities (created when the onboarding form is submitted)
    postOnboardingChecklist: { type: Schema.Types.Mixed },
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
    monthlyScores: [{
        score: { type: Number },
        period: { type: String },
        date: { type: String },
        points: { type: Number },
        screenshotUrl: { type: String },
        comment: { type: String },
        // who gave it (new submissions) and the update audit (Monthly Feedback → Update Feedback)
        ratedBy: { type: String },
        ratedByName: { type: String },
        updatedAt: { type: String },
        updatedBy: { type: String },
        updatedByName: { type: String },
        updateEmailStatus: { type: String },   // SENT / FAILED / NO_EMAIL
        history: [{ at: String, by: String, byName: String, previous: Schema.Types.Mixed }]
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
    password: { type: String, default: "26082001" }, // plain text, as in the original portal (older scrypt hashes become plain text on the next login)
    passwordChangedAt: String,
    // Last reset done by HR (who and when — never the password itself)
    passwordResetAt: String,
    passwordResetBy: String,
    passwordResetByName: String,
    
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
    // Filled in the onboarding form (were missing here, so they were silently dropped on save)
    bank_account_number: String,
    ifsc_code: String,
    account_holder_name: String,
    date_of_birth: String,
    blood_group: String,
    
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
        adMeetingCompleted: { type: Boolean, default: false },
        accessRoleSetup: { type: Boolean, default: false },
        welcomeMailSent: { type: Boolean, default: false }
    },
    // Who changed each checklist item and when: { aadharCheck: { done, by, byName, at } }
    onboardingChecklistMeta: { type: Schema.Types.Mixed },
    onboardingRemarks: String,
    onboardingApprovedBy: String,
    onboardingApprovedByName: String,
    // Onboarding activity log (written by the server on every onboarding change)
    onboardingActivity: [{
        at: String, by: String, byName: String, role: String, action: String, note: String,
    }],
    onboardingSubmittedAt: Date,
    onboardingApprovedAt: Date,

    // --- REMOVED FROM PORTAL (soft delete: the record is kept for history, all access is gone) ---
    // Other designation records of the same person (same email), linked when HR onboards an extra designation
    linkedEmployeeIds: [String],
    isRemoved: { type: Boolean, default: false },
    removedAt: { type: String },
    removedBy: { type: String },
    removedByName: { type: String },
    removalSnapshot: { type: Schema.Types.Mixed } // location / reportsTo / status at the time of removal
});

// An employee removed from the portal is invisible to every normal query: login, session restore,
// employee lists, HOI / college / team lookups, holiday email targeting, exports, etc.
// A query sees removed records only when it filters on isRemoved itself.
EmployeeSchema.pre(/^find/, function (this: any) {
    const filter = this.getFilter() || {};
    if (!Object.prototype.hasOwnProperty.call(filter, 'isRemoved')) {
        this.where({ isRemoved: { $ne: true } });
    }
});

// Attendance Schema
const AttendanceSchema = new Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    clockIn: { type: String }, // Can be empty if on leave
    clockOut: { type: String },
    clockInAt: { type: Date },             // official server timestamp (UTC) of the clock-in
    clockOutAt: { type: Date },            // official server timestamp (UTC) of the clock-out
    clockOutImageUrl: { type: String },    // optional clock-out photo
    clockOutRegularized: { type: Boolean }, // clock-out set by HR after an approved Missing Clock-Out explanation
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
        overridden: { type: Boolean, default: false },
        shortLeave: { type: Boolean, default: false }
    },
    isApprovedByHR: { type: Boolean, default: false },
    dressCodeImageUrl: { type: String },
    dressCodeStatus: { type: String, default: "Pending", enum: ["Pending", "Approved", "Rejected", "N/A"] },
    mapRequestId: { type: String }, // Reference to MarkAsPresentRequest
    // Dress code audit (server time): when the photo was submitted and who reviewed it, when
    dressCodeSubmittedAt: { type: String },
    dressCodeReviewedAt: { type: String },
    dressCodeReviewedBy: { type: String },
    dressCodeReviewedByName: { type: String },
    dressCodeReviewedByRole: { type: String },
    // Work From Home: attendance marked under an approved WFH application
    workMode: { type: String },            // "WFH" when clocked in under an approved WFH application
    wfhApplicationId: { type: String },
    // How the attendance was recorded: SELF_CLOCK_IN | HR_MANUAL (older records: none)
    attendanceSource: { type: String },
    markedBy: { type: String },
    markedByName: { type: String },
    markedByRole: { type: String },
    markedAt: { type: String },            // server time
    hrRemarks: { type: String },
    previousStatus: { type: String },
    // Every HR change, oldest first (never overwritten)
    attendanceAudit: [{
        fromStatus: { type: String }, toStatus: { type: String },
        previousClockIn: { type: String }, previousClockOut: { type: String },
        by: { type: String }, byName: { type: String }, role: { type: String }, at: { type: String }, remarks: { type: String }
    }],
    // HOI multi-location attendance: where the clock-out happened (clock-in place stays in `location`)
    clockOutLocation: { type: String },
    // Work From Home attendance: approval state of the linked application (Pending = provisional,
    // Approved = confirmed, Rejected / Cancelled = kept for HR review), the remote place and the
    // approximate position captured at clock-in (only shown to HR)
    wfhStatus: { type: String },
    wfhReviewRequired: { type: Boolean },
    wfhWorkLocation: { type: String },
    wfhLocation: { type: Schema.Types.Mixed }
}, { timestamps: true }); // createdAt is set once on insert and never overwritten; updatedAt changes on every update

// Work Schedule Schema
const WorkScheduleSchema = new Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true }, // For day-specific locations/times
    location: { type: String, required: true },
    clockInTime: { type: String, default: "09:30" },
    clockOutTime: { type: String, default: "18:30" },
    assignedBy: { type: String },
    status: { type: String, default: "Approved", enum: ["Pending", "Approved", "Rejected"] },
    reason: { type: String },
    // Change + HR acknowledgement tracking (status "Pending" = not yet read by HR, "Approved" = read by HR)
    employeeName: { type: String },
    assignedByName: { type: String },
    changedAt: { type: String },
    hrReadBy: { type: String },
    hrReadByName: { type: String },
    hrReadAt: { type: String }
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
    reasonForAction: { type: String },
    hoiApproval: { type: String, default: "Pending" },
    hrApproval: { type: String, default: "Pending" },
    hoiApproverId: { type: String },
    hrApproverId: { type: String },
    hoiApprovedAt: { type: String },
    hrApprovedAt: { type: String },
    // HR direct approval / rejection audit trail (optional, additive)
    approvedBy: { type: String },
    approvedByName: { type: String },
    approvedByRole: { type: String },
    approvedAt: { type: String },
    rejectedBy: { type: String },
    rejectedByName: { type: String },
    rejectedByRole: { type: String },
    rejectedAt: { type: String }
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
    adRemarks: { type: String },
    forwardedTo: { type: String },
    forwardHistory: [{
        forwardedTo: { type: String },
        forwardedBy: { type: String },
        date: { type: String },
        remarks: { type: String }
    }],
    routeTo: { type: String },
    targetEmployeeId: { type: String },
    targetDate: { type: String },
    originalMessageId: { type: String },
    // Ticket types (Normal / Attendance) — older tickets have none and are classified from targetCategory
    ticketType: { type: String },          // NORMAL | ATTENDANCE
    issueCategory: { type: String },       // e.g. "Login Problem", "Location Not Fetching"
    attendanceDate: { type: String },      // attendance tickets: affected date (YYYY-MM-DD)
    issueTime: { type: String },           // attendance tickets: time of the problem (HH:MM)
    employeeRole: { type: String },        // role of the employee who raised it (captured by the server)
    updatedAt: { type: String },
    assignedAt: { type: String },
    resolvedBy: { type: String },
    resolvedByName: { type: String },
    // Resolution e-mail to the employee (sent once, by the server, when the ticket becomes Resolved)
    resolutionEmailStatus: { type: String },   // SENDING / SENT / FAILED / NO_EMAIL
    resolutionEmailAt: { type: String },
    // 48-hour unresolved reminder to the responsible HR (once per ticket)
    escalationStatus: { type: String },        // SENDING / SENT / FAILED / ROUTING_ISSUE
    escalationSentAt: { type: String },
    escalationTo: { type: String },
    escalationAttempts: { type: Number },
    escalationError: { type: String },
    statusHistory: [{
        action: { type: String },
        status: { type: String },
        by: { type: String },
        byName: { type: String },
        role: { type: String },
        at: { type: String },
        remarks: { type: String }
    }]
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
    status: { type: String, default: "Proposed", enum: ["Proposed", "Approved", "Rejected"] },
    proposedBy: { type: String },
    proposedByName: { type: String },
    proofUrl: { type: String },
    customMessage: { type: String },
    forAll: { type: Boolean, default: false },
    // Request / decision / college-wise email tracking
    proposedAt: { type: String },
    approvedBy: { type: String },
    approvedByName: { type: String },
    approvedAt: { type: String },
    rejectedBy: { type: String },
    rejectedByName: { type: String },
    rejectedAt: { type: String },
    rejectionReason: { type: String },
    emailSentAt: { type: String },          // set once; guards against sending the same notification twice
    emailStatus: { type: String },          // "Sent" | "Failed" | "No Recipients"
    emailRecipients: [String],
    emailError: { type: String },
    // HOI direct announcement (no HR approval)
    source: { type: String },               // "HOI_ANNOUNCEMENT" for holidays announced by an HOI
    holidayType: { type: String },
    reason: { type: String },
    description: { type: String },
    announcedByRole: { type: String },
    createdAt: { type: String },
    publishedStatus: { type: String },      // "Published"
    announcementId: { type: String }        // linked Notice id
});

const PIPRecordSchema = new Schema({ id: { type: String, unique: true }, employeeId: String, employeeName: String, reason: String, startDate: String, status: String, warnings: Number, disclaimer: String });
const AdditionalResponsibilitySchema = new Schema({ id: { type: String, unique: true }, employeeId: String, employeeName: String, addedBy: String, description: String, date: String, status: String, points: Number,
    // Approval workflow (submitted by HOI/AD -> approved or rejected by AD/Founder)
    addedByName: String, addedByRole: String, submittedAt: String,
    approvedBy: String, approvedByName: String, approvedAt: String, rejectionReason: String });

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
    college: { type: String },
    weekStartDate: { type: String, required: true },
    weekEndDate: { type: String, required: true },
    stream: { type: String },
    year: { type: String },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: String },
    lockedBy: { type: String },
    isVerifiedByCL: { type: Boolean, default: false },
    verifiedBy: { type: String },
    verifiedByName: { type: String },
    verifiedAt: { type: String },
    clRemarks: { type: String },
    entries: [{
        day: { type: String, required: true },
        date: { type: String, required: true },
        timeStart: { type: String, required: true },
        timeStop: { type: String, required: true },
        stream: { type: String },
        year: { type: String },
        semester: { type: String },
        subjectCode: { type: String },
        subjectName: { type: String },
        topics: { type: String },
        section: { type: String },
        // Weekly plan details (stream = Branch)
        lectureType: { type: String },
        unitNumber: { type: String },
        content: { type: String },
        className: { type: String }
    }],
    changeRequests: [{
        requestedAt: { type: String },
        reason: { type: String },
        status: { type: String, default: "Pending", enum: ["Pending", "Approved", "Rejected"] },
        approvedBy: { type: String },
        approvedAt: { type: String },
        changes: { type: String },
        // Unlock request details
        requestedBy: { type: String },
        requestedByName: { type: String },
        requestedAtISO: { type: String },
        comment: { type: String },
        processedBy: { type: String },
        processedByName: { type: String },
        processedByRole: { type: String },
        processedAt: { type: String },
        decisionNote: { type: String }
    }],

    // ── Lifecycle (see src/lib/academic-status.ts) ──
    // DRAFT → SUBMITTED → LOCKED → UNLOCK_REQUESTED → UNLOCKED_FOR_REVISION → RESUBMITTED → LOCKED_AGAIN
    status: { type: String, enum: ["DRAFT", "SUBMITTED", "LOCKED", "UNLOCK_REQUESTED", "UNLOCKED_FOR_REVISION", "RESUBMITTED", "LOCKED_AGAIN"] },
    statusBeforeUnlockRequest: { type: String },
    createdById: { type: String },
    submittedAt: { type: String },
    resubmittedAt: { type: String },
    lockedById: { type: String },
    lockedByName: { type: String },
    lockedByRole: { type: String },
    // Approval behind the lock (who approved, as which role) — the workflow status above stays the source of truth
    approval: {
        state: { type: String },          // APPROVED | UNLOCKED
        type: { type: String },           // CL_CH_APPROVED | HOI_APPROVED | AD_APPROVED | FOUNDER_APPROVED
        label: { type: String },          // "CL/CH Approved" …
        byId: { type: String },
        byName: { type: String },
        byRole: { type: String },
        byDesignation: { type: String },
        at: { type: String },
        remarks: { type: String },
    },
    unlockRequestedAt: { type: String },
    unlockedAt: { type: String },
    unlockedBy: { type: String },
    unlockedByName: { type: String },
    unlockedByRole: { type: String },
    // Returned for correction by a reviewer (before locking)
    returnedAt: { type: String },
    returnNote: { type: String },
    version: { type: Number, default: 1 },
    // Every step, oldest first (never deleted)
    history: [{
        action: { type: String },
        fromStatus: { type: String },
        toStatus: { type: String },
        by: { type: String },
        byName: { type: String },
        role: { type: String },
        at: { type: String },
        note: { type: String }
    }],
    // A copy of the entries every time the plan is submitted / re-submitted, so no revision is ever lost
    revisions: [{
        version: { type: Number },
        status: { type: String },
        entries: { type: Schema.Types.Mixed },
        savedAt: { type: String },
        savedBy: { type: String },
        savedByName: { type: String },
        note: { type: String }
    }]
}, { timestamps: true });
SprintPlanSchema.index({ facultyId: 1, weekStartDate: 1 });
SprintPlanSchema.index({ college: 1, weekStartDate: 1 });
 
// Faculty Preference Schema — Professor-specific subjects and courses for dropdowns
const FacultyPreferenceSchema = new Schema({
    facultyId: { type: String, required: true, unique: true },
    subjects: [{
        code: { type: String, required: true },
        name: { type: String, required: true }
    }],
    streams: [{ type: String, required: true }]
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
    topicsCovered: { type: String },
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

    // OM Tracking: Actual In / Out and Late Remarks
    actualInTime: { type: String },
    actualOutTime: { type: String },
    isLate: { type: Boolean, default: false },
    remarksWhyLate: { type: String },

    // Lecture Notes
    lectureNotes: {
        notesUrl: { type: String },
        notesContent: { type: String },
        isSharedWithStudents: { type: Boolean, default: false },
        sharedWithStudentsTickedBy: { type: String },
        notSharedRemarks: { type: String },
        verificationStatus: { type: String, default: "Pending", enum: ["Pending", "Approved", "Flagged", "Rejected", "Needs Revision"] },
        verifiedBy: { type: String },
        verifiedByName: { type: String },
        verifiedAt: { type: String },
        leadRemarks: { type: String }
    },

    // Assignment Tracking
    assignment: {
        hasAssignment: { type: Boolean, default: false },
        title: { type: String },
        description: { type: String },
        assignmentUrl: { type: String },
        deadline: { type: String },
        studentsCompletedCount: { type: Number, default: 0 },
        totalStudentsExpected: { type: Number, default: 0 },
        verificationStatus: { type: String, default: "Pending", enum: ["Pending", "Approved", "Flagged", "Rejected", "Needs Revision"] },
        verifiedBy: { type: String },
        verifiedByName: { type: String },
        verifiedAt: { type: String },
        leadRemarks: { type: String },
        isSharedInProfGroup: { type: Boolean, default: false },
        sharedInProfGroupAt: { type: String },
        sharedInProfGroupBy: { type: String },
        // Added later from "Add Assignment" (Module 18)
        addedAt: { type: String },
        addedBy: { type: String },
        addedByName: { type: String },
        addedLater: { type: Boolean, default: false }
    },

    // Overall Curriculum Lead Good-to-Go Status (Turns Green)
    clVerificationStatus: { type: String, default: "Pending", enum: ["Pending", "Verified", "Needs Revision"] },
    clRemarks: { type: String },

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
    pedagogicalAnalysis: { type: Schema.Types.Mixed },
    modifiedPedagogicalAnalysis: { type: Schema.Types.Mixed },
    isAIProcessed: { type: Boolean, default: false },
    keywords: [{ type: String }],
    status: { type: String, default: "Scheduled", enum: ["Scheduled", "In Progress", "Completed"] },
    auditStatus: { type: String, default: "Pending", enum: ["Pending", "Approved", "Flagged"] },
    warnings: [{ type: String }],

    // ── Class record details copied from the Sprint Plan entry ──
    sprintEntryId: { type: String },
    timeStart: { type: String },
    timeStop: { type: String },
    section: { type: String },
    className: { type: String },
    lectureType: { type: String },
    unitNumber: { type: String },
    subjectCode: { type: String },
    snapshotUrls: [{ type: String }],
    submittedAt: { type: String },
    submissionCount: { type: Number, default: 0 },

    // Notes not submitted → reason (verified by OM)
    notesMissing: { type: Boolean, default: false },
    notesMissingReason: { type: String },
    notesReasonStatus: { type: String, enum: ["PENDING", "VERIFIED", "REVERTED"] },
    notesReasonReviewedBy: { type: String },
    notesReasonReviewedByName: { type: String },
    notesReasonReviewedAt: { type: String },
    notesReasonComment: { type: String },

    // ── Verification pipeline: Professor → OM → final verification by any ONE of CL / CH / HOI (see src/lib/academic-status.ts) ──
    pipelineStatus: { type: String, enum: ["PENDING_PROFESSOR", "SUBMITTED", "PENDING_OM", "OM_VERIFIED", "OM_REVERTED", "PENDING_CL_CH", "CL_CH_VERIFIED", "CL_CH_REVERTED", "PENDING_HOI", "COMPLETED"] },
    omVerification: {
        status: { type: String, enum: ["PENDING", "VERIFIED", "REVERTED"] },
        by: String, byName: String, role: String, at: String, comment: String
    },
    clChVerification: {
        status: { type: String, enum: ["PENDING", "VERIFIED", "REVERTED", "NOT_REQUIRED"] },
        by: String, byName: String, role: String, at: String, comment: String,
        revertTo: { type: String } // PROFESSOR or OM
    },
    hoiVerification: {
        status: { type: String, enum: ["PENDING", "VERIFIED", "REVERTED", "NOT_REQUIRED"] },
        by: String, byName: String, role: String, at: String, comment: String
    },
    // Final verification — done by ANY ONE of CL / CH / HOI (whoever acts first). Set once; never overwritten after COMPLETED.
    finalVerification: {
        status: { type: String, enum: ["PENDING", "VERIFIED", "REVERTED"] },
        by: String, byName: String, role: String, at: String, comment: String,
        revertTo: { type: String }, // PROFESSOR or OM (when reverted)
        reference: { type: String } // class / sprint plan reference, e.g. "SP-… · 2026-10-09 · Lecture 2"
    },

    // OM: notes / material submitted to the student groups
    submittedToGroup: { type: Boolean, default: false },
    submittedToGroupBy: { type: String },
    submittedToGroupByName: { type: String },
    submittedToGroupAt: { type: String },
    submittedToGroupType: { type: String },   // TELEGRAM / WHATSAPP / BOTH — where the OM shared the notes

    // OM: who recorded the professor's entry / exit time and when
    // OM verification record — kept separate from the professor's own submitted times
    omCheck: {
        entryTime: String, exitTime: String,          // when the OM saw the professor enter / leave
        actualStart: String, actualEnd: String,       // actual class start / end
        scheduledStart: String, scheduledEnd: String, // snapshot of the plan at verification time
        delayMinutes: Number, isDelayed: Boolean, delayReason: String, remarks: String,
        earlyExitMinutes: Number, isEarlyExit: Boolean, earlyExitReason: String,  // professor left before the scheduled end
        by: String, byName: String, at: String,
    },
    omTimesUpdatedBy: { type: String },
    omTimesUpdatedByName: { type: String },
    omTimesUpdatedAt: { type: String },

    // HOI / CL / CH: "notes still pending" comments. Resolved flags stay here as history.
    delayFlags: [{
        flagId: String,
        comment: String,
        by: String, byName: String, role: String, at: String,
        status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN" },
        resolvedBy: String, resolvedByName: String, resolvedAt: String, resolutionNote: String
    }],

    // Every step of the record, oldest first (never deleted)
    pipelineHistory: [{
        action: String,
        fromStatus: String,
        toStatus: String,
        by: String, byName: String, role: String, at: String,
        comment: String
    }]
}, { timestamps: true });
LectureReportSchema.index({ facultyId: 1, date: 1, lectureNumber: 1 });
LectureReportSchema.index({ college: 1, pipelineStatus: 1 });

// In-app notifications (also emailed). One document per recipient.
const NotificationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    recipientId: { type: String, required: true },
    recipientName: { type: String },
    recipientRole: { type: String },
    title: { type: String, required: true },
    message: { type: String },
    type: { type: String },          // e.g. SPRINT_UNLOCK_REQUEST, CLASS_OM_REVERTED
    link: { type: String },          // page inside the portal
    entityType: { type: String },    // SprintPlan / LectureReport
    entityId: { type: String },
    college: { type: String },
    actorId: { type: String },
    actorName: { type: String },
    read: { type: Boolean, default: false },
    readAt: { type: String },
    emailStatus: { type: String },   // SENT / FAILED / SKIPPED
    emailError: { type: String },
    createdAt: { type: String }
});
NotificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

// Automatic reminder log: one row per reminder, so the same reminder is never emailed twice
const ReminderLogSchema = new Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String },          // MISSING_SPRINT_PLAN / MISSING_ASSIGNMENT
    recipientId: { type: String },
    recipientEmail: { type: String },
    weekStartDate: { type: String },
    details: { type: Schema.Types.Mixed },
    status: { type: String },        // SENDING / SENT / FAILED
    error: { type: String },
    sentAt: { type: String },
    createdAt: { type: String }
});

// Scheduled job runs: one row per job per deadline, so a run happens once even with several servers
const JobRunSchema = new Schema({
    key: { type: String, required: true, unique: true },
    job: { type: String },
    trigger: { type: String },       // scheduler / cron-url
    startedAt: { type: String },
    finishedAt: { type: String },
    status: { type: String },        // RUNNING / DONE / FAILED
    result: { type: Schema.Types.Mixed },
    error: { type: String }
});

// Attendance violations (Late Clock-In / Early Clock-Out / Missing Clock-Out) and the email sent for each.
// One row per employee, type and date (unique key), so an event is never recorded or emailed twice.
const AttendanceViolationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },   // TYPE:employeeId:date
    employeeId: { type: String, index: true },
    employeeName: { type: String },
    email: { type: String },
    type: { type: String },              // LATE_IN / EARLY_OUT / MISSING_OUT
    date: { type: String },              // attendance date (YYYY-MM-DD, IST)
    period: { type: String, index: true }, // tracking period (YYYY-MM)
    scheduledTime: { type: String },
    actualTime: { type: String },
    durationMins: { type: Number },
    instance: { type: Number },          // count of this type in the period
    level: { type: String },             // FIRST_WARNING / SECOND_WARNING / FINAL_WARNING / HALF_DAY / FULL_DAY / MISSING_ALERT
    proposedDeduction: { type: String }, // None / Half-Day / Full-Day
    hrStatus: { type: String },          // Not Required / Pending HR Verification / Approved for Payroll / Waived / Awaiting Explanation / Approved / Rejected
    emailStatus: { type: String },       // Pending / Sending / Sent / Failed
    emailAttempts: { type: Number, default: 0 },
    emailSentAt: { type: String },
    emailError: { type: String },
    emailMessageId: { type: String },
    decisionEmailStatus: { type: String },
    explanation: { type: String },
    proofUrls: [String],
    explanationAt: { type: String },
    hrDecisionBy: { type: String },
    hrDecisionByName: { type: String },
    hrDecisionAt: { type: String },
    hrRemarks: { type: String },
    laterClockOut: { type: String },     // Missing Clock-Out: clock-out recorded after the alert
    createdAt: { type: String },
});

// Curriculum Task Schema — Tasks assigned by Curriculum Lead / Head to Professors
const CurriculumTaskSchema = new Schema({
    id: { type: String, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    assignedBy: { type: String, required: true }, // CL or CH employee ID
    assignedByName: { type: String, required: true },
    assignedTo: { type: String, required: true }, // Faculty employee ID
    assignedToName: { type: String, required: true },
    campus: { type: String },
    priority: { type: String, default: "Medium", enum: ["High", "Medium", "Low"] },
    deadline: { type: String },
    status: { type: String, default: "Pending", enum: ["Pending", "In Progress", "Completed", "Verified"] },
    facultyResponse: { type: String },
    facultyAttachmentUrl: { type: String },
    completedAt: { type: String },
    clFeedback: { type: String },
    createdAt: { type: String, required: true }
}, { timestamps: true });

// Campus Daily MoM Schema — Campus-wise Daily Meeting Minutes (updated by Faculties, HOI, OM, CL, CH)
const CampusDailyMoMSchema = new Schema({
    id: { type: String, unique: true },
    campus: { type: String, required: true }, // e.g. "SAGE Bhopal" or location id
    date: { type: String, required: true }, // YYYY-MM-DD
    title: { type: String, default: "Campus Daily Sync & MoM" },
    meetingTime: { type: String },   // HH:MM
    meetingType: { type: String },   // Campus Standup / Academic Review / …
    agenda: { type: String },
    discussionPoints: { type: String },
    keyDecisions: { type: String },
    actionItems: [{
        task: String,
        owner: String,
        deadline: String,
        status: { type: String, default: "Pending", enum: ["Pending", "In Progress", "Completed"] }
    }],
    blockers: { type: String },
    attendees: [{
        id: String,
        name: String,
        role: String,
        present: { type: Boolean, default: true }
    }],
    updates: [{
        updatedBy: String,
        updatedByName: String,
        role: String,
        updatedAt: String,
        note: String
    }],
    lastUpdatedBy: { type: String },
    lastUpdatedByName: { type: String },
    lastUpdatedAt: { type: String }
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
    state: { type: String, required: true },
    // Optional: the HOI who heads this campus. One HOI can head several campuses (their own + these).
    hoiId: { type: String }
});

// Exit formalities recorded by HR before an employee is removed (Workforce → Delete Employee)
const ExitRecordSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    employeeSnapshot: { type: Schema.Types.Mixed }, // name, email, role, dept, designation, location, status at exit time
    documentsSent: { type: String, enum: ["YES", "NO"] },        // offer / experience letter sent
    salarySettled: { type: String, enum: ["YES", "NO"] },
    lastWorkingDay: { type: String },                                 // YYYY-MM-DD
    leavingReason: { type: String },
    leavingReasonOther: { type: String },
    assetsReturned: { type: String, enum: ["YES", "NO"] },
    reimbursementsCleared: { type: String, enum: ["YES", "NO"] },
    remarks: { type: String },
    status: { type: String, enum: ["PENDING", "COMPLETED"], default: "PENDING" },
    outstanding: [String],                                            // what still blocks removal (last save)
    finalEmployeeStatus: { type: String },
    createdBy: String, createdByName: String, createdAt: String,
    updatedBy: String, updatedByName: String, updatedAt: String,
    completedBy: String, completedByName: String, completedByRole: String, completedAt: String,
    history: [{ action: String, by: String, byName: String, role: String, at: String, note: String }],
});

// Give Access — delegated hubs (Founder / authorised Tech Lead → recipient), see src/lib/access-hubs.ts
const AccessGrantSchema = new Schema({
    id: { type: String, required: true, unique: true },
    recipientId: { type: String, required: true, index: true },
    recipientName: String,
    category: { type: String, required: true },              // HOI, OM, TL, HR, AD, CURRICULUM_LEAD, CURRICULUM_HEAD, PROFESSOR
    scopeType: { type: String, enum: ["SELECTED", "ALL", "ALL_DYNAMIC"], default: "SELECTED" }, // ALL = snapshot at grant time
    sourceEmployeeIds: [String],
    status: { type: String, enum: ["ACTIVE", "REVOKED"], default: "ACTIVE" },
    grantedBy: String, grantedByName: String, grantedByRole: String, grantedAt: String,
    updatedBy: String, updatedByName: String, updatedAt: String,
    revokedBy: String, revokedByName: String, revokedAt: String,
    history: [{ action: String, by: String, byName: String, role: String, at: String, note: String, sourceEmployeeIds: [String] }],
});
// Tech Leads the Founder allows to manage access, and for which categories
const AccessManagerSchema = new Schema({
    employeeId: { type: String, required: true, unique: true },
    categories: [String],
    enabled: { type: Boolean, default: true },
    updatedBy: String, updatedByName: String, updatedAt: String,
});

export const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
export const WorkSchedule = mongoose.models.WorkSchedule || mongoose.model('WorkSchedule', WorkScheduleSchema);
export const MarkAsPresentRequest = mongoose.models.MarkAsPresentRequest || mongoose.model('MarkAsPresentRequest', MarkAsPresentRequestSchema);
export const OverrideRequest = mongoose.models.OverrideRequest || mongoose.model('OverrideRequest', OverrideRequestSchema);
export const PerformanceStar = mongoose.models.PerformanceStar || mongoose.model('PerformanceStar', PerformanceStarSchema);
export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
export const Notice = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
// Work From Home application (separate from leave: never counted as leave, never changes Original Location)
const WorkFromHomeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String },
    employeeRole: { type: String },
    designation: { type: String },
    dept: { type: String },
    wfhType: { type: String, enum: ["FULL_DAY", "HALF_DAY"], default: "FULL_DAY" },
    startDate: { type: String, required: true },   // YYYY-MM-DD
    endDate: { type: String, required: true },
    days: { type: Number },
    reason: { type: String, required: true },
    remarks: { type: String },
    // Remote work location given in the application (not the Original Location, not a campus)
    workLocation: { type: String },
    // Optional supporting document (stored file reference)
    documentUrl: { type: String },
    reportingManagerName: { type: String },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Cancelled"], default: "Pending" },
    approverId: { type: String },
    approverName: { type: String },
    approverRole: { type: String },
    decisionRemarks: { type: String },
    decidedAt: { type: String },
    cancelledAt: { type: String },
    cancelledBy: { type: String },
    history: [{
        action: { type: String }, status: { type: String }, by: { type: String }, byName: { type: String },
        role: { type: String }, at: { type: String }, remarks: { type: String }
    }]
}, { timestamps: true });
WorkFromHomeSchema.index({ employeeId: 1, startDate: 1 });

export const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
export const WorkFromHome = mongoose.models.WorkFromHome || mongoose.model('WorkFromHome', WorkFromHomeSchema);
export const ReimbursementClaim = mongoose.models.ReimbursementClaim || mongoose.model('ReimbursementClaim', ReimbursementClaimSchema);
export const PIPRecord = mongoose.models.PIPRecord || mongoose.model('PIPRecord', PIPRecordSchema);
export const AdditionalResponsibility = mongoose.models.AdditionalResponsibility || mongoose.model('AdditionalResponsibility', AdditionalResponsibilitySchema);
export const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema);
export const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema);
export const SprintPlan = mongoose.models.SprintPlan || mongoose.model('SprintPlan', SprintPlanSchema);
export const LectureReport = mongoose.models.LectureReport || mongoose.model('LectureReport', LectureReportSchema);
export const MeetingRequest = mongoose.models.MeetingRequest || mongoose.model('MeetingRequest', MeetingRequestSchema);
export const FacultyPreference = mongoose.models.FacultyPreference || mongoose.model('FacultyPreference', FacultyPreferenceSchema);
export const CurriculumTask = mongoose.models.CurriculumTask || mongoose.model('CurriculumTask', CurriculumTaskSchema);
export const CampusDailyMoM = mongoose.models.CampusDailyMoM || mongoose.model('CampusDailyMoM', CampusDailyMoMSchema);
export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export const ReminderLog = mongoose.models.ReminderLog || mongoose.model('ReminderLog', ReminderLogSchema);
export const JobRun = mongoose.models.JobRun || mongoose.model('JobRun', JobRunSchema);
export const ExitRecord = mongoose.models.ExitRecord || mongoose.model('ExitRecord', ExitRecordSchema);
export const AccessGrant = mongoose.models.AccessGrant || mongoose.model('AccessGrant', AccessGrantSchema);
export const AccessManager = mongoose.models.AccessManager || mongoose.model('AccessManager', AccessManagerSchema);
export const AttendanceViolation = mongoose.models.AttendanceViolation || mongoose.model('AttendanceViolation', AttendanceViolationSchema);