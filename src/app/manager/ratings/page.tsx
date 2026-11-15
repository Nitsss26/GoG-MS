"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Ratings" has been removed: Monthly Feedback does the same job (and is the one that is
 * saved and counted on the Leaderboard). Old links / bookmarks open Monthly Feedback.
 */
export default function RatingsRemovedPage() {
    const router = useRouter();
    useEffect(() => { router.replace("/management/monthly"); }, [router]);
    return null;
}