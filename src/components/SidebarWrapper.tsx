"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const isAuthPage = pathname === "/login";
    const isOnboardingPage = pathname === "/onboarding";

    useEffect(() => {
        setIsMobileOpen(false); // Close sidebar on route change
        if (!user && !isAuthPage) {
            router.push("/login");
            return;
        }
        if (user && user.role === "FACULTY" && !user.isOnboarded && !isOnboardingPage && !isAuthPage) {
            router.push("/onboarding");
            return;
        }
        if (user && isAuthPage) {
            router.push("/");
            return;
        }
    }, [user, pathname, router, isAuthPage, isOnboardingPage]);

    const showSidebar = user && !isAuthPage && !isOnboardingPage;

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {showSidebar && (
                <Sidebar 
                    isOpen={isMobileOpen} 
                    onClose={() => setIsMobileOpen(false)} 
                />
            )}
            
            <div className="flex-1 flex flex-col min-w-0 h-screen">
                {/* Mobile Top Header */}
                {showSidebar && (
                    <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-40">
                        <div className="flex items-center gap-2">
                            <img
                                src="https://i.ibb.co/qYQkmMDR/unnamed-1.png"
                                alt="GOG Logo"
                                className="w-6 h-6 rounded-md object-contain"
                            />
                            <span className="text-sm font-bold text-white">GOG OMS</span>
                        </div>
                        <button 
                            onClick={() => setIsMobileOpen(!isMobileOpen)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </header>
                )}

                <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
                    <div 
                        className="flex flex-col min-h-full" 
                        style={showSidebar ? { zoom: "var(--app-zoom, 1)" } : undefined}
                    >
                        {children}
                    </div>
                </main>
            </div>

            {/* CSS Variable for zoom - we only want it on desktop if possible, or subtly */}
            <style jsx global>{`
                :root {
                    --app-zoom: 1.1;
                }
                @media (max-width: 1024px) {
                    :root {
                        --app-zoom: 1;
                    }
                }
            `}</style>
        </div>
    );
}
