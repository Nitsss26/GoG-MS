/**
 * SERVER-ONLY: which announcements a user sees (moved here unchanged from GET /api/notices, so the
 * Announcements page and the sidebar unread badge use the same rule).
 */
import { Location } from '@/models/Schemas';
import { getAcademicScope } from '@/lib/academic';

/** Location ids a user belongs to: Original Location, HOI authorised attendance locations, colleges an HOI manages */
export async function myCollegeIds(actor: any): Promise<Set<string>> {
    const ids = new Set<string>();
    const emp: any = actor?.employee;
    if (emp?.location) {
        const loc: any = await Location.findOne({ $or: [{ id: emp.location }, { name: emp.location }, { shortName: emp.location }] }).select('id').lean();
        ids.add(loc?.id || emp.location);
    }
    (emp?.attendanceLocations || []).forEach((x: string) => ids.add(x));
    if (actor?.role === 'HOI') (await getAcademicScope({ role: 'HOI', employee: emp })).colleges.forEach(c => ids.add(c.id));
    return ids;
}

/**
 * Existing announcements (no college scope) are visible to everyone, as before.
 * College-scoped announcements (e.g. an HOI holiday announcement) are visible to that college's employees,
 * the HOI who manages it, its author, and HR / Founder / AD.
 */
export async function visibleNotices<T extends { collegeIds?: string[]; source?: string; createdById?: string }>(notices: T[], actor: any): Promise<T[]> {
    const seesAll = actor && ['HR', 'FOUNDER', 'AD'].includes(actor.role);
    const needsMine = actor && !seesAll && notices.some(n => (n.collegeIds || []).length);
    const mine = needsMine ? await myCollegeIds(actor) : new Set<string>();
    return notices.filter(n => {
        const scope: string[] = n.collegeIds || [];
        if (!scope.length) return true;
        if (!actor) return false;
        // HOI college announcement: visible to everyone (only its e-mail goes to the selected colleges' professors / OMs)
        if (n.source === 'HOI_COLLEGE_ANNOUNCEMENT' || n.source === 'HR_ANNOUNCEMENT') return true;
        return seesAll || n.createdById === actor.id || scope.some(id => mine.has(id));
    });
}
