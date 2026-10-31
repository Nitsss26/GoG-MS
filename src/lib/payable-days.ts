/**
 * GOG OMS — payable days (pure, no database, no money).
 *
 * Rules (confirmed by management, same as the existing payroll policy):
 *  - Sundays and approved holidays are paid days off; leave is only counted on working days.
 *  - Present / late / approved WFH on a working day = payable.
 *  - One paid leave day per month; further approved leave in the month is unpaid (LOP). Half-day leave = 0.5.
 *    Short leave does not change payable days. Unused paid leave does not carry forward.
 *  - Working day with no attendance and no approved leave = loss of pay. Pending leave is shown as pending
 *    (loss of pay until it is approved).
 *  - Attendance penalties (Late Clock-In / Early Clock-Out / Missing Clock-Out): the existing SOP ladder
 *    (1st, 2nd, Final warning, 4th Half-Day, 5th+ Full-Day). A deduction counts only after HR marks it
 *    "Approved for Payroll" (existing rule).
 *  - Dress code: the same ladder on the month's rejected dress-code photos (1st, 2nd, Final warning,
 *    4th Half-Day, 5th+ Full-Day).
 *  - A removed flag (Flag Removal) is never counted: no deduction, no dress-code instance, not an active flag.
 *  - A penalty never deducts more than the payable part of its day (no double deduction).
 *  - Days after "asOf" (current month) are shown as upcoming and projected as payable (provisional).
 */

export type PdAttendance = { _id?: any; date: string; status?: string; clockIn?: string; clockOut?: string; workMode?: string; location?: string; dressCodeStatus?: string; dressCodeRejectionReasons?: string[] };
export type PdLeave = { id?: string; type?: string; leaveType?: string; startDate: string; endDate: string; days?: number; status?: string };
export type PdViolation = { id: string; date: string; type: string; level?: string; instance?: number; proposedDeduction?: string; hrStatus?: string; scheduledTime?: string; actualTime?: string };
export type PdInput = {
    month: string; asOf?: string; joiningDate?: string; exitDate?: string;
    attendance: PdAttendance[]; leaves: PdLeave[]; holidays: string[]; violations: PdViolation[];
    removed: Map<string, { removedAt?: string; removedByName?: string; removalReason?: string }>;
    paidLeavePerMonth?: number; weeklyOff?: number[];
    /** HR payable-day corrections (ACTIVE), by date */
    corrections?: Map<string, { id: string; direction?: string; correctionCategory?: string; correctionReason?: string; correctedByName?: string; correctedByRole?: string; correctedAt?: string; relatedTicketId?: string }>;
};

export const LEVEL_LABEL: Record<string, string> = {
    FIRST_WARNING: 'First Warning', SECOND_WARNING: 'Second Warning', FINAL_WARNING: 'Final Warning',
    HALF_DAY: 'Half-Day Deduction', FULL_DAY: 'Full-Day Deduction', MISSING_ALERT: 'Missing Clock-Out Alert',
};
export const TYPE_LABEL: Record<string, string> = { LATE_IN: 'Late Clock-In', EARLY_OUT: 'Early Clock-Out', MISSING_OUT: 'Missing Clock-Out', DRESS_CODE: 'Dress Code' };
export const CATEGORY_OF: Record<string, string> = { LATE_IN: 'CLOCK_IN', EARLY_OUT: 'CLOCK_OUT', MISSING_OUT: 'CLOCK_OUT', DRESS_CODE: 'DRESS_CODE' };
/** HR statuses that close a violation (existing rule: not counted) */
export const VIOLATION_CLOSED = ['Waived', 'Approved'];

/** Same ladder as the attendance SOP (src/lib/attendance-violations.ts → escalation) */
export function ladder(instance: number) {
    if (instance <= 1) return { level: 'FIRST_WARNING', deduction: 'None' };
    if (instance === 2) return { level: 'SECOND_WARNING', deduction: 'None' };
    if (instance === 3) return { level: 'FINAL_WARNING', deduction: 'None' };
    if (instance === 4) return { level: 'HALF_DAY', deduction: 'Half-Day' };
    return { level: 'FULL_DAY', deduction: 'Full-Day' };
}
const units = (d?: string) => (/full/i.test(String(d || '')) ? 1 : /half/i.test(String(d || '')) ? 0.5 : 0);

