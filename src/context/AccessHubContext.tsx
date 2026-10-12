"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthContext, useAuth } from "@/context/AuthContext";
import type { DelegatedHub } from "@/context/AuthContext";
import { ACCESS_HEADER, hubHasPath } from "@/lib/access-hubs";

/**
 * Give Access on the client.
 *  - loads the logged-in employee's delegated hubs from /api/access/my-hubs (database), refreshes them every
 *    minute and when the tab gets focus (grant / revoke show up without logging in again);
 *  - remembers which hub (and which source, e.g. one HOI or "all") the employee is working in;
 *  - on a page of that hub, `useAuth().user` carries the hub's role, and every /api/ request carries the
 *    x-gog-access header — the server checks it against the active grants on every call.
 * The login designation never changes: `realUser` is always the logged-in record.
 */
const KEY = "gog_active_hub";
type Active = { category: string; source: string } | null;

export function AccessHubProvider({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const realUser = auth.user;
    const pathname = usePathname() || "/";
    const [hubs, setHubs] = useState<DelegatedHub[]>([]);
    const [canManageAccess, setCanManageAccess] = useState(false);
    const [active, setActive] = useState<Active>(null);
    const [loaded, setLoaded] = useState(false);
    const headerRef = useRef<string | null>(null);

    // restore the active hub of this tab
    useEffect(() => {
        try { const v = sessionStorage.getItem(KEY); if (v) setActive(JSON.parse(v)); } catch { /* storage blocked */ }
    }, []);
    const persist = (v: Active) => {
        setActive(v);
        try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
    };

    const refreshHubs = useCallback(async () => {
        if (!realUser) { setHubs([]); setCanManageAccess(false); return; }
        try {
            const res = await fetch("/api/access/my-hubs", { cache: "no-store" });
            if (!res.ok) return;
            const d = await res.json();
            setHubs(d.hubs || []);
            setCanManageAccess(!!d.canManageAccess);
            setLoaded(true);
        } catch { /* keep the last known hubs */ }
    }, [realUser?.id, realUser?.role]);

    useEffect(() => {
        if (!realUser) { setHubs([]); setCanManageAccess(false); setLoaded(false); if (!auth.authLoading) persist(null); return; }
        refreshHubs();
        const t = setInterval(refreshHubs, 60000);
        const onFocus = () => refreshHubs();
        window.addEventListener("focus", onFocus);
        return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
    }, [realUser?.id, realUser?.role, refreshHubs]);

    // a revoked hub (or source) stops applying immediately
    const hub = active ? hubs.find(h => h.category === active.category) : undefined;
    const validActive = hub && active && (active.source === "*" || hub.sources.some(s => s.id === active.source)) ? active : null;
    useEffect(() => { if (loaded && active && !validActive) persist(null); }, [loaded, hubs]);

    const inHub = !!(validActive && hub && hubHasPath(validActive.category, pathname));
    headerRef.current = inHub && validActive ? `${validActive.category}:${validActive.source}` : null;

    // every same-origin /api/ call from a hub page carries the delegation header
    useEffect(() => {
        const w = window as any;
        if (w.__gogFetchPatched) return;
        w.__gogFetchPatched = true;
        const original = window.fetch.bind(window);
        w.__gogAccessHeader = () => headerRef.current;
        window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
            const h = w.__gogAccessHeader?.();
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const sameOriginApi = url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/");
            if (h && sameOriginApi && !url.includes("/api/access/")) {
                const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined));
                headers.set(ACCESS_HEADER, h);
                return original(input, { ...init, headers });
            }
            return original(input, init);
        };
    }, []);
    useEffect(() => { (window as any).__gogAccessHeader = () => headerRef.current; });

    const enterHub = useCallback((category: string, source = "*") => persist({ category, source }), []);
    const exitHub = useCallback(() => persist(null), []);

    const user = useMemo(() => {
        if (!realUser || !inHub || !hub || !validActive) return realUser;
        const src = validActive.source === "*" ? null : hub.sources.find(s => s.id === validActive.source);
        return { ...realUser, role: hub.role as any, delegation: { category: hub.category, label: hub.label, source: validActive.source, sourceName: src?.name || "All assigned" } } as any;
    }, [realUser, inHub, hub, validActive?.category, validActive?.source]);

    const value = useMemo(() => ({
        ...auth, user, realUser, hubs, activeHub: validActive, enterHub, exitHub, refreshHubs, canManageAccess,
    }), [auth, user, realUser, hubs, validActive, enterHub, exitHub, refreshHubs, canManageAccess]);

    return <AuthContext.Provider value={value as any}>{children}</AuthContext.Provider>;
}

export const useAccessHubs = () => {
    const a = useContext(AuthContext)!;
    return { hubs: a.hubs || [], activeHub: a.activeHub || null, enterHub: a.enterHub!, exitHub: a.exitHub!, refreshHubs: a.refreshHubs!, canManageAccess: !!a.canManageAccess, realUser: a.realUser ?? a.user };
};
