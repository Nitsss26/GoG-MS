"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Layers, CalendarDays } from "lucide-react";
import { useServerClock, istLongDate, istClock } from "@/lib/server-clock";
import Sidebar from "./Sidebar";
import OnboardingModal from "./OnboardingModal";
import NotificationBell from "./NotificationBell";

/** Same label the dashboard used ("HR Administration Dashboard", "Employee Dashboard", …) */
function dashboardLabel(user: any) {
    const role = user?.role;
    if (role === "HR") return user?.hrExecutive ? "HR Executive" : "HR Administration";
    if (role === "FOUNDER") return "Founder";
    if (["AD", "HOI", "TL"].includes(role)) return `${role} · ${user?.designation || ""}`;
    return "Employee";
}

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, authLoading, exitHub } = useAuth();
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    // Date + time in the top bar come from the server clock (IST), not the device clock
    const { now: srvNow } = useServerClock();
    // Desktop top bar is shown from 1024px (same as Tailwind "lg") — decided here, not by a CSS class,
    // so it shows on every build even when a responsive class is missing from the generated CSS
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    // Missing Clock-Out alerts need a periodic check; on serverless hosting there is no running timer, so logged-in
    // pages ping it (the server runs it at most once per 5 minutes for the whole site)
    useEffect(() => {
        if (!user) return;
        const ping = () => { fetch("/api/attendance/violations/sweep", { cache: "no-store" }).catch(() => {}); };
        ping();
        const t = setInterval(ping, 5 * 60000);
        return () => clearInterval(t);
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const isAuthPage = pathname === "/login";
    const isStandalonePage = pathname.startsWith("/manager/lecture-report/");

    useEffect(() => {
        if (authLoading) return; // Wait for auth to initialize
        
        setIsMobileOpen(false); // Close sidebar on route change
        if (!user && !isAuthPage) {
            // Leave e-mail link opened while logged out: come back to it after login
            if (pathname === "/leave-action") { try { sessionStorage.setItem("gog_after_login", window.location.pathname + window.location.search); } catch { /* ignore */ } }
            router.push("/login");
            return;
        }
        if (user && isAuthPage) {
            // (same target as login(): a leave e-mail link opened before logging in)
            let next = "/";
            try { const s = sessionStorage.getItem("gog_after_login") || ""; sessionStorage.removeItem("gog_after_login"); if (s.startsWith("/leave-action?")) next = s; } catch { /* ignore */ }
            router.push(next);
            return;
        }
    }, [user, authLoading, pathname, router, isAuthPage]);

    if (authLoading) return null;

    if (isStandalonePage) {
        return (
            <div className="min-h-screen w-full bg-white text-zinc-900 selection:bg-indigo-100">
                {children}
            </div>
        );
    }

    const showSidebar = user && !isAuthPage;

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {showSidebar && (
                <Sidebar 
                    isOpen={isMobileOpen} 
                    onClose={() => setIsMobileOpen(false)} 
                />
            )}
            
            <div className="flex-1 flex flex-col min-w-0 h-screen relative">
                {/* Mobile Top Header */}
                {showSidebar && (
                    <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-40">
                        <div className="flex items-center gap-2">
                            <img
                                src="https://i.ibb.co/qYQkmMDR/unnamed-1.png"
                                alt="GOG Logo"
                                className="w-6 h-6 rounded-md object-contain"
                            />
                            <span className="text-sm font-bold text-white">Organisation Management System</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <NotificationBell />
                            <button 
                                onClick={() => setIsMobileOpen(!isMobileOpen)}
                                className="p-2 text-zinc-400 hover:text-white transition-colors"
                            >
                                {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>
                        </div>
                    </header>
                )}

                {/* Desktop top bar: dashboard greeting on the left, notification bell at the top right */}
                {showSidebar && isDesktop && (
                    <div className="items-center justify-between gap-4 px-8 py-3 border-b border-zinc-900 bg-[#0a0a0b]/80 backdrop-blur-md shrink-0 relative z-[60]" style={{ display: "flex" }} data-testid="top-bar">
                        <div className="min-w-0" data-testid="top-bar-greeting">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{dashboardLabel(user)} Dashboard</p>
                            <p className="text-xl font-extrabold text-white tracking-tight truncate">Welcome back, {user?.name}</p>
                        </div>
                        {/* Date + time to the left of the notification bell */}
                        <div className="flex items-center gap-3 shrink-0">
                            {srvNow && (
                                <div className="flex items-center gap-3 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/70" data-testid="top-bar-date">
                                    <CalendarDays size={18} className="text-zinc-400 shrink-0" />
                                    <div className="leading-tight">
                                        <p className="text-[13px] font-semibold text-zinc-100 whitespace-nowrap">{istLongDate(srvNow)}</p>
                                        <p className="text-[11px] text-zinc-500 whitespace-nowrap" data-testid="top-bar-time">{istClock(srvNow)}</p>
                                    </div>
                                </div>
                            )}
                            <NotificationBell />
                        </div>
                    </div>
                )}

                {/* Working inside a delegated hub (Give Access) */}
                {showSidebar && (user as any)?.delegation && (
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-amber-500/20 bg-amber-500/[0.06] text-[11px]" data-testid="hub-banner">
                        <Layers size={13} className="text-amber-400 shrink-0" />
                        <span className="text-amber-200 truncate">Working with <b>{(user as any).delegation.label}</b> access · {(user as any).delegation.sourceName}</span>
                        <button onClick={() => { exitHub?.(); router.push("/"); }} className="ml-auto shrink-0 px-2.5 py-1 rounded-md border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 font-bold">Exit hub</button>
                    </div>
                )}
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
                    <div className="flex flex-col min-h-full desktop-zoom">
                        {children}
                    </div>
                </main>
            </div>
            
            {/* Global Mandatoy Onboarding for New Joinees */}
            <OnboardingModal />
        </div>
    );
}