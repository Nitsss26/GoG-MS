/**
 * SERVER-ONLY: remove an ex-employee from the portal (soft delete).
 *
 * The employee record and the history that refers to it (attendance, decided leaves, approved
 * responsibilities, tickets, reports, class records) stay in the database. Everything that gives access
 * or makes the person an active member is removed:
 *   - login + existing sessions of THIS designation record (immediately)
 *   - college / location and reporting (HOI, manager, team) mapping, in both directions
 *   - work schedule assignment
 *   - requests still waiting for a decision (leave, responsibility) are closed
 * Other designation records of the same person (same email) are not touched.
 */
import crypto from 'crypto';
import { Employee, WorkSchedule, LeaveRequest, AdditionalResponsibility } from '@/models/Schemas';
import { revokeSessionsFor } from '@/lib/session';

export type RemovalActor = { id: string; name: string; role: string };
export type RemovalResult = { ok: true; employee: any; cleaned: Record<string, number> } | { ok: false; status: number; error: string };

export async function removeEmployeeFromPortal(actor: RemovalActor, employeeId: string, finalStatus = 'Resigned'): Promise<RemovalResult> {
    if (!['HR', 'FOUNDER'].includes(actor.role)) return { ok: false, status: 403, error: 'Only HR can remove an employee from the portal.' };
    if (employeeId === actor.id) return { ok: false, status: 400, error: 'You cannot remove your own account.' };

    const employee: any = await Employee.findOne({ id: employeeId });
    if (!employee) {
        const alreadyRemoved = await Employee.findOne({ id: employeeId, isRemoved: true });
        if (alreadyRemoved) return { ok: false, status: 409, error: 'This employee has already been removed from the portal.' };
        return { ok: false, status: 404, error: 'Employee not found' };
    }
    if (employee.role === 'FOUNDER' && actor.role !== 'FOUNDER') return { ok: false, status: 403, error: 'Only a Founder can remove a Founder account.' };

    const now = new Date().toISOString();
    // 1. Access first: mark removed (blocks login + every lookup), scramble the password of this record, drop mappings
    const marked = await Employee.findOneAndUpdate(
        { id: employeeId, isRemoved: { $ne: true } },
        {
            $set: {
                isRemoved: true, removedAt: now, removedBy: actor.id, removedByName: actor.name,
                removalSnapshot: { location: employee.location, reportsTo: employee.reportsTo, status: employee.status, role: employee.role },
                status: finalStatus, location: '', reportsTo: [],
                password: `removed-${crypto.randomBytes(24).toString('hex')}`,
            },
        },
        { returnDocument: 'after' }
    );
    if (!marked) return { ok: false, status: 409, error: 'This employee has already been removed from the portal.' };
    revokeSessionsFor(employee.email, employee.role);

    // 2. Nobody keeps reporting to a removed person
    const reportees = await Employee.updateMany({ reportsTo: employeeId }, { $pull: { reportsTo: employeeId } });
    // 3. Active assignments
    const schedules = await WorkSchedule.deleteMany({ employeeId });
    // 4. Requests that were still waiting for a decision are closed (decided history is untouched)
    const note = `Closed: employee removed from the portal by ${actor.name}`;
    const leaves = await LeaveRequest.updateMany(
        { employeeId, status: { $in: ['Pending', 'Pending HOI Approval'] } },
        { $set: { status: 'Rejected', reasonForAction: note, rejectedBy: actor.id, rejectedByName: actor.name, rejectedByRole: actor.role, rejectedAt: now } }
    );
    const responsibilities = await AdditionalResponsibility.updateMany(
        { employeeId, status: 'Pending' },
        { $set: { status: 'Rejected', rejectionReason: note, approvedBy: actor.id, approvedByName: actor.name, approvedAt: now } }
    );
    return {
        ok: true, employee,
        cleaned: {
            reporteesUnlinked: reportees.modifiedCount, workScheduleEntriesRemoved: schedules.deletedCount,
            pendingLeavesClosed: leaves.modifiedCount, pendingResponsibilitiesClosed: responsibilities.modifiedCount,
        },
    };
}

