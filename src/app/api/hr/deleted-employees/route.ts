import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, ExitRecord, Location, Attendance, LeaveRequest, Ticket, ReimbursementClaim, WorkFromHome } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { AUTO_DELETE_DAYS } from '@/lib/employee-removal';

export const dynamic = 'force-dynamic';

/**
 * HR → Workforce → Deleted Employees: employees removed from the portal. Their full details stay here for
 * AUTO_DELETE_DAYS after the removal; then the employee and all their records are deleted automatically.
 *   GET            list
 *   GET ?id=EMP01  full details of one removed employee (profile, exit checklist, record counts)
 * HR, HR Executive and Founder. Passwords are never returned.
 */
const HIDDEN = ['password', '__v'];
const clean = (e: any) => { const o = { ...e }; HIDDEN.forEach(k => delete o[k]); return o; };
const daysLeft = (iso?: string) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : null);

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['HR', 'FOUNDER'].includes(actor.role)) return NextResponse.json({ error: 'Only HR can view deleted employees.' }, { status: 403 });
        const id = new URL(req.url).searchParams.get('id');

        if (id) {
            const emp: any = await Employee.findOne({ id, isRemoved: true } as any).lean();
            if (!emp) return NextResponse.json({ error: 'Deleted employee not found (it may have been deleted permanently already).' }, { status: 404 });
            const snap = emp.removalSnapshot || {};
            const [exit, loc, counts] = await Promise.all([
                ExitRecord.findOne({ employeeId: id }).sort({ completedAt: -1, createdAt: -1 }).lean(),
                snap.location ? Location.findOne({ $or: [{ id: snap.location }, { name: snap.location }] }).select('name').lean() : null,
                Promise.all([
                    Attendance.countDocuments({ employeeId: id }), LeaveRequest.countDocuments({ employeeId: id }),
                    WorkFromHome.countDocuments({ employeeId: id }), Ticket.countDocuments({ $or: [{ raisedBy: id }, { targetEmployeeId: id }] }),
                    ReimbursementClaim.countDocuments({ employeeId: id }),
                ]),
            ]);
            const managers: any[] = snap.reportsTo?.length ? await Employee.find({ id: { $in: snap.reportsTo }, isRemoved: { $in: [true, false, null] } } as any).select('id name role').lean() : [];
            return NextResponse.json({
                employee: clean(emp),
                lastLocation: (loc as any)?.name || snap.location || '',
                lastManagers: managers.map(m => `${m.name} (${m.role})`),
                exit: exit ? clean(exit) : null,
                records: { attendance: counts[0], leaves: counts[1], workFromHome: counts[2], tickets: counts[3], reimbursements: counts[4] },
                autoDeleteAt: snap.autoDeleteAt || null, daysLeft: daysLeft(snap.autoDeleteAt), keepDays: AUTO_DELETE_DAYS,
            });
        }

        const rows: any[] = await Employee.find({ isRemoved: true } as any).sort({ removedAt: -1 })
            .select('id name email phone role designation dept status joiningDate removedAt removedByName removalSnapshot').limit(500).lean();
        const exits: any[] = await ExitRecord.find({ employeeId: { $in: rows.map(r => r.id) }, status: 'COMPLETED' }).select('employeeId lastWorkingDay leavingReason leavingReasonOther completedByName completedAt').lean();
        const exitBy = new Map(exits.map(x => [x.employeeId, x]));
        return NextResponse.json({
            keepDays: AUTO_DELETE_DAYS,
            employees: rows.map(r => {
                const x: any = exitBy.get(r.id);
                return {
                    id: r.id, name: r.name, email: r.email, phone: r.phone || '', role: r.removalSnapshot?.role || r.role, designation: r.designation || '', dept: r.dept || '',
                    status: r.status || '', joiningDate: r.joiningDate || '', removedAt: r.removedAt || '', removedByName: r.removedByName || '',
                    lastWorkingDay: x?.lastWorkingDay || '', leavingReason: x ? (x.leavingReason === 'Other' && x.leavingReasonOther ? x.leavingReasonOther : x.leavingReason) : '',
                    autoDeleteAt: r.removalSnapshot?.autoDeleteAt || null, daysLeft: daysLeft(r.removalSnapshot?.autoDeleteAt),
                };
            }),
        });
    } catch (e: any) {
        console.error('[hr/deleted-employees]', e?.message);
        return NextResponse.json({ error: 'Could not load deleted employees.' }, { status: 500 });
    }
}