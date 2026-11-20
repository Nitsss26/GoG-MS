/**
 * Display-only date formatting (stored values are never changed). One format everywhere:
 *   dmy("2026-11-19")                 → "19/11/2026"
 *   dmy("2026-11-19T09:30:00.000Z")   → "19/11/2026"            (a timestamp shows its IST date)
 *   dmyTime("2026-11-19T09:30:00Z")   → "19/11/2026, 3:00 PM"   (IST, 12-hour, no seconds)
 *   dmyText("… on 2026-11-19 …")      → "… on 19/11/2026 …"     (every YYYY-MM-DD inside a text)
 * Month headings, weekday names and short calendar labels ("Mon 17 Nov") are not formatted here.
 */
const TZ = "Asia/Kolkata";
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DASH = /^(\d{2})-(\d{2})-(\d{4})$/;

type DateLike = string | number | Date | null | undefined;

function toDate(v: DateLike): Date | null {
    if (v === null || v === undefined || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function parts(d: Date, tz = TZ) {
    const p: Record<string, string> = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return p;
}

/** "dd/mm/yyyy" — a YYYY-MM-DD (or DD-MM-YYYY) string as it is, a timestamp / Date in IST. Anything else is returned unchanged. */
export function dmy(v: DateLike, tz = TZ): string {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "string") {
        const s = v.trim();
        let m = YMD.exec(s);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        m = DMY_DASH.exec(s);
        if (m) return `${m[1]}/${m[2]}/${m[3]}`;
        if (/^\d{4}-\d{2}-\d{2}[T ]\d/.test(s) || (/\b\d{4}\b/.test(s) && /[A-Za-z]{3}/.test(s)) || /^\d{12,}$/.test(s)) {
            const d = toDate(/^\d{12,}$/.test(s) ? Number(s) : s);
            if (!d) return v;
            const p = parts(d, tz);
            return `${p.day}/${p.month}/${p.year}`;
        }
        return v;
    }
    const d = toDate(v);
    if (!d) return "";
    const p = parts(d, tz);
    return `${p.day}/${p.month}/${p.year}`;
}

/** "h:mm AM/PM" in IST */
export function time12(v: DateLike, tz = TZ): string {
    const d = toDate(v);
    if (!d) return "";
    const p = parts(d, tz);
    const h = Number(p.hour) % 24;
    return `${h % 12 || 12}:${p.minute} ${h < 12 ? "AM" : "PM"}`;
}

/** "dd/mm/yyyy, h:mm AM/PM" (IST). A plain YYYY-MM-DD has no time, so only the date is shown. */
export function dmyTime(v: DateLike, tz = TZ): string {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "string" && (YMD.test(v.trim()) || DMY_DASH.test(v.trim()))) return dmy(v, tz);
    const d = toDate(v);
    if (!d) return String(v);
    return `${dmy(d, tz)}, ${time12(d, tz)}`;
}

/** "Thursday, 19/11/2026" (weekday name kept, date in dd/mm/yyyy). `short` → "Thu, 19/11/2026". */
export function weekdayDmy(v: DateLike, short = false): string {
    if (v === null || v === undefined || v === "") return "";
    const ymd = typeof v === "string" && YMD.test(v.trim()) ? v.trim() : "";
    const d = ymd ? new Date(`${ymd}T00:00:00Z`) : toDate(v);
    if (!d) return String(v);
    const wd = d.toLocaleDateString("en-GB", { weekday: short ? "short" : "long", timeZone: ymd ? "UTC" : TZ });
    return `${wd}, ${ymd ? dmy(ymd) : dmy(d)}`;
}

/** Every YYYY-MM-DD inside a text → dd/mm/yyyy (not inside a link / file name / ISO timestamp) */
export const dmyText = (t?: string | null): string =>
    String(t ?? "").replace(/(^|[^\w=/\-.:])(\d{4})-(\d{2})-(\d{2})(?![\w:/])/g, (_m, pre, y, mo, d) => `${pre}${d}/${mo}/${y}`);

/** Older names (kept so existing imports work) — same dd/mm/yyyy output */
export const ddmmyyyy = (v?: string | null): string => { const r = dmy(v); return v && r === v ? dmyText(v) : r; };
export const ddmmyyyyText = dmyText;