"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search, X, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_STYLE } from "./MyAttendanceAlerts";

/**
 * HR → Attendance → Attendance Violations: per-employee counts (Late Clock-In / Early Clock-Out / Missing Clock-Out),
 * warning level, proposed deduction, email status, HR verification, and the full history with HR actions.
 * Data and permission checks: /api/attendance/violations (HR / Founder only).
 */
const TYPE: Record<string, string> = { LATE_IN: "Late Clock-In", EARLY_OUT: "Early Clock-Out", MISSING_OUT: "Missing Clock-Out" };
const LEVEL: Record<string, string> = { FIRST_WARNING: "First Warning", SECOND_WARNING: "Second Warning", FINAL_WARNING: "Final Warning", HALF_DAY: "Half-Day", FULL_DAY: "Full-Day", MISSING_ALERT: "Alert" };
const EMAIL_STYLE: Record<string, string> = { Sent: "text-emerald-300", Failed: "text-red-400", Pending: "text-amber-300", Sending: "text-amber-300" };
const fmtDate = (d: string) => d.split("-").reverse().join("-");
const t12 = (t?: string) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return isNaN(h) ? t : `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
const dur = (m?: number) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export default function AttendanceViolationsBoard() {
    const [period, setPeriod] = useState(() => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7));
    const [data, setData] = useState<{ violations: any[]; summary: any[] } | null>(null);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [type, setType] = useState("All");
    const [hrFilter, setHrFilter] = useState("All");
    const [open, setOpen] = useState<any | null>(null);
    const [busy, setBusy] = useState("");
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/attendance/violations?view=all&period=${period}`, { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load attendance violations.");
            setData(d); setError("");
        } catch (e: any) { setError(e.message); setData({ violations: [], summary: [] }); }
    }, [period]);
    useEffect(() => { setData(null); load(); }, [load]);

    const shown = useMemo(() => (data?.violations || []).filter(v =>
        (!q || `${v.employeeName} ${v.employeeId}`.toLowerCase().includes(q.toLowerCase())) &&
        (type === "All" || v.type === type) && (hrFilter === "All" || v.hrStatus === hrFilter)), [data, q, type, hrFilter]);
    const summary = useMemo(() => (data?.summary || []).filter(s => !q || `${s.employeeName} ${s.employeeId}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

    const act = async (v: any, action: string) => {
        let remarks = "";
        if (action === "reject" || action === "waive" || action === "payroll" || action === "approve") {
            const p = window.prompt(action === "reject" ? "Reason for rejecting the explanation:" : "Remarks (optional):", "");
            if (p === null) return;
            remarks = p.trim();
            if (action === "reject" && remarks.length < 3) { setMsg("Please give the reason."); return; }
        }
        setBusy(v.id + action); setMsg("");
        try {
            const r = await fetch(`/api/attendance/violations/${v.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, remarks }) });
            const d = await r.json();
            setMsg(r.ok ? (d.message || `Saved${d.emailed === false ? " — the email to the employee failed" : ""}.`) : (d.error || "Could not save."));
            if (r.ok) { setOpen(null); await load(); }
        } finally { setBusy(""); }
    };

    const field = "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 [color-scheme:dark]";
    const Actions = ({ v }: { v: any }) => (
        <div className="flex flex-wrap gap-1">
            <button onClick={() => setOpen(v)} className="text-[10px] font-bold text-zinc-200 border border-zinc-700 rounded-lg px-2 py-1" data-testid="viol-view">View</button>
            {v.type === "MISSING_OUT" && ["Awaiting Explanation", "Pending HR Verification"].includes(v.hrStatus) && <>
                <button disabled={!!busy} onClick={() => act(v, "approve")} className="text-[10px] font-bold text-emerald-300 border border-emerald-500/30 rounded-lg px-2 py-1 disabled:opacity-50" data-testid="viol-approve">Approve</button>
                <button disabled={!!busy} onClick={() => act(v, "reject")} className="text-[10px] font-bold text-red-300 border border-red-500/30 rounded-lg px-2 py-1 disabled:opacity-50" data-testid="viol-reject">Reject</button>
            </>}
            {v.type !== "MISSING_OUT" && v.hrStatus === "Pending HR Verification" && <>
                <button disabled={!!busy} onClick={() => act(v, "payroll")} className="text-[10px] font-bold text-red-300 border border-red-500/30 rounded-lg px-2 py-1 disabled:opacity-50" data-testid="viol-payroll">Approve for Payroll</button>
                <button disabled={!!busy} onClick={() => act(v, "waive")} className="text-[10px] font-bold text-emerald-300 border border-emerald-500/30 rounded-lg px-2 py-1 disabled:opacity-50" data-testid="viol-waive">Waive</button>
            </>}
            {v.emailStatus === "Failed" && <button disabled={!!busy} onClick={() => act(v, "resend")} className="text-[10px] font-bold text-amber-300 border border-amber-500/30 rounded-lg px-2 py-1 flex items-center gap-1 disabled:opacity-50" data-testid="viol-resend"><RefreshCw size={10} /> Resend</button>}
        </div>
    );

    return (
        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4" data-testid="viol-board">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> Attendance Violations</h2>
                <p className="text-[10px] text-zinc-500">Counts are per calendar month. Deductions are only proposed until HR approves them for payroll.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
                <input type="month" value={period} onChange={e => e.target.value && setPeriod(e.target.value)} className={field} data-testid="viol-period" />
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Employee name or ID" className={cn(field, "w-full pl-8")} data-testid="viol-search" />
                </div>
                <select value={type} onChange={e => setType(e.target.value)} className={field} data-testid="viol-type">
                    <option value="All">All violations</option>{Object.entries(TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={hrFilter} onChange={e => setHrFilter(e.target.value)} className={field} data-testid="viol-hr">
                    <option value="All">All HR statuses</option>{["Not Required", "Awaiting Explanation", "Pending HR Verification", "Approved for Payroll", "Waived", "Approved", "Rejected"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            {msg && <p className="text-[11px] text-zinc-300" data-testid="viol-msg">{msg}</p>}
            {error && <p className="text-[11px] text-red-400">{error}</p>}

            {/* Per-employee summary */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs min-w-[980px]" data-testid="viol-summary">
                    <thead><tr className="bg-zinc-800/40 text-[9px] text-zinc-400 uppercase tracking-widest text-left">
                        {["Employee", "Late Clock-In", "Early Clock-Out", "Missing Clock-Out", "Warning Level", "Proposed Deduction", "Email", "HR Verification"].map(h => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {data === null && <tr><td colSpan={8} className="py-8 text-center"><Loader2 size={16} className="animate-spin text-zinc-500 inline" /></td></tr>}
                        {data && !summary.length && <tr><td colSpan={8} className="py-8 text-center text-zinc-500">No attendance violations in this month.</td></tr>}
                        {summary.map(s => (
                            <tr key={s.employeeId} data-testid="viol-sum-row" data-emp={s.employeeId} className="hover:bg-zinc-800/20">
                                <td className="px-3 py-2.5"><button onClick={() => setQ(s.employeeId)} className="text-left"><p className="font-bold text-white hover:text-amber-300">{s.employeeName}</p><p className="text-[10px] text-zinc-500 font-mono">{s.employeeId}</p></button></td>
                                <td className="px-3 py-2.5 text-white font-bold" data-testid="viol-late">{s.LATE_IN}</td>
                                <td className="px-3 py-2.5 text-white font-bold" data-testid="viol-early">{s.EARLY_OUT}</td>
                                <td className="px-3 py-2.5 text-white font-bold" data-testid="viol-missing">{s.MISSING_OUT}</td>
                                <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{[s.lateLevel && `Late: ${LEVEL[s.lateLevel]}`, s.earlyLevel && `Early: ${LEVEL[s.earlyLevel]}`].filter(Boolean).join(" · ") || "—"}</td>
                                <td className="px-3 py-2.5 text-red-300 max-w-[220px]">{s.proposed.length ? s.proposed.join(", ") : <span className="text-zinc-600">None</span>}</td>
                                <td className="px-3 py-2.5">{s.emailFailed ? <span className="text-red-400 font-bold">{s.emailFailed} failed</span> : <span className={EMAIL_STYLE[s.lastEmailStatus] || "text-zinc-400"}>{s.lastEmailStatus || "—"}</span>}</td>
                                <td className="px-3 py-2.5">{s.pendingHr ? <span className="text-amber-300 font-bold">{s.pendingHr} pending</span> : <span className="text-zinc-500">Up to date</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* History */}
            <h3 className="text-xs font-bold text-zinc-300 pt-1">Attendance Violation History</h3>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs min-w-[1150px]" data-testid="viol-history">
                    <thead><tr className="bg-zinc-800/40 text-[9px] text-zinc-400 uppercase tracking-widest text-left">
                        {["Date", "Employee", "Violation", "Scheduled", "Actual", "Duration", "Instance", "Level", "Proposed", "Email", "HR Status", "Actions"].map(h => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {data && !shown.length && <tr><td colSpan={12} className="py-8 text-center text-zinc-500">No records.</td></tr>}
                        {shown.map(v => (
                            <tr key={v.id} data-testid="viol-row" data-emp={v.employeeId} data-type={v.type} data-instance={v.instance} className="hover:bg-zinc-800/20">
                                <td className="px-3 py-2.5 text-white whitespace-nowrap">{fmtDate(v.date)}</td>
                                <td className="px-3 py-2.5"><p className="text-white">{v.employeeName}</p><p className="text-[10px] text-zinc-500 font-mono">{v.employeeId}</p></td>
                                <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{TYPE[v.type]}</td>
                                <td className="px-3 py-2.5 text-zinc-400">{t12(v.scheduledTime)}</td>
                                <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{v.type === "MISSING_OUT" ? (v.laterClockOut ? `Out ${t12(v.laterClockOut)}` : "No clock-out") : t12(v.actualTime)}</td>
                                <td className="px-3 py-2.5 text-zinc-400">{v.type === "MISSING_OUT" ? "—" : dur(v.durationMins)}</td>
                                <td className="px-3 py-2.5 text-white font-bold">{v.instance}</td>
                                <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{LEVEL[v.level] || v.level}</td>
                                <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{v.proposedDeduction}</td>
                                <td className={cn("px-3 py-2.5 font-bold", EMAIL_STYLE[v.emailStatus] || "text-zinc-400")} data-testid="viol-email" title={v.emailError || ""}>{v.emailStatus}</td>
                                <td className="px-3 py-2.5"><span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", STATUS_STYLE[v.hrStatus] || STATUS_STYLE["Not Required"])} data-testid="viol-hrstatus">{v.hrStatus}</span></td>
                                <td className="px-3 py-2.5"><Actions v={v} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="viol-detail">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(null)} />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white">{TYPE[open.type]} – {fmtDate(open.date)}</h3>
                            <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                        </div>
                        {([
                            ["Employee", `${open.employeeName} (${open.employeeId})`], ["Email", open.email || "—"],
                            ["Scheduled", t12(open.scheduledTime)], [open.type === "MISSING_OUT" ? "Clock-In" : "Actual", t12(open.actualTime)],
                            ["Instance", String(open.instance)], ["Level", LEVEL[open.level] || open.level], ["Proposed deduction", open.proposedDeduction],
                            ["Email status", `${open.emailStatus}${open.emailSentAt ? ` · ${new Date(open.emailSentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}${open.emailError ? ` · ${open.emailError}` : ""}`],
                            ["HR status", open.hrStatus + (open.hrDecisionByName ? ` by ${open.hrDecisionByName}` : "")], ["HR remarks", open.hrRemarks || "—"],
                            ...(open.type === "MISSING_OUT" ? [["Explanation", open.explanation || "Not submitted yet"], ["Later clock-out", open.laterClockOut ? t12(open.laterClockOut) : "—"]] : []),
                        ] as [string, string][]).map(([k, val]) => <div key={k} className="grid grid-cols-[8rem_1fr] gap-2"><span className="text-zinc-500">{k}</span><span className="text-zinc-200 break-words">{val}</span></div>)}
                        {(open.proofUrls || []).map((u: string, i: number) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-amber-300 hover:underline" data-testid="viol-proof"><ExternalLink size={12} /> Proof {i + 1}</a>)}
                        <div className="pt-2 border-t border-zinc-800"><Actions v={open} /></div>
                    </div>
                </div>
            )}
        </div>
    );
}