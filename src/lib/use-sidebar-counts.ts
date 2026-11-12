"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sidebar notification badge counts (GET /api/sidebar-counts — worked out on the server for the logged-in user).
 * Refreshed: on login / user change, on page change, when the window gets focus again, every minute while the tab
 * is visible, and shortly after any successful change sent to the server (approve, reject, submit, mark read …),
 * so a decision lowers its badge without reloading the site. One request at a time; counts of another user are never kept.
 */
const REFRESH_MS = 60000;
const AFTER_CHANGE_MS = 700;
const ENDPOINT = "/api/sidebar-counts";

type Listener = () => void;

/** Calls every listener after a successful non-GET request to this site's /api/ (installed once, only observes) */
function observeApiChanges(listener: Listener) {
    const w = window as any;
    if (!w.__gogApiChangeListeners) {
        w.__gogApiChangeListeners = new Set<Listener>();
        const original = window.fetch.bind(window);
        window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
            const p = original(input, init);
            try {
                const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
                const method = String(init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();
                const api = url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/");
                if (api && method !== "GET" && method !== "HEAD" && !url.includes(ENDPOINT)) {
                    p.then(res => { if (res.ok) w.__gogApiChangeListeners.forEach((l: Listener) => { try { l(); } catch { /* ignore */ } }); }).catch(() => { });
                }
            } catch { /* never affects the request itself */ }
            return p;
        };
    }
    w.__gogApiChangeListeners.add(listener);
    return () => { w.__gogApiChangeListeners.delete(listener); };
}

export function useSidebarCounts(userId: string | undefined, pathname: string) {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const owner = useRef<string | undefined>(userId);
    const inFlight = useRef(false);
    const again = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAt = useRef(0);

    const load = useCallback(async () => {
        if (!owner.current) return;
        if (inFlight.current) { again.current = true; return; }
        inFlight.current = true;
        lastAt.current = Date.now();
        const forUser = owner.current;
        try {
            const r = await fetch(ENDPOINT, { cache: "no-store" });
            const d = r.ok ? await r.json() : null;
            // only the logged-in user's own counts (a reply for an earlier login is dropped)
            if (d && d.counts && d.userId === owner.current && forUser === owner.current) setCounts(d.counts);
        } catch { /* keep the last counts; the next refresh tries again */ }
        finally {
            inFlight.current = false;
            if (again.current) { again.current = false; load(); }
        }
    }, []);

    // new login / another user: start from zero, then load
    useEffect(() => {
        owner.current = userId;
        setCounts({});
        if (userId) load();
    }, [userId, load]);

    // page change
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (userId) load();
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!userId) return;
        const soon = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { timer.current = null; load(); }, AFTER_CHANGE_MS); };
        // focus + visibility fire together when the user comes back: one request
        const fresh = () => { if (Date.now() - lastAt.current > 3000) load(); };
        const onVisible = () => { if (document.visibilityState === "visible") fresh(); };
        const tick = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
        const stop = observeApiChanges(soon);
        window.addEventListener("focus", fresh);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(tick); stop();
            if (timer.current) { clearTimeout(timer.current); timer.current = null; }
            window.removeEventListener("focus", fresh);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [userId, load]);

    return counts;
}

/** Badge text: 1 … 99, then "99+" */
export const badgeText = (n: number) => (n > 99 ? "99+" : String(n));
