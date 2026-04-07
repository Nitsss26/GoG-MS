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

        if (!dateGroups[e.date]) dateGroups[e.date] = [];
        dateGroups[e.date].push(i);
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
