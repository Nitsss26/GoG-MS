"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Loader2, X, CheckCircle2, XCircle, Mail, RefreshCw, Search, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useMinWidth } from "@/lib/use-min-width";

/**
 * Location Mismatch Justifications (HOI / OM clocked in at an assigned location other than the scheduled one).
 * Review: HR / HR Executive / Founder (all), AD (HOIs), HOI (their OMs). HOI / OM also see their own.
 * Reject → one primary action + mandatory reason → Preview Email → Send Mail (manual, tracked separately).
 */
const TABS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"]] as const;
const ACTIONS = [["warning", "Warning Only"], ["custom", "Custom Action"], ["penalty", "Monetary Penalty (₹)"], ["half_day", "Half-Day Deduction"], ["full_day", "Full-Day Deduction"]] as const;
const dmy = (d?: string) => (d ? d.split("-").reverse().join("-") : "—");
const t12 = (t?: string) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); if (isNaN(h)) return t; return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
const dt = (v?: string) => (v ? new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");
const STATUS_STYLE: Record<string, string> = { pending: "text-amber-300 bg-amber-500/10 border-amber-500/25", approved: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", rejected: "text-red-300 bg-red-500/10 border-red-500/25" };
const EMAIL_LABEL: Record<string, string> = { not_sent: "Not Sent", sending: "Sending…", sent: "Sent", failed: "Failed" };
const EMAIL_STYLE: Record<string, string> = { not_sent: "text-zinc-400 bg-zinc-800", sending: "text-sky-300 bg-sky-500/10", sent: "text-emerald-300 bg-emerald-500/10", failed: "text-red-300 bg-red-500/10" };

function Pill({ s }: { s: string }) {
    return <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize", STATUS_STYLE[s] || "text-zinc-400 border-zinc-700")}>{s}</span>;
}

/** Location Justifications — shown as a tab of Attendance (HR → Attendance Log; HOI / AD / OM → Attendance) */
export default function LocationJustificationsBoard() {
    const { user } = useAuth();
    const role = user?.role as string;
    const reviewer = ["HR", "FOUNDER", "AD", "HOI"].includes(role);
    const submitter = ["HOI", "OM"].includes(role);
    const [view, setView] = useState<"review" | "mine">("review");
    const [tab, setTab] = useState<string>("pending");
    const [rows, setRows] = useState<any[] | null>(null);
    const [error, setError] = useState(""); const [msg, setMsg] = useState("");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState<any | null>(null);
    const [mode, setMode] = useState<"" | "reject">("");
    const [form, setForm] = useState({ rejectAction: "", customAction: "", penaltyAmount: "", reason: "", remarks: "" });
    const [busy, setBusy] = useState("");
    const [preview, setPreview] = useState<any | null>(null);
    const wide = useMinWidth(1280);

    useEffect(() => { if (user && !reviewer && submitter) setView("mine"); }, [user, reviewer, submitter]);
    const load = useCallback(async () => {
        if (!user) return;
        try {
            // OM (not a reviewer) only ever sees its own justifications — never asks for the review list
            const v = reviewer ? view : "mine";
            const url = v === "mine" ? "/api/attendance/location-justifications?mine=1" : `/api/attendance/location-justifications?status=${tab}`;
            const r = await fetch(url, { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load.");
            setRows(d.items || []); setError("");
        } catch (e: any) { setError(e.message); setRows([]); }
    }, [tab, view, user, reviewer]);
    useEffect(() => { setRows(null); load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

    const openItem = (r: any) => { setOpen(r); setMode(""); setForm({ rejectAction: "", customAction: "", penaltyAmount: "", reason: "", remarks: "" }); setError(""); setMsg(""); setPreview(null); };
    const replace = (item: any) => { if (!item) return; setOpen(item); setRows(prev => (prev || []).map(r => (r.id === item.id ? item : r))); };

    const decide = async (action: "approve" | "reject") => {
        if (!open) return;
        if (action === "reject") {
            if (!form.rejectAction) { setError("Choose one rejection action."); return; }
            if (form.rejectAction === "custom" && !form.customAction.trim()) { setError("Describe the custom action."); return; }
            if (form.rejectAction === "penalty" && !(Number(form.penaltyAmount) > 0)) { setError("Enter a valid positive penalty amount (₹)."); return; }
            if (!form.reason.trim()) { setError("The rejection reason is mandatory."); return; }
        }
        setBusy(action); setError("");
        try {
            const r = await fetch("/api/attendance/location-justifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: open.id, action, ...(action === "reject" ? { ...form, reason: form.reason.trim(), remarks: form.remarks.trim(), customAction: form.customAction.trim() } : {}) }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { setError(d.error || "Could not save."); if (d.item) replace(d.item); return; }
            replace(d.item); setMode("");
            setMsg(action === "approve" ? "Justification approved." : "Justification rejected. Preview the email and send it when ready.");
            load();
        } finally { setBusy(""); }
    };
    const loadPreview = async () => {
        if (!open) return;
        setBusy("preview"); setError("");
        try {
            const r = await fetch(`/api/attendance/location-justifications/email?id=${encodeURIComponent(open.id)}`, { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) { setError(d.error || "Could not prepare the email."); return; }
            setPreview(d.preview);
        } finally { setBusy(""); }
    };
    const send = async () => {
        if (!open) return;
        setBusy("send"); setError("");
        try {
            const r = await fetch("/api/attendance/location-justifications/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: open.id }) });
            const d = await r.json().catch(() => ({}));
            if (d.item) replace(d.item);
            if (!r.ok) { setError(d.error || "Email could not be sent."); return; }
            setMsg(d.message || "Email sent."); setPreview(null); load();
        } finally { setBusy(""); }
    };

    if (!user) return null;
    if (!reviewer && !submitter) return <div className="p-8 text-center text-zinc-500">Access Restricted.</div>;
    const shown = (rows || []).filter(r => !q || `${r.employeeName} ${r.employeeId} ${r.actualLocationName} ${r.scheduledLocationName}`.toLowerCase().includes(q.toLowerCase()));
    const decision = (r: any) => r.status === "rejected" ? `${r.actionLabel}${r.penaltyAmount ? ` · ₹${r.penaltyAmount}` : ""}` : r.status === "approved" ? "Approved" : "—";

    return (
        <div className="max-w-[1400px] mx-auto pt-5 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]" data-testid="loc-just-page">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2"><MapPin size={18} className="text-sky-400" /> Location Justifications</h1>
                {reviewer && submitter && (
                    <div className="flex gap-1 p-1 rounded-lg bg-zinc-950/60 border border-zinc-800 sm:ml-auto">
                        {([["review", "To Review"], ["mine", "My Justifications"]] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setView(k)} data-testid={`lj-view-${k}`} className={cn("px-3 py-1.5 rounded-md text-[11px] font-bold", view === k ? "bg-sky-500/20 text-sky-300" : "text-zinc-400 hover:text-white")}>{l}</button>
                        ))}
                    </div>
                )}
            </div>
            <p className="text-[11px] text-zinc-500">Clock-ins at an assigned location other than the day&apos;s scheduled location. The justification is submitted before the clock-in is recorded.</p>

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4 sm:p-5 space-y-4">
                {reviewer && view === "review" && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex gap-1 p-1 rounded-lg bg-zinc-950/60 border border-zinc-800 overflow-x-auto">
                            {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`lj-tab-${k || "all"}`} className={cn("px-3 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap", tab === k ? "bg-sky-500/20 text-sky-300" : "text-zinc-400 hover:text-white")}>{l}</button>)}
                        </div>
                        <div className="relative sm:ml-auto w-full sm:w-64">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee / location" className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white outline-none focus:border-sky-500/50" />
                        </div>
                        <button onClick={load} className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white self-start sm:self-auto" aria-label="Refresh"><RefreshCw size={14} /></button>
                    </div>
                )}
                {msg && !open && <p className="text-[11px] text-emerald-400" role="status">{msg}</p>}
                {error && !open && <p className="text-[11px] text-red-400" role="alert">{error}</p>}
                {rows === null ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>
                    : shown.length === 0 ? <p className="py-10 text-center text-xs text-zinc-500" data-testid="lj-empty">No justifications.</p>
                        : wide ? (
                            <table className="w-full text-xs table-fixed" data-testid="lj-table">
                                <thead><tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                                    <th className="py-2 px-2 w-[16%]">Employee</th><th className="py-2 px-2 w-[9%]">Date</th><th className="py-2 px-2 w-[8%]">Clock-In</th>
                                    <th className="py-2 px-2 w-[13%]">Scheduled</th><th className="py-2 px-2 w-[13%]">Actual</th><th className="py-2 px-2 w-[17%]">Justification</th>
                                    <th className="py-2 px-2 w-[8%]">Status</th><th className="py-2 px-2 w-[10%]">Decision</th><th className="py-2 px-2 w-[6%] text-right">Email</th>
                                </tr></thead>
                                <tbody>{shown.map(r => (
                                    <tr key={r.id} className="border-b border-zinc-800/60 hover:bg-white/[0.02] cursor-pointer" onClick={() => openItem(r)} data-testid="lj-row">
                                        <td className="py-2.5 px-2"><p className="font-bold text-white truncate">{r.employeeName}</p><p className="text-[10px] text-zinc-500">{r.employeeId} · {r.employeeRole}</p></td>
                                        <td className="py-2.5 px-2 text-zinc-300">{dmy(r.date)}</td><td className="py-2.5 px-2 text-zinc-300">{t12(r.clockIn)}{r.lateAlso && <span className="block text-[9px] text-yellow-300">Late too</span>}</td>
                                        <td className="py-2.5 px-2 text-zinc-300 [overflow-wrap:anywhere]">{r.scheduledLocationName}</td><td className="py-2.5 px-2 text-sky-300 [overflow-wrap:anywhere]">{r.actualLocationName}</td>
                                        <td className="py-2.5 px-2 text-zinc-400"><p className="line-clamp-2 [overflow-wrap:anywhere]">{r.justification}</p></td>
                                        <td className="py-2.5 px-2"><Pill s={r.status} /></td><td className="py-2.5 px-2 text-zinc-300 [overflow-wrap:anywhere]">{decision(r)}</td>
                                        <td className="py-2.5 px-2 text-right">{r.status === "rejected" ? <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", EMAIL_STYLE[r.emailStatus])}>{EMAIL_LABEL[r.emailStatus] || r.emailStatus}</span> : <span className="text-zinc-600">—</span>}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2" data-testid="lj-cards">
                                {shown.map(r => (
                                    <button key={r.id} onClick={() => openItem(r)} data-testid="lj-card" className="text-left rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-2 hover:border-zinc-700 min-w-0">
                                        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-white text-sm truncate">{r.employeeName}</p><p className="text-[10px] text-zinc-500">{r.employeeId} · {r.employeeRole} · {dmy(r.date)} · {t12(r.clockIn)}</p></div><Pill s={r.status} /></div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]"><div className="min-w-0"><p className="text-zinc-500">Scheduled</p><p className="text-zinc-200 [overflow-wrap:anywhere]">{r.scheduledLocationName}</p></div><div className="min-w-0"><p className="text-zinc-500">Actual</p><p className="text-sky-300 [overflow-wrap:anywhere]">{r.actualLocationName}</p></div></div>
                                        <p className="text-[11px] text-zinc-400 line-clamp-2 [overflow-wrap:anywhere]">{r.justification}</p>
                                        {r.status !== "pending" && <p className="text-[10px] text-zinc-400">{decision(r)}{r.status === "rejected" && <> · Email: <span className={cn("font-bold px-1 rounded", EMAIL_STYLE[r.emailStatus])}>{EMAIL_LABEL[r.emailStatus]}</span></>}</p>}
                                    </button>
                                ))}
                            </div>
                        )}
            </div>

            {open && (
                <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" data-testid="lj-dialog">
                    <div className="w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><h2 className="text-sm font-black text-white">{open.employeeName} <span className="text-zinc-500 font-normal">({open.employeeId} · {open.employeeRole})</span></h2><p className="text-[11px] text-zinc-500">{dmy(open.date)} · Clock-in {t12(open.clockIn)}{open.lateAlso ? " · Late clock-in also justified" : ""}</p></div>
                            <button onClick={() => setOpen(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400" aria-label="Close"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg border border-zinc-800 p-2.5 min-w-0"><p className="text-[10px] text-zinc-500">Scheduled Location</p><p className="font-bold text-white [overflow-wrap:anywhere]">{open.scheduledLocationName}</p></div>
                            <div className="rounded-lg border border-sky-500/25 p-2.5 min-w-0"><p className="text-[10px] text-zinc-500">Actual Location</p><p className="font-bold text-sky-300 [overflow-wrap:anywhere]">{open.actualLocationName}</p></div>
                            <div className="rounded-lg border border-zinc-800 p-2.5 sm:col-span-2 min-w-0"><p className="text-[10px] text-zinc-500">Assigned Locations</p><p className="text-zinc-300 [overflow-wrap:anywhere]">{(open.assignedLocations || []).map((l: any) => l.name).join(", ") || "—"}</p></div>
                            <div className="rounded-lg border border-zinc-800 p-2.5 sm:col-span-2 min-w-0"><p className="text-[10px] text-zinc-500">Justification</p><p className="text-zinc-200 whitespace-pre-wrap [overflow-wrap:anywhere]">{open.justification}</p></div>
                        </div>
                        <div className="flex items-center gap-2 text-xs"><span className="text-zinc-500">Status:</span><Pill s={open.status} />{open.reviewedByName && <span className="text-zinc-500">by {open.reviewedByName} ({open.reviewedByRole}) · {dt(open.reviewedAt)}</span>}</div>
                        {open.status === "rejected" && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3 text-xs space-y-1" data-testid="lj-decision">
                                <p><span className="text-zinc-500">Action:</span> <b className="text-white">{open.actionLabel}{open.penaltyAmount ? ` — ₹${open.penaltyAmount}` : ""}{open.customAction ? ` — ${open.customAction}` : ""}</b></p>
                                <p className="[overflow-wrap:anywhere]"><span className="text-zinc-500">Reason:</span> {open.decisionReason}</p>
                                {open.remarks && <p className="[overflow-wrap:anywhere]"><span className="text-zinc-500">Remarks:</span> {open.remarks}</p>}
                            </div>
                        )}

                        {error && <p className="text-[11px] text-red-400" role="alert" data-testid="lj-error">{error}</p>}
                        {msg && <p className="text-[11px] text-emerald-400" role="status">{msg}</p>}

                        {open.canReview && mode === "" && (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button onClick={() => decide("approve")} disabled={!!busy} data-testid="lj-approve" className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">{busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve</button>
                                <button onClick={() => { setMode("reject"); setError(""); }} disabled={!!busy} data-testid="lj-reject" className="flex-1 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"><XCircle size={14} /> Reject</button>
                            </div>
                        )}
                        {open.canReview && mode === "reject" && (
                            <div className="space-y-3 rounded-xl border border-zinc-800 p-3" data-testid="lj-reject-form">
                                <p className="text-[11px] font-black uppercase tracking-widest text-red-300">Rejection Action <span className="text-red-400">*</span></p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {ACTIONS.map(([k, l]) => (
                                        <label key={k} className={cn("flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer", form.rejectAction === k ? "border-red-500/50 bg-red-500/10 text-white" : "border-zinc-800 text-zinc-300")}>
                                            <input type="radio" name="lj-action" value={k} checked={form.rejectAction === k} onChange={() => setForm({ ...form, rejectAction: k })} data-testid={`lj-action-${k}`} /> {l}
                                        </label>
                                    ))}
                                </div>
                                {form.rejectAction === "custom" && <input value={form.customAction} onChange={e => setForm({ ...form, customAction: e.target.value })} maxLength={500} placeholder="Describe the custom action" data-testid="lj-custom" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-white outline-none" />}
                                {form.rejectAction === "penalty" && <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">₹</span><input type="number" min={1} step="0.01" inputMode="decimal" value={form.penaltyAmount} onChange={e => setForm({ ...form, penaltyAmount: e.target.value })} placeholder="Amount" data-testid="lj-amount" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 pl-7 text-xs text-white outline-none" /></div>}
                                <label className="block text-[10px] font-bold text-zinc-400">Reason <span className="text-red-400">*</span></label>
                                <textarea rows={3} maxLength={2000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} data-testid="lj-reason" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-white outline-none" />
                                <label className="block text-[10px] font-bold text-zinc-400">Additional Remarks (optional)</label>
                                <textarea rows={2} maxLength={2000} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} data-testid="lj-remarks" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-white outline-none" />
                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                                    <button onClick={() => { setMode(""); setError(""); }} disabled={!!busy} className="px-4 py-2.5 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300">Cancel</button>
                                    <button onClick={() => decide("reject")} disabled={!!busy} data-testid="lj-confirm-reject" className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50">{busy === "reject" ? "Saving…" : "Confirm Rejection"}</button>
                                </div>
                            </div>
                        )}
                        {open.canEmail && (
                            <div className="space-y-3 rounded-xl border border-zinc-800 p-3" data-testid="lj-email">
                                <div className="flex flex-wrap items-center gap-2"><Mail size={14} className="text-sky-300" /><p className="text-xs font-bold text-white">Rejection Email</p><span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", EMAIL_STYLE[open.emailStatus])} data-testid="lj-email-status">{EMAIL_LABEL[open.emailStatus] || open.emailStatus}</span>{open.emailSentAt && <span className="text-[10px] text-zinc-500">{dt(open.emailSentAt)}</span>}</div>
                                {open.emailStatus !== "sent" && (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button onClick={loadPreview} disabled={!!busy} data-testid="lj-preview" className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5 disabled:opacity-50">{busy === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview Email</button>
                                        <button onClick={send} disabled={!!busy || open.emailStatus === "sending"} data-testid="lj-send" className="flex-1 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">{busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} {open.emailStatus === "failed" ? "Retry Send Mail" : "Send Mail"}</button>
                                    </div>
                                )}
                                {preview && (
                                    <div className="rounded-lg border border-zinc-800 bg-white text-zinc-900 overflow-hidden" data-testid="lj-preview-box">
                                        <div className="p-3 text-[11px] space-y-0.5 bg-zinc-100 border-b border-zinc-200 [overflow-wrap:anywhere]">
                                            <p><b>To:</b> {preview.to || "—"}</p><p><b>CC:</b> {(preview.cc || []).join(", ") || "—"}</p><p><b>Subject:</b> {preview.subject}</p>
                                        </div>
                                        <div className="p-3 text-xs [overflow-wrap:anywhere] [&_table]:w-full [&_td]:align-top" dangerouslySetInnerHTML={{ __html: preview.html }} />
                                    </div>
                                )}
                                {(open.emailAttempts || []).length > 0 && <ul className="text-[10px] text-zinc-500 space-y-0.5">{open.emailAttempts.map((a: any, i: number) => <li key={i}>{dt(a.at)} · {a.status === "sent" ? "Sent" : "Failed"} by {a.byName}{a.error ? ` — ${a.error}` : ""}</li>)}</ul>}
                            </div>
                        )}
                        {(open.history || []).length > 0 && (
                            <div><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">History</p>
                                <ul className="text-[11px] text-zinc-400 space-y-1">{open.history.map((h: any, i: number) => <li key={i} className="[overflow-wrap:anywhere]">{dt(h.at)} · <b className="text-zinc-300">{h.action}</b> · {h.byName}{h.role ? ` (${h.role})` : ""}{h.note ? ` — ${h.note}` : ""}</li>)}</ul></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}