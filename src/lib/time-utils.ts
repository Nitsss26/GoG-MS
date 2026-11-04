export interface TimeRange {
    timeStart: string;
    timeStop: string;
    date: string;
    [key: string]: any;
}

/**
 * Validates HH:mm format (00-23:00-59)
 */
export function isValidTimeFormat(time: string): boolean {
    if (!time) return false;
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

/**
 * Converts HH:mm to total minutes from midnight
 */
export function timeToMinutes(time: string): number {
    if (!isValidTimeFormat(time)) return 0;
    const [hh, mm] = time.split(':').map(Number);
    return hh * 60 + mm;
}

/**
 * Validates a list of sprint entries for correct format and no overlaps
 */
export function validateSprintEntries<T extends TimeRange>(entries: T[]): { 
    valid: boolean; 
    error?: string; 
    invalidIndices?: number[] 
} {
    const invalidIndices = new Set<number>();
    const nightIndices = new Set<number>();
    const dateGroups: Record<string, number[]> = {};

    // First pass: check formats and basic range validity
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const isStartValid = isValidTimeFormat(e.timeStart);
        const isStopValid = isValidTimeFormat(e.timeStop);

        if (!isStartValid || !isStopValid) {
            invalidIndices.add(i);
            continue;
        }

        const start = timeToMinutes(e.timeStart);
        const end = timeToMinutes(e.timeStop);

        if (start >= end) {
            invalidIndices.add(i);
            continue;
        }

        // A class between 12:00 AM and 6:59 AM is almost always a wrong AM / PM (e.g. 1:05 instead of 13:05)
        if (start < 7 * 60) {
            nightIndices.add(i);
            continue;
        }

        if (!dateGroups[e.date]) dateGroups[e.date] = [];
        dateGroups[e.date].push(i);
    }

    if (nightIndices.size > 0 && invalidIndices.size === 0) {
        return {
            valid: false,
            error: "A class time is between 12:00 AM and 6:59 AM — please check AM / PM (e.g. 1:05 PM, not 1:05 AM).",
            invalidIndices: Array.from(nightIndices)
        };
    }
    if (invalidIndices.size > 0) {
        return { 
            valid: false, 
            error: "One or more entries have invalid time formats (HH:mm) or end time before start time.", 
            invalidIndices: Array.from(invalidIndices) 
        };
    }

    return { valid: true };
}

/**
 * Clock-in cutoff of a day (after it only a Mark-As-Present request is possible).
 * Existing policy: 11:59 AM. A shift that starts at 11:30 AM or later (e.g. 1:00 PM) gets the same gap as the
 * standard 09:30 shift (2 h 29 min after its start, e.g. 1:00 PM → 3:29 PM), so a late shift can clock in at all.
 * Returns "HH:MM" (24 h).
 */
export function clockInCutoff(scheduledIn?: string): string {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(scheduledIn || ''));
    if (!m) return '11:59';
    const start = Number(m[1]) * 60 + Number(m[2]);
    if (isNaN(start) || start < 11 * 60 + 30) return '11:59';
    const c = Math.min(start + 149, 23 * 60 + 59);
    return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}
/** "15:29" → "3:29 PM" */
export const cutoffLabel = (hm: string) => { const [h, mm] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };