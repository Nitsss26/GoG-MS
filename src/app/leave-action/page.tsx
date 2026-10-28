"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, CalendarDays, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Confirmation page for the "Accept Leave / Reject Leave" buttons in the leave-application e-mail.
 * Opening it changes nothing; the leave is decided only when the approver confirms here.
 */
const dmy = (s?: string) => {
    if (!s) return "—";
    const d = new Date(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("-");
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, "-");
};
const statusLabel = (s: string) => (s === "Pending HOI Approval" ? "Awaiting HOI" : s === "Pending" ? "Awaiting HR" : s);

export default function LeaveActionPage() {
    const [token, setToken] = useState("");
    const [action, setAction] = useState<"approve" | "reject">("approve");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [reason, setReason] = useState("");
    const [applyLOP, setApplyLOP] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ message: string; leave: any } | null>(null);

    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        const t = q.get("t") || "";
        setToken(t);
        if (q.get("a") === "reject") setAction("reject");
        if (!t) { setError("This link is not valid."); return; }
        fetch(`/api/leaves/email-action?t=${encodeURIComponent(t)}`, { cache: "no-store" })
            .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Could not open this leave request."); setData(d); })
            .catch(e => setError(e.message));
    }, []);

    const confirm = async () => {
        setBusy(true); setError("");
        try {
            const r = await fetch("/api/leaves/email-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, action, reason: reason.trim() || undefined, applyLOP: action === "reject" && applyLOP }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                setError(d.error || "Could not save the decision.");
                if (d.leave) setData((prev: any) => ({ ...prev, leave: { ...prev?.leave, ...d.leave }, canDecide: false, processedBy: d.processedBy || "" }));
                return;
            }
            setDone({ message: d.message, leave: d.leave });
        } finally { setBusy(false); }
    };

    const leave = done?.leave || data?.leave;
    const isReject = action === "reject";
    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-5" data-testid="leave-action">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-400" /> Leave Request — {isReject ? "Reject" : "Accept"}</h1>
                <p className="text-xs text-zinc-400 mt-1">Opened from the leave e-mail. Nothing changes until you confirm below.</p>
            </header>

            {!data && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-500" /></div>}

            {leave && (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3" data-testid="leave-action-details">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-base font-bold text-white">{leave.employeeName}</p>
                            <p className="text-[11px] text-zinc-500">{leave.employeeId}{leave.designation ? ` · ${leave.designation}` : ""}{leave.dept ? ` · ${leave.dept}` : ""}</p>
                        </div>
                        <span data-testid="leave-action-status" className={cn("px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap",
                            leave.status === "Approved" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" : leave.status === "Rejected" ? "text-red-300 bg-red-500/10 border-red-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30")}>{statusLabel(leave.status)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        {([
                            ["Leave type", `${leave.type}${leave.leaveType ? ` (${leave.leaveType})` : ""}`],
                            ["Total days", String(leave.days)],
                            ["From", dmy(leave.startDate)],
                            ["To", dmy(leave.endDate)],
                            ["Applied on", dmy(leave.appliedAt)],
                            ["Proof attached", leave.proofCount ? `${leave.proofCount} file(s)` : "None"],
                        ] as [string, string][]).map(([k, v]) => <div key={k}><p className="text-[10px] uppercase tracking-widest text-zinc-500">{k}</p><p className="text-zinc-200 mt-0.5 flex items-center gap-1">{k === "From" || k === "To" ? <CalendarDays size={11} className="text-zinc-500" /> : null}{v}</p></div>)}
                    </div>
                    <div className="text-xs"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Reason</p><p className="text-zinc-200 mt-0.5 whitespace-pre-wrap">{leave.reason || "—"}</p></div>
                    {leave.reasonForAction && !leave.status?.startsWith("Pending") && <div className="text-xs"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Decision remarks</p><p className="text-zinc-300 mt-0.5">{leave.reasonForAction}</p></div>}
                </section>
            )}

            {done ? (
                <div className={cn("rounded-2xl border p-5 flex items-start gap-3", done.leave.status === "Rejected" ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10")} data-testid="leave-action-done">
                    {done.leave.status === "Rejected" ? <XCircle className="text-red-400 shrink-0" size={20} /> : <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />}
                    <div><p className="text-sm font-bold text-white">{done.message}</p><p className="text-xs text-zinc-400 mt-1">The leave is updated in GOG OMS and the employee has been informed.</p>
                        <Link href="/leave" className="inline-block mt-3 text-xs font-bold text-emerald-300 hover:underline">Open Leave in GOG OMS →</Link></div>
                </div>
            ) : data && !data.canDecide ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-3" data-testid="leave-action-blocked">
                    <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                    <div><p className="text-sm font-bold text-white">{error || data.message}</p>
                        {data.processedBy && <p className="text-xs text-zinc-400 mt-1">Decided by {data.processedBy}.</p>}
                        <Link href="/leave" className="inline-block mt-3 text-xs font-bold text-emerald-300 hover:underline">Open Leave in GOG OMS →</Link></div>
                </div>
            ) : data?.canDecide ? (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4" data-testid="leave-action-confirm">
                    <div className="flex gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 w-fit">
                        <button onClick={() => setAction("approve")} data-testid="choose-approve" className={cn("px-4 py-1.5 rounded-lg text-xs font-bold", !isReject ? "bg-emerald-600 text-white" : "text-zinc-400")}>Accept</button>
                        <button onClick={() => setAction("reject")} data-testid="choose-reject" className={cn("px-4 py-1.5 rounded-lg text-xs font-bold", isReject ? "bg-red-600 text-white" : "text-zinc-400")}>Reject</button>
                    </div>
                    <p className="text-xs text-zinc-300">
                        {isReject ? "Reject" : "Approve"} this leave as <span className="font-bold text-white">{data.approver?.name}</span> ({data.approver?.role})
                        {data.step === "hoi" ? (isReject ? " — the request is closed as rejected." : " — this approves the HOI step; the request then goes to HR for the final approval.") : (isReject ? "." : " — final approval.")}
                    </p>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} data-testid="leave-action-reason" maxLength={1000}
                        placeholder={isReject ? "Reason for rejection (optional)" : "Remarks (optional)"}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 resize-none h-20" />
                    {isReject && data.step === "hoi" && (
                        <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={applyLOP} onChange={e => setApplyLOP(e.target.checked)} className="w-4 h-4" /> Invalid proof — apply 2-day Loss of Pay{leave?.leaveType === "Emergency" ? " (applied automatically for an emergency leave)" : ""}</label>
                    )}
                    {error && <p className="text-xs text-red-400 flex items-center gap-1.5" data-testid="leave-action-error"><AlertTriangle size={12} /> {error}</p>}
                    <button disabled={busy} onClick={confirm} data-testid="leave-action-submit"
                        className={cn("w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50", isReject ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500")}>
                        {busy ? <Loader2 size={15} className="animate-spin" /> : isReject ? <XCircle size={15} /> : <CheckCircle2 size={15} />} Confirm {isReject ? "Rejection" : "Approval"}
                    </button>
                </section>
            ) : error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3" data-testid="leave-action-error-box">
                    <AlertTriangle className="text-red-400 shrink-0" size={20} />
                    <div><p className="text-sm font-bold text-white">{error}</p><Link href="/leave" className="inline-block mt-3 text-xs font-bold text-emerald-300 hover:underline">Open Leave in GOG OMS →</Link></div>
                </div>
            ) : null}
        </div>
    );
}