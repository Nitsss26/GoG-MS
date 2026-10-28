import mongoose, { Schema } from 'mongoose';

/**
 * Leave decisions taken from the e-mail "Accept Leave / Reject Leave" links (audit log),
 * plus one row per leave-application e-mail sent (so the application mail with links goes out once).
 * `key` is unique: "action:<token id>" for a decision (a link is used once), "mail:<leave id>" for the mail.
 */
const LeaveEmailActionSchema = new Schema({
    key: { type: String, required: true, unique: true },
    kind: { type: String, required: true },          // DECISION | APPLICATION_MAIL
    leaveId: { type: String, required: true, index: true },
    employeeId: { type: String },
    approverId: { type: String },
    approverName: { type: String },
    approverRole: { type: String },
    action: { type: String },                        // Approved | Rejected
    source: { type: String, default: 'Email' },
    previousStatus: { type: String },
    updatedStatus: { type: String },
    reason: { type: String },
    lossOfPayDays: { type: Number },
    at: { type: String },
    recipients: { type: Number },                    // APPLICATION_MAIL: how many addresses
    actionLinks: { type: Number },                   // APPLICATION_MAIL: how many got Accept / Reject buttons
});

export const LeaveEmailAction = mongoose.models.LeaveEmailAction || mongoose.model('LeaveEmailAction', LeaveEmailActionSchema);