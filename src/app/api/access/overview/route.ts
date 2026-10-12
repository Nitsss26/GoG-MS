import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, AccessGrant, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { grantorPermissions } from '@/lib/access-control';
import { HUBS, hubOf, categoryOfRole, PROTECTED_CATEGORIES } from '@/lib/access-hubs';

export const dynamic = 'force-dynamic';

/**
 * Give Access dashboard data (Founder / Tech Lead — same rights):
 * summary, categories (from the employees in the database), employees, grants.
 */
export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const perm = await grantorPermissions(actor);
        if (!perm.canManage) return NextResponse.json({ error: 'You are not allowed to manage access.' }, { status: 403 });

        const [employees, grants, locs]: any[] = await Promise.all([
            Employee.find({ status: { $nin: ['Inactive'] }, isRemoved: { $ne: true } }).select('id name email role designation dept location status photoUrl').lean(),
            AccessGrant.find({}).sort({ grantedAt: -1 }).lean(),
            Location.find({}).select('id name shortName').lean(),
        ]);
        const locName = new Map<string, string>();
        locs.forEach((l: any) => [l.id, l.name, l.shortName].filter(Boolean).forEach((k: string) => locName.set(k, l.name)));
        const active = grants.filter((g: any) => g.status === 'ACTIVE');
        const accessOf = new Map<string, string[]>();
        active.forEach((g: any) => accessOf.set(g.recipientId, [...(accessOf.get(g.recipientId) || []), g.category]));
        const nameOf = new Map<string, string>(employees.map((e: any) => [e.id, e.name]));

        // categories present in the database
        const counts = new Map<string, number>();
        employees.forEach((e: any) => counts.set(categoryOfRole(e.role), (counts.get(categoryOfRole(e.role)) || 0) + 1));
        const categories = Array.from(counts.entries()).map(([category, count]) => {
            const hub = hubOf(category);
            return {
                category, count, hubLabel: hub?.label || null, items: hub?.items || [], note: hub?.note || '',
                delegable: !!hub && !PROTECTED_CATEGORIES.includes(category),
                allowed: perm.categories.includes(category),
            };
        }).sort((a, b) => a.category.localeCompare(b.category));

        return NextResponse.json({
            me: { id: actor.id, role: actor.role, isFounder: perm.isFounder, categories: perm.categories, canDynamic: perm.canDynamic },
            summary: {
                totalEmployees: employees.length,
                employeesWithAccess: new Set(active.map((g: any) => g.recipientId)).size,
                activeGrants: active.length,
                revokedGrants: grants.length - active.length,
            },
            categories,
            employees: employees.map((e: any) => ({
                id: e.id, name: e.name, email: e.email || '', photoUrl: e.photoUrl || '', role: e.role, category: categoryOfRole(e.role), designation: e.designation || '', dept: e.dept || '',
                campus: locName.get(e.location) || e.location || '', extraAccess: accessOf.get(e.id) || [],
            })),
            grants: grants.map((g: any) => ({
                ...g, sources: (g.sourceEmployeeIds || []).map((id: string) => ({ id, name: nameOf.get(id) || id })),
                hubLabel: hubOf(g.category)?.label || g.category,
            })),
            hubs: HUBS.map(h => ({ category: h.category, label: h.label })),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}