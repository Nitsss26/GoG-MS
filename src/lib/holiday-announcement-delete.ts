import { Holiday } from '@/models/Schemas';

/** A holiday announcement: category Holiday, linked to holiday days, or the older "Holiday: …" title */
export const isHolidayNotice = (n: any) => !!n && (n.category === 'Holiday' || !!n.holidayId || (n.holidayIds || []).length > 0 || /^holiday:/i.test(String(n.title || '')));

const sameScope = (h: any, n: any) => {
    const ids: string[] = (n.collegeIds || []).filter(Boolean);
    if (!ids.length) return !!h.forAll || !(h.collegeIds || []).length;
    return !h.forAll && (h.collegeIds || []).some((c: string) => ids.includes(c));
};

/**
 * The holiday day records an announcement created (every day of a multi-day holiday).
 *  1. linked ids on the notice (holidayIds / holidayId) and day records carrying announcementId = notice id
 *  2. older announcements without a link: approved holidays with the same name and scope,
 *     approved (or created) on the day the announcement was posted — the way those announcements were made
 */
export async function holidaysOfNotice(n: any): Promise<any[]> {
    if (!isHolidayNotice(n)) return [];
    const linkIds: string[] = [...(n.holidayIds || []), ...(n.holidayId ? [n.holidayId] : [])].filter(Boolean);
    const or: any[] = [{ announcementId: n.id }];
    if (linkIds.length) or.push({ id: { $in: linkIds } });
    let list: any[] = await Holiday.find({ $or: or }).lean();
    // A multi-day holiday made on the Holidays page: day ids "<base>-<date>" created together (same name, same time,
    // same colleges). Only those days are added — ids like "HOL-<college>-<date>" share a prefix with OTHER holidays
    // of that college, so the name + created time + colleges must match too (other holidays are never touched).
    const sameScopeAs = (a: any, b: any) => !!a.forAll === !!b.forAll && [...(a.collegeIds || [])].sort().join(',') === [...(b.collegeIds || [])].sort().join(',');
    for (const h of [...list]) {
        const base = String(h.id || '').match(/^(.+)-\d{4}-\d{2}-\d{2}$/)?.[1];
        const made = h.proposedAt || h.createdAt;
        if (!base || !made) continue;
        const same: any[] = await Holiday.find({ name: h.name, $or: [{ proposedAt: made }, { createdAt: made }] }).lean();
        list = [...list, ...same.filter(x => String(x.id).startsWith(base + '-') && /-\d{4}-\d{2}-\d{2}$/.test(String(x.id)) && sameScopeAs(x, h))];
    }
    if (!list.length && !linkIds.length) {
        const name = String(n.title || '').replace(/^holiday:\s*/i, '').trim();
        const day = String(n.createdAt || '').slice(0, 10);
        if (name && day) {
            const cands: any[] = await Holiday.find({ name, status: 'Approved' }).lean();
            // never a holiday HR assigned manually (it has no announcement)
            list = cands.filter(h => h.source !== 'HR_MANUAL' && !(h.employeeIds || []).length && String(h.approvedAt || h.proposedAt || h.createdAt || '').slice(0, 10) === day && sameScope(h, n));
        }
    }
    const seen = new Set<string>();
    return list.filter(h => (seen.has(h.id) ? false : (seen.add(h.id), true))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}