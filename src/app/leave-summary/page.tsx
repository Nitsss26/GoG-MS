"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/context/AuthContext";
import {
    CalendarRange, Search, RefreshCw, X, Filter, AlertTriangle, ChevronDown, ChevronUp,
    CheckCircle2, Clock, XCircle, CalendarDays, Building2, IdCard, Briefcase, RotateCcw, Download, ArrowRight, Landmark, MapPin,
} from "lucide-react";

/**
 * Leave Summary — HR / AD see every employee, HOI sees only their reporting hierarchy.
 * All data and every permission check come from /api/leave-summary (existing LeaveRequest records).
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ALLOWED = ["HR", "AD", "HOI", "FOUNDER"];

const fmtDate = (ymd?: string) => {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "";
    const [y, m, d] = ymd.split("-").map(Number);
    return `${String(d).padStart(2, "0")} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};
const fmtAt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};
const dayLabel = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(n * 2 === Math.round(n * 2) ? 1 : 2)} ${n === 1 ? "Day" : "Days"}`;

const STATUS_STYLE: Record<string, string> = {
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
    OTHER: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone: string }) {
    return (
        <div className={`rounded-xl border px-3 py-2 ${tone}`}>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{label}</p>
            <p className="text-lg font-black leading-tight tabular-nums">{value}</p>
            {sub && <p className="text-[10px] opacity-70 tabular-nums">{sub}</p>}
        </div>
    );
}

function SummaryTiles({ s }: { s: any }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Total Leaves Taken" value={dayLabel(s.totalDaysTaken)} sub="approved days" tone="border-sky-500/20 bg-sky-500/10 text-sky-300" />
            <Stat label="Approved" value={s.approvedCount} sub={dayLabel(s.approvedDays)} tone="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
            <Stat label="Pending" value={s.pendingCount} sub={dayLabel(s.pendingDays)} tone="border-amber-500/20 bg-amber-500/10 text-amber-300" />
            <Stat label="Rejected" value={s.rejectedCount} sub={dayLabel(s.rejectedDays)} tone="border-red-500/20 bg-red-500/10 text-red-300" />
        </div>
    );
}

/** Compact version for the employee cards */
function CardTiles({ s }: { s: any }) {
    const cell = (label: string, value: string | number, sub: string, tone: string) => (
        <div className={`rounded-lg border px-2 py-1.5 text-center min-w-0 ${tone}`}>
            <p className="text-[8px] font-black uppercase tracking-wider opacity-80 truncate">{label}</p>
            <p className="text-base font-black leading-tight tabular-nums">{value}</p>
            <p className="text-[9px] opacity-70 tabular-nums truncate">{sub}</p>
        </div>
    );
    const n = (x: number) => (Number.isInteger(x) ? x : x.toFixed(1));
    return (
        <div className="grid grid-cols-4 gap-1.5">
            {cell("Taken", n(s.totalDaysTaken), s.totalDaysTaken === 1 ? "day" : "days", "border-sky-500/20 bg-sky-500/10 text-sky-300")}
            {cell("Approved", s.approvedCount, `${n(s.approvedDays)} d`, "border-emerald-500/20 bg-emerald-500/10 text-emerald-300")}
            {cell("Pending", s.pendingCount, `${n(s.pendingDays)} d`, "border-amber-500/20 bg-amber-500/10 text-amber-300")}
            {cell("Rejected", s.rejectedCount, `${n(s.rejectedDays)} d`, "border-red-500/20 bg-red-500/10 text-red-300")}
        </div>
    );
}

const AVATARS = ["bg-sky-300 text-sky-950", "bg-emerald-300 text-emerald-950", "bg-violet-300 text-violet-950", "bg-pink-300 text-pink-950", "bg-amber-300 text-amber-950", "bg-teal-300 text-teal-950"];
const hashOf = (s: string) => Array.from(s || "").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (n: string) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

function Tile({ label, value, sub, tone, title }: { label: string; value: any; sub: string; tone: string; title: string }) {
    return (
        <div title={title} className={`rounded-xl border px-1 py-2 xl:py-1.5 text-center min-w-0 ${tone}`}>
            <p className="text-[9px] font-black uppercase tracking-wider opacity-90">{label}</p>
            <p className="text-xl xl:text-lg font-black leading-tight tabular-nums text-current">{value}</p>
            <p className="text-[10px] opacity-75 tabular-nums">{sub}</p>
        </div>
    );
}

