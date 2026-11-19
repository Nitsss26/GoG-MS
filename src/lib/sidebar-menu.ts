/**
 * The sidebar of every role: menus and which sections a role sees (moved here unchanged from Sidebar.tsx,
 * so the Admin → Role Management page and its API read the same items the sidebar shows).
 * No browser or database code here.
 */
import {
    LayoutDashboard, Users, Calendar, ShieldCheck, User, Clock,
    Briefcase, Award, Network, Megaphone, Ticket, Receipt,
    FileText, CalendarCheck, AlertTriangle, UserCog, MapPin, ClipboardList,
    Crown, Activity, Flag, ShieldAlert, Trophy, TrendingUp, Shirt,
    BookOpen, Mic, GraduationCap, Video, Download, CalendarDays, BadgeCheck, CalendarRange, KeySquare,
    Wallet, Mail, Home, BookUser, ShieldHalf, History,
} from "lucide-react";
import type { Role } from "@/context/AuthContext";

/** Placement & Intern Head: own portal (dashboard) — same Tech Team features otherwise */
export const PIH_HOME = "/placement-intern-head/dashboard";
export const coreMenu = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Attendance", icon: Clock, path: "/attendance" },
    { label: "Campus MoM", icon: Video, path: "/curriculum/mom" },
    { label: "Leave", icon: Calendar, path: "/leave" },
    { label: "Meetings", icon: Video, path: "/meetings" },
    { label: "Org Chart", icon: Network, path: "/hierarchy" },
    { label: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { label: "Tickets", icon: Ticket, path: "/tickets" },
    { label: "Reimbursement", icon: Receipt, path: "/reimbursement" },
];

export const personalMenu = [
    { label: "My Profile", icon: User, path: "/profile" },
    { label: "Announcements", icon: Megaphone, path: "/announcements" },
    { label: "SOP", icon: FileText, path: "/sop" },
    { label: "Flag Calendar", icon: Flag, path: "/flag-calendar" },
    { label: "Change Password", icon: ShieldCheck, path: "/change-password" },
    { label: "My Salary & Payable Days", icon: Wallet, path: "/my-payable-days" },
    // Notifications moved to the bell at the top right (NotificationBell)
];

export const managerMenu = [
    { label: "Manager Hub", icon: Briefcase, path: "/manager" },
    { label: "Academic Monitoring", icon: BookOpen, path: "/manager/reportees/academic-data" },
    { label: "Weekly Calendar", icon: CalendarDays, path: "/academic/weekly-calendar", roles: ["OM", "HOI", "AD", "FOUNDER"] as Role[] },
    { label: "Class Verification", icon: BadgeCheck, path: "/academic/verification", roles: ["OM", "HOI", "AD", "FOUNDER"] as Role[] },
    { label: "Full Attire", icon: Shirt, path: "/full-attire", roles: ["OM"] as Role[] },
    { label: "Location Justifications", icon: MapPin, path: "/attendance/location-justifications", roles: ["HOI", "AD"] as Role[] },
    { label: "Sprint Plan Audit", icon: CalendarCheck, path: "/curriculum/sprint-plans", roles: ["HOI"] as Role[] },
    { label: "Leave Approval", icon: CalendarCheck, path: "/manager/leave-approval", hideFor: ["OM"] as Role[] },
    { label: "Leave Summary", icon: CalendarRange, path: "/leave-summary", roles: ["HOI", "AD"] as Role[] },
    { label: "Responsibility Approvals", icon: Award, path: "/manager/responsibility-approvals", roles: ["AD", "FOUNDER"] as Role[] },
    { label: "Report Misbehaviour", icon: AlertTriangle, path: "/manager/misbehaviour" },
    // "Ratings" removed: Monthly Feedback does the same job and is the one that is saved + counted on the Leaderboard
    { label: "Work Location", icon: MapPin, path: "/manager/work-location", hideFor: ["OM", "AD"] as Role[] },
    { label: "Monthly Feedback", icon: TrendingUp, path: "/management/monthly", roles: ["FOUNDER", "AD", "HOI"] as Role[] },
    { label: "Holidays", icon: CalendarCheck, path: "/manager/holidays", hideFor: ["OM", "AD"] as Role[] },
    { label: "Attendance Override", icon: ClipboardList, path: "/manager/attendance-override", hideFor: ["OM", "AD", "HR", "FOUNDER"] as Role[] },
    { label: "Locations Map", icon: MapPin, path: "/locations", hideFor: ["OM"] as Role[] },
];

