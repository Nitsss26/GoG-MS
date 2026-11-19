"use client";
/**
 * OM Given Access: does the logged-in Professor / HOI have Full Attire access from an OM right now?
 * Asked again on every page change, every minute and when the window gets focus, so a new grant shows up and a
 * revoked / expired one disappears without logging in again. Anything going wrong → no extra section (as before).
 * The server checks the grant again on every Full Attire request; this only decides the sidebar.
 */
import { useEffect, useState } from "react";

const RECIPIENT_ROLES = ["PROFESSOR", "FACULTY", "HOI"];
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

export function useTempAccess(user: any, pathname: string): boolean {
    const eligible = !!user?.id && RECIPIENT_ROLES.includes(user?.role);
    const [grants, setGrants] = useState<{ startDate: string; endDate: string }[]>([]);
    const [, tick] = useState(0);
    useEffect(() => {
        if (!eligible) { setGrants([]); return; }
        let alive = true;
        const load = () => fetch("/api/temp-access/mine", { cache: "no-store" })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (alive) setGrants(d?.fullAttire && Array.isArray(d.grants) ? d.grants : []); })
            .catch(() => { });
        load();
        const t = setInterval(() => { load(); tick(n => n + 1); }, 60000);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
    }, [eligible, user?.id, pathname]);
    const today = istToday();
    return eligible && grants.some(g => g.startDate <= today && today <= g.endDate);
}