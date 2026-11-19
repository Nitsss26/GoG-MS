"use client";
/**
 * Role Management: the sidebar items HR hid / blocked for the logged-in designation's role.
 * Nothing restricted (the default, and whenever the request fails) → the sidebar stays exactly as before.
 */
import { useEffect, useState } from "react";
import { configRoleOf, type RoleRestriction } from "@/lib/role-modules";

const EMPTY: RoleRestriction = { hidden: [], blocked: [] };
const KEY = "gog_role_restriction";

export function useRoleRestriction(user: any): RoleRestriction {
    const role = configRoleOf(user);
    const [r, setR] = useState<RoleRestriction>(EMPTY);
    useEffect(() => {
        if (!user?.id || !role) { setR(EMPTY); return; }
        // last known value of this role first (no flash of hidden items on reload)
        try { const c = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (c?.role === role) setR({ hidden: c.hidden || [], blocked: c.blocked || [] }); } catch { /* ignore */ }
        let alive = true;
        const load = () => fetch("/api/admin/roles/mine", { cache: "no-store" })
            .then(res => (res.ok ? res.json() : null))
            .then(d => {
                if (!alive || !d) return;
                const next = { hidden: Array.isArray(d.hidden) ? d.hidden : [], blocked: Array.isArray(d.blocked) ? d.blocked : [] };
                setR(next);
                try { sessionStorage.setItem(KEY, JSON.stringify({ role, ...next })); } catch { /* ignore */ }
            })
            .catch(() => { });
        load();
        const t = setInterval(load, 120000);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
    }, [user?.id, role]);
    return r;
}