/**
 * SERVER-ONLY: Admin → Role Management (save / read a role's restrictions, HR-created roles, audit log).
 * A role without a saved configuration has no restriction — every existing role keeps working as before.
 *
 * HR-created roles (RoleDefinition) sit on top of an existing base role: their employees are stored with
 * role = baseRole and customRole = roleId, so all existing code treats them exactly as the base role. The new role
 * only adds a name, its own restrictions (same three states, on the base role's sidebar) and an Org Chart place.
 */
import crypto from 'crypto';
import { RoleConfig, RoleAuditLog, RoleDefinition, Employee } from '@/models/Schemas';
import {
    LOCKED_ROLES, LOCKED_PATHS, normalizeRestriction, stateOf, configRoleOf, BASE_ROLE_CHOICES, ROLE_ID_RE, ORG_PARENTS,
    type RoleRestriction, type OrgPlacement, type CustomRoleInfo,
} from '@/lib/role-modules';
import { sidebarItemsOfRole, ROLE_COLORS } from '@/lib/sidebar-menu';

/** Role ids that exist in the code (the sidebar's order) */
export const ALL_ROLES = Object.keys(ROLE_COLORS);
/** Ids that can never be used for a new role */
const RESERVED = [...ALL_ROLES, 'FACULTY', 'ADMIN', 'SYSTEM', 'GUEST'];

/** Admin pages: HR (not HR Executive) and Founder */
export const canManageRoles = (actor: any) => !!actor && ((actor.role === 'HR' && !actor.hrExecutive) || actor.role === 'FOUNDER');

const newLogId = () => `RAL-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
const actorRoleOf = (actor: any) => (actor.hrExecutive ? 'HR_EXECUTIVE' : actor.role);
const cleanOrg = (o: any): OrgPlacement => (o?.mode === 'OWN' && ORG_PARENTS.some(p => p.key === o?.parent) ? { mode: 'OWN', parent: String(o.parent) } : { mode: 'SAME' });

export async function definitionOf(roleId: string): Promise<any | null> {
    if (!roleId || ALL_ROLES.includes(roleId)) return null;
    return RoleDefinition.findOne({ roleId }).lean();
}

/** Sidebar items a role can restrict: its own (built-in) or its base role's (HR-created) */
export async function itemsOfRole(role: string) {
    if (ALL_ROLES.includes(role)) return sidebarItemsOfRole(role);
    const def = await definitionOf(role);
    return def ? sidebarItemsOfRole(def.baseRole) : [];
}

export async function restrictionOf(role: string): Promise<RoleRestriction> {
    if (!role || LOCKED_ROLES.includes(role)) return { hidden: [], blocked: [] };
    const doc: any = await RoleConfig.findOne({ role }).lean();
    return normalizeRestriction(doc);
}

export async function restrictionOfUser(actor: any) {
    return restrictionOf(configRoleOf({ role: actor?.role, hrExecutive: actor?.hrExecutive, actualRole: actor?.session?.actualRole, customRole: actor?.customRole }));
}

/** Every saved configuration (used by the proxy) */
export async function allRestrictions(): Promise<Record<string, RoleRestriction>> {
    const docs: any[] = await RoleConfig.find({}).lean();
    const out: Record<string, RoleRestriction> = {};
    for (const d of docs) { if (LOCKED_ROLES.includes(d.role)) continue; const r = normalizeRestriction(d); if (r.hidden.length || r.blocked.length) out[d.role] = r; }
    return out;
}

export type SaveResult = { ok: true; restriction: RoleRestriction; changes: any[] } | { ok: false; status: number; error: string };

/**
 * Save a role's restrictions. Only items of that role's own sidebar can be restricted; locked roles / items are refused.
 * Writes one RoleAuditLog entry with the before / after of every changed item.
 */
export async function saveRoleRestriction(actor: any, role: string, input: { hidden?: any; blocked?: any; note?: any }, opts: { allowEmpty?: boolean } = {}): Promise<SaveResult> {
    if (LOCKED_ROLES.includes(role)) return { ok: false, status: 403, error: 'HR and Founder access cannot be changed here.' };
    if (!ALL_ROLES.includes(role) && !(await definitionOf(role))) return { ok: false, status: 400, error: 'Unknown role.' };
    const items = await itemsOfRole(role);
    const allowed = new Set(items.map(i => i.path));
    const asked = [...(Array.isArray(input.hidden) ? input.hidden : []), ...(Array.isArray(input.blocked) ? input.blocked : [])].map(String);
    const bad = asked.filter(p => !allowed.has(p) || LOCKED_PATHS.includes(p));
    if (bad.length) return { ok: false, status: 400, error: `These items are not in this role's sidebar or cannot be restricted: ${bad.join(', ')}` };
    const after = normalizeRestriction({ hidden: input.hidden, blocked: input.blocked });
    const before = await restrictionOf(role);
    const changes = items
        .map(i => ({ path: i.path, label: i.label, from: stateOf(before, i.path), to: stateOf(after, i.path) }))
        .filter(c => c.from !== c.to);
    if (!changes.length) return opts.allowEmpty ? { ok: true, restriction: after, changes: [] } : { ok: false, status: 400, error: 'Nothing changed.' };
    const at = new Date().toISOString();
    await RoleConfig.findOneAndUpdate(
        { role },
        { $set: { role, hidden: after.hidden, blocked: after.blocked, updatedBy: actor.id, updatedByName: actor.name, updatedByRole: actor.role, updatedAt: at } },
        { upsert: true, new: true },
    );
    const note = String(input.note || '').trim().slice(0, 500);
    await RoleAuditLog.create({
        id: newLogId(),
        role, action: !after.hidden.length && !after.blocked.length ? 'ACCESS_RESET' : 'ACCESS_UPDATED',
        changes, before, after, ...(note ? { note } : {}),
        actorId: actor.id, actorName: actor.name, actorRole: actorRoleOf(actor), at,
    });
    clearRulesCache();
    return { ok: true, restriction: after, changes };
}

