"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, X, Loader2, Search, Check, Eye, Send, RefreshCw, Users, Upload, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMinWidth } from "@/lib/use-min-width";
import { uploadToCloudinary } from "@/lib/cloudinary";

/**
 * HOI college-wise announcement (part of the existing Announcements page).
 * Colleges, recipients and permissions all come from the backend (/api/notices/college).
 */
type College = { id: string; name: string };
const dmy = (v?: string) => (v ? (v.length > 10 ? new Date(v).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : v.split("-").reverse().join("-")) : "—");
const EMPTY = { announcementType: "", customType: "", title: "", description: "", effectiveDate: "", additionalDetails: "" };

export function HoiCreateAnnouncementButton({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    return (<>
        <button onClick={() => setOpen(true)} data-testid="hoi-ann-create" className="btn-primary flex items-center gap-2 px-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]"><Megaphone size={16} /> Create Announcement</button>
        {open && <HoiAnnouncementModal onClose={() => setOpen(false)} onCreated={() => { onCreated?.(); }} />}
    </>);
}

function HoiAnnouncementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [colleges, setColleges] = useState<College[] | null>(null);
    const [types, setTypes] = useState<string[]>([]);
    const [form, setForm] = useState(EMPTY);
    const [sel, setSel] = useState<string[]>([]);
    const [q, setQ] = useState(""); const [dd, setDd] = useState(false);
    const [count, setCount] = useState<{ count: number; perCollege: { id: string; name: string; count: number }[] } | null>(null);
    const [counting, setCounting] = useState(false);
    const [images, setImages] = useState<string[]>([]); const [uploading, setUploading] = useState(false);
    const [step, setStep] = useState<"form" | "preview" | "done">("form");
    const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/notices/college", { cache: "no-store" }).then(r => r.json()).then(d => { setColleges(d.colleges || []); setTypes(d.types || []); }).catch(() => setErr("Could not load your colleges."));
    }, []);
    useEffect(() => {
        if (!sel.length) { setCount(null); return; }
        let live = true; setCounting(true);
        fetch(`/api/notices/college?recipients=${encodeURIComponent(sel.join(","))}`, { cache: "no-store" }).then(r => r.json()).then(d => { if (live) setCount(d.count !== undefined ? d : null); }).finally(() => live && setCounting(false));
        return () => { live = false; };
    }, [sel]);

    const list = (colleges || []).filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
    const allOn = !!colleges?.length && sel.length === colleges.length;
    const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    const nameOf = (id: string) => colleges?.find(c => c.id === id)?.name || id;
    const typeLabel = form.announcementType === "Other" ? form.customType.trim() : form.announcementType;

    const check = () => {
        if (!form.announcementType) return "Select the announcement type.";
        if (form.announcementType === "Other" && !form.customType.trim()) return "Enter the announcement type.";
        if (!sel.length) return "Select at least one college.";
        if (form.title.trim().length < 2) return "Enter the announcement title.";
        if (form.description.trim().length < 2) return "Enter the announcement description.";
        if (count && count.count === 0) return "There are no active professors or OMs in the selected college(s).";
        return "";
    };
    const toPreview = () => { const e = check(); setErr(e); if (!e) setStep("preview"); };
    const announce = async () => {
        const e = check(); if (e) { setErr(e); setStep("form"); return; }
        setBusy(true); setErr("");
        try {
            const r = await fetch("/api/notices/college", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, collegeIds: sel, imageUrls: images }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { setErr(d.error || "Could not publish."); return; }
            setDone(d.message || "Announcement published."); setStep("done"); onCreated();
        } finally { setBusy(false); }
    };
    const upload = async (files: FileList | null) => {
        if (!files?.length) return; setUploading(true);
        try { for (const f of Array.from(files)) { const r = await uploadToCloudinary(f); setImages(x => [...x, r.secure_url]); } }
        catch { setErr("Upload failed."); } finally { setUploading(false); }
    };
    const field = "w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary/50";
    const label = "block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5";

    return (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" data-testid="hoi-ann-modal">
            <div className="w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[94vh] overflow-y-auto">
                <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-black text-white flex items-center gap-2"><Megaphone size={16} className="text-primary" /> {step === "preview" ? "Preview Announcement" : step === "done" ? "Announcement Published" : "Create Announcement"}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                    {step === "done" ? (
                        <div className="text-center py-6 space-y-3" data-testid="hoi-ann-done">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto"><Check size={22} /></div>
                            <p className="text-sm font-bold text-white">{done}</p>
                            <p className="text-[11px] text-zinc-500">E-mails are being sent now. Delivery status is in My Announcements.</p>
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-white">Close</button>
                        </div>
                    ) : step === "preview" ? (<>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3" data-testid="hoi-ann-preview">
                            <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary uppercase">{typeLabel}</span>
                            <h3 className="text-base font-bold text-white [overflow-wrap:anywhere]">{form.title}</h3>
                            <div className="flex flex-wrap gap-1.5">{sel.map(id => <span key={id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">{nameOf(id)}</span>)}</div>
                            {form.effectiveDate && <p className="text-[11px] text-zinc-400">Effective Date: <b className="text-white">{dmy(form.effectiveDate)}</b></p>}
                            <p className="text-xs text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{form.description}</p>
                            {form.additionalDetails && <p className="text-xs text-zinc-400 whitespace-pre-wrap [overflow-wrap:anywhere] border-t border-zinc-800 pt-2">{form.additionalDetails}</p>}
                            {images.length > 0 && <div className="flex flex-wrap gap-2">{images.map(u => <img key={u} src={u} alt="" className="w-16 h-16 rounded-lg object-cover border border-zinc-800" />)}</div>}
                        </div>
                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 text-xs text-amber-100" data-testid="hoi-ann-confirm">
                            Everyone will see this in Announcements. The e-mail goes only to <b>{count?.count ?? "…"}</b> professor{count?.count === 1 ? "" : "s"} / OM{count?.count === 1 ? "" : "s"} of <b>{sel.map(nameOf).join(", ")}</b>, one e-mail each.
                        </div>
                        {err && <p className="text-[11px] text-red-400" role="alert" data-testid="hoi-ann-error">{err}</p>}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button onClick={() => setStep("form")} disabled={busy} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Back</button>
                            <button onClick={announce} disabled={busy} data-testid="hoi-ann-announce" className="px-5 py-2.5 rounded-xl bg-primary text-xs font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Announce</button>
                        </div>
                    </>) : (<>
                        <p className="text-[11px] text-zinc-400 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2" data-testid="hoi-ann-holiday-hint">To announce a holiday, use <a href="/manager/holidays" className="text-primary font-bold hover:underline">Holidays → Announce Holiday</a>.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={label} htmlFor="ann-type">Announcement Type *</label>
                                <select id="ann-type" data-testid="hoi-ann-type" value={form.announcementType} onChange={e => setForm({ ...form, announcementType: e.target.value })} className={field}>
                                    <option value="">Select type</option>{types.map(t => <option key={t}>{t}</option>)}
                                </select></div>
                            {form.announcementType === "Other"
                                ? <div><label className={label} htmlFor="ann-custom">Custom Type *</label><input id="ann-custom" data-testid="hoi-ann-custom" maxLength={80} value={form.customType} onChange={e => setForm({ ...form, customType: e.target.value })} className={field} /></div>
                                : <div><label className={label} htmlFor="ann-date">Effective Date</label><input id="ann-date" type="date" data-testid="hoi-ann-date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className={cn(field, "[color-scheme:dark]")} /></div>}
                            {form.announcementType === "Other" && <div><label className={label} htmlFor="ann-date2">Effective Date</label><input id="ann-date2" type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className={cn(field, "[color-scheme:dark]")} /></div>}
                        </div>
                        {/* Searchable multi-select of the HOI's colleges */}
                        <div className="relative">
                            <label className={label}>Select College(s) *</label>
                            <button type="button" onClick={() => setDd(o => !o)} data-testid="hoi-ann-colleges" aria-expanded={dd} className={cn(field, "flex items-center justify-between text-left")}>
                                <span className={sel.length ? "text-white" : "text-zinc-500"}>{sel.length ? `${sel.length} college${sel.length === 1 ? "" : "s"} selected` : "Select colleges"}</span><Building2 size={14} className="text-zinc-500" />
                            </button>
                            {dd && (
                                <div className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-2 space-y-1" data-testid="hoi-ann-college-list">
                                    <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search colleges" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-2 py-2 text-xs text-white outline-none" /></div>
                                    {colleges === null ? <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-zinc-500" /></div> : colleges.length === 0 ? <p className="text-xs text-zinc-500 p-2">No colleges are assigned to you.</p> : (<>
                                        <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs font-bold text-primary cursor-pointer">
                                            <input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : colleges.map(c => c.id))} data-testid="hoi-ann-all" /> Select All Assigned Colleges
                                        </label>
                                        <div className="max-h-52 overflow-y-auto">
                                            {list.map(c => (
                                                <label key={c.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs text-zinc-200 cursor-pointer">
                                                    <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} data-testid={`hoi-ann-col-${c.id}`} /> <span className="[overflow-wrap:anywhere]">{c.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </>)}
                                </div>
                            )}
                            {sel.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2" data-testid="hoi-ann-chips">
                                    {sel.map(id => <span key={id} className="inline-flex items-center gap-1 text-[10px] font-bold pl-2 pr-1 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">{nameOf(id)}<button type="button" onClick={() => toggle(id)} aria-label={`Remove ${nameOf(id)}`} className="p-0.5 rounded-full hover:bg-white/10"><X size={10} /></button></span>)}
                                </div>
                            )}
                            <p className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5" data-testid="hoi-ann-count"><Users size={12} />
                                {!sel.length ? "Select colleges to see the recipients." : counting ? "Counting recipients…" : count ? <>E-mail to: <b className="text-white">{count.count}</b> professor{count.count === 1 ? "" : "s"} / OM{count.count === 1 ? "" : "s"}{count.perCollege.length > 1 ? <span className="text-zinc-500"> ({count.perCollege.map(p => `${p.name} ${p.count}`).join(" · ")})</span> : null}</> : "—"}
                            </p>
                        </div>
                        <div><label className={label} htmlFor="ann-title">Announcement Title *</label><input id="ann-title" data-testid="hoi-ann-title" maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={field} /></div>
                        <div><label className={label} htmlFor="ann-desc">Announcement Description *</label><textarea id="ann-desc" data-testid="hoi-ann-desc" rows={5} maxLength={10000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={field} /></div>
                        <div><label className={label} htmlFor="ann-more">Additional Details (optional)</label><textarea id="ann-more" rows={2} maxLength={4000} value={form.additionalDetails} onChange={e => setForm({ ...form, additionalDetails: e.target.value })} className={field} /></div>
                        <div>
                            <label className={label}>Attachment (optional)</label>
                            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
                            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-zinc-800 hover:border-primary/40 rounded-xl p-3 text-[11px] text-zinc-500 flex items-center justify-center gap-2">{uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload images</button>
                            {images.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{images.map(u => <span key={u} className="relative"><img src={u} alt="" className="w-14 h-14 rounded-lg object-cover border border-zinc-800" /><button type="button" onClick={() => setImages(x => x.filter(y => y !== u))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center" aria-label="Remove"><X size={9} /></button></span>)}</div>}
                        </div>
                        {err && <p className="text-[11px] text-red-400" role="alert" data-testid="hoi-ann-error">{err}</p>}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Cancel</button>
                            <button onClick={toPreview} data-testid="hoi-ann-preview-btn" className="px-4 py-2.5 rounded-xl border border-primary/40 text-xs font-bold text-primary flex items-center justify-center gap-2"><Eye size={14} /> Preview Announcement</button>
                            <button onClick={toPreview} data-testid="hoi-ann-next" className="px-5 py-2.5 rounded-xl bg-primary text-xs font-bold text-white flex items-center justify-center gap-2"><Send size={14} /> Announce</button>
                        </div>
                    </>)}
                </div>
            </div>
        </div>
    );
}

/** HOI: My Announcements (HR / Founder: all HOI college announcements) — delivery status + retry of failed e-mails */
export function HoiAnnouncementHistory({ reloadKey = 0 }: { reloadKey?: number }) {
    const [rows, setRows] = useState<any[] | null>(null);
    const [msg, setMsg] = useState(""); const [busy, setBusy] = useState("");
    const wide = useMinWidth(1024);
    const load = useCallback(() => fetch("/api/notices/college", { cache: "no-store" }).then(r => r.json()).then(d => setRows(d.history || [])).catch(() => setRows([])), []);
    useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load, reloadKey]);
    const retry = async (id: string) => {
        setBusy(id); setMsg("");
        try { const r = await fetch("/api/notices/college", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "retry" }) }); const d = await r.json(); setMsg(d.message || d.error || ""); await load(); }
        finally { setBusy(""); }
    };
    const status = (r: any) => <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-full", r.delivery.FAILED ? "bg-red-500/10 text-red-300" : r.delivery.PENDING ? "bg-sky-500/10 text-sky-300" : "bg-emerald-500/10 text-emerald-300")} data-testid="hist-delivery">{r.delivery.FAILED ? `${r.delivery.SENT} sent · ${r.delivery.FAILED} failed` : r.delivery.PENDING ? `Sending (${r.delivery.SENT}/${r.delivery.total})` : `Sent ${r.delivery.SENT}/${r.delivery.total}`}</span>;
    const retryBtn = (r: any) => r.canRetry ? <button onClick={() => retry(r.id)} disabled={!!busy} data-testid="hist-retry" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-[10px] font-bold text-zinc-200 disabled:opacity-50">{busy === r.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Retry failed</button> : null;
    const cols = (r: any) => r.colleges.map((c: any) => c.name).join(", ");
    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3" data-testid="hoi-ann-history">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Megaphone size={15} className="text-primary" /> My Announcements</h2>
            {msg && <p className="text-[11px] text-emerald-400" role="status">{msg}</p>}
            {rows === null ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div> : rows.length === 0 ? <p className="text-xs text-zinc-500 text-center py-6">No college announcements yet.</p> : wide ? (
                <table className="w-full text-xs table-fixed">
                    <thead><tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                        <th className="py-2 px-2 w-[22%]">Announcement</th><th className="py-2 px-2 w-[13%]">Type</th><th className="py-2 px-2 w-[18%]">Colleges</th><th className="py-2 px-2 w-[9%]">Created</th><th className="py-2 px-2 w-[9%]">Effective</th><th className="py-2 px-2 w-[8%]">Recipients</th><th className="py-2 px-2 w-[13%]">E-mail</th><th className="py-2 px-2 w-[8%]">Status</th>
                    </tr></thead>
                    <tbody>{rows.map(r => (
                        <tr key={r.id} className="border-b border-zinc-800/60 align-top" data-testid="hist-row">
                            <td className="py-2.5 px-2 text-white font-bold [overflow-wrap:anywhere]">{r.title}</td><td className="py-2.5 px-2 text-zinc-300">{r.announcementType}</td>
                            <td className="py-2.5 px-2 text-sky-300 [overflow-wrap:anywhere]" data-testid="hist-colleges">{cols(r)}</td><td className="py-2.5 px-2 text-zinc-400">{dmy(r.createdAt)}</td><td className="py-2.5 px-2 text-zinc-400">{dmy(r.effectiveDate)}</td>
                            <td className="py-2.5 px-2 text-white tabular-nums" data-testid="hist-recipients">{r.recipients}</td><td className="py-2.5 px-2 space-y-1">{status(r)}<div>{retryBtn(r)}</div></td><td className="py-2.5 px-2 text-emerald-300">{r.status}</td>
                        </tr>
                    ))}</tbody>
                </table>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {rows.map(r => (
                        <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-2 text-xs min-w-0" data-testid="hist-card">
                            <div className="flex items-start justify-between gap-2"><p className="font-bold text-white [overflow-wrap:anywhere]">{r.title}</p><span className="shrink-0 text-[10px] text-emerald-300">{r.status}</span></div>
                            <p className="text-zinc-400">{r.announcementType} · {dmy(r.createdAt)}{r.effectiveDate ? ` · Effective ${dmy(r.effectiveDate)}` : ""}</p>
                            <p className="text-sky-300 [overflow-wrap:anywhere]" data-testid="hist-colleges">{cols(r)}</p>
                            <div className="flex flex-wrap items-center gap-2"><span className="text-zinc-300">Recipients: <b data-testid="hist-recipients">{r.recipients}</b></span>{status(r)}{retryBtn(r)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * HR / HR Executive / Founder → Add Announcement: General (everyone) or selected college(s); category Holiday adds
 * the holiday (approved) for everyone / those colleges. E-mail goes only to the chosen audience (one e-mail each).
 */
export function HrAnnouncementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [colleges, setColleges] = useState<College[] | null>(null);
    const [cats, setCats] = useState<string[]>([]);
    const [form, setForm] = useState({ category: "General", title: "", content: "", holidayDate: "" });
    const [scope, setScope] = useState<"GENERAL" | "COLLEGES">("GENERAL");
    const [sel, setSel] = useState<string[]>([]);
    const [q, setQ] = useState(""); const [dd, setDd] = useState(false);
    const [count, setCount] = useState<number | null>(null); const [counting, setCounting] = useState(false);
    const [images, setImages] = useState<string[]>([]); const [uploading, setUploading] = useState(false);
    const [step, setStep] = useState<"form" | "preview" | "done">("form");
    const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    useEffect(() => { fetch("/api/notices/college", { cache: "no-store" }).then(r => r.json()).then(d => { setColleges(d.colleges || []); setCats(d.types || []); }).catch(() => setErr("Could not load colleges.")); }, []);
    useEffect(() => {
        if (scope === "COLLEGES" && !sel.length) { setCount(null); return; }
        let live = true; setCounting(true);
        fetch(scope === "GENERAL" ? "/api/notices/college?scope=GENERAL" : `/api/notices/college?recipients=${encodeURIComponent(sel.join(","))}`, { cache: "no-store" })
            .then(r => r.json()).then(d => { if (live) setCount(typeof d.count === "number" ? d.count : null); }).finally(() => live && setCounting(false));
        return () => { live = false; };
    }, [scope, sel]);
    const isHoliday = form.category === "Holiday";
    const list = (colleges || []).filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
    const allOn = !!colleges?.length && sel.length === colleges.length;
    const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    const nameOf = (id: string) => colleges?.find(c => c.id === id)?.name || id;
    const audience = scope === "GENERAL" ? "Everyone (General)" : sel.map(nameOf).join(", ");
    const check = () => {
        if (!form.category) return "Select the category.";
        if (scope === "COLLEGES" && !sel.length) return "Select at least one college, or choose General (everyone).";
        if (isHoliday && !form.holidayDate) return "Select the holiday date.";
        if (form.title.trim().length < 2) return "Enter the announcement title.";
        if (form.content.trim().length < 2) return "Enter the announcement content.";
        if (count === 0) return "There are no active employees in the selected college(s).";
        return "";
    };
    const toPreview = () => { const e = check(); setErr(e); if (!e) setStep("preview"); };
    const announce = async () => {
        const e = check(); if (e) { setErr(e); setStep("form"); return; }
        setBusy(true); setErr("");
        try {
            const r = await fetch("/api/notices/college", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, scope, collegeIds: scope === "GENERAL" ? [] : sel, imageUrls: images }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { setErr(d.error || "Could not publish."); setStep("form"); return; }
            setDone(d.message || "Announcement published."); setStep("done"); onCreated();
        } finally { setBusy(false); }
    };
    const upload = async (files: FileList | null) => {
        if (!files?.length) return; setUploading(true);
        try { for (const f of Array.from(files)) { const r = await uploadToCloudinary(f); setImages(x => [...x, r.secure_url]); } }
        catch { setErr("Upload failed."); } finally { setUploading(false); }
    };
    const field = "w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary/50";
    const label = "block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5";
    return (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" data-testid="hr-ann-modal">
            <div className="w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-h-[94vh] overflow-y-auto">
                <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-black text-white flex items-center gap-2"><Megaphone size={16} className="text-primary" /> {step === "preview" ? "Preview Announcement" : step === "done" ? "Announcement Published" : "Add Announcement"}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                    {step === "done" ? (
                        <div className="text-center py-6 space-y-3" data-testid="hr-ann-done">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto"><Check size={22} /></div>
                            <p className="text-sm font-bold text-white">{done}</p>
                            <p className="text-[11px] text-zinc-500">E-mails are being sent now. Delivery status is in the "College / HR Announcements" tab.</p>
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-white">Close</button>
                        </div>
                    ) : step === "preview" ? (<>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3" data-testid="hr-ann-preview">
                            <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary uppercase">{form.category}</span>
                            <h3 className="text-base font-bold text-white [overflow-wrap:anywhere]">{form.title}</h3>
                            <p className="text-[11px] text-sky-300 [overflow-wrap:anywhere]">Audience: {audience}</p>
                            {isHoliday && <p className="text-[11px] text-zinc-400">Holiday Date: <b className="text-white">{dmy(form.holidayDate)}</b></p>}
                            <p className="text-xs text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{form.content}</p>
                            {images.length > 0 && <div className="flex flex-wrap gap-2">{images.map(u => <img key={u} src={u} alt="" className="w-16 h-16 rounded-lg object-cover border border-zinc-800" />)}</div>}
                        </div>
                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 text-xs text-amber-100" data-testid="hr-ann-confirm">
                            Everyone will see this in Announcements. The e-mail goes to <b>{count ?? "…"}</b> employee{count === 1 ? "" : "s"} — <b>{audience}</b>.{isHoliday ? (scope === "GENERAL" ? " The holiday is added for everyone." : " The holiday is added for the selected colleges only.") : ""}
                        </div>
                        {err && <p className="text-[11px] text-red-400" role="alert" data-testid="hr-ann-error">{err}</p>}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button onClick={() => setStep("form")} disabled={busy} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Back</button>
                            <button onClick={announce} disabled={busy} data-testid="hr-ann-announce" className="px-5 py-2.5 rounded-xl bg-primary text-xs font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Announce</button>
                        </div>
                    </>) : (<>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={label} htmlFor="hr-cat">Category *</label>
                                <select id="hr-cat" data-testid="hr-ann-cat" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={field}>{cats.map(c => <option key={c}>{c}</option>)}</select></div>
                            {isHoliday && <div><label className={label} htmlFor="hr-hdate">Holiday Date *</label><input id="hr-hdate" type="date" data-testid="hr-ann-hdate" value={form.holidayDate} onChange={e => setForm({ ...form, holidayDate: e.target.value })} className={cn(field, "[color-scheme:dark]")} /></div>}
                        </div>
                        <div>
                            <label className={label}>Send To *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {([["GENERAL", "General — everyone"], ["COLLEGES", "Select college(s)"]] as const).map(([k, l]) => (
                                    <label key={k} className={cn("flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer", scope === k ? "border-primary/50 bg-primary/10 text-white" : "border-zinc-800 text-zinc-400")}>
                                        <input type="radio" name="hr-scope" checked={scope === k} onChange={() => setScope(k)} data-testid={`hr-ann-scope-${k}`} /> {l}
                                    </label>
                                ))}
                            </div>
                        </div>
                        {scope === "COLLEGES" && (
                            <div>
                                <button type="button" onClick={() => setDd(o => !o)} data-testid="hr-ann-colleges" aria-expanded={dd} className={cn(field, "flex items-center justify-between text-left")}>
                                    <span className={sel.length ? "text-white" : "text-zinc-500"}>{sel.length ? `${sel.length} college${sel.length === 1 ? "" : "s"} selected` : "Select colleges"}</span><Building2 size={14} className="text-zinc-500" />
                                </button>
                                {dd && (
                                    <div className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-2 space-y-1" data-testid="hr-ann-college-list">
                                        <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search colleges" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-2 py-2 text-xs text-white outline-none" /></div>
                                        {colleges === null ? <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-zinc-500" /></div> : (<>
                                            <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs font-bold text-primary cursor-pointer"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : colleges.map(c => c.id))} /> Select All Colleges</label>
                                            <div className="max-h-52 overflow-y-auto">{list.map(c => (
                                                <label key={c.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs text-zinc-200 cursor-pointer"><input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} data-testid={`hr-ann-col-${c.id}`} /> <span className="[overflow-wrap:anywhere]">{c.name}</span></label>
                                            ))}</div>
                                        </>)}
                                    </div>
                                )}
                                {sel.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{sel.map(id => <span key={id} className="inline-flex items-center gap-1 text-[10px] font-bold pl-2 pr-1 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">{nameOf(id)}<button type="button" onClick={() => toggle(id)} aria-label={`Remove ${nameOf(id)}`} className="p-0.5 rounded-full hover:bg-white/10"><X size={10} /></button></span>)}</div>}
                            </div>
                        )}
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5" data-testid="hr-ann-count"><Users size={12} />
                            {scope === "COLLEGES" && !sel.length ? "Select colleges to see the recipients." : counting ? "Counting recipients…" : count !== null ? <>E-mail to: <b className="text-white">{count}</b> employee{count === 1 ? "" : "s"}</> : "—"}
                        </p>
                        <div><label className={label} htmlFor="hr-title">Title *</label><input id="hr-title" data-testid="hr-ann-title" maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={field} /></div>
                        <div><label className={label} htmlFor="hr-content">Content *</label><textarea id="hr-content" data-testid="hr-ann-content" rows={5} maxLength={10000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className={field} /></div>
                        <div>
                            <label className={label}>Images (optional)</label>
                            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
                            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-zinc-800 hover:border-primary/40 rounded-xl p-3 text-[11px] text-zinc-500 flex items-center justify-center gap-2">{uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload images</button>
                            {images.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{images.map(u => <span key={u} className="relative"><img src={u} alt="" className="w-14 h-14 rounded-lg object-cover border border-zinc-800" /><button type="button" onClick={() => setImages(x => x.filter(y => y !== u))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center" aria-label="Remove"><X size={9} /></button></span>)}</div>}
                        </div>
                        {err && <p className="text-[11px] text-red-400" role="alert" data-testid="hr-ann-error">{err}</p>}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Cancel</button>
                            <button onClick={toPreview} data-testid="hr-ann-preview-btn" className="px-4 py-2.5 rounded-xl border border-primary/40 text-xs font-bold text-primary flex items-center justify-center gap-2"><Eye size={14} /> Preview</button>
                            <button onClick={toPreview} data-testid="hr-ann-next" className="px-5 py-2.5 rounded-xl bg-primary text-xs font-bold text-white flex items-center justify-center gap-2"><Send size={14} /> Announce</button>
                        </div>
                    </>)}
                </div>
            </div>
        </div>
    );
}