export type PenaltyItem = {
    flagId: string; date: string; type: string; typeLabel: string; category: string;
    instance: number | null; level: string; levelLabel: string; deduction: string;
    status: string;              // Warning | Deducted | Pending HR Verification | Awaiting Explanation | Waived | Resolved | Removed
    deductedDays: number;        // counted in payable days
    active: boolean;             // an active flag
    detail?: string;
    removal?: { removedAt?: string; removedByName?: string; removalReason?: string };
};
export type DayRow = {
    date: string; weekday: string; attendance: string; leave: string;
    payableStatus: 'Payable' | 'Non-Payable' | 'Partly Payable' | 'Upcoming' | 'Not Employed';
    payable: number; lop: number; reason: string; penalties: string[];
    clockIn?: string; clockOut?: string; holiday?: boolean; weeklyOff?: boolean;
    /** what the records alone give (kept when HR corrects the day) */
    basePayableStatus?: string; basePayable?: number; baseReason?: string;
    correctable?: boolean;              // non-payable / partly payable working day that HR may mark payable
    /** payable day that HR may mark non-payable */
    deductible?: boolean;
    correction?: { id: string; direction?: string; correctionCategory?: string; correctionReason?: string; correctedByName?: string; correctedByRole?: string; correctedAt?: string; relatedTicketId?: string };
};

