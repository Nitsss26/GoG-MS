"use client";

import { useEffect, useState } from "react";
import {
    Trash2, X, AlertTriangle, CheckCircle2, Loader2, FileText, Wallet, CalendarDays, LogOut, Package, Receipt,
    MessageSquare, User, Mail, Building2, Briefcase, MapPin, BadgeCheck, Save, MailX, CalendarX,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/context/AuthContext";

/**
 * Workforce → ⋮ → Delete Employee — mandatory exit checklist.
 * Details come from the database (GET /api/hr/exit). Nothing is removed until every mandatory item is answered
 * "Yes", the server finds no pending obligation, and HR confirms a second time. A checklist with open items can
 * be saved as pending and completed later.
 */
type YN = "YES" | "NO" | "";
type Answers = {
    documentsSent: YN; salarySettled: YN; assetsReturned: YN; reimbursementsCleared: YN;
    lastWorkingDay: string; leavingReason: string; leavingReasonOther: string; remarks: string;
};
const EMPTY: Answers = { documentsSent: "", salarySettled: "", assetsReturned: "", reimbursementsCleared: "", lastWorkingDay: "", leavingReason: "", leavingReasonOther: "", remarks: "" };
const REASONS = ["Resigned", "Terminated", "Contract Completed", "Retirement", "Employee Record Created by Mistake", "Other"];
const NO_TEXT: Record<string, string> = {
    documentsSent: "Offer / experience letter not sent",
    salarySettled: "Salary settlement pending",
    assetsReturned: "Company assets not returned",
    reimbursementsCleared: "Reimbursement claims not cleared",
};

export default function RemoveEmployeeDialog({ employee, onClose, onRemoved }: { employee: Employee; onClose: () => void; onRemoved?: (employee: Employee) => void }) {
    const { submitEmployeeExit } = useAuth();
    const [info, setInfo] = useState<any>(null);
    const [a, setA] = useState<Answers>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<"" | "save" | "complete">("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [triedSubmit, setTriedSubmit] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [done, setDone] = useState<string>("");
    // Step 1: stop every OMS e-mail to the employee (works right away, before the checklist is finished)
    const [mailBusy, setMailBusy] = useState(false);
    const toggleMails = async (stop: boolean) => {
        setMailBusy(true); setError("");
        try {
            const r = await fetch("/api/hr/exit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: employee.id, action: stop ? "stop-mails" : "resume-mails" }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not update the e-mail setting.");
            setInfo((p: any) => ({ ...p, employee: { ...p.employee, mailsStopped: stop, mailsStoppedAt: stop ? new Date().toISOString() : "" } }));
            setNotice(d.message || "");
        } catch (e: any) { setError(e.message); } finally { setMailBusy(false); }
    };
    // Remove the employee from attendance: their attendance no longer shows for HR or anyone else
    const [attBusy, setAttBusy] = useState(false);
    const toggleAttendance = async (hide: boolean) => {
        setAttBusy(true); setError("");
        try {
            const r = await fetch("/api/hr/exit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: employee.id, action: hide ? "hide-attendance" : "show-attendance" }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not update the attendance setting.");
            setInfo((p: any) => ({ ...p, employee: { ...p.employee, hideFromAttendance: hide, hiddenFromAttendanceAt: hide ? new Date().toISOString() : "" } }));
            setNotice(d.message || "");
        } catch (e: any) { setError(e.message); } finally { setAttBusy(false); }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true); setError("");
            try {
                const res = await fetch(`/api/hr/exit?employeeId=${encodeURIComponent(employee.id)}`);
                const d = await res.json();
                if (cancelled) return;
                if (!res.ok) throw new Error(d.error || "Could not load the employee.");
                setInfo(d);
                if (d.record) {
                    const r = d.record;
                    setA({
                        documentsSent: r.documentsSent || "", salarySettled: r.salarySettled || "", assetsReturned: r.assetsReturned || "",
                        reimbursementsCleared: r.reimbursementsCleared || "", lastWorkingDay: r.lastWorkingDay || "",
                        leavingReason: r.leavingReason || "", leavingReasonOther: r.leavingReasonOther || "", remarks: r.remarks || "",
                    });
                    setNotice(`Resuming the checklist saved by ${r.updatedByName || r.createdByName} on ${new Date(r.updatedAt || r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`);
                }
            } catch (e: any) { if (!cancelled) setError(e.message); }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [employee.id]);

    const set = (k: keyof Answers, v: string) => { setA(p => ({ ...p, [k]: v })); setError(""); };
    const missing: (keyof Answers)[] = [];
    (["documentsSent", "salarySettled", "assetsReturned", "reimbursementsCleared"] as const).forEach(k => { if (!a[k]) missing.push(k); });
    if (!a.lastWorkingDay) missing.push("lastWorkingDay");
    if (!a.leavingReason) missing.push("leavingReason");
    else if (a.leavingReason === "Other" && a.leavingReasonOther.trim().length < 3) missing.push("leavingReasonOther");
    const pendingDb = info?.db?.pendingReimbursements || 0;
    const outstanding = [
        ...(["documentsSent", "salarySettled", "assetsReturned", "reimbursementsCleared"] as const).filter(k => a[k] === "NO").map(k => NO_TEXT[k]),
        ...(pendingDb ? [`${pendingDb} reimbursement claim(s) still pending in the portal`] : []),
    ];
    const canDelete = !missing.length && !outstanding.length;
    const show = (k: keyof Answers) => triedSubmit && missing.includes(k);

    const send = async (action: "save" | "complete") => {
        setBusy(action); setError("");
        const r = await submitEmployeeExit({ employeeId: employee.id, action, ...a });
        setBusy("");
        if (!r.ok) {
            setConfirming(false);
            setError([r.data.error, ...(r.data.outstanding || [])].filter(Boolean).join(" • ") || "Action failed.");
            return;
        }
        if (action === "save") {
            setNotice(r.data.message || "Saved as pending.");
            return;
        }
        setDone(r.data.message || "Employee removed.");
        onRemoved?.(employee);
    };

    const emp = info?.employee;
    const Radio = ({ k, q, hint, icon: Icon }: { k: "documentsSent" | "salarySettled" | "assetsReturned" | "reimbursementsCleared"; q: string; hint?: string; icon: any }) => (
        <div className={`px-3 py-2.5 rounded-xl border ${show(k) ? "border-red-500/60 bg-red-500/5" : a[k] === "YES" ? "border-emerald-500/30 bg-emerald-500/[0.04]" : a[k] === "NO" ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-zinc-800 bg-zinc-950/40"}`} data-testid={`exit-${k}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${a[k] === "YES" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                        {a[k] === "YES" ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-white leading-snug">{q} <span className="text-red-400">*</span></p>
                        {hint && <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{hint}</p>}
                    </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    {(["YES", "NO"] as const).map(v => (
                        <label key={v} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${a[k] === v ? (v === "YES" ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" : "border-amber-500/60 bg-amber-500/15 text-amber-300") : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                            <input type="radio" name={k} value={v} checked={a[k] === v} onChange={() => set(k, v)} className="sr-only" data-testid={`exit-${k}-${v}`} />
                            <span className={`w-3 h-3 rounded-full border-2 ${a[k] === v ? (v === "YES" ? "border-emerald-400 bg-emerald-400" : "border-amber-400 bg-amber-400") : "border-zinc-500"}`} />
                            {v === "YES" ? "Yes" : "No"}
                        </label>
                    ))}
                </div>
            </div>
            {show(k) && <p className="text-[10px] text-red-400 mt-1">Please select Yes or No.</p>}
        </div>
    );
    const input = "w-full px-3 py-2 bg-zinc-950 border rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none [color-scheme:dark]";

    return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" data-testid="exit-modal">
            <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full ${emp && !done ? "max-w-5xl" : "max-w-2xl"} max-h-[96vh] flex flex-col shadow-2xl`}>
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center"><Trash2 size={17} className="text-red-400" /></span>
                        Delete Employee
                    </h2>
                    <button onClick={onClose} disabled={!!busy} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                </div>

                {done ? (
                    <div className="p-6 space-y-4" data-testid="exit-done">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                            <p className="text-sm text-emerald-300 font-semibold">{done}</p>
                        </div>
                        <p className="text-xs text-zinc-400">The exit checklist is saved with your name and time. {employee.name} can no longer log in and gets no more mails. Their details are in Workforce → Deleted Employees for 2 months.</p>
                        <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-700">Close</button>
                    </div>
                ) : loading ? (
                    <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin text-zinc-500" /></div>
                ) : !emp ? (
                    <div className="p-6 space-y-4"><p className="text-sm text-red-400">{error || "Employee not found."}</p>
                        <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-700">Close</button></div>
                ) : (
                    <>
                        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-3 items-start">
                            {/* Left: employee + Yes/No checklist */}
                            <div className="space-y-2.5 min-w-0">
                                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800" data-testid="exit-employee">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="w-9 h-9 rounded-full bg-red-500/10 text-red-300 flex items-center justify-center text-xs font-black shrink-0">{(emp.name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{emp.name}</p>
                                            <p className="text-[11px] text-zinc-500 font-mono">{emp.id}</p>
                                        </div>
                                        <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{emp.status}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                        <p className="flex items-center gap-2 text-zinc-300 min-w-0"><Mail size={12} className="text-zinc-500 shrink-0" /><span className="truncate">{emp.email}</span></p>
                                        <p className="flex items-center gap-2 text-zinc-300 min-w-0"><Building2 size={12} className="text-zinc-500 shrink-0" /><span className="truncate">{emp.dept || "—"}</span></p>
                                        <p className="flex items-center gap-2 text-zinc-300 min-w-0"><Briefcase size={12} className="text-zinc-500 shrink-0" /><span className="truncate">{emp.designation || "—"} <span className="text-zinc-500">({emp.role})</span></span></p>
                                        <p className="flex items-center gap-2 text-zinc-300 min-w-0"><MapPin size={12} className="text-zinc-500 shrink-0" /><span className="truncate">{emp.location || "Not assigned"}</span></p>
                                    </div>
                                </div>
                                <div className={`p-3 rounded-xl border flex items-center gap-3 ${emp.mailsStopped ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-red-500/30 bg-red-500/[0.05]"}`} data-testid="exit-stop-mails">
                                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${emp.mailsStopped ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-300"}`}>{emp.mailsStopped ? <CheckCircle2 size={15} /> : <MailX size={15} />}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-white">{emp.mailsStopped ? "Mails to this employee are stopped" : "Stop sending any mails to employee"}</p>
                                        <p className="text-[10px] text-zinc-400 leading-snug">{emp.mailsStopped ? `No GOG OMS e-mail (To or CC) goes to ${emp.email}${emp.mailsStoppedAt ? ` · since ${new Date(emp.mailsStoppedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.` : `Works immediately — no GOG OMS e-mail (To or CC) will go to ${emp.email}.`}</p>
                                    </div>
                                    <button onClick={() => toggleMails(!emp.mailsStopped)} disabled={mailBusy || !!busy} data-testid={emp.mailsStopped ? "exit-resume-mails" : "exit-stop-mails-btn"}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border disabled:opacity-50 ${emp.mailsStopped ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-red-500/40 bg-red-600 text-white hover:bg-red-500"}`}>
                                        {mailBusy ? <Loader2 size={12} className="animate-spin" /> : emp.mailsStopped ? "Resume mails" : "Stop mails"}
                                    </button>
                                </div>
                                <div className={`p-3 rounded-xl border flex items-center gap-3 ${emp.hideFromAttendance ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-red-500/30 bg-red-500/[0.05]"}`} data-testid="exit-hide-attendance">
                                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${emp.hideFromAttendance ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-300"}`}>{emp.hideFromAttendance ? <CheckCircle2 size={15} /> : <CalendarX size={15} />}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-white">{emp.hideFromAttendance ? "Removed from attendance" : "Remove employee from attendance"}</p>
                                        <p className="text-[10px] text-zinc-400 leading-snug">{emp.hideFromAttendance ? `Their attendance is not shown to HR or anyone else (roster, logs, calendars, alerts)${emp.hiddenFromAttendanceAt ? ` · since ${new Date(emp.hiddenFromAttendanceAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.` : "Their attendance will no longer show for HR or anyone else (roster, logs, calendars, alerts)."}</p>
                                    </div>
                                    <button onClick={() => toggleAttendance(!emp.hideFromAttendance)} disabled={attBusy || !!busy} data-testid={emp.hideFromAttendance ? "exit-show-attendance" : "exit-hide-attendance-btn"}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border disabled:opacity-50 ${emp.hideFromAttendance ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-red-500/40 bg-red-600 text-white hover:bg-red-500"}`}>
                                        {attBusy ? <Loader2 size={12} className="animate-spin" /> : emp.hideFromAttendance ? "Show again" : "Remove"}
                                    </button>
                                </div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 pt-0.5"><BadgeCheck size={12} /> Mandatory completion checklist</p>
                                <Radio k="documentsSent" icon={FileText} q="Has the required offer letter or experience letter been sent to the employee?" />
                                <Radio k="salarySettled" icon={Wallet} q="Have all pending salary payments and final settlements been completed?" />
                                <Radio k="assetsReturned" icon={Package} q="Have all company assets been returned?" hint="Laptop, ID card and other assigned equipment." />
                                <Radio k="reimbursementsCleared" icon={Receipt} q="Have all outstanding reimbursement claims been cleared?" hint="Yes = every claim of this employee is settled." />
                            </div>

                            {/* Right: exit details, status, warning */}
                            <div className="space-y-3 min-w-0">
                                {notice && <p className="text-[11px] text-sky-300 bg-sky-500/5 border border-sky-500/20 rounded-lg px-3 py-2" data-testid="exit-notice">{notice}</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><CalendarDays size={11} /> Last Working Day <span className="text-red-400">*</span></label>
                                        <input type="date" value={a.lastWorkingDay} onChange={e => set("lastWorkingDay", e.target.value)} data-testid="exit-lwd"
                                            className={`${input} ${show("lastWorkingDay") ? "border-red-500/60" : "border-zinc-800 focus:border-zinc-600"}`} />
                                        {show("lastWorkingDay") && <p className="text-[10px] text-red-400 mt-1">Select the last working day.</p>}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><LogOut size={11} /> Reason for Leaving <span className="text-red-400">*</span></label>
                                        <select value={a.leavingReason} onChange={e => set("leavingReason", e.target.value)} data-testid="exit-reason"
                                            className={`${input} ${show("leavingReason") ? "border-red-500/60" : "border-zinc-800 focus:border-zinc-600"}`}>
                                            <option value="">Select reason…</option>
                                            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        {show("leavingReason") && <p className="text-[10px] text-red-400 mt-1">Select a reason.</p>}
                                    </div>
                                </div>
                                {a.leavingReason === "Other" && (
                                    <div>
                                        <input value={a.leavingReasonOther} onChange={e => set("leavingReasonOther", e.target.value)} placeholder="Describe the reason *" data-testid="exit-reason-other"
                                            className={`${input} ${show("leavingReasonOther") ? "border-red-500/60" : "border-zinc-800 focus:border-zinc-600"}`} />
                                        {show("leavingReasonOther") && <p className="text-[10px] text-red-400 mt-1">Please describe the reason (at least 3 characters).</p>}
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><MessageSquare size={11} /> Additional Remarks</label>
                                    <textarea value={a.remarks} onChange={e => set("remarks", e.target.value)} rows={2} placeholder="Enter remarks (optional)..." data-testid="exit-remarks"
                                        className={`${input} border-zinc-800 focus:border-zinc-600 resize-none`} />
                                </div>

                                {outstanding.length > 0 && (
                                    <div className="px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5" data-testid="exit-outstanding">
                                        <p className="text-[11px] font-bold text-amber-300 mb-1">Outstanding exit items — the employee cannot be deleted yet</p>
                                        <ul className="space-y-0.5">{outstanding.map(o => <li key={o} className="text-[11px] text-amber-200/90 flex items-center gap-1.5"><AlertTriangle size={11} /> {o}</li>)}</ul>
                                        <p className="text-[10px] text-zinc-500 mt-1">Use “Save as Pending” and complete the checklist once these are done.</p>
                                    </div>
                                )}
                                {triedSubmit && missing.length > 0 && <p className="text-xs text-red-400" data-testid="exit-missing">Please answer every mandatory item (marked *).</p>}

                                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
                                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-200 leading-relaxed">The employee is removed from the portal at once (no login, no mails). All their details and records stay in Workforce → Deleted Employees for 2 months; after that the employee and all their records (attendance, leaves, WFH, tickets, reimbursements, reports) are deleted from the database automatically. Please ensure all required exit formalities have been completed.</p>
                                </div>
                                {error && <p className="text-xs text-red-400" data-testid="exit-error">{error}</p>}
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-zinc-800 flex flex-wrap gap-2 justify-end shrink-0">
                            <button onClick={onClose} disabled={!!busy} className="px-5 py-2.5 text-sm font-bold text-zinc-300 border border-zinc-700 rounded-xl hover:bg-zinc-800 disabled:opacity-50" data-testid="exit-cancel">Cancel</button>
                            <button onClick={() => send("save")} disabled={!!busy} className="px-5 py-2.5 text-sm font-bold text-sky-300 border border-sky-500/30 bg-sky-500/10 rounded-xl hover:bg-sky-500/20 disabled:opacity-50 flex items-center gap-2" data-testid="exit-save">
                                {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save as Pending
                            </button>
                            <button onClick={() => { setTriedSubmit(true); if (canDelete) setConfirming(true); }} disabled={!!busy || (triedSubmit && !canDelete)}
                                title={canDelete ? "" : "Complete every item with Yes first"}
                                className="px-5 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl disabled:opacity-40 flex items-center gap-2" data-testid="exit-delete">
                                <Trash2 size={14} /> Delete Employee
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Final confirmation */}
            {confirming && !done && (
                <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" data-testid="exit-confirm">
                    <div className="bg-zinc-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2"><AlertTriangle size={18} className="text-red-400" /> Confirm deletion</h3>
                        <p className="text-sm text-zinc-300">Remove <span className="font-bold text-white">{employee.name}</span> ({employee.id}) from the portal? They will lose access immediately. Their details stay in Deleted Employees for 2 months, then everything is deleted automatically.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirming(false)} disabled={!!busy} className="flex-1 px-4 py-2.5 text-sm font-bold text-zinc-300 border border-zinc-700 rounded-xl hover:bg-zinc-800">Back</button>
                            <button onClick={() => send("complete")} disabled={!!busy} className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl flex items-center justify-center gap-2" data-testid="exit-confirm-yes">
                                {busy === "complete" ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />} Yes, delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}