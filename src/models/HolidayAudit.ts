import mongoose, { Schema } from 'mongoose';

/**
 * Holiday Management (Announcements → Holiday Management): one row per removal — who removed which holiday from
 * which college / employee, and the holiday record as it was before. The holiday record itself is deleted or changed.
 */
const HolidayAuditSchema = new Schema({
    id: { type: String, required: true, unique: true },
    action: { type: String },          // REMOVE_EMPLOYEE | EXCLUDE_EMPLOYEE | REMOVE_COLLEGE | REMOVE_DAY
    holidayId: { type: String, index: true },
    holidayName: { type: String },
    date: { type: String },
    collegeId: { type: String },
    collegeName: { type: String },
    employeeId: { type: String },
    employeeName: { type: String },
    flagsRestored: { type: Number },
    by: { type: String },
    byName: { type: String },
    byRole: { type: String },
    at: { type: String },
    before: { type: Schema.Types.Mixed },
});

export const HolidayAudit = mongoose.models.HolidayAudit || mongoose.model('HolidayAudit', HolidayAuditSchema);