export const hrMenu = [
    { label: "HR Hub", icon: UserCog, path: "/hr" },
    { label: "Workforce", icon: Users, path: "/employees" },
    { label: "Employee Directory", icon: BookUser, path: "/hr/employee-directory" },
    { label: "Leave Management", icon: CalendarCheck, path: "/hr/leave-management" },
    { label: "WFH Management", icon: Home, path: "/hr/wfh-management" },
    { label: "Leave Summary", icon: CalendarRange, path: "/leave-summary" },
    { label: "Work Location", icon: MapPin, path: "/hr/work-location" },
    { label: "Holiday Approval", icon: CalendarCheck, path: "/hr/holiday-approval" },
    { label: "Attendance Log", icon: Clock, path: "/hr/attendance-log" },
    { label: "Attendance Override", icon: ClipboardList, path: "/hr/attendance-override" },
    { label: "Dress Code", icon: Shirt, path: "/hr/dress-code" },
    { label: "Full Attire", icon: Shirt, path: "/hr/full-attire" },
    { label: "SOP Management", icon: FileText, path: "/hr/sop" },
    { label: "Reimbursements", icon: Receipt, path: "/hr/reimbursements" },
    { label: "PIP Management", icon: ShieldAlert, path: "/hr/pip" },
    { label: "Report Misbehaviour", icon: AlertTriangle, path: "/manager/misbehaviour" },
    { label: "Locations", icon: MapPin, path: "/locations" },
    { label: "Schedule Changes", icon: MapPin, path: "/hr/schedule-approval" },
    { label: "Engagement", icon: Award, path: "/engagement" },
    { label: "Onboarding", icon: UserCog, path: "/hr/onboarding" },
    { label: "Flag Removal", icon: Flag, path: "/hr/flag-removal" },
    { label: "Employee Salary Management", icon: Wallet, path: "/hr/salary-management" },
];

// HR / HR Executive: approvals grouped under their own heading (Tickets moves here from Core; Flag Calendar goes to HR Administration)
export const HR_APPROVAL_PATHS = ["/tickets", "/hr/reimbursements", "/hr/leave-management", "/hr/wfh-management", "/hr/dress-code", "/hr/full-attire", "/hr/schedule-approval"];
// HR / HR Executive sidebar only (Founder keeps them): Attendance Override and Engagement are not listed
export const HR_LAYOUT_HIDDEN = ["/hr/attendance-override", "/engagement"];
export const hrApprovalsMenu = HR_APPROVAL_PATHS.map(p => p === "/tickets" ? { label: "Tickets", icon: Ticket, path: "/tickets" } : hrMenu.find(i => i.path === p)!);

// Email Management (HR, HR Executive, Founder): dress code / late / no clock-in / no clock-out emails sent by hand
export const emailMenu = [
    { label: "Email Management", icon: Mail, path: "/hr/email-management" },
];

export const founderMenu = [
    { label: "Founder Console", icon: Crown, path: "/founder" },
    { label: "Communications Log", icon: Activity, path: "/founder/communications" },
    { label: "Workforce", icon: Users, path: "/employees" },
];

export const techLeadMenu = [
    { label: "Leave Approval", icon: CalendarCheck, path: "/manager/leave-approval", roles: ["TL"] as Role[] },
    { label: "Asset Exports", icon: Download, path: "/tech-lead/exports" },
    { label: "System Status", icon: Activity, path: "/tech-lead/status" },
];

export const facultyMenu = [
    { label: "Faculty Dashboard", icon: GraduationCap, path: "/faculty" },
    { label: "Sprint Plan", icon: CalendarCheck, path: "/faculty/sprint-plan" },
    { label: "Weekly Calendar", icon: CalendarDays, path: "/academic/weekly-calendar" },
    { label: "Lecture Report", icon: Mic, path: "/faculty/lecture-report" },
];

export const curriculumMenu = [
    { label: "CL / CH Portal", icon: GraduationCap, path: "/curriculum" },
    { label: "Academic Directory", icon: Network, path: "/academic/directory" },
    { label: "Sprint Plan Grid", icon: CalendarCheck, path: "/curriculum/sprint-plans" },
    { label: "Lecture Quality Hub", icon: Mic, path: "/curriculum/lectures" },
    { label: "Weekly Calendar", icon: CalendarDays, path: "/academic/weekly-calendar", roles: ["CURRICULUM_HEAD", "CURRICULUM_LEAD"] as Role[] },
    { label: "Class Verification", icon: BadgeCheck, path: "/academic/verification", roles: ["CURRICULUM_HEAD", "CURRICULUM_LEAD"] as Role[] },
    { label: "Assign Faculty Tasks", icon: ClipboardList, path: "/curriculum/tasks" },
    { label: "Campus Daily MoM", icon: Video, path: "/curriculum/mom" },
];

