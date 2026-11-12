"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, Loader2, Users, Trash2, X, CheckCircle2, AlertTriangle, CalendarDays, Building2, UserRound, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMinWidth } from "@/lib/use-min-width";

/**
 * Announcements → Holiday Management (HR / HR Executive / Founder: every holiday · HOI: its colleges only).
 * Data: GET /api/holidays/manage (real Holiday records) · View Assigned Employees: ?employees=<row> · Remove: POST.
 * All Holidays | College-wise | Manually Assigned, with search + date / college / type / status filters.
 */
type Row = {
    key: string; holidayId: string; name: string; date: string; status: string; type: "College-wise" | "Manual";
    collegeId: string; collegeName: string; assignedTo: string; employeeId?: string; employeeName?: string;
    assignedBy: string; assignedByRole: string; employeeCount: number; excludedCount: number; canRemove: boolean; reason?: string;
};
type Emp = { employeeId: string; name: string; designation?: string; collegeName: string; type: string; holidayId: string; status: string; canRemove: boolean };
type Confirm = { title: string; lines: [string, string][]; note: string; body: any; button: string };

const PAGE = 25;
const longDate = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
const shortDate = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const STATUS_CLS: Record<string, string> = {
    Active: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
    "Pending Approval": "text-amber-300 bg-amber-500/10 border-amber-500/25",
    Rejected: "text-red-300 bg-red-500/10 border-red-500/25",
};
const sel = "h-9 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-primary/50 min-w-0";

