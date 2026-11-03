import mongoose, { Schema } from 'mongoose';

/**
 * Assign Manager (general reporting manager) — add-on models.
 * Separate from the HOI mapping: Employee.reportsTo (HOI, used by the HOI / academic / leave workflows) is never
 * read or written here. One current reporting manager per employee record; every change is kept in the log.
 */

// Current reporting manager of an employee record (employeeId unique → one active primary manager)
const ReportingManagerSchema = new Schema({
    employeeId: { type: String, required: true, unique: true },
    managerId: { type: String, required: true, index: true },
    effectiveDate: { type: String },                // YYYY-MM-DD
    assignedBy: { type: String },
    assignedByName: { type: String },
    assignedByRole: { type: String },
    assignedAt: { type: String },                   // ISO
    reason: { type: String },
    logId: { type: String },
});

// Audit history — never overwritten or deleted
const ManagerAssignmentLogSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String },
    employeeRole: { type: String },
    previousManagerId: { type: String },
    previousManagerName: { type: String },
    newManagerId: { type: String },
    newManagerName: { type: String },
    action: { type: String },                       // ASSIGNED | REASSIGNED
    effectiveDate: { type: String },
    reason: { type: String },
    assignedBy: { type: String },
    assignedByName: { type: String },
    assignedByRole: { type: String },
    assignedAt: { type: String },
    emailStatus: { type: String },                  // SENT | FAILED | SKIPPED
    emailError: { type: String },
    emailRecipients: { to: [String], cc: [String] },
});

export const ReportingManager = mongoose.models.ReportingManager || mongoose.model('ReportingManager', ReportingManagerSchema);
export const ManagerAssignmentLog = mongoose.models.ManagerAssignmentLog || mongoose.model('ManagerAssignmentLog', ManagerAssignmentLogSchema);