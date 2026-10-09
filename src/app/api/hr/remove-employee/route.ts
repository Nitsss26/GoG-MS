import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import { Employee, WorkSchedule, LeaveRequest, AdditionalResponsibility } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { revokeSessionsFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * HR: remove an ex-employee from the portal.  Body: { employeeId }
 *
 * Soft delete. The employee record and the history that refers to it (attendance, decided leaves,
 * approved responsibilities, tickets, reports) stay in the database so nothing is left pointing at a
 * missing record. Everything that gives access or makes the person an active member is removed:
 *   - login + existing sessions (immediately)
 *   - college / location and reporting (HOI, manager, team) mapping, in both directions
 *   - work schedule assignment
 *   - requests still waiting for a decision (leave, responsibility) are closed
 * After this the employee is invisible to every normal query (see the Employee schema), so they are not
 * listed anywhere and are not picked for emails / notifications.
 */
export async function POST(request: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (actor.role !== "HR" && actor.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can remove an employee from the portal.' }, { status: 403 });
        }

        const { employeeId } = await request.json();
        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }
        if (employeeId === actor.id) {
            return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
        }

        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) {
            const alreadyRemoved = await Employee.findOne({ id: employeeId, isRemoved: true });
            if (alreadyRemoved) {
                return NextResponse.json({ error: 'This employee has already been removed from the portal.' }, { status: 409 });
            }
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        if (employee.role === "FOUNDER" && actor.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only a Founder can remove a Founder account.' }, { status: 403 });
        }

        const now = new Date().toISOString();

        // 1. Access first: mark removed (blocks login + every lookup), scramble the password, drop active mappings
        const marked = await Employee.findOneAndUpdate(
            { id: employeeId },
            {
                $set: {
                    isRemoved: true,
                    removedAt: now,
                    removedBy: actor.id,
                    removedByName: actor.name,
                    removalSnapshot: { location: employee.location, reportsTo: employee.reportsTo, status: employee.status, role: employee.role },
                    status: "Resigned",
                    location: "",
                    reportsTo: [],
                    password: `removed-${crypto.randomBytes(24).toString('hex')}`
                }
            },
            { returnDocument: 'after' }
        );
        if (!marked) {
            return NextResponse.json({ error: 'This employee has already been removed from the portal.' }, { status: 409 });
        }
        revokeSessionsFor(employee.email);

        // 2. Nobody keeps reporting to a removed person
        const reportees = await Employee.updateMany({ reportsTo: employeeId }, { $pull: { reportsTo: employeeId } });

        // 3. Active assignments
        const schedules = await WorkSchedule.deleteMany({ employeeId });

        // 4. Requests that were still waiting for a decision are closed (decided history is untouched)
        const note = `Closed: employee removed from the portal by ${actor.name}`;
        const leaves = await LeaveRequest.updateMany(
            { employeeId, status: { $in: ["Pending", "Pending HOI Approval"] } },
            { $set: { status: "Rejected", reasonForAction: note, rejectedBy: actor.id, rejectedByName: actor.name, rejectedByRole: actor.role, rejectedAt: now } }
        );
        const responsibilities = await AdditionalResponsibility.updateMany(
            { employeeId, status: "Pending" },
            { $set: { status: "Rejected", rejectionReason: note, approvedBy: actor.id, approvedByName: actor.name, approvedAt: now } }
        );

        return NextResponse.json({
            success: true,
            message: "Employee successfully removed from the portal.",
            employeeId,
            name: employee.name,
            cleaned: {
                reporteesUnlinked: reportees.modifiedCount,
                workScheduleEntriesRemoved: schedules.deletedCount,
                pendingLeavesClosed: leaves.modifiedCount,
                pendingResponsibilitiesClosed: responsibilities.modifiedCount
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
