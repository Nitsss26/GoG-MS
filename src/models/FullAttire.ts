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
    // OM Given Access: a Professor / HOI submitted with an OM's temporary grant. omId / omName then hold the ACTUAL
    // submitter (as for an OM submission); these say how and who granted it. Absent on every OM submission.
    submittedVia: { type: String },                                // 'OM_GIVEN_ACCESS'
    submitterRole: { type: String },                               // PROFESSOR | HOI
    grantIds: [String],
    grantedByIds: [String],
    grantedByNames: [String],
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

/**
 * OM Given Access: an OM lets a Professor / HOI of their scope use Full Attire for some days (IST dates, both
 * inclusive). The status is ALWAYS worked out from the dates and the revoke fields when access is checked — never
 * trusted from storage. Nothing else of the OM role is given, and the employee's own role never changes.
 */
const TemporaryAccessGrantSchema = new Schema({
    id: { type: String, required: true, unique: true },            // TAG-…
    permission: { type: String, required: true, default: 'FULL_ATTIRE' },
    grantedByEmployeeId: { type: String, required: true, index: true },
    grantedByName: { type: String },
    grantedToEmployeeId: { type: String, required: true, index: true },
    grantedToName: { type: String },
    grantedToRole: { type: String },                               // PROFESSOR | FACULTY | HOI (at grant time)
    startDate: { type: String, required: true },                   // YYYY-MM-DD (IST)
    endDate: { type: String, required: true },                     // YYYY-MM-DD (IST), inclusive
    reason: { type: String },
    createdAt: { type: String, required: true },
    revokedAt: { type: String },
    revokedBy: { type: String },
    revokedByName: { type: String },
    revokeKind: { type: String },                                  // revoked (was active) | cancelled (was scheduled)
});

export const TemporaryAccessGrant = mongoose.models.TemporaryAccessGrant || mongoose.model('TemporaryAccessGrant', TemporaryAccessGrantSchema);