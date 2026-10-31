"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Flag, Shirt, LogIn, LogOut, History, Search, X, Upload, Loader2, AlertTriangle, CheckCircle2, RotateCcw, Eye, ChevronLeft, ChevronRight, Trash2, Mail } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";

/** HR Administration → Flag Removal (HR, HR Executive, Founders). The original flag record is never deleted. */
const TABS = [
    { key: "ALL", label: "All Flags", icon: Flag },
    { key: "DRESS_CODE", label: "Dress Code", icon: Shirt },
    { key: "CLOCK_IN", label: "Clock-In", icon: LogIn },
    { key: "CLOCK_OUT", label: "Clock-Out", icon: LogOut },
    { key: "REMOVED", label: "Removed Flags", icon: History },
];
const dmy = (ymd?: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");

export default function FlagRemovalPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState("ALL");
    const [q, setQ] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [dept, setDept] = useState("");
    const [college, setCollege] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [view, setView] = useState<any>(null);
    const [removing, setRemoving] = useState<any>(null);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const p = new URLSearchParams({ tab, page: String(page) });
            if (q.trim()) p.set("q", q.trim()); if (from) p.set("from", from); if (to) p.set("to", to); if (dept) p.set("dept", dept); if (college) p.set("college", college);
            const res = await fetch(`/api/hr/flag-removal?${p}`, { cache: "no-store" });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "Could not load");
            setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [tab, page, q, from, to, dept, college]);
    useEffect(() => { if (user) { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); } }, [user, load, q]);
    useEffect(() => { setPage(1); }, [tab, q, from, to, dept, college]);

    const retry = async (removalId: string) => {
        const res = await fetch("/api/hr/flag-removal/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removalId }) });
        const d = await res.json().catch(() => ({}));
        setMsg({ type: res.ok ? "success" : "error", text: d.message || d.error || "Done" });
        load();
    };

    if (!user) return null;
    if (user.role !== "HR" && user.role !== "FOUNDER") return <div className="p-8 text-center text-sm text-zinc-500">Only HR, HR Executive and Founders can open Flag Removal.</div>;
    const s = data?.summary;
    const cards = [
        { k: "ALL", label: "Total Active Flags", value: s?.totalActive, icon: Flag, tone: "border-red-500/25 bg-red-500/[0.06] text-red-300" },
        { k: "DRESS_CODE", label: "Dress Code Flags", value: s?.dressCode, icon: Shirt, tone: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300" },
        { k: "CLOCK_IN", label: "Clock-In Flags", value: s?.clockIn, icon: LogIn, tone: "border-sky-500/25 bg-sky-500/[0.06] text-sky-300" },
        { k: "CLOCK_OUT", label: "Clock-Out Flags", value: s?.clockOut, icon: LogOut, tone: "border-violet-500/25 bg-violet-500/[0.06] text-violet-300" },
        { k: "REMOVED", label: "Removed This Month", value: s?.removedThisMonth, icon: History, tone: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300" },
    ];
    const field = "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white";

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto w-full [contain:inline-size]" data-testid="flag-removal">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"><Flag size={26} className="text-primary" /> Flag Removal</h1>
                <p className="text-zinc-500 mt-1 text-sm">Active dress code, clock-in and clock-out flags. Removing a flag keeps the original record and its full history; an email goes to the employee, HR, HR Executive, Founders, the technical admin and (professors) their HOI.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="fr-cards">
                {cards.map(c => (
                    <button key={c.k} onClick={() => setTab(c.k)} aria-pressed={tab === c.k} data-testid={`fr-card-${c.k}`}
                        className={`text-left rounded-2xl border p-4 transition ${c.tone} ${tab === c.k ? "ring-2 ring-white/20" : "hover:brightness-125"}`}>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><c.icon size={13} /> {c.label}</div>
                        <p className="text-2xl font-black text-white mt-2 tabular-nums" data-testid="fr-card-count">{c.value ?? "—"}</p>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-zinc-900/60 border border-zinc-800 w-fit max-w-full" role="tablist">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} data-testid={`fr-tab-${t.key}`} role="tab" aria-selected={tab === t.key}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider ${tab === t.key ? "bg-primary text-white" : "text-zinc-400 hover:text-white"}`}>
                        <t.icon size={13} /> {t.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                <div className="relative lg:col-span-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee name or ID" className={`${field} w-full pl-8`} data-testid="fr-search" />
                </div>
                <div className="flex items-center gap-1.5 lg:col-span-2 min-w-0"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${field} w-full [color-scheme:dark]`} title="From" /><span className="text-zinc-600 text-xs">–</span><input type="date" value={to} onChange={e => setTo(e.target.value)} className={`${field} w-full [color-scheme:dark]`} title="To" /></div>
                <select value={dept} onChange={e => setDept(e.target.value)} className={field}><option value="">All departments</option>{(data?.depts || []).map((d: string) => <option key={d}>{d}</option>)}</select>
                <select value={college} onChange={e => setCollege(e.target.value)} className={field}><option value="">All colleges</option>{(data?.colleges || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>

            {msg && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs ${msg.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`} data-testid="fr-msg">
                    {msg.type === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-auto"><X size={13} /></button>
                </div>
            )}
            {error && <div className="rounded-xl px-4 py-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full table-fixed text-xs min-w-[760px]" data-testid="fr-table">
                    <thead><tr className="bg-zinc-800/40 text-[10px] uppercase tracking-widest text-zinc-400 text-left">
                        <th className="py-3 px-3 w-[30%]">Employee</th>
                        <th className="py-3 px-3 w-[22%]">Flag</th>
                        <th className="py-3 px-3 w-[14%]">Date</th>
                        <th className="py-3 px-3 w-[14%]">{tab === "REMOVED" ? "Removed" : "Status"}</th>
                        <th className="py-3 px-3 w-[20%] text-right">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/70">
                        {loading && !data ? <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="animate-spin inline text-primary" /></td></tr>
                            : (data?.rows || []).length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-zinc-500">{tab === "REMOVED" ? "No flags removed yet." : "No active flags for these filters."}</td></tr>
                                : data.rows.map((r: any) => (
                                    <tr key={r.flagId} className="align-top" data-testid="fr-row">
                                        <td className="py-3 px-3 min-w-0">
                                            <p className="font-bold text-white truncate">{r.employeeName}</p>
                                            <p className="text-[10px] text-zinc-500 truncate">{r.employeeId}{r.dept ? ` · ${r.dept}` : ""}{r.locationName ? ` · ${r.locationName}` : ""}</p>
                                        </td>
                                        <td className="py-3 px-3 min-w-0">
                                            <p className="text-zinc-200 font-semibold" data-testid="fr-type">{r.typeLabel}</p>
                                            <p className="text-[10px] text-zinc-500 truncate">{r.levelLabel || "—"}{r.deduction && r.deduction !== "None" ? ` · ${r.deduction}` : ""}</p>
                                        </td>
                                        <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{dmy(r.date)}</td>
                                        <td className="py-3 px-3">
                                            {r.status === "Removed" ? (
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">Removed</span>
                                                    <p className="text-[10px] text-zinc-500 mt-1 truncate">{r.removal?.removedByName} · {dt(r.removal?.removedAt)}</p>
                                                </div>
                                            ) : <span className="text-[10px] font-black px-2 py-0.5 rounded-md border bg-red-500/10 text-red-300 border-red-500/30">Active</span>}
                                        </td>
                                        <td className="py-3 px-3">
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                                <button onClick={() => setView(r)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase" data-testid="fr-view"><Eye size={12} /> View</button>
                                                {r.status === "Active" && r.employeeId !== user.id && (
                                                    <button onClick={() => setRemoving({ row: r, reason: "", imageUrl: "", busy: false, uploading: false, error: "" })} data-testid="fr-remove"
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[10px] font-black uppercase"><Trash2 size={12} /> Remove</button>
                                                )}
                                                {r.status === "Removed" && r.removal?.emailStatus === "FAILED" && (
                                                    <button onClick={() => retry(r.removal.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase" data-testid="fr-retry"><RotateCcw size={12} /> Retry Email</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
                </div>
                {data && data.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500">
                        <span>{data.total} flag{data.total === 1 ? "" : "s"} · page {data.page} of {data.pages}</span>
                        <div className="flex gap-1.5">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg bg-zinc-800 disabled:opacity-40"><ChevronLeft size={14} /></button>
                            <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg bg-zinc-800 disabled:opacity-40"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                )}
                {data && data.pages <= 1 && <div className="px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500">{data.total} flag{data.total === 1 ? "" : "s"}</div>}
            </div>

            {view && <FlagDetails r={view} onClose={() => setView(null)} />}
            {removing && <RemoveDialog state={removing} setState={setRemoving} onDone={(m) => { setRemoving(null); setMsg({ type: "success", text: m }); load(); }} />}
        </div>
    );
}

function FlagDetails({ r, onClose }: { r: any; onClose: () => void }) {
    const row = (l: string, v: any) => v ? <div className="flex gap-3 py-1.5 border-b border-zinc-800/60"><span className="w-36 shrink-0 text-zinc-500">{l}</span><span className="text-zinc-200 [overflow-wrap:anywhere]">{v}</span></div> : null;
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs" onClick={e => e.stopPropagation()} data-testid="fr-details">
                <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-black text-white">Flag Details</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
                {row("Employee", `${r.employeeName} (${r.employeeId})`)}{row("Department", r.dept)}{row("Designation", r.designation)}{row("College", r.locationName)}
                {row("Flag Type", r.typeLabel)}{row("Flag Date", dmy(r.date))}{row("Level", r.levelLabel)}{row("Deduction", r.deduction)}{row("HR Status", r.hrStatus)}{row("Details", r.detail)}
                {row("Status", r.status)}
                {r.removal && (<>
                    {row("Removed By", `${r.removal.removedByName} (${r.removal.removedByRole})`)}{row("Removed At", dt(r.removal.removedAt))}{row("Reason", r.removal.removalReason)}
                    {r.removal.supportingImageUrl && <div className="py-1.5"><a href={r.removal.supportingImageUrl} target="_blank" rel="noreferrer" className="text-primary underline">Supporting evidence</a></div>}
                    {row("Email", `${r.removal.emailStatus || "—"}${r.removal.emailError ? ` — ${r.removal.emailError}` : ""}`)}
                    {r.removal.notificationRecipients && row("Sent To", [...(r.removal.notificationRecipients.to || [])].join(", "))}
                    {r.removal.notificationRecipients && row("CC", [...(r.removal.notificationRecipients.cc || [])].join(", "))}
                </>)}
            </div>
        </div>
    );
}

function RemoveDialog({ state, setState, onDone }: { state: any; setState: (s: any) => void; onDone: (m: string) => void }) {
    const r = state.row;
    const upload = async (f?: File) => {
        if (!f) return;
        if (!/^image\/(jpe?g|png|webp)$/.test(f.type)) { setState({ ...state, error: "Supported formats: JPG, JPEG, PNG, WEBP." }); return; }
        if (f.size > 5 * 1024 * 1024) { setState({ ...state, error: "The image must be under 5 MB." }); return; }
        setState({ ...state, uploading: true, error: "" });
        try { const res = await uploadToCloudinary(f); setState({ ...state, uploading: false, imageUrl: res.secure_url, error: "" }); }
        catch (e: any) { setState({ ...state, uploading: false, error: e.message || "Upload failed" }); }
    };
    const confirm = async () => {
        setState({ ...state, busy: true, error: "" });
        try {
            const res = await fetch("/api/hr/flag-removal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flagId: r.flagId, reason: state.reason, imageUrl: state.imageUrl }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Could not remove the flag");
            onDone(d.message);
        } catch (e: any) { setState({ ...state, busy: false, error: e.message }); }
    };
    const line = (l: string, v: any) => <div className="flex gap-3"><span className="w-28 shrink-0 text-zinc-500">{l}</span><span className="text-zinc-200 [overflow-wrap:anywhere]">{v || "—"}</span></div>;
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !state.busy && setState(null)}>
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4" onClick={e => e.stopPropagation()} data-testid="fr-dialog">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black text-white flex items-center gap-2"><Trash2 size={18} className="text-red-400" /> Remove Flag</h2><button onClick={() => setState(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-3 space-y-1.5 text-xs">
                    {line("Employee", r.employeeName)}{line("Employee ID", r.employeeId)}{line("Department", r.dept)}{line("College", r.locationName)}
                    {line("Flag Type", `${r.typeLabel}${r.levelLabel ? ` · ${r.levelLabel}` : ""}`)}{line("Flag Date", dmy(r.date))}{line("Current Status", "Active")}
                </div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Reason for Flag Removal *
                    <textarea value={state.reason} onChange={e => setState({ ...state, reason: e.target.value })} rows={4} data-testid="fr-reason"
                        placeholder="Enter detailed reason here…" className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal" />
                </label>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Supporting Evidence (optional)</p>
                    {state.imageUrl ? (
                        <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={state.imageUrl} alt="Evidence" className="w-20 h-20 object-cover rounded-lg border border-zinc-700" />
                            <button onClick={() => setState({ ...state, imageUrl: "" })} className="text-xs text-red-400">Remove image</button>
                        </div>
                    ) : (
                        <label className="flex items-center justify-center gap-2 border border-dashed border-zinc-700 rounded-lg py-3 text-xs text-zinc-400 cursor-pointer hover:border-primary">
                            {state.uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {state.uploading ? "Uploading…" : "Upload Image (JPG, JPEG, PNG, WEBP)"}
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => upload(e.target.files?.[0])} disabled={state.uploading} />
                        </label>
                    )}
                </div>
                {state.error && <p className="text-xs text-red-400 flex items-center gap-1" data-testid="fr-error"><AlertTriangle size={12} /> {state.error}</p>}
                <p className="text-[10px] text-zinc-500 flex items-start gap-1.5"><Mail size={12} className="shrink-0 mt-0.5" /> After removal an email goes to the employee and technical admin (CC: HR, HR Executive, Founders{r.role === "PROFESSOR" || r.role === "FACULTY" ? ", the professor's HOI" : ""}).</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setState(null)} disabled={state.busy} className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
                    <button onClick={confirm} disabled={state.busy || state.uploading || state.reason.trim().length < 5} data-testid="fr-confirm"
                        className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50">{state.busy ? "Removing…" : "Confirm Flag Removal"}</button>
                </div>
            </div>
        </div>
    );
}