"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ShieldHalf, Lock, Users, Search, Loader2, RotateCcw, Save, X, CheckCircle2, AlertTriangle, ChevronLeft, Plus, Pencil, Rocket, Undo2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { stateOf, ORG_PARENTS, type AccessState, type RoleRestriction } from "@/lib/role-modules";
import { RoleAccessList, STATE_TEXT, type RoleItem } from "@/components/admin/RoleAccessList";

/**
 * Admin → Role Management (HR — not HR Executive — and Founder).
 * Lists every existing role with its employees and its sidebar (read from the code), plus the roles HR created
 * (Create New Role). For a role, each sidebar item can be Visible (as now), Hidden (not in the sidebar) or Blocked
 * (not in the sidebar, page and its own APIs refused). Nothing is restricted until HR saves a change;
 * HR and Founder cannot be edited.
 */
type RoleRow = {
    role: string; label: string; employees: number; locked: boolean; items: RoleItem[]; restriction: RoleRestriction; updatedAt: string | null; updatedByName: string | null;
    /** HR-created role (Create New Role) */
    custom?: boolean; baseRole?: string; baseLabel?: string; status?: "DRAFT" | "PUBLISHED"; description?: string; org?: { mode: string; parent?: string };
};

const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");
const orgText = (o?: { mode: string; parent?: string }) => (o?.mode === "OWN" ? `Own box under ${ORG_PARENTS.find(p => p.key === o.parent)?.label.split(" (")[0] || o.parent}` : "Same place as the base role");

export default function RoleManagementPage() {
    const { user } = useAuth();
    const allowed = !!user && ((user.role === "HR" && !(user as any).hrExecutive) || user.role === "FOUNDER");
    const [roles, setRoles] = useState<RoleRow[] | null>(null);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [sel, setSel] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/admin/roles", { cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not load roles");
            setRoles(d.roles || []); setError("");
        } catch (e: any) { setError(e.message); }
    }, []);
    useEffect(() => { if (allowed) load(); }, [allowed, load]);
    // open a role from a link (?role=ID), e.g. after creating it
    useEffect(() => { try { const r = new URLSearchParams(window.location.search).get("role"); if (r) setSel(r); } catch { /* ignore */ } }, []);

    if (!user) return null;
    if (!allowed) return <div className="p-8 text-center text-sm text-zinc-500" data-testid="rm-denied">Only HR and the Founder can open Role Management.</div>;

    const current = roles?.find(r => r.role === sel) || null;
    const match = (r: RoleRow) => !q.trim() || `${r.label} ${r.role}`.toLowerCase().includes(q.trim().toLowerCase());
    const builtIn = (roles || []).filter(r => !r.custom && match(r));
    const created = (roles || []).filter(r => r.custom && match(r));

    const card = (r: RoleRow) => {
        const n = r.restriction.hidden.length + r.restriction.blocked.length;
        return (
            <button key={r.role} type="button" onClick={() => setSel(r.role)} data-testid="rm-role" data-role={r.role}
                className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600 transition min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{r.label}</p>
                        <p className="text-[10px] font-mono text-zinc-500 truncate">{r.role}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                        {r.custom && <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", r.status === "PUBLISHED" ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-zinc-600 bg-zinc-800 text-zinc-300")} data-testid="rm-role-status">{r.status === "PUBLISHED" ? "Published" : "Draft"}</span>}
                        {r.locked
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-zinc-700 text-[10px] font-bold text-zinc-400"><Lock size={10} /> Locked</span>
                            : n > 0
                                ? <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-300" data-testid="rm-role-restricted">{n} restricted</span>
                                : <span className="px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-[10px] font-bold text-emerald-300">Default</span>}
                    </div>
                </div>
                {r.custom && <p className="mt-2 text-[11px] text-zinc-400 truncate" data-testid="rm-role-base">Based on {r.baseLabel}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                    <span className="inline-flex items-center gap-1"><Users size={12} /> <span data-testid="rm-role-emps">{r.employees}</span> employees</span>
                    <span>{r.items.length} sidebar items</span>
                </div>
                {r.updatedAt && <p className="mt-2 text-[10px] text-zinc-600 truncate">Changed {dt(r.updatedAt)}{r.updatedByName ? ` · ${r.updatedByName}` : ""}</p>}
            </button>
        );
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto w-full [contain:inline-size]" data-testid="role-management">
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3"><ShieldHalf size={26} className="text-primary shrink-0" /> Role Management</h1>
                    <p className="text-zinc-500 mt-1 text-sm">Choose what each role sees in its sidebar and which modules it can open, or create a new role on top of an existing one. Every role works as before until you save a change here. HR and Founder cannot be changed.</p>
                </div>
                <Link href="/admin/roles/new" data-testid="rm-create" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold"><Plus size={14} /> Create New Role</Link>
            </div>
            {error && <p className="text-sm text-red-300 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2" data-testid="rm-error">{error}</p>}
            {!roles && !error && <p className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading roles…</p>}

            {roles && !current && (<>
                <div className="relative max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search role" data-testid="rm-search"
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                {created.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Roles created here</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="rm-custom-roles">{created.map(card)}</div>
                    </div>
                )}
                <div className="space-y-2">
                    {created.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Existing roles</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="rm-roles">{builtIn.map(card)}</div>
                </div>
            </>)}

            {current && <RoleEditor key={current.role} row={current} onBack={() => setSel(null)} onSaved={async () => { await load(); }} onGone={async () => { setSel(null); await load(); }} />}
        </div>
    );
}

