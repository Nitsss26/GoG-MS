"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, FileText, X, CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDmy, t12, fmtMins, JUSTIFICATION_LABEL, JUSTIFICATION_STYLE } from "@/components/attendance/LateJustification";

/**
 * HR → Attendance → Late Clock-In Justifications.
 * HR and HR Executive see and use exactly the same board (same API, same rules); either one's decision is final.
 * The list refreshes every 30 seconds, so a decision by one shows up for the other.
 */
const TABS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"]] as const;
const isImage = (u: string) => /\.(jpe?g|png)(\?|#|$)/i.test(u);

export default function LateJustificationsBoard() {
    const [tab, setTab] = useState<string>("pending");
    const [rows, setRows] = useState<any[] | null>(null);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [open, setOpen] = useState<any | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState("");
    const [q, setQ] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/hr/attendance/late-justifications${tab ? `?status=${tab}` : ""}`, { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load the justifications.");
            setRows(d.justifications || []); setError("");
        } catch (e: any) { setError(e.message); setRows([]); }
    }, [tab]);
    useEffect(() => { setRows(null); load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

    const decide = async (action: "approve" | "reject") => {
        if (!open) return;
        if (action === "reject" && reason.trim().length < 3) { setError("Please give the reason for rejection."); return; }
        setBusy(action); setError("");
        try {
            const r = await fetch("/api/hr/attendance/late-justifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: open.id, action, reason: reason.trim() || undefined }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                setError(d.error || "Could not save the decision.");
                if (d.justification) setOpen(d.justification);
                await load();
                return;
            }
            setMsg(d.message); setOpen(null); setReason(""); await load();
        } finally { setBusy(""); }
    };

    const shown = (rows || []).filter(r => !q || `${r.employeeName} ${r.employeeId}`.toLowerCase().includes(q.toLowerCase()));
    return (
        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4" data-testid="late-justifications-board">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2"><Clock size={16} className="text-amber-400" /> Late Clock-In Justifications</h2>
                <div className="flex gap-1 p-1 rounded-lg bg-zinc-950/60 border border-zinc-800 sm:ml-auto">
                    {TABS.map(([k, l]) => <button key={l} onClick={() => setTab(k)} data-testid={`lj-tab-${l.toLowerCase()}`} className={cn("px-3 py-1 rounded-md text-[11px] font-bold", tab === k ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white")}>{l}</button>)}
                </div>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Employee name or ID" className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500/50 w-48" />
                <button onClick={load} className="text-zinc-400 hover:text-white" title="Refresh"><RefreshCw size={14} /></button>
            </div>
            {msg && <p className="text-[11px] text-emerald-300" data-testid="lj-msg">{msg}</p>}
            {error && !open && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-xs min-w-[1150px]">
                    <thead><tr className="bg-zinc-800/40 text-[9px] text-zinc-400 uppercase tracking-widest text-left">
                        {["Employee", "Department", "Attendance Date", "Scheduled Clock-In", "Actual Clock-In", "Late Duration", "Submitted Reason", "Supporting Document", "Request Status", "Action"].map(h => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {rows === null && <tr><td colSpan={10} className="py-8 text-center"><Loader2 size={16} className="animate-spin text-zinc-500 inline" /></td></tr>}
                        {rows !== null && !shown.length && <tr><td colSpan={10} className="py-8 text-center text-zinc-500">No {tab ? JUSTIFICATION_LABEL[tab]?.toLowerCase() : ""} late clock-in justifications.</td></tr>}
                        {shown.map(r => (
                            <tr key={r.id} data-testid="lj-row" data-id={r.id} className="hover:bg-zinc-800/20">
                                <td className="px-3 py-2.5"><p className="font-bold text-white">{r.employeeName}</p><p className="text-[10px] text-zinc-500 font-mono">{r.employeeId}</p></td>
                                <td className="px-3 py-2.5 text-zinc-400">{r.department || "—"}</td>
                                <td className="px-3 py-2.5 text-white whitespace-nowrap">{fmtDmy(r.date)}</td>
                                <td className="px-3 py-2.5 text-zinc-300">{t12(r.scheduledClockIn)}</td>
                                <td className="px-3 py-2.5 text-zinc-300">{t12(r.actualClockIn)}</td>
                                <td className="px-3 py-2.5 text-amber-300 font-bold whitespace-nowrap">{fmtMins(r.lateDurationMinutes)}</td>
                                <td className="px-3 py-2.5 text-zinc-300 max-w-[220px]"><span className="line-clamp-2" title={r.justificationReason}>{r.justificationReason}</span></td>
                                <td className="px-3 py-2.5">{r.supportingDocument ? <a href={r.supportingDocument} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1"><FileText size={12} /> View</a> : <span className="text-zinc-600">None</span>}</td>
                                <td className="px-3 py-2.5">
                                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", JUSTIFICATION_STYLE[r.justificationStatus])} data-testid="lj-status">{JUSTIFICATION_LABEL[r.justificationStatus]}</span>
                                    {r.reviewedByName && <p className="text-[9px] text-zinc-500 mt-1 whitespace-nowrap" data-testid="lj-reviewer">by {r.reviewedByName} ({r.reviewedByRole})</p>}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                    <button onClick={() => { setOpen(r); setReason(""); setError(""); setMsg(""); }} data-testid="lj-open"
                                        className={cn("text-[10px] font-bold rounded-lg px-2.5 py-1 border", r.justificationStatus === "pending" ? "text-amber-200 border-amber-500/40 hover:bg-amber-500/10" : "text-zinc-300 border-zinc-700 hover:border-zinc-500")}>
                                        {r.justificationStatus === "pending" ? "Review" : "View"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="lj-detail">
                    <div className="absolute inset-0 bg-black/80" onClick={() => !busy && setOpen(null)} />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Clock size={14} className="text-amber-400" /> Late Clock-In Justification</h3>
                            <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                            {([["Employee", `${open.employeeName} (${open.employeeId})`], ["Department", open.department || "—"], ["Attendance Date", fmtDmy(open.date)], ["Late Duration", fmtMins(open.lateDurationMinutes)],
                            ["Scheduled Clock-In", t12(open.scheduledClockIn)], ["Actual Clock-In", t12(open.actualClockIn)]] as [string, string][]).map(([k, v]) =>
                                <div key={k}><p className="text-[9px] uppercase tracking-widest text-zinc-500">{k}</p><p className="text-zinc-200 mt-0.5">{v}</p></div>)}
                        </div>
                        <div><p className="text-[9px] uppercase tracking-widest text-zinc-500">Submitted reason</p><p className="text-zinc-100 mt-0.5 whitespace-pre-wrap">{open.justificationReason}</p></div>
                        <div>
                            <p className="text-[9px] uppercase tracking-widest text-zinc-500">Supporting document</p>
                            {open.supportingDocument ? (
                                <div className="mt-1 space-y-2">
                                    {isImage(open.supportingDocument) && <img src={open.supportingDocument} alt="Supporting document" className="max-h-56 rounded-lg border border-zinc-800" />}
                                    <a href={open.supportingDocument} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline" data-testid="lj-doc"><ExternalLink size={12} /> Open / download</a>
                                </div>
                            ) : <p className="text-zinc-500 mt-0.5">None</p>}
                        </div>
                        {open.justificationStatus === "pending" ? (
                            <>
                                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={1000} placeholder="Remarks (required to reject)" data-testid="lj-reason"
                                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white outline-none focus:border-amber-500/50 resize-none" />
                                {error && <p className="text-[11px] text-red-400 flex items-center gap-1" data-testid="lj-error"><AlertTriangle size={12} /> {error}</p>}
                                <div className="flex gap-2">
                                    <button disabled={!!busy} onClick={() => decide("approve")} data-testid="lj-approve" className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                                        {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve Justification</button>
                                    <button disabled={!!busy} onClick={() => decide("reject")} data-testid="lj-reject" className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                                        {busy === "reject" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject Justification</button>
                                </div>
                                <p className="text-[10px] text-zinc-500">Approve: the day becomes a Normal Clock-In (late flag removed, the clock-in time stays {t12(open.actualClockIn)}). Reject: the Late Clock-In stays.</p>
                            </>
                        ) : (
                            <div className="rounded-xl border border-zinc-800 p-3 space-y-1" data-testid="lj-processed">
                                {error && <p className="text-[11px] text-amber-300 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
                                <p><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", JUSTIFICATION_STYLE[open.justificationStatus])}>{JUSTIFICATION_LABEL[open.justificationStatus]}</span></p>
                                <p className="text-zinc-300">By {open.reviewedByName} ({open.reviewedByRole}){open.reviewedAt ? ` · ${new Date(open.reviewedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                                {open.rejectionReason && <p className="text-red-300">Reason: {open.rejectionReason}</p>}
                                <p className="text-zinc-500">Original record: clock-in {t12(open.actualClockIn)}, scheduled {t12(open.scheduledClockIn)} — late {fmtMins(open.lateDurationMinutes)}.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}