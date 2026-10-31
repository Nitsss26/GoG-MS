import mongoose, { Schema } from 'mongoose';

/**
 * My Salary & Payable Days + Flag Removal (add-on models).
 * Flags themselves stay in their existing collections (AttendanceViolation / Attendance dress code); a removal is
 * recorded here and never changes or deletes the original record.
 */

// One row per removed flag. flagId is unique, so the same flag can never be removed twice.
const FlagRemovalSchema = new Schema({
    id: { type: String, required: true, unique: true },
    flagId: { type: String, required: true, unique: true },     // VIO:<violation id> | DRESS:<attendance _id>
    source: { type: String },                                    // VIOLATION | DRESS_CODE
    sourceId: { type: String },
    employeeId: { type: String, index: true },
    employeeName: { type: String },
    employeeRole: { type: String },
    dept: { type: String },
    designation: { type: String },
    location: { type: String },
    locationName: { type: String },
    flagCategory: { type: String },                              // DRESS_CODE | CLOCK_IN | CLOCK_OUT
    flagType: { type: String },                                  // DRESS_CODE | LATE_IN | EARLY_OUT | MISSING_OUT
    flagLabel: { type: String },
    flagDate: { type: String, index: true },                     // YYYY-MM-DD
    originalStatus: { type: String, default: 'active' },
    updatedStatus: { type: String, default: 'removed' },
    originalSnapshot: { type: Schema.Types.Mixed },              // the flag / penalty as it was (level, deduction, HR status…)
    removalReason: { type: String, required: true },
    supportingImageUrl: { type: String },
    removedBy: { type: String },
    removedByName: { type: String },
    removedByRole: { type: String },
    removedByDesignation: { type: String },
    removedAt: { type: String },
    notificationRecipients: { to: [String], cc: [String] },
    emailStatus: { type: String },                               // SENT | FAILED | SKIPPED
    emailError: { type: String },
    emailAttempts: { type: Number, default: 0 },
    emailSentAt: { type: String },
    emailLog: [{ at: String, by: String, status: String, error: String }],
});

// Employee correction request about payable days / leave / penalties. Never changes payroll by itself.
const CorrectionTicketSchema = new Schema({
    id: { type: String, required: true, unique: true },          // OMS-PAY-2026-00125
    employeeId: { type: String, required: true, index: true },
    employee: { type: Schema.Types.Mixed },                      // name, id, dept, designation, location, email at submission
    category: { type: String, required: true },
    month: { type: String },                                     // YYYY-MM
    currentValue: { type: String },
    expectedValue: { type: String },
    reason: { type: String, required: true },
    evidenceUrls: [String],
    affectedDates: [String],                                     // YYYY-MM-DD the employee asks to be reviewed
    correctionIds: [String],                                     // payable-day corrections made through this ticket
    status: { type: String, default: 'Open' },                   // Open | Under Review | Additional Information Required | Approved | Rejected | Resolved
    hrResponse: { type: String },                                // latest message shown to the employee
    resolutionNote: { type: String },
    resolvedAt: { type: String },
    resolvedBy: { type: String },
    resolvedByName: { type: String },
    // visible to the employee: status changes, HR responses, employee replies
    history: [{
        at: String, by: String, byName: String, role: String,
        action: String, fromStatus: String, toStatus: String, note: String, evidenceUrls: [String],
    }],
    // HR-only notes
    internalComments: [{ at: String, by: String, byName: String, text: String }],
    createdAt: { type: String },
    updatedAt: { type: String },
});

// HR / HR Executive payable-day correction (a payroll adjustment). The attendance / leave records are never changed;
// the correction is applied on top of the base calculation. Reversal keeps the record (status REVERSED).
const PayableCorrectionSchema = new Schema({
    id: { type: String, required: true, unique: true },
    activeKey: { type: String, required: true, unique: true },   // employeeId:date while ACTIVE (one active correction per day)
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String },
    month: { type: String, index: true },                         // YYYY-MM
    date: { type: String, required: true },                       // YYYY-MM-DD
    originalAttendance: { type: String },
    originalLeave: { type: String },
    originalReason: { type: String },
    direction: { type: String, default: 'TO_PAYABLE' },           // TO_PAYABLE | TO_NON_PAYABLE
    previousPayableStatus: { type: String },                      // Non-Payable | Partly Payable | Payable
    previousPayableValue: { type: Number },                       // 0 / 0.5
    updatedPayableStatus: { type: String, default: 'Payable' },
    updatedPayableValue: { type: Number, default: 1 },
    adjustment: { type: Number },                                 // +1 / +0.5 / −1
    previousMonthPayable: { type: Number },
    updatedMonthPayable: { type: Number },
    correctionCategory: { type: String },
    correctionReason: { type: String, required: true },
    supportingEvidence: [String],
    relatedTicketId: { type: String },
    correctedBy: { type: String }, correctedByName: { type: String }, correctedByRole: { type: String }, correctedAt: { type: String },
    status: { type: String, default: 'ACTIVE' },                  // ACTIVE | REVERSED
    reversedBy: { type: String }, reversedByName: { type: String }, reversedByRole: { type: String }, reversedAt: { type: String },
    reversalReason: { type: String },
    notifyStatus: { type: String },
});

// Sequence numbers (ticket ids)
const SalaryCounterSchema = new Schema({
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

export const FlagRemoval = mongoose.models.FlagRemoval || mongoose.model('FlagRemoval', FlagRemovalSchema);
export const CorrectionTicket = mongoose.models.CorrectionTicket || mongoose.model('CorrectionTicket', CorrectionTicketSchema);
export const PayableCorrection = mongoose.models.PayableCorrection || mongoose.model('PayableCorrection', PayableCorrectionSchema);
export const SalaryCounter = mongoose.models.SalaryCounter || mongoose.model('SalaryCounter', SalaryCounterSchema);