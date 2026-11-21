import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, RoleConfig, RoleDefinition } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { ALL_ROLES, canManageRoles, saveRoleRestriction } from '@/lib/role-config-server';
import { LOCKED_ROLES, LOCKED_PATHS, MODULE_APIS, EXACT_ONLY, normalizeRestriction, cleanOrgPlacement } from '@/lib/role-modules';
import { sidebarItemsOfRole, ROLE_COLORS } from '@/lib/sidebar-menu';

export const dynamic = 'force-dynamic';

const deny = () => NextResponse.json({ error: 'Only HR and the Founder can manage roles.' }, { status: 403 });

/** Admin → Role Management: every role with its employees, sidebar items (from the code) and saved restrictions */
export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageRoles(actor)) return deny();
        const [emps, docs, defs]: any[] = await Promise.all([
            Employee.find({ status: { $nin: ['Inactive'] }, isRemoved: { $ne: true } }).select('role customRole').lean(),
            RoleConfig.find({}).lean(),
            RoleDefinition.find({}).lean(),
        ]);
        // employees of an HR-created role follow that role (not their base role's settings)
        const count = new Map<string, number>();
        emps.forEach((e: any) => { const k = e.customRole || e.role; count.set(k, (count.get(k) || 0) + 1); });
        const builtIn = ALL_ROLES.map(role => {
            const doc = docs.find((d: any) => d.role === role);
            const locked = LOCKED_ROLES.includes(role);
            return {
                role, label: (ROLE_COLORS as any)[role]?.label || role, employees: count.get(role) || 0, locked,
                items: sidebarItemsOfRole(role).map(i => ({
                    ...i, locked: locked || LOCKED_PATHS.includes(i.path),
                    apis: MODULE_APIS[i.path] || [], exact: EXACT_ONLY.includes(i.path),
                })),
                restriction: locked ? { hidden: [], blocked: [] } : normalizeRestriction(doc),
                updatedAt: doc?.updatedAt || null, updatedByName: doc?.updatedByName || null,
            };
        });
        const custom = defs.sort((a: any, b: any) => String(a.label).localeCompare(String(b.label))).map((d: any) => {
            const doc = docs.find((x: any) => x.role === d.roleId);
            return {
                role: d.roleId, label: d.label, employees: count.get(d.roleId) || 0, locked: false,
                custom: true, baseRole: d.baseRole, baseLabel: (ROLE_COLORS as any)[d.baseRole]?.label || d.baseRole,
                status: d.status, description: d.description || '', org: cleanOrgPlacement(d.org),
                items: sidebarItemsOfRole(d.baseRole).map(i => ({ ...i, locked: LOCKED_PATHS.includes(i.path), apis: MODULE_APIS[i.path] || [], exact: EXACT_ONLY.includes(i.path) })),
                restriction: normalizeRestriction(doc),
                updatedAt: d.updatedAt || null, updatedByName: d.updatedByName || null, createdByName: d.createdByName || null,
            };
        });
        return NextResponse.json({ roles: [...builtIn, ...custom] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Could not load roles' }, { status: 500 });
    }
}

/** Save one role's restrictions — body { role, hidden: [path], blocked: [path], note? } */
export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canManageRoles(actor)) return deny();
        const body = await req.json().catch(() => ({}));
        const r = await saveRoleRestriction(actor, String(body.role || ''), body);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ success: true, restriction: r.restriction, changes: r.changes });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Could not save' }, { status: 500 });
    }
}