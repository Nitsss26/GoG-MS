"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "./Sidebar";

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const router = useRouter();

    const isAuthPage = pathname === "/login";
    const isOnboardingPage = pathname === "/onboarding";

    useEffect(() => {
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
        <>
            {showSidebar && <Sidebar />}
            <div className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col min-h-full" style={showSidebar ? { zoom: 1.1 } : undefined}>
                    {children}
                </div>
            </div>
        </>
    );
}
