import { Location, Attendance, LocationClockInAttempt } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';
import { reverseGeocode } from '@/lib/reverse-geocode';

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

/* ── HOI location detection: match status + reverse-geocoded address on every clock-in ── */

/** HOI only (OM and other roles unchanged) */
export const tracksDetectedAddress = (employee: any) => employee?.role === 'HOI';

/** Extra fields for a matched HOI visit */
export async function matchedVisitExtras(employee: any, lat?: number, lng?: number) {
    if (!tracksDetectedAddress(employee) || typeof lat !== 'number' || typeof lng !== 'number') return {};
    const detectedAddress = await reverseGeocode(lat, lng);
    return { locationMatchStatus: 'matched', ...(detectedAddress ? { detectedAddress } : {}) };
}

/**
 * HOI clock-in attempt outside every assigned location. The geofence rule still refuses the clock-in; the attempt
 * (coordinates, address, time) is stored for HR review, and — when the day's attendance is open — shown in the
 * day's timeline as "No Location Match" (it does not change the current location, status or payable day).
 */
export async function recordUnmatchedAttempt(employee: any, date: string, time: string, at: Date, lat: number, lng: number, accuracy: number | undefined, assignedIds: string[], opts: { timeline?: boolean; outcome?: string; detectedAddress?: string | null } = {}) {
    const detectedAddress = opts.detectedAddress !== undefined ? opts.detectedAddress : await reverseGeocode(lat, lng);
    if (!tracksDetectedAddress(employee)) return { detectedAddress, time };
    // nearest assigned location (for HR context only)
    let nearest: any = null;
    try {
        const locs: any[] = await Location.find({ id: { $in: assignedIds } }).lean();
        for (const l of locs) {
            const d = getDistance(lat, lng, l.lat, l.lng);
            if (!nearest || d < nearest.d) nearest = { id: l.id, name: locationLabel(l), d };
        }
    } catch { /* optional */ }
    // the same refused attempt repeated within 2 minutes is stored once
    const recent: any = await LocationClockInAttempt.findOne({ employeeId: employee.id, at: { $gte: new Date(at.getTime() - 120000) } }).sort({ at: -1 }).lean();
    if (recent && typeof recent.lat === 'number' && getDistance(lat, lng, recent.lat, recent.lng) < 0.1) {
        return { detectedAddress: recent.detectedAddress ?? detectedAddress, time: recent.time, duplicate: true };
    }
    const attempt = {
        id: `LCA${at.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        employeeId: employee.id, employeeName: employee.name, date, time, at, lat, lng,
        ...(typeof accuracy === 'number' ? { accuracyMeters: Math.round(accuracy) } : {}),
        ...(detectedAddress ? { detectedAddress } : {}),
        locationMatchStatus: 'unmatched',
        ...(opts.outcome ? { reviewStatus: opts.outcome } : {}),
        ...(nearest ? { nearestLocationId: nearest.id, nearestLocationName: nearest.name, nearestDistanceKm: Math.round(nearest.d * 100) / 100 } : {}),
    };
    await LocationClockInAttempt.create(attempt);
    if (opts.timeline === false) return { detectedAddress, time };
    await Attendance.updateOne(
        { employeeId: employee.id, date, clockIn: { $exists: true, $ne: '' }, status: { $ne: 'Absent' }, $or: [{ clockOut: { $exists: false } }, { clockOut: null }, { clockOut: '' }] },
        { $push: { locationVisits: { id: attempt.id, event: 'UNMATCHED_ATTEMPT', locationId: '', locationName: detectedAddress || '', time, at, lat, lng, ...(attempt.accuracyMeters !== undefined ? { accuracyMeters: attempt.accuracyMeters } : {}), locationMatchStatus: 'unmatched', ...(detectedAddress ? { detectedAddress } : {}) } } }
    ).catch(() => {});
    return { detectedAddress, time };
}

export const NO_ADDRESS_LABEL = 'Coordinates Available — Address Unavailable';

/**
 * HOI outside every assigned location: the clock-in is recorded at the actual GPS position.
 * The "place" gets a coordinate id (about 100 m) so a repeated clock-in at the same spot is not stored twice.
 */
export async function unmatchedPlace(lat: number, lng: number) {
    const detectedAddress = await reverseGeocode(lat, lng);
    const label = detectedAddress || NO_ADDRESS_LABEL;
    return {
        place: { id: `GPS:${lat.toFixed(3)},${lng.toFixed(3)}`, name: label, shortName: label },
        extras: { locationMatchStatus: 'unmatched', ...(detectedAddress ? { detectedAddress } : {}) },
        detectedAddress,
    };
}