/** The proxy keeps the rules for a short time; a save on this server shows at once */
export function clearRulesCache() {
    (globalThis as any).__gogRoleRules = null;
}

/* ───────────── HR-created roles ───────────── */

/** Published HR-created roles (login dropdown, onboarding dropdown, Org Chart) — no restriction details */
export async function publishedRoles(): Promise<CustomRoleInfo[]> {
    const defs: any[] = await RoleDefinition.find({ status: 'PUBLISHED' }).lean();
    return defs.map(d => ({ roleId: d.roleId, label: d.label, baseRole: d.baseRole, org: cleanOrg(d.org) })).sort((a, b) => a.label.localeCompare(b.label));
}

export type DefResult = { ok: true; definition: any } | { ok: false; status: number; error: string };

const labelOfRole = (r: string) => (ROLE_COLORS as any)[r]?.label || r;
const orgText = (o: OrgPlacement) => (o.mode === 'OWN' ? `own box under ${o.parent}` : 'same place as the base role');

/**
 * Create a draft (no roleId match) or edit an existing role. Base role and role ID are fixed once published.
 * input: { roleId, label, description, baseRole, org, hidden, blocked, note }
 */
export async function saveDefinition(actor: any, input: any, mode: 'create' | 'update'): Promise<DefResult> {
    const label = String(input.label || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const roleId = String(input.roleId || '').trim().toUpperCase();
    const description = String(input.description || '').trim().slice(0, 500);
    const org = cleanOrg(input.org);
    if (label.length < 3) return { ok: false, status: 400, error: 'Enter a role name (at least 3 characters).' };
    if (/[<>"]/.test(label)) return { ok: false, status: 400, error: 'The role name cannot contain < > or ".' };
    if (!ROLE_ID_RE.test(roleId)) return { ok: false, status: 400, error: 'Role ID: capital letters, digits and _ only (3–40 characters, starting with a letter).' };
    const existing: any = await RoleDefinition.findOne({ roleId }).lean();
    const now = new Date().toISOString();

    if (mode === 'create') {
        if (RESERVED.includes(roleId) || existing) return { ok: false, status: 409, error: `Role ID ${roleId} already exists.` };
        const all: any[] = await RoleDefinition.find({}).select('label').lean();
        if (all.some(d => String(d.label).toLowerCase() === label.toLowerCase()) || Object.values(ROLE_COLORS).some(c => c.label.toLowerCase() === label.toLowerCase()))
            return { ok: false, status: 409, error: `A role named "${label}" already exists.` };
        const baseRole = String(input.baseRole || '');
        if (!BASE_ROLE_CHOICES.includes(baseRole)) return { ok: false, status: 400, error: 'Choose a base role.' };
        // restrictions are checked before anything is saved
        const items = sidebarItemsOfRole(baseRole);
        const bad = [...(input.hidden || []), ...(input.blocked || [])].map(String).filter((p: string) => !items.some(i => i.path === p) || LOCKED_PATHS.includes(p));
        if (bad.length) return { ok: false, status: 400, error: `These items are not in the ${labelOfRole(baseRole)} sidebar or cannot be restricted: ${bad.join(', ')}` };
        const doc = { roleId, label, description, baseRole, status: 'DRAFT', org, createdBy: actor.id, createdByName: actor.name, createdAt: now, updatedBy: actor.id, updatedByName: actor.name, updatedAt: now };
        await RoleDefinition.create(doc);
        await RoleAuditLog.create({
            id: newLogId(), role: roleId, action: 'ROLE_CREATED', changes: [], before: { hidden: [], blocked: [] }, after: { hidden: [], blocked: [] },
            summary: `Draft "${label}" created on base role ${labelOfRole(baseRole)}; Org Chart: ${orgText(org)}.`,
            actorId: actor.id, actorName: actor.name, actorRole: actorRoleOf(actor), at: now,
        });
        const r = await saveRoleRestriction(actor, roleId, { hidden: input.hidden, blocked: input.blocked, note: input.note }, { allowEmpty: true });
        if (!r.ok) return r;
        return { ok: true, definition: { ...doc, restriction: r.restriction } };
    }

    if (!existing) return { ok: false, status: 404, error: 'Role not found.' };
    const baseRole = existing.status === 'PUBLISHED' ? existing.baseRole : String(input.baseRole || existing.baseRole);
    if (!BASE_ROLE_CHOICES.includes(baseRole)) return { ok: false, status: 400, error: 'Choose a base role.' };
    if (existing.status === 'PUBLISHED' && input.baseRole && input.baseRole !== existing.baseRole)
        return { ok: false, status: 400, error: 'The base role cannot be changed after the role is published.' };
    const others: any[] = await RoleDefinition.find({}).select('roleId label').lean();
    if (others.some(d => d.roleId !== roleId && String(d.label).toLowerCase() === label.toLowerCase()) || Object.values(ROLE_COLORS).some(c => c.label.toLowerCase() === label.toLowerCase()))
        return { ok: false, status: 409, error: `A role named "${label}" already exists.` };
    const diffs: string[] = [];
    if (existing.label !== label) diffs.push(`name "${existing.label}" → "${label}"`);
    if ((existing.description || '') !== description) diffs.push('description changed');
    if (existing.baseRole !== baseRole) diffs.push(`base role ${labelOfRole(existing.baseRole)} → ${labelOfRole(baseRole)}`);
    const prevOrg = cleanOrg(existing.org);
    if (prevOrg.mode !== org.mode || prevOrg.parent !== org.parent) diffs.push(`Org Chart: ${orgText(prevOrg)} → ${orgText(org)}`);
    // base role changed on a draft → old restrictions may not fit the new sidebar: they are replaced by the submitted ones
    if (existing.baseRole !== baseRole) {
        const items = sidebarItemsOfRole(baseRole);
        const bad = [...(input.hidden || []), ...(input.blocked || [])].map(String).filter((p: string) => !items.some(i => i.path === p) || LOCKED_PATHS.includes(p));
        if (bad.length) return { ok: false, status: 400, error: `These items are not in the ${labelOfRole(baseRole)} sidebar or cannot be restricted: ${bad.join(', ')}` };
    }
    if (diffs.length) {
        await RoleDefinition.updateOne({ roleId }, { $set: { label, description, baseRole, org, updatedBy: actor.id, updatedByName: actor.name, updatedAt: now } });
        await RoleAuditLog.create({
            id: newLogId(), role: roleId, action: 'ROLE_UPDATED', changes: [], before: { hidden: [], blocked: [] }, after: { hidden: [], blocked: [] },
            summary: diffs.join('; ') + '.', actorId: actor.id, actorName: actor.name, actorRole: actorRoleOf(actor), at: now,
        });
    }
    let r: SaveResult;
    if (existing.baseRole !== baseRole) {
        // clear the old base role's restrictions first (no log line for that step), then save the new ones
        await RoleConfig.findOneAndUpdate({ role: roleId }, { $set: { role: roleId, hidden: [], blocked: [] } }, { upsert: true, new: true });
    }
    r = await saveRoleRestriction(actor, roleId, { hidden: input.hidden, blocked: input.blocked, note: input.note }, { allowEmpty: true });
    if (!r.ok) return r;
    if (!diffs.length && !r.changes.length) return { ok: false, status: 400, error: 'Nothing changed.' };
    const def: any = await RoleDefinition.findOne({ roleId }).lean();
    return { ok: true, definition: { ...def, restriction: r.restriction } };
}

/** Publish / unpublish / delete an HR-created role */
export async function definitionAction(actor: any, roleId: string, action: string): Promise<DefResult> {
    const def: any = await RoleDefinition.findOne({ roleId }).lean();
    if (!def) return { ok: false, status: 404, error: 'Role not found.' };
    const employees = await Employee.countDocuments({ customRole: roleId, isRemoved: { $ne: true } });
    const now = new Date().toISOString();
    const log = (a: string, summary: string) => RoleAuditLog.create({
        id: newLogId(), role: roleId, action: a, changes: [], before: { hidden: [], blocked: [] }, after: { hidden: [], blocked: [] },
        summary, actorId: actor.id, actorName: actor.name, actorRole: actorRoleOf(actor), at: now,
    });
    if (action === 'publish') {
        if (def.status === 'PUBLISHED') return { ok: false, status: 400, error: 'Already published.' };
        await RoleDefinition.updateOne({ roleId }, { $set: { status: 'PUBLISHED', publishedBy: actor.id, publishedByName: actor.name, publishedAt: now, updatedBy: actor.id, updatedByName: actor.name, updatedAt: now } });
        await log('ROLE_PUBLISHED', `"${def.label}" published: it can now be chosen in Onboarding and at login.`);
    } else if (action === 'unpublish') {
        if (def.status !== 'PUBLISHED') return { ok: false, status: 400, error: 'The role is not published.' };
        if (employees > 0) return { ok: false, status: 409, error: `${employees} employee(s) have this role. It cannot be unpublished while they do.` };
        await RoleDefinition.updateOne({ roleId }, { $set: { status: 'DRAFT', updatedBy: actor.id, updatedByName: actor.name, updatedAt: now } });
        await log('ROLE_UNPUBLISHED', `"${def.label}" moved back to draft (no employees had it).`);
    } else if (action === 'delete') {
        // draft or published — only while no employee has the role (no employee record is ever changed here)
        if (employees > 0) {
            const who: any[] = await Employee.find({ customRole: roleId, isRemoved: { $ne: true } }).select('id name').limit(10).lean();
            const names = who.map(e => `${e.name} (${e.id})`).join(', ');
            return { ok: false, status: 409, error: `${employees} employee(s) have this role: ${names}${employees > who.length ? ', …' : ''}. Change their role first, then delete it.` };
        }
        await RoleDefinition.deleteOne({ roleId });
        await RoleConfig.deleteOne({ role: roleId });
        await log('ROLE_DELETED', `${def.status === 'PUBLISHED' ? 'Published role' : 'Draft'} "${def.label}" deleted (no employees had it).`);
        clearRulesCache();
        return { ok: true, definition: null };
    } else return { ok: false, status: 400, error: 'Unknown action.' };
    return { ok: true, definition: await RoleDefinition.findOne({ roleId }).lean() };
}

/** Onboarding: turn a submitted { role, customRole } into the stored pair (customRole must be published on that base role) */
export async function resolveCustomRole(role: string, customRole: any): Promise<{ ok: true; customRole?: string; label?: string } | { ok: false; error: string }> {
    const id = String(customRole || '').trim();
    if (!id) return { ok: true };
    const def: any = await RoleDefinition.findOne({ roleId: id, status: 'PUBLISHED' }).lean();
    if (!def) return { ok: false, error: 'This role is not published.' };
    const same = def.baseRole === 'PROFESSOR' ? ['PROFESSOR', 'FACULTY'] : [def.baseRole];
    if (!same.includes(role)) return { ok: false, error: `${def.label} uses the ${labelOfRole(def.baseRole)} role.` };
    return { ok: true, customRole: def.roleId, label: def.label };
}