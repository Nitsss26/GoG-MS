import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import {
    LEAVE_SUMMARY_ROLES, employeesInLeaveScope, collegeNameMap, leavesOf, statusGroup,
    daysInPeriod, periodFilter, emptyTotals, addToTotals, coveredDates,
} from '@/lib/leave-summary';

export const dynamic = 'force-dynamic';

/**
 * Employee Leave Summary — HR / AD: every employee; HOI: own reporting hierarchy only.
 *
 * GET ?month=1..12|All &year=YYYY|All &status=All|APPROVED|PENDING|REJECTED
 *     &q=<name or id> &college=<location id> &department= &designation=
 *     &employeeId=<id>   → also returns that employee's date-wise leave history
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!LEAVE_SUMMARY_ROLES.includes(actor.role)) return NextResponse.json({ error: 'The leave summary is available to HR, AD and HOI only.' }, { status: 403 });

        const sp = new URL(req.url).searchParams;
        const monthRaw = sp.get('month') || 'All';
        const yearRaw = sp.get('year') || 'All';
        const month = /^(?:[1-9]|1[0-2])$/.test(monthRaw) ? Number(monthRaw) : null;
        const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
        if (monthRaw !== 'All' && month === null) return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
        if (yearRaw !== 'All' && year === null) return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
        const status = (sp.get('status') || 'All').toUpperCase();
        const q = (sp.get('q') || '').trim().toLowerCase();
        const college = sp.get('college') || 'All';
        const department = sp.get('department') || 'All';
        const designation = sp.get('designation') || 'All';
        const employeeId = sp.get('employeeId');

        const inScope = (await employeesInLeaveScope(actor)).filter((e: any) => e.id !== actor.id || actor.role !== 'HOI');
        const collegeOf = await collegeNameMap();
        const inPeriod = periodFilter({ month, year });

        const leaves: any[] = await leavesOf(inScope.map((e: any) => e.id));
        const byEmp = new Map<string, any[]>();
        leaves.forEach(l => { if (!byEmp.has(l.employeeId)) byEmp.set(l.employeeId, []); byEmp.get(l.employeeId)!.push(l); });

        // Years that have leave data (for the Year dropdown), plus the current year
        const years = new Set<number>([new Date().getFullYear()]);
        leaves.forEach(l => coveredDates(l.startDate, l.endDate).forEach(d => years.add(Number(d.slice(0, 4)))));

        const cards = inScope.map((e: any) => {
            const c = collegeOf(e.location);
            const totals = emptyTotals();
            let matchesStatus = status === 'ALL';
            (byEmp.get(e.id) || []).forEach(l => {
                const part = daysInPeriod(l, inPeriod);
                if (!part.dates.length) return;
                const g = statusGroup(l.status);
                addToTotals(totals, g, part.days);
                if (g === status) matchesStatus = true;
            });
            return {
                id: e.id, name: e.name, role: e.role, designation: e.designation || '', department: e.dept || '',
                collegeId: c.id, college: c.name, summary: totals, matchesStatus,
            };
        });

        const filtered = cards.filter(c =>
            (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) &&
            (college === 'All' || c.collegeId === college) &&
            (department === 'All' || c.department === department) &&
            (designation === 'All' || c.designation === designation) &&
            c.matchesStatus
        ).sort((a, b) => b.summary.totalRequests - a.summary.totalRequests || a.name.localeCompare(b.name));

        const uniq = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort();
        const response: any = {
            success: true,
            scope: actor.role === 'HOI' ? 'REPORTEES' : 'ALL',
            period: { month, year },
            employees: filtered.map(({ matchesStatus, ...c }) => c),
            totalInScope: cards.length,
            options: {
                colleges: Array.from(new Map(cards.filter(c => c.collegeId).map(c => [c.collegeId, { id: c.collegeId, name: c.college }])).values()).sort((a, b) => a.name.localeCompare(b.name)),
                departments: uniq(cards.map(c => c.department)),
                designations: uniq(cards.map(c => c.designation)),
                years: Array.from(years).sort((a, b) => b - a),
            },
        };

        // ── One employee's date-wise leave history ──
        if (employeeId) {
            const emp = inScope.find((e: any) => e.id === employeeId);
            if (!emp) return NextResponse.json({ error: 'This employee is not in your authorized scope.' }, { status: 403 });
            const card = cards.find(c => c.id === employeeId)!;
            const own = byEmp.get(employeeId) || [];
            // approver names for the existing approval ids
            const approverIds = Array.from(new Set(own.flatMap(l => [l.hoiApproverId, l.hrApproverId]).filter(Boolean)));
            const approvers: any[] = approverIds.length ? await Employee.find({ id: { $in: approverIds } }).select('id name role').lean() : [];
            const nameOf = (id?: string) => approvers.find(a => a.id === id)?.name || id || '';

            const history = own.map(l => {
                const part = daysInPeriod(l, inPeriod);
                const g = statusGroup(l.status);
                return {
                    id: l.id, type: l.type, leaveType: l.leaveType, classification: l.classification,
                    startDate: l.startDate, endDate: l.endDate,
                    totalDays: Number(l.days) || coveredDates(l.startDate, l.endDate).length,
                    daysInPeriod: part.days, datesInPeriod: part.dates, allDates: coveredDates(l.startDate, l.endDate),
                    status: l.status, statusGroup: g,
                    reason: l.reason || '', reasonForAction: l.reasonForAction || '', appliedAt: l.appliedAt || '',
                    lossOfPayDays: l.lossOfPayDays || 0, proofUrls: l.proofUrls || [],
                    hoiApproval: l.hoiApproval || '', hoiApprover: nameOf(l.hoiApproverId), hoiApprovedAt: l.hoiApprovedAt || '',
                    hrApproval: l.hrApproval || '', hrApprover: nameOf(l.hrApproverId), hrApprovedAt: l.hrApprovedAt || '',
                    approvedByName: l.approvedByName || '', approvedByRole: l.approvedByRole || '', approvedAt: l.approvedAt || '',
                    rejectedByName: l.rejectedByName || '', rejectedByRole: l.rejectedByRole || '', rejectedAt: l.rejectedAt || '',
                };
            })
                .filter(h => h.datesInPeriod.length > 0 && (status === 'ALL' || h.statusGroup === status))
                .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '') || (b.appliedAt || '').localeCompare(a.appliedAt || ''));

            response.employee = { ...card, matchesStatus: undefined };
            response.history = history;
        }

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('leave-summary GET error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
