import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkFromHome, LeaveRequest, Employee, Attendance } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { managedEmployeeIds } from '@/lib/leave-scope';
import { notifySafe, newId, zonedNow, isValidYmd, addDays } from '@/lib/academic';
import { WFH_POLICY, WFH_TYPE_LABEL, canApplyWfh } from '@/lib/wfh-policy';

export const dynamic = 'force-dynamic';

/**
 * Work From Home applications (separate from leave).
 *   GET  ?view=mine | queue | approved   — own applications / applications this user may decide / approved WFH
 *   POST { wfhType, startDate, endDate, reason, workLocation, documentUrl?, remarks }   — apply (always for the logged-in employee;
 *        roles in WFH_POLICY.applyRoles). Attendance can be marked from home while the application is pending (provisional).
 *   PUT  { id, action: "approve" | "reject" | "cancel", remarks }
 * Permissions are decided on the server from the session (src/lib/wfh-policy.ts).
 */
const actorRole = (a: any) => a.session?.actualRole || a.role;
const isAdmin = (a: any) => WFH_POLICY.adminApproverRoles.includes(a.role);
const LEAVE_BLOCKING = { $nin: ['Rejected', 'Cancelled', 'Withdrawn'] };
const fmt = (ymd: string) => { const [y, m, d] = ymd.split('-'); return `${d}-${m}-${y}`; };
const range = (a: any) => (a.startDate === a.endDate ? fmt(a.startDate) : `${fmt(a.startDate)} to ${fmt(a.endDate)}`);
const historyItem = (actor: any, action: string, status: string, remarks = '') =>
    ({ action, status, by: actor.id, byName: actor.name, role: actorRole(actor), at: new Date().toISOString(), remarks });

/** Ids whose applications this actor may decide (null = everyone) */
async function decidableIds(actor: any): Promise<Set<string> | null> {
    if (isAdmin(actor)) return null;
    if (WFH_POLICY.managerApproverRoles.includes(actor.role)) return managedEmployeeIds(actor);
    return new Set();
}
const canDecide = (actor: any, app: any, ids: Set<string> | null) =>
    app.status === 'Pending' && (WFH_POLICY.allowSelfApproval || app.employeeId !== actor.id) && (ids === null || ids.has(app.employeeId));

