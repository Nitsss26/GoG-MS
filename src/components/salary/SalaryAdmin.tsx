"use client";

/**
 * Employee Salary Management (HR, HR Executive: manage · Founders: view only).
 * One module, two views: Employees | Correction Tickets.
 * Every figure comes from the same calculation the employee sees (src/lib/payable-days.ts + HR corrections).
 */
import { useCallback, useEffect, useState } from "react";
import MonetaryPenalties from "@/components/salary/MonetaryPenalties";
import {
    Wallet, Users, CheckCircle2, Ban, MessageSquare, AlertTriangle, Search, X, Loader2, ChevronLeft, ChevronRight,
    ArrowLeft, Eye, Upload, Clock, RotateCcw, Lock, ArrowUpDown, History, ShieldCheck, Home, Laptop,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { exportEmployeeMonth, exportEmployeeList } from "@/lib/salary-export";
import { Download, FileSpreadsheet } from "lucide-react";
import { useMinWidth } from "@/lib/use-min-width";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSidebarCounts, badgeText } from "@/lib/use-sidebar-counts";
import { HALF_DAY_REASONS, PENALTY_REASONS, MAX_PENALTY_AMOUNT } from "@/lib/salary-adjustment-options";

/** PDF + Excel buttons */
function DownloadButtons({ onPdf, onXlsx, disabled }: { onPdf: () => Promise<void>; onXlsx: () => Promise<void>; disabled?: boolean }) {
    const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
    const run = async (k: string, f: () => Promise<void>) => { setBusy(k); setErr(""); try { await f(); } catch (e: any) { setErr(e?.message || "Could not create the file"); } finally { setBusy(""); } };
    return (
        <div className="flex items-center gap-1.5">
            <button onClick={() => run("pdf", onPdf)} disabled={disabled || !!busy} data-testid="dl-pdf" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-zinc-950 text-[10px] font-black uppercase tracking-wider disabled:opacity-50">{busy === "pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF</button>
            <button onClick={() => run("xlsx", onXlsx)} disabled={disabled || !!busy} data-testid="dl-xlsx" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50">{busy === "xlsx" ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} Excel</button>
            {err && <span className="text-[10px] text-red-400">{err}</span>}
        </div>
    );
}

