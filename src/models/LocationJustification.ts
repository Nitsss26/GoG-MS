import mongoose, { Schema } from 'mongoose';

/**
 * Location Mismatch Justification (HOI / OM with assigned attendance locations).
 * Created together with the day's first clock-in when the employee clocks in at an ASSIGNED location that is
 * not the day's scheduled location (Work Location schedule → date / weekday, otherwise the Original Location).
 * One per employee per date. Reviewed once:
 *   HOI → HR / HR Executive / AD (Founder)
 *   OM  → the OM's respective HOI(s) and HR / HR Executive (Founder)
 * Rejection carries one primary action (warning / custom / penalty ₹ / half_day / full_day); the email is
 * previewed and sent by hand (emailStatus tracked separately, one send at a time).
 */
const LocationJustificationSchema = new Schema({
    id: { type: String, required: true, unique: true },               // LMJ-...
    key: { type: String, required: true, unique: true },              // employeeId:date
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String },
    employeeRole: { type: String },                                   // HOI | OM
    employeeEmail: { type: String },
    designation: { type: String },
    date: { type: String, required: true, index: true },              // YYYY-MM-DD (IST)
    attendanceId: { type: String },
    scheduledLocationId: { type: String },
    scheduledLocationName: { type: String },
    actualLocationId: { type: String },
    actualLocationName: { type: String },
    assignedLocations: [{ id: String, name: String }],
    clockIn: { type: String },                                         // HH:mm:ss (server)
    clockInAt: { type: Date },
    lat: { type: Number }, lng: { type: Number }, accuracyMeters: { type: Number },
    lateAlso: { type: Boolean, default: false },
    lateJustificationId: { type: String },
    justification: { type: String, required: true },
    reviewerHoiIds: [String],                                          // OM: respective HOI(s) at submission time
    status: { type: String, default: 'pending', index: true },        // pending | approved | rejected
    reviewedBy: { type: String }, reviewedByName: { type: String }, reviewedByRole: { type: String }, reviewedAt: { type: String },
    // rejection
    action: { type: String },                                          // warning | custom | penalty | half_day | full_day
    customAction: { type: String },
    penaltyAmount: { type: Number },                                   // INR
    decisionReason: { type: String },
    remarks: { type: String },
    // manual email (only after a rejection)
    emailStatus: { type: String, default: 'not_sent' },               // not_sent | sending | sent | failed
    emailSendingAt: { type: String },
    emailAttempts: [{ at: String, status: String, byId: String, byName: String, error: String, messageId: String, to: String, cc: [String] }],
    emailSentAt: { type: String },
    emailSubject: { type: String },
    history: [{ at: String, by: String, byName: String, role: String, action: String, note: String }],
    createdAt: { type: String },
    updatedAt: { type: String },
});

/** Audit of HR / AD changes to HOI / OM assigned colleges and date-wise scheduled locations */
const LocationScheduleAuditSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String },
    kind: { type: String },                                            // assigned | scheduled | schedule_removed
    date: { type: String },                                            // for scheduled
    from: { type: Schema.Types.Mixed },
    to: { type: Schema.Types.Mixed },
    byId: { type: String }, byName: { type: String }, byRole: { type: String },
    at: { type: String },
});

/** One decision / one email send at a time: a unique key is claimed first (works even where updates are not atomic) */
const LocationJustificationLockSchema = new Schema({
    key: { type: String, required: true, unique: true },              // decision:<id> | email:<id>#<attempt>
    byId: { type: String },
    at: { type: String },
});

export const LocationJustificationLock = mongoose.models.LocationJustificationLock || mongoose.model('LocationJustificationLock', LocationJustificationLockSchema);
export const LocationJustification = mongoose.models.LocationJustification || mongoose.model('LocationJustification', LocationJustificationSchema);
export const LocationScheduleAudit = mongoose.models.LocationScheduleAudit || mongoose.model('LocationScheduleAudit', LocationScheduleAuditSchema);