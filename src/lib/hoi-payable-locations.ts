/**
 * SERVER-ONLY: HR → Employee Salary Management → Payable Day Breakdown, HOI only — the day's location column:
 *   assigned = what HR set for that day (Work Location: weekday colleges / Automatic Location Fetch, a date entry,
 *              otherwise the Original Location); a clocked-in day keeps the list saved at clock-in.
 *   actual   = where the HOI clocked in (college, Work From Home, or the field-visit address + GPS) and the reason.
 * Read only — payable days are not changed by this.
 */
import { Attendance, WorkSchedule, Location } from '@/models/Schemas';
import { hoiDailyLocations, weekdayOf, FIELD_VISIT_LOCATION, FIELD_VISIT_LABEL } from '@/lib/hoi-daily-locations';

export type HoiDayLocation = {
    assigned: string; actual: string; actualType: 'College' | 'Field Visit' | 'WFH' | '';
    reason?: string; lat?: number; lng?: number; matched?: boolean;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export async function hoiLocationsForMonth(emp: any, month: string): Promise<Record<string, HoiDayLocation>> {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const start = `${month}-01`, end = `${month}-${String(last).padStart(2, '0')}`;
    const [att, sched, locs]: any[] = await Promise.all([
        Attendance.find({ employeeId: emp.id, date: { $gte: start, $lte: end } })
            .select('date location workMode fieldVisit fieldVisitAddress fieldVisitReason hoiDailyLocations hoiDailyLocationsLabel autoLocationFetch clockInLat clockInLng').lean(),
        WorkSchedule.find({ employeeId: emp.id, $or: [{ date: { $gte: start, $lte: end } }, { date: { $in: WEEKDAYS } }] })
            .select('date location locations locationsFor autoLocationFetch').lean(),
        Location.find({}).select('id name shortName').lean(),
    ]);
    const name = (v?: string) => {
        if (!v) return '';
        if (v === 'WFH') return 'Work From Home';
        if (v === FIELD_VISIT_LOCATION) return FIELD_VISIT_LABEL;
        const l = (locs as any[]).find(x => x.id === v || x.name === v || x.shortName === v);
        return l ? (l.shortName || l.name || l.id) : v;
    };
    const out: Record<string, HoiDayLocation> = {};
    for (let d = 1; d <= last; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        // same order as the clock-in: a date entry, then the weekday entry, then the Original Location
        const row = (sched as any[]).find(r => r.date === date) || (sched as any[]).find(r => r.date === weekdayOf(date));
        const daily = hoiDailyLocations(row, date);
        const a: any = (att as any[]).find(r => r.date === date);
        const assigned = a?.hoiDailyLocationsLabel
            || (daily.set ? [...daily.ids.map(name), ...(daily.autoFetch ? [FIELD_VISIT_LABEL] : [])].join(', ')
                : row?.location ? name(row.location) : emp.location ? `${name(emp.location)} (Original Location)` : '—');
        let actual = '', actualType: HoiDayLocation['actualType'] = '', matched: boolean | undefined;
        if (a) {
            if (a.workMode === 'WFH' || a.location === 'WFH') { actual = 'Work From Home'; actualType = 'WFH'; }
            else if (a.fieldVisit) { actual = a.fieldVisitAddress || 'Address unavailable'; actualType = 'Field Visit'; }
            else if (a.location) {
                actual = name(a.location); actualType = 'College';
                const ids: string[] = a.hoiDailyLocations || (daily.set ? daily.ids : row?.location ? [row.location] : []);
                matched = ids.length ? ids.includes(a.location) : undefined;
            }
        }
        out[date] = {
            assigned, actual, actualType,
            ...(a?.fieldVisitReason ? { reason: a.fieldVisitReason } : {}),
            ...(a?.fieldVisit && typeof a.clockInLat === 'number' ? { lat: a.clockInLat, lng: a.clockInLng } : {}),
            ...(matched !== undefined ? { matched } : {}),
        };
    }
    return out;
}
