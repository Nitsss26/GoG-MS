import { Location } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';

/**
 * Multiple-location attendance (HOI and OM).
 * HR assigns one or more attendance locations (Employee.attendanceLocations). The employee may clock in at any of
 * them, and — while the day's attendance is open — clock in again at another assigned location ("location visit").
 * One Attendance record per day is kept (one payable day); every visit is stored in Attendance.locationVisits.
 */
export const MULTI_LOCATION_ROLES = ['HOI', 'OM'];

/** Location visits are refused when the device reports a worse GPS accuracy than this (metres) */
export const MAX_VISIT_ACCURACY_M = 1000;

export const UNASSIGNED_LOCATION_ERROR = 'Clock-In Not Allowed: You are currently outside your assigned work locations. Please contact HR if you require access to this location.';

/** The employee's assigned attendance locations (HOI / OM only; empty list = feature not in use for them) */
export function assignedLocationsOf(employee: any): string[] {
    if (!employee || !MULTI_LOCATION_ROLES.includes(employee.role)) return [];
    return Array.isArray(employee.attendanceLocations) ? employee.attendanceLocations.filter(Boolean) : [];
}

/**
 * Server-side geofence match among the assigned locations only.
 * Deterministic: the nearest location whose radius contains the point (ties → location id order).
 * `ambiguous` lists every other assigned location whose geofence also contains the point.
 */
export async function matchAssignedLocation(lat: number, lng: number, ids: string[]) {
    const locs: any[] = await Location.find({ id: { $in: ids } }).lean();
    const inside = locs
        .map(c => ({ loc: c, d: getDistance(lat, lng, c.lat, c.lng) }))
        .filter(x => x.d <= (x.loc.radiusKm || 2))
        .sort((a, b) => a.d - b.d || String(a.loc.id).localeCompare(String(b.loc.id)));
    if (!inside.length) return null;
    return {
        location: inside[0].loc,
        distanceKm: Math.round(inside[0].d * 100) / 100,
        ambiguous: inside.slice(1).map(x => ({ id: x.loc.id, name: x.loc.shortName || x.loc.name })),
    };
}

export const locationLabel = (loc: any) => loc?.shortName || loc?.name || loc?.id || '';

export function makeVisit(event: 'CLOCK_IN' | 'LOCATION_CLOCK_IN' | 'CLOCK_OUT', loc: any, at: Date, time: string, lat?: number, lng?: number, accuracy?: number) {
    return {
        id: `LV${at.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        event,
        locationId: loc?.id || '',
        locationName: locationLabel(loc),
        time,
        at,
        ...(typeof lat === 'number' ? { lat } : {}),
        ...(typeof lng === 'number' ? { lng } : {}),
        ...(typeof accuracy === 'number' ? { accuracyMeters: Math.round(accuracy) } : {}),
    };
}