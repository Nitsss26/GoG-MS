"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Layers } from "lucide-react";
import Sidebar from "./Sidebar";
import OnboardingModal from "./OnboardingModal";

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, authLoading, exitHub } = useAuth();
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const isAuthPage = pathname === "/login";
    const isStandalonePage = pathname.startsWith("/manager/lecture-report/");

    useEffect(() => {
        if (authLoading) return; // Wait for auth to initialize
        
        setIsMobileOpen(false); // Close sidebar on route change
        if (!user && !isAuthPage) {
            router.push("/login");
            return;
        }
        if (user && isAuthPage) {
            router.push("/");
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
                        <button 
                            onClick={() => setIsMobileOpen(!isMobileOpen)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </header>
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
