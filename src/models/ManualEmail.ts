import mongoose, { Schema } from 'mongoose';

/**
 * Email Management: the four employee emails that HR / HR Executive send by hand (Dress Code Rejection,
 * Late Clock-In warning, No Clock-In, No Clock-Out). One record per category + related record (unique key),
 * so the same email can never be created twice; every send attempt is kept in `attempts` (audit history).
 */
const ManualEmailAttemptSchema = new Schema({
    at: { type: String },
    status: { type: String },            // sent | failed
    subject: { type: String },
    email: { type: String },
    warningLevel: { type: Number },
    byId: { type: String },
    byName: { type: String },
    byRole: { type: String },            // HR | HR Executive | Founder
    messageId: { type: String },
    error: { type: String },
}, { _id: false });

const ManualEmailSchema = new Schema({
    key: { type: String, required: true, unique: true },     // <category>:<relatedRecordId>
    category: { type: String, required: true, index: true }, // dress_code | late_clock_in | no_clock_in | no_clock_out
    relatedRecordId: { type: String, required: true },       // attendance _id / violation id / employeeId:date
    relatedDate: { type: String, index: true },              // YYYY-MM-DD
    employeeId: { type: String, index: true },
    employeeName: { type: String },
    recipientEmail: { type: String },
    subject: { type: String },
    emailStatus: { type: String, default: 'not_sent' },      // not_sent | sending | sent | failed | not_required
    warningLevel: { type: Number },                          // late clock-in: 1st / 2nd / 3rd …
    categoryLabel: { type: String },                         // e.g. "Second Late Clock-In"
    triggeredBy: { type: String },
    triggeredByName: { type: String },
    triggeredByRole: { type: String },
    sendingAt: { type: String },
    sentAt: { type: String },
    providerMessageId: { type: String },
    html: { type: String },                                  // copy of the email as sent (View Sent Email)
    errorMessage: { type: String },
    attemptCount: { type: Number, default: 0 },
    attempts: { type: [ManualEmailAttemptSchema], default: [] },
    createdAt: { type: String },
    updatedAt: { type: String },
});

/** One row per send attempt (unique) — two people clicking Send at the same moment: only one send goes out */
const ManualEmailLockSchema = new Schema({
    key: { type: String, required: true, unique: true },     // <manual email key>#<attempt number>
    byId: { type: String },
    at: { type: String },
});

export const ManualEmail = mongoose.models.ManualEmail || mongoose.model('ManualEmail', ManualEmailSchema);
export const ManualEmailLock = mongoose.models.ManualEmailLock || mongoose.model('ManualEmailLock', ManualEmailLockSchema);