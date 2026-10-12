/**
 * Give Access — what each delegable category opens (shared by server and client).
 *
 * A grant gives a RECIPIENT the hub of a CATEGORY for a set of SOURCE employees of that category.
 * The recipient keeps their own login designation; the hub's pages run with the category's role
 * and the union of the selected sources' scopes (enforced on the server, see src/lib/access-control.ts).
 * Every hub item is an existing portal page — nothing new or dummy.
 */
export type HubItem = { label: string; path: string };
export type HubDef = { category: string; label: string; role: string; sourceRoles: string[]; items: HubItem[]; note?: string };

export const ACCESS_HEADER = 'x-gog-access';

export const HUBS: HubDef[] = [
    {
        category: 'HOI', label: 'HOI Hub', role: 'HOI', sourceRoles: ['HOI'], items: [
            { label: 'Academic Monitoring', path: '/manager/reportees/academic-data' },
            { label: 'Sprint Plan Approvals', path: '/curriculum/sprint-plans' },
            { label: 'Class Verification', path: '/academic/verification' },
            { label: 'Weekly Calendar', path: '/academic/weekly-calendar' },
            { label: 'Leave Approvals', path: '/manager/leave-approval' },
            { label: 'Leave Summary', path: '/leave-summary' },
        ],
    },
    {
        category: 'AD', label: 'AD Hub', role: 'AD', sourceRoles: ['AD'], items: [
            { label: 'Academic Monitoring', path: '/manager/reportees/academic-data' },
            { label: 'Class Verification', path: '/academic/verification' },
            { label: 'Weekly Calendar', path: '/academic/weekly-calendar' },
            { label: 'Leave Approvals', path: '/manager/leave-approval' },
            { label: 'Leave Summary', path: '/leave-summary' },
            { label: 'Responsibility Approvals', path: '/manager/responsibility-approvals' },
        ],
    },
    {
        category: 'OM', label: 'OM Hub', role: 'OM', sourceRoles: ['OM'], items: [
            { label: 'Daily Lectures', path: '/manager/daily-lectures' },
            { label: 'Class Verification', path: '/academic/verification' },
            { label: 'Weekly Calendar', path: '/academic/weekly-calendar' },
            { label: 'Leave Approvals', path: '/manager/leave-approval' },
        ],
    },
    {
        category: 'CURRICULUM_LEAD', label: 'CL Hub', role: 'CURRICULUM_LEAD', sourceRoles: ['CURRICULUM_LEAD'], items: [
            { label: 'Sprint Plan Grid', path: '/curriculum/sprint-plans' },
            { label: 'Lecture Quality Hub', path: '/curriculum/lectures' },
            { label: 'Class Verification', path: '/academic/verification' },
            { label: 'Weekly Calendar', path: '/academic/weekly-calendar' },
        ],
    },
    {
        category: 'CURRICULUM_HEAD', label: 'CH Hub', role: 'CURRICULUM_HEAD', sourceRoles: ['CURRICULUM_HEAD'], items: [
            { label: 'Sprint Plan Grid', path: '/curriculum/sprint-plans' },
            { label: 'Lecture Quality Hub', path: '/curriculum/lectures' },
            { label: 'Class Verification', path: '/academic/verification' },
            { label: 'Weekly Calendar', path: '/academic/weekly-calendar' },
        ],
    },
    {
        category: 'TL', label: 'Tech Lead Hub', role: 'TL', sourceRoles: ['TL'], items: [
            { label: 'Leave Approvals', path: '/manager/leave-approval' },
            { label: 'Asset Exports', path: '/tech-lead/exports' },
            { label: 'System Status', path: '/tech-lead/status' },
        ],
    },
    {
        category: 'HR', label: 'HR Hub', role: 'HR', sourceRoles: ['HR'], items: [
            { label: 'Leave Management', path: '/hr/leave-management' },
            { label: 'Leave Summary', path: '/leave-summary' },
        ],
        note: 'Leave decisions and the leave summary. Employee records, passwords and removals stay with HR.',
    },
    {
        category: 'PROFESSOR', label: 'Faculty Hub', role: 'FACULTY_VIEWER', sourceRoles: ['PROFESSOR', 'FACULTY'], items: [
            { label: 'Academic Monitoring', path: '/manager/reportees/academic-data' },
        ],
        note: 'View-only: sprint plans, teaching schedule and lecture audit of the selected professors.',
    },
];

/** Roles that can never be delegated */
export const PROTECTED_CATEGORIES = ['FOUNDER'];

export const hubOf = (category: string) => HUBS.find(h => h.category === category);
/** Category of an employee role (FACULTY and PROFESSOR share the Faculty Hub) */
export const categoryOfRole = (role: string) => (role === 'FACULTY' ? 'PROFESSOR' : role);
export const hubHasPath = (category: string, pathname: string) =>
    !!hubOf(category)?.items.some(i => pathname === i.path || pathname.startsWith(i.path + '/'));