const pad = (n: number) => String(n).padStart(2, '0');
export const daysInMonth = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const dow = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const nextDay = (d: string) => { const [y, m, day] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, day + 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const isApproved = (s?: string) => /^approved$/i.test(String(s || ''));
const isPending = (s?: string) => /pending/i.test(String(s || ''));
const isShort = (l: PdLeave) => /short/i.test(`${l.type || ''} ${l.leaveType || ''}`);

export function calculatePayableDays(input: PdInput) {
    const N = daysInMonth(input.month);
    const weeklyOff = input.weeklyOff || [0];
    const holidays = new Set(input.holidays || []);
    const att = new Map<string, PdAttendance>();
    for (const a of input.attendance || []) if (a?.date) att.set(a.date, a);

    // ── leave units per day ──
    const approvedLeave = new Map<string, { u: number; label: string }>();
    const pendingLeave = new Map<string, string>();
    for (const l of input.leaves || []) {
        if (!l?.startDate || isShort(l)) continue;
        const half = typeof l.days === 'number' && l.days > 0 && l.days < 1;
        const label = l.type || l.leaveType || 'Leave';
        for (let d = l.startDate; d <= (l.endDate || l.startDate); d = nextDay(d)) {
            if (!d.startsWith(input.month)) continue;
            if (isApproved(l.status)) {
                const prev = approvedLeave.get(d);
                approvedLeave.set(d, { u: Math.min(1, (prev?.u || 0) + (half ? 0.5 : 1)), label });
            } else if (isPending(l.status)) pendingLeave.set(d, label);
        }
    }

    // ── penalties / flags ──
    const penalties: PenaltyItem[] = [];
    for (const v of (input.violations || []).filter(x => x?.date?.startsWith(input.month)).sort((a, b) => a.date.localeCompare(b.date))) {
        const flagId = `VIO:${v.id}`;
        const rem = input.removed.get(flagId);
        const closed = VIOLATION_CLOSED.includes(String(v.hrStatus || ''));
        const u = units(v.proposedDeduction);
        const approved = /approved for payroll/i.test(String(v.hrStatus || ''));
        const status = rem ? 'Removed'
            : approved ? (u ? 'Deducted' : 'Warning')
                : v.hrStatus === 'Waived' ? 'Waived'
                    : v.hrStatus === 'Approved' ? 'Resolved'
                        : /pending hr/i.test(String(v.hrStatus || '')) ? 'Pending HR Verification'
                            : /awaiting/i.test(String(v.hrStatus || '')) ? 'Awaiting Explanation'
                                : /rejected/i.test(String(v.hrStatus || '')) ? 'Explanation Rejected'
                                    : 'Warning';
        penalties.push({
            flagId, date: v.date, type: v.type, typeLabel: TYPE_LABEL[v.type] || v.type, category: CATEGORY_OF[v.type] || 'OTHER',
            instance: v.instance ?? null, level: v.level || '', levelLabel: LEVEL_LABEL[v.level || ''] || v.level || '',
            deduction: v.proposedDeduction || 'None', status,
            deductedDays: !rem && approved ? u : 0,
            active: !rem && !closed,
            detail: v.actualTime ? `${v.scheduledTime ? `Scheduled ${v.scheduledTime} · ` : ''}Actual ${v.actualTime}` : undefined,
            ...(rem ? { removal: rem } : {}),
        });
    }
    // dress code: the month's rejected photos, numbered in date order; removed ones do not count
    let dressN = 0;
    for (const a of (input.attendance || []).filter(x => x?.date?.startsWith(input.month) && x.dressCodeStatus === 'Rejected').sort((x, y) => x.date.localeCompare(y.date))) {
        const flagId = `DRESS:${String(a._id)}`;
        const rem = input.removed.get(flagId);
        const reasons = Array.isArray(a.dressCodeRejectionReasons) ? a.dressCodeRejectionReasons.join(', ') : '';
        if (rem) {
            penalties.push({ flagId, date: a.date, type: 'DRESS_CODE', typeLabel: 'Dress Code', category: 'DRESS_CODE', instance: null, level: '', levelLabel: '—', deduction: 'None', status: 'Removed', deductedDays: 0, active: false, detail: reasons || undefined, removal: rem });
            continue;
        }
        dressN++;
        const l = ladder(dressN);
        penalties.push({
            flagId, date: a.date, type: 'DRESS_CODE', typeLabel: 'Dress Code', category: 'DRESS_CODE', instance: dressN,
            level: l.level, levelLabel: LEVEL_LABEL[l.level], deduction: l.deduction,
            status: units(l.deduction) ? 'Deducted' : 'Warning', deductedDays: units(l.deduction), active: true,
            detail: reasons || undefined,
        });
    }
    penalties.sort((a, b) => a.date.localeCompare(b.date) || a.typeLabel.localeCompare(b.typeLabel));
    const penaltyByDate = new Map<string, { u: number; labels: string[] }>();
    for (const p of penalties) {
        const cur = penaltyByDate.get(p.date) || { u: 0, labels: [] };
        if (p.deductedDays) cur.u = Math.min(1, cur.u + p.deductedDays);
        if (p.status !== 'Removed') cur.labels.push(`${p.typeLabel}${p.levelLabel && p.levelLabel !== '—' ? ` — ${p.levelLabel}` : ''}`);
        penaltyByDate.set(p.date, cur);
    }

    // ── day by day ──
    let entitlementLeft = input.paidLeavePerMonth ?? 1;
    const days: DayRow[] = [];
    let workingDays = 0, employedDays = 0, presentDays = 0, paidLeave = 0, unpaidLeave = 0, absentDays = 0, penaltyDays = 0;
    let holidayDays = 0, weeklyOffDays = 0, upcomingDays = 0, pendingLeaveDays = 0, correctedDays = 0, hrDeductedDays = 0;
    /** HR correction on top of the records (attendance / leave shown on the row stay as recorded) */
    const applyCorrection = (row: DayRow) => {
        const corr = input.corrections?.get(row.date);
        if (!corr) return;
        const who = `${corr.correctedByName || 'HR'}${corr.correctedByRole ? ` (${corr.correctedByRole})` : ''}`;
        if (corr.direction === 'TO_NON_PAYABLE') {
            if (row.payable <= 0) return;
            hrDeductedDays = r2(hrDeductedDays + row.payable);
            row.correction = corr; row.correctable = false; row.deductible = false;
            row.lop = 1; row.payable = 0; row.payableStatus = 'Non-Payable';
            row.reason = `Marked non-payable by ${who} — ${corr.correctionCategory || 'Correction'} · Records: ${row.baseReason}`;
        } else {
            if (row.lop <= 0) return;
            correctedDays = r2(correctedDays + row.lop);
            row.correction = corr; row.correctable = false; row.deductible = false;
            row.lop = 0; row.payable = 1; row.payableStatus = 'Payable';
            row.reason = `Marked payable by ${who} — ${corr.correctionCategory || 'Correction'} · Records: ${row.baseReason}`;
        }
    };
    for (let i = 1; i <= N; i++) {
        const date = `${input.month}-${pad(i)}`;
        const off = weeklyOff.includes(dow(date)), hol = holidays.has(date);
        if (!off && !hol) workingDays++;
        const row: DayRow = { date, weekday: WD[dow(date)], attendance: '—', leave: '', payableStatus: 'Payable', payable: 1, lop: 0, reason: '', penalties: penaltyByDate.get(date)?.labels || [], holiday: hol, weeklyOff: off };
        if ((input.joiningDate && date < input.joiningDate) || (input.exitDate && date > input.exitDate)) {
            Object.assign(row, { payableStatus: 'Not Employed', payable: 0, reason: input.joiningDate && date < input.joiningDate ? 'Before joining date' : 'After last working day' });
            days.push(row); continue;
        }
        employedDays++;
        const a = att.get(date);
        const present = !!a && !/absent/i.test(String(a.status || '')) && (!!a.clockIn || /present|late/i.test(String(a.status || '')));
        if (a) { row.clockIn = a.clockIn || ''; row.clockOut = a.clockOut || ''; }
        if (a) row.attendance = a.workMode === 'WFH' || String(a.location || '').toLowerCase() === 'wfh' ? 'WFH' : (a.status || (a.clockIn ? 'Present' : '—'));
        if (input.asOf && date > input.asOf) {
            Object.assign(row, { payableStatus: 'Upcoming', reason: 'Not yet worked (projected as payable)' });
            upcomingDays++; days.push(row); continue;
        }
        if (hol || off) {
            if (hol) holidayDays++; else weeklyOffDays++;
            row.attendance = row.attendance === '—' ? (hol ? 'Holiday' : 'Weekly Off') : row.attendance;
            row.reason = hol ? 'Holiday (paid)' : 'Sunday — weekly off (paid)';
            row.basePayableStatus = row.payableStatus; row.basePayable = row.payable; row.baseReason = row.reason;
            row.correctable = false; row.deductible = true;
            applyCorrection(row);
            days.push(row); continue;
        }
        let lop = 0; const why: string[] = [];
        const lv = approvedLeave.get(date);
        if (lv) {
            const paid = Math.min(lv.u, entitlementLeft); entitlementLeft = r2(entitlementLeft - paid);
            const unpaid = r2(lv.u - paid);
            paidLeave += paid; unpaidLeave += unpaid; lop += unpaid;
            row.leave = `${lv.u < 1 ? 'Half-day ' : ''}${lv.label}${paid ? ` · ${paid} paid` : ''}${unpaid ? ` · ${unpaid} unpaid` : ''}`;
            if (paid) why.push(`Approved paid leave (${paid} day${paid === 1 ? '' : 's'}, monthly paid leave)`);
            if (unpaid) why.push(`Approved leave beyond the monthly paid leave → unpaid (${unpaid} day)`);
            if (lv.u < 1) {
                if (present) presentDays += 0.5;
                else { lop += 0.5; absentDays += 0.5; why.push('No attendance for the other half of the day → unpaid (0.5 day)'); }
            }
        } else if (present) {
            presentDays++; why.push(row.attendance === 'WFH' ? 'Work from home (payable)' : 'Present');
        } else {
            lop = 1; absentDays++;
            if (pendingLeave.has(date)) { pendingLeaveDays++; row.leave = `${pendingLeave.get(date)} (pending)`; why.push('Leave pending approval — unpaid until it is approved'); }
            else why.push(a ? 'Absent (loss of pay)' : 'No attendance on a working day (loss of pay)');
        }
        const pen = penaltyByDate.get(date)?.u || 0;
        if (pen) {
            const applied = Math.min(pen, Math.max(0, 1 - lop));
            if (applied) { lop += applied; penaltyDays += applied; why.push(`Penalty deduction ${applied} day`); }
        }
        row.lop = r2(lop); row.payable = r2(1 - lop);
        row.payableStatus = lop >= 1 ? 'Non-Payable' : lop > 0 ? 'Partly Payable' : 'Payable';
        row.reason = why.join(' · ');
        row.basePayableStatus = row.payableStatus; row.basePayable = row.payable; row.baseReason = row.reason;
        row.correctable = row.lop > 0;
        row.deductible = row.payable > 0;
        applyCorrection(row);
        days.push(row);
    }
    const lopDays = r2(days.reduce((s, d) => s + d.lop, 0));
    return {
        month: input.month, provisional: !!input.asOf, asOf: input.asOf || null,
        totalDays: N, workingDays, employedDays,
        payableDays: r2(employedDays - lopDays),
        presentDays: r2(presentDays), holidayDays, weeklyOffDays, upcomingDays,
        paidLeaveEntitlement: input.paidLeavePerMonth ?? 1,
        paidLeaves: r2(paidLeave), unpaidLeaves: r2(unpaidLeave), absentDays: r2(absentDays), pendingLeaveDays,
        penaltyDays: r2(penaltyDays), lopDays,
        nonPayableDays: lopDays,
        basePayableDays: r2(employedDays - lopDays - correctedDays + hrDeductedDays),
        correctedDays, hrDeductedDays,
        activeFlags: penalties.filter(p => p.active).length,
        dressCodeViolations: penalties.filter(p => p.type === 'DRESS_CODE' && p.status !== 'Removed').length,
        dressCodeDeductionDays: r2(penalties.filter(p => p.type === 'DRESS_CODE').reduce((s, p) => s + p.deductedDays, 0)),
        pendingPenalties: penalties.filter(p => p.status === 'Pending HR Verification' || p.status === 'Awaiting Explanation').length,
        removedFlags: penalties.filter(p => p.status === 'Removed').length,
        penalties, days,
    };
}
export type PayableCalc = ReturnType<typeof calculatePayableDays>;