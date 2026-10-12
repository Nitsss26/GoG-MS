/**
 * SERVER-ONLY: whose academic data a manager may see (Academic Monitoring, sprint summary, lecture export).
 *
 *   AD / FOUNDER → every professor
 *   HOI          → professors in their reporting hierarchy (Employee.reportsTo, direct + indirect)
 *                  + professors of campuses assigned to the HOI (Location.hoiId)
 *   OM           → reportees + everyone at the OM's location (unchanged)
 *   others       → direct reportees (unchanged)
 *
 * The manager is always the logged-in user (a managerId in the URL is only accepted when it is the same
 * person, or when an AD / FOUNDER / HR looks at someone else's view).
 */
import { Employee, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { reportingTree } from '@/lib/leave-summary';

const FACULTY_ROLES = ['FACULTY', 'PROFESSOR'];

export async function resolveManager(managerIdParam: string | null) {
    const actor = await getSessionUser();
    if (!actor) return { error: 'Unauthorized', status: 401 as const };
    if (managerIdParam && managerIdParam !== actor.id && !['AD', 'FOUNDER', 'HR'].includes(actor.role)) {
        return { error: 'You can only see your own reportees.', status: 403 as const };
    }
    // Give Access: the recipient sees the selected sources' professors (header checked in getSessionUser)
    if (actor.delegation && (!managerIdParam || managerIdParam === actor.id)) {
        return { manager: actor.employee, delegation: actor.delegation };
    }
    const manager: any = managerIdParam && managerIdParam !== actor.id
        ? await Employee.findOne({ id: managerIdParam }).lean()
        : actor.employee;
    if (!manager) return { error: 'Manager not found', status: 404 as const };
    return { manager };
}

/** Professors for the resolved manager — or the union for a delegated hub */
export async function reporteesOf(who: { manager: any; delegation?: { category: string; sources: any[] } }): Promise<any[]> {
    if (!who.delegation) return academicReportees(who.manager);
    const { category, sources } = who.delegation;
    if (category === 'PROFESSOR') return Employee.find({ id: { $in: sources.map((s: any) => s.id) } }).lean();
    const byId = new Map<string, any>();
    for (const src of sources) (await academicReportees(src)).forEach((e: any) => { if (!byId.has(e.id)) byId.set(e.id, e); });
    return Array.from(byId.values());
}

export async function academicReportees(manager: any): Promise<any[]> {
    if (['AD', 'FOUNDER'].includes(manager.role)) {
        return Employee.find({ role: { $in: FACULTY_ROLES } }).lean();
    }
    if (manager.role === 'HOI') {
        // Professors appointed under this HOI (reporting hierarchy, direct + indirect, any campus)
        // + professors of the campuses explicitly assigned to this HOI (Location.hoiId).
        // Never "everyone at the HOI's own location" — that campus may belong to another HOI.
        const tree = (await reportingTree(manager.id)).filter((e: any) => FACULTY_ROLES.includes(e.role));
        const headed: any[] = await Location.find({ hoiId: manager.id }).select('id name shortName').lean();
        const keys = Array.from(new Set(headed.flatMap(l => [l.id, l.name, l.shortName].filter(Boolean).map(String))));
        const atCampus: any[] = keys.length ? await Employee.find({ role: { $in: FACULTY_ROLES }, location: { $in: keys } }).lean() : [];
        const byId = new Map<string, any>();
        [...tree, ...atCampus].forEach(e => { if (!byId.has(e.id)) byId.set(e.id, e); });
        // full employee docs (the tree only carries a few fields)
        const ids = Array.from(byId.keys());
        return ids.length ? Employee.find({ id: { $in: ids } }).lean() : [];
    }
    const or: any[] = [{ reportsTo: manager.id }];
    if (manager.role === 'OM' && manager.location) or.push({ location: manager.location });
    return Employee.find({ $or: or }).lean();
}
