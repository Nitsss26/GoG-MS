/**
 * SERVER-ONLY: OM Given Access — an OM temporarily lets a Professor or HOI use Full Attire.
 *
 * - Only an OM (their own login, not through Give Access hubs) can grant, and only to the Professors of their
 *   academic scope (the same list as their Full Attire page) and the HOI(s) they report to.
 * - Dates are IST calendar days, both inclusive (17–19 Nov = 17, 18 and 19 Nov).
 * - A grant's status is worked out from the dates + revoke fields every time (scheduled / active / expired /
 *   revoked); nothing stored can make an expired or revoked grant work.
 * - A grant only works while the granting OM is still an active OM and the employee is still a Professor / HOI.
 * - The employee's role is never changed; nothing but Full Attire is given.
 */
import crypto from 'crypto';
import { Employee, Location } from '@/models/Schemas';
import { TemporaryAccessGrant } from '@/models/FullAttire';
import { getAcademicScope, professorsInScope, hoisAbove } from '@/lib/academic';

export const PERMISSION = 'FULL_ATTIRE';
export const RECIPIENT_ROLES = ['PROFESSOR', 'FACULTY', 'HOI'];
/** longest grant (days, inclusive) and how far ahead it may start */
export const MAX_DAYS = 31;
export const MAX_AHEAD_DAYS = 60;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const INACTIVE = /inactive|removed|terminated|resigned/i;

/** Today in IST (organisation time zone) as YYYY-MM-DD */
export const istToday = (now = Date.now()) => new Date(now + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const validYmd = (s: any) => typeof s === 'string' && YMD.test(s) && addDays(s, 0) === s;

export type GrantStatus = 'scheduled' | 'active' | 'expired' | 'revoked';
/** Derived status (never read from storage) */
export function grantStatus(g: any, today = istToday()): GrantStatus {
    if (g?.revokedAt) return 'revoked';
    if (today < g.startDate) return 'scheduled';
    if (today > g.endDate) return 'expired';
    return 'active';
}

const isNativeOm = (actor: any) => !!actor && actor.role === 'OM' && !actor.delegation;
const roleLabel = (r: string) => (r === 'HOI' ? 'HOI' : 'Professor');

async function locNames() {
    const rows: any[] = await Location.find({}).select('id name shortName').lean();
    const m = new Map<string, string>();
    rows.forEach(l => { m.set(l.id, l.name); m.set(l.name, l.name); if (l.shortName) m.set(l.shortName, l.name); });
    return m;
}

/** Who this OM may give access to: Professors of the OM's scope + the HOI(s) above the OM (backend rule) */
export async function eligibleRecipients(om: any) {
    const scope = await getAcademicScope({ role: 'OM', employee: om.employee });
    const profs: any[] = await professorsInScope(scope);
    const hois: any[] = await hoisAbove(om.id);
    const ids = Array.from(new Set([...profs.map(p => p.id), ...hois.map(h => h.id)])).filter(id => id !== om.id);
    const rows: any[] = ids.length ? await Employee.find({ id: { $in: ids }, isRemoved: { $ne: true } }).select('id name role designation location status').lean() : [];
    const names = await locNames();
    return rows
        .filter(e => RECIPIENT_ROLES.includes(e.role) && !INACTIVE.test(String(e.status || 'Active')))
        .map(e => ({ id: e.id, name: e.name, role: e.role === 'FACULTY' ? 'PROFESSOR' : e.role, roleLabel: roleLabel(e.role), designation: e.designation || '', college: names.get(e.location) || e.location || '' }))
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'HOI' ? -1 : 1));
}

const view = (g: any, today = istToday()) => {
    const { _id, __v, ...rest } = g;
    return { ...rest, status: grantStatus(g, today), days: daysBetween(g.startDate, g.endDate) + 1 };
};

/** OM's Give Access page: eligible employees + every grant this OM gave (newest first) */
export async function omOverview(om: any) {
    const [eligible, grants]: any[] = await Promise.all([
        eligibleRecipients(om),
        TemporaryAccessGrant.find({ grantedByEmployeeId: om.id, permission: PERMISSION }).sort({ createdAt: -1 }).limit(500).lean(),
    ]);
    const today = istToday();
    return { today, eligible, grants: grants.map((g: any) => view(g, today)), maxDays: MAX_DAYS };
}

type R = { ok: true; grant: any } | { ok: false; status: number; error: string };