/** Approvers to notify: the applicant's reporting managers (approver roles) + HR (+ Founders for HR / TL / AD / Founder applicants) */
async function approversFor(emp: any) {
    const managers = (Array.isArray(emp.reportsTo) ? emp.reportsTo : emp.reportsTo ? [emp.reportsTo] : []).filter(Boolean);
    const or: any[] = [{ role: { $in: ['HR', 'HR_EXECUTIVE'] } }];
    if (managers.length) or.push({ id: { $in: managers }, role: { $in: WFH_POLICY.managerApproverRoles } });
    if (['HR', 'HR_EXECUTIVE', 'TL', 'AD', 'FOUNDER'].includes(emp.role)) or.push({ role: 'FOUNDER' });
    const list: any[] = await Employee.find({ $or: or, status: { $ne: 'Inactive' } }).select('id name email role').lean();
    return list.filter(e => e.id !== emp.id);
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const view = new URL(req.url).searchParams.get('view') || 'mine';
        const ids = await decidableIds(actor);
        let query: any;
        if (view === 'queue') {
            if (ids !== null && ids.size === 0) return NextResponse.json({ applications: [], canApprove: false });
            query = ids === null ? {} : { employeeId: { $in: Array.from(ids) } };
        } else if (view === 'approved') {
            // own + everyone this user may see as an approver (used by the attendance views)
            query = { status: 'Approved', ...(ids === null ? {} : { employeeId: { $in: [actor.id, ...Array.from(ids)] } }) };
        } else {
            query = { employeeId: actor.id };
        }
        const apps: any[] = await WorkFromHome.find(query).sort({ createdAt: -1 }).lean();
        return NextResponse.json({
            applications: apps.map(a => ({ ...a, _id: String(a._id), canDecide: canDecide(actor, a, ids), canCancel: a.employeeId === actor.id && (a.status === 'Pending' || (a.status === 'Approved' && a.startDate >= zonedNow().ymd)) })),
            canApprove: ids === null || ids.size > 0,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const emp: any = actor.employee?.toObject ? actor.employee.toObject() : actor.employee;
        if (!emp || /inactive|terminated|resigned|exited/i.test(String(emp.status || ''))) return NextResponse.json({ error: 'Only active employees can apply for Work From Home.' }, { status: 403 });
        if (!canApplyWfh({ role: actor.role, actualRole: actor.session?.actualRole || emp.role })) return NextResponse.json({ error: 'Work From Home is not available for your role.' }, { status: 403 });

        const body = await req.json().catch(() => ({}));
        const wfhType = body.wfhType === 'HALF_DAY' ? 'HALF_DAY' : 'FULL_DAY';
        const startDate = String(body.startDate || ''); const endDate = String(body.endDate || body.startDate || '');
        const reason = String(body.reason || '').trim();
        const today = zonedNow().ymd;
        if (!isValidYmd(startDate) || !isValidYmd(endDate)) return NextResponse.json({ error: 'Select valid start and end dates.' }, { status: 400 });
        if (startDate < today) return NextResponse.json({ error: 'Work From Home cannot start in the past.' }, { status: 400 });
        if (endDate < startDate) return NextResponse.json({ error: 'End date must be on or after the start date.' }, { status: 400 });
        if (wfhType === 'HALF_DAY' && endDate !== startDate) return NextResponse.json({ error: 'A half-day Work From Home is for a single date.' }, { status: 400 });
        let days = 0; for (let d = startDate; d <= endDate; d = addDays(d, 1)) days++;
        if (days > WFH_POLICY.maxDaysPerApplication) return NextResponse.json({ error: `One application can cover at most ${WFH_POLICY.maxDaysPerApplication} days.` }, { status: 400 });
        if (reason.length < 3) return NextResponse.json({ error: 'Please give the reason.' }, { status: 400 });
        const workLocation = String(body.workLocation || '').trim().slice(0, 200);
        if (workLocation.length < 3) return NextResponse.json({ error: 'Please enter your remote work location.' }, { status: 400 });
        const documentUrl = String(body.documentUrl || '').trim();
        if (documentUrl && !/^https:\/\/\S+$/i.test(documentUrl)) return NextResponse.json({ error: 'The supporting document was not uploaded correctly. Please upload it again.' }, { status: 400 });
        const managerIds = (Array.isArray(emp.reportsTo) ? emp.reportsTo : emp.reportsTo ? [emp.reportsTo] : []).filter(Boolean);
        const managers: any[] = managerIds.length ? await Employee.find({ id: { $in: managerIds } }).select('name').lean() : [];

        // No duplicate WFH for the same dates, and no clash with a leave request
        const overlap = { startDate: { $lte: endDate }, endDate: { $gte: startDate } };
        const dup: any = await WorkFromHome.findOne({ employeeId: actor.id, status: { $in: ['Pending', 'Approved'] }, ...overlap }).lean();
        if (dup) return NextResponse.json({ error: `You already have a ${dup.status.toLowerCase()} Work From Home application for ${range(dup)} (${dup.id}).` }, { status: 409 });
        const leave: any = await LeaveRequest.findOne({ employeeId: actor.id, status: LEAVE_BLOCKING, ...overlap }).lean();
        if (leave) return NextResponse.json({ error: `These dates clash with your ${String(leave.status).toLowerCase()} leave (${fmt(leave.startDate)} to ${fmt(leave.endDate)}).` }, { status: 409 });

        const app = await WorkFromHome.create({
            id: newId('WFH'), employeeId: actor.id, employeeName: emp.name, employeeRole: actorRole(actor),
            designation: emp.designation || '', dept: emp.dept || '',
            wfhType, startDate, endDate, days, reason, remarks: String(body.remarks || '').trim(), status: 'Pending',
            workLocation, ...(documentUrl ? { documentUrl } : {}), reportingManagerName: managers.map(m => m.name).join(', '),
            history: [historyItem(actor, 'Applied', 'Pending', reason)],
        });
        await notifySafe({
            recipients: await approversFor(emp),
            title: `Work From Home Application — ${emp.name}`,
            message: `${emp.name} applied for Work From Home (${WFH_TYPE_LABEL[wfhType]}) on ${range(app)}.`,
            type: 'WFH_SUBMITTED', link: '/attendance?tab=wfh-applications', entityType: 'WorkFromHome', entityId: app.id, actor,
            rows: [{ label: 'Employee', value: `${emp.name} (${emp.id})` }, { label: 'Dates', value: `${range(app)} · ${days} day(s)` }, { label: 'Type', value: WFH_TYPE_LABEL[wfhType] }, { label: 'Work location', value: workLocation }, { label: 'Reason', value: reason }],
        });
        return NextResponse.json({ success: true, application: app });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id, action, remarks } = await req.json().catch(() => ({}));
        const note = String(remarks || '').trim();
        const app: any = await WorkFromHome.findOne({ id }).lean();
        if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
        const now = new Date().toISOString();
        const owner: any = await Employee.findOne({ id: app.employeeId }).select('id name email role').lean();

        if (action === 'cancel') {
            if (app.employeeId !== actor.id) return NextResponse.json({ error: 'Only the employee can cancel their application.' }, { status: 403 });
            const allowed = app.status === 'Pending' || (app.status === 'Approved' && app.startDate >= zonedNow().ymd);
            if (!allowed) return NextResponse.json({ error: `This application is ${app.status} and can no longer be cancelled.` }, { status: 409 });
            const updated = await WorkFromHome.findOneAndUpdate({ id, status: app.status }, {
                $set: { status: 'Cancelled', cancelledAt: now, cancelledBy: actor.id },
                $push: { history: historyItem(actor, 'Cancelled', 'Cancelled', note) },
            }, { new: true });
            if (!updated) return NextResponse.json({ error: 'The application was changed meanwhile. Refresh and try again.' }, { status: 409 });
            // Attendance already marked under it is kept and goes to HR review
            await Attendance.updateMany({ wfhApplicationId: id }, { $set: { wfhStatus: 'Cancelled', wfhReviewRequired: true } });
            if (owner) await notifySafe({ recipients: [owner], title: 'Work From Home Application Cancelled', message: `Your Work From Home application for ${range(app)} was cancelled.`, type: 'WFH_CANCELLED', link: '/attendance', entityType: 'WorkFromHome', entityId: app.id, actor: { id: '', name: 'GoG OMS' }, email: false });
            return NextResponse.json({ success: true, application: updated, message: 'Application cancelled.' });
        }

        if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        if (!WFH_POLICY.allowSelfApproval && app.employeeId === actor.id) return NextResponse.json({ error: 'You cannot approve or reject your own Work From Home application.' }, { status: 403 });
        const ids = await decidableIds(actor);
        if (!(ids === null || ids.has(app.employeeId))) return NextResponse.json({ error: 'You are not authorised to decide this application.' }, { status: 403 });
        if (app.status !== 'Pending') return NextResponse.json({ error: `This application is already ${app.status}${app.approverName ? ` by ${app.approverName}` : ''}.` }, { status: 409 });
        if (action === 'reject' && note.length < 3) return NextResponse.json({ error: 'Please give the reason for rejecting.' }, { status: 400 });

        const status = action === 'approve' ? 'Approved' : 'Rejected';
        // Atomic: only one approver can decide a pending application
        const updated: any = await WorkFromHome.findOneAndUpdate({ id, status: 'Pending' }, {
            $set: { status, approverId: actor.id, approverName: actor.name, approverRole: actorRole(actor), decisionRemarks: note, decidedAt: now },
            $push: { history: historyItem(actor, status, status, note) },
        }, { new: true });
        if (!updated) return NextResponse.json({ error: 'This application was already decided by someone else.' }, { status: 409 });
        // Attendance marked under this application: approved → confirmed; rejected → kept (never deleted) and flagged for HR review
        await Attendance.updateMany({ wfhApplicationId: id }, { $set: status === 'Approved' ? { wfhStatus: 'Approved', wfhReviewRequired: false } : { wfhStatus: 'Rejected', wfhReviewRequired: true } });
        if (owner) await notifySafe({
            recipients: [owner],
            title: `Work From Home ${status}`,
            message: `Your Work From Home application for ${range(app)} was ${status.toLowerCase()} by ${actor.name}.`,
            type: status === 'Approved' ? 'WFH_APPROVED' : 'WFH_REJECTED', link: '/attendance', entityType: 'WorkFromHome', entityId: app.id, actor,
            rows: [{ label: 'Dates', value: range(app) }, { label: 'Type', value: WFH_TYPE_LABEL[app.wfhType] || app.wfhType }, { label: 'Decision', value: `${status} by ${actor.name}` }, { label: 'Remarks', value: note }],
        });
        return NextResponse.json({ success: true, application: updated, message: `Application ${status.toLowerCase()}.` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}