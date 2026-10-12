import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * HR / Founder marks an employee Present or Absent for a date (Attendance → Global Roster "Mark Present / Mark Absent").
 * Body: { employeeId, date, status: "Present" | "Absent", clockIn?, clockOut?, location?, remarks? }
 *
 * The record keeps the existing status values ("Present" / "Absent"); the source (HR_MANUAL), who marked it and when
 * (server time) are stored next to it, and every change is appended to attendanceAudit (never overwritten).
 * Present: the times already on the record are kept; a new record gets the employee's expected times (sent by the page,
 * same as before). Absent: the record is kept with status "Absent" (the earlier times are kept in the audit entry).
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HR' && actor.role !== 'FOUNDER') return NextResponse.json({ error: 'Only HR can mark attendance.' }, { status: 403 });

        const { employeeId, date, status, clockIn, clockOut, location, remarks } = await req.json().catch(() => ({}));
        if (!employeeId || !YMD.test(String(date || ''))) return NextResponse.json({ error: 'Employee and date are required.' }, { status: 400 });
        if (status !== 'Present' && status !== 'Absent') return NextResponse.json({ error: 'Status must be Present or Absent.' }, { status: 400 });
        if (employeeId === actor.id) return NextResponse.json({ error: 'You cannot mark your own attendance.' }, { status: 403 });
        const emp: any = await Employee.findOne({ id: employeeId }).select('id location').lean();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

        const existing: any = await Attendance.findOne({ employeeId, date }).lean();
        const now = new Date().toISOString();
        const audit = {
            fromStatus: existing ? (existing.attendanceSource === 'HR_MANUAL' ? `HR Marked ${existing.status}` : existing.status) : 'No record',
            toStatus: `HR Marked ${status}`,
            previousClockIn: existing?.clockIn || '', previousClockOut: existing?.clockOut || '',
            by: actor.id, byName: actor.name, role: actor.session?.actualRole || actor.role, at: now, remarks: String(remarks || '').trim(),
        };
        const set: any = {
            status, attendanceSource: 'HR_MANUAL', markedBy: actor.id, markedByName: actor.name,
            markedByRole: actor.session?.actualRole || actor.role, markedAt: now, hrRemarks: audit.remarks,
            previousStatus: existing?.status || '', isApprovedByHR: true,
        };
        const unset: any = {};
        if (status === 'Present') {
            if (!existing?.clockIn) set.clockIn = HM.test(String(clockIn || '')) ? clockIn : '09:30';
            if (!existing?.clockOut && HM.test(String(clockOut || ''))) set.clockOut = clockOut;
            if (!existing?.location) set.location = String(location || emp.location || 'Office');
            set['flags.overridden'] = true;
        } else {
            // Absent: no working time on this day (the earlier times stay in the audit entry)
            unset.clockIn = 1; unset.clockOut = 1;
        }
        const op: any = { $set: set, $push: { attendanceAudit: audit } };
        if (Object.keys(unset).length) op.$unset = unset;
        const record = await Attendance.findOneAndUpdate({ employeeId, date }, op, { upsert: true, new: true });
        return NextResponse.json({ success: true, record });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}