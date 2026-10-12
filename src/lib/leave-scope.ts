/**
 * SERVER-ONLY: whose leave requests a user may see and decide.
 *
 *   HR / FOUNDER → everyone
 *   any manager  → their reporting hierarchy (Employee.reportsTo, direct + indirect — same rule as Leave Summary)
 *   HOI          → + the legacy fallback the portal already used: staff at the HOI's location who have no
 *                    manager assigned at all (FACULTY, PROFESSOR, OM, MARKETING_TEAM, TECH_TEAM)
 *   everyone     → their own requests
 */
import { Employee } from '@/models/Schemas';
import { reportingTree } from '@/lib/leave-summary';

export const LEAVE_ADMIN_ROLES = ['HR', 'FOUNDER'];
/** Roles that take the HOI decision step on a "Pending HOI Approval" request */
export const LEAVE_MANAGER_ROLES = ['HOI', 'AD', 'TL', 'OM'];
const HOI_FALLBACK_ROLES = ['FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM'];

/** Ids of the employees whose leave this manager decides (never includes the manager) */
export async function managedEmployeeIds(actor: { id: string; role: string; employee?: any; delegation?: { sources: any[] } }): Promise<Set<string>> {
    // Give Access: the union of the selected source managers' scopes (never the recipient's own leave)
    if (actor.delegation) {
        const all = new Set<string>();
        for (const src of actor.delegation.sources) (await managedEmployeeIds({ id: src.id, role: src.role, employee: src })).forEach(id => all.add(id));
        all.delete(actor.id);
        return all;
    }
    const ids = new Set<string>((await reportingTree(actor.id)).map((e: any) => String(e.id)));
    if (actor.role === 'HOI' && actor.employee?.location) {
        // Only staff with NO manager assigned at all; anyone with a manager (HOI, TL, …) follows that mapping
        const local: any[] = await Employee.find({ location: actor.employee.location, role: { $in: HOI_FALLBACK_ROLES } }).select('id reportsTo').lean();
        local.forEach(e => {
            const managers = (Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : []).filter(Boolean);
            if (!managers.length) ids.add(String(e.id));
        });
    }
    ids.delete(actor.id);
    return ids;
}
