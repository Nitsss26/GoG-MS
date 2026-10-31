"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Correction tickets now live inside Employee Salary Management → Correction Tickets (old links keep working) */
export default function CorrectionTicketsRedirect() {
    const router = useRouter();
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get("ticket");
        router.replace(`/hr/salary-management?tab=tickets${t ? `&ticket=${encodeURIComponent(t)}` : ""}`);
    }, [router]);
    return null;
}