const TICKET_STATUSES = ["Open", "Under Review", "Additional Information Required", "Approved", "Rejected", "Resolved"];
const T_STYLE: Record<string, string> = {
    "Open": "bg-sky-500/10 text-sky-300 border-sky-500/30",
    "Under Review": "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    "Additional Information Required": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Approved": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    "Rejected": "bg-red-500/10 text-red-300 border-red-500/30",
    "Resolved": "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
};
const PAY: Record<string, string> = {
    "Payable": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", "Non-Payable": "bg-red-500/10 text-red-300 border-red-500/30",
    "Partly Payable": "bg-amber-500/10 text-amber-300 border-amber-500/30", "Upcoming": "bg-zinc-800 text-zinc-400 border-zinc-700", "Not Employed": "bg-zinc-900 text-zinc-500 border-zinc-800",
};
const dmy = (ymd?: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");
const monthText = (m?: string) => { if (!m) return "—"; const [y, mm] = m.split("-").map(Number); return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }); };
type AdjType = "FULL" | "HALF" | "PENALTY";
const inr = (v: number) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const n = (v: number | undefined | null) => { const x = Number(v); return !Number.isFinite(x) ? "0" : Number.isInteger(x) ? String(x) : x.toFixed(1); };
const months = () => { const out: string[] = []; const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })); for (let i = 0; i < 18; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); } return out; };
const Badge = ({ s, map = T_STYLE }: { s: string; map?: Record<string, string> }) => <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap ${map[s] || "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>{s}</span>;
const Msg = ({ m, onClose }: { m: { type: string; text: string } | null; onClose: () => void }) => !m ? null : (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs ${m.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`} data-testid="sm-msg">
        {m.type === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {m.text}
        <button onClick={onClose} className="ml-auto"><X size={13} /></button>
    </div>
);

export default function SalaryAdmin() {
    const [tab, setTab] = useState<"employees" | "tickets">("employees");
    const [month, setMonth] = useState(months()[0]);
    const [employee, setEmployee] = useState<string>("");
    const [ticketCtx, setTicketCtx] = useState<string>("");
    const [openTicket, setOpenTicket] = useState("");
    const [ticketStatus, setTicketStatus] = useState("All");
    const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
    // pending correction tickets (same count as the red sidebar badge; refreshes after every change)
    const { user } = useAuth();
    const counts = useSidebarCounts(user?.id, usePathname() || "");
    const pendingTickets = counts["/hr/salary-management"] || 0;
    useEffect(() => {
        try {
            const q = new URLSearchParams(window.location.search);
            if (q.get("tab") === "tickets") setTab("tickets");
            if (q.get("ticket")) setOpenTicket(q.get("ticket")!);
            if (q.get("employee")) setEmployee(q.get("employee")!);
            if (/^\d{4}-\d{2}$/.test(q.get("month") || "")) setMonth(q.get("month")!);
        } catch { /* ignore */ }
    }, []);
    const openEmployee = (id: string, m?: string, ticketId?: string) => { setEmployee(id); if (m) setMonth(m); setTicketCtx(ticketId || ""); setTab("employees"); window.scrollTo({ top: 0 }); };

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto w-full [contain:inline-size]" data-testid="salary-management">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"><Wallet size={26} className="text-primary" /> Employee Salary Management</h1>
                    <p className="text-zinc-500 mt-1 text-sm">Payable days of every employee, correction tickets and HR payable-day corrections. Attendance and leave records are never changed — corrections are kept as separate, audited adjustments.</p>
                </div>
                <div className="flex gap-1.5 p-1 rounded-xl bg-zinc-900/60 border border-zinc-800 w-fit" role="tablist">
                    {[["employees", "Employees", Users], ["tickets", "Correction Tickets", MessageSquare]].map(([k, l, I]: any) => (
                        <button key={k} role="tab" aria-selected={tab === k} data-testid={`sm-tab-${k}`} onClick={() => { setTab(k); if (k === "employees") setEmployee(""); }}
                            aria-label={k === "tickets" && pendingTickets > 0 ? `${l} (${pendingTickets} pending)` : undefined}
                            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider ${tab === k ? "bg-primary text-white" : "text-zinc-400 hover:text-white"}`}><I size={13} /> {l}
                            {k === "tickets" && pendingTickets > 0 && (
                                <span data-testid="sm-tickets-badge" aria-hidden="true" className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg ring-2 ring-[#0a0a0b] normal-case tracking-normal">{badgeText(pendingTickets)}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
            <Msg m={msg} onClose={() => setMsg(null)} />
            {tab === "employees" && !employee && <EmployeeList month={month} setMonth={setMonth} onView={id => openEmployee(id)} onTickets={st => { setTicketStatus(st); setTab("tickets"); window.scrollTo({ top: 0 }); }} />}
            {tab === "employees" && employee && <EmployeeDetail id={employee} month={month} setMonth={setMonth} ticketId={ticketCtx} onBack={() => { setEmployee(""); setTicketCtx(""); }} onMsg={setMsg} onOpenTicket={(t) => { setOpenTicket(t); setTab("tickets"); }} />}
            {tab === "tickets" && <TicketsPanel key={ticketStatus} initialStatus={ticketStatus} openId={openTicket} setOpenId={setOpenTicket} onMsg={setMsg} onOpenEmployee={openEmployee} />}
        </div>
    );
}

// ─────────────────────────── Employees list ───────────────────────────
function EmployeeList({ month, setMonth, onView, onTickets }: { month: string; setMonth: (m: string) => void; onView: (id: string) => void; onTickets: (status: string) => void }) {
    const wide = useMinWidth(1280); // table on laptop / desktop, cards on phone / tablet
    const [q, setQ] = useState(""); const [dept, setDept] = useState(""); const [college, setCollege] = useState(""); const [desig, setDesig] = useState("");
    const [penaltyOnly, setPenaltyOnly] = useState(false); const [detail, setDetail] = useState<"" | "applied" | "allotted" | "corrections">("");
    const [pending, setPending] = useState(false); const [sort, setSort] = useState("name"); const [dir, setDir] = useState("asc"); const [page, setPage] = useState(1);
    const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const p = new URLSearchParams({ month, page: String(page), sort, dir });
            if (q.trim()) p.set("q", q.trim()); if (dept) p.set("dept", dept); if (college) p.set("college", college); if (desig) p.set("designation", desig); if (pending) p.set("tickets", "pending"); if (penaltyOnly) p.set("penalty", "1");
            const res = await fetch(`/api/hr/salary-management?${p}`, { cache: "no-store" });
            const d = await res.json(); if (!res.ok) throw new Error(d.error || "Could not load"); setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [month, page, sort, dir, q, dept, college, desig, pending, penaltyOnly]);
    useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
    useEffect(() => { setPage(1); }, [month, q, dept, college, desig, pending, penaltyOnly, sort, dir]);
    const s = data?.summary;
    // download: every employee that matches the filters (not only this page)
    const downloadList = async (kind: "pdf" | "xlsx") => {
        const p = new URLSearchParams({ month, sort, dir, all: "1" });
        if (q.trim()) p.set("q", q.trim()); if (dept) p.set("dept", dept); if (college) p.set("college", college); if (desig) p.set("designation", desig); if (pending) p.set("tickets", "pending"); if (penaltyOnly) p.set("penalty", "1");
        const res = await fetch(`/api/hr/salary-management?${p}`, { cache: "no-store" });
        const d = await res.json(); if (!res.ok) throw new Error(d.error || "Could not load");
        await exportEmployeeList(kind, { rows: d.rows, monthLabel: d.monthLabel, month: d.month, summary: d.summary });
    };
    // Every summary card is clickable: it filters the list, switches to the tickets or opens the matching list
    const resetFilters = () => { setQ(""); setDept(""); setCollege(""); setDesig(""); setPending(false); setPenaltyOnly(false); setSort("name"); setDir("asc"); };
    const cards: { key: string; label: string; value: any; sub?: string; icon: any; tone: string; active?: boolean; onClick: () => void }[] = [
        { key: "employees", label: "Total Employees", value: s?.totalEmployees, icon: Users, tone: "border-sky-500/25 bg-sky-500/[0.06] text-sky-300", onClick: resetFilters },
        { key: "applied", label: "Applied WFH", value: s ? (s.wfhApplied ?? 0) : undefined, sub: s ? `${n(s.wfhAppliedDays)} day(s) this month` : "", icon: Laptop, tone: "border-teal-500/25 bg-teal-500/[0.06] text-teal-300", onClick: () => setDetail("applied") },
        { key: "allotted", label: "Allotted WFH", value: s && `${n(s.wfhAllotted)} d`, sub: s ? `${s.wfhAllottedEmployees ?? 0} employee(s)` : "", icon: Home, tone: "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-300", onClick: () => setDetail("allotted") },
        { key: "pending", label: "Pending Tickets", value: s?.pendingTickets, icon: MessageSquare, tone: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300", onClick: () => onTickets("Pending") },
        { key: "resolved", label: "Resolved Tickets", value: s?.resolvedTickets, icon: CheckCircle2, tone: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300", onClick: () => onTickets("Resolved") },
        { key: "penalty", label: "Penalty Deductions", value: s && `${n(s.totalPenaltyDays)} d`, sub: penaltyOnly ? "Showing employees with penalties" : "", icon: AlertTriangle, tone: "border-red-500/25 bg-red-500/[0.06] text-red-300", active: penaltyOnly, onClick: () => { const on = !penaltyOnly; setPenaltyOnly(on); if (on) { setSort("penalty"); setDir("desc"); } } },
        { key: "corrections", label: "HR Corrections", value: s?.corrections, icon: ShieldCheck, tone: "border-violet-500/25 bg-violet-500/[0.06] text-violet-300", onClick: () => setDetail("corrections") },
    ];
    const field = "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white min-w-0";
    const th = (k: string, l: string) => (
        <button onClick={() => { if (sort === k) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(k); setDir(k === "name" ? "asc" : "desc"); } }} className="flex items-center gap-1 uppercase tracking-widest hover:text-white">
            {l} <ArrowUpDown size={10} className={sort === k ? "text-primary" : "opacity-40"} />
        </button>
    );
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="sm-cards">
                {cards.map(c => (
                    <button key={c.key} type="button" onClick={c.onClick} data-testid={`sm-card-${c.key}`}
                        className={`text-left rounded-2xl border p-3.5 transition-all hover:brightness-125 hover:-translate-y-0.5 cursor-pointer ${c.tone} ${c.active ? "ring-2 ring-red-400/60" : ""}`}>
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"><c.icon size={12} /> {c.label}</div>
                        <p className="text-xl font-black text-white mt-1.5 tabular-nums" data-testid="sm-card-value">{c.value ?? "—"}</p>
                        {c.sub && <p className="text-[9px] text-zinc-400 mt-0.5">{c.sub}</p>}
                    </button>
                ))}
            </div>
            {detail && data && <SummaryDetail kind={detail} data={data} onClose={() => setDetail("")} onView={id => { setDetail(""); onView(id); }} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                <div className="relative lg:col-span-2"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Employee name or ID" className={`${field} w-full pl-8`} data-testid="sm-search" /></div>
                <select value={month} onChange={e => setMonth(e.target.value)} className={field} data-testid="sm-month">{months().map(m => <option key={m} value={m}>{monthText(m)}</option>)}</select>
                <select value={dept} onChange={e => setDept(e.target.value)} className={field}><option value="">All departments</option>{(data?.filters?.depts || []).map((x: string) => <option key={x}>{x}</option>)}</select>
                <select value={college} onChange={e => setCollege(e.target.value)} className={field}><option value="">All colleges</option>{(data?.filters?.colleges || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select value={desig} onChange={e => setDesig(e.target.value)} className={field}><option value="">All designations</option>{(data?.filters?.designations || []).map((x: string) => <option key={x}>{x}</option>)}</select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-zinc-400 w-fit cursor-pointer"><input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} className="accent-amber-500" data-testid="sm-pending" /> Only employees with pending tickets</label>
                <DownloadButtons disabled={!data} onPdf={() => downloadList("pdf")} onXlsx={() => downloadList("xlsx")} />
            </div>
            {error && <div className="rounded-xl px-4 py-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                {/* Phone / tablet: cards */}
                <div style={{ display: wide ? "none" : undefined }} className="divide-y divide-zinc-800/70" data-testid="sm-cards">
                    {loading && !data ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                        : (data?.rows || []).length === 0 ? <p className="py-12 text-center text-xs text-zinc-500">No employees match.</p>
                            : data.rows.map((r: any) => (
                                <div key={r.id} className="p-4 space-y-3 text-xs" data-testid="sm-card">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-white [overflow-wrap:anywhere]">{r.name}</p>
                                            <p className="text-[10px] text-zinc-500 [overflow-wrap:anywhere]">{r.id}{r.designation ? ` · ${r.designation}` : ""}</p>
                                            <p className="text-[10px] text-zinc-500 [overflow-wrap:anywhere]">{r.dept || "—"} · {r.locationName || "—"}</p>
                                        </div>
                                        <button onClick={() => onView(r.id)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase"><Eye size={12} /> View</button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Payable</p><p className="font-bold text-emerald-300 tabular-nums">{n(r.payableDays)}</p>{r.correctedDays ? <p className="text-[9px] font-semibold text-violet-300">+{n(r.correctedDays)} HR</p> : null}{r.hrDeductedDays ? <p className="text-[9px] font-semibold text-red-300">−{n(r.hrDeductedDays)} HR</p> : null}</div>
                                        <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Non-Pay</p><p className="font-bold text-red-300 tabular-nums">{n(r.nonPayableDays)}</p></div>
                                        <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Penalty</p><p className="text-zinc-300 tabular-nums">{r.penaltyDays ? `${n(r.penaltyDays)} d` : "—"}</p></div>
                                        <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Tickets</p>{r.tickets.pending ? <p className="text-amber-300 font-bold">{r.tickets.pending} Pending</p> : r.tickets.resolved ? <p className="text-emerald-300">{r.tickets.resolved} Resolved</p> : <p className="text-zinc-600">0</p>}</div>
                                    </div>
                                </div>
                            ))}
                </div>
                <div style={{ display: wide ? undefined : "none" }} className="overflow-x-auto">
                    <table className="w-full table-fixed text-xs min-w-[880px]" data-testid="sm-table">
                        <thead><tr className="bg-zinc-800/40 text-[10px] text-zinc-400 text-left">
                            <th className="py-3 px-3 w-[24%]">{th("name", "Employee")}</th><th className="py-3 px-3 w-[13%] uppercase tracking-widest">Department</th><th className="py-3 px-3 w-[14%] uppercase tracking-widest">College</th>
                            <th className="py-3 px-3 w-[10%]">{th("payable", "Payable")}</th><th className="py-3 px-3 w-[10%]">{th("nonPayable", "Non-Pay")}</th><th className="py-3 px-3 w-[10%]">{th("penalty", "Penalty")}</th>
                            <th className="py-3 px-3 w-[11%]">{th("tickets", "Tickets")}</th><th className="py-3 px-3 w-[8%] text-right uppercase tracking-widest">Action</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {loading && !data ? <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="animate-spin inline text-primary" /></td></tr>
                                : (data?.rows || []).length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-zinc-500">No employees match.</td></tr>
                                    : data.rows.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-white/[0.02]" data-testid="sm-row">
                                            <td className="py-3 px-3 min-w-0"><p className="font-bold text-white truncate">{r.name}</p><p className="text-[10px] text-zinc-500 truncate">{r.id}{r.designation ? ` · ${r.designation}` : ""}</p></td>
                                            <td className="py-3 px-3 text-zinc-300 truncate">{r.dept || "—"}</td>
                                            <td className="py-3 px-3 text-zinc-300 truncate">{r.locationName || "—"}</td>
                                            <td className="py-3 px-3 font-bold text-emerald-300 tabular-nums" data-testid="sm-payable">{n(r.payableDays)}{r.correctedDays ? <span className="block text-[9px] font-semibold text-violet-300">+{n(r.correctedDays)} HR</span> : null}{r.hrDeductedDays ? <span className="block text-[9px] font-semibold text-red-300">−{n(r.hrDeductedDays)} HR</span> : null}</td>
                                            <td className="py-3 px-3 font-bold text-red-300 tabular-nums">{n(r.nonPayableDays)}</td>
                                            <td className="py-3 px-3 text-zinc-300 tabular-nums">{r.penaltyDays ? `${n(r.penaltyDays)} d` : "—"}</td>
                                            <td className="py-3 px-3">{r.tickets.pending ? <Badge s={`${r.tickets.pending} Pending`} map={{ [`${r.tickets.pending} Pending`]: T_STYLE["Additional Information Required"] }} /> : r.tickets.resolved ? <span className="text-[10px] text-emerald-300">{r.tickets.resolved} Resolved</span> : <span className="text-zinc-600">0</span>}</td>
                                            <td className="py-3 px-3 text-right"><button onClick={() => onView(r.id)} data-testid="sm-view" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase"><Eye size={12} /> View</button></td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
                {data && <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500">
                    <span>{data.total} employee{data.total === 1 ? "" : "s"} · {data.monthLabel}{data.pages > 1 ? ` · page ${data.page} of ${data.pages}` : ""}{!data.canEdit ? " · view only" : ""}</span>
                    {data.pages > 1 && <div className="flex gap-1.5">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg bg-zinc-800 disabled:opacity-40"><ChevronLeft size={14} /></button>
                        <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg bg-zinc-800 disabled:opacity-40"><ChevronRight size={14} /></button>
                    </div>}
                </div>}
            </div>
        </div>
    );
}

// ─────────────────────────── Summary card lists (Applied WFH / Allotted WFH / HR Corrections) ───────────────────────────
function SummaryDetail({ kind, data, onClose, onView }: { kind: "applied" | "allotted" | "corrections"; data: any; onClose: () => void; onView: (id: string) => void }) {
    const d = data?.details || {}; // empty lists if the server is still the old version
    const title = kind === "applied" ? "Applied WFH" : kind === "allotted" ? "Allotted WFH" : "HR Corrections";
    const list: any[] = kind === "applied" ? d.wfhApplied || [] : kind === "allotted" ? d.wfhAllotted || [] : d.corrections || [];
    const ST: Record<string, string> = { Approved: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", Pending: "text-amber-300 border-amber-500/30 bg-amber-500/10", Rejected: "text-red-300 border-red-500/30 bg-red-500/10" };
    return (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900" onClick={e => e.stopPropagation()} data-testid={`sm-detail-${kind}`}>
                <div className="flex items-start justify-between gap-2 p-5 pb-3 border-b border-zinc-800">
                    <div><p className="text-base font-bold text-white">{title} · {data.monthLabel}</p>
                        <p className="text-[11px] text-zinc-500">{kind === "applied" ? "Work From Home applications that fall in this month (all statuses except cancelled)." : kind === "allotted" ? "Days set as Work From Home in the employee's work schedule (HR / manager)." : "Active HR payable-day corrections of this month."}</p></div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto p-3 space-y-2">
                    {!list.length && <p className="py-10 text-center text-xs text-zinc-500">Nothing in {data.monthLabel}.</p>}
                    {list.map((x: any, i: number) => (
                        <button key={x.id || `${x.employeeId}-${i}`} onClick={() => onView(x.employeeId)} data-testid="sm-detail-row"
                            className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-zinc-600 px-3 py-2.5 text-xs">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-white [overflow-wrap:anywhere]">{x.employeeName} <span className="text-[10px] font-normal text-zinc-500">{x.employeeId}</span></p>
                                {kind === "applied" && <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md border ${ST[x.status] || "text-zinc-300 border-zinc-700"}`}>{x.status}</span>}
                                {kind === "allotted" && <span className="shrink-0 text-[11px] font-black text-cyan-300">{x.days} day(s)</span>}
                                {kind === "corrections" && <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md border ${x.direction === "TO_NON_PAYABLE" ? "text-red-300 border-red-500/30 bg-red-500/10" : "text-violet-300 border-violet-500/30 bg-violet-500/10"}`}>{x.direction === "TO_NON_PAYABLE" ? "Non-Payable" : "Payable"}</span>}
                            </div>
                            {kind === "applied" && <p className="text-zinc-400 mt-0.5">{dmy(x.startDate)}{x.endDate !== x.startDate ? ` → ${dmy(x.endDate)}` : ""} · {x.type} · {n(x.daysInMonth)} day(s) this month{x.approverName ? ` · by ${x.approverName}` : ""}{x.reason ? <span className="block text-zinc-500 [overflow-wrap:anywhere]">{x.reason}</span> : null}</p>}
                            {kind === "allotted" && <p className="text-zinc-400 mt-0.5 [overflow-wrap:anywhere]">{x.weekdays.length ? `Every ${x.weekdays.join(", ")} · ` : ""}{x.dates.map((t: string) => t.slice(8)).join(", ")}{x.assignedBy ? ` · set by ${x.assignedBy}` : ""}</p>}
                            {kind === "corrections" && <p className="text-zinc-400 mt-0.5 [overflow-wrap:anywhere]">{dmy(x.date)} · {x.category}{x.by ? ` · ${x.by}` : ""}{x.reason ? <span className="block text-zinc-500">{x.reason}</span> : null}</p>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────── Employee detail ───────────────────────────
function EmployeeDetail({ id, month, setMonth, ticketId, onBack, onMsg, onOpenTicket }: { id: string; month: string; setMonth: (m: string) => void; ticketId?: string; onBack: () => void; onMsg: (m: any) => void; onOpenTicket: (t: string) => void }) {
    const wide = useMinWidth(1280); // table on laptop / desktop, cards on phone / tablet
    const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const [onlyIssues, setOnlyIssues] = useState(false); const [dialog, setDialog] = useState<any>(null); const [reverse, setReverse] = useState<any>(null); const [view, setView] = useState<any>(null);
    const [penEdit, setPenEdit] = useState<any>(null); const [penView, setPenView] = useState<any>(null);
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const res = await fetch(`/api/hr/salary-management/employee?id=${encodeURIComponent(id)}&month=${month}`, { cache: "no-store" });
            const d = await res.json(); if (!res.ok) throw new Error(d.error || "Could not load"); setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [id, month]);
    useEffect(() => { load(); }, [load]);
    const c = data?.calc, e = data?.employee;
    const days = (c?.days || []).filter((d: any) => !onlyIssues || d.correctable || d.correction || ["Non-Payable", "Partly Payable"].includes(d.payableStatus) || d.penalties.length);
    // HOI only: assigned location(s) of the day + the actual clock-in location (field visit: address, GPS, reason)
    const isHoi = e?.role === "HOI";
    const HoiLoc = ({ d }: { d: any }) => {
        const l = d.hoiLocation;
        if (!l) return <span className="text-zinc-600">—</span>;
        return (
            <div className="space-y-0.5 min-w-0" data-testid="sm-hoi-loc">
                <p className="[overflow-wrap:anywhere]"><span className="text-zinc-500">Assigned:</span> <span className="text-zinc-200">{l.assigned || "—"}</span></p>
                {l.actual ? (
                    <p className="[overflow-wrap:anywhere]"><span className="text-zinc-500">Actual:</span>{" "}
                        <span className={l.actualType === "Field Visit" ? "text-amber-300 font-semibold" : l.matched === false ? "text-orange-300" : "text-emerald-300"}>{l.actual}</span>
                        {l.actualType === "Field Visit" && <span className="text-amber-300/80"> (Field Visit / Meeting)</span>}
                        {typeof l.lat === "number" && <span className="text-zinc-500 tabular-nums"> · {l.lat.toFixed(5)}, {l.lng.toFixed(5)}</span>}
                    </p>
                ) : <p className="text-zinc-600">Actual: —</p>}
                {l.reason && <p className="text-zinc-300 [overflow-wrap:anywhere]" data-testid="sm-hoi-reason"><span className="text-zinc-500">Reason:</span> {l.reason}</p>}
            </div>
        );
    };
    const monthCorr = (data?.corrections || []).filter((x: any) => x.month === month);
    const openTickets = (data?.tickets || []).filter((t: any) => !["Resolved", "Rejected"].includes(t.status));
    const dayReason = (d: any) => (<>
                                            {d.correction ? <span className={d.correction.direction === "TO_NON_PAYABLE" ? "text-red-200" : "text-violet-200"}>HR correction ({d.correction.value === 0.5 ? "half day payable 0.5" : d.correction.direction === "TO_NON_PAYABLE" ? "non-payable" : "payable"}): {d.correction.correctionCategory} — {d.correction.correctedByName} ({d.correction.correctedByRole}), {dt(d.correction.correctedAt)}<span className="block text-zinc-500">Records: {d.baseReason}</span></span> : d.reason}
                                            {d.penalties.length > 0 && <span className="block text-[10px] text-amber-300/90 mt-0.5">Flags: {d.penalties.join(" · ")}</span>}
    </>);
    const dayActions = (d: any) => (<>
                                            {d.correctable && data.canEdit && <button onClick={() => setDialog({ day: d, direction: "TO_PAYABLE" })} data-testid="sm-mark" className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase">Mark Payable</button>}
                                            {d.deductible && !d.correction && data.canEdit && d.payableStatus !== "Upcoming" && <button onClick={() => setDialog({ day: d, direction: "TO_NON_PAYABLE" })} data-testid="sm-mark-np" className="ml-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[10px] font-black uppercase">Mark Non-Payable</button>}
                                            {d.correction && <>
                                                <button onClick={() => setView(monthCorr.find((x: any) => x.id === d.correction.id) || d.correction)} className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-[10px] font-black uppercase mr-1">View</button>
                                                {data.canEdit && <button onClick={() => setReverse({ correction: d.correction, date: d.date, reason: "", busy: false, error: "" })} data-testid="sm-reverse" className="px-2 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-black uppercase">Reverse</button>}
                                            </>}
    </>);
    return (
        <div className="space-y-4" data-testid="sm-detail">
            <div className="flex flex-wrap items-center gap-2 justify-between">
                <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white"><ArrowLeft size={14} /> All employees</button>
                <div className="flex flex-wrap items-center gap-2">
                    <DownloadButtons disabled={!data} onPdf={() => exportEmployeeMonth("pdf", { employee: data.employee, monthLabel: data.monthLabel, month, calc: data.calc })} onXlsx={() => exportEmployeeMonth("xlsx", { employee: data.employee, monthLabel: data.monthLabel, month, calc: data.calc })} />
                    <select value={month} onChange={ev => setMonth(ev.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold text-white" data-testid="sm-detail-month">{months().map(m => <option key={m} value={m}>{monthText(m)}</option>)}</select>
                </div>
            </div>
            {error && <div className="rounded-xl px-4 py-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}
            {loading && !data ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : c && (<>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                    <div className="sm:col-span-2 lg:col-span-4"><p className="text-xl font-black text-white">{e.name}</p><p className="text-zinc-500">{e.id} · {data.monthLabel}{c.provisional ? " · provisional (month running)" : ""}</p></div>
                    {[["Designation", e.designation], ["Department", e.dept], ["College / Location", e.locationName], [e.reportingManagerLabel || "Reporting Manager", e.reportingManager]].map(([l, v]) => <p key={l}><span className="text-zinc-500">{l}:</span> <span className="text-zinc-200">{v || "—"}</span></p>)}
                </div>
                {ticketId && <p className="text-xs text-indigo-200 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-3 py-2">Reviewing ticket <b>{ticketId}</b> — a day marked payable here is linked to it; the ticket is resolved once every requested date is payable.</p>}
                {openTickets.length > 0 && !ticketId && <p className="text-xs text-amber-200 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">Open tickets: {openTickets.map((t: any) => <button key={t.id} onClick={() => onOpenTicket(t.id)} className="underline mr-2">{t.id}</button>)}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3" data-testid="sm-overview">
                    {[["Total Days", c.totalDays], ["Working Days", c.workingDays], ["Payable Days", n(c.payableDays)], ["Non-Payable", n(c.nonPayableDays)], ["Paid Leaves", n(c.paidLeaves)], ["Unpaid Leaves", n(c.unpaidLeaves)], ["Penalty Days", n(c.penaltyDays)], ["HR Corrections", `+${n(c.correctedDays)}${c.hrDeductedDays ? ` / −${n(c.hrDeductedDays)}` : ""}`]].map(([l, v]) => (
                        <div key={l} className={`rounded-xl border p-3 ${l === "Payable Days" ? "border-emerald-500/30 bg-emerald-500/[0.06]" : l === "Non-Payable" ? "border-red-500/25 bg-red-500/[0.05]" : "border-zinc-800 bg-zinc-900/50"}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{l}</p><p className="text-lg font-black text-white tabular-nums" data-testid={`sm-ov-${String(l).replace(/\W+/g, "-").toLowerCase()}`}>{v}</p>
                        </div>
                    ))}
                </div>
                <MonetaryPenalties list={c.monetaryPenalties} total={c.monetaryPenaltyTotal} monthLabel={data.monthLabel} testid="sm-money" />
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                        <p className="text-sm font-bold text-white">Payable Day Breakdown</p>
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer"><input type="checkbox" checked={onlyIssues} onChange={ev => setOnlyIssues(ev.target.checked)} className="accent-emerald-500" /> Only non-payable / corrected / penalty days</label>
                    </div>
                    {/* Phone / tablet: one card per day */}
                    <div style={{ display: wide ? "none" : undefined }} className="divide-y divide-zinc-800/70" data-testid="sm-day-cards">
                        {days.map((d: any) => (
                            <div key={d.date} className={`p-4 space-y-2 text-xs ${d.correction ? (d.correction.direction === "TO_NON_PAYABLE" ? "bg-red-500/[0.04]" : "bg-violet-500/[0.04]") : ""}`} data-testid="sm-day-card">
                                <div className="flex items-start justify-between gap-2">
                                    <p><span className="font-semibold text-white">{dmy(d.date)}</span> <span className="text-zinc-500">{d.weekday}</span>{d.holiday && <span className="block text-[10px] text-sky-300">Holiday</span>}</p>
                                    <div className="text-right"><Badge s={d.payableStatus} map={PAY} /><p className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">Value {d.payableStatus === "Not Employed" ? "—" : n(d.payable)}</p></div>
                                </div>
                                <p className="text-zinc-300"><span className="text-zinc-500">In / Out:</span> {d.clockIn || "—"} / {d.clockOut || "—"} · <span className="text-zinc-500">Attendance:</span> {d.attendance}{d.leave ? <> · <span className="text-zinc-500">Leave:</span> {d.leave}</> : null}</p>
                                {d.correction && <p className="text-[10px] text-zinc-500">Records: {d.basePayableStatus}</p>}
                                {isHoi && <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 text-[11px]"><p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Location</p><HoiLoc d={d} /></div>}
                                <div className="text-zinc-400 [overflow-wrap:anywhere]">{dayReason(d)}</div>
                                <div className="flex flex-wrap gap-1.5 [&>button]:ml-0 [&>button]:mr-0">{dayActions(d)}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: wide ? undefined : "none" }} className="overflow-x-auto" data-testid="sm-breakdown-scroll">
                        <table className={`w-full text-xs ${isHoi ? "min-w-[1320px]" : "min-w-[1000px]"}`} data-testid="sm-breakdown">
                            <thead><tr className="text-[10px] uppercase tracking-widest text-zinc-500 text-left">
                                <th className={`py-2 px-3 ${isHoi ? "sticky left-0 z-[1] bg-[#121214]" : ""}`}>Date</th><th className="py-2 px-3">Clock-In / Out</th><th className="py-2 px-3">Attendance</th>{isHoi && <th className="py-2 px-3 min-w-[300px]" data-testid="sm-hoi-loc-head">Location (Assigned / Actual)</th>}<th className="py-2 px-3">Leave</th>
                                <th className="py-2 px-3">Payable</th><th className="py-2 px-3">Value</th><th className="py-2 px-3">Reason / Penalties</th><th className="py-2 px-3 text-right">Action</th>
                            </tr></thead>
                            <tbody className="divide-y divide-zinc-800/70">
                                {days.map((d: any) => (
                                    <tr key={d.date} className={`align-top ${d.correction ? (d.correction.direction === "TO_NON_PAYABLE" ? "bg-red-500/[0.04]" : "bg-violet-500/[0.04]") : ""}`} data-testid="sm-day">
                                        <td className={`py-2 px-3 whitespace-nowrap ${isHoi ? "sticky left-0 z-[1] bg-[#121214]" : ""}`}><span className="font-semibold text-white">{dmy(d.date)}</span> <span className="text-zinc-500">{d.weekday}</span>{d.holiday && <span className="block text-[10px] text-sky-300">Holiday</span>}</td>
                                        <td className="py-2 px-3 text-zinc-300 whitespace-nowrap tabular-nums">{d.clockIn || "—"} / {d.clockOut || "—"}</td>
                                        <td className="py-2 px-3 text-zinc-300">{d.attendance}</td>
                                        {isHoi && <td className="py-2 px-3 text-[11px] max-w-[360px]"><HoiLoc d={d} /></td>}
                                        <td className="py-2 px-3 text-zinc-300">{d.leave || "—"}</td>
                                        <td className="py-2 px-3"><Badge s={d.payableStatus} map={PAY} />{d.correction && <span className="block text-[10px] text-zinc-500 mt-0.5">Records: {d.basePayableStatus}</span>}</td>
                                        <td className="py-2 px-3 tabular-nums text-zinc-200">{d.payableStatus === "Not Employed" ? "—" : n(d.payable)}</td>
                                        <td className="py-2 px-3 text-zinc-400 [overflow-wrap:anywhere]">
                                            {dayReason(d)}
                                        </td>
                                        <td className="py-2 px-3 text-right whitespace-nowrap">
                                            {dayActions(d)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <AdjustmentHistory corrections={data.corrections || []} penalties={data.penalties || []} canEdit={data.canEdit} wide={wide}
                    onViewCorrection={setView} onReverseCorrection={(x: any) => setReverse({ correction: x, date: x.date, reason: "", busy: false, error: "" })}
                    onViewPenalty={setPenView} onEditPenalty={(p: any) => setPenEdit({ mode: "edit", p })} onReversePenalty={(p: any) => setPenEdit({ mode: "reverse", p })} />
            </>)}
            {dialog && <MarkPayableDialog employee={e} day={dialog.day} direction={dialog.direction} ticketId={ticketId} openTickets={openTickets} categories={dialog.direction === "TO_NON_PAYABLE" ? data.nonPayableCategories : data.categories} halfDayReasons={data.halfDayReasons || HALF_DAY_REASONS} penaltyReasons={data.penaltyReasons || PENALTY_REASONS} maxPenalty={data.maxPenalty || MAX_PENALTY_AMOUNT} serverReady={Array.isArray(data.halfDayReasons)} monthPayable={c?.payableDays} penaltyTotal={c?.monetaryPenaltyTotal} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); onMsg({ type: "success", text: m }); load(); }} />}
            {reverse && <ReverseDialog st={reverse} setSt={setReverse} onDone={(m) => { setReverse(null); onMsg({ type: "success", text: m }); load(); }} />}
            {view && <CorrectionView c={view} onClose={() => setView(null)} />}
            {penView && <PenaltyView p={penView} onClose={() => setPenView(null)} />}
            {penEdit && <PenaltyChangeDialog mode={penEdit.mode} p={penEdit.p} reasons={data?.penaltyReasons || []} maxPenalty={data?.maxPenalty || 100000} onClose={() => setPenEdit(null)} onDone={(m) => { setPenEdit(null); onMsg({ type: "success", text: m }); load(); }} />}
        </div>
    );
}

const ADJ_TONE = {
    green: { on: "border-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-400/40", off: "border-emerald-500/25 bg-emerald-500/[0.05] hover:bg-emerald-500/10", text: "text-emerald-200", offText: "text-emerald-300/80", dot: "bg-emerald-400", ring: "border-emerald-400/60" },
    red: { on: "border-red-400 bg-red-500/20 ring-1 ring-red-400/40", off: "border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/10", text: "text-red-200", offText: "text-red-300/80", dot: "bg-red-400", ring: "border-red-400/60" },
    amber: { on: "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400/40", off: "border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/10", text: "text-amber-200", offText: "text-amber-300/80", dot: "bg-amber-400", ring: "border-amber-400/60" },
    rose: { on: "border-rose-400 bg-rose-500/20 ring-1 ring-rose-400/40", off: "border-rose-500/25 bg-rose-500/[0.05] hover:bg-rose-500/10", text: "text-rose-200", offText: "text-rose-300/80", dot: "bg-rose-400", ring: "border-rose-400/60" },
};

function MarkPayableDialog({ employee, day, direction = "TO_PAYABLE", ticketId, openTickets, categories, halfDayReasons = [], penaltyReasons = [], maxPenalty = 100000, monthPayable, penaltyTotal = 0, serverReady = true, onClose, onDone }: { employee: any; day: any; direction?: "TO_PAYABLE" | "TO_NON_PAYABLE"; ticketId?: string; openTickets: any[]; categories: string[]; halfDayReasons?: string[]; penaltyReasons?: string[]; maxPenalty?: number; monthPayable?: number; penaltyTotal?: number; serverReady?: boolean; onClose: () => void; onDone: (m: string) => void }) {
    const toPay = direction === "TO_PAYABLE";
    // Payment Adjustment Type — Full Day keeps the existing correction; Half Day = 0.5 (only from a 0 or a 1 day); Monetary Penalty only from Mark Payable
    const types: [AdjType, string][] = toPay
        ? [["FULL", "Full Day Payable"], ...(day.payable === 0 && halfDayReasons.length ? [["HALF", "Half Day Payable"] as [AdjType, string]] : []), ...(penaltyReasons.length ? [["PENALTY", "Monetary Penalty"] as [AdjType, string]] : [])]
        : [["FULL", "Non-Payable"], ...(day.payable === 1 && halfDayReasons.length ? [["HALF", "Half Day Payable"] as [AdjType, string]] : [])];
    const [type, setType] = useState<AdjType>("FULL");
    const [halfReason, setHalfReason] = useState("");
    const [explanation, setExplanation] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState(toPay ? (categories[1] || categories[0]) : categories[0]);
    const [reason, setReason] = useState("");
    const [categoryOther, setCategoryOther] = useState("");   // written by hand when "Other" is chosen
    const [ticket, setTicket] = useState(ticketId || openTickets.find((t: any) => (t.affectedDates || []).includes(day.date))?.id || "");
    const [files, setFiles] = useState<string[]>([]);
    const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
    const [confirm, setConfirm] = useState(false);
    // reason is optional; "Other" needs the category written by hand
    const amt = Number(amount);
    const amountErr = type !== "PENALTY" || amount.trim() === "" ? "" : !/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !(amt > 0) ? "Enter an amount greater than ₹0 (up to 2 decimals)." : amt > maxPenalty ? `The amount cannot be more than ${inr(maxPenalty)}.` : "";
    // Half Day / Penalty need the updated server files (employee / corrections / penalties routes)
    const blocked = type !== "FULL" && !serverReady;
    const okReason = blocked ? false : type === "FULL" ? (category !== "Other" || categoryOther.trim().length >= 2)
        : type === "HALF" ? !!halfReason && explanation.trim().length > 0
        : !!halfReason && explanation.trim().length > 0 && amount.trim() !== "" && !amountErr;
    const categoryText = category === "Other" ? `Other — ${categoryOther.trim()}` : category;
    const upload = async (fl: FileList | null) => {
        if (!fl?.length) return; setUploading(true); setError("");
        try { const urls: string[] = []; for (const f of Array.from(fl).slice(0, 5 - files.length)) { if (!/^image\/(jpe?g|png|webp)$|^application\/pdf$/.test(f.type)) throw new Error("Upload JPG, PNG, WEBP or PDF files."); urls.push((await uploadToCloudinary(f)).secure_url); } setFiles([...files, ...urls]); }
        catch (e: any) { setError(e.message || "Upload failed"); } finally { setUploading(false); }
    };
    const submit = async () => {
        setBusy(true); setError("");
        try {
            const res = type === "PENALTY"
                ? await fetch("/api/hr/salary-management/penalties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: employee.id, date: day.date, amount: amount.trim(), reasonCategory: halfReason, explanation }) })
                : await fetch("/api/hr/salary-management/corrections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(type === "HALF"
                    ? { employeeId: employee.id, date: day.date, direction, payableType: "HALF", halfDayReason: halfReason, explanation, evidenceUrls: files, ticketId: ticket || undefined }
                    : { employeeId: employee.id, date: day.date, direction, category, categoryOther: category === "Other" ? categoryOther.trim() : undefined, reason, evidenceUrls: files, ticketId: ticket || undefined }) });
            const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || "Could not save"); onDone(d.message);
        } catch (e: any) { setError(e.message); setConfirm(false); } finally { setBusy(false); }
    };
    const line = (l: string, v: any) => <div className="flex gap-3"><span className="w-36 shrink-0 text-zinc-500">{l}</span><span className="text-zinc-200 [overflow-wrap:anywhere]">{v || "—"}</span></div>;
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !busy && onClose()}>
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 text-xs" onClick={ev => ev.stopPropagation()} data-testid="sm-dialog">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black text-white">{toPay ? "Mark Day as Payable" : "Mark Day as Non-Payable"}</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
                {!confirm ? (<>
                    <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-3 space-y-1.5">
                        {line("Employee", `${employee.name} (${employee.id})`)}{line("Date", `${dmy(day.date)} (${day.weekday})`)}{line("Attendance", `${day.attendance}${day.clockIn ? ` · in ${day.clockIn}` : ""}${day.clockOut ? ` · out ${day.clockOut}` : ""}`)}
                        {line("Current Payable", `${day.payableStatus} (${n(day.payable)})`)}{line("Leave", day.leave)}{line("Penalties", day.penalties.join(", "))}{line("Why", day.reason)}
                    </div>
                    {types.length > 1 && (
                        <div role="radiogroup" aria-label="Payment Adjustment Type" data-testid="sm-adj-type">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Payment Adjustment Type *</p>
                            <div className={`grid gap-2 ${types.length === 3 ? "grid-cols-1 min-[420px]:grid-cols-3" : "grid-cols-2"}`}>
                                {types.map(([v, l]) => {
                                    // colour per type: full day = green (red when it makes the day non-payable), half day = amber, penalty = rose
                                    const tone = v === "HALF" ? ADJ_TONE.amber : v === "PENALTY" ? ADJ_TONE.rose : toPay ? ADJ_TONE.green : ADJ_TONE.red;
                                    const on = type === v;
                                    const sub = v === "HALF" ? "0.5 day" : v === "PENALTY" ? "₹ deduction" : toPay ? "1 day" : "0 day";
                                    return (
                                        <button key={v} type="button" role="radio" aria-checked={on} data-testid={`sm-adj-${v}`} data-on={on ? "1" : "0"}
                                            onClick={() => { if (type !== v) { setType(v); setHalfReason(""); setError(""); } }}
                                            className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${on ? tone.on : tone.off}`}>
                                            <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full shrink-0 ${on ? tone.dot : `border ${tone.ring}`}`} /><span className={`text-xs font-black ${on ? tone.text : tone.offText}`}>{l}</span></span>
                                            <span className={`block mt-0.5 pl-[18px] text-[10px] ${on ? tone.text : tone.offText} opacity-80`}>{sub}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {blocked && <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2" data-testid="sm-server-old">The server files for Half Day / Monetary Penalty are not updated yet (src\app\api\hr\salary-management\employee\route.ts, corrections\route.ts, penalties\route.ts and src\lib\salary-module.ts). Update them and restart the server — until then only Full Day can be saved.</p>}
                    {type === "PENALTY" ? (<>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Penalty Amount (₹) *
                            <input value={amount} onChange={ev => setAmount(ev.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 500" data-testid="sm-pen-amount"
                                className={`mt-1 w-full bg-zinc-950 border rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal ${amountErr ? "border-red-500/60" : "border-zinc-700"}`} />
                            {amountErr && <span className="block mt-1 text-red-300 normal-case tracking-normal font-normal" data-testid="sm-pen-amount-error">{amountErr}</span>}
                        </label>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Penalty Reason *
                            <select value={halfReason} onChange={ev => setHalfReason(ev.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" data-testid="sm-pen-reason">
                                <option value="">— Select —</option>{penaltyReasons.map(x => <option key={x}>{x}</option>)}
                            </select>
                        </label>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Explain Why This Penalty Is Being Applied *
                            <textarea value={explanation} onChange={ev => setExplanation(ev.target.value)} rows={4} maxLength={3000} data-testid="sm-explanation" placeholder="e.g. Assigned work was not submitted within the communicated deadline."
                                className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal" />
                            {halfReason === "Other" && <span className="block mt-1 text-zinc-600 normal-case tracking-normal font-normal">Other: write the reason here.</span>}
                        </label>
                    </>) : (<>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Related Correction Ticket
                        <select value={ticket} onChange={ev => setTicket(ev.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" data-testid="sm-ticket">
                            <option value="">None</option>{openTickets.map((t: any) => <option key={t.id} value={t.id}>{t.id} — {t.category}</option>)}
                        </select>
                    </label>
                    {type === "HALF" ? (<>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Reason for Half-Day Payable *
                            <select value={halfReason} onChange={ev => setHalfReason(ev.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" data-testid="sm-half-reason">
                                <option value="">— Select —</option>{halfDayReasons.map(x => <option key={x}>{x}</option>)}
                            </select>
                        </label>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Reason / Explanation *
                            <textarea value={explanation} onChange={ev => setExplanation(ev.target.value)} rows={4} maxLength={3000} data-testid="sm-explanation" placeholder="e.g. Assigned tasks were not completed within the scheduled working hours."
                                className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal" />
                            {halfReason === "Other" && <span className="block mt-1 text-zinc-600 normal-case tracking-normal font-normal">Other: write the reason here.</span>}
                        </label>
                        <p className="text-zinc-400">Payable Days for this date: <b className="text-white">0.5</b></p>
                    </>) : (<>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Correction Category *
                        <select value={category} onChange={ev => setCategory(ev.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" data-testid="sm-category">{categories.map(x => <option key={x}>{x}</option>)}</select>
                    </label>
                    {category === "Other" && (
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Specify Category *
                            <input value={categoryOther} onChange={ev => setCategoryOther(ev.target.value)} maxLength={150} autoFocus data-testid="sm-category-other" placeholder="Write the correction category"
                                className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal" />
                        </label>
                    )}
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Reason for Correction (optional)
                        <textarea value={reason} onChange={ev => setReason(ev.target.value)} rows={5} data-testid="sm-reason" placeholder={toPay ? "e.g. The employee was present at the assigned college on this date, but the clock-in was not recorded due to a technical issue. Attendance was verified through the available records." : "e.g. The employee was not present at the college on this date although a clock-in was recorded; verified with the HOI and the gate register."}
                            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal" />

                    </label>
                    </>)}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Supporting Evidence (optional)</p>
                        <label className="flex items-center justify-center gap-2 border border-dashed border-zinc-700 rounded-lg py-3 text-zinc-400 cursor-pointer hover:border-primary">
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {uploading ? "Uploading…" : "Upload image / PDF"}
                            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={ev => upload(ev.target.files)} disabled={uploading || files.length >= 5} />
                        </label>
                        {files.length > 0 && <p className="text-zinc-400 mt-1">{files.length} file(s) attached</p>}
                    </div>
                    </>)}
                    {error && <p className="text-red-400 flex items-center gap-1" data-testid="sm-error"><AlertTriangle size={12} /> {error}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg font-bold text-zinc-400 hover:text-white">Cancel</button>
                        <button disabled={!okReason || uploading} onClick={() => setConfirm(true)} data-testid="sm-next" className="px-5 py-2 rounded-lg bg-primary text-white font-black uppercase tracking-wider disabled:opacity-50">{type === "HALF" ? "Confirm Half Day Payable" : type === "PENALTY" ? "Apply Monetary Penalty" : "Review"}</button>
                    </div>
                </>) : type !== "FULL" ? (<>
                    <p className="text-sm text-zinc-200 leading-relaxed" data-testid="sm-confirm-text">{type === "HALF"
                        ? <>You are marking <b>{employee.name}</b> as Half Day Payable for <b>{dmy(day.date)}</b>. This may affect the employee&apos;s salary. Do you want to continue?</>
                        : <>You are applying a monetary deduction of <b>{inr(amt)}</b> to <b>{employee.name}</b> for <b>{dmy(day.date)}</b>. Do you want to continue?</>}</p>
                    <div className="rounded-xl p-3 space-y-1.5 bg-amber-500/5 border border-amber-500/20" data-testid="sm-impact">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Expected Salary Impact</p>
                        {line("Employee", `${employee.name} (${employee.id})`)}{line("Date", dmy(day.date))}
                        {type === "HALF" ? (<>
                            {line("Payable Value (date)", `${n(day.payable)} → 0.5`)}
                            {monthPayable !== undefined && line("Monthly Payable Days", `${n(monthPayable)} → ${n(Math.round((monthPayable + (toPay ? 0.5 : -0.5)) * 100) / 100)}`)}
                        </>) : (<>
                            {line("Deduction Amount", inr(amt))}
                            {line("Monthly Monetary Penalties", `${inr(penaltyTotal)} → ${inr(Math.round((penaltyTotal + amt) * 100) / 100)}`)}
                            {line("Payable Days", "Unchanged (the penalty is a separate ₹ deduction)")}
                        </>)}
                        {line("Reason", halfReason)}{line("Explanation", explanation.trim())}{type === "HALF" && ticket ? line("Ticket", ticket) : null}
                    </div>
                    <p className="text-zinc-500">The attendance and leave records stay as they are. The employee is notified by email and in-app.</p>
                    {error && <p className="text-red-400">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setConfirm(false)} disabled={busy} className="px-4 py-2 rounded-lg font-bold text-zinc-400 hover:text-white">Cancel</button>
                        <button onClick={submit} disabled={busy} data-testid="sm-confirm" className="px-5 py-2 rounded-lg text-white font-black uppercase tracking-wider disabled:opacity-50 bg-amber-600 hover:bg-amber-500">{busy ? "Saving…" : type === "HALF" ? "Confirm Adjustment" : "Confirm Penalty"}</button>
                    </div>
                </>) : (<>
                    <div className={`rounded-xl p-3 space-y-1.5 ${toPay ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
                        {line("Employee", employee.name)}{line("Date", dmy(day.date))}{line("Previous Status", day.payableStatus)}{line("Updated Status", toPay ? "Payable" : "Non-Payable")}
                        {line("Payable Day Adjustment", toPay ? `+${n(day.lop)}` : `−${n(day.payable)}`)}{line("Category", categoryText)}{line("Reason", reason.trim() || "—")}{ticket ? line("Ticket", ticket) : null}
                    </div>
                    <p className="text-zinc-500">The attendance and leave records stay as they are. The employee is notified by email and in-app.</p>
                    {error && <p className="text-red-400">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setConfirm(false)} disabled={busy} className="px-4 py-2 rounded-lg font-bold text-zinc-400 hover:text-white">Cancel</button>
                        <button onClick={submit} disabled={busy} data-testid="sm-confirm" className={`px-5 py-2 rounded-lg text-white font-black uppercase tracking-wider disabled:opacity-50 ${toPay ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}>{busy ? "Saving…" : toPay ? "Confirm Payable Day Correction" : "Confirm Non-Payable Correction"}</button>
                    </div>
                </>)}
            </div>
        </div>
    );
}

function ReverseDialog({ st, setSt, onDone }: { st: any; setSt: (s: any) => void; onDone: (m: string) => void }) {
    const go = async () => {
        setSt({ ...st, busy: true, error: "" });
        try {
            const res = await fetch("/api/hr/salary-management/corrections/reverse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correctionId: st.correction.id, reason: st.reason }) });
            const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || "Could not reverse"); onDone(d.message);
        } catch (e: any) { setSt({ ...st, busy: false, error: e.message }); }
    };
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !st.busy && setSt(null)}>
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 text-xs" onClick={ev => ev.stopPropagation()} data-testid="sm-reverse-dialog">
                <h2 className="text-lg font-black text-white flex items-center gap-2"><RotateCcw size={17} className="text-red-400" /> Reverse Correction — {dmy(st.date)}</h2>
                <p className="text-zinc-400">The day goes back to what the records give. The correction stays in the history as reversed.</p>
                <textarea value={st.reason} onChange={ev => setSt({ ...st, reason: ev.target.value })} rows={4} placeholder="Reason for reversal (required)" data-testid="sm-reverse-reason" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                {st.error && <p className="text-red-400">{st.error}</p>}
                <div className="flex justify-end gap-2">
                    <button onClick={() => setSt(null)} className="px-4 py-2 rounded-lg font-bold text-zinc-400">Cancel</button>
                    <button onClick={go} disabled={st.busy || st.reason.trim().length < 20} data-testid="sm-reverse-confirm" className="px-4 py-2 rounded-lg bg-red-600 text-white font-black uppercase disabled:opacity-50">{st.busy ? "Reversing…" : "Reverse"}</button>
                </div>
            </div>
        </div>
    );
}

function CorrectionView({ c, onClose }: { c: any; onClose: () => void }) {
    const row = (l: string, v: any) => v === undefined || v === "" || v === null ? null : <div className="flex gap-3 py-1.5 border-b border-zinc-800/60"><span className="w-40 shrink-0 text-zinc-500">{l}</span><span className="text-zinc-200 [overflow-wrap:anywhere]">{String(v)}</span></div>;
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs" onClick={ev => ev.stopPropagation()}>
                <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-black text-white">Correction {c.id}</h2><button onClick={onClose} className="text-zinc-500"><X size={18} /></button></div>
                {row("Date", dmy(c.date))}{row("Original Attendance", c.originalAttendance)}{row("Original Leave", c.originalLeave)}{row("Records Said", c.originalReason)}
                {row("Adjustment Type", adjLabel(c))}{row("Previous Status", c.previousPayableStatus)}{row("Updated Status", c.updatedPayableStatus || "Payable")}{row("Adjustment", c.adjustment !== undefined ? `${c.adjustment > 0 ? "+" : ""}${c.adjustment}` : undefined)}
                {row("Monthly Payable", c.previousMonthPayable !== undefined ? `${c.previousMonthPayable} → ${c.updatedMonthPayable}` : undefined)}
                {row("Category", c.correctionCategory)}{row("Reason", c.correctionReason)}{row("Ticket", c.relatedTicketId)}
                {row("Corrected By", `${c.correctedByName} (${c.correctedByRole})`)}{row("Corrected At", dt(c.correctedAt))}{row("Status", c.status)}
                {c.status === "REVERSED" && <>{row("Reversed By", `${c.reversedByName} (${c.reversedByRole})`)}{row("Reversed At", dt(c.reversedAt))}{row("Reversal Reason", c.reversalReason)}</>}
                {(c.supportingEvidence || []).map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block text-primary underline py-1">Evidence {i + 1}</a>)}
            </div>
        </div>
    );
}


// ─────────────────────────── Adjustment history (payable-day corrections + HR monetary penalties) ───────────────────────────
const isNonPay = (c: any) => c.direction === "TO_NON_PAYABLE" || c.updatedPayableStatus === "Non-Payable" || (c.adjustment ?? 0) < 0;
const adjLabel = (c: any) => c.payableType === "HALF" || c.updatedPayableValue === 0.5 && c.updatedPayableStatus === "Partly Payable" ? "Half Day" : isNonPay(c) ? "Non-Payable" : "Full Day";

function AdjustmentHistory({ corrections, penalties, canEdit, wide, onViewCorrection, onReverseCorrection, onViewPenalty, onEditPenalty, onReversePenalty }: {
    corrections: any[]; penalties: any[]; canEdit: boolean; wide: boolean;
    onViewCorrection: (c: any) => void; onReverseCorrection: (c: any) => void; onViewPenalty: (p: any) => void; onEditPenalty: (p: any) => void; onReversePenalty: (p: any) => void;
}) {
    const rows = [
        ...corrections.map(c => {
            const label = adjLabel(c);
            const value = c.updatedPayableValue ?? (isNonPay(c) ? 0 : 1);
            return {
                key: `c-${c.id}`, kind: "c" as const, rec: c, date: c.date, at: c.correctedAt || "", adjustment: label, active: c.status === "ACTIVE",
                amount: `${n(value)} Day`, sub: c.adjustment !== undefined ? `${c.adjustment > 0 ? "+" : ""}${n(c.adjustment)} · was ${n(c.previousPayableValue)}` : "",
                reason: c.correctionCategory || "—", by: `${c.correctedByName || "—"}${c.correctedByRole ? ` (${c.correctedByRole})` : ""}`,
            };
        }),
        ...penalties.map(p => ({
            key: `p-${p.id}`, kind: "p" as const, rec: p, date: p.date, at: p.createdAt || "", adjustment: "Monetary Penalty", active: p.status === "ACTIVE",
            amount: inr(p.amount), sub: p.updatedAt ? "corrected" : "", reason: p.reasonCategory || "—",
            by: `${p.updatedByName || p.createdByName || "—"}${(p.updatedByRole || p.createdByRole) ? ` (${p.updatedByRole || p.createdByRole})` : ""}`,
        })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
    const btn = "px-2 py-1 rounded-md text-[10px] font-black uppercase";
    const actions = (r: typeof rows[number]) => (
        <div className="flex flex-wrap gap-1 justify-end">
            <button onClick={() => r.kind === "c" ? onViewCorrection(r.rec) : onViewPenalty(r.rec)} data-testid="sm-adj-view" className={`${btn} bg-zinc-800 text-zinc-200`}>View</button>
            {canEdit && r.active && r.kind === "p" && <button onClick={() => onEditPenalty(r.rec)} data-testid="sm-adj-edit" className={`${btn} bg-sky-500/15 text-sky-200 border border-sky-500/30`}>Correct</button>}
            {canEdit && r.active && <button onClick={() => r.kind === "c" ? onReverseCorrection(r.rec) : onReversePenalty(r.rec)} data-testid="sm-adj-reverse" className={`${btn} bg-red-500/15 text-red-300 border border-red-500/30`}>Reverse</button>}
        </div>
    );
    const status = (r: typeof rows[number]) => !r.active && <Badge s="Reversed" map={{ Reversed: T_STYLE.Rejected }} />;
    const tone = (a: string) => a === "Monetary Penalty" ? "text-red-300" : a === "Half Day" ? "text-amber-300" : a === "Non-Payable" ? "text-red-200" : "text-emerald-300";
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40" data-testid="sm-history">
            <p className="text-sm font-bold text-white flex items-center gap-2 px-4 py-3 border-b border-zinc-800"><History size={15} className="text-primary" /> Adjustment History ({rows.length})</p>
            {rows.length === 0 ? <p className="text-xs text-zinc-500 p-4">No salary adjustments for this employee.</p> : wide ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[860px]" data-testid="sm-adj-table">
                        <thead><tr className="text-[10px] uppercase tracking-widest text-zinc-500 text-left">
                            <th className="py-2 px-3">Date</th><th className="py-2 px-3">Adjustment</th><th className="py-2 px-3">Amount / Days</th><th className="py-2 px-3">Reason</th><th className="py-2 px-3">Updated By</th><th className="py-2 px-3 text-right">Action</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {rows.map(r => (
                                <tr key={r.key} className={`align-top ${r.active ? "" : "opacity-60"}`} data-testid="sm-adj-row" data-kind={r.adjustment}>
                                    <td className="py-2 px-3 whitespace-nowrap font-semibold text-white">{dmy(r.date)}</td>
                                    <td className="py-2 px-3"><span className={`font-bold ${tone(r.adjustment)}`}>{r.adjustment}</span> {status(r)}</td>
                                    <td className="py-2 px-3 tabular-nums text-zinc-200 whitespace-nowrap">{r.amount}{r.sub && <span className="block text-[10px] text-zinc-500">{r.sub}</span>}</td>
                                    <td className="py-2 px-3 text-zinc-300 max-w-[260px] [overflow-wrap:anywhere]">{r.reason}</td>
                                    <td className="py-2 px-3 text-zinc-300">{r.by}<span className="block text-[10px] text-zinc-500">{dt(r.kind === "p" ? (r.rec.updatedAt || r.rec.createdAt) : r.rec.correctedAt)}</span></td>
                                    <td className="py-2 px-3 text-right whitespace-nowrap">{actions(r)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="divide-y divide-zinc-800/70" data-testid="sm-adj-cards">
                    {rows.map(r => (
                        <div key={r.key} className={`p-3 text-xs space-y-1 ${r.active ? "" : "opacity-60"}`} data-testid="sm-adj-row" data-kind={r.adjustment}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p><span className="font-semibold text-white">{dmy(r.date)}</span> · <span className={`font-bold ${tone(r.adjustment)}`}>{r.adjustment}</span> {status(r)}</p>
                                <p className="font-black tabular-nums text-zinc-100">{r.amount}</p>
                            </div>
                            <p className="text-zinc-300 [overflow-wrap:anywhere]"><span className="text-zinc-500">Reason:</span> {r.reason}</p>
                            <p className="text-zinc-400"><span className="text-zinc-500">Updated By:</span> {r.by}</p>
                            {actions(r)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PenaltyView({ p, onClose }: { p: any; onClose: () => void }) {
    const row = (l: string, v: any) => v === undefined || v === "" || v === null ? null : <div className="flex gap-3 py-1.5 border-b border-zinc-800/60"><span className="w-40 shrink-0 text-zinc-500">{l}</span><span className="text-zinc-200 [overflow-wrap:anywhere] whitespace-pre-wrap">{String(v)}</span></div>;
    const fmt = (x: any) => x ? `${inr(x.amount)} · ${x.reasonCategory} — ${x.explanation}` : "—";
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-xs" onClick={ev => ev.stopPropagation()} data-testid="sm-pen-view">
                <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-black text-white">Monetary Penalty {p.id}</h2><button onClick={onClose} className="text-zinc-500"><X size={18} /></button></div>
                {row("Employee", `${p.employeeName || ""} (${p.employeeId})`)}{row("Penalty Date", dmy(p.date))}{row("Amount", inr(p.amount))}{row("Penalty Reason", p.reasonCategory)}{row("Explanation", p.explanation)}
                {row("Applied By", `${p.createdByName} (${p.createdByRole})`)}{row("Applied At", dt(p.createdAt))}
                {p.updatedAt && <>{row("Last Corrected By", `${p.updatedByName} (${p.updatedByRole})`)}{row("Last Corrected At", dt(p.updatedAt))}</>}
                {row("Status", p.status)}
                {p.status === "REVERSED" && <>{row("Reversed By", `${p.reversedByName} (${p.reversedByRole})`)}{row("Reversed At", dt(p.reversedAt))}{row("Reversal Reason", p.reversalReason)}</>}
                {row("Employee Email", p.emailStatus)}
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-4 mb-1">Audit Trail</p>
                <ol className="space-y-2" data-testid="sm-pen-audit">
                    {(p.history || []).map((h: any, i: number) => (
                        <li key={i} className="rounded-lg border border-zinc-800 px-3 py-2">
                            <p className="text-zinc-200"><b>{h.action}</b> — {h.byName} ({h.role}) · {dt(h.at)}</p>
                            {h.action === "Corrected" && <p className="text-zinc-400 [overflow-wrap:anywhere]">Before: {fmt(h.before)}<br />After: {fmt(h.after)}</p>}
                            {h.note && <p className="text-zinc-400 [overflow-wrap:anywhere]">Note: {h.note}</p>}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

/** Correct (amount / reason / explanation, with a note) or reverse an HR monetary penalty */
function PenaltyChangeDialog({ mode, p, reasons, maxPenalty, onClose, onDone }: { mode: "edit" | "reverse"; p: any; reasons: string[]; maxPenalty: number; onClose: () => void; onDone: (m: string) => void }) {
    const [amount, setAmount] = useState(String(p.amount)); const [reasonCategory, setReasonCategory] = useState(p.reasonCategory);
    const [explanation, setExplanation] = useState(p.explanation || ""); const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const amt = Number(amount);
    const amountErr = !/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !(amt > 0) ? "Enter an amount greater than ₹0 (up to 2 decimals)." : amt > maxPenalty ? `The amount cannot be more than ${inr(maxPenalty)}.` : "";
    const changed = amt !== p.amount || reasonCategory !== p.reasonCategory || explanation.trim() !== (p.explanation || "");
    const ok = mode === "reverse" ? note.trim().length >= 20 : !amountErr && !!reasonCategory && explanation.trim().length >= 10 && note.trim().length >= 10 && changed;
    const go = async () => {
        setBusy(true); setError("");
        try {
            const res = await fetch("/api/hr/salary-management/penalties", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "reverse" ? { id: p.id, action: "reverse", reason: note } : { id: p.id, action: "edit", amount: amount.trim(), reasonCategory, explanation, note }) });
            const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || "Could not save"); onDone(d.message);
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };
    const field = "mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal";
    const lbl = "block text-[10px] font-black uppercase tracking-widest text-zinc-500";
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !busy && onClose()}>
            <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 text-xs" onClick={ev => ev.stopPropagation()} data-testid="sm-pen-dialog">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black text-white">{mode === "reverse" ? "Reverse Monetary Penalty" : "Correct Monetary Penalty"}</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
                <p className="text-zinc-400">{p.employeeName} · {dmy(p.date)} · {inr(p.amount)} — {p.reasonCategory}</p>
                {mode === "edit" && (<>
                    <label className={lbl}>Penalty Amount (₹) *
                        <input value={amount} onChange={ev => setAmount(ev.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" data-testid="sm-pen-edit-amount" className={field} />
                        {amountErr && <span className="block mt-1 text-red-300 normal-case tracking-normal font-normal">{amountErr}</span>}
                    </label>
                    <label className={lbl}>Penalty Reason *
                        <select value={reasonCategory} onChange={ev => setReasonCategory(ev.target.value)} className={field} data-testid="sm-pen-edit-reason">{reasons.map(x => <option key={x}>{x}</option>)}</select>
                    </label>
                    <label className={lbl}>Explanation *
                        <textarea value={explanation} onChange={ev => setExplanation(ev.target.value)} rows={3} maxLength={3000} className={field} data-testid="sm-pen-edit-expl" />
                    </label>
                </>)}
                <label className={lbl}>{mode === "reverse" ? "Reason for Reversal * (at least 20 characters)" : "Why is it being corrected? * (at least 10 characters)"}
                    <textarea value={note} onChange={ev => setNote(ev.target.value)} rows={3} maxLength={3000} className={field} data-testid="sm-pen-note" />
                </label>
                <p className="text-zinc-500">The previous values stay in the audit trail. The employee is notified by email and in-app.</p>
                {error && <p className="text-red-400" data-testid="sm-pen-error">{error}</p>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg font-bold text-zinc-400">Cancel</button>
                    <button onClick={go} disabled={busy || !ok} data-testid="sm-pen-save" className={`px-4 py-2 rounded-lg text-white font-black uppercase disabled:opacity-50 ${mode === "reverse" ? "bg-red-600" : "bg-sky-600"}`}>{busy ? "Saving…" : mode === "reverse" ? "Reverse Penalty" : "Save Correction"}</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────── Correction tickets ───────────────────────────
function TicketsPanel({ openId, setOpenId, onMsg, onOpenEmployee, initialStatus = "All" }: { initialStatus?: string; openId: string; setOpenId: (s: string) => void; onMsg: (m: any) => void; onOpenEmployee: (id: string, month?: string, ticketId?: string) => void }) {
    const wide = useMinWidth(1280); // table on laptop / desktop, cards on phone / tablet
    const [status, setStatus] = useState(initialStatus); const [q, setQ] = useState("");
    const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const p = new URLSearchParams({ status: status === "Pending" ? "All" : status }); if (q.trim()) p.set("q", q.trim());
            const res = await fetch(`/api/hr/correction-tickets?${p}`, { cache: "no-store" });
            const d = await res.json(); if (!res.ok) throw new Error(d.error || "Could not load"); setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [status, q]);
    useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
    const PENDING = ["Open", "Under Review", "Additional Information Required"];
    const list = (data?.tickets || []).filter((t: any) => status !== "Pending" || PENDING.includes(t.status));
    const open = (data?.tickets || []).find((t: any) => t.id === openId);
    const count = (s: string) => s === "All" ? data?.total : s === "Pending" ? PENDING.reduce((a, x) => a + (data?.counts?.[x] || 0), 0) : data?.counts?.[s];
    return (
        <div className="space-y-4" data-testid="sm-tickets">
            <div className="flex flex-wrap gap-2">
                {["All", "Pending", "Under Review", "Additional Information Required", "Approved", "Rejected", "Resolved"].map(s => (
                    <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} data-testid={`ct-filter-${s.replace(/\W+/g, "-")}`}
                        className={`px-3 py-2 rounded-xl text-[11px] font-black border ${status === s ? "bg-primary text-white border-primary" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"}`}>{s} <span className="opacity-70 ml-1">{count(s) ?? ""}</span></button>
                ))}
            </div>
            <div className="relative max-w-sm"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ticket ID, employee or category" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white" /></div>
            {error && <div className="rounded-xl px-4 py-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            {/* Phone / tablet: cards */}
            <div style={{ display: wide ? "none" : undefined }} className="divide-y divide-zinc-800/70" data-testid="ct-cards">
                {loading && !data ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                    : list.length === 0 ? <p className="py-12 text-center text-xs text-zinc-500">No tickets.</p>
                        : list.map((t: any) => (
                            <div key={t.id} className="p-4 space-y-2 text-xs" data-testid="ct-card">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0"><p className="font-mono font-bold text-white [overflow-wrap:anywhere]">{t.id}</p><p className="text-[10px] text-zinc-500">{dt(t.createdAt)}</p></div>
                                    <Badge s={t.status} />
                                </div>
                                <p className="text-zinc-200 font-semibold [overflow-wrap:anywhere]">{t.employee?.name} <span className="text-[10px] font-normal text-zinc-500">{t.employeeId}{t.employee?.locationName ? ` · ${t.employee.locationName}` : ""}</span></p>
                                <p className="text-zinc-300 [overflow-wrap:anywhere]"><span className="text-zinc-500">Issue:</span> {t.category}</p>
                                <p className="text-zinc-300 [overflow-wrap:anywhere]"><span className="text-zinc-500">Date(s):</span> {(t.affectedDates || []).length ? t.affectedDates.map((d: string) => d.slice(8) + "/" + d.slice(5, 7)).join(", ") : monthText(t.month)}</p>
                                <button onClick={() => setOpenId(t.id)} className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase">{PENDING.includes(t.status) && data?.canEdit ? "Review" : "View"}</button>
                            </div>
                        ))}
            </div>
            <div style={{ display: wide ? undefined : "none" }} className="overflow-x-auto">
                <table className="w-full table-fixed text-xs min-w-[820px]" data-testid="ct-table">
                    <thead><tr className="bg-zinc-800/40 text-[10px] uppercase tracking-widest text-zinc-400 text-left">
                        <th className="py-3 px-3 w-[17%]">Ticket</th><th className="py-3 px-3 w-[22%]">Employee</th><th className="py-3 px-3 w-[22%]">Issue</th><th className="py-3 px-3 w-[15%]">Date(s)</th><th className="py-3 px-3 w-[14%]">Status</th><th className="py-3 px-3 w-[10%] text-right">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/70">
                        {loading && !data ? <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="animate-spin inline text-primary" /></td></tr>
                            : list.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-zinc-500">No tickets.</td></tr>
                                : list.map((t: any) => (
                                    <tr key={t.id} className="hover:bg-white/[0.02]" data-testid="ct-row">
                                        <td className="py-3 px-3"><p className="font-mono font-bold text-white truncate">{t.id}</p><p className="text-[10px] text-zinc-500">{dt(t.createdAt)}</p></td>
                                        <td className="py-3 px-3 min-w-0"><p className="font-semibold text-zinc-200 truncate">{t.employee?.name}</p><p className="text-[10px] text-zinc-500 truncate">{t.employeeId}{t.employee?.locationName ? ` · ${t.employee.locationName}` : ""}</p></td>
                                        <td className="py-3 px-3 text-zinc-300 truncate">{t.category}</td>
                                        <td className="py-3 px-3 text-zinc-300 truncate">{(t.affectedDates || []).length ? t.affectedDates.map((d: string) => d.slice(8) + "/" + d.slice(5, 7)).join(", ") : monthText(t.month)}</td>
                                        <td className="py-3 px-3"><Badge s={t.status} /></td>
                                        <td className="py-3 px-3 text-right"><button onClick={() => setOpenId(t.id)} data-testid="ct-review" className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase">{PENDING.includes(t.status) && data?.canEdit ? "Review" : "View"}</button></td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div></div>
            {open && <TicketReview t={open} canEdit={!!data?.canEdit} onClose={() => setOpenId("")} onChanged={(m) => { onMsg({ type: "success", text: m }); load(); }} onOpenEmployee={onOpenEmployee} />}
        </div>
    );
}

function TicketReview({ t, canEdit, onClose, onChanged, onOpenEmployee }: { t: any; canEdit: boolean; onClose: () => void; onChanged: (m: string) => void; onOpenEmployee: (id: string, month?: string, ticketId?: string) => void }) {
    const wideSm = useMinWidth(640); // table on laptop / desktop, cards on phone / tablet
    const [rec, setRec] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
    const [action, setAction] = useState<"" | "Additional Information Required" | "Rejected" | "Resolved" | "Under Review">(""); const [text, setText] = useState(""); const [comment, setComment] = useState("");
    const [dialog, setDialog] = useState<any>(null);
    const loadRec = useCallback(async () => {
        if (!t.month) return;
        const res = await fetch(`/api/hr/salary-management/employee?id=${encodeURIComponent(t.employeeId)}&month=${t.month}`, { cache: "no-store" });
        const d = await res.json().catch(() => ({})); if (res.ok) setRec(d);
    }, [t.employeeId, t.month]);
    useEffect(() => { loadRec(); }, [loadRec]);
    const own = rec?.self;
    const closed = ["Resolved", "Rejected"].includes(t.status);
    const days = (rec?.calc?.days || []).filter((d: any) => (t.affectedDates || []).length ? t.affectedDates.includes(d.date) : (d.correctable || d.correction));
    const send = async (body: any) => {
        setBusy(true); setErr("");
        try {
            const res = await fetch(`/api/hr/correction-tickets/${encodeURIComponent(t.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || "Could not update");
            setAction(""); setText(""); setComment(""); onChanged(d.message);
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };
    const row = (l: string, v: any) => <div className="flex gap-3 py-1.5 border-b border-zinc-800/60"><span className="w-32 shrink-0 text-zinc-500">{l}</span><span className="text-zinc-200 [overflow-wrap:anywhere] whitespace-pre-wrap">{v || "—"}</span></div>;
    return (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
            <div className="w-full max-w-2xl h-full overflow-y-auto bg-zinc-900 border-l border-zinc-800 p-5 space-y-4 text-xs" onClick={e => e.stopPropagation()} data-testid="ct-drawer">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black text-white font-mono">{t.id}</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
                <Badge s={t.status} />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Employee</p>
                    {row("Name", `${t.employee?.name} (${t.employeeId})`)}{row("Department", t.employee?.dept)}{row("College", t.employee?.locationName)}{row("Payroll Month", monthText(t.month))}
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Employee&apos;s Complaint</p>
                    {row("Category", t.category)}{row("Current Payable", t.currentValue)}{row("Expected", t.expectedValue)}{row("Affected Dates", (t.affectedDates || []).map((d: string) => dmy(d)).join(", "))}{row("Description", t.reason)}
                    {t.evidenceUrls?.length > 0 && <div className="flex flex-wrap gap-3 py-1.5">{t.evidenceUrls.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-primary underline">Evidence {i + 1}</a>)}</div>}
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Existing OMS Records {rec ? `· payable ${n(rec.calc.payableDays)} days` : ""}</p>
                        <button onClick={() => onOpenEmployee(t.employeeId, t.month, t.id)} className="text-[11px] text-primary underline" data-testid="ct-open-employee">Full breakdown →</button>
                    </div>
                    {!rec ? <Loader2 className="animate-spin text-primary" /> : days.length === 0 ? <p className="text-zinc-500">{(t.affectedDates || []).length ? "—" : "No non-payable days in this month."}</p> : (
                        <>
                        <div style={{ display: wideSm ? "none" : undefined }} className="rounded-lg border border-zinc-800 divide-y divide-zinc-800" data-testid="ct-day-cards">
                            {days.map((d: any) => (
                                <div key={d.date} className="p-2.5 space-y-1 text-[11px]">
                                    <div className="flex items-start justify-between gap-2"><p className="text-white">{dmy(d.date)}{d.holiday ? <span className="text-sky-300"> · Holiday</span> : null}</p><Badge s={d.payableStatus} map={PAY} /></div>
                                    <p className="text-zinc-300">{d.clockIn || "—"} / {d.clockOut || "—"} · {d.attendance}{d.leave ? ` · ${d.leave}` : ""}</p>
                                    <p className="text-zinc-500 [overflow-wrap:anywhere]">{d.correction ? `HR correction · records: ${d.baseReason}` : d.reason}</p>
                                    {d.penalties.length ? <p className="text-amber-300 [overflow-wrap:anywhere]">{d.penalties.join(", ")}</p> : null}
                                    {d.correctable && canEdit && !own && !closed && <button onClick={() => setDialog({ day: d })} className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase">Mark Payable</button>}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: wideSm ? undefined : "none" }} className="overflow-x-auto rounded-lg border border-zinc-800">
                            <table className="w-full text-[11px] min-w-[560px]">
                                <thead><tr className="text-[9px] uppercase tracking-widest text-zinc-500 text-left"><th className="py-1.5 px-2">Date</th><th className="py-1.5 px-2">In / Out</th><th className="py-1.5 px-2">Attendance · Leave</th><th className="py-1.5 px-2">Payable</th><th className="py-1.5 px-2 text-right">Action</th></tr></thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {days.map((d: any) => (
                                        <tr key={d.date} className="align-top" data-testid="ct-day">
                                            <td className="py-1.5 px-2 text-white whitespace-nowrap">{dmy(d.date)}{d.holiday ? <span className="block text-sky-300">Holiday</span> : null}</td>
                                            <td className="py-1.5 px-2 text-zinc-300 whitespace-nowrap">{d.clockIn || "—"} / {d.clockOut || "—"}</td>
                                            <td className="py-1.5 px-2 text-zinc-300">{d.attendance}{d.leave ? ` · ${d.leave}` : ""}<span className="block text-zinc-500">{d.correction ? `HR correction · records: ${d.baseReason}` : d.reason}</span>{d.penalties.length ? <span className="block text-amber-300">{d.penalties.join(", ")}</span> : null}</td>
                                            <td className="py-1.5 px-2"><Badge s={d.payableStatus} map={PAY} /></td>
                                            <td className="py-1.5 px-2 text-right">{d.correctable && canEdit && !own && !closed && <button onClick={() => setDialog({ day: d })} data-testid="ct-mark" className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase">Mark Payable</button>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">History</p>
                    <ol className="space-y-1.5 border-l border-zinc-800 pl-3">
                        {(t.history || []).map((h: any, i: number) => <li key={i} className="text-zinc-400"><Clock size={10} className="inline -mt-0.5 mr-1" />{dt(h.at)} · <span className="text-zinc-200">{h.action}</span> · {h.byName}{h.role ? ` (${h.role})` : ""}{h.note ? <span className="block text-zinc-500 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.note}</span> : null}</li>)}
                    </ol>
                </div>
                {!canEdit ? <p className="text-zinc-500 flex items-center gap-1.5"><Lock size={12} /> View only.</p>
                    : own ? <p className="text-amber-300 flex items-center gap-1.5"><Lock size={12} /> This is your own ticket — another HR member must review it.</p>
                        : !closed && (
                            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</p>
                                <div className="flex flex-wrap gap-2">
                                    {t.status === "Open" && <button onClick={() => send({ status: "Under Review" })} disabled={busy} className="px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 font-bold" data-testid="ct-start">Start Review</button>}
                                    {([["Additional Information Required", "Request More Information"], ["Rejected", "Reject Correction"], ["Resolved", "Resolve Without Adjustment"]] as const).map(([s, l]) => (
                                        <button key={s} onClick={() => { setAction(s); setText(""); }} data-testid={`ct-act-${s.replace(/\W+/g, "-")}`} className={`px-3 py-1.5 rounded-lg border font-bold ${action === s ? "bg-primary text-white border-primary" : "bg-zinc-900 text-zinc-300 border-zinc-700"}`}>{l}</button>
                                    ))}
                                </div>
                                {action && (<>
                                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3} data-testid="ct-response" placeholder={action === "Resolved" ? "Explain why the current calculation is already correct (sent to the employee)" : action === "Rejected" ? "Explain why the correction is rejected (sent to the employee)" : "What information / evidence do you need? (sent to the employee)"} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white" />
                                    <button onClick={() => send({ status: action, response: text })} disabled={busy || text.trim().length < 10} data-testid="ct-save" className="px-4 py-2 rounded-lg bg-primary text-white text-[11px] font-black uppercase disabled:opacity-50">{busy ? "Saving…" : "Save & Notify Employee"}</button>
                                </>)}
                            </div>
                        )}
                <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Internal comments (HR only)</p>
                    {(t.internalComments || []).map((c: any, i: number) => <p key={i} className="text-zinc-400"><span className="text-zinc-200">{c.byName}</span> · {dt(c.at)}<span className="block text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{c.text}</span></p>)}
                    {canEdit && !own && (<>
                        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Add an internal note" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white" />
                        <button onClick={() => send({ internalComment: comment })} disabled={busy || comment.trim().length < 2} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-[11px] font-bold disabled:opacity-50">Add Comment</button>
                    </>)}
                </div>
                {err && <p className="text-red-400 flex items-center gap-1" data-testid="ct-error"><AlertTriangle size={12} /> {err}</p>}
            </div>
            {dialog && rec && <MarkPayableDialog employee={rec.employee} day={dialog.day} ticketId={t.id} openTickets={[t]} categories={rec.categories} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); onChanged(m); loadRec(); }} />}
        </div>
    );
}