/** OM Given Access: added below a Professor's / HOI's own sidebar only while an OM's grant is active */
export const omGivenAccessSection: NavSectionDef = { key: "omgiven", title: "OM Given Access", items: [{ label: "Full Attire", icon: Shirt, path: "/full-attire" }] };

/** Admin (HR — not HR Executive — and Founder): Role Management */
export const adminMenu = [
    { label: "Role Management", icon: ShieldHalf, path: "/admin/roles" },
    { label: "Role Activity Logs", icon: History, path: "/admin/role-logs" },
];

// HOI / OM / AD / CL / CH: collapsible sidebar — Core, Personal, Academic Management, Faculty Management
export const MGR_LAYOUT_ROLES: Role[] = ["HOI", "OM", "AD", "CURRICULUM_LEAD", "CURRICULUM_HEAD"];
/** pages that go under "Academic Management" (everything else of Manager Suite / CL-CH Portal / My Team → "Faculty Management") */
export const ACADEMIC_PATHS = ["/curriculum", "/manager/reportees/academic-data", "/academic/directory", "/academic/weekly-calendar", "/academic/verification", "/curriculum/sprint-plans", "/curriculum/lectures", "/curriculum/mom"];
// Roles that can see Manager Suite
export const MANAGER_ROLES: Role[] = ["FOUNDER", "AD", "HOI", "OM"];
// Roles that can see Curriculum Suite
export const CURRICULUM_ROLES: Role[] = ["CURRICULUM_HEAD", "CURRICULUM_LEAD", "FOUNDER", "AD"];
// Roles that can see HR Administration
export const HR_ROLES: Role[] = ["FOUNDER", "HR"];
// Roles that can see Faculty Suite
export const FACULTY_ROLES: Role[] = ["FACULTY", "PROFESSOR"];
// Roles that can see Tech Support
export const TECH_LEAD_ROLES: Role[] = ["TL", "FOUNDER"];

export type NavItem = { label: string; icon: typeof LayoutDashboard; path: string; roles?: Role[]; hideFor?: Role[]; badge?: number };
export type NavSectionDef = { key: string; title: string; items: NavItem[] };

// Role badge colors
export const ROLE_COLORS: Record<Role, { bg: string; text: string; label: string }> = {
    FOUNDER: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Founder" },
    HR: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "HR Admin" },
    AD: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Assoc. Director" },
    TL: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Tech Lead" },
    HOI: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Head of Inst." },
    OM: { bg: "bg-cyan-500/20", text: "text-cyan-400", label: "Ops Manager" },
    MARKETING_TEAM: { bg: "bg-indigo-500/20", text: "text-indigo-400", label: "Marketing Team" },
    TECH_TEAM: { bg: "bg-rose-500/20", text: "text-rose-400", label: "Tech Team" },
    PLACEMENT_INTERN_HEAD: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Placement & Intern Head" },
    TECH_INTERN: { bg: "bg-rose-500/20", text: "text-rose-300", label: "Tech Intern" },
    FACULTY: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Faculty" },
    PROFESSOR: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Professor" },
    CURRICULUM_HEAD: { bg: "bg-teal-500/20", text: "text-teal-400", label: "Curriculum Head" },
    CURRICULUM_LEAD: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Curriculum Lead" },
    HR_EXECUTIVE: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "HR Executive" },
};
/** HR Executive works in the HR portal without Reimbursements; the Tech Intern portal has no Reimbursement either */
export const NO_REIMBURSEMENT = (items: NavItem[], u: any) => (u?.hrExecutive || u?.role === "TECH_INTERN" ? items.filter(i => i.path !== "/reimbursement" && i.path !== "/hr/reimbursements") : items);

export type SidebarInput = {
    role?: Role;
    hrExecutive?: boolean;
    /** HR assigned someone to report to this employee (My Team) */
    hasReportees?: boolean;
    /** Give Access: Founder, or a Tech Lead the Founder authorised */
    canManageAccess?: boolean;
    unreadScheduleChanges?: number;
    unreadNotifications?: number;
};

