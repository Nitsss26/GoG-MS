"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { History, Loader2 } from "lucide-react";
import { ROLE_COLORS } from "@/lib/sidebar-menu";

/** Admin → Role Activity Logs (HR — not HR Executive — and Founder): every Role Management change, newest first */
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");
const TEXT: Record<string, string> = { visible: "Visible", hidden: "Hidden", blocked: "Blocked" };
const TONE: Record<string, string> = { visible: "text-emerald-300", hidden: "text-amber-300", blocked: "text-red-300" };
const ACTION: Record<string, { t: string; c: string }> = {
    ACCESS_UPDATED: { t: "Access updated", c: "text-amber-300" }, ACCESS_RESET: { t: "Reset to default", c: "text-sky-300" },
    ROLE_CREATED: { t: "Role created (draft)", c: "text-emerald-300" }, ROLE_UPDATED: { t: "Role edited", c: "text-amber-300" },
    ROLE_PUBLISHED: { t: "Published", c: "text-sky-300" }, ROLE_UNPUBLISHED: { t: "Moved back to draft", c: "text-zinc-300" }, ROLE_DELETED: { t: "Draft deleted", c: "text-red-300" },
};

export default function RoleLogsPage() {
    const { user } = useAuth();
    const allowed = !!user && ((user.role === "HR" && !(user as any).hrExecutive) || user.role === "FOUNDER");
    const [role, setRole] = useState("");
    const [logs, setLogs] = useState<any[] | null>(null);
    const [error, setError] = useState("");
    // names of the roles created in Role Management (for the filter and the entries)
    const [custom, setCustom] = useState<{ role: string; label: string }[]>([]);
    useEffect(() => {
        if (!allowed) return;
        fetch("/api/admin/roles", { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
            .then(d => setCustom((d?.roles || []).filter((x: any) => x.custom).map((x: any) => ({ role: x.role, label: x.label })))).catch(() => { });
    }, [allowed]);
    const labelOf = (role: string) => (ROLE_COLORS as any)[role]?.label || custom.find(c => c.role === role)?.label || role;

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/admin/role-logs${role ? `?role=${encodeURIComponent(role)}` : ""}`, { cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not load logs");
            setLogs(d.logs || []); setError("");
        } catch (e: any) { setError(e.message); }
    }, [role]);
    useEffect(() => { if (allowed) load(); }, [allowed, load]);

    if (!user) return null;
    if (!allowed) return <div className="p-8 text-center text-sm text-zinc-500" data-testid="rl-denied">Only HR and the Founder can open Role Activity Logs.</div>;

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto w-full [contain:inline-size]" data-testid="role-logs">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3"><History size={26} className="text-primary shrink-0" /> Role Activity Logs</h1>
                <p className="text-zinc-500 mt-1 text-sm">Every change made in Role Management: who changed it, when, and what each item was before and after.</p>
            </div>
            <select value={role} onChange={e => setRole(e.target.value)} data-testid="rl-role"
                className="w-full sm:w-64 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white outline-none">
                <option value="" className="bg-zinc-900 text-white">All roles</option>
                {Object.keys(ROLE_COLORS).map(r => <option key={r} value={r} className="bg-zinc-900 text-white">{labelOf(r)}</option>)}
                {custom.map(c => <option key={c.role} value={c.role} className="bg-zinc-900 text-white">{c.label} (created)</option>)}
            </select>
            {error && <p className="text-sm text-red-300 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2">{error}</p>}
            {!logs && !error && <p className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}
            {logs && !logs.length && <p className="text-sm text-zinc-500" data-testid="rl-empty">No changes yet.</p>}
            <div className="space-y-3" data-testid="rl-list">
                {(logs || []).map(l => (
                    <div key={l.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2" data-testid="rl-item">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="text-sm font-bold text-white">{labelOf(l.role)} <span className="text-[10px] font-mono text-zinc-500">{l.role}</span></p>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${(ACTION[l.action] || ACTION.ACCESS_UPDATED).c}`} data-testid="rl-action">{(ACTION[l.action] || { t: l.action }).t}</span>
                            <span className="text-[11px] text-zinc-500 sm:ml-auto">{dt(l.at)} · {l.actorName}{l.actorRole ? ` (${labelOf(l.actorRole)})` : ""}</span>
                        </div>
                        <ul className="text-xs space-y-1">
                            {(l.changes || []).map((c: any) => (
                                <li key={c.path} className="flex flex-wrap gap-x-2"><span className="text-zinc-200">{c.label}</span><span className="text-zinc-600 font-mono text-[10px]">{c.path}</span>
                                    <span><span className={TONE[c.from]}>{TEXT[c.from] || c.from}</span><span className="text-zinc-500"> → </span><span className={TONE[c.to]}>{TEXT[c.to] || c.to}</span></span></li>
                            ))}
                        </ul>
                        {l.summary && <p className="text-xs text-zinc-300 [overflow-wrap:anywhere]" data-testid="rl-summary">{l.summary}</p>}
                        {l.note && <p className="text-[11px] text-zinc-400 [overflow-wrap:anywhere]">Note: {l.note}</p>}
                    </div>
                ))}
            </div>
        </div>
    );
}