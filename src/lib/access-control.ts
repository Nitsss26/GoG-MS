/**
 * SERVER-ONLY: Give Access — who may grant, and how a delegated request is resolved.
 *
 * A page inside a delegated hub sends the header  x-gog-access: <CATEGORY>:<sourceEmployeeId | *>.
 * getSessionUser() calls resolveDelegation(): if the logged-in employee holds an ACTIVE grant for that
 * category covering the source(s), the request runs with the category's role and the union of the
 * sources' scopes (actor.delegation.sources). Otherwise the header is ignored and the employee's own
 * role applies — so a revoked or forged context is simply refused by the normal role checks.
 */
import { Employee, AccessGrant } from '@/models/Schemas';
import { HUBS, hubOf, PROTECTED_CATEGORIES } from '@/lib/access-hubs';

export type Delegation = { category: string; sources: any[]; grantIds: string[]; label: string };

/** Active employees whose role belongs to the category (source candidates) */
export async function employeesOfCategory(category: string) {
    const hub = hubOf(category);
    const roles = hub ? hub.sourceRoles : [category];
    return Employee.find({ role: { $in: roles }, status: { $nin: ['Inactive'] } }).lean();
}

/** Source employees the recipient may act for in this category (union of their active grants) */
export async function delegatedSources(recipientId: string, category: string): Promise<{ sources: any[]; grantIds: string[] }> {
    const grants: any[] = await AccessGrant.find({ recipientId, category, status: 'ACTIVE' }).lean();
    if (!grants.length) return { sources: [], grantIds: [] };
    let sources: any[];
    if (grants.some(g => g.scopeType === 'ALL_DYNAMIC')) {
        sources = await employeesOfCategory(category);
    } else {
        const ids = Array.from(new Set(grants.flatMap(g => g.sourceEmployeeIds || [])));
        sources = ids.length ? await Employee.find({ id: { $in: ids } }).lean() : [];
    }
    return { sources: sources.filter(s => s.id !== recipientId), grantIds: grants.map(g => g.id) };
}

export async function resolveDelegation(base: { id: string; name: string; role: string; employee: any }, header: string | null) {
    if (!header) return null;
    const [category, source] = String(header).split(':');
    const hub = hubOf(category);
    if (!hub || PROTECTED_CATEGORIES.includes(category)) return null;
    const { sources, grantIds } = await delegatedSources(base.id, category);
    if (!sources.length) return null;
    const chosen = !source || source === '*' ? sources : sources.filter(s => s.id === source);
    if (!chosen.length) return null;
    const delegation: Delegation = { category, sources: chosen, grantIds, label: hub.label };
    return {
        ...base,
        role: hub.role,
        baseRole: base.role,
        // audit trails show the real person and the access used
        name: `${base.name} (via ${hub.label})`,
        delegation,
    };
}

/** Roles with full Give Access rights: give any hub to anyone, and edit / revoke any grant */
export const ACCESS_ADMIN_ROLES = ['FOUNDER', 'TL'];

/** Can this (base, non-delegated) user manage access — and for which categories? */
export async function grantorPermissions(actor: { id: string; role: string }) {
    const delegable = HUBS.map(h => h.category).filter(c => !PROTECTED_CATEGORIES.includes(c));
    if (ACCESS_ADMIN_ROLES.includes(actor.role)) return { canManage: true, isFounder: actor.role === 'FOUNDER', categories: delegable, canDynamic: true };
    return { canManage: false, isFounder: false, categories: [] as string[], canDynamic: false };
}