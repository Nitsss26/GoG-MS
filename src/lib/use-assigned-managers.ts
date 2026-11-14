"use client";
import { useEffect, useState } from "react";

/** employeeId → managerId assigned by HR (Assign Manager). GET /api/hr/manager-assignment?view=map (any signed-in user) */
export function useAssignedManagers(enabled = true): Record<string, string> {
    const [map, setMap] = useState<Record<string, string>>({});
    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        fetch("/api/hr/manager-assignment?view=map", { cache: "no-store" })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { const m = d && !Array.isArray(d) ? d.map : null; if (alive && m && typeof m === "object" && !Array.isArray(m)) setMap(m as Record<string, string>); })
            .catch(() => { });
        return () => { alive = false; };
    }, [enabled]);
    return map;
}