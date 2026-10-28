"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page behind the "Accept Leave / Reject Leave" buttons in the leave-application e-mail.
 * It opens in GOG OMS (the login page first, then back here); the decision is saved straight away (POST) —
 * one click — and the leave then shows its new status everywhere in GOG OMS.
 */
const dmy = (s?: string) => {
    if (!s) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("-");
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, "-");
};
const statusLabel = (s: string) => (s === "Pending HOI Approval" ? "Awaiting HOI" : s === "Pending" ? "Awaiting HR" : s);

export default function LeaveActionPage() {
    const [action, setAction] = useState<"approve" | "reject">("approve");
    const [state, setState] = useState<"loading" | "saving" | "done" | "blocked" | "error">("loading");
    const [leave, setLeave] = useState<any>(null);
    const [message, setMessage] = useState("");
    const [by, setBy] = useState("");
    const [link, setLink] = useState<{ t: string; a: "approve" | "reject" } | null>(null);
    const [wrongUser, setWrongUser] = useState(false);
    // Logged in with another account: log out, then log in with the right one and come back here
    const switchAccount = async () => {
        try { sessionStorage.setItem("gog_after_login", window.location.pathname + window.location.search); } catch { /* ignore */ }
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.href = "/login";
    };
    const ran = useRef(false);

    const decide = async (t: string, a: "approve" | "reject") => {
        setState("saving");
        try {
            const r = await fetch("/api/leaves/email-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, action: a }) });
            const d = await r.json().catch(() => ({}));
            if (d.leave) setLeave((p: any) => ({ ...p, ...d.leave }));
            if (r.ok) { setMessage(d.message); setState("done"); return; }
            setMessage(d.error || "Could not save the decision."); setBy(d.processedBy || "");
            setState(r.status === 409 || r.status === 403 || r.status === 410 ? "blocked" : "error");
        } catch { setMessage("Could not reach GOG OMS. Please try again."); setState("error"); }
    };

    useEffect(() => {
        if (ran.current) return; ran.current = true;
        const q = new URLSearchParams(window.location.search);
        const t = q.get("t") || "";
        const a: "approve" | "reject" = q.get("a") === "reject" ? "reject" : "approve";
        setAction(a); setLink({ t, a });
        if (!t) { setMessage("This link is not valid."); setState("blocked"); return; }
        fetch(`/api/leaves/email-action?t=${encodeURIComponent(t)}`, { cache: "no-store" })
            .then(async r => {
                const d = await r.json().catch(() => ({}));
                if (r.status === 401) { switchAccount(); return; }
                if (!r.ok) { setMessage(d.error || "Could not open this leave request."); setWrongUser(d.code === "wrong-user"); setState("blocked"); return; }
                setLeave(d.leave);
                if (d.canDecide) decide(t, a);   // one click: the button in the e-mail is the decision
                else { setMessage(d.message); setBy(d.processedBy || ""); setState("blocked"); }
            })
            .catch(() => { setMessage("Could not reach GOG OMS. Please try again."); setState("error"); });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const isReject = action === "reject";
    const ok = state === "done";
    return (
        <div className="min-h-[80vh] flex items-start sm:items-center justify-center p-4 sm:p-8" data-testid="leave-action">
            <div className="w-full max-w-md space-y-4">
                <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">GOG OMS · Leave Request</p>

                <div className={cn("rounded-2xl border p-6 text-center space-y-2",
                    ok ? (leave?.status === "Rejected" ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10")
                        : state === "blocked" ? "border-amber-500/30 bg-amber-500/10" : state === "error" ? "border-red-500/30 bg-red-500/10" : "border-zinc-800 bg-zinc-900/70")}
                    data-testid={ok ? "leave-action-done" : state === "blocked" ? "leave-action-blocked" : state === "error" ? "leave-action-error" : "leave-action-saving"}>
                    {state === "loading" || state === "saving"
                        ? <><Loader2 className="mx-auto animate-spin text-zinc-400" size={36} /><p className="text-base font-bold text-white">{isReject ? "Rejecting" : "Approving"} the leave…</p></>
                        : ok ? <>
                            {leave?.status === "Rejected" ? <XCircle className="mx-auto text-red-400" size={44} /> : <CheckCircle2 className="mx-auto text-emerald-400" size={44} />}
                            <p className="text-xl font-bold text-white">{message}</p>
                            <p className="text-xs text-zinc-300">Updated in GOG OMS. The employee has been informed by e-mail.</p>
                        </> : <>
                            <AlertTriangle className={cn("mx-auto", state === "error" ? "text-red-400" : "text-amber-400")} size={40} />
                            <p className="text-base font-bold text-white">{message}</p>
                            {by && <p className="text-xs text-zinc-300">Decided by {by}.</p>}
                            {wrongUser && <button onClick={switchAccount} data-testid="leave-action-switch" className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">Switch account</button>}
                            {state === "error" && link?.t && <button onClick={() => decide(link.t, link.a)} className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 text-white text-xs font-bold">Try again</button>}
                        </>}
                </div>

                {leave && (
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3" data-testid="leave-action-details">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-white">{leave.employeeName}</p>
                                <p className="text-[11px] text-zinc-500">{leave.employeeId}{leave.designation ? ` · ${leave.designation}` : ""}{leave.dept ? ` · ${leave.dept}` : ""}</p>
                            </div>
                            <span data-testid="leave-action-status" className={cn("px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap",
                                leave.status === "Approved" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" : leave.status === "Rejected" ? "text-red-300 bg-red-500/10 border-red-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30")}>{statusLabel(leave.status)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                            {([["Leave type", `${leave.type}${leave.leaveType ? ` (${leave.leaveType})` : ""}`], ["Total days", String(leave.days)], ["From", dmy(leave.startDate)], ["To", dmy(leave.endDate)]] as [string, string][])
                                .map(([k, v]) => <div key={k}><p className="text-[10px] uppercase tracking-widest text-zinc-500">{k}</p><p className="text-zinc-200 mt-0.5 flex items-center gap-1">{k === "From" || k === "To" ? <CalendarDays size={11} className="text-zinc-500" /> : null}{v}</p></div>)}
                        </div>
                        {leave.reason && <div className="text-xs"><p className="text-[10px] uppercase tracking-widest text-zinc-500">Reason</p><p className="text-zinc-200 mt-0.5 whitespace-pre-wrap">{leave.reason}</p></div>}
                    </section>
                )}
                <p className="text-center text-[11px] text-zinc-500">You can close this page or continue in GOG OMS.</p>
            </div>
        </div>
    );
}