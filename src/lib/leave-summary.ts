/**
 * SERVER-ONLY: Employee Leave Summary (HR / AD / HOI).
 *
 * Reads the existing LeaveRequest records — nothing is copied or duplicated.
 * Visibility:
 *   HR, AD (and FOUNDER)  → every employee in the portal
 *   HOI                   → only the employees in their reporting hierarchy (Employee.reportsTo, direct + indirect)
 */
import { Employee, LeaveRequest, Location } from '@/models/Schemas';

export const LEAVE_SUMMARY_ORG_ROLES = ['HR', 'AD', 'FOUNDER'];
export const LEAVE_SUMMARY_ROLES = [...LEAVE_SUMMARY_ORG_ROLES, 'HOI'];

export type LeaveStatusGroup = 'APPROVED' | 'PENDING' | 'REJECTED' | 'OTHER';

/** Existing statuses: "Approved", "Rejected", "Pending", "Pending HOI Approval" (anything else, e.g. cancelled, is OTHER) */
export function statusGroup(status?: string): LeaveStatusGroup {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'APPROVED';
    if (s === 'rejected') return 'REJECTED';
    if (s.startsWith('pending')) return 'PENDING';
    return 'OTHER';
}

const isYmd = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Calendar dates covered by a leave (start → end, inclusive). Capped at 366 days for bad data. */
export function coveredDates(start?: string, end?: string): string[] {
    if (!isYmd(start)) return [];
    const last = isYmd(end) && end! >= start! ? end! : start!;
    const out: string[] = [];
    const d = new Date(start + 'T00:00:00Z');
    while (out.length < 366) {
        const ymd = d.toISOString().slice(0, 10);
        out.push(ymd);
        if (ymd >= last) break;
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The leave's duration inside a period. The stored `days` (working days, 0.5 for half a day) is the leave's
 * duration; when the leave crosses the period boundary it is split in proportion to the covered dates.
 */
export function daysInPeriod(leave: any, inPeriod: (ymd: string) => boolean) {
    const dates = coveredDates(leave.startDate, leave.endDate);
    const inside = dates.filter(inPeriod);
    const total = Number(leave.days) > 0 ? Number(leave.days) : dates.length;
    if (!dates.length || !inside.length) return { days: 0, dates: inside };
    return { days: inside.length === dates.length ? total : round2(total * inside.length / dates.length), dates: inside };
}

export type Period = { month: number | null; year: number | null };
export function periodFilter({ month, year }: Period) {
    return (ymd: string) => {
        if (year && Number(ymd.slice(0, 4)) !== year) return false;
        if (month && Number(ymd.slice(5, 7)) !== month) return false;
        return true;
    };
}

/** Everyone who reports to `managerId`, directly or through someone else (existing reportsTo mapping) */
export async function reportingTree(managerId: string): Promise<any[]> {
    const all: any[] = await Employee.find({}).select('id name role dept designation location reportsTo status').lean();
    const children = new Map<string, any[]>();
    all.forEach(e => (e.reportsTo || []).forEach((m: string) => {
        if (!children.has(m)) children.set(m, []);
        children.get(m)!.push(e);
    }));
    const seen = new Set<string>([managerId]);
    const out: any[] = [];
    const queue = [managerId];
    while (queue.length) {
        const id = queue.shift()!;
        for (const e of children.get(id) || []) {
            if (seen.has(e.id)) continue;
            seen.add(e.id);
            out.push(e);
            queue.push(e.id);
        }
    }
    return out;
}

/** Employees this user may see on the Leave Summary (enforced here, never on the page) */
export async function employeesInLeaveScope(actor: { id: string; role: string; delegation?: { sources: any[] } }): Promise<any[]> {
    // Give Access: union of the selected sources' scopes
    if (actor.delegation) {
        const byId = new Map<string, any>();
        for (const src of actor.delegation.sources) {
            (await employeesInLeaveScope({ id: src.id, role: src.role })).forEach((e: any) => { if (!byId.has(e.id)) byId.set(e.id, e); });
        }
        byId.delete(actor.id);
        return Array.from(byId.values());
    }
    if (LEAVE_SUMMARY_ORG_ROLES.includes(actor.role)) {
        return Employee.find({}).select('id name role dept designation location reportsTo status').lean();
    }
    if (actor.role === 'HOI') return reportingTree(actor.id);
    return [];
}

/** location value (id, name or short name) → college name */
export async function collegeNameMap() {
    const locs: any[] = await Location.find({}).select('id name shortName').lean();
    const map = new Map<string, { id: string; name: string }>();
    locs.forEach(l => [l.id, l.name, l.shortName].filter(Boolean).forEach(k => map.set(String(k), { id: String(l.id), name: String(l.name || l.id) })));
    return (value?: string) => (value ? map.get(value) || { id: value, name: value } : { id: '', name: 'Not assigned' });
}

export function emptyTotals() {
    return {
        totalDaysTaken: 0,   // approved leave days (= leave actually taken)
        approvedCount: 0, approvedDays: 0,
        pendingCount: 0, pendingDays: 0,
        rejectedCount: 0, rejectedDays: 0,
        totalRequests: 0,
    };
}

/** Adds one leave (already cut to the period) to the totals */
export function addToTotals(t: ReturnType<typeof emptyTotals>, group: LeaveStatusGroup, days: number) {
    t.totalRequests += 1;
    if (group === 'APPROVED') { t.approvedCount += 1; t.approvedDays = round2(t.approvedDays + days); t.totalDaysTaken = t.approvedDays; }
    else if (group === 'PENDING') { t.pendingCount += 1; t.pendingDays = round2(t.pendingDays + days); }
    else if (group === 'REJECTED') { t.rejectedCount += 1; t.rejectedDays = round2(t.rejectedDays + days); }
}

export async function leavesOf(employeeIds: string[]) {
    if (!employeeIds.length) return [];
    return LeaveRequest.find({ employeeId: { $in: employeeIds } }).lean();
}