/**
 * SERVER-ONLY: permanent delete (HR asked for it): after the exit is completed, the employee record of THIS
 * designation and every record that belongs to the employee are deleted from the database. Cannot be undone.
 * Records of other people stay; only their link to this employee was removed above (reporting lines).
 * Uploaded files (photos / documents in storage) are not touched.
 */
export async function purgeEmployeeData(employeeId: string): Promise<Record<string, number>> {
    const M = await import('@/models/Schemas');
    const targets: [string, any, Record<string, unknown>][] = [
        ['attendance', M.Attendance, { employeeId }],
        ['attendanceViolations', M.AttendanceViolation, { employeeId }],
        ['markAsPresentRequests', M.MarkAsPresentRequest, { employeeId }],
        ['overrideRequests', M.OverrideRequest, { employeeId }],
        ['leaves', M.LeaveRequest, { employeeId }],
        ['workFromHome', M.WorkFromHome, { employeeId }],
        ['workSchedules', M.WorkSchedule, { employeeId }],
        ['reimbursements', M.ReimbursementClaim, { employeeId }],
        ['responsibilities', M.AdditionalResponsibility, { employeeId }],
        ['performanceStars', M.PerformanceStar, { employeeId }],
        ['pipRecords', M.PIPRecord, { employeeId }],
        ['meetingRequests', M.MeetingRequest, { employeeId }],
        ['tickets', M.Ticket, { $or: [{ raisedBy: employeeId }, { targetEmployeeId: employeeId }] }],
        ['sprintPlans', M.SprintPlan, { facultyId: employeeId }],
        ['lectureReports', M.LectureReport, { facultyId: employeeId }],
        ['facultyPreferences', M.FacultyPreference, { facultyId: employeeId }],
        ['curriculumTasks', M.CurriculumTask, { assignedTo: employeeId }],
        ['notifications', M.Notification, { recipientId: employeeId }],
        ['reminderLogs', M.ReminderLog, { recipientId: employeeId }],
        ['accessGrants', M.AccessGrant, { recipientId: employeeId }],
        ['accessManagers', M.AccessManager, { employeeId }],
        ['exitRecords', M.ExitRecord, { employeeId }],
        ['employee', M.Employee, { id: employeeId }],
    ];
    const deleted: Record<string, number> = {};
    for (const [name, model, filter] of targets) {
        if (!model) continue;
        try { deleted[name] = (await model.deleteMany(filter)).deletedCount || 0; }
        catch (e: any) { console.error(`[employee-removal] could not delete ${name} of ${employeeId}:`, e?.message); deleted[name] = -1; }
    }
    return deleted;
}

/** Removed employees stay in "Deleted Employees" this long, then everything of theirs is deleted automatically */
export const AUTO_DELETE_DAYS = 60;
export const autoDeleteDate = (from: Date = new Date()) => new Date(from.getTime() + AUTO_DELETE_DAYS * 86400000).toISOString();

/**
 * SERVER-ONLY: permanent delete of employees whose 2-month keep period is over (set when HR completed the exit:
 * removalSnapshot.autoDeleteAt). Employees removed before this rule existed have no date and are never touched.
 * Safe to run often (each run deletes only what is due). Returns the ids that were deleted.
 */
export async function purgeExpiredRemovedEmployees(now: Date = new Date()) {
    const due: any[] = await Employee.find({ isRemoved: true, 'removalSnapshot.autoDeleteAt': { $lte: now.toISOString() } } as any).select('id name').limit(20).lean();
    const done: string[] = [];
    for (const e of due) {
        try {
            const deleted = await purgeEmployeeData(e.id);
            console.log(`[employee-removal] ${e.id} (${e.name}) deleted automatically ${AUTO_DELETE_DAYS} days after removal:`, deleted);
            done.push(e.id);
        } catch (err: any) {
            console.error(`[employee-removal] automatic delete of ${e.id} failed:`, err?.message);
        }
    }
    return done;
}