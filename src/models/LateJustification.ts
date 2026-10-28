import mongoose, { Schema } from 'mongoose';

/**
 * Late Clock-In Justification: one per employee per attendance date (linked to the Attendance record).
 * The original clock-in time and the original "late" classification are kept here; the Attendance record's
 * late flag (flags.late) is the effective classification used by every attendance view.
 */
const LateJustificationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },          // employeeId:date — one request per day
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String },
    department: { type: String },
    attendanceId: { type: String },                               // Attendance _id
    date: { type: String, required: true, index: true },          // attendance date (YYYY-MM-DD, IST)
    scheduledClockIn: { type: String },                           // "09:30"
    actualClockIn: { type: String },                              // "09:35:12" — never changed
    lateDurationMinutes: { type: Number },
    originalIsLate: { type: Boolean, default: true },
    effectiveIsLate: { type: Boolean, default: true },
    justificationReason: { type: String },
    supportingDocument: { type: String },
    justificationStatus: { type: String, default: 'pending' },     // pending | approved | rejected
    reviewedBy: { type: String },
    reviewedByName: { type: String },
    reviewedByRole: { type: String },                             // HR | HR Executive | Founder
    reviewedAt: { type: String },
    rejectionReason: { type: String },
    violationId: { type: String },                                // the LATE_IN attendance violation of that day
    violationStatusBefore: { type: String },
    createdAt: { type: String },
    updatedAt: { type: String },
});

/** Audit of HR decisions; the unique key also makes sure a request is decided only once */
const LateJustificationDecisionSchema = new Schema({
    key: { type: String, required: true, unique: true },          // decision:<justification id>
    justificationId: { type: String, required: true },
    employeeId: { type: String },
    date: { type: String },
    decision: { type: String },                                   // approved | rejected
    byId: { type: String },
    byName: { type: String },
    byRole: { type: String },
    reason: { type: String },
    at: { type: String },
});

export const LateJustification = mongoose.models.LateJustification || mongoose.model('LateJustification', LateJustificationSchema);
export const LateJustificationDecision = mongoose.models.LateJustificationDecision || mongoose.model('LateJustificationDecision', LateJustificationDecisionSchema);