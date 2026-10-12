"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    KeySquare, Users, UserCheck, ShieldCheck, ShieldOff, Search, X, Check, Eye, Pencil, Trash2, Loader2, AlertTriangle,
    CheckCircle2, Layers, ChevronRight, History,
} from "lucide-react";
import GiveAccessModal from "@/components/access/GiveAccessModal";

/**
 * Give Access — Access Management. Founder and Tech Lead have the same rights: give any hub to anyone, edit or revoke any grant.
 * Everything comes from /api/access/* (database). Grants are enforced on the server for every request.
 */
type Emp = { id: string; name: string; email?: string; photoUrl?: string; role: string; category: string; designation: string; dept: string; campus: string; extraAccess: string[] };
type Cat = { category: string; count: number; hubLabel: string | null; items: { label: string; path: string }[]; note: string; delegable: boolean; allowed: boolean };
type Mode = "SELECTED" | "ALL" | "ALL_DYNAMIC";
const CAT_LABEL: Record<string, string> = {
    FOUNDER: "Founder", HR: "HR", AD: "AD", HOI: "HOI", PROFESSOR: "Professor / Faculty", OM: "OM", CURRICULUM_LEAD: "CL", CURRICULUM_HEAD: "CH",
    TL: "Tech Lead", TECH_TEAM: "Tech Team", MARKETING_TEAM: "Marketing Team",
};
const label = (c: string) => CAT_LABEL[c] || c.replace(/_/g, " ");
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export default function AccessManagementPage() {
    const { user, realUser, refreshHubs, canManageAccess } = useAuth();
    const me = realUser ?? user;
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [category, setCategory] = useState("All");
    const [picked, setPicked] = useState<string[]>([]);
    const [mode, setMode] = useState<Mode>("SELECTED");
    const [drawer, setDrawer] = useState(false);
    const [recipients, setRecipients] = useState<string[]>([]);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<any>(null);
    const [edit, setEdit] = useState<any>(null);
    const [revoke, setRevoke] = useState<any>(null);
    const [rq, setRq] = useState({ q: "", role: "All", dept: "All", campus: "All" });
    const [eq, setEq] = useState("");
    const [giveTo, setGiveTo] = useState<Emp | null>(null);

    const load = async () => {
        setError("");
        const r = await fetch("/api/access/overview", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d.error || "Could not load access data."); return; }
        setData(d);
    };
    useEffect(() => { if (me) load(); }, [me?.id]);
    const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 4000); };

    const cats: Cat[] = data?.categories || [];
    const employees: Emp[] = data?.employees || [];
    const cat = cats.find(c => c.category === category);
    const inCategory = useMemo(() => category === "All" ? employees : employees.filter(e => e.category === category), [employees, category]);
    const listed = inCategory.filter(e => !eq || `${e.name} ${e.id} ${e.designation} ${e.campus}`.toLowerCase().includes(eq.toLowerCase()));
    const canGrantHere = !!cat && cat.delegable && cat.allowed;
    const sources = mode === "SELECTED" ? picked : inCategory.map(e => e.id);
    const eligible = employees.filter(e => !(mode === "SELECTED" && picked.length === 1 && picked[0] === e.id) && e.id !== me?.id && true);
    const recFiltered = eligible.filter(e =>
        (!rq.q || `${e.name} ${e.id}`.toLowerCase().includes(rq.q.toLowerCase())) &&
        (rq.role === "All" || e.role === rq.role) && (rq.dept === "All" || e.dept === rq.dept) && (rq.campus === "All" || e.campus === rq.campus));
    const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean))).sort();

    const resetSelection = () => { setPicked([]); setMode("SELECTED"); setRecipients([]); setConfirm(false); setDrawer(false); };
    const post = async (body: any) => {
        setBusy(true);
        const r = await fetch("/api/access/grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) { setError(d.error || "Action failed."); return false; }
        await load(); flash(d.message || "Saved."); refreshHubs?.(); return true;
    };

    if (!me) return null;
    if (me.role !== "FOUNDER" && !canManageAccess && data === null && !error) {
        return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-zinc-600" /></div>;
    }
    if (error && !data) return <div className="p-8 text-center text-zinc-500">{error}</div>;
    if (!data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-zinc-600" /></div>;

    const card = "rounded-2xl border border-zinc-800 bg-zinc-900/60";
    const S = data.summary;

    return (
        <div className="max-w-[1400px] mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-5 w-full [contain:inline-size]">
            <div className={`${card} p-5 sm:p-6 flex items-center gap-4`}>
                <span className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center"><KeySquare size={22} className="text-emerald-400" /></span>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Access Management</h1>
                    <p className="text-sm text-zinc-400">Click an employee (or Give Access in their row) to give them access to any team. Founder and Tech Lead can give and revoke any access.</p>
                </div>
                <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{data.me.isFounder ? "Founder" : "Tech Lead"} · Full access rights</span>
            </div>

            {toast && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold" data-testid="access-toast"><CheckCircle2 size={14} /> {toast}</div>}
            {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold" data-testid="access-error"><AlertTriangle size={14} /> {error}<button onClick={() => setError("")} className="ml-auto"><X size={13} /></button></div>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="access-summary">
                {([["Total Employees", S.totalEmployees, Users, "text-sky-400 bg-sky-500/10 border-sky-500/20"], ["Employees With Additional Access", S.employeesWithAccess, UserCheck, "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"],
                    ["Active Access Grants", S.activeGrants, ShieldCheck, "text-amber-400 bg-amber-500/10 border-amber-500/20"], ["Revoked Access Grants", S.revokedGrants, ShieldOff, "text-red-400 bg-red-500/10 border-red-500/20"]] as any[]).map(([l, n, Icon, tone]) => (
                    <div key={l} className={`${card} p-4 flex items-center gap-3`}>
                        <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}><Icon size={18} /></span>
                        <span><span className="block text-xl font-black text-white tabular-nums">{n}</span><span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{l}</span></span>
                    </div>
                ))}
            </div>

            {/* 1. Category + source employees */}
            <div className={`${card} p-5 space-y-4`}>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Access Category</span>
                        <select value={category} onChange={e => { setCategory(e.target.value); setPicked([]); setMode("SELECTED"); }} data-testid="access-category"
                            className="block min-w-[16rem] px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white outline-none">
                            <option value="All">All Employees ({employees.length})</option>
                            {cats.map(c => <option key={c.category} value={c.category}>{label(c.category)} ({c.count}){!c.delegable ? " — no hub" : !c.allowed ? " — not allowed" : ""}</option>)}
                        </select>
                    </label>
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={eq} onChange={e => setEq(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none w-56" />
                    </div>
                    {cat && cat.delegable && (
                        <div className="text-[11px] text-zinc-400 basis-full">
                            <span className="font-bold text-amber-300">{cat.hubLabel}</span> opens: {cat.items.map(i => i.label).join(" · ")}{cat.note ? <span className="text-zinc-500"> — {cat.note}</span> : null}
                        </div>
                    )}
                    {cat && !cat.delegable && <p className="basis-full text-[11px] text-zinc-500">{label(cat.category)} has no hub of its own that can be delegated{cat.category === "FOUNDER" ? " (protected)" : ""}.</p>}
                    {cat && cat.delegable && !cat.allowed && <p className="basis-full text-[11px] text-amber-400">You are not authorised to delegate {label(cat.category)} access.</p>}
                </div>

                {canGrantHere && (
                    <div className="flex flex-wrap gap-2" data-testid="access-mode">
                        {([["SELECTED", "Selected employees"], ["ALL", `All ${label(category)}s (as of today)`], ...(data.me.canDynamic ? [["ALL_DYNAMIC", `All ${label(category)}s + future ones`]] : [])] as [Mode, string][]).map(([m, t]) => (
                            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold ${mode === m ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:text-white"}`}>{t}</button>
                        ))}
                    </div>
                )}

                <div className="overflow-x-auto [contain:inline-size] rounded-xl border border-zinc-800">
                    <table className="w-full min-w-[880px] text-xs">
                        <thead>
                            <tr className="text-[9px] text-zinc-500 uppercase tracking-widest text-left bg-zinc-950/60">
                                <th className="py-2.5 px-3 w-10">{canGrantHere && mode === "SELECTED" && (
                                    <input type="checkbox" aria-label={`Select all ${label(category)}`} data-testid="select-all-sources" checked={listed.length > 0 && listed.every(e => picked.includes(e.id))}
                                        onChange={e => setPicked(e.target.checked ? Array.from(new Set([...picked, ...listed.map(x => x.id)])) : picked.filter(id => !listed.some(x => x.id === id)))} className="w-4 h-4 accent-emerald-500" />
                                )}</th>
                                <th className="py-2.5 px-3">Employee</th><th className="py-2.5 px-3">Employee ID</th><th className="py-2.5 px-3">Designation</th>
                                <th className="py-2.5 px-3">Campus</th><th className="py-2.5 px-3">Department</th><th className="py-2.5 px-3">Access Status</th><th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {listed.map(e => {
                                const on = canGrantHere && (mode !== "SELECTED" || picked.includes(e.id));
                                return (
                                    <tr key={e.id} className={on ? "bg-emerald-500/[0.04]" : ""} data-testid="source-row">
                                        <td className="py-2.5 px-3">{canGrantHere && (
                                            <input type="checkbox" checked={on} disabled={mode !== "SELECTED"} data-testid="source-check"
                                                onChange={ev => setPicked(p => ev.target.checked ? [...p, e.id] : p.filter(x => x !== e.id))} className="w-4 h-4 accent-emerald-500" />
                                        )}</td>
                                        <td className="py-2.5 px-3">
                                            <button onClick={() => e.id !== me?.id && setGiveTo(e)} disabled={e.id === me?.id} className="flex items-center gap-2.5 text-left group disabled:cursor-default" data-testid="emp-open-access" title={e.id === me?.id ? "You cannot give access to yourself" : "Give access"}>
                                                <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black ${avatarTone(e.id)}`}>{initials(e.name)}</span>
                                                <span className="font-bold text-white group-enabled:group-hover:text-emerald-300">{e.name}<span className="ml-1.5 text-[9px] font-bold text-zinc-500">{label(e.category)}</span></span>
                                            </button>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-zinc-400">{e.id}</td>
                                        <td className="py-2.5 px-3 text-zinc-300">{e.designation || "—"}</td>
                                        <td className="py-2.5 px-3 text-zinc-300">{e.campus || "—"}</td>
                                        <td className="py-2.5 px-3 text-zinc-300">{e.dept || "—"}</td>
                                        <td className="py-2.5 px-3">{e.extraAccess.length ? e.extraAccess.map(c => <span key={c} className="inline-block mr-1 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[9px] font-bold">{label(c)} hub</span>) : <span className="text-zinc-600">Own role only</span>}</td>
                                        <td className="py-2.5 px-3 text-right">
                                            {e.id === me?.id ? <span className="text-[10px] text-zinc-600">You</span> : (
                                                <button onClick={() => setGiveTo(e)} data-testid="row-give-access"
                                                    className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold whitespace-nowrap">Give Access</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!listed.length && <tr><td colSpan={8} className="py-8 text-center text-zinc-500">No employees.</td></tr>}
                        </tbody>
                    </table>
                </div>
                {canGrantHere && (
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-zinc-400">{mode === "SELECTED" ? `${picked.length} selected` : mode === "ALL" ? `All ${inCategory.length} ${label(category)}s (snapshot)` : `All ${label(category)}s, including future ones`}</p>
                        <button disabled={!sources.length && mode !== "ALL_DYNAMIC"} onClick={() => { setDrawer(true); setRecipients([]); }} data-testid="open-give-access"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40"><KeySquare size={15} /> Give Access</button>
                    </div>
                )}
            </div>

            {/* 2. Access granted */}
            <div className={`${card} p-5 space-y-3`}>
                <h2 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck size={15} className="text-amber-400" /> Access Granted</h2>
                <div className="overflow-x-auto [contain:inline-size]">
                    <table className="w-full min-w-[900px] text-xs" data-testid="grants-table">
                        <thead><tr className="text-[9px] text-zinc-500 uppercase tracking-widest text-left">
                            <th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Employee ID</th><th className="py-2 pr-3">Access</th><th className="py-2 pr-3">Source Employees</th>
                            <th className="py-2 pr-3">Granted By</th><th className="py-2 pr-3">Granted</th><th className="py-2 pr-3">Status</th><th className="py-2 text-right">Actions</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {(data.grants || []).map((g: any) => (
                                <tr key={g.id} data-testid="grant-row">
                                    <td className="py-2.5 pr-3 font-bold text-white">{g.recipientName}</td>
                                    <td className="py-2.5 pr-3 font-mono text-zinc-400">{g.recipientId}</td>
                                    <td className="py-2.5 pr-3 text-amber-300 font-bold">{g.hubLabel}</td>
                                    <td className="py-2.5 pr-3 text-zinc-300 max-w-[16rem]">{g.scopeType === "ALL_DYNAMIC" ? `All ${label(g.category)}s (incl. future)` : <span className="line-clamp-2">{g.sources.map((s: any) => s.name).join(", ")}{g.scopeType === "ALL" ? " (all, snapshot)" : ""}</span>}</td>
                                    <td className="py-2.5 pr-3 text-zinc-300">{g.grantedByName}</td>
                                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">{fmt(g.grantedAt)}</td>
                                    <td className="py-2.5 pr-3"><span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${g.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{g.status === "ACTIVE" ? "Active" : "Revoked"}</span></td>
                                    <td className="py-2.5 text-right whitespace-nowrap">
                                        <button onClick={() => setView(g)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300" title="View access"><Eye size={14} /></button>
                                        {g.status === "ACTIVE" && <>
                                            <button onClick={() => setEdit({ grant: g, mode: g.scopeType, ids: g.sourceEmployeeIds || [] })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-sky-300" title="Edit access" data-testid="grant-edit"><Pencil size={14} /></button>
                                            <button onClick={() => setRevoke(g)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="Remove access" data-testid="grant-revoke"><Trash2 size={14} /></button>
                                        </>}
                                    </td>
                                </tr>
                            ))}
                            {!(data.grants || []).length && <tr><td colSpan={8} className="py-8 text-center text-zinc-500">No access has been given yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* One person: Give Access panel (team / role → members → review) */}
            {giveTo && (
                <GiveAccessModal recipient={giveTo} employees={employees} categories={cats} grants={data.grants || []} canDynamic={!!data.me.canDynamic}
                    onClose={() => setGiveTo(null)} onDone={async (msg: string) => { setGiveTo(null); await load(); flash(msg); refreshHubs?.(); }} />
            )}

            {/* Recipient drawer */}
            {drawer && (
                <div className="fixed inset-0 z-[110] bg-black/60 flex justify-end" onClick={() => !busy && setDrawer(false)}>
                    <div className="w-full max-w-md h-full bg-zinc-900 border-l border-zinc-800 flex flex-col" onClick={e => e.stopPropagation()} data-testid="give-access-drawer">
                        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-white">Give Access To</h3>
                            <button onClick={() => setDrawer(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-2 border-b border-zinc-800">
                            <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input value={rq.q} onChange={e => setRq(f => ({ ...f, q: e.target.value }))} placeholder="Search employee (name or ID)…" data-testid="recipient-search"
                                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none" /></div>
                            <div className="grid grid-cols-3 gap-2">
                                {([["role", "Role", uniq(eligible.map(e => e.role))], ["dept", "Department", uniq(eligible.map(e => e.dept))], ["campus", "Campus", uniq(eligible.map(e => e.campus))]] as [keyof typeof rq, string, string[]][]).map(([k, l, opts]) => (
                                    <select key={k} value={rq[k]} onChange={e => setRq(f => ({ ...f, [k]: e.target.value }))} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-white outline-none">
                                        <option value="All">{l}: All</option>{opts.map(o => <option key={o} value={o}>{k === "role" ? label(o) : o}</option>)}
                                    </select>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-emerald-500" data-testid="select-all-recipients" checked={recFiltered.length > 0 && recFiltered.every(e => recipients.includes(e.id))}
                                    onChange={e => setRecipients(r => e.target.checked ? Array.from(new Set([...r, ...recFiltered.map(x => x.id)])) : r.filter(id => !recFiltered.some(x => x.id === id)))} />
                                Select all eligible employees ({recFiltered.length})
                            </label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {recFiltered.map(e => (
                                <label key={e.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${recipients.includes(e.id) ? "bg-emerald-500/[0.07]" : "hover:bg-zinc-800/60"}`} data-testid="recipient-row">
                                    <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={recipients.includes(e.id)} onChange={ev => setRecipients(r => ev.target.checked ? [...r, e.id] : r.filter(x => x !== e.id))} />
                                    <span className="min-w-0"><span className="block text-xs font-bold text-white truncate">{e.name} – {label(e.category)}</span><span className="block text-[10px] text-zinc-500 truncate">{e.id} · {e.campus || "—"} · {e.dept || "—"}</span></span>
                                </label>
                            ))}
                        </div>
                        <div className="p-4 border-t border-zinc-800 flex gap-2">
                            <button onClick={() => setDrawer(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold">Cancel</button>
                            <button disabled={!recipients.length} onClick={() => setConfirm(true)} data-testid="recipients-next" className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">Review ({recipients.length}) <ChevronRight size={14} /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation */}
            {confirm && cat && (
                <Modal title="Confirm access" onClose={() => !busy && setConfirm(false)} testid="grant-confirm">
                    <dl className="space-y-3 text-xs">
                        <Row k="Access category" v={label(cat.category)} />
                        <Row k="Source access" v={mode === "SELECTED" ? picked.map(id => employees.find(e => e.id === id)?.name || id).join(", ") : mode === "ALL" ? `All ${inCategory.length} ${label(cat.category)}s (as of today)` : `All ${label(cat.category)}s, including future ones`} />
                        <Row k="Access recipient" v={recipients.map(id => { const e = employees.find(x => x.id === id); return e ? `${e.name} – ${label(e.category)}` : id; }).join(", ")} />
                        <Row k="Access type" v={`${cat.hubLabel} access`} />
                        <Row k="Permissions" v={cat.items.map(i => i.label).join(" · ")} />
                    </dl>
                    <div className="flex gap-2 mt-5">
                        <button onClick={() => setConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold">Cancel</button>
                        <button disabled={busy} data-testid="grant-confirm-yes" onClick={async () => { if (await post({ action: "grant", category: cat.category, scopeType: mode, sourceIds: picked, recipientIds: recipients })) resetSelection(); }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2">{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm & Give Access</button>
                    </div>
                </Modal>
            )}

            {view && (
                <Modal title={`${view.hubLabel} — ${view.recipientName}`} onClose={() => setView(null)} testid="grant-view">
                    <dl className="space-y-2.5 text-xs mb-4">
                        <Row k="Recipient" v={`${view.recipientName} (${view.recipientId})`} />
                        <Row k="Sources" v={view.scopeType === "ALL_DYNAMIC" ? `All ${label(view.category)}s incl. future` : view.sources.map((s: any) => s.name).join(", ")} />
                        <Row k="Granted" v={`${view.grantedByName} · ${fmt(view.grantedAt)}`} />
                        {view.revokedAt && <Row k="Revoked" v={`${view.revokedByName} · ${fmt(view.revokedAt)}`} />}
                    </dl>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2"><History size={11} /> Audit trail</p>
                    <ol className="space-y-2 max-h-64 overflow-y-auto">{[...(view.history || [])].reverse().map((h: any, i: number) => (
                        <li key={i} className="text-[11px]"><span className="font-bold text-white">{h.action}</span> <span className="text-zinc-500">by {h.byName} ({h.role}) · {fmt(h.at)}</span>{h.sourceEmployeeIds?.length ? <span className="block text-zinc-400">Sources: {h.sourceEmployeeIds.map((id: string) => employees.find(e => e.id === id)?.name || id).join(", ")}</span> : null}</li>
                    ))}</ol>
                </Modal>
            )}

            {edit && (() => {
                const pool = employees.filter(e => e.category === edit.grant.category && e.id !== edit.grant.recipientId);
                return (
                    <Modal title={`Edit ${edit.grant.hubLabel} — ${edit.grant.recipientName}`} onClose={() => !busy && setEdit(null)} testid="grant-edit-modal">
                        <div className="flex flex-wrap gap-2 mb-3">
                            {([["SELECTED", "Selected"], ["ALL", "All (as of today)"], ...(data.me.canDynamic ? [["ALL_DYNAMIC", "All + future"]] : [])] as [Mode, string][]).map(([m, t]) => (
                                <button key={m} onClick={() => setEdit((x: any) => ({ ...x, mode: m }))} className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold ${edit.mode === m ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>{t}</button>
                            ))}
                        </div>
                        {edit.mode === "SELECTED" && (
                            <div className="max-h-72 overflow-y-auto space-y-1">{pool.map(e => (
                                <label key={e.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer text-xs text-zinc-200" data-testid="edit-source">
                                    <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={edit.ids.includes(e.id)} onChange={ev => setEdit((x: any) => ({ ...x, ids: ev.target.checked ? [...x.ids, e.id] : x.ids.filter((y: string) => y !== e.id) }))} />
                                    {e.name} <span className="text-zinc-500">{e.id} · {e.campus || "—"}</span>
                                </label>
                            ))}</div>
                        )}
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setEdit(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold">Cancel</button>
                            <button disabled={busy || (edit.mode === "SELECTED" && !edit.ids.length)} data-testid="grant-edit-save"
                                onClick={async () => { if (await post({ action: "edit", grantId: edit.grant.id, scopeType: edit.mode, sourceIds: edit.ids })) setEdit(null); }}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40">Save</button>
                        </div>
                    </Modal>
                );
            })()}

            {revoke && (
                <Modal title="Remove access" onClose={() => !busy && setRevoke(null)} testid="grant-revoke-modal">
                    <p className="text-sm text-zinc-300">Are you sure you want to revoke this employee&apos;s delegated access?</p>
                    <p className="text-xs text-zinc-500 mt-2">{revoke.recipientName} loses the {revoke.hubLabel}. Their own role ({label(employees.find(e => e.id === revoke.recipientId)?.category || "")}) is not affected.</p>
                    <div className="flex gap-2 mt-5">
                        <button onClick={() => setRevoke(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold">Cancel</button>
                        <button disabled={busy} data-testid="grant-revoke-yes" onClick={async () => { if (await post({ action: "revoke", grantId: revoke.id })) setRevoke(null); }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Revoke Access</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

const AVATAR_TONES = ["bg-violet-500/80 text-white", "bg-teal-500/80 text-white", "bg-sky-500/80 text-white", "bg-pink-400/80 text-white", "bg-amber-400/85 text-zinc-900", "bg-emerald-500/80 text-white", "bg-orange-400/85 text-white", "bg-indigo-400/85 text-white"];
const avatarTone = (k: string) => AVATAR_TONES[[...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const initials = (n: string) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

function Row({ k, v }: { k: string; v: string }) {
    return <div className="grid grid-cols-[8.5rem_1fr] gap-3"><dt className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pt-0.5">{k}</dt><dd className="text-zinc-200 [overflow-wrap:anywhere]">{v || "—"}</dd></div>;
}
function Modal({ title, onClose, children, testid }: { title: string; onClose: () => void; children: React.ReactNode; testid: string }) {
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6" onClick={e => e.stopPropagation()} data-testid={testid}>
                <div className="flex items-center justify-between mb-4"><h3 className="text-base font-bold text-white flex items-center gap-2"><Layers size={16} className="text-amber-400" /> {title}</h3><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
                {children}
            </div>
        </div>
    );
}