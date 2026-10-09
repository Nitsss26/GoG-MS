/**
 * SERVER-ONLY: whose academic data a manager may see (Academic Monitoring, sprint summary, lecture export).
 *
 *   AD / FOUNDER → every professor
 *   HOI          → ONLY the professors in their own reporting hierarchy (Employee.reportsTo, direct + indirect)
 *   OM           → reportees + everyone at the OM's location (unchanged)
 *   others       → direct reportees (unchanged)
 *
 * The manager is always the logged-in user (a managerId in the URL is only accepted when it is the same
 * person, or when an AD / FOUNDER / HR looks at someone else's view).
 */
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { reportingTree } from '@/lib/leave-summary';

const FACULTY_ROLES = ['FACULTY', 'PROFESSOR'];

export async function resolveManager(managerIdParam: string | null) {
    const actor = await getSessionUser();
    if (!actor) return { error: 'Unauthorized', status: 401 as const };
    if (managerIdParam && managerIdParam !== actor.id && !['AD', 'FOUNDER', 'HR'].includes(actor.role)) {
        return { error: 'You can only see your own reportees.', status: 403 as const };
    }
    const manager: any = managerIdParam && managerIdParam !== actor.id
        ? await Employee.findOne({ id: managerIdParam }).lean()
        : actor.employee;
    if (!manager) return { error: 'Manager not found', status: 404 as const };
    return { manager };
}

export async function academicReportees(manager: any): Promise<any[]> {
    if (['AD', 'FOUNDER'].includes(manager.role)) {
        return Employee.find({ role: { $in: FACULTY_ROLES } }).lean();
    }
    if (manager.role === 'HOI') {
        // Direct + indirect reportees only — never "everyone at the same campus"
        const tree = await reportingTree(manager.id);
        return tree.filter((e: any) => FACULTY_ROLES.includes(e.role));
    }
    const or: any[] = [{ reportsTo: manager.id }];
    if (manager.role === 'OM' && manager.location) or.push({ location: manager.location });
    return Employee.find({ $or: or }).lean();
}