export default function HolidayManagement() {
    const { reloadHolidaysAndNotices } = useAuth();
    // table from 768px, cards below — decided here (not by responsive display classes, which some builds leave out)
    const wide = useMinWidth(768);
    const [tab, setTab] = useState<"ALL" | "COLLEGE" | "MANUAL">("ALL");
    const [data, setData] = useState<{ rows: Row[]; colleges: { id: string; name: string }[]; canManageAll: boolean } | null>(null);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");
    const [q, setQ] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [college, setCollege] = useState("All");
    const [type, setType] = useState("All");
    const [status, setStatus] = useState("All");
    const [page, setPage] = useState(1);
    const [view, setView] = useState<Row | null>(null);
    const [confirm, setConfirm] = useState<Confirm | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmErr, setConfirmErr] = useState("");
    const [viewReload, setViewReload] = useState(0);

    const load = async () => {
        setErr("");
        try {
            const r = await fetch("/api/holidays/manage", { cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not load the holidays.");
            setData(d);
        } catch (e: any) { setErr(e.message); setData(d => d || { rows: [], colleges: [], canManageAll: false }); }
    };
    useEffect(() => { load(); }, []);
    useEffect(() => { setPage(1); }, [tab, q, from, to, college, type, status]);

    const rows = useMemo(() => {
        const t = q.trim().toLowerCase();
        return (data?.rows || []).filter(r =>
            (tab === "ALL" || (tab === "COLLEGE" ? r.type === "College-wise" : r.type === "Manual"))
            && (!t || `${r.name} ${r.collegeName} ${r.employeeName || ""} ${r.employeeId || ""} ${r.assignedBy}`.toLowerCase().includes(t))
            && (!from || r.date >= from) && (!to || r.date <= to)
            && (college === "All" || r.collegeId === college || (tab === "COLLEGE" && r.collegeId === "ALL"))
            && (tab !== "ALL" || type === "All" || r.type === type)
            && (status === "All" || r.status === status));
    }, [data, tab, q, from, to, college, type, status]);
    const counts = useMemo(() => {
        const all = data?.rows || [];
        return { ALL: all.length, COLLEGE: all.filter(r => r.type === "College-wise").length, MANUAL: all.filter(r => r.type === "Manual").length };
    }, [data]);
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    const shown = rows.slice((page - 1) * PAGE, page * PAGE);
    const filtersOn = !!(q || from || to || college !== "All" || type !== "All" || status !== "All");
    const reset = () => { setQ(""); setFrom(""); setTo(""); setCollege("All"); setType("All"); setStatus("All"); };

    const askRemoveRow = (r: Row) => {
        setConfirmErr("");
        if (r.type === "Manual") setConfirm({
            title: "Remove Holiday Assignment?", button: "Confirm Removal",
            lines: [["Employee", `${r.employeeName} (${r.employeeId})`], ["Holiday", r.name], ["Date", longDate(r.date)]],
            note: "This action will remove the selected holiday assignment for this employee only.",
            body: { holidayId: r.holidayId, employeeId: r.employeeId },
        });
        else if (r.collegeId === "ALL") setConfirm({
            title: "Remove Holiday For All Colleges?", button: "Confirm Removal",
            lines: [["Holiday", r.name], ["Date", longDate(r.date)], ["College", "All colleges"]],
            note: "This holiday day will be removed for every college. Other holidays are not changed.",
            body: { holidayId: r.holidayId, collegeId: "ALL" },
        });
        else setConfirm({
            title: `Remove Holiday From ${r.collegeName}?`, button: "Confirm Removal",
            lines: [["Holiday", r.name], ["Date", longDate(r.date)], ["College", r.collegeName]],
            note: `Are you sure you want to remove this holiday assignment from ${r.collegeName}? Other colleges and employees keep their holidays.`,
            body: { holidayId: r.holidayId, collegeId: r.collegeId },
        });
    };
    const askRemoveEmp = (e: Emp, h: { name: string; date: string }) => {
        setConfirmErr("");
        setConfirm({
            title: "Remove Holiday Assignment?", button: "Confirm Removal",
            lines: [["Employee", `${e.name} (${e.employeeId})`], ["Holiday", h.name], ["Date", longDate(h.date)]],
            note: "This action will remove the selected holiday assignment for this employee only.",
            body: { holidayId: e.holidayId, employeeId: e.employeeId },
        });
    };
    const doRemove = async () => {
        if (!confirm) return;
        setBusy(true); setConfirmErr("");
        try {
            const r = await fetch("/api/holidays/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", ...confirm.body }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not remove the holiday.");
            setConfirm(null); setMsg(d.message || "Holiday removed.");
            await load(); setViewReload(k => k + 1);
            reloadHolidaysAndNotices?.();
        } catch (e: any) { setConfirmErr(e.message); }
        finally { setBusy(false); }
    };

    const StatusPill = ({ s }: { s: string }) => <span className={cn("inline-flex px-2 py-0.5 rounded-md border text-[10.5px] font-bold whitespace-nowrap", STATUS_CLS[s] || "text-zinc-300 bg-zinc-800 border-zinc-700")} data-testid="hm-status">{s}</span>;
    const TypePill = ({ t }: { t: string }) => <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-bold whitespace-nowrap", t === "Manual" ? "text-violet-300 bg-violet-500/10 border-violet-500/25" : "text-sky-300 bg-sky-500/10 border-sky-500/25")}>{t === "Manual" ? <UserRound size={11} /> : <Building2 size={11} />}{t}</span>;
    const btn = "inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors disabled:opacity-50";
    const Actions = ({ r }: { r: Row }) => (
        <div className="flex items-center gap-1.5 justify-end">
            <button onClick={() => setView(r)} data-testid="hm-view" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800`}><Users size={13} /> View</button>
            {r.canRemove && <button onClick={() => askRemoveRow(r)} data-testid="hm-remove" className={`${btn} border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20`}><Trash2 size={13} /> Remove</button>}
        </div>
    );
    const by = (r: Row) => r.assignedBy ? `${r.assignedBy}${r.assignedByRole ? ` (${r.assignedByRole})` : ""}` : (r.assignedByRole || "—");

    return (
        <div className="space-y-4" data-testid="holiday-management">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl max-w-full overflow-x-auto" role="tablist" data-testid="hm-tabs">
                    {([["ALL", "All Holidays"], ["COLLEGE", "College-wise"], ["MANUAL", "Manually Assigned"]] as const).map(([k, l]) => (
                        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`hm-tab-${k}`}
                            className={cn("px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all", tab === k ? "bg-zinc-800 text-primary shadow-inner" : "text-zinc-500 hover:text-zinc-300")}>
                            {l} {data && <span className="ml-1 text-[10px] tabular-nums text-zinc-500">{counts[k]}</span>}
                        </button>
                    ))}
                </div>
                {!data?.canManageAll && data && <p className="text-[11px] text-zinc-500">Showing your assigned colleges only. You can remove holidays you announced.</p>}
            </div>

            {/* filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))_auto] gap-2" data-testid="hm-filters">
                <div className="relative min-w-0">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === "MANUAL" ? "Search employee, ID, holiday…" : "Search holiday, college, employee…"} data-testid="hm-search"
                        className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 text-xs text-white outline-none focus:border-primary/50" />
                </div>
                <label className="flex items-center gap-1.5 h-9 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg focus-within:border-primary/50 min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="flex-1 min-w-0 bg-transparent text-xs text-zinc-200 outline-none [color-scheme:dark]" data-testid="hm-from" aria-label="From date" /></label>
                <label className="flex items-center gap-1.5 h-9 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg focus-within:border-primary/50 min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} className="flex-1 min-w-0 bg-transparent text-xs text-zinc-200 outline-none [color-scheme:dark]" data-testid="hm-to" aria-label="To date" /></label>
                <select value={college} onChange={e => setCollege(e.target.value)} className={cn(sel, "w-full")} data-testid="hm-college" aria-label="College">
                    <option value="All">{tab === "COLLEGE" ? "College: All" : "All colleges"}</option>
                    {(data?.colleges || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={type} onChange={e => setType(e.target.value)} disabled={tab !== "ALL"} className={cn(sel, "w-full disabled:opacity-40")} data-testid="hm-type" aria-label="Assignment type">
                    <option value="All">Type: All</option><option value="College-wise">College-wise</option><option value="Manual">Manual</option>
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} className={cn(sel, "w-full")} data-testid="hm-status-filter" aria-label="Status">
                    <option value="All">Status: All</option><option value="Active">Active</option><option value="Pending Approval">Pending Approval</option><option value="Rejected">Rejected</option>
                </select>
                <button onClick={reset} disabled={!filtersOn} className={`${btn} h-9 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800`} data-testid="hm-reset"><RotateCcw size={13} /> Reset</button>
            </div>

            {msg && <div className="flex items-start gap-2 p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200 text-xs" data-testid="hm-msg"><CheckCircle2 size={15} className="shrink-0 mt-px" /><span className="flex-1 [overflow-wrap:anywhere]">{msg}</span><button onClick={() => setMsg("")} aria-label="Close" className="text-emerald-300/70 hover:text-white"><X size={14} /></button></div>}
            {err && <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-xs" data-testid="hm-error"><AlertTriangle size={15} className="shrink-0 mt-px" /><span className="flex-1">{err}</span><button onClick={load} className="font-bold underline">Retry</button></div>}

            {!data ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={20} /></div>
                : !rows.length ? <p className="py-14 text-center text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-2xl" data-testid="hm-empty">{filtersOn ? "No holidays match these filters." : tab === "MANUAL" ? "No holidays assigned manually to employees." : "No holidays yet."}</p>
                    : <>
                        {/* desktop / tablet: compact table (scrolls sideways inside its box when narrow) */}
                        <div style={{ display: wide ? "block" : "none" }} className="rounded-2xl border border-zinc-800 overflow-x-auto" data-testid="hm-table-box">
                            <table className="w-full text-xs min-w-[860px]" data-testid="hm-table">
                                <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500">
                                    {tab === "MANUAL" ? (
                                        <tr><th className="text-left font-bold px-3 py-2.5">Employee</th><th className="text-left font-bold px-3 py-2.5">Employee ID</th><th className="text-left font-bold px-3 py-2.5">College</th><th className="text-left font-bold px-3 py-2.5">Holiday</th><th className="text-left font-bold px-3 py-2.5">Date</th><th className="text-left font-bold px-3 py-2.5">Type</th><th className="text-left font-bold px-3 py-2.5">Assigned By</th><th className="text-left font-bold px-3 py-2.5">Status</th><th className="text-right font-bold px-3 py-2.5">Actions</th></tr>
                                    ) : tab === "COLLEGE" ? (
                                        <tr><th className="text-left font-bold px-3 py-2.5">Holiday Name</th><th className="text-left font-bold px-3 py-2.5">Date</th><th className="text-left font-bold px-3 py-2.5">College</th><th className="text-left font-bold px-3 py-2.5">Employees</th><th className="text-left font-bold px-3 py-2.5">Assigned By</th><th className="text-left font-bold px-3 py-2.5">Status</th><th className="text-right font-bold px-3 py-2.5">Actions</th></tr>
                                    ) : (
                                        <tr><th className="text-left font-bold px-3 py-2.5">Holiday Name</th><th className="text-left font-bold px-3 py-2.5">Date</th><th className="text-left font-bold px-3 py-2.5">College</th><th className="text-left font-bold px-3 py-2.5">Assigned To</th><th className="text-left font-bold px-3 py-2.5">Assignment Type</th><th className="text-left font-bold px-3 py-2.5">Assigned By</th><th className="text-left font-bold px-3 py-2.5">Status</th><th className="text-right font-bold px-3 py-2.5">Actions</th></tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-zinc-800/70">
                                    {shown.map(r => (
                                        <tr key={r.key} className="hover:bg-white/[0.02]" data-testid="hm-row" data-key={r.key}>
                                            {tab === "MANUAL" ? <>
                                                <td className="px-3 py-2.5 font-semibold text-white">{r.employeeName}</td>
                                                <td className="px-3 py-2.5 text-zinc-400 font-mono text-[11px]">{r.employeeId}</td>
                                                <td className="px-3 py-2.5 text-zinc-300">{r.collegeName}</td>
                                                <td className="px-3 py-2.5 text-zinc-200">{r.name}</td>
                                                <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap" data-testid="hm-date">{shortDate(r.date)}</td>
                                                <td className="px-3 py-2.5"><TypePill t={r.type} /></td>
                                                <td className="px-3 py-2.5 text-zinc-400">{by(r)}</td>
                                                <td className="px-3 py-2.5"><StatusPill s={r.status} /></td>
                                            </> : <>
                                                <td className="px-3 py-2.5 font-semibold text-white">{r.name}</td>
                                                <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap" data-testid="hm-date">{shortDate(r.date)}</td>
                                                <td className="px-3 py-2.5 text-zinc-300">{r.collegeName}</td>
                                                {tab === "COLLEGE" ? <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.employeeCount}{r.excludedCount ? <span className="text-zinc-500"> · {r.excludedCount} removed</span> : ""}</td> : <>
                                                    <td className="px-3 py-2.5 text-zinc-300">{r.type === "Manual" ? `${r.employeeName} (${r.employeeId})` : r.assignedTo}</td>
                                                    <td className="px-3 py-2.5"><TypePill t={r.type} /></td>
                                                </>}
                                                <td className="px-3 py-2.5 text-zinc-400">{by(r)}</td>
                                                <td className="px-3 py-2.5"><StatusPill s={r.status} /></td>
                                            </>}
                                            <td className="px-3 py-2"><Actions r={r} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* mobile: cards */}
                        <div style={{ display: wide ? "none" : "block" }} className="space-y-2" data-testid="hm-cards">
                            {shown.map(r => (
                                <div key={r.key} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2" data-testid="hm-card">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white [overflow-wrap:anywhere]">{r.type === "Manual" ? r.employeeName : r.name}</p>
                                            <p className="text-[11px] text-zinc-400 [overflow-wrap:anywhere]">{r.type === "Manual" ? `${r.employeeId} · ${r.name}` : r.collegeName}</p>
                                        </div>
                                        <StatusPill s={r.status} />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                                        <span className="inline-flex items-center gap-1 text-zinc-200"><CalendarDays size={12} />{shortDate(r.date)}</span>
                                        <TypePill t={r.type} />
                                        {r.type === "Manual" ? <span>{r.collegeName}</span> : <span>{r.employeeCount} employee{r.employeeCount === 1 ? "" : "s"}</span>}
                                        <span className="[overflow-wrap:anywhere]">By {by(r)}</span>
                                    </div>
                                    <div className="flex gap-2 [&>div]:w-full [&_button]:flex-1 [&_button]:h-10"><Actions r={r} /></div>
                                </div>
                            ))}
                        </div>
                        {pages > 1 && (
                            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400" data-testid="hm-pager">
                                <span>{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length}</span>
                                <div className="flex gap-1.5">
                                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={`${btn} border-zinc-800 bg-zinc-900 text-zinc-200`}>Previous</button>
                                    <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className={`${btn} border-zinc-800 bg-zinc-900 text-zinc-200`} data-testid="hm-next">Next</button>
                                </div>
                            </div>
                        )}
                    </>}

            {view && <AssignedEmployees row={view} reloadKey={viewReload} onClose={() => setView(null)} onRemove={askRemoveEmp} />}

            {confirm && (
                <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" data-testid="hm-confirm">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !busy && setConfirm(null)} />
                    <div className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
                        <h3 className="text-base font-bold text-white flex items-center gap-2"><Trash2 size={16} className="text-red-300" /> {confirm.title}</h3>
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                            {confirm.lines.map(([k, v]) => <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="text-white font-semibold [overflow-wrap:anywhere]">{v}</dd></div>)}
                        </dl>
                        <p className="text-xs text-zinc-300" data-testid="hm-confirm-note">&ldquo;{confirm.note}&rdquo;</p>
                        <p className="text-[11px] text-zinc-500">Attendance flags that were removed only because of this holiday become active again.</p>
                        {confirmErr && <p className="text-xs text-red-300" data-testid="hm-confirm-error">{confirmErr}</p>}
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setConfirm(null)} disabled={busy} className={`${btn} h-10 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800`}>Cancel</button>
                            <button onClick={doRemove} disabled={busy} data-testid="hm-confirm-yes" className={`${btn} h-10 border-red-500/40 bg-red-500/80 text-white hover:bg-red-500`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {confirm.button}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AssignedEmployees({ row, reloadKey, onClose, onRemove }: { row: Row; reloadKey: number; onClose: () => void; onRemove: (e: Emp, h: { name: string; date: string }) => void }) {
    const [d, setD] = useState<{ holiday: any; employees: Emp[] } | null>(null);
    const [err, setErr] = useState("");
    const [q, setQ] = useState("");
    useEffect(() => {
        let alive = true;
        setErr("");
        fetch(`/api/holidays/manage?employees=${encodeURIComponent(row.key)}`, { cache: "no-store" }).then(async r => {
            const x = await r.json().catch(() => ({}));
            if (!alive) return;
            if (!r.ok) { setErr(x.error || "Could not load the employees."); setD({ holiday: null, employees: [] }); } else setD(x);
        }).catch(() => alive && setErr("Could not load the employees."));
        return () => { alive = false; };
    }, [row.key, reloadKey]);
    useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
    const t = q.trim().toLowerCase();
    const list = (d?.employees || []).filter(e => !t || `${e.name} ${e.employeeId}`.toLowerCase().includes(t));
    const h = d?.holiday || { name: row.name, date: row.date, collegeName: row.collegeName, status: row.status };
    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" data-testid="hm-view-modal">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative w-full sm:max-w-2xl max-h-[88vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl">
                <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-zinc-800">
                    <div className="min-w-0 space-y-1">
                        <h3 className="text-base font-bold text-white">Assigned Employees</h3>
                        <p className="text-xs text-zinc-400 [overflow-wrap:anywhere]"><b className="text-zinc-200">Holiday:</b> {h.name} · <b className="text-zinc-200">Date:</b> <span data-testid="hm-view-date">{longDate(h.date)}</span> · <b className="text-zinc-200">College:</b> {h.collegeName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 shrink-0" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-4 pb-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or employee ID…" data-testid="hm-view-search"
                            className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 text-xs text-white outline-none focus:border-primary/50" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {!d ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-zinc-500" size={18} /></div>
                        : err ? <p className="py-8 text-center text-xs text-red-300">{err}</p>
                            : !list.length ? <p className="py-8 text-center text-xs text-zinc-500" data-testid="hm-view-empty">No employees{t ? " match the search" : ""}.</p> : (
                                <div className="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800">
                                    {list.map(e => (
                                        <div key={`${e.holidayId}|${e.employeeId}`} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5" data-testid="hm-view-row">
                                            <div className="min-w-0 flex-1 basis-40">
                                                <p className="text-xs font-semibold text-white [overflow-wrap:anywhere]">{e.name}</p>
                                                <p className="text-[11px] text-zinc-500 [overflow-wrap:anywhere]"><span className="font-mono">{e.employeeId}</span>{e.designation ? ` · ${e.designation}` : ""} · {e.collegeName}</p>
                                            </div>
                                            <span className={cn("inline-flex px-2 py-0.5 rounded-md border text-[10.5px] font-bold whitespace-nowrap", e.type === "Manual" ? "text-violet-300 bg-violet-500/10 border-violet-500/25" : "text-sky-300 bg-sky-500/10 border-sky-500/25")}>{e.type}</span>
                                            <span className={cn("inline-flex px-2 py-0.5 rounded-md border text-[10.5px] font-bold whitespace-nowrap", STATUS_CLS[e.status] || "text-zinc-300 bg-zinc-800 border-zinc-700")}>{e.status}</span>
                                            {e.canRemove && <button onClick={() => onRemove(e, h)} data-testid="hm-view-remove" className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-[11px] font-semibold"><Trash2 size={12} /> Remove</button>}
                                        </div>
                                    ))}
                                </div>
                            )}
                </div>
                <p className="px-5 py-3 border-t border-zinc-800 text-[11px] text-zinc-500">{list.length} of {(d?.employees || []).length} employee{(d?.employees || []).length === 1 ? "" : "s"}</p>
            </div>
        </div>
    );
}