"use client";

import { useAuth } from "@/context/AuthContext";
import {
    LayoutDashboard, Users, Calendar, LogOut, ShieldCheck, User, Clock,
    Briefcase, Award, Network, Megaphone, Ticket, Receipt,
    FileText, CalendarCheck, AlertTriangle, UserCog, Star, MapPin, ClipboardList,
    Crown, Bell, Activity, Flag, ShieldAlert, Trophy
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/context/AuthContext";

const coreMenu = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Attendance", icon: Clock, path: "/attendance" },
    { label: "Leave", icon: Calendar, path: "/leave" },
    { label: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { label: "Tickets", icon: Ticket, path: "/tickets" },
    { label: "Reimbursement", icon: Receipt, path: "/reimbursement" },
];

const personalMenu = [
    { label: "My Profile", icon: User, path: "/profile" },
    { label: "Announcements", icon: Megaphone, path: "/announcements" },
    { label: "SOP", icon: FileText, path: "/sop" },
    { label: "Org Chart", icon: Network, path: "/hierarchy" },
    { label: "Flag Calendar", icon: Flag, path: "/flag-calendar" },
];

const managerMenu = [
    { label: "Manager Hub", icon: Briefcase, path: "/manager" },
    { label: "Leave Approval", icon: CalendarCheck, path: "/manager/leave-approval" },
    { label: "Report Misbehaviour", icon: AlertTriangle, path: "/manager/misbehaviour" },
    { label: "Ratings", icon: Star, path: "/manager/ratings" },
    { label: "Work Location", icon: MapPin, path: "/manager/work-location" },
    { label: "Holidays", icon: CalendarCheck, path: "/manager/holidays" },
    { label: "Locations Map", icon: MapPin, path: "/locations" },
];

const hrMenu = [
    { label: "HR Hub", icon: UserCog, path: "/hr" },
    { label: "Workforce", icon: Users, path: "/employees" },
    { label: "Holiday Approval", icon: CalendarCheck, path: "/hr/holiday-approval" },
    { label: "Attendance Override", icon: ClipboardList, path: "/hr/attendance-override" },
    { label: "SOP Management", icon: FileText, path: "/hr/sop" },
    { label: "Reimbursements", icon: Receipt, path: "/hr/reimbursements" },
    { label: "PIP Management", icon: ShieldAlert, path: "/hr/pip" },
    { label: "Report Misbehaviour", icon: AlertTriangle, path: "/manager/misbehaviour" },
    { label: "Locations", icon: MapPin, path: "/locations" },
    { label: "Schedule Approval", icon: MapPin, path: "/hr/schedule-approval" },
    { label: "Engagement", icon: Award, path: "/engagement" },
];

const founderMenu = [
    { label: "Founder Console", icon: Crown, path: "/founder" },
    { label: "Communications Log", icon: Activity, path: "/founder/communications" },
    { label: "Workforce", icon: Users, path: "/employees" },
];

// Roles that can see Manager Suite
const MANAGER_ROLES: Role[] = ["FOUNDER", "AD", "HOI"];
// Roles that can see HR Administration
const HR_ROLES: Role[] = ["FOUNDER", "HR"];

function NavSection({ title, items, pathname }: { title: string; items: typeof coreMenu; pathname: string }) {
    return (
        <div>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-3">{title}</p>
            <div className="space-y-0.5">
                {items.map((item) => {
                    const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
                    return (
                        <Link key={item.path + item.label} href={item.path}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                                isActive ? "bg-primary/10 text-primary border border-primary/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent"
                            )}>
                            <item.icon size={14} className={cn(isActive ? "text-primary" : "text-zinc-600 group-hover:text-white")} />
                            <span>{item.label}</span>
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
    FACULTY: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Faculty" },
    PROFESSOR: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Professor" },
};

export default function Sidebar() {
    const { user, logout, getMyNotifications } = useAuth();
    const pathname = usePathname();
    const role = user?.role as Role;
    const emp = user as any;
    const unreadCount = getMyNotifications().filter(n => !n.read).length;

    const roleStyle = role ? ROLE_COLORS[role] : { bg: "bg-zinc-800", text: "text-zinc-400", label: "Guest" };
    const RoleIcon = role === "FOUNDER" ? Crown : role === "HR" ? ShieldCheck : role === "AD" || role === "HOI" ? Briefcase : User;

    return (
        <aside className="w-56 h-screen bg-[#0a0a0b] border-r border-zinc-800/50 flex flex-col py-5 px-3 shrink-0">
            <div className="flex items-center gap-2.5 px-3 mb-8">
                <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-xs font-bold">G</div>
                <div>
                    <h2 className="text-sm font-bold text-white leading-none">GoG OMS</h2>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Management System</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                <NavSection title="Core" items={coreMenu} pathname={pathname} />
                <NavSection title="Personal" items={personalMenu} pathname={pathname} />

                {/* Manager Suite: Visible to FOUNDER, AD, HOI */}
                {role && MANAGER_ROLES.includes(role) && (
                    <NavSection title="Manager Suite" items={managerMenu} pathname={pathname} />
                )}

                {/* HR Administration: Visible to FOUNDER, HR */}
                {role && HR_ROLES.includes(role) && (
                    <NavSection title="HR Administration" items={hrMenu} pathname={pathname} />
                )}

                {/* Founder Console: Visible to FOUNDER only */}
                {role === "FOUNDER" && (
                    <NavSection title="Founder Console" items={founderMenu} pathname={pathname} />
                )}
            </nav>

            <div className="mt-auto space-y-2 px-1">
                {/* Notification badge */}
                {unreadCount > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Bell size={12} className="text-primary" />
                        <span className="text-[10px] font-semibold text-primary">{unreadCount} new notification{unreadCount > 1 ? "s" : ""}</span>
                    </div>
                )}

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
    );
}
