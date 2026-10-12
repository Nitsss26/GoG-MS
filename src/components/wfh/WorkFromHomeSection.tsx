"use client";

import { useCallback, useEffect, useState } from "react";
import { Home, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { WFH_TYPE_LABEL, WFH_STATUS_STYLE } from "@/lib/wfh-policy";

/**
 * Employee side of Work From Home (Leave page): the application form and the employee's own history.
 * Work From Home is not leave — nothing here touches leave balances, the Original Location or the HOI mapping.
 */
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmtTs = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export default function WorkFromHomeSection({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { user, employees, refreshApprovedWfh } = useAuth();
    const me: any = employees.find(e => e.id === user?.id) || user;
    const blank = () => ({ wfhType: "FULL_DAY", startDate: todayIST(), endDate: todayIST(), reason: "", remarks: "" });
    const [form, setForm] = useState(blank());
    const [apps, setApps] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/wfh?view=mine", { cache: "no-store" });
            const d = await r.json();
            if (Array.isArray(d.applications)) setApps(d.applications);
        } catch { /* keep the last list */ }
    }, []);
    useEffect(() => { if (user) load(); }, [user, load]);
    const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 4000); };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError("");
        if (form.endDate < form.startDate) { setError("End date must be on or after the start date."); return; }
        if (!form.reason.trim()) { setError("Please give the reason."); return; }
        setBusy(true);
        try {
            const r = await fetch("/api/wfh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, endDate: form.wfhType === "HALF_DAY" ? form.startDate : form.endDate }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not submit the application.");
            setForm(blank()); onClose(); flash(`Work From Home application ${d.application?.id} submitted.`); load();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };
    const cancel = async (id: string) => {
        const r = await fetch("/api/wfh", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "cancel" }) });
        const d = await r.json();
        if (!r.ok) { flash(d.error || "Could not cancel."); return; }
        flash("Application cancelled."); load(); refreshApprovedWfh();
    };
    if (!user) return null;

    const input = "w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary [color-scheme:dark]";
    const label = "text-[10px] font-bold text-muted uppercase tracking-widest";
    return (
        <>
            {/* History */}
            <div className="card" data-testid="wfh-history">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Home size={14} className="text-emerald-400" /> My Work From Home Applications</h3>
                    <span className="text-[10px] text-zinc-500">Work From Home is not leave — it does not use leave balance</span>
                </div>
                {toast && <div className="mx-4 mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[11px] px-3 py-2 flex items-center gap-2" data-testid="wfh-toast"><CheckCircle2 size={13} /> {toast}</div>}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[640px]">
                        <thead><tr className="text-[9px] text-zinc-500 uppercase tracking-widest text-left">
                            <th className="py-2.5 px-4">Application</th><th className="py-2.5 px-4">Dates</th><th className="py-2.5 px-4">Type</th><th className="py-2.5 px-4">Reason</th><th className="py-2.5 px-4">Status</th><th className="py-2.5 px-4 text-right">Action</th>
                        </tr></thead>
                        <tbody className="divide-y divide-border">
                            {apps.map(a => (
                                <tr key={a.id} data-testid="wfh-row" data-id={a.id}>
                                    <td className="py-2.5 px-4"><p className="font-mono text-[10px] text-zinc-400">{a.id}</p><p className="text-[10px] text-zinc-600">{fmtTs(a.createdAt)}</p></td>
                                    <td className="py-2.5 px-4 text-zinc-200">{a.startDate === a.endDate ? fmt(a.startDate) : `${fmt(a.startDate)} – ${fmt(a.endDate)}`}<p className="text-[10px] text-zinc-500">{a.days} day(s)</p></td>
                                    <td className="py-2.5 px-4 text-zinc-300">{WFH_TYPE_LABEL[a.wfhType]}</td>
                                    <td className="py-2.5 px-4 text-zinc-400 max-w-[220px] truncate" title={a.reason}>{a.reason}</td>
                                    <td className="py-2.5 px-4">
                                        <span className={cn("px-2 py-0.5 rounded border text-[10px] font-bold", WFH_STATUS_STYLE[a.status])} data-testid="wfh-status">{a.status}</span>
                                        {a.approverName && <p className="text-[10px] text-zinc-500 mt-0.5">by {a.approverName}{a.decidedAt ? ` · ${fmtTs(a.decidedAt)}` : ""}</p>}
                                        {a.decisionRemarks && <p className="text-[10px] text-zinc-500 italic">“{a.decisionRemarks}”</p>}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">{a.canCancel && <button onClick={() => cancel(a.id)} data-testid="wfh-cancel" className="text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-2.5 py-1">Cancel</button>}</td>
                                </tr>
                            ))}
                            {!apps.length && <tr><td colSpan={6} className="py-8 text-center text-zinc-500">No Work From Home applications yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Application form */}
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
                    <form onSubmit={submit} className="card w-full max-w-lg p-6 relative z-10 space-y-4 max-h-[90vh] overflow-y-auto" data-testid="wfh-form">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base font-bold text-white flex items-center gap-2"><Home size={16} className="text-emerald-400" /> Work From Home Application</h2>
                            <button type="button" onClick={onClose} className="text-muted hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[11px] rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                            <div><p className="text-zinc-500">Employee Name</p><p className="text-white font-bold">{me?.name}</p></div>
                            <div><p className="text-zinc-500">Employee ID</p><p className="text-white font-mono">{user.id}</p></div>
                            <div><p className="text-zinc-500">Designation</p><p className="text-white">{me?.designation || "—"}</p></div>
                            <div><p className="text-zinc-500">Department</p><p className="text-white">{me?.dept || "—"}</p></div>
                        </div>
                        <div className="space-y-1.5">
                            <label className={label}>Work From Home Type</label>
                            <select value={form.wfhType} onChange={e => setForm({ ...form, wfhType: e.target.value, endDate: e.target.value === "HALF_DAY" ? form.startDate : form.endDate })} className={input} data-testid="wfh-type">
                                <option value="FULL_DAY">Full Day</option><option value="HALF_DAY">Half Day</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><label className={label}>Start Date</label>
                                <input type="date" required min={todayIST()} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value, endDate: form.wfhType === "HALF_DAY" || form.endDate < e.target.value ? e.target.value : form.endDate })} className={input} data-testid="wfh-start" /></div>
                            <div className="space-y-1.5"><label className={label}>End Date</label>
                                <input type="date" required min={form.startDate} disabled={form.wfhType === "HALF_DAY"} value={form.wfhType === "HALF_DAY" ? form.startDate : form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={cn(input, form.wfhType === "HALF_DAY" && "opacity-50")} data-testid="wfh-end" /></div>
                        </div>
                        <div className="space-y-1.5"><label className={label}>Reason</label>
                            <textarea required rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason for working from home" className={cn(input, "resize-none")} data-testid="wfh-reason" /></div>
                        <div className="space-y-1.5"><label className={label}>Additional Remarks <span className="normal-case font-normal">(optional)</span></label>
                            <input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className={input} data-testid="wfh-remarks" /></div>
                        {error && <p className="text-[11px] text-red-400 flex items-center gap-1.5" data-testid="wfh-error"><AlertTriangle size={12} /> {error}</p>}
                        <div className="flex justify-end gap-3 pt-3 border-t border-border">
                            <button type="button" onClick={onClose} className="btn-outline text-xs py-2 px-6">Cancel</button>
                            <button type="submit" disabled={busy} className="btn-primary text-xs py-2 px-6 flex items-center gap-2 disabled:opacity-50" data-testid="wfh-submit">
                                {busy && <Loader2 size={13} className="animate-spin" />} Submit Application
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}