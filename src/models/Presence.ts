import mongoose, { Schema } from 'mongoose';

/**
 * OMS presence of one employee (HR → Workforce → OMS Status / Last Seen). One row per employee id — the employee
 * record itself is not duplicated or changed. Only server timestamps are stored: no token, IP address or browsing data.
 */
const EmployeePresenceSchema = new Schema({
    employeeId: { type: String, required: true, unique: true },
    lastLoginAt: { type: Date },                 // last successful password login
    lastSeenAt: { type: Date, index: true },     // last login or heartbeat from a valid session
    lastLogoutAt: { type: Date },                // logout from a browser (another open device can still be active)
});

export const EmployeePresence = mongoose.models.EmployeePresence || mongoose.model('EmployeePresence', EmployeePresenceSchema);