/**
 * The sections the sidebar shows for this role, in order. `collapsible` = HR, Founder, HOI / OM / AD / CL / CH
 * (dropdown sections); otherwise plain headings. Same items and order as before.
 */
export function buildSidebar(input: SidebarInput): { collapsible: boolean; sections: NavSectionDef[] } {
    const { role, hrExecutive, hasReportees = false, canManageAccess = false, unreadScheduleChanges = 0, unreadNotifications = 0 } = input;
    const user = { role, hrExecutive };
    const myTeamItems = (): NavItem[] => {
        if (!role || HR_ROLES.includes(role)) return [];
        if (!hasReportees) return [];
        return [
            // Leave Approval is already in Manager Suite (HOI / AD / Founder) and Tech Support (TL)
            ...(["HOI", "AD", "FOUNDER", "TL"].includes(role) ? [] : [{ label: "Leave Approval", icon: CalendarCheck, path: "/manager/leave-approval" }]),
            // WFH approvals of HOI / AD / TL / OM are in Attendance → team view
            ...(["HOI", "AD", "TL", "OM", "FOUNDER"].includes(role) ? [] : [{ label: "WFH Approvals", icon: Home, path: "/manager/wfh-approvals" }]),
        ];
    };

    const hrLayout = role === "HR";
    if (hrLayout) return {
        collapsible: true, sections: [
            { key: "core", title: "Core", items: NO_REIMBURSEMENT([...coreMenu.filter(i => i.path !== "/tickets"), personalMenu.find(i => i.path === "/announcements")!], user) },
            { key: "personal", title: "Personal", items: personalMenu.filter(i => i.path !== "/flag-calendar" && i.path !== "/announcements") },
            { key: "approvals", title: "HR Approvals", items: NO_REIMBURSEMENT(hrApprovalsMenu.map(i => i.path === "/hr/schedule-approval" ? { ...i, badge: unreadScheduleChanges } : i), user) },
            { key: "admin", title: hrExecutive ? "HR Executive Portal" : "HR Administration", items: NO_REIMBURSEMENT([...hrMenu.filter(i => !HR_APPROVAL_PATHS.includes(i.path) && !HR_LAYOUT_HIDDEN.includes(i.path)), { label: "Flag Calendar", icon: Flag, path: "/flag-calendar" }], user) },
            { key: "email", title: "Email Management", items: emailMenu },
            // Admin → Role Management: HR (not HR Executive)
            ...(hrExecutive ? [] : [{ key: "roleadmin", title: "Admin", items: adminMenu }]),
        ],
    };

    // HOI / OM / AD / CL / CH: the same items as before (Manager Suite, CL / CH Portal, My Team), grouped in two dropdowns
    if (role && MGR_LAYOUT_ROLES.includes(role)) {
        const pool: NavItem[] = [
            ...(MANAGER_ROLES.includes(role) ? managerMenu.filter((i: any) => (!i.roles || i.roles.includes(role)) && !(i.hideFor || []).includes(role)) : []),
            ...(CURRICULUM_ROLES.includes(role) ? curriculumMenu.filter(i => !i.roles || i.roles.includes(role)) : []),
            ...myTeamItems(),
        ].filter((i, idx, all) => all.findIndex(x => x.path === i.path) === idx);
        return {
            collapsible: true, sections: [
                { key: "core", title: "Core", items: NO_REIMBURSEMENT(coreMenu, user) },
                { key: "personal", title: "Personal", items: personalMenu.map(i => i.path === "/notifications" ? { ...i, badge: unreadNotifications } : i) },
                { key: "academic", title: "Academic Management", items: pool.filter(i => ACADEMIC_PATHS.includes(i.path)) },
                { key: "faculty", title: "Faculty Management", items: pool.filter(i => !ACADEMIC_PATHS.includes(i.path)) },
            ].filter(sec => sec.items.length),
        };
    }

    // Founder: the same sections as before (same headings, same items), each one a dropdown
    if (role === "FOUNDER") return {
        collapsible: true, sections: [
            { key: "core", title: "Core", items: NO_REIMBURSEMENT(coreMenu, user) },
            { key: "personal", title: "Personal", items: personalMenu.map(i => i.path === "/notifications" ? { ...i, badge: unreadNotifications } : i) },
            { key: "manager", title: "Academic Suite", items: managerMenu.filter((i: any) => (!i.roles || i.roles.includes("FOUNDER")) && !(i.hideFor || []).includes("FOUNDER")) },
            { key: "hradmin", title: hrExecutive ? "HR Executive Portal" : "HR Administration", items: NO_REIMBURSEMENT(hrMenu.filter(i => i.path !== "/hr/attendance-override").map(i => i.path === "/hr/schedule-approval" ? { ...i, badge: unreadScheduleChanges } : i), user) },
            { key: "email", title: "Email Management", items: emailMenu },
            { key: "curriculum", title: "CL / CH & Academics", items: curriculumMenu.filter(i => !i.roles || i.roles.includes("FOUNDER")) },
            { key: "founder", title: "Founder Console", items: founderMenu },
            { key: "myteam", title: "My Team", items: myTeamItems() },
            { key: "tech", title: "Tech Support", items: techLeadMenu.filter(i => !i.roles || i.roles.includes("FOUNDER")) },
            { key: "access", title: "Access Control", items: [{ label: "Give Access", icon: KeySquare, path: "/access" }] },
            { key: "roleadmin", title: "Admin", items: adminMenu },
        ].filter(sec => sec.items.length),
    };

    // Every other role: plain headings (Core, Personal, then the suites the role has)
    const sections: NavSectionDef[] = [
        { key: "core", title: "Core", items: NO_REIMBURSEMENT(role === "PLACEMENT_INTERN_HEAD" ? coreMenu.map(i => (i.path === "/" ? { ...i, path: PIH_HOME } : i)) : coreMenu, user) },
        { key: "personal", title: "Personal", items: personalMenu.map(i => i.path === "/notifications" ? { ...i, badge: unreadNotifications } : i) },
    ];
    if (role && MANAGER_ROLES.includes(role)) sections.push({ key: "manager", title: "Manager Suite", items: managerMenu.filter((i: any) => (!i.roles || i.roles.includes(role)) && !(i.hideFor || []).includes(role)) });
    if (role && HR_ROLES.includes(role)) {
        sections.push({ key: "hradmin", title: hrExecutive ? "HR Executive Portal" : "HR Administration", items: NO_REIMBURSEMENT(hrMenu.map(i => i.path === "/hr/schedule-approval" ? { ...i, badge: unreadScheduleChanges } : i), user) });
        sections.push({ key: "email", title: "Email Management", items: emailMenu });
    }
    if (role && FACULTY_ROLES.includes(role)) sections.push({ key: "faculty", title: "Faculty Suite", items: facultyMenu });
    if (role && CURRICULUM_ROLES.includes(role)) sections.push({ key: "curriculum", title: role === "CURRICULUM_LEAD" || role === "CURRICULUM_HEAD" ? "CL / CH Portal" : "CL / CH & Academics", items: curriculumMenu.filter(i => !i.roles || i.roles.includes(role)) });
    if ((role as string) === "FOUNDER") sections.push({ key: "founder", title: "Founder Console", items: founderMenu });
    if (role) { const items = myTeamItems(); if (items.length) sections.push({ key: "myteam", title: "My Team", items }); }
    if (role && TECH_LEAD_ROLES.includes(role)) sections.push({ key: "tech", title: "Tech Support", items: techLeadMenu.filter(i => !i.roles || i.roles.includes(role)) });
    if ((role as string) === "FOUNDER" || canManageAccess) sections.push({ key: "access", title: "Access Control", items: [{ label: "Give Access", icon: KeySquare, path: "/access" }] });
    return { collapsible: false, sections };
}

/** Role Management: drop the items HR hid or blocked for this role (sections left empty disappear) */
export function applyRestriction(sections: NavSectionDef[], removed: string[]): NavSectionDef[] {
    if (!removed.length) return sections;
    return sections.map(s => ({ ...s, items: s.items.filter(i => !removed.includes(i.path)) })).filter(s => s.items.length);
}

/** Every sidebar item a role can have (with reportees — My Team — included), once per path, for Role Management */
export function sidebarItemsOfRole(role: string): { path: string; label: string; section: string }[] {
    const hrExecutive = role === "HR_EXECUTIVE";
    const { sections } = buildSidebar({ role: (hrExecutive ? "HR" : role) as Role, hrExecutive, hasReportees: true });
    const out: { path: string; label: string; section: string }[] = [];
    for (const s of sections) for (const i of s.items) if (!out.some(o => o.path === i.path)) out.push({ path: i.path, label: i.label, section: s.title });
    return out;
}