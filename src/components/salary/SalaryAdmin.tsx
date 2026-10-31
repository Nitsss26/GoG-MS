"use client";

/**
 * Employee Salary Management (HR, HR Executive: manage · Founders: view only).
 * One module, two views: Employees | Correction Tickets.
 * Every figure comes from the same calculation the employee sees (src/lib/payable-days.ts + HR corrections).
 */
import { useCallback, useEffect, useState } from "react";
import {
    Wallet, Users, CheckCircle2, Ban, MessageSquare, AlertTriangle, Search, X, Loader2, ChevronLeft, ChevronRight,
    ArrowLeft, Eye, Upload, Clock, RotateCcw, Lock, ArrowUpDown, History, ShieldCheck,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { exportEmployeeMonth, exportEmployeeList } from "@/lib/salary-export";
import { Download, FileSpreadsheet } from "lucide-react";

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
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
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
    const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
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
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider ${tab === k ? "bg-primary text-white" : "text-zinc-400 hover:text-white"}`}><I size={13} /> {l}</button>
                    ))}
                </div>
            </div>
            <Msg m={msg} onClose={() => setMsg(null)} />
            {tab === "employees" && !employee && <EmployeeList month={month} setMonth={setMonth} onView={id => openEmployee(id)} />}
            {tab === "employees" && employee && <EmployeeDetail id={employee} month={month} setMonth={setMonth} ticketId={ticketCtx} onBack={() => { setEmployee(""); setTicketCtx(""); }} onMsg={setMsg} onOpenTicket={(t) => { setOpenTicket(t); setTab("tickets"); }} />}
            {tab === "tickets" && <TicketsPanel openId={openTicket} setOpenId={setOpenTicket} onMsg={setMsg} onOpenEmployee={openEmployee} />}
        </div>
    );
}

// ─────────────────────────── Employees list ───────────────────────────
function EmployeeList({ month, setMonth, onView }: { month: string; setMonth: (m: string) => void; onView: (id: string) => void }) {
    const [q, setQ] = useState(""); const [dept, setDept] = useState(""); const [college, setCollege] = useState(""); const [desig, setDesig] = useState("");
    const [pending, setPending] = useState(false); const [sort, setSort] = useState("name"); const [dir, setDir] = useState("asc"); const [page, setPage] = useState(1);
    const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const p = new URLSearchParams({ month, page: String(page), sort, dir });
            if (q.trim()) p.set("q", q.trim()); if (dept) p.set("dept", dept); if (college) p.set("college", college); if (desig) p.set("designation", desig); if (pending) p.set("tickets", "pending");
            const res = await fetch(`/api/hr/salary-management?${p}`, { cache: "no-store" });
            const d = await res.json(); if (!res.ok) throw new Error(d.error || "Could not load"); setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [month, page, sort, dir, q, dept, college, desig, pending]);
    useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
    useEffect(() => { setPage(1); }, [month, q, dept, college, desig, pending, sort, dir]);
    const s = data?.summary;
    // download: every employee that matches the filters (not only this page)
    const downloadList = async (kind: "pdf" | "xlsx") => {
        const p = new URLSearchParams({ month, sort, dir, all: "1" });
        if (q.trim()) p.set("q", q.trim()); if (dept) p.set("dept", dept); if (college) p.set("college", college); if (desig) p.set("designation", desig); if (pending) p.set("tickets", "pending");
        const res = await fetch(`/api/hr/salary-management?${p}`, { cache: "no-store" });
        const d = await res.json(); if (!res.ok) throw new Error(d.error || "Could not load");
        await exportEmployeeList(kind, { rows: d.rows, monthLabel: d.monthLabel, month: d.month, summary: d.summary });
    };
    const cards = [
        ["Total Employees", s?.totalEmployees, Users, "border-sky-500/25 bg-sky-500/[0.06] text-sky-300"],
        ["Total Payable Days", s && n(s.totalPayableDays), CheckCircle2, "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300"],
        ["Total Non-Payable Days", s && n(s.totalNonPayableDays), Ban, "border-red-500/25 bg-red-500/[0.06] text-red-300"],
        ["Pending Tickets", s?.pendingTickets, MessageSquare, "border-amber-500/25 bg-amber-500/[0.06] text-amber-300"],
        ["Resolved Tickets", s?.resolvedTickets, CheckCircle2, "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300"],
        ["Penalty Deductions", s && `${n(s.totalPenaltyDays)} d`, AlertTriangle, "border-red-500/25 bg-red-500/[0.06] text-red-300"],
        ["HR Corrections", s?.corrections, ShieldCheck, "border-violet-500/25 bg-violet-500/[0.06] text-violet-300"],
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
                {cards.map(([l, v, I, tone]: any) => (
                    <div key={l} className={`rounded-2xl border p-3.5 ${tone}`}>
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"><I size={12} /> {l}</div>
                        <p className="text-xl font-black text-white mt-1.5 tabular-nums" data-testid="sm-card-value">{v ?? "—"}</p>
                    </div>
                ))}
            </div>
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
                <div className="overflow-x-auto">
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

// ─────────────────────────── Employee detail ───────────────────────────
function EmployeeDetail({ id, month, setMonth, ticketId, onBack, onMsg, onOpenTicket }: { id: string; month: string; setMonth: (m: string) => void; ticketId?: string; onBack: () => void; onMsg: (m: any) => void; onOpenTicket: (t: string) => void }) {
    const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    const [onlyIssues, setOnlyIssues] = useState(false); const [dialog, setDialog] = useState<any>(null); const [reverse, setReverse] = useState<any>(null); const [view, setView] = useState<any>(null);
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
    const monthCorr = (data?.corrections || []).filter((x: any) => x.month === month);
    const openTickets = (data?.tickets || []).filter((t: any) => !["Resolved", "Rejected"].includes(t.status));
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
                    {[["Designation", e.designation], ["Department", e.dept], ["College / Location", e.locationName], ["Reporting Manager", e.reportingManager]].map(([l, v]) => <p key={l}><span className="text-zinc-500">{l}:</span> <span className="text-zinc-200">{v || "—"}</span></p>)}
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
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                        <p className="text-sm font-bold text-white">Payable Day Breakdown</p>
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer"><input type="checkbox" checked={onlyIssues} onChange={ev => setOnlyIssues(ev.target.checked)} className="accent-emerald-500" /> Only non-payable / corrected / penalty days</label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[1000px]" data-testid="sm-breakdown">
                            <thead><tr className="text-[10px] uppercase tracking-widest text-zinc-500 text-left">
                                <th className="py-2 px-3">Date</th><th className="py-2 px-3">Clock-In / Out</th><th className="py-2 px-3">Attendance</th><th className="py-2 px-3">Leave</th>
                                <th className="py-2 px-3">Payable</th><th className="py-2 px-3">Value</th><th className="py-2 px-3">Reason / Penalties</th><th className="py-2 px-3 text-right">Action</th>
                            </tr></thead>
                            <tbody className="divide-y divide-zinc-800/70">
                                {days.map((d: any) => (
                                    <tr key={d.date} className={`align-top ${d.correction ? (d.correction.direction === "TO_NON_PAYABLE" ? "bg-red-500/[0.04]" : "bg-violet-500/[0.04]") : ""}`} data-testid="sm-day">
                                        <td className="py-2 px-3 whitespace-nowrap"><span className="font-semibold text-white">{dmy(d.date)}</span> <span className="text-zinc-500">{d.weekday}</span>{d.holiday && <span className="block text-[10px] text-sky-300">Holiday</span>}</td>
                                        <td className="py-2 px-3 text-zinc-300 whitespace-nowrap tabular-nums">{d.clockIn || "—"} / {d.clockOut || "—"}</td>
                                        <td className="py-2 px-3 text-zinc-300">{d.attendance}</td>
                                        <td className="py-2 px-3 text-zinc-300">{d.leave || "—"}</td>
                                        <td className="py-2 px-3"><Badge s={d.payableStatus} map={PAY} />{d.correction && <span className="block text-[10px] text-zinc-500 mt-0.5">Records: {d.basePayableStatus}</span>}</td>
                                        <td className="py-2 px-3 tabular-nums text-zinc-200">{d.payableStatus === "Not Employed" ? "—" : n(d.payable)}</td>
                                        <td className="py-2 px-3 text-zinc-400 [overflow-wrap:anywhere]">
                                            {d.correction ? <span className={d.correction.direction === "TO_NON_PAYABLE" ? "text-red-200" : "text-violet-200"}>HR correction ({d.correction.direction === "TO_NON_PAYABLE" ? "non-payable" : "payable"}): {d.correction.correctionCategory} — {d.correction.correctedByName} ({d.correction.correctedByRole}), {dt(d.correction.correctedAt)}<span className="block text-zinc-500">Records: {d.baseReason}</span></span> : d.reason}
                                            {d.penalties.length > 0 && <span className="block text-[10px] text-amber-300/90 mt-0.5">Flags: {d.penalties.join(" · ")}</span>}
                                        </td>
                                        <td className="py-2 px-3 text-right whitespace-nowrap">
                                            {d.correctable && data.canEdit && <button onClick={() => setDialog({ day: d, direction: "TO_PAYABLE" })} data-testid="sm-mark" className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase">Mark Payable</button>}
                                            {d.deductible && !d.correction && data.canEdit && d.payableStatus !== "Upcoming" && <button onClick={() => setDialog({ day: d, direction: "TO_NON_PAYABLE" })} data-testid="sm-mark-np" className="ml-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[10px] font-black uppercase">Mark Non-Payable</button>}
                                            {d.correction && <>
                                                <button onClick={() => setView(monthCorr.find((x: any) => x.id === d.correction.id) || d.correction)} className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-[10px] font-black uppercase mr-1">View</button>
                                                {data.canEdit && <button onClick={() => setReverse({ correction: d.correction, date: d.date, reason: "", busy: false, error: "" })} data-testid="sm-reverse" className="px-2 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-black uppercase">Reverse</button>}
                                            </>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4" data-testid="sm-history">
                    <p className="text-sm font-bold text-white flex items-center gap-2 mb-3"><History size={15} className="text-primary" /> Correction History ({(data.corrections || []).length})</p>
                    {(data.corrections || []).length === 0 ? <p className="text-xs text-zinc-500">No payable-day corrections for this employee.</p> : (
                        <div className="space-y-2">
                            {data.corrections.map((x: any) => (
                                <div key={x.id} className="text-xs rounded-lg border border-zinc-800 px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{dmy(x.date)}</span><Badge s={x.status === "ACTIVE" ? "Active" : "Reversed"} map={{ Active: T_STYLE.Approved, Reversed: T_STYLE.Rejected }} /><span className="text-zinc-400">{x.previousPayableStatus} → {x.updatedPayableStatus || "Payable"} ({x.adjustment > 0 ? "+" : ""}{n(x.adjustment)}) · month {n(x.previousMonthPayable)} → {n(x.updatedMonthPayable)}</span>{x.relatedTicketId && <span className="text-indigo-300">Ticket {x.relatedTicketId}</span>}</div>
                                    <p className="text-zinc-400 mt-1">{x.correctionCategory} — {x.correctedByName} ({x.correctedByRole}) · {dt(x.correctedAt)}</p>
                                    <p className="text-zinc-300 [overflow-wrap:anywhere]">{x.correctionReason}</p>
                                    {x.status === "REVERSED" && <p className="text-red-300 mt-1 [overflow-wrap:anywhere]">Reversed by {x.reversedByName} ({x.reversedByRole}) · {dt(x.reversedAt)} — {x.reversalReason}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>)}
            {dialog && <MarkPayableDialog employee={e} day={dialog.day} direction={dialog.direction} ticketId={ticketId} openTickets={openTickets} categories={dialog.direction === "TO_NON_PAYABLE" ? data.nonPayableCategories : data.categories} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); onMsg({ type: "success", text: m }); load(); }} />}
            {reverse && <ReverseDialog st={reverse} setSt={setReverse} onDone={(m) => { setReverse(null); onMsg({ type: "success", text: m }); load(); }} />}
            {view && <CorrectionView c={view} onClose={() => setView(null)} />}
        </div>
    );
}

function MarkPayableDialog({ employee, day, direction = "TO_PAYABLE", ticketId, openTickets, categories, onClose, onDone }: { employee: any; day: any; direction?: "TO_PAYABLE" | "TO_NON_PAYABLE"; ticketId?: string; openTickets: any[]; categories: string[]; onClose: () => void; onDone: (m: string) => void }) {
    const toPay = direction === "TO_PAYABLE";
    const [category, setCategory] = useState(toPay ? (categories[1] || categories[0]) : categories[0]);
    const [reason, setReason] = useState("");
    const [ticket, setTicket] = useState(ticketId || openTickets.find((t: any) => (t.affectedDates || []).includes(day.date))?.id || "");
    const [files, setFiles] = useState<string[]>([]);
    const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
    const [confirm, setConfirm] = useState(false);
    const okReason = reason.trim().length >= 20 && reason.trim().split(/\s+/).length >= 4;
    const upload = async (fl: FileList | null) => {
        if (!fl?.length) return; setUploading(true); setError("");
        try { const urls: string[] = []; for (const f of Array.from(fl).slice(0, 5 - files.length)) { if (!/^image\/(jpe?g|png|webp)$|^application\/pdf$/.test(f.type)) throw new Error("Upload JPG, PNG, WEBP or PDF files."); urls.push((await uploadToCloudinary(f)).secure_url); } setFiles([...files, ...urls]); }
        catch (e: any) { setError(e.message || "Upload failed"); } finally { setUploading(false); }
    };
    const submit = async () => {
        setBusy(true); setError("");
        try {
            const res = await fetch("/api/hr/salary-management/corrections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: employee.id, date: day.date, direction, category, reason, evidenceUrls: files, ticketId: ticket || undefined }) });
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
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Related Correction Ticket
                        <select value={ticket} onChange={ev => setTicket(ev.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" data-testid="sm-ticket">
                            <option value="">None</option>{openTickets.map((t: any) => <option key={t.id} value={t.id}>{t.id} — {t.category}</option>)}
                        </select>
                    </label>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Correction Category *
                        <select value={category} onChange={ev => setCategory(ev.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" data-testid="sm-category">{categories.map(x => <option key={x}>{x}</option>)}</select>
                    </label>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Reason for Correction *
                        <textarea value={reason} onChange={ev => setReason(ev.target.value)} rows={5} data-testid="sm-reason" placeholder={toPay ? "e.g. The employee was present at the assigned college on this date, but the clock-in was not recorded due to a technical issue. Attendance was verified through the available records." : "e.g. The employee was not present at the college on this date although a clock-in was recorded; verified with the HOI and the gate register."}
                            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white normal-case tracking-normal font-normal" />
                        {!okReason && reason && <span className="normal-case tracking-normal font-normal text-amber-300">Write a full sentence (at least 20 characters).</span>}
                    </label>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Supporting Evidence (optional)</p>
                        <label className="flex items-center justify-center gap-2 border border-dashed border-zinc-700 rounded-lg py-3 text-zinc-400 cursor-pointer hover:border-primary">
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {uploading ? "Uploading…" : "Upload image / PDF"}
                            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={ev => upload(ev.target.files)} disabled={uploading || files.length >= 5} />
                        </label>
                        {files.length > 0 && <p className="text-zinc-400 mt-1">{files.length} file(s) attached</p>}
                    </div>
                    {error && <p className="text-red-400 flex items-center gap-1" data-testid="sm-error"><AlertTriangle size={12} /> {error}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg font-bold text-zinc-400 hover:text-white">Cancel</button>
                        <button disabled={!okReason || uploading} onClick={() => setConfirm(true)} data-testid="sm-next" className="px-5 py-2 rounded-lg bg-primary text-white font-black uppercase tracking-wider disabled:opacity-50">Review</button>
                    </div>
                </>) : (<>
                    <div className={`rounded-xl p-3 space-y-1.5 ${toPay ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
                        {line("Employee", employee.name)}{line("Date", dmy(day.date))}{line("Previous Status", day.payableStatus)}{line("Updated Status", toPay ? "Payable" : "Non-Payable")}
                        {line("Payable Day Adjustment", toPay ? `+${n(day.lop)}` : `−${n(day.payable)}`)}{line("Category", category)}{line("Reason", reason)}{ticket ? line("Ticket", ticket) : null}
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
                {row("Previous Status", c.previousPayableStatus)}{row("Updated Status", c.updatedPayableStatus || "Payable")}{row("Adjustment", c.adjustment !== undefined ? `${c.adjustment > 0 ? "+" : ""}${c.adjustment}` : undefined)}
                {row("Monthly Payable", c.previousMonthPayable !== undefined ? `${c.previousMonthPayable} → ${c.updatedMonthPayable}` : undefined)}
                {row("Category", c.correctionCategory)}{row("Reason", c.correctionReason)}{row("Ticket", c.relatedTicketId)}
                {row("Corrected By", `${c.correctedByName} (${c.correctedByRole})`)}{row("Corrected At", dt(c.correctedAt))}{row("Status", c.status)}
                {(c.supportingEvidence || []).map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block text-primary underline py-1">Evidence {i + 1}</a>)}
            </div>
        </div>
    );
}

// ─────────────────────────── Correction tickets ───────────────────────────
function TicketsPanel({ openId, setOpenId, onMsg, onOpenEmployee }: { openId: string; setOpenId: (s: string) => void; onMsg: (m: any) => void; onOpenEmployee: (id: string, month?: string, ticketId?: string) => void }) {
    const [status, setStatus] = useState("All"); const [q, setQ] = useState("");
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
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"><div className="overflow-x-auto">
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
                        <div className="overflow-x-auto rounded-lg border border-zinc-800">
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