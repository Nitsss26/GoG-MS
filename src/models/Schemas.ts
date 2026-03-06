import mongoose, { Schema } from 'mongoose';

// Performance Star Schema
const PerformanceStarSchema = new Schema({
    employeeId: { type: String, required: true },
    stars: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    badges: [String]
});

// Attendance Schema
const AttendanceSchema = new Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    clockIn: { type: String, required: true },
    clockOut: { type: String },
    location: { type: String, required: true },
    status: { type: String, required: true },
    flags: {
        late: { type: Boolean, default: false },
        earlyOut: { type: Boolean, default: false },
        locationDiff: { type: Boolean, default: false },
        misconduct: { type: Boolean, default: false },
        dressCode: { type: Boolean, default: false },
        meetingAbsent: { type: Boolean, default: false },
        performance: { type: Boolean, default: false },
    },
    isApprovedByHR: { type: Boolean, default: false },
    dressCodeImageUrl: { type: String },
    dressCodeStatus: { type: String, default: "N/A" }
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
    appliedAt: { type: String }
});

// Notice Schema
const NoticeSchema = new Schema({
    id: { type: String, required: true, unique: true },
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

// Ticket Schema
const TicketSchema = new Schema({
    id: { type: String, required: true, unique: true },
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
    resolutionNotes: { type: String }
});

// PIP Record Schema
const PIPRecordSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    reason: { type: String, required: true },
    startDate: { type: String, required: true },
    status: { type: String, default: "Active" },
    warnings: { type: Number, default: 0 },
    disclaimer: { type: String },
    resolvedReason: { type: String },
    resolvedProofs: [String],
    resolvedAt: { type: String }
});

// Additional Responsibility Schema
const AdditionalResponsibilitySchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    addedBy: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, default: "Pending" },
    points: { type: Number, default: 0 }
});

export const PerformanceStar = mongoose.models.PerformanceStar || mongoose.model('PerformanceStar', PerformanceStarSchema);
export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
export const Notice = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
export const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
export const PIPRecord = mongoose.models.PIPRecord || mongoose.model('PIPRecord', PIPRecordSchema);
export const AdditionalResponsibility = mongoose.models.AdditionalResponsibility || mongoose.model('AdditionalResponsibility', AdditionalResponsibilitySchema);
