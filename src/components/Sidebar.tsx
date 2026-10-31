"use client";

import { useAuth } from "@/context/AuthContext";
import {
    LayoutDashboard, Users, Calendar, LogOut, ShieldCheck, User, Clock,
    Briefcase, Award, Network, Megaphone, Ticket, Receipt,
    FileText, CalendarCheck, AlertTriangle, UserCog, Star, MapPin, ClipboardList,
    Crown, Bell, Activity, Flag, ShieldAlert, Trophy, TrendingUp, Shirt,
    BookOpen, Timer, Mic, GraduationCap, Video, Download, CalendarDays, BadgeCheck, CalendarRange, KeySquare, Layers,
    Wallet, Mail, Home,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/context/AuthContext";

const coreMenu = [
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

const personalMenu = [
    { label: "My Profile", icon: User, path: "/profile" },
    { label: "Announcements", icon: Megaphone, path: "/announcements" },
    { label: "SOP", icon: FileText, path: "/sop" },
    { label: "Flag Calendar", icon: Flag, path: "/flag-calendar" },
    { label: "Change Password", icon: ShieldCheck, path: "/change-password" },
    { label: "My Salary & Payable Days", icon: Wallet, path: "/my-payable-days" },
    // Notifications moved to the bell at the top right (NotificationBell)
];

const managerMenu = [
    { label: "Manager Hub", icon: Briefcase, path: "/manager" },
    { label: "Academic Monitoring", icon: BookOpen, path: "/manager/reportees/academic-data" },
    { label: "Weekly Calendar", icon: CalendarDays, path: "/academic/weekly-calendar", roles: ["OM", "HOI", "AD", "FOUNDER"] as Role[] },
    { label: "Class Verification", icon: BadgeCheck, path: "/academic/verification", roles: ["OM", "HOI", "AD", "FOUNDER"] as Role[] },
    { label: "Sprint Plan Approvals", icon: CalendarCheck, path: "/curriculum/sprint-plans", roles: ["HOI"] as Role[] },
    { label: "Leave Approval", icon: CalendarCheck, path: "/manager/leave-approval", hideFor: ["OM"] as Role[] },
    { label: "Leave Summary", icon: CalendarRange, path: "/leave-summary", roles: ["HOI", "AD"] as Role[] },
    { label: "Responsibility Approvals", icon: Award, path: "/manager/responsibility-approvals", roles: ["AD", "FOUNDER"] as Role[] },
    { label: "Report Misbehaviour", icon: AlertTriangle, path: "/manager/misbehaviour" },
    { label: "Ratings", icon: Star, path: "/manager/ratings" },
    { label: "Work Location", icon: MapPin, path: "/manager/work-location", hideFor: ["OM"] as Role[] },
    { label: "Monthly Feedback", icon: TrendingUp, path: "/management/monthly", roles: ["FOUNDER", "AD", "HOI"] as Role[] },
    { label: "Holidays", icon: CalendarCheck, path: "/manager/holidays" },
    { label: "Attendance Override", icon: ClipboardList, path: "/manager/attendance-override", hideFor: ["OM"] as Role[] },
    { label: "Locations Map", icon: MapPin, path: "/locations", hideFor: ["OM"] as Role[] },
];

const hrMenu = [
    { label: "HR Hub", icon: UserCog, path: "/hr" },
    { label: "Workforce", icon: Users, path: "/employees" },
    { label: "Leave Management", icon: CalendarCheck, path: "/hr/leave-management" },
    { label: "WFH Management", icon: Home, path: "/hr/wfh-management" },
    { label: "Leave Summary", icon: CalendarRange, path: "/leave-summary" },
    { label: "Work Location", icon: MapPin, path: "/hr/work-location" },
    { label: "Holiday Approval", icon: CalendarCheck, path: "/hr/holiday-approval" },
    { label: "Attendance Log", icon: Clock, path: "/hr/attendance-log" },
    { label: "Attendance Override", icon: ClipboardList, path: "/hr/attendance-override" },
    { label: "Dress Code", icon: Shirt, path: "/hr/dress-code" },
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

// Email Management (HR, HR Executive, Founder): dress code / late / no clock-in / no clock-out emails sent by hand
const emailMenu = [
    { label: "Email Management", icon: Mail, path: "/hr/email-management" },
];

const founderMenu = [
    { label: "Founder Console", icon: Crown, path: "/founder" },
    { label: "Communications Log", icon: Activity, path: "/founder/communications" },
    { label: "Workforce", icon: Users, path: "/employees" },
];

const techLeadMenu = [
    { label: "Leave Approval", icon: CalendarCheck, path: "/manager/leave-approval", roles: ["TL"] as Role[] },
    { label: "Asset Exports", icon: Download, path: "/tech-lead/exports" },
    { label: "System Status", icon: Activity, path: "/tech-lead/status" },
];

const facultyMenu = [
    { label: "Faculty Dashboard", icon: GraduationCap, path: "/faculty" },
    { label: "Sprint Plan", icon: CalendarCheck, path: "/faculty/sprint-plan" },
    { label: "Weekly Calendar", icon: CalendarDays, path: "/academic/weekly-calendar" },
    { label: "My Lectures", icon: Timer, path: "/faculty/lectures" },
    { label: "Lecture Report", icon: Mic, path: "/faculty/lecture-report" },
];

const curriculumMenu = [
    { label: "CL / CH Portal", icon: GraduationCap, path: "/curriculum" },
    { label: "Academic Directory", icon: Network, path: "/academic/directory" },
    { label: "Sprint Plan Grid", icon: CalendarCheck, path: "/curriculum/sprint-plans" },
    { label: "Lecture Quality Hub", icon: Mic, path: "/curriculum/lectures" },
    { label: "Weekly Calendar", icon: CalendarDays, path: "/academic/weekly-calendar", roles: ["CURRICULUM_HEAD", "CURRICULUM_LEAD"] as Role[] },
    { label: "Class Verification", icon: BadgeCheck, path: "/academic/verification", roles: ["CURRICULUM_HEAD", "CURRICULUM_LEAD"] as Role[] },
    { label: "Assign Faculty Tasks", icon: ClipboardList, path: "/curriculum/tasks" },
    { label: "Campus Daily MoM", icon: Video, path: "/curriculum/mom" },
];

// Roles that can see Manager Suite
const MANAGER_ROLES: Role[] = ["FOUNDER", "AD", "HOI", "OM"];
// Roles that can see Curriculum Suite
const CURRICULUM_ROLES: Role[] = ["CURRICULUM_HEAD", "CURRICULUM_LEAD", "FOUNDER", "AD"];
// Roles that can see HR Administration
const HR_ROLES: Role[] = ["FOUNDER", "HR"];
// Roles that can see Faculty Suite
const FACULTY_ROLES: Role[] = ["FACULTY", "PROFESSOR"];
// Roles that can see Tech Support
const TECH_LEAD_ROLES: Role[] = ["TL", "FOUNDER"];

type NavItem = { label: string; icon: typeof LayoutDashboard; path: string; roles?: Role[]; hideFor?: Role[]; badge?: number };

function NavSection({ title, items, pathname, onNavigate, inHub }: { title: string; items: NavItem[]; pathname: string; onNavigate?: () => void; inHub?: boolean }) {
    return (
        <div>
            {title && title !== "Personal" && <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-3">{title}</p>}
            <div className="space-y-0.5">
                {items.map((item) => {
                    const isActive = !inHub && (pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path)));
                    return (
                        <Link key={item.path + item.label} href={item.path} onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                                isActive ? "bg-primary/10 text-primary border border-primary/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent"
                            )}>
                            <item.icon size={14} className={cn(isActive ? "text-primary" : "text-zinc-600 group-hover:text-white")} />
                            <span>{item.label}</span>
                            {!!item.badge && <span className="ml-auto bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

// Role badge colors
const ROLE_COLORS: Record<Role, { bg: string; text: string; label: string }> = {
    FOUNDER: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Founder" },
    HR: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "HR Admin" },
    AD: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Assoc. Director" },
    TL: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Tech Lead" },
    HOI: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Head of Inst." },
    OM: { bg: "bg-cyan-500/20", text: "text-cyan-400", label: "Ops Manager" },
    MARKETING_TEAM: { bg: "bg-indigo-500/20", text: "text-indigo-400", label: "Marketing Team" },
    TECH_TEAM: { bg: "bg-rose-500/20", text: "text-rose-400", label: "Tech Team" },
    FACULTY: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Faculty" },
    PROFESSOR: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Professor" },
    CURRICULUM_HEAD: { bg: "bg-teal-500/20", text: "text-teal-400", label: "Curriculum Head" },
    CURRICULUM_LEAD: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Curriculum Lead" },
    HR_EXECUTIVE: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "HR Executive" },
};
/** HR Executive works in the HR portal without Reimbursements */
const NO_REIMBURSEMENT = (items: NavItem[], u: any) => (u?.hrExecutive ? items.filter(i => i.path !== "/reimbursement" && i.path !== "/hr/reimbursements") : items);

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const { user: contextUser, realUser, logout, getMyNotifications, workSchedules, hubs = [], activeHub, enterHub, exitHub, canManageAccess } = useAuth();
    // The sidebar always belongs to the logged-in designation; delegated hubs are added below it
    const user = realUser ?? contextUser;
    const inHub = !!(contextUser as any)?.delegation;
    const leaveHub = () => { if (activeHub) exitHub?.(); };
    const [hubSource, setHubSource] = useState<Record<string, string>>({});
    const sourceOf = (category: string) => hubSource[category] ?? (activeHub?.category === category ? activeHub.source : "*");
    const pathname = usePathname();
    const role = user?.role as Role;
    const unreadCount = getMyNotifications().filter(n => !n.read).length;
    // HR notification: work schedule changes that HR has not marked as read yet
    const unreadScheduleChanges = (workSchedules || []).filter(s => !s.approvedByHR).length;

    // Unread academic notifications (stored on the server); refreshed every minute and on navigation
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    useEffect(() => {
        if (!user) return;
        let alive = true;
        const loadCount = () => fetch("/api/notifications?unread=1").then(r => r.ok ? r.json() : null).then(d => { if (alive && d) setUnreadNotifications(d.unreadCount || 0); }).catch(() => { });
        loadCount();
        const t = setInterval(loadCount, 60000);
        return () => { alive = false; clearInterval(t); };
    }, [user?.id, pathname]);

    const roleStyle = (user as any)?.hrExecutive ? ROLE_COLORS.HR_EXECUTIVE : role ? ROLE_COLORS[role] : { bg: "bg-zinc-800", text: "text-zinc-400", label: "Guest" };
    const RoleIcon = role === "FOUNDER" ? Crown : role === "HR" ? ShieldCheck : role === "AD" || role === "HOI" ? Briefcase : User;

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "w-56 h-full bg-[#0a0a0b] border-r border-zinc-800/50 flex flex-col py-5 px-3 shrink-0 transition-transform duration-300 ease-in-out z-50",
                "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
                isOpen ? "translate-x-0 shadow-2xl shadow-primary/10" : "-translate-x-full"
            )}>
            <div className="flex items-center gap-2.5 px-3 mb-8">
                {/* <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-xs font-bold">G</div> */}
                <img
                    src="https://i.ibb.co/qYQkmMDR/unnamed-1.png"
                    alt="GOG Logo"
                    className="w-7 h-7 rounded-md object-contain"
                />
                <div>
                    <h2 className="text-sm font-bold text-white leading-none">GOG OMS</h2>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Management System</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                <NavSection title="Core" items={NO_REIMBURSEMENT(coreMenu, user)} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                <NavSection title="Personal" items={personalMenu.map(i => i.path === "/notifications" ? { ...i, badge: unreadNotifications } : i)} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />

                {/* Manager Suite: Visible to FOUNDER, AD, HOI */}
                {role && MANAGER_ROLES.includes(role) && (
                    <NavSection title="Manager Suite" items={managerMenu.filter((i: any) => (!i.roles || i.roles.includes(role)) && !(i.hideFor || []).includes(role))} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* HR Administration: Visible to FOUNDER, HR */}
                {role && HR_ROLES.includes(role) && (
                    <NavSection title={(user as any)?.hrExecutive ? "HR Executive Portal" : "HR Administration"} items={NO_REIMBURSEMENT(hrMenu.map(i => i.path === "/hr/schedule-approval" ? { ...i, badge: unreadScheduleChanges } : i), user)} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* Email Management: HR, HR Executive, Founder */}
                {role && HR_ROLES.includes(role) && (
                    <NavSection title="Email Management" items={emailMenu} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* Faculty Suite: Visible to FACULTY, PROFESSOR */}
                {role && FACULTY_ROLES.includes(role) && (
                    <NavSection title="Faculty Suite" items={facultyMenu} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* CL / CH Portal: one common section for CURRICULUM_LEAD and CURRICULUM_HEAD (also FOUNDER, AD) */}
                {role && CURRICULUM_ROLES.includes(role) && (
                    <NavSection title={role === "CURRICULUM_LEAD" || role === "CURRICULUM_HEAD" ? "CL / CH Portal" : "CL / CH & Academics"} items={curriculumMenu.filter(i => !i.roles || i.roles.includes(role))} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* Founder Console: Visible to FOUNDER only */}
                {role === "FOUNDER" && (
                    <NavSection title="Founder Console" items={founderMenu} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* Tech Support: Visible to TL, FOUNDER */}
                {role && TECH_LEAD_ROLES.includes(role) && (
                    <NavSection title="Tech Support" items={techLeadMenu.filter(i => !i.roles || i.roles.includes(role))} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}
                {/* Give Access: Founder, and Tech Leads the Founder authorised */}
                {(role === "FOUNDER" || canManageAccess) && (
                    <NavSection title="Access Control" items={[{ label: "Give Access", icon: KeySquare, path: "/access" }]} pathname={pathname} onNavigate={leaveHub} inHub={inHub} />
                )}

                {/* Delegated hubs (Give Access) — each hub once, with its source selection */}
                {hubs.map(h => {
                    const src = sourceOf(h.category);
                    const hubActive = inHub && activeHub?.category === h.category;
                    return (
                        <div key={h.category} data-testid={`hub-${h.category}`}>
                            <div className="flex items-center justify-between gap-2 mb-2 px-3">
                                <p className="text-[9px] font-bold text-amber-400/90 uppercase tracking-widest flex items-center gap-1.5"><Layers size={10} /> {h.label}</p>
                            </div>
                            {h.sources.length > 1 || h.mode !== "SELECTED" ? (
                                <select value={src} data-testid={`hub-source-${h.category}`}
                                    onChange={e => {
                                        const v = e.target.value;
                                        setHubSource(p => ({ ...p, [h.category]: v }));
                                        if (hubActive) { enterHub?.(h.category, v); setTimeout(() => window.location.reload(), 50); }
                                    }}
                                    className="w-full mb-1.5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-200 outline-none">
                                    <option value="*">All assigned ({h.sources.length})</option>
                                    {h.sources.map(s => <option key={s.id} value={s.id}>{s.name}{s.campus ? ` · ${s.campus}` : ""}</option>)}
                                </select>
                            ) : (
                                <p className="px-3 mb-1.5 text-[10px] text-zinc-500 truncate">For {h.sources[0]?.name}</p>
                            )}
                            <div className="space-y-0.5">
                                {h.items.map(item => {
                                    const isActive = hubActive && (pathname === item.path || pathname.startsWith(item.path + "/"));
                                    return (
                                        <Link key={h.category + item.path} href={item.path} onClick={() => enterHub?.(h.category, src)} data-testid="hub-link"
                                            className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group border",
                                                isActive ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-transparent")}>
                                            <Layers size={13} className={isActive ? "text-amber-300" : "text-zinc-600 group-hover:text-white"} />
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="mt-auto space-y-2 px-1">


                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className={cn("w-7 h-7 rounded-md overflow-hidden flex items-center justify-center bg-zinc-900 border border-zinc-800", !user?.photoUrl && roleStyle.bg, !user?.photoUrl && roleStyle.text)}>
                        {user?.photoUrl ? (
                            <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <RoleIcon size={14} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{user?.name || "Guest"}</p>
                        <p className="text-[9px] text-primary font-medium">
                            {roleStyle.label} {user?.id ? `· ${user.id}` : ""}
                        </p>
                    </div>
                </div>
                <button onClick={logout}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold text-zinc-500 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-lg transition-colors">
                    <LogOut size={12} /> Sign Out
                </button>
            </div>
        </aside>
        </>
    );
}