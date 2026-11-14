/**
 * SERVER-ONLY: OMS presence (HR → Workforce → OMS Status / Last Seen).
 *   Login       → lastLoginAt + lastSeenAt
 *   Heartbeat   → lastSeenAt (sent ~every 60 s by every open, visible OMS tab of a valid session; throttled here)
 *   Logout      → lastLogoutAt (that browser goes offline at once; another open device makes it Active again)
 *   Active      = a login / heartbeat within PRESENCE_WINDOW_MS (and not logged out after it). Expired / invalid sessions
 *                 cannot send a heartbeat (401), closed tabs and lost internet simply stop sending → Offline after the window.
 * "Active" only means connected to OMS recently — not that the employee is working or present.
 */
import { EmployeePresence } from '@/models/Presence';

/** Active window: a heartbeat in the last 2 minutes */
export const PRESENCE_WINDOW_MS = 2 * 60 * 1000;
/** At most one database write per employee in this time (several tabs / devices send heartbeats) */
export const HEARTBEAT_MIN_WRITE_MS = 45 * 1000;

export type PresenceStatus = 'Active' | 'Offline' | 'Never Logged In';

export async function recordLogin(employeeId: string, now = new Date()) {
    if (!employeeId) return;
    await EmployeePresence.updateOne({ employeeId }, { $set: { lastLoginAt: now, lastSeenAt: now } }, { upsert: true });
}

/** Heartbeat: write only if the last one is older than HEARTBEAT_MIN_WRITE_MS (or the browser logged out after it) */
export async function recordHeartbeat(employeeId: string, now = new Date()) {
    if (!employeeId) return false;
    const cut = new Date(now.getTime() - HEARTBEAT_MIN_WRITE_MS);
    const r: any = await EmployeePresence.updateOne(
        { employeeId, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: cut } }, { $expr: { $gte: ['$lastLogoutAt', '$lastSeenAt'] } }] },
        { $set: { lastSeenAt: now } });
    if (r?.matchedCount || r?.modifiedCount) return true;
    // no row yet (session opened before tracking started) → create it; a row that exists was seen recently → skip
    if (await EmployeePresence.exists({ employeeId })) return false;
    try { await EmployeePresence.create({ employeeId, lastSeenAt: now }); return true; }
    catch (e: any) { if (e?.code === 11000) return false; throw e; }
}

export async function recordLogout(employeeId: string, now = new Date()) {
    if (!employeeId) return;
    await EmployeePresence.updateOne({ employeeId }, { $set: { lastLogoutAt: now } });
}

export function statusOf(p: any, now = Date.now()): PresenceStatus {
    if (!p || (!p.lastSeenAt && !p.lastLoginAt)) return 'Never Logged In';
    const seen = p.lastSeenAt ? new Date(p.lastSeenAt).getTime() : 0;
    const out = p.lastLogoutAt ? new Date(p.lastLogoutAt).getTime() : 0;
    return seen && now - seen <= PRESENCE_WINDOW_MS && out < seen ? 'Active' : 'Offline';
}

const iso = (d: any) => (d ? new Date(d).toISOString() : '');
export function presenceRow(p: any, now = Date.now()) {
    return { employeeId: p.employeeId, status: statusOf(p, now), lastSeenAt: iso(p.lastSeenAt), lastLoginAt: iso(p.lastLoginAt) };
}

/** Presence of the given employees (HR only — checked by the caller) */
export async function presenceFor(ids?: string[]) {
    const rows: any[] = await EmployeePresence.find(ids ? { employeeId: { $in: ids } } : {}).select('employeeId lastSeenAt lastLoginAt lastLogoutAt').lean();
    const now = Date.now();
    return rows.map(p => presenceRow(p, now));
}