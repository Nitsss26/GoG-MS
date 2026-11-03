import mongoose, { Schema } from 'mongoose';

/**
 * Full Attire Management (add-on).
 * One submission per live camera capture by an OM — a single professor or a group (one photo, stored once).
 * Every selected professor gets their own review record (independent Accept / Reject), which references the
 * submission's photo. Emails are prepared in Email Management (category "full_attire") and sent by hand.
 */
const FullAttireSubmissionSchema = new Schema({
    id: { type: String, required: true, unique: true },            // FA-2026-00012
    clientKey: { type: String, required: true, unique: true },     // duplicate-submit guard (one key per capture)
    type: { type: String, enum: ['single', 'group'], required: true },
    college: { type: String },                                     // Location id of the OM's college
    collegeName: { type: String },
    omId: { type: String, required: true, index: true },
    omName: { type: String },
    imageUrl: { type: String, required: true },                    // the photo, stored once
    capturedAt: { type: String },                                  // device capture time (ISO)
    submittedAt: { type: String, required: true },                 // server time (ISO)
    professorIds: [String],
    standingOrder: [{ position: Number, professorId: String, professorName: String }], // left → right
    status: { type: String, default: 'Pending Review' },           // Pending Review | Partly Reviewed | Reviewed
});

const FullAttireReviewSchema = new Schema({
    id: { type: String, required: true, unique: true },            // <submissionId>:<professorId>
    submissionId: { type: String, required: true, index: true },
    professorId: { type: String, required: true, index: true },
    professorName: { type: String },
    position: { type: Number },
    college: { type: String },
    collegeName: { type: String },
    status: { type: String, default: 'pending' },                  // pending | accepted | rejected
    reasons: [String],                                             // existing Dress Code reasons
    other: { type: String },
    explanation: { type: String },
    evidenceUrl: { type: String },                                 // optional HR supporting image
    reviewedBy: { type: String },
    reviewedByName: { type: String },
    reviewedByRole: { type: String },
    reviewedAt: { type: String },
    history: [{ at: String, by: String, byName: String, role: String, action: String, note: String }],
    createdAt: { type: String },
});

export const FullAttireSubmission = mongoose.models.FullAttireSubmission || mongoose.model('FullAttireSubmission', FullAttireSubmissionSchema);
export const FullAttireReview = mongoose.models.FullAttireReview || mongoose.model('FullAttireReview', FullAttireReviewSchema);