/**
 * Reverse geocoding (GPS coordinates → readable address) for HOI clock-in locations.
 * Uses OpenStreetMap Nominatim (no API key). Best effort: returns null when the service cannot be reached,
 * so a clock-in is never blocked by it — the UI then shows "Coordinates Available — Address Unavailable".
 */
const cache = new Map<string, { address: string | null; at: number }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

/** "MP Nagar, Bhopal" style short address from a Nominatim result */
export function formatAddress(data: any): string | null {
    const a = data?.address || {};
    const area = a.neighbourhood || a.suburb || a.quarter || a.residential || a.city_district || a.road || a.hamlet;
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district;
    const parts = [area, city].filter(Boolean);
    if (parts.length) return Array.from(new Set(parts)).join(', ');
    const dn = typeof data?.display_name === 'string' ? data.display_name : '';
    return dn ? dn.split(',').slice(0, 3).map((x: string) => x.trim()).join(', ') : null;
}

export async function reverseGeocode(lat: number, lng: number, timeoutMs = 3000): Promise<string | null> {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) return null;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.address;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'GOG-OMS/1.0 (attendance)', 'Accept-Language': 'en' }, cache: 'no-store' });
        if (!res.ok) return null;
        const address = formatAddress(await res.json());
        cache.set(key, { address, at: Date.now() });
        return address;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}