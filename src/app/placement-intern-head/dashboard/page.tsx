"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Home from "@/app/page";

/**
 * Placement & Intern Head Portal → Dashboard (/placement-intern-head/dashboard).
 * The role works with the existing Tech Team features, so its dashboard is the existing employee dashboard
 * (same widgets, data and permissions); other roles are sent to their own dashboard.
 */
export default function PlacementInternHeadDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const mine = user?.role === "PLACEMENT_INTERN_HEAD";
    useEffect(() => { if (user && !mine) router.replace("/"); }, [user, mine, router]);
    if (!user || !mine) return null;
    return <Home />;
}