type Confirm = null | "save" | "reset" | "publish" | "unpublish" | "delete";

function RoleEditor({ row, onBack, onSaved, onGone }: { row: RoleRow; onBack: () => void; onSaved: () => Promise<void>; onGone: () => Promise<void> }) {
    const initial = () => Object.fromEntries(row.items.map(i => [i.path, stateOf(row.restriction, i.path)])) as Record<string, AccessState>;
    const [draft, setDraft] = useState<Record<string, AccessState>>(initial);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const changes = useMemo(() => row.items
        .map(i => ({ ...i, from: stateOf(row.restriction, i.path), to: draft[i.path] }))
        .filter(c => c.from !== c.to), [row, draft]);
    const restricted = row.restriction.hidden.length + row.restriction.blocked.length;

    const save = async (reset: boolean) => {
        setBusy(true); setMsg(null);
        const body = reset ? { role: row.role, hidden: [], blocked: [], note } : {
            role: row.role, note,
            hidden: Object.entries(draft).filter(([, v]) => v === "hidden").map(([k]) => k),
            blocked: Object.entries(draft).filter(([, v]) => v === "blocked").map(([k]) => k),
        };
        try {
            const r = await fetch("/api/admin/roles", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not save");
            setMsg({ ok: true, text: `Saved — ${d.changes?.length || 0} change(s) for ${row.label}. Employees see it on their next page load (up to a minute).` });
            setConfirm(null); setNote("");
            await onSaved();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); setConfirm(null); }
        finally { setBusy(false); }
    };
    const act = async (action: "publish" | "unpublish" | "delete") => {
        setBusy(true); setMsg(null);
        try {
            const r = await fetch("/api/admin/role-definitions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: row.role, action }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not save");
            setConfirm(null);
            if (action === "delete") { await onGone(); return; }
            await onSaved();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); setConfirm(null); }
        finally { setBusy(false); }
    };

    const title: Record<Exclude<Confirm, null>, string> = {
        save: `Save changes for ${row.label}?`, reset: `Reset ${row.label} to default?`, publish: `Publish ${row.label}?`,
        unpublish: `Move ${row.label} back to draft?`, delete: `Delete the role ${row.label}?`,
    };

    return (
        <div className="space-y-4" data-testid="rm-editor" data-role={row.role}>
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white" data-testid="rm-back"><ChevronLeft size={14} /> All roles</button>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-0">
                    <p className="text-lg font-bold text-white">{row.label}</p>
                    <p className="text-[11px] font-mono text-zinc-500">{row.role}</p>
                </div>
                <span className="text-xs text-zinc-400 inline-flex items-center gap-1"><Users size={13} /> {row.employees} employees</span>
                <span className="text-xs text-zinc-400">{row.items.length} sidebar items</span>
                {row.locked && <span className="text-xs text-zinc-400 inline-flex items-center gap-1" data-testid="rm-locked"><Lock size={12} /> Locked — HR and Founder access cannot be changed here</span>}
                {row.custom && (
                    <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400 border-t border-zinc-800 pt-2" data-testid="rm-custom-info">
                        <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", row.status === "PUBLISHED" ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-zinc-600 bg-zinc-800 text-zinc-300")}>{row.status === "PUBLISHED" ? "Published" : "Draft"}</span>
                        <span>Based on <b className="text-zinc-200">{row.baseLabel}</b></span>
                        <span>Org Chart: {orgText(row.org)}</span>
                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                            <Link href={`/admin/roles/new?id=${encodeURIComponent(row.role)}`} data-testid="rm-edit-details" className="px-3 py-1.5 rounded-lg border border-zinc-700 text-[11px] font-bold text-zinc-200 hover:bg-zinc-800 inline-flex items-center gap-1"><Pencil size={12} /> Edit details</Link>
                            {row.status !== "PUBLISHED" && <button type="button" onClick={() => setConfirm("publish")} data-testid="rm-publish" className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-[11px] font-bold text-sky-200 inline-flex items-center gap-1"><Rocket size={12} /> Publish</button>}
                            {row.status === "PUBLISHED" && <button type="button" onClick={() => setConfirm("unpublish")} data-testid="rm-unpublish" className="px-3 py-1.5 rounded-lg border border-zinc-700 text-[11px] font-bold text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-1"><Undo2 size={12} /> Unpublish</button>}
                            <button type="button" onClick={() => setConfirm("delete")} data-testid="rm-delete" className="px-3 py-1.5 rounded-lg border border-red-500/30 text-[11px] font-bold text-red-300 hover:bg-red-500/10 inline-flex items-center gap-1"><Trash2 size={12} /> Delete role</button>
                        </div>
                        {row.description && <p className="w-full text-[11px] text-zinc-500 [overflow-wrap:anywhere]">{row.description}</p>}
                    </div>
                )}
            </div>

            {!row.locked && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-[11px] text-zinc-400 space-y-0.5">
                    <p><b className="text-emerald-300">Visible</b> — as now. <b className="text-amber-300">Hidden</b> — removed from the sidebar; the page still opens from a link. <b className="text-red-300">Blocked</b> — removed from the sidebar and the page does not open for this role.</p>
                    <p>“Page + API” items also refuse their own data requests. “Page only” items share their data with other pages, so only the page is blocked. Old records are never deleted.</p>
                </div>
            )}
            {msg && <p className={cn("text-sm rounded-xl border px-3 py-2 flex items-start gap-2", msg.ok ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" : "text-red-300 border-red-500/25 bg-red-500/10")} data-testid="rm-msg">{msg.ok ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}{msg.text}</p>}

            <RoleAccessList items={row.items} draft={draft} readOnly={row.locked} onChange={(path, s) => { setMsg(null); setDraft(d => ({ ...d, [path]: s })); }} />

            {!row.locked && (
                <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-4 py-3 bg-[#0a0a0b]/95 backdrop-blur border-t sm:border sm:rounded-2xl border-zinc-800 flex flex-wrap items-center gap-2" data-testid="rm-actions">
                    <span className="text-xs text-zinc-400 mr-auto" data-testid="rm-pending">{changes.length ? `${changes.length} unsaved change(s)` : "No unsaved changes"}</span>
                    {restricted > 0 && <button type="button" onClick={() => setConfirm("reset")} disabled={busy} data-testid="rm-reset"
                        className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reset to default</button>}
                    {changes.length > 0 && <button type="button" onClick={() => setDraft(initial())} disabled={busy}
                        className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300 hover:bg-zinc-800" data-testid="rm-discard">Discard</button>}
                    <button type="button" onClick={() => setConfirm("save")} disabled={!changes.length || busy} data-testid="rm-save"
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40"><Save size={13} /> Review & Save</button>
                </div>
            )}

            {confirm && (
                <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !busy && setConfirm(null)}>
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4" onClick={e => e.stopPropagation()} data-testid="rm-confirm" role="dialog" aria-modal="true">
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-base font-bold text-white">{title[confirm]}</h2>
                            <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="text-zinc-500 hover:text-white" aria-label="Close"><X size={16} /></button>
                        </div>
                        {(confirm === "save" || confirm === "reset") && <p className="text-xs text-zinc-400">This affects <b className="text-white">{row.employees}</b> employee(s) with the {row.label} role. {confirm === "reset" ? "Every sidebar item becomes visible and every blocked page opens again." : ""}</p>}
                        {confirm === "publish" && <p className="text-xs text-zinc-400" data-testid="rm-confirm-text">{row.label} becomes available in Onboarding and in the login list. Employees given this role work as <b className="text-white">{row.baseLabel}</b>, with the restrictions shown here. The base role cannot be changed after publishing.</p>}
                        {confirm === "unpublish" && <p className="text-xs text-zinc-400" data-testid="rm-confirm-text">{row.label} is removed from Onboarding and the login list and becomes a draft again. Only possible while no employee has this role.</p>}
                        {confirm === "delete" && <p className="text-xs text-zinc-400" data-testid="rm-confirm-text">{row.employees > 0
                            ? <><b className="text-red-300">{row.employees} employee(s)</b> have this role, so it cannot be deleted. Change their role first.</>
                            : <>{row.label} and its settings are deleted{row.status === "PUBLISHED" ? ", and it disappears from Onboarding and the login list" : ""}. No employee has this role. The deletion is written to the activity log and cannot be undone.</>}</p>}
                        {confirm === "save" && (
                            <ul className="text-xs space-y-1.5" data-testid="rm-confirm-list">
                                {changes.map(c => (
                                    <li key={c.path} className="flex flex-wrap gap-x-2"><span className="text-white font-medium">{c.label}</span><span className="text-zinc-500">{STATE_TEXT[c.from]} → </span><span className={c.to === "blocked" ? "text-red-300" : c.to === "hidden" ? "text-amber-300" : "text-emerald-300"}>{STATE_TEXT[c.to]}</span></li>
                                ))}
                            </ul>
                        )}
                        {(confirm === "save" || confirm === "reset") && (
                            <label className="block text-xs text-zinc-400">Note for the activity log (optional)
                                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} data-testid="rm-note"
                                    className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-sm text-white outline-none focus:border-zinc-600" />
                            </label>
                        )}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300">Cancel</button>
                            <button type="button" disabled={busy || (confirm === "delete" && row.employees > 0)} data-testid="rm-confirm-ok"
                                onClick={() => (confirm === "save" || confirm === "reset" ? save(confirm === "reset") : act(confirm))}
                                className={cn("px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed", confirm === "delete" ? "bg-red-500 text-white" : "bg-primary text-primary-foreground")}>
                                {busy && <Loader2 size={13} className="animate-spin" />}{{ save: "Save", reset: "Reset", publish: "Publish", unpublish: "Unpublish", delete: "Delete" }[confirm]}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}