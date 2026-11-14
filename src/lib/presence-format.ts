/** OMS presence display (client and server safe): "Active now" · "Today, 12:35 PM" · "Yesterday, 6:42 PM" · "10 Nov 2026, 4:15 PM" */
export const PRESENCE_TZ = "Asia/Kolkata";   // organisation time zone (same default as the rest of OMS)
export type PresenceStatus = "Active" | "Offline" | "Never Logged In";
export type PresenceRow = { employeeId: string; status: PresenceStatus; lastSeenAt: string; lastLoginAt: string };

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: PRESENCE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: PRESENCE_TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: PRESENCE_TZ, day: "2-digit", month: "short", year: "numeric" }).format(d);

/** A timestamp as Today / Yesterday / date, in the organisation time zone (now = the server's clock) */
export function whenLabel(iso?: string, nowIso?: string) {
    if (!iso) return "";
    const d = new Date(iso); if (isNaN(d.getTime())) return "";
    const now = nowIso ? new Date(nowIso) : new Date();
    const today = ymd(now), yest = ymd(new Date(now.getTime() - 86400000)), that = ymd(d);
    return that === today ? `Today, ${time(d)}` : that === yest ? `Yesterday, ${time(d)}` : `${day(d)}, ${time(d)}`;
}
export function lastSeenLabel(p: PresenceRow | undefined, nowIso?: string) {
    if (!p || p.status === "Never Logged In") return "Never Logged In";
    if (p.status === "Active") return "Active now";
    return whenLabel(p.lastSeenAt, nowIso) || "—";
}
