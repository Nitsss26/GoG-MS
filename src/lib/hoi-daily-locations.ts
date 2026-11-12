/**
 * HOI weekday clock-in locations (HR → Location Management → "Every weekday", Mon … Sun — repeats every week).
 *   • several allowed colleges for that weekday (any of them = normal clock-in, no location justification)
 *   • Automatic Location Fetch (Field Visit / Meeting): outside the assigned colleges the HOI may clock in at the
 *     actual GPS position with a mandatory reason — only on the weekday(s) HR selected it.
 * Stored on the weekday's WorkSchedule row: `locations`, `autoLocationFetch`, `locationsFor` (= `location` when saved).
 * A specific-date entry for that day (single location, as before) takes priority over the weekday rule.
 * Safe for client and server (no imports).
 */
export const FIELD_VISIT_LOCATION = 'FIELD_VISIT';      // WorkSchedule.location when HR selected Automatic Location Fetch only
export const AUTO_FETCH_KEY = 'AUTO_FETCH';             // audit marker
export const AUTO_FETCH_LABEL = 'Automatic Location Fetch (Field Visit / Meeting)';
export const FIELD_VISIT_LABEL = 'Field Visit / Meeting';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Mon … Sun of a YYYY-MM-DD date (a weekday name is returned as it is) */
export const weekdayOf = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? DAY[new Date(`${date}T12:00:00Z`).getUTCDay()] : date);

/**
 * Allowed colleges + Automatic Location Fetch for `date` (YYYY-MM-DD, or a weekday name) from the schedule row that
 * applies that day: the weekday's row (date = "Mon" …). A specific-date row is the old single-location entry, so it
 * has none (→ set: false, the normal single-location rule). Rows changed later on another page are ignored
 * (locationsFor must still equal location).
 */
export function hoiDailyLocations(schedule: any, date: string): { ids: string[]; autoFetch: boolean; set: boolean } {
    const valid = !!schedule && schedule.date === weekdayOf(date) && Array.isArray(schedule.locations) && schedule.locationsFor === schedule.location;
    if (!valid) return { ids: [], autoFetch: false, set: false };
    return { ids: (schedule.locations as any[]).map(String).filter(Boolean), autoFetch: !!schedule.autoLocationFetch, set: true };
}