export async function createGrant(actor: any, body: any): Promise<R> {
    if (!isNativeOm(actor)) return { ok: false, status: 403, error: 'Only an Operations Manager can give Full Attire access.' };
    const toId = String(body?.employeeId || '').trim();
    const startDate = String(body?.startDate || ''), endDate = String(body?.endDate || '');
    const reason = String(body?.reason || '').trim().slice(0, 300);
    if (!toId) return { ok: false, status: 400, error: 'Select an employee.' };
    if (!validYmd(startDate) || !validYmd(endDate)) return { ok: false, status: 400, error: 'Choose a valid start and end date.' };
    const today = istToday();
    if (startDate < today) return { ok: false, status: 400, error: 'The start date cannot be in the past.' };
    if (endDate < startDate) return { ok: false, status: 400, error: 'The end date must be on or after the start date.' };
    if (daysBetween(startDate, endDate) + 1 > MAX_DAYS) return { ok: false, status: 400, error: `Access can be given for at most ${MAX_DAYS} days at a time.` };
    if (daysBetween(today, startDate) > MAX_AHEAD_DAYS) return { ok: false, status: 400, error: `The start date can be at most ${MAX_AHEAD_DAYS} days ahead.` };
    const eligible = await eligibleRecipients(actor);
    const to = eligible.find(e => e.id === toId);
    if (!to) return { ok: false, status: 403, error: 'You can give access only to the Professors of your college(s) and your HOI.' };
    // the same OM → same employee: no second grant for overlapping days (another OM's grant is fine)
    const mine: any[] = await TemporaryAccessGrant.find({ grantedByEmployeeId: actor.id, grantedToEmployeeId: toId, permission: PERMISSION, revokedAt: { $exists: false } }).lean();
    const clash = mine.find(g => grantStatus(g, today) !== 'expired' && g.startDate <= endDate && startDate <= g.endDate);
    if (clash) return { ok: false, status: 409, error: `${to.name} already has Full Attire access from you for ${clash.startDate} to ${clash.endDate}. Revoke or wait for it before giving overlapping dates.` };
    const grant = {
        id: `TAG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        permission: PERMISSION, grantedByEmployeeId: actor.id, grantedByName: actor.name,
        grantedToEmployeeId: toId, grantedToName: to.name, grantedToRole: to.role,
        startDate, endDate, ...(reason ? { reason } : {}), createdAt: new Date().toISOString(),
    };
    await TemporaryAccessGrant.create(grant);
    return { ok: true, grant: view(grant, today) };
}

/** Revoke an active grant / cancel a scheduled one — the granting OM, or HR (not HR Executive) / Founder */
export async function revokeGrant(actor: any, id: string): Promise<R> {
    const g: any = await TemporaryAccessGrant.findOne({ id }).lean();
    if (!g) return { ok: false, status: 404, error: 'Access not found.' };
    const admin = (actor.role === 'HR' && !actor.hrExecutive) || actor.role === 'FOUNDER';
    if (!(isNativeOm(actor) && g.grantedByEmployeeId === actor.id) && !admin) return { ok: false, status: 403, error: 'Only the OM who gave this access (or HR / Founder) can revoke it.' };
    const st = grantStatus(g);
    if (st === 'revoked') return { ok: false, status: 400, error: 'This access is already revoked.' };
    if (st === 'expired') return { ok: false, status: 400, error: 'This access has already expired.' };
    const at = new Date().toISOString();
    const u = await TemporaryAccessGrant.updateOne({ id, revokedAt: { $exists: false } }, { $set: { revokedAt: at, revokedBy: actor.id, revokedByName: actor.name, revokeKind: st === 'scheduled' ? 'cancelled' : 'revoked' } });
    if (!u.modifiedCount) return { ok: false, status: 409, error: 'This access was just changed. Refresh and try again.' };
    return { ok: true, grant: view({ ...g, revokedAt: at, revokedBy: actor.id, revokedByName: actor.name, revokeKind: st === 'scheduled' ? 'cancelled' : 'revoked' }) };
}

/**
 * Grants that let this employee use Full Attire RIGHT NOW (checked on every request): active today, not revoked,
 * the granting OM still an active OM, and the employee still a Professor / HOI. Returns the granting OMs too.
 */
export async function activeGrantsFor(actor: any): Promise<{ grants: any[]; oms: any[] }> {
    if (!actor?.id || !RECIPIENT_ROLES.includes(actor.role) || actor.delegation) return { grants: [], oms: [] };
    const today = istToday();
    const rows: any[] = await TemporaryAccessGrant.find({ grantedToEmployeeId: actor.id, permission: PERMISSION, revokedAt: { $exists: false }, startDate: { $lte: today }, endDate: { $gte: today } }).lean();
    const live = rows.filter(g => grantStatus(g, today) === 'active');
    if (!live.length) return { grants: [], oms: [] };
    const oms: any[] = await Employee.find({ id: { $in: Array.from(new Set(live.map(g => g.grantedByEmployeeId))) }, role: 'OM', isRemoved: { $ne: true } }).lean();
    const okOms = oms.filter(o => !INACTIVE.test(String(o.status || 'Active')));
    const okIds = new Set(okOms.map(o => o.id));
    const grants = live.filter(g => okIds.has(g.grantedByEmployeeId)).map(g => view(g, today));
    return { grants, oms: okOms.filter(o => grants.some(g => g.grantedByEmployeeId === o.id)) };
}