export default function LeaveSummaryPage() {
    const { user } = useAuth();
    const role = user?.role || "";
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    const [month, setMonth] = useState<string>("All");
    const [year, setYear] = useState<string>(String(now.getFullYear()));
    const [status, setStatus] = useState("All");
    const [college, setCollege] = useState("All");
    const [department, setDepartment] = useState("All");
    const [designation, setDesignation] = useState("All");
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [openId, setOpenId] = useState<string | null>(null);
    const [detail, setDetail] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [expanded, setExpanded] = useState<string | null>(null);

    // debounce the name / ID search
    const [draft, setDraft] = useState({ search: "", college: "All", department: "All", designation: "All", month: "All", year: String(new Date().getFullYear()), status: "All" });
    // the detail popup changes month / year / status directly — keep the filter panel in step
    useEffect(() => { setDraft(d => ({ ...d, month, year, status })); }, [month, year, status]);

    const params = (extra: Record<string, string> = {}) => new URLSearchParams({ month, year, status, college, department, designation, q, ...extra }).toString();

    const latest = useRef(0);
    const load = async () => {
        const no = ++latest.current;
        setLoading(true); setError("");
        try {
            const res = await fetch(`/api/leave-summary?${params()}`);
            const d = await res.json();
            if (no !== latest.current) return;
            if (!res.ok) throw new Error(d.error || "Could not load the leave summary");
            setData(d);
        } catch (e: any) {
            if (no === latest.current) setError(e.message);
        } finally {
            if (no === latest.current) setLoading(false);
        }
    };
    useEffect(() => { if (user && ALLOWED.includes(role)) load(); }, [user, month, year, status, college, department, designation, q]);

    // Detail of one employee — re-fetched whenever the month / year / status changes
    const latestDetail = useRef(0);
    useEffect(() => {
        if (!openId) { setDetail(null); return; }
        const no = ++latestDetail.current;
        setDetailLoading(true); setDetailError("");
        fetch(`/api/leave-summary?${new URLSearchParams({ month, year, status, employeeId: openId })}`)
            .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load leave details"); return d; })
            .then(d => { if (no === latestDetail.current) setDetail(d); })
            .catch(e => { if (no === latestDetail.current) setDetailError(e.message); })
            .finally(() => { if (no === latestDetail.current) setDetailLoading(false); });
    }, [openId, month, year, status]);

    const periodText = useMemo(() => {
        const m = month === "All" ? "All Months" : MONTHS[Number(month) - 1];
        return year === "All" ? (month === "All" ? "All time" : `${m} (all years)`) : `${m} ${year}`;
    }, [month, year]);

    if (!user) return null;
    if (!ALLOWED.includes(role)) return <div className="flex items-center justify-center h-[80vh] text-zinc-400">The leave summary is available to HR, AD and HOI only.</div>;

    const opts = data?.options || { colleges: [], departments: [], designations: [], years: [now.getFullYear()] };
    const years: number[] = Array.from(new Set<number>([...(opts.years || []), now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1])).sort((a, b) => b - a);
    const selectCls = "px-2.5 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-sky-500/50 max-w-[180px]";
    const field = (label: string, el: React.ReactNode) => (<div><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">{label}</p>{el}</div>);
    const lbl = "text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1.5";
    const ctl = "w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white outline-none focus:border-sky-500/50";
    const num = (x: number) => (Number.isInteger(x) ? x : x.toFixed(1));
    const totals = (data?.employees || []).reduce((t: any, e: any) => ({
        total: t.total + e.summary.totalRequests, approved: t.approved + e.summary.approvedCount,
        pending: t.pending + e.summary.pendingCount, rejected: t.rejected + e.summary.rejectedCount,
    }), { total: 0, approved: 0, pending: 0, rejected: 0 });
    const pct = (n: number) => (totals.total ? ((n / totals.total) * 100).toFixed(1) : "0");
    const pending = draft.search.trim() !== q || draft.college !== college || draft.department !== department || draft.designation !== designation || draft.month !== month || draft.year !== year || draft.status !== status;
    const applyFilters = () => {
        setQ(draft.search.trim()); setSearch(draft.search); setCollege(draft.college); setDepartment(draft.department);
        setDesignation(draft.designation); setMonth(draft.month); setYear(draft.year); setStatus(draft.status);
    };
    const resetFilters = () => {
        const d = { search: "", college: "All", department: "All", designation: "All", month: "All", year: String(now.getFullYear()), status: "All" };
        setDraft(d); setQ(""); setSearch(""); setCollege("All"); setDepartment("All"); setDesignation("All"); setMonth("All"); setYear(d.year); setStatus("All");
    };
    const quickStatus = (k: string) => { const v = status === k ? "All" : k; setStatus(v); setDraft(d => ({ ...d, status: v })); };
    const downloadReport = () => {
        const list = data?.employees || [];
        if (!list.length) return;
        const rows = list.map((e: any) => ({
            "Employee ID": e.id, Name: e.name, Designation: e.designation, Department: e.department, College: e.college,
            "Leave days taken": e.summary.totalDaysTaken, "Approved (requests)": e.summary.approvedCount, "Approved (days)": e.summary.approvedDays,
            "Pending (requests)": e.summary.pendingCount, "Pending (days)": e.summary.pendingDays,
            "Rejected (requests)": e.summary.rejectedCount, "Rejected (days)": e.summary.rejectedDays, "Total requests": e.summary.totalRequests,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map((r: any) => String(r[k] ?? "").length)) + 2 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leave Summary");
        XLSX.writeFile(wb, `Leave_Summary_${periodText.replace(/\s+/g, "_")}.xlsx`);
    };
    const approvedDates: string[] = detail?.history ? Array.from(new Set<string>(detail.history.filter((h: any) => h.statusGroup === "APPROVED").flatMap((h: any) => h.datesInPeriod))).sort() : [];

    return (
        <div className="max-w-[1400px] mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]">
            {/* Header */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center"><CalendarRange size={24} className="text-sky-400" /></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Leave Summary</h1>
                        <p className="text-sm text-zinc-400">
                            {data?.scope === "REPORTEES" ? "Employees in your reporting hierarchy" : "All employees"} · {periodText}
                            {data ? ` · ${data.employees.length} of ${data.totalInScope} employees` : ""}
                        </p>
                    </div>
                </div>
                <button onClick={load} className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-sm font-bold">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* Filters (applied with "Apply Filters") */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4" data-testid="leave-filters">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-3">
                    <div className="col-span-2 md:col-span-1">
                        <p className={lbl}>Employee name / ID</p>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={draft.search} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))} onKeyDown={e => e.key === "Enter" && applyFilters()}
                                placeholder="Search employee..." data-testid="leave-search" className={`${ctl} pl-9`} />
                        </div>
                    </div>
                    <div><p className={lbl}>College</p>
                        <select value={draft.college} onChange={e => setDraft(d => ({ ...d, college: e.target.value }))} className={ctl}>
                            <option value="All">All Colleges</option>
                            {opts.colleges.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select></div>
                    <div><p className={lbl}>Department</p>
                        <select value={draft.department} onChange={e => setDraft(d => ({ ...d, department: e.target.value }))} className={ctl}>
                            <option value="All">All</option>
                            {opts.departments.map((x: string) => <option key={x} value={x}>{x}</option>)}
                        </select></div>
                    <div><p className={lbl}>Designation</p>
                        <select value={draft.designation} onChange={e => setDraft(d => ({ ...d, designation: e.target.value }))} className={ctl}>
                            <option value="All">All</option>
                            {opts.designations.map((x: string) => <option key={x} value={x}>{x}</option>)}
                        </select></div>
                    <div><p className={lbl}>Month</p>
                        <select value={draft.month} onChange={e => setDraft(d => ({ ...d, month: e.target.value }))} className={ctl} data-testid="leave-month">
                            <option value="All">All Months</option>
                            {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                        </select></div>
                    <div><p className={lbl}>Year</p>
                        <select value={draft.year} onChange={e => setDraft(d => ({ ...d, year: e.target.value }))} className={ctl} data-testid="leave-year">
                            <option value="All">All Years</option>
                            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select></div>
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                    <div className="w-full md:w-60"><p className={lbl}>Leave Status</p>
                        <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} className={ctl} data-testid="leave-status">
                            <option value="All">All</option>
                            <option value="APPROVED">Approved</option>
                            <option value="PENDING">Pending</option>
                            <option value="REJECTED">Rejected</option>
                        </select></div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={applyFilters} data-testid="apply-filters" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold">
                            <Filter size={15} /> Apply Filters{pending ? " •" : ""}
                        </button>
                        <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-bold"><RotateCcw size={15} /> Reset</button>
                        <button onClick={downloadReport} data-testid="download-report" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-bold"><Download size={15} /> Download Report</button>
                    </div>
                </div>
            </div>

            {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"><AlertTriangle size={14} /> {error}</div>}

            {/* Summary — click a card to filter by that status */}
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="leave-stats">
                    {([
                        { key: "All", n: totals.total, label: "Total Leaves", sub: "in selected date range", icon: CalendarRange, tone: "border-sky-500/30 from-sky-500/10", ic: "bg-sky-500/20 text-sky-300", subc: "text-zinc-400" },
                        { key: "APPROVED", n: totals.approved, label: "Approved", sub: `${pct(totals.approved)}% of total`, icon: CheckCircle2, tone: "border-emerald-500/30 from-emerald-500/10", ic: "bg-emerald-500 text-zinc-950", subc: "text-emerald-300/80" },
                        { key: "PENDING", n: totals.pending, label: "Pending", sub: `${pct(totals.pending)}% of total`, icon: Clock, tone: "border-amber-500/30 from-amber-500/10", ic: "bg-amber-500 text-zinc-950", subc: "text-amber-300/80" },
                        { key: "REJECTED", n: totals.rejected, label: "Rejected", sub: `${pct(totals.rejected)}% of total`, icon: XCircle, tone: "border-red-500/30 from-red-500/10", ic: "bg-red-600 text-white", subc: "text-red-300/80" },
                    ]).map(c => (
                        <button key={c.key} onClick={() => quickStatus(c.key)} data-testid={`stat-${c.key}`}
                            className={`relative text-left flex items-center gap-4 p-4 sm:p-5 rounded-2xl border bg-gradient-to-br to-zinc-900/40 transition-all hover:brightness-125 ${c.tone} ${status === c.key ? "ring-2 ring-white/20" : ""}`}>
                            <span className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${c.ic}`}><c.icon size={22} /></span>
                            <span className="min-w-0">
                                <span className="block text-2xl font-black text-white tabular-nums leading-tight">{c.n}</span>
                                <span className="block text-sm font-bold text-zinc-100">{c.label}</span>
                                <span className={`block text-xs ${c.subc}`}>{c.sub}</span>
                            </span>
                            <span className="absolute right-4 top-4 w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-zinc-300"><ArrowRight size={14} /></span>
                        </button>
                    ))}
                </div>
            )}

            {/* Employees — one row each */}
            {loading && !data ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : !data?.employees?.length ? (
                <div className="text-center py-16 text-sm text-zinc-500 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
                    {data?.totalInScope === 0 ? (data?.scope === "REPORTEES" ? "No employees report to you." : "No employees found.") : "No employees match these filters."}
                </div>
            ) : (
                <div className={`space-y-3 ${loading ? "opacity-60" : ""}`} data-testid="leave-cards">
                    {data.employees.map((e: any) => {
                        const av = AVATARS[hashOf(e.id) % AVATARS.length];
                        const s = e.summary;
                        return (
                            <div key={e.id} data-testid="leave-card" onClick={() => { setOpenId(e.id); setExpanded(null); }}
                                className="cursor-pointer flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-3 p-4 xl:px-4 xl:py-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-sky-500/30 hover:bg-zinc-900/80 transition-all">
                                {/* Person */}
                                <div className="flex items-center gap-4 xl:gap-3 min-w-0 xl:flex-1">
                                    <span className={`shrink-0 w-14 h-14 xl:w-12 xl:h-12 rounded-full flex items-center justify-center text-lg xl:text-base font-black ${av}`}>{initials(e.name)}</span>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-base font-black text-white truncate">{e.name}</h3>
                                        <p className="text-[11px] text-zinc-500 font-mono">{e.id}</p>
                                        <div className="flex flex-wrap xl:flex-nowrap items-center gap-x-5 xl:gap-x-3 gap-y-1 mt-1 text-xs text-zinc-400 min-w-0">
                                            <span className="flex items-center gap-1.5 min-w-0"><Landmark size={13} className="shrink-0 text-zinc-500" /><span className="truncate">{e.designation || "—"}{e.department ? ` · ${e.department}` : ""}</span></span>
                                            <span className="flex items-center gap-1.5 min-w-0 shrink-0 xl:shrink"><MapPin size={13} className="shrink-0 text-zinc-500" /><span className="truncate">{e.college}</span></span>
                                        </div>
                                    </div>
                                </div>
                                {/* Numbers */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 xl:contents">
                                <div className="grid grid-cols-4 gap-2 sm:flex-1 xl:flex-none xl:w-[19rem] 2xl:w-[23rem] xl:gap-1.5">
                                    <Tile label="Taken" value={num(s.totalDaysTaken)} sub={s.totalDaysTaken === 1 ? "day" : "days"} tone="border-sky-500/30 bg-sky-500/10 text-sky-300" title="Approved leave days actually taken" />
                                    <Tile label="Approved" value={s.approvedCount} sub={`${num(s.approvedDays)} d`} tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" title={`${s.approvedCount} approved request(s), ${num(s.approvedDays)} day(s)`} />
                                    <Tile label="Pending" value={s.pendingCount} sub={`${num(s.pendingDays)} d`} tone="border-amber-500/30 bg-amber-500/10 text-amber-300" title={`${s.pendingCount} pending request(s), ${num(s.pendingDays)} day(s)`} />
                                    <Tile label="Rejected" value={s.rejectedCount} sub={`${num(s.rejectedDays)} d`} tone="border-red-500/30 bg-red-500/10 text-red-300" title={`${s.rejectedCount} rejected request(s), ${num(s.rejectedDays)} day(s)`} />
                                </div>
                                {/* Actions */}
                                <div className="flex items-center justify-between sm:justify-end gap-3 xl:gap-2 shrink-0">
                                    <span className="text-xs font-bold text-zinc-300 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 xl:px-2.5 py-1.5 whitespace-nowrap">{s.totalRequests} request{s.totalRequests === 1 ? "" : "s"}</span>
                                    <button onClick={ev => { ev.stopPropagation(); setOpenId(e.id); setExpanded(null); }} data-testid="view-details"
                                        className="flex items-center gap-2 px-4 xl:px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-sm xl:text-xs font-bold whitespace-nowrap">
                                        View Details <ArrowRight size={15} />
                                    </button>
                                </div>
                                </div>
                            </div>
                        );
                    })}
                    <p className="text-[11px] text-zinc-500 px-1">In each row: big number = requests, small number = their days. <span className="text-sky-300">Taken</span> = approved leave days.</p>
                </div>
            )}

            {/* Employee leave details */}
            {openId && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={() => setOpenId(null)}>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="leave-detail">
                        <div className="sticky top-0 z-10 bg-zinc-900 p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Employee Leave Details</p>
                                <h3 className="text-lg font-bold text-white truncate">{detail?.employee?.name || data?.employees?.find((x: any) => x.id === openId)?.name}</h3>
                                {detail?.employee && (
                                    <p className="text-xs text-zinc-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                        <span className="flex items-center gap-1"><IdCard size={11} /> {detail.employee.id}</span>
                                        <span>{detail.employee.designation || "—"}</span>
                                        {detail.employee.department && <span>Dept: {detail.employee.department}</span>}
                                        <span className="flex items-center gap-1"><Building2 size={11} /> {detail.employee.college}</span>
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setOpenId(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex flex-wrap items-end gap-3">
                                {field("Month", (
                                    <select value={month} onChange={e => setMonth(e.target.value)} className={selectCls} data-testid="detail-month">
                                        <option value="All">All Months</option>
                                        {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                                    </select>
                                ))}
                                {field("Year", (
                                    <select value={year} onChange={e => setYear(e.target.value)} className={selectCls} data-testid="detail-year">
                                        <option value="All">All Years</option>
                                        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                                    </select>
                                ))}
                                {field("Status", (
                                    <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                                        <option value="All">All</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="REJECTED">Rejected</option>
                                    </select>
                                ))}
                                <span className="text-xs text-zinc-400 pb-2">Selected: <span className="text-white font-bold">{periodText}</span></span>
                                {detailLoading && <span className="w-4 h-4 mb-2.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />}
                            </div>

                            {detailError && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"><AlertTriangle size={14} /> {detailError}</div>}

                            {detail?.employee && <SummaryTiles s={detail.employee.summary} />}

                            {detail && approvedDates.length > 0 && (
                                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">
                                        Approved leave dates · {periodText} ({dayLabel(detail.employee.summary.approvedDays)})
                                    </p>
                                    <div className="flex flex-wrap gap-1.5" data-testid="approved-dates">
                                        {approvedDates.map(d => <span key={d} className="px-2 py-0.5 rounded-md bg-zinc-950/60 border border-emerald-500/20 text-[11px] text-emerald-200 tabular-nums">{fmtDate(d)}</span>)}
                                    </div>
                                </div>
                            )}

                            {detail && (detail.history?.length ? (
                                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                                    <div className="overflow-x-auto [contain:inline-size]">
                                        <table className="w-full text-xs min-w-[640px]" data-testid="leave-history">
                                            <thead className="bg-zinc-800/60 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                <tr>
                                                    <th className="text-left px-3 py-2.5">Leave Date</th>
                                                    <th className="text-left px-3 py-2.5">Leave Type</th>
                                                    <th className="text-left px-3 py-2.5">Duration</th>
                                                    <th className="text-left px-3 py-2.5">Status</th>
                                                    <th className="px-3 py-2.5 w-10" />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800">
                                                {detail.history.map((h: any) => {
                                                    const isOpen = expanded === h.id;
                                                    const multi = h.allDates.length > 1;
                                                    const split = h.daysInPeriod !== h.totalDays;
                                                    return (
                                                        <FragmentRow key={h.id}>
                                                            <tr className="hover:bg-white/[0.02] cursor-pointer" onClick={() => setExpanded(isOpen ? null : h.id)} data-testid="leave-row">
                                                                <td className="px-3 py-2.5 text-white font-semibold tabular-nums whitespace-nowrap">
                                                                    {multi ? `${fmtDate(h.startDate)} – ${fmtDate(h.endDate)}` : fmtDate(h.startDate)}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-zinc-300">{h.type}{h.leaveType ? <span className="text-zinc-500"> · {h.leaveType}</span> : null}</td>
                                                                <td className="px-3 py-2.5 text-zinc-300 tabular-nums whitespace-nowrap">
                                                                    {dayLabel(h.totalDays)}{split ? <span className="text-zinc-500"> ({dayLabel(h.daysInPeriod)} in period)</span> : null}
                                                                </td>
                                                                <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[h.statusGroup]}`}>{h.status}</span></td>
                                                                <td className="px-3 py-2.5 text-zinc-500">{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                                                            </tr>
                                                            {isOpen && (
                                                                <tr className="bg-zinc-950/40">
                                                                    <td colSpan={5} className="px-3 py-3 space-y-2.5">
                                                                        {multi && (
                                                                            <div>
                                                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1"><CalendarDays size={11} /> Dates covered ({h.allDates.length})</p>
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {h.allDates.map((d: string) => (
                                                                                        <span key={d} className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums border ${h.datesInPeriod.includes(d) ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-zinc-800 text-zinc-500"}`}>{fmtDate(d)}</span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Reason</p>
                                                                            <p className="text-xs text-zinc-200 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.reason || "—"}</p>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                                            <ApprovalLine label="HOI" status={h.hoiApproval} by={h.hoiApprover} at={h.hoiApprovedAt} />
                                                                            <ApprovalLine label="HR" status={h.hrApproval} by={h.hrApprover} at={h.hrApprovedAt} />
                                                                        </div>
                                                                        {h.approvedByName && <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Approved by {h.approvedByName}{h.approvedByRole ? ` (${h.approvedByRole})` : ""}{h.approvedAt ? ` · ${fmtAt(h.approvedAt)}` : ""}</p>}
                                                                        {h.rejectedByName && <p className="text-[11px] text-red-400 flex items-center gap-1"><XCircle size={11} /> Rejected by {h.rejectedByName}{h.rejectedByRole ? ` (${h.rejectedByRole})` : ""}{h.rejectedAt ? ` · ${fmtAt(h.rejectedAt)}` : ""}</p>}
                                                                        {h.reasonForAction && <p className="text-[11px] text-zinc-400">Remarks: <span className="text-zinc-200">{h.reasonForAction}</span></p>}
                                                                        <p className="text-[10px] text-zinc-500 flex flex-wrap gap-x-3">
                                                                            {h.appliedAt && <span className="flex items-center gap-1"><Clock size={10} /> Applied {fmtAt(h.appliedAt)}</span>}
                                                                            {h.classification && <span>{h.classification}</span>}
                                                                            {h.lossOfPayDays > 0 && <span className="text-amber-400">Loss of pay: {dayLabel(h.lossOfPayDays)}</span>}
                                                                            {h.proofUrls?.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">Proof {i + 1}</a>)}
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </FragmentRow>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-sm text-zinc-500 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl" data-testid="leave-empty">
                                    {month !== "All" ? "No leave records found for the selected month." : "No leave records found for the selected period."}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

function ApprovalLine({ label, status, by, at }: { label: string; status?: string; by?: string; at?: string }) {
    const tone = status === "Approved" ? "text-emerald-400" : status === "Rejected" ? "text-red-400" : "text-amber-400";
    return (
        <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">{label} approval: </span>
            <span className={`font-bold ${tone}`}>{status || "—"}</span>
            {by && <span className="text-zinc-400"> · {by}</span>}
            {at && <span className="text-zinc-500"> · {fmtAt(at)}</span>}
        </div>
    );
}