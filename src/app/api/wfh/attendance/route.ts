import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { WorkFromHome, Employee, Attendance } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { managedEmployeeIds } from '@/lib/leave-scope';
import { WFH_POLICY } from '@/lib/wfh-policy';

export const dynamic = 'force-dynamic';

/**
 * Work From Home Attendance Log (read-only).
 *   GET  → WFH attendance records with the linked application.
 * HR / HR Executive / Founder see everyone; a reporting manager (HOI / AD / TL / OM) sees their own hierarchy;
 * anybody else gets 403. The captured position is never returned — only whether one was captured.
 */
const hours = (inT?: string, outT?: string) => {
    if (!inT || !outT) return null;
    const toMin = (t: string) => { const [h, m, s] = t.split(':').map(Number); return h * 60 + (m || 0) + (s || 0) / 60; };
    const d = toMin(outT) - toMin(inT);
    return d > 0 ? Math.round(d / 6) / 10 : null; // one decimal
};

export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        let scope: Set<string> | null = null;
        if (!WFH_POLICY.adminApproverRoles.includes(actor.role)) {
            if (!WFH_POLICY.managerApproverRoles.includes(actor.role)) return NextResponse.json({ error: 'Only HR or a reporting manager can view the Work From Home attendance log.' }, { status: 403 });
            scope = await managedEmployeeIds(actor);
        }
        const query: any = { $or: [{ workMode: 'WFH' }, { location: 'WFH' }] };
        if (scope) query.employeeId = { $in: Array.from(scope) };
        // employees HR removed from attendance are left out
        const hidden: any[] = await Employee.find({ hideFromAttendance: true } as any).select('id').lean();
        if (hidden.length) query.$and = [{ employeeId: { $nin: hidden.map(h => h.id) } }];
        const recs: any[] = await Attendance.find(query).sort({ date: -1 }).limit(2000)
            .select('employeeId date clockIn clockOut status location workMode wfhApplicationId wfhStatus wfhReviewRequired wfhWorkLocation wfhLocation').lean();

        const empIds = Array.from(new Set(recs.map(r => r.employeeId)));
        const appIds = Array.from(new Set(recs.map(r => r.wfhApplicationId).filter(Boolean)));
        const [emps, apps]: [any[], any[]] = await Promise.all([
            Employee.find({ id: { $in: empIds }, isRemoved: { $in: [true, false, null] } }).select('id name dept designation role').lean(),
            appIds.length ? WorkFromHome.find({ id: { $in: appIds } }).select('id status startDate endDate wfhType reason workLocation documentUrl approverName decidedAt decisionRemarks createdAt').lean() : Promise.resolve([]),
        ]);
        const empById = new Map(emps.map(e => [e.id, e]));
        const appById = new Map(apps.map(a => [a.id, a]));

        // one row per employee per day (older duplicate records are shown once)
        const seen = new Set<string>();
        const records = recs.filter(r => { const k = `${r.employeeId}|${r.date}`; if (seen.has(k)) return false; seen.add(k); return true; }).map(r => {
            const e = empById.get(r.employeeId) || {};
            const a = r.wfhApplicationId ? appById.get(r.wfhApplicationId) : null;
            return {
                employeeId: r.employeeId, employeeName: e.name || r.employeeId, dept: e.dept || '', designation: e.designation || '', role: e.role || '',
                date: r.date, clockIn: r.clockIn || '', clockOut: r.clockOut || '', totalHours: hours(r.clockIn, r.clockOut),
                attendanceStatus: r.status,
                wfhApplicationId: r.wfhApplicationId || '',
                // older remote days (WFH set in the schedule) have no application
                approvalStatus: a?.status || r.wfhStatus || (r.wfhApplicationId ? 'Unknown' : 'Scheduled WFH'),
                reviewRequired: !!r.wfhReviewRequired,
                workLocation: r.wfhWorkLocation || a?.workLocation || 'Remote',
                locationCaptured: !!r.wfhLocation,
                application: a ? { id: a.id, status: a.status, startDate: a.startDate, endDate: a.endDate, wfhType: a.wfhType, reason: a.reason, workLocation: a.workLocation, documentUrl: a.documentUrl || '', approverName: a.approverName || '', decidedAt: a.decidedAt || '', decisionRemarks: a.decisionRemarks || '', createdAt: a.createdAt } : null,
            };
        });
        return NextResponse.json({ records });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}