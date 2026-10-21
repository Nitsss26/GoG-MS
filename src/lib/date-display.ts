/**
 * Display-only date formatting (stored values are not changed).
 * ddmmyyyy("2026-09-04") → "04-09-2026"; an ISO timestamp shows its IST date.
 * ddmmyyyyText("… on 2026-09-04 is …") → "… on 04-09-2026 is …" (every YYYY-MM-DD in a text).
 */
export function ddmmyyyy(v?: string | null): string {
    if (!v) return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "-");
    }
    return ddmmyyyyText(s);
}
export const ddmmyyyyText = (t?: string | null): string =>
    String(t ?? "").replace(/(^|[^\d])(\d{4})-(\d{2})-(\d{2})(?!\d)/g, (_m, pre, y, mo, d) => `${pre}${d}-${mo}-${y}`);