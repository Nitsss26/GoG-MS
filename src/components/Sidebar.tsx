"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, ShieldCheck, User, Briefcase, Crown, ChevronDown, Layers } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/context/AuthContext";
import { useSidebarCounts, badgeText } from "@/lib/use-sidebar-counts";

import { buildSidebar, applyRestriction, ROLE_COLORS, omGivenAccessSection, type NavItem } from "@/lib/sidebar-menu";
import { useTempAccess } from "@/lib/use-temp-access";
import { useRoleRestriction } from "@/lib/use-role-restriction";

/** Filled circular count badge at the right end of a menu item (two digits grow into a pill; hidden at 0) */
function CountBadge({ n }: { n?: number }) {
    if (!n || n <= 0) return null;
    return (
        <span data-testid="nav-badge" aria-hidden="true"
            className="ml-auto shrink-0 -my-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none tabular-nums shadow-[0_0_0_2px_#0a0a0b]">
            {badgeText(n)}
        </span>
    );
}

const isActivePath = (pathname: string, path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));

function NavSection({ title, items, pathname, onNavigate, inHub, counts = {}, collapsible, open = true, onToggle }: {
    title: string; items: NavItem[]; pathname: string; onNavigate?: () => void; inHub?: boolean; counts?: Record<string, number>;
    /** HR / HR Executive: the heading opens / closes the section; a red dot shows that something inside is waiting */
    collapsible?: boolean; open?: boolean; onToggle?: () => void;
}) {
    const waiting = items.some(i => (i.badge ?? counts[i.path] ?? 0) > 0);
    return (
        <div data-testid={collapsible ? `nav-sec-${title.replace(/\W+/g, "-").toLowerCase()}` : undefined} data-open={collapsible ? (open ? "1" : "0") : undefined}>
            {collapsible ? (
                <button type="button" onClick={onToggle} aria-expanded={open} data-testid="nav-sec-toggle"
                    className="w-full flex items-center gap-2 px-3 mb-2 py-1 rounded-md text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest">
                    <span className="truncate">{title}</span>
                    {waiting && <span data-testid="nav-sec-dot" aria-label="Pending items" className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />}
                    <ChevronDown size={12} className={cn("ml-auto shrink-0 transition-transform", open ? "rotate-180" : "")} />
                </button>
            ) : title && title !== "Personal" && <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-3">{title}</p>}
            {open && <div className="space-y-0.5">
                {items.map((item) => {
                    const isActive = !inHub && isActivePath(pathname, item.path);
                    const n = item.badge ?? counts[item.path] ?? 0;
                    return (
                        <Link key={item.path + item.label} href={item.path} onClick={onNavigate}
                            aria-label={n > 0 ? `${item.label} (${badgeText(n)})` : undefined} data-nav-path={item.path}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                                isActive ? "bg-primary/10 text-primary border border-primary/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent"
                            )}>
                            <item.icon size={14} className={cn(isActive ? "text-primary" : "text-zinc-600 group-hover:text-white")} />
                            <span className="min-w-0">{item.label}</span>
                            <CountBadge n={n} />
                        </Link>
                    );
                })}
            </div>}
        </div>
    );
}


export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const { user: contextUser, realUser, logout, getMyNotifications, workSchedules, hubs = [], activeHub, enterHub, exitHub, canManageAccess, employees: allEmployees = [] } = useAuth();
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

    // Notification badges (pending / unread counts from the server, for the logged-in designation)
    const counts = useSidebarCounts(user?.id, pathname);

    // Sections and items of this role (lib/sidebar-menu.ts — same as before), without what HR hid or blocked
    // for the role in Admin → Role Management (nothing by default)
    const restriction = useRoleRestriction(user);
    const hasReportees = !!role && (allEmployees as any[]).some(e => e.id !== user?.id && e.isRemoved !== true && (Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : []).includes(user?.id));
    const built = buildSidebar({ role, hrExecutive: !!(user as any)?.hrExecutive, hasReportees, canManageAccess, unreadScheduleChanges, unreadNotifications });
    const collapsibleLayout = built.collapsible;
    // OM Given Access → Full Attire: only while an OM's grant is active (Professor / HOI); nothing changes otherwise
    const omGiven = useTempAccess(user, pathname);
    const layoutSections0 = applyRestriction(built.sections, [...restriction.hidden, ...restriction.blocked]);
    const layoutSections = omGiven ? [...layoutSections0, omGivenAccessSection] : layoutSections0;
    const [openSec, setOpenSec] = useState<Record<string, boolean>>({});
    // the OM Given Access dropdown starts open; every other section as before
    const secOpen = (k: string) => (k === "omgiven" ? openSec[k] !== false : !!openSec[k]);
    const toggleSec = (k: string) => setOpenSec(o => ({ ...o, [k]: !(k === "omgiven" ? o[k] !== false : o[k]) }));
    useEffect(() => {
        if (!collapsibleLayout || inHub) return;
        const sec = layoutSections.find(s => s.items.some(i => isActivePath(pathname, i.path)));
        if (sec) setOpenSec(o => (o[sec.key] ? o : { ...o, [sec.key]: true }));
    }, [pathname, collapsibleLayout, role, inHub]); // eslint-disable-line react-hooks/exhaustive-deps

    const roleStyle0 = (user as any)?.hrExecutive ? ROLE_COLORS.HR_EXECUTIVE : role ? ROLE_COLORS[role] : { bg: "bg-zinc-800", text: "text-zinc-400", label: "Guest" };
    // a role HR created in Role Management shows its own name (colours of its base role)
    const roleStyle = (user as any)?.customRoleLabel ? { ...roleStyle0, label: String((user as any).customRoleLabel) } : roleStyle0;
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

            <nav className={cn("flex-1 overflow-y-auto custom-scrollbar", collapsibleLayout ? "space-y-3" : "space-y-6")}>
                {collapsibleLayout ? layoutSections.map(sec => (
                    <NavSection key={sec.key} title={sec.title} items={sec.items} pathname={pathname} onNavigate={leaveHub} inHub={inHub} counts={counts}
                        collapsible open={secOpen(sec.key)} onToggle={() => toggleSec(sec.key)} />
                )) : layoutSections.map(sec => (
                    sec.key === "omgiven"
                        ? <NavSection key={sec.key} title={sec.title} items={sec.items} pathname={pathname} onNavigate={leaveHub} inHub={inHub} counts={counts} collapsible open={secOpen(sec.key)} onToggle={() => toggleSec(sec.key)} />
                        : <NavSection key={sec.key} title={sec.title} items={sec.items} pathname={pathname} onNavigate={leaveHub} inHub={inHub} counts={counts} />
                ))}

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