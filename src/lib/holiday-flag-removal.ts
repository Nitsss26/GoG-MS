/**
 * SERVER-ONLY. When a day becomes a holiday (announced / approved / assigned later), every active attendance flag of
 * that day — Late Clock-In, Early Clock-Out, Missing Clock-Out, Location Mismatch, Dress Code — is removed for the
 * employees the holiday applies to. It uses the existing Flag Removal record (the original flag is never changed or
 * deleted), so:
 *   • payable days / salary no longer count the flag or its deduction, and
 *   • the warning ladder skips it — the next Late Clock-In gets the right instance (e.g. the removed 2nd late →
 *     the next late is the 2nd warning again).
 * No e-mail is sent for these automatic removals. Never throws (a holiday is never blocked by this).
 */
import { FlagRemoval } from '@/models/SalaryModule';
import { Holiday } from '@/models/Schemas';
import { listFlags, resolveFlag, actorRoleLabel, fmtDate } from '@/lib/salary-module';

/** The same reading payable days use: employee-only holiday → those people; otherwise all / their college */
export const holidayCoversEmployee = (h: any, emp: { id?: string; location?: string }) => {
    if (emp.id && (h?.excludedEmployeeIds || []).includes(emp.id)) return false; // removed for this employee only
    const ids: string[] = h?.employeeIds || [];
    if (ids.length) return !!emp.id && ids.includes(emp.id);
    return !!h?.forAll || !(h?.collegeIds || []).length || (!!emp.location && (h.collegeIds || []).includes(emp.location));
};

export async function removeFlagsForHolidays(days: any[], actor: any): Promise<{ removed: number; skippedOwn: number }> {
    const out = { removed: 0, skippedOwn: 0 };
    try {
        const list = (days || []).filter(h => h && h.date && (h.status === undefined || h.status === 'Approved'));
        if (!list.length) return out;
        const dates = Array.from(new Set(list.map(h => String(h.date)))).sort();
        const rows = (await listFlags({ from: dates[0], to: dates[dates.length - 1] })).filter(r => r.status === 'Active' && dates.includes(r.date));
        const me: any = actor?.employee || {};
        const now = new Date().toISOString();
        for (const r of rows) {
            const h = list.find(x => x.date === r.date && holidayCoversEmployee(x, { id: r.employeeId, location: r.location }));
            if (!h) continue;
            // same rule as manual Flag Removal: HR / HR Executive may remove their own flag, nobody else may
            if (actor?.id && r.employeeId === actor.id && actor.role !== 'HR') { out.skippedOwn++; continue; }
            const found = await resolveFlag(r.flagId);
            if (!found || found.row.status !== 'Active') continue;
            const doc = {
                id: `FR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
                flagId: found.row.flagId, source: found.row.source, sourceId: found.row.sourceId,
                employeeId: found.row.employeeId, employeeName: found.row.employeeName, employeeRole: found.row.role,
                dept: found.row.dept, designation: found.row.designation, location: found.row.location, locationName: found.row.locationName,
                flagCategory: found.row.category, flagType: found.row.type, flagLabel: found.row.typeLabel, flagDate: found.row.date,
                originalStatus: 'active', updatedStatus: 'removed', originalSnapshot: found.snapshot,
                removalReason: `Holiday: ${h.name || 'Holiday'} (${fmtDate(h.date)}) — flag removed automatically because this day is a holiday.`,
                supportingImageUrl: '',
                removedBy: actor?.id || 'SYSTEM', removedByName: actor?.name || 'System', removedByRole: actorRoleLabel(actor) || 'System',
                removedByDesignation: me.designation || me.current_designation_at_gog || actorRoleLabel(actor) || 'System',
                removedAt: now, emailStatus: AUTO_HOLIDAY_EMAIL_STATUS, emailAttempts: 0, emailLog: [],
            };
            try { await FlagRemoval.create(doc); out.removed++; }
            catch (e: any) { if (e?.code !== 11000) throw e; } // removed at the same moment by someone else
        }
    } catch (e: any) {
        console.error('[holiday-flag-removal]', e?.message);
    }
    return out;
}

/** Marks the automatic removals written above (manual Flag Removals by HR are never touched) */
export const AUTO_HOLIDAY_EMAIL_STATUS = 'NOT_SENT (automatic — holiday)';

/**
 * A holiday (or part of it) was removed: the attendance flags that were removed automatically ONLY because of it
 * become active again — for the employees `affected` matches on that date, unless another approved holiday still
 * covers them that day. Manual Flag Removals stay as they are. Never throws.
 */
export async function restoreFlagsAfterHolidayRemoval(date: string, affected: (emp: { id?: string; location?: string }) => boolean): Promise<number> {
    let restored = 0;
    try {
        const auto: any[] = await FlagRemoval.find({ flagDate: date, emailStatus: AUTO_HOLIDAY_EMAIL_STATUS }).select('id employeeId location').lean();
        const mine = auto.filter(r => affected({ id: r.employeeId, location: r.location }));
        if (!mine.length) return 0;
        const still: any[] = await Holiday.find({ date, status: 'Approved' }).select('date forAll collegeIds employeeIds excludedEmployeeIds').lean();
        const back = mine.filter(r => !still.some(h => holidayCoversEmployee(h, { id: r.employeeId, location: r.location })));
        if (back.length) {
            const res: any = await FlagRemoval.deleteMany({ id: { $in: back.map(r => r.id) }, emailStatus: AUTO_HOLIDAY_EMAIL_STATUS });
            restored = res?.deletedCount ?? back.length;
        }
    } catch (e: any) {
        console.error('[holiday-flag-restore]', e?.message);
    }
    return restored;
}