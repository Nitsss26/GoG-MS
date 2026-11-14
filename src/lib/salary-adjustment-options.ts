/** Salary Management → Mark as Payable: Half Day / Monetary Penalty options (client and server safe — no database code) */
export const HALF_DAY_REASONS = ['Employee Left Early', 'Employee Arrived Late', 'Incomplete Assigned Work', 'Insufficient Working Hours', 'Work Not Completed', 'Attendance Discrepancy', 'Other'];
export const PENALTY_REASONS = ['Incomplete Assigned Work', 'Missed Deadline', 'Attendance-Related Issue', 'Unapproved Absence', 'Work Policy Violation', 'Other'];
/** Largest single HR penalty (₹) — a guard against typing mistakes */
export const MAX_PENALTY_AMOUNT = 100000;
