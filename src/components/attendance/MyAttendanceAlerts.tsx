"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Upload, FileText, X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";

/**
 * Employee → Attendance → My Attendance Alerts: own Late Clock-In / Early Clock-Out / Missing Clock-Out records
 * (the same ones emailed), and the explanation + proof form for a Missing Clock-Out.
 * Hidden when the employee has no alerts.
 */
const TYPE: Record<string, string> = { LATE_IN: "Late Clock-In", EARLY_OUT: "Early Clock-Out", MISSING_OUT: "Missing Clock-Out" };
const LEVEL: Record<string, string> = { FIRST_WARNING: "First Warning", SECOND_WARNING: "Second Warning", FINAL_WARNING: "Final Warning", HALF_DAY: "Half-Day Deduction", FULL_DAY: "Full-Day Deduction", MISSING_ALERT: "Missing Clock-Out Alert" };
const fmtDate = (d: string) => d.split("-").reverse().join("-");
const t12 = (t?: string) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return isNaN(h) ? t : `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
export const STATUS_STYLE: Record<string, string> = {
    "Not Required": "text-zinc-400 bg-zinc-800 border-zinc-700",
    "Pending HR Verification": "text-amber-300 bg-amber-500/10 border-amber-500/20",
    "Awaiting Explanation": "text-orange-300 bg-orange-500/10 border-orange-500/20",
    "Approved for Payroll": "text-red-300 bg-red-500/10 border-red-500/20",
    Rejected: "text-red-300 bg-red-500/10 border-red-500/20",
    Waived: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    Approved: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
};

export default function MyAttendanceAlerts() {
    const [rows, setRows] = useState<any[] | null>(null);
    const [open, setOpen] = useState<any | null>(null);
    const [text, setText] = useState("");
    const [proofs, setProofs] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        try { const r = await fetch("/api/attendance/violations", { cache: "no-store" }); if (r.ok) setRows((await r.json()).violations || []); else setRows([]); }
        catch { setRows([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    if (!rows || !rows.length) return null;

    const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { setError("Each file must be smaller than 10 MB."); return; }
        setBusy(true); setError("");
        try { const up = await uploadToCloudinary(file); setProofs(p => [...p, up.secure_url].slice(0, 5)); }
        catch { setError(`Could not upload ${file.name}. Please try again.`); }
        finally { setBusy(false); }
    };
    const submit = async () => {
        setError("");
        if (text.trim().length < 10) { setError("Please write your explanation (at least 10 characters)."); return; }
        if (!proofs.length) { setError("Please upload supporting proof."); return; }
        setBusy(true);
        try {
            const r = await fetch(`/api/attendance/violations/${open.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "explain", explanation: text.trim(), proofUrls: proofs }) });
            const d = await r.json();
            if (!r.ok) { setError(d.error || "Could not submit."); return; }
            setOpen(null); setText(""); setProofs([]); setMsg("Explanation submitted. HR will review it."); load();
        } finally { setBusy(false); }
    };

    return (
        <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl overflow-hidden" data-testid="my-att-alerts" id="alerts">
            <div className="p-4 border-b border-zinc-800/50 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" /><h3 className="text-sm font-semibold text-white">My Attendance Alerts</h3>
                <span className="text-[10px] text-zinc-500 ml-auto">Each alert was also emailed to you</span></div>
            {msg && <p className="px-4 pt-3 text-[11px] text-emerald-300">{msg}</p>}
            <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[820px]">
                    <thead><tr className="text-[9px] text-zinc-500 uppercase tracking-widest text-left">
                        {["Date", "Type", "Scheduled", "Actual", "Instance", "Level", "Status", "Action"].map(h => <th key={h} className="px-4 py-2.5">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {rows.slice(0, 30).map(v => (
                            <tr key={v.id} data-testid="my-alert-row" data-type={v.type}>
                                <td className="px-4 py-2.5 text-white whitespace-nowrap">{fmtDate(v.date)}</td>
                                <td className="px-4 py-2.5 text-zinc-300">{TYPE[v.type]}</td>
                                <td className="px-4 py-2.5 text-zinc-400">{t12(v.scheduledTime)}</td>
                                <td className="px-4 py-2.5 text-zinc-400">{v.type === "MISSING_OUT" ? (v.laterClockOut ? `Out ${t12(v.laterClockOut)}` : "Not clocked out") : t12(v.actualTime)}</td>
                                <td className="px-4 py-2.5 text-zinc-300">{v.instance}</td>
                                <td className="px-4 py-2.5 text-zinc-300 whitespace-nowrap">{LEVEL[v.level] || v.level}</td>
                                <td className="px-4 py-2.5"><span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", STATUS_STYLE[v.hrStatus] || STATUS_STYLE["Not Required"])}>{v.hrStatus === "Not Required" ? "Warning" : v.hrStatus}</span>
                                    {v.hrRemarks && <p className="text-[10px] text-zinc-500 mt-1 max-w-[180px] truncate" title={v.hrRemarks}>HR: {v.hrRemarks}</p>}</td>
                                <td className="px-4 py-2.5">
                                    {v.type === "MISSING_OUT" && v.hrStatus === "Awaiting Explanation"
                                        ? <button onClick={() => { setOpen(v); setError(""); setMsg(""); }} className="text-[10px] font-bold text-amber-200 border border-amber-500/30 rounded-lg px-2 py-1 hover:bg-amber-500/10" data-testid="alert-explain">Submit Explanation</button>
                                        : v.explanationAt ? <span className="text-[10px] text-zinc-500">Explanation sent</span> : <span className="text-zinc-600">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="alert-explain-form">
                    <div className="absolute inset-0 bg-black/80" onClick={() => !busy && setOpen(null)} />
                    <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Mail size={14} className="text-amber-400" /> Missing Clock-Out – {fmtDate(open.date)}</h3>
                            <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                        </div>
                        <p className="text-zinc-400">Scheduled clock-out {t12(open.scheduledTime)}. Explain why the clock-out was not recorded and upload proof that you were at work during the scheduled hours.</p>
                        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Your explanation" className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white outline-none focus:border-amber-500/50" data-testid="alert-explain-text" />
                        <label className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2.5 cursor-pointer hover:border-amber-500/40">
                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={upload} data-testid="alert-explain-file" />
                            {busy ? <Loader2 size={14} className="animate-spin text-zinc-400" /> : <Upload size={14} className="text-zinc-400" />}
                            <span className="text-[11px] text-zinc-300">{busy ? "Uploading…" : "Upload proof (image / PDF)"}</span>
                        </label>
                        {proofs.map((u, i) => <div key={u} className="flex items-center gap-2 text-[11px]"><FileText size={12} className="text-emerald-400" /><a href={u} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">Proof {i + 1}</a>
                            <button onClick={() => setProofs(p => p.filter(x => x !== u))} className="text-zinc-500 hover:text-red-400 ml-auto"><X size={12} /></button></div>)}
                        {error && <p className="text-[11px] text-red-400">{error}</p>}
                        <button disabled={busy} onClick={submit} className="w-full py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-bold disabled:opacity-50" data-testid="alert-explain-submit">Submit to HR</button>
                    </div>
                </div>
            )}
        </div>
    );
}