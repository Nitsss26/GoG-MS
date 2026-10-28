"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Upload, FileText, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";

/**
 * Employee side of the Late Clock-In Justification workflow:
 *  - useLateJustifications(): own late days + justification status (GET /api/attendance/late-justification)
 *  - LateJustificationModal: reason (required) + optional PDF / JPG / PNG → POST /api/attendance/late-justification
 *  - LateJustificationTag: status shown in the Attendance Log
 * The clock-in itself is already saved before the form opens; submitting it never changes the clock-in time.
 */
export const fmtDmy = (d?: string) => (d ? d.split("-").reverse().join("-") : "—");
export const t12 = (t?: string) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return isNaN(h) ? t : `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
export const fmtMins = (m?: number) => (m == null || isNaN(m) ? "—" : m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);
export const JUSTIFICATION_LABEL: Record<string, string> = { not_submitted: "Not Submitted", pending: "Pending HR Review", approved: "Approved", rejected: "Rejected" };
export const JUSTIFICATION_STYLE: Record<string, string> = {
    not_submitted: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    pending: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    approved: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    rejected: "text-red-300 bg-red-500/10 border-red-500/20",
};
const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const DISMISS_KEY = (date: string) => `gog_late_justify_later_${date}`;

export function useLateJustifications(enabled: boolean, refreshKey: string) {
    const [days, setDays] = useState<any[]>([]);
    const reload = useCallback(async () => {
        if (!enabled) return;
        try { const r = await fetch("/api/attendance/late-justification", { cache: "no-store" }); if (r.ok) setDays((await r.json()).days || []); }
        catch { /* attendance still works without it */ }
    }, [enabled]);
    useEffect(() => { reload(); }, [reload, refreshKey]);
    const byDate = useMemo(() => new Map(days.map((d: any) => [d.date, d])), [days]);
    return { days, byDate, reload };
}

/** Opens the form by itself for today's late clock-in until it is submitted (or "Later" is chosen for today) */
export function useAutoOpenLateForm(today: string, byDate: Map<string, any>, open: (d: any) => void) {
    const day = today ? byDate.get(today) : null;
    useEffect(() => {
        if (!day || day.justificationStatus !== "not_submitted") return;
        let later = false;
        try { later = sessionStorage.getItem(DISMISS_KEY(today)) === "1"; } catch { /* ignore */ }
        if (!later) open(day);
    }, [day?.date, day?.justificationStatus]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function LateJustificationTag({ day, onJustify }: { day?: any; onJustify: (d: any) => void }) {
    if (!day) return null;
    const st = day.justificationStatus;
    return (
        <span className="inline-flex items-center gap-1 flex-wrap" data-testid="late-justification-tag" data-status={st}>
            {st === "approved" && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-emerald-300 bg-emerald-500/10" title={`Clocked in ${t12(day.actualClockIn)} (scheduled ${t12(day.scheduledClockIn)})`}>✓ Normal Clock-In (late excused)</span>}
            <button onClick={() => onJustify(day)} className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border hover:brightness-125", JUSTIFICATION_STYLE[st])} title={day.rejectionReason ? `HR: ${day.rejectionReason}` : day.justificationReason || "View"}>
                Justification: {JUSTIFICATION_LABEL[st] || st}
            </button>
            {st === "not_submitted" && <button onClick={() => onJustify(day)} data-testid="late-justify-btn" className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-200 hover:bg-amber-500/10">Submit Justification</button>}
        </span>
    );
}

export function LateJustificationModal({ day, user, onClose, onSubmitted }: { day: any; user: any; onClose: () => void; onSubmitted: (msg: string) => void }) {
    const [reason, setReason] = useState("");
    const [doc, setDoc] = useState<{ url: string; name: string } | null>(null);
    const [busy, setBusy] = useState<"" | "upload" | "submit">("");
    const [error, setError] = useState("");
    const readOnly = day.justificationStatus !== "not_submitted";

    const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        if (!ALLOWED.includes(file.type) && !/\.(pdf|jpe?g|png)$/i.test(file.name)) { setError("Only PDF, JPG, JPEG or PNG files can be uploaded."); return; }
        if (file.size > 10 * 1024 * 1024) { setError("The file must be smaller than 10 MB."); return; }
        setBusy("upload"); setError("");
        try { const up = await uploadToCloudinary(file); setDoc({ url: up.secure_url, name: file.name }); }
        catch { setError(`Could not upload ${file.name}. You can try again or submit without a document.`); }
        finally { setBusy(""); }
    };
    const later = () => { try { sessionStorage.setItem(DISMISS_KEY(day.date), "1"); } catch { /* ignore */ } onClose(); };
    const submit = async () => {
        setError("");
        if (reason.trim().length < 5) { setError("Please explain the reason for your late arrival."); return; }
        setBusy("submit");
        try {
            const r = await fetch("/api/attendance/late-justification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: day.date, reason: reason.trim(), documentUrl: doc?.url || undefined }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { setError(d.error || "Could not submit the justification."); return; }
            onSubmitted(d.message || "Justification submitted. HR will review it.");
        } finally { setBusy(""); }
    };

    const rows: [string, string][] = [
        ["Employee Name", user?.name || "—"], ["Employee ID", user?.id || "—"], ["Date", fmtDmy(day.date)],
        ["Scheduled Reporting Time", t12(day.scheduledClockIn)], ["Actual Clock-In Time", t12(day.actualClockIn)], ["Late Duration", fmtMins(day.lateDurationMinutes)],
    ];
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" data-testid="late-justification-modal">
            <div className="absolute inset-0 bg-black/80" onClick={() => !busy && (readOnly ? onClose() : later())} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-amber-500/20 bg-zinc-950 p-5 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><Clock size={15} className="text-amber-400" /> Late Clock-In Justification</h3>
                    <button onClick={() => (readOnly ? onClose() : later())} className="text-zinc-500 hover:text-white" aria-label="Close"><X size={16} /></button>
                </div>
                {!readOnly && <p className="text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">Your clock-in is later than your scheduled reporting time. Please provide a reason for the delay.</p>}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    {rows.map(([k, v]) => <div key={k}><p className="text-[9px] uppercase tracking-widest text-zinc-500">{k}</p><p className={cn("text-zinc-200 mt-0.5", k === "Late Duration" && "text-amber-300 font-bold")}>{v}</p></div>)}
                </div>
                {readOnly ? (
                    <div className="space-y-2">
                        <p><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", JUSTIFICATION_STYLE[day.justificationStatus])}>{JUSTIFICATION_LABEL[day.justificationStatus]}</span></p>
                        <div><p className="text-[9px] uppercase tracking-widest text-zinc-500">Your reason</p><p className="text-zinc-200 mt-0.5 whitespace-pre-wrap">{day.justificationReason}</p></div>
                        {day.supportingDocument && <a href={day.supportingDocument} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline"><FileText size={12} /> Supporting document</a>}
                        {day.reviewedByName && <p className="text-zinc-400">Reviewed by {day.reviewedByName} ({day.reviewedByRole}){day.reviewedAt ? ` on ${new Date(day.reviewedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>}
                        {day.rejectionReason && <p className="text-red-300">Reason: {day.rejectionReason}</p>}
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Reason for Late Clock-In <span className="text-red-400">*</span></label>
                            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} maxLength={2000} placeholder="Please explain the reason for your late arrival." data-testid="late-justification-reason"
                                className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white outline-none focus:border-amber-500/50 resize-none" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Upload Supporting Document <span className="normal-case tracking-normal font-normal text-zinc-500">(optional · PDF, JPG, JPEG, PNG · max 10 MB)</span></p>
                            {doc ? (
                                <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2"><FileText size={13} className="text-emerald-400" />
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline truncate">{doc.name}</a>
                                    <button onClick={() => setDoc(null)} className="ml-auto text-zinc-500 hover:text-red-400" aria-label="Remove document"><X size={12} /></button></div>
                            ) : (
                                <label className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2.5 cursor-pointer hover:border-amber-500/40">
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={upload} disabled={!!busy} data-testid="late-justification-file" />
                                    {busy === "upload" ? <Loader2 size={14} className="animate-spin text-zinc-400" /> : <Upload size={14} className="text-zinc-400" />}
                                    <span className="text-[11px] text-zinc-300">{busy === "upload" ? "Uploading…" : "Choose a file"}</span>
                                </label>
                            )}
                        </div>
                        {error && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
                        <div className="flex gap-2">
                            <button disabled={!!busy} onClick={later} className="px-4 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 font-bold disabled:opacity-50" data-testid="late-justification-later">Later</button>
                            <button disabled={!!busy} onClick={submit} className="flex-1 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-bold disabled:opacity-50 flex items-center justify-center gap-1.5" data-testid="late-justification-submit">
                                {busy === "submit" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submit Justification
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-500">Your clock-in time is already saved. You can also submit this later from the Attendance Log.</p>
                    </>
                )}
            </div>
        </div>
    );
}
