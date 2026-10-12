"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, X, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/**
 * HOI Portal → Holidays → Announce Holiday (no HR approval).
 * The college list comes from the server (only colleges this HOI manages); the holiday is published in
 * Announcements and e-mailed to that college's employees. Delivery status per announcement, with retry.
 */
const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export default function HoiHolidayAnnouncements() {
    const { reloadHolidaysAndNotices } = useAuth();
    const [data, setData] = useState<{ colleges: { id: string; name: string }[]; types: string[]; holidays: any[] } | null>(null);
    const [open, setOpen] = useState(false);
    const blank = () => ({ title: "", collegeId: "", date: todayIST(), holidayType: "", reason: "", description: "" });
    const [form, setForm] = useState(blank());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/holidays/announce", { cache: "no-store" });
            const d = await r.json();
            if (r.ok) setData(d);
        } catch { /* keep */ }
    }, []);
    useEffect(() => { load(); }, [load]);
    const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 5000); };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(""); setBusy(true);
        try {
            const r = await fetch("/api/holidays/announce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not announce the holiday.");
            setOpen(false); setForm(blank()); flash(d.message); await reloadHolidaysAndNotices(); load();
            setTimeout(load, 4000); // e-mail delivery status fills in shortly after
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };
    const retry = async (holidayId: string) => {
        const r = await fetch("/api/holidays/announce", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ holidayId, action: "retry_emails" }) });
        const d = await r.json();
        flash(r.ok ? `Retried ${d.retried} failed e-mail(s); ${d.sent} sent.` : d.error || "Retry failed."); load();
    };

    const input = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-primary/50 [color-scheme:dark]";
    const label = "text-[10px] font-bold text-zinc-400 uppercase tracking-wider";
    return (
        <div className="space-y-3" data-testid="hoi-holiday">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2"><Megaphone size={15} className="text-amber-400" /> Announce Holiday</h2>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Announce a holiday directly for a college you manage — no HR approval. It is published in Announcements and e-mailed to that college&apos;s employees.</p>
                </div>
                <button onClick={() => { setOpen(true); setError(""); }} data-testid="hoi-announce-open" className="bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2"><Megaphone size={14} /> Announce Holiday</button>
            </div>
            {toast && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs px-4 py-3 flex items-center gap-2" data-testid="hoi-announce-toast"><CheckCircle2 size={14} /> {toast}</div>}

            {!!data?.holidays.length && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 divide-y divide-zinc-800/60" data-testid="hoi-announced-list">
                    <p className="px-4 py-2.5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">My announced holidays</p>
                    {data.holidays.map(h => {
                        const d = h.delivery || {};
                        return (
                            <div key={h.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-xs" data-testid="hoi-announced-row" data-id={h.id}>
                                <div className="flex-1 min-w-[14rem]">
                                    <p className="font-bold text-white">{h.name} <span className="text-zinc-500 font-normal">· {fmt(h.date)} · {h.holidayType}</span></p>
                                    <p className="text-[11px] text-zinc-400">{data.colleges.find(c => c.id === h.collegeIds?.[0])?.name || h.collegeIds?.[0]} · {h.reason}</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold">{h.publishedStatus || "Published"}</span>
                                <span className="text-[10px] text-zinc-400 flex items-center gap-1" data-testid="hoi-delivery"><Mail size={11} /> {d.SENT || 0} sent · {d.FAILED || 0} failed{d.PENDING ? ` · ${d.PENDING} pending` : ""}{d.SKIPPED ? ` · ${d.SKIPPED} no e-mail` : ""} / {d.total || 0}</span>
                                {d.FAILED > 0 && <button onClick={() => retry(h.id)} data-testid="hoi-retry" className="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1"><RefreshCw size={11} /> Retry failed</button>}
                            </div>
                        );
                    })}
                </div>
            )}

            {open && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
                    <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="hoi-announce-form">
                        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Megaphone size={15} className="text-amber-400" /> Announce Holiday</h3>
                            <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white"><X size={17} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <label className="block space-y-1"><span className={label}>Holiday Title</span>
                                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={input} placeholder="e.g. Diwali Holiday" data-testid="hoi-title" /></label>
                            <label className="block space-y-1"><span className={label}>Select College</span>
                                <select required value={form.collegeId} onChange={e => setForm({ ...form, collegeId: e.target.value })} className={input} data-testid="hoi-college">
                                    <option value="">Select college…</option>
                                    {(data?.colleges || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {data && !data.colleges.length && <span className="text-[10px] text-amber-300">No college is mapped to you yet — ask HR to set your Original Location.</span>}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block space-y-1"><span className={label}>Holiday Date</span>
                                    <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={input} data-testid="hoi-date" /></label>
                                <label className="block space-y-1"><span className={label}>Holiday Type</span>
                                    <select required value={form.holidayType} onChange={e => setForm({ ...form, holidayType: e.target.value })} className={input} data-testid="hoi-type">
                                        <option value="">Select type…</option>
                                        {(data?.types || []).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select></label>
                            </div>
                            <label className="block space-y-1"><span className={label}>Reason</span>
                                <input required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className={input} placeholder="Why is the holiday announced?" data-testid="hoi-reason" /></label>
                            <label className="block space-y-1"><span className={label}>Description <span className="normal-case font-normal">(optional)</span></span>
                                <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={cn(input, "resize-none")} data-testid="hoi-description" /></label>
                            {error && <p className="text-[11px] text-red-400 flex items-center gap-1.5" data-testid="hoi-announce-error"><AlertTriangle size={12} /> {error}</p>}
                        </div>
                        <div className="px-5 py-4 border-t border-zinc-800 flex justify-end gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold">Cancel</button>
                            <button type="submit" disabled={busy} data-testid="hoi-announce-submit" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />} Announce Holiday
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
