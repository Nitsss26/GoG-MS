"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, X, Loader2, CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { WFH_TYPE_LABEL, WFH_STATUS_STYLE } from "@/lib/wfh-policy";
import { useAuth } from "@/context/AuthContext";

/**
 * Work From Home applications for approvers (HR Leave Management → "Work From Home Applications",
 * Manager Suite → Leave Approval). The server returns only what this user may see and decides who may act.
 */
const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmtTs = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const ROLE_LABEL: Record<string, string> = { HR_EXECUTIVE: "HR Executive", TECH_TEAM: "Tech Team", MARKETING_TEAM: "Marketing Team", TL: "Tech Lead", CURRICULUM_LEAD: "CL", CURRICULUM_HEAD: "CH", FACULTY: "Professor", PROFESSOR: "Professor" };

export default function WfhApprovalBoard() {
    const { refreshApprovedWfh } = useAuth();
    const [apps, setApps] = useState<any[] | null>(null);
    const [status, setStatus] = useState("All"); // all applications; pending ones are listed first
    const [dept, setDept] = useState("All");
    const [date, setDate] = useState("");
    const [q, setQ] = useState("");
    const [review, setReview] = useState<any | null>(null);
    const [remarks, setRemarks] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/wfh?view=queue", { cache: "no-store" });
            const d = await r.json();
            setApps(Array.isArray(d.applications) ? d.applications : []);
        } catch { setApps([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const depts = useMemo(() => Array.from(new Set((apps || []).map(a => a.dept).filter(Boolean))).sort(), [apps]);
    const rows = (apps || []).filter(a => (status === "All" || a.status === status) && (dept === "All" || a.dept === dept)
        && (!date || (a.startDate <= date && date <= a.endDate)) && (!q.trim() || `${a.employeeName} ${a.employeeId}`.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((x, y) => (x.status === "Pending" ? 0 : 1) - (y.status === "Pending" ? 0 : 1)); // stable: newest first inside each group
    const history = review ? (apps || []).filter(a => a.employeeId === review.employeeId && a.id !== review.id) : [];

    const decide = async (action: "approve" | "reject") => {
        if (!review) return;
        setBusy(true); setError("");
        try {
            const r = await fetch("/api/wfh", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: review.id, action, remarks }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Action failed.");
            setReview(null); setRemarks(""); setToast(d.message); setTimeout(() => setToast(""), 4000); load(); refreshApprovedWfh();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };

    const sel = "bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none";
    return (
        <div className="space-y-4" data-testid="wfh-board">
            {toast && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs px-4 py-3 flex items-center gap-2" data-testid="wfh-board-toast"><CheckCircle2 size={14} /> {toast}</div>}
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[12rem]">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee name or ID…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white outline-none" data-testid="wfh-board-search" />
                </div>
                <select value={status} onChange={e => setStatus(e.target.value)} className={sel} data-testid="wfh-board-status">
                    {["Pending", "Approved", "Rejected", "Cancelled", "All"].map(s => <option key={s} value={s}>{s === "All" ? "Status: All" : s}</option>)}
                </select>
                <select value={dept} onChange={e => setDept(e.target.value)} className={sel} data-testid="wfh-board-dept">
                    <option value="All">Department: All</option>{depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(sel, "[color-scheme:dark]")} title="Applications covering this date" data-testid="wfh-board-date" />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40">
                <table className="w-full min-w-[900px] text-xs">
                    <thead className="bg-zinc-950/70"><tr className="text-[9px] text-zinc-500 uppercase tracking-widest text-left">
                        <th className="py-2.5 px-3">Employee</th><th className="py-2.5 px-3">Role</th><th className="py-2.5 px-3">WFH Dates</th><th className="py-2.5 px-3">Type</th><th className="py-2.5 px-3">Reason</th><th className="py-2.5 px-3">Status</th><th className="py-2.5 px-3">Approved / Rejected By</th><th className="py-2.5 px-3 text-right">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {rows.map(a => (
                            <tr key={a.id} data-testid="wfh-board-row" data-id={a.id}>
                                <td className="py-2.5 px-3"><p className="font-bold text-white">{a.employeeName}</p><p className="text-[10px] text-zinc-500 font-mono">{a.employeeId}{a.dept ? ` · ${a.dept}` : ""}</p></td>
                                <td className="py-2.5 px-3 text-zinc-300">{ROLE_LABEL[a.employeeRole] || a.employeeRole}</td>
                                <td className="py-2.5 px-3 text-zinc-200">{a.startDate === a.endDate ? fmt(a.startDate) : `${fmt(a.startDate)} – ${fmt(a.endDate)}`}</td>
                                <td className="py-2.5 px-3 text-zinc-300">{WFH_TYPE_LABEL[a.wfhType]}</td>
                                <td className="py-2.5 px-3 text-zinc-400 max-w-[220px] truncate" title={a.reason}>{a.reason}</td>
                                <td className="py-2.5 px-3"><span className={cn("px-2 py-0.5 rounded border text-[10px] font-bold", WFH_STATUS_STYLE[a.status])}>{a.status}</span></td>
                                <td className="py-2.5 px-3" data-testid="wfh-board-decider">{a.approverName && a.status !== "Pending"
                                    ? <><p className="text-zinc-200 font-semibold">{a.approverName}</p><p className="text-[10px] text-zinc-500">{ROLE_LABEL[a.approverRole] || a.approverRole || ""}{a.decidedAt ? ` · ${fmtTs(a.decidedAt)}` : ""}</p></>
                                    : <span className="text-zinc-600">—</span>}</td>
                                <td className="py-2.5 px-3 text-right">
                                    <button onClick={() => { setReview(a); setRemarks(""); setError(""); }} data-testid="wfh-review"
                                        className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold">{a.canDecide ? "Review" : "View"}</button>
                                </td>
                            </tr>
                        ))}
                        {apps === null && <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="animate-spin text-primary inline" size={16} /></td></tr>}
                        {apps !== null && !rows.length && <tr><td colSpan={8} className="py-10 text-center text-zinc-500">No Work From Home applications.</td></tr>}
                    </tbody>
                </table>
            </div>

            {review && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setReview(null)}>
                    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="wfh-review-modal">
                        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Home size={15} className="text-emerald-400" /> Work From Home · {review.id}</h3>
                            <button onClick={() => setReview(null)} className="text-zinc-500 hover:text-white"><X size={17} /></button>
                        </div>
                        <div className="p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-[7rem_1fr] gap-y-1.5">
                                <span className="text-zinc-500">Employee</span><span className="text-white font-bold">{review.employeeName} <span className="text-zinc-500 font-mono font-normal">({review.employeeId})</span></span>
                                <span className="text-zinc-500">Role</span><span className="text-zinc-300">{ROLE_LABEL[review.employeeRole] || review.employeeRole}{review.designation ? ` · ${review.designation}` : ""}</span>
                                <span className="text-zinc-500">Department</span><span className="text-zinc-300">{review.dept || "—"}</span>
                                <span className="text-zinc-500">Dates</span><span className="text-zinc-200">{review.startDate === review.endDate ? fmt(review.startDate) : `${fmt(review.startDate)} – ${fmt(review.endDate)}`} · {review.days} day(s) · {WFH_TYPE_LABEL[review.wfhType]}</span>
                                <span className="text-zinc-500">Reason</span><span className="text-zinc-200">{review.reason}</span>
                                {review.remarks && <><span className="text-zinc-500">Remarks</span><span className="text-zinc-300">{review.remarks}</span></>}
                                <span className="text-zinc-500">Applied</span><span className="text-zinc-400">{fmtTs(review.createdAt)}</span>
                                <span className="text-zinc-500">Status</span><span><span className={cn("px-2 py-0.5 rounded border text-[10px] font-bold", WFH_STATUS_STYLE[review.status])}>{review.status}</span></span>
                                {review.approverName && <><span className="text-zinc-500">Decision</span><span className="text-zinc-300">{review.status} by {review.approverName} ({ROLE_LABEL[review.approverRole] || review.approverRole}) · {fmtTs(review.decidedAt)}{review.decisionRemarks ? ` — “${review.decisionRemarks}”` : ""}</span></>}
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Employee history</p>
                                {history.length ? history.map(h => (
                                    <div key={h.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-1.5">
                                        <span className="text-zinc-300">{h.startDate === h.endDate ? fmt(h.startDate) : `${fmt(h.startDate)} – ${fmt(h.endDate)}`} · {WFH_TYPE_LABEL[h.wfhType]}</span>
                                        <span className={cn("px-2 py-0.5 rounded border text-[10px] font-bold", WFH_STATUS_STYLE[h.status])}>{h.status}</span>
                                    </div>
                                )) : <p className="text-zinc-500">No other applications.</p>}
                            </div>
                            {review.canDecide && (
                                <div className="space-y-2">
                                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Remarks (required to reject)" data-testid="wfh-decision-remarks"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none" />
                                    {error && <p className="text-[11px] text-red-400 flex items-center gap-1.5" data-testid="wfh-decision-error"><AlertTriangle size={12} /> {error}</p>}
                                    <div className="flex gap-2">
                                        <button disabled={busy} onClick={() => decide("reject")} data-testid="wfh-reject" className="flex-1 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"><XCircle size={13} /> Reject</button>
                                        <button disabled={busy} onClick={() => decide("approve")} data-testid="wfh-approve" className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve</button>
                                    </div>
                                </div>
                            )}
                            {!review.canDecide && review.status === "Pending" && <p className="text-[11px] text-zinc-500">You cannot decide this application (your own, or outside your approval scope).</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}