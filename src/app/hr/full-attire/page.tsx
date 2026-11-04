"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import SendEmailButton from "@/components/email-management/SendEmailButton";
import { Shirt, Search, Loader2, CheckCircle2, XCircle, Clock, X, History, AlertTriangle, ImagePlus, Trash2, Maximize2, RefreshCw } from "lucide-react";

/**
 * HR / HR Executive / Founder → Full Attire. One card per submission: the photo once (group or single), then every
 * professor with their own Accept / Reject. Rejection: Dress Code reason(s) + explanation (required) + optional
 * evidence image. Saving never emails — the email is sent from Email Management → Full Attire.
 */
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const ST: Record<string, { l: string; c: string; I: any }> = {
    pending: { l: "Pending", c: "text-amber-300 bg-amber-500/10 border-amber-500/25", I: Clock },
    accepted: { l: "Accepted", c: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", I: CheckCircle2 },
    rejected: { l: "Rejected", c: "text-red-300 bg-red-500/10 border-red-500/25", I: XCircle },
    replaced: { l: "Replaced (re-uploaded)", c: "text-zinc-400 bg-zinc-800/60 border-zinc-700", I: RefreshCw },
};

export default function HrFullAttirePage() {
    const { user } = useAuth();
    const [status, setStatus] = useState<"pending" | "reviewed" | "all">("pending");
    const [q, setQ] = useState("");
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [notice, setNotice] = useState<{ ok: boolean; text: string; reviewId?: string; name?: string } | null>(null);
    const [reject, setReject] = useState<{ sub: any; r: any } | null>(null);
    const [hist, setHist] = useState<{ name: string; rows: any[] | null } | null>(null);
    const [zoom, setZoom] = useState("");

    const load = useCallback(async () => {
        try {
            const p = new URLSearchParams({ view: "review", status }); if (q.trim()) p.set("q", q.trim());
            const r = await fetch(`/api/full-attire?${p}`, { cache: "no-store" });
            const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load");
            setData(d); setError("");
        } catch (e: any) { setError(e.message); }
    }, [status, q]);
    useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

    const decide = async (reviewId: string, body: any) => {
        setBusy(reviewId); setNotice(null);
        try {
            const r = await fetch("/api/full-attire/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId, ...body }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { await load(); return { ok: false, error: d.error || "Could not save" }; }
            // the decided review leaves the Pending list → its Send Email button is shown in this message too
            setNotice({ ok: true, text: d.message, reviewId, name: d.review?.professorName || "" }); await load(); return { ok: true };
        } finally { setBusy(""); }
    };
    const openHistory = async (r: any) => {
        setHist({ name: r.professorName, rows: null });
        const res = await fetch(`/api/full-attire?history=${encodeURIComponent(r.professorId)}`, { cache: "no-store" });
        const d = await res.json().catch(() => ({}));
        setHist({ name: r.professorName, rows: res.ok ? d.history || [] : [] });
    };

    if (!user) return null;
    if (user.role !== "HR" && user.role !== "FOUNDER") return <div className="p-8 text-center text-sm text-zinc-500">Only HR, HR Executive or Founders can review Full Attire.</div>;
    const c = data?.counts;
    return (
        <div className="p-3 sm:p-6 space-y-4 max-w-6xl mx-auto w-full" data-testid="full-attire-hr">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2"><Shirt size={20} className="text-primary" /> Full Attire Management</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">Accept or reject every professor separately, then use Send Email (here or in Email Management → Full Attire).</p>
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2 text-amber-200 text-xs"><b className="text-lg text-white tabular-nums mr-1" data-testid="fa-pending-count">{c?.pendingProfessors ?? "—"}</b> professor review(s) pending</div>
            </header>

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 sm:w-[360px]">
                    {([["pending", "Pending", c?.pending], ["reviewed", "Reviewed", c?.reviewed], ["all", "All", c?.all]] as const).map(([k, l, n]) => (
                        <button key={k} onClick={() => setStatus(k)} data-testid={`fa-tab-${k}`} className={cn("h-10 rounded-lg text-xs font-bold", status === k ? "bg-primary text-white" : "text-zinc-400")}>{l}{n !== undefined ? ` (${n})` : ""}</button>
                    ))}
                </div>
                <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search professor, submission, college or OM" className="w-full h-12 sm:h-full min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 text-sm text-white focus:outline-none focus:border-primary" /></div>
                <button onClick={load} className="h-11 px-3 rounded-xl border border-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center gap-1.5"><RefreshCw size={13} /> Refresh</button>
            </div>

            {notice && <div data-testid="fa-hr-notice" className={cn("rounded-xl border px-4 py-3 text-xs flex items-start gap-2", notice.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200")}>{notice.ok ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}<span className="min-w-0 [overflow-wrap:anywhere]">{notice.text}</span>{notice.ok && notice.reviewId && <span className="shrink-0" data-testid="fa-notice-send"><SendEmailButton small category="full_attire" relatedRecordId={notice.reviewId} status="not_sent" label="Send Email" onDone={res => setNotice({ ok: res.ok, text: res.ok ? `${notice.name || "Professor"}: email sent.` : (res.error || "Email could not be sent.") })} /></span>}<button onClick={() => setNotice(null)} className="ml-auto shrink-0" aria-label="Close"><X size={14} /></button></div>}
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-xs">{error}</div>}

            {!data ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                : !data.submissions.length ? <p className="py-16 text-center text-sm text-zinc-500">No {status === "all" ? "" : status} Full Attire submissions.</p> : (
                    <div className="space-y-4">
                        {data.submissions.map((s: any) => (
                            <article key={s.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden" data-testid="fa-sub" data-id={s.id}>
                                <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                    <span className="font-mono font-bold text-white">{s.id}</span>
                                    <span className="text-zinc-400">College: <span className="text-zinc-200">{s.collegeName || "—"}</span></span>
                                    <span className="text-zinc-400">Submitted by: <span className="text-zinc-200">{s.omName}</span></span>
                                    <span className="text-zinc-400">{dt(s.submittedAt)}</span>
                                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-zinc-500">{s.type === "group" ? `Group · ${s.reviews.length} professors` : "Single"}</span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                                    {/* the photo — once per submission */}
                                    <div className="p-3 bg-black/40 relative" data-testid="fa-photo-wrap">
                                        <img src={s.imageUrl} alt={`Full attire ${s.id}`} data-testid="fa-photo" className="w-full max-h-[60vh] object-contain rounded-xl bg-black" />
                                        <button onClick={() => setZoom(s.imageUrl)} className="absolute top-5 right-5 w-9 h-9 rounded-lg bg-black/60 text-white flex items-center justify-center" aria-label="Full screen"><Maximize2 size={15} /></button>
                                        {s.type === "group" && <p className="text-[10px] text-zinc-400 mt-2 px-1">Standing order, left → right: {s.standingOrder.map((o: any) => `${o.position}. ${o.professorName}`).join(" · ")}</p>}
                                        <p className="text-[10px] text-zinc-500 mt-1 px-1">Captured {dt(s.capturedAt)}</p>
                                    </div>
                                    {/* every professor — own decision */}
                                    <div className="divide-y divide-zinc-800/70" data-testid="fa-profs">
                                        {s.reviews.map((r: any) => {
                                            const st = ST[r.status] || ST.pending;
                                            return (
                                                <div key={r.id} className="p-3 sm:p-4 space-y-2" data-testid="fa-review" data-id={r.id} data-prof={r.professorId}>
                                                    <div className="flex items-start gap-2">
                                                        {s.type === "group" && <span className="w-7 h-7 shrink-0 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-black flex items-center justify-center">{r.position}</span>}
                                                        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white [overflow-wrap:anywhere]">{r.professorName}</p><p className="text-[10px] text-zinc-500">{r.professorId}{r.collegeName ? ` · ${r.collegeName}` : ""}</p></div>
                                                        <span className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black", st.c)} data-testid="fa-status"><st.I size={11} /> {st.l}</span>
                                                    </div>
                                                    {r.status === "pending" ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button onClick={() => decide(r.id, { action: "accept" })} disabled={!!busy} data-testid="fa-accept" className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50">{busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Accept</button>
                                                            <button onClick={() => setReject({ sub: s, r })} disabled={!!busy} data-testid="fa-reject" className="h-11 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"><XCircle size={14} /> Reject</button>
                                                        </div>
                                                    ) : r.status === "replaced" ? (
                                                        <p className="text-[11px] text-zinc-500" data-testid="fa-replaced">The OM re-uploaded a new photo today — review the new submission instead.</p>
                                                    ) : (
                                                        <div className="text-[11px] text-zinc-400 space-y-0.5">
                                                            <p>By {r.reviewedByName} ({r.reviewedByRole}) · {dt(r.reviewedAt)}</p>
                                                            {/* email to the professor — same as Email Management → Full Attire */}
                                                            <div className="pt-1" data-testid="fa-send-mail">
                                                                <SendEmailButton key={`${r.id}:${r.emailStatus || "not_sent"}`} small category="full_attire" relatedRecordId={r.id} status={r.emailStatus || "not_sent"} label="Send Email"
                                                                    onDone={res => setNotice({ ok: res.ok, text: res.ok ? `${r.professorName}: email sent.` : (res.error || "Email could not be sent.") })} />
                                                            </div>
                                                            {r.status === "rejected" && <p className="text-red-200 [overflow-wrap:anywhere]"><b>{r.reasonText}</b>{r.explanation ? ` — ${r.explanation}` : ""}</p>}
                                                            {r.evidenceUrl && <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-emerald-300 underline">Supporting evidence</a>}
                                                        </div>
                                                    )}
                                                    <button onClick={() => openHistory(r)} className="text-[11px] text-zinc-400 hover:text-white inline-flex items-center gap-1" data-testid="fa-history"><History size={12} /> View history</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

            {reject && <RejectDialog sub={reject.sub} r={reject.r} reasons={data?.reasons || []} onCancel={() => setReject(null)}
                onConfirm={async (body) => { const res = await decide(reject.r.id, { action: "reject", ...body }); if (res.ok) setReject(null); return res; }} />}

            {hist && (
                <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setHist(null)}>
                    <div className="w-full sm:max-w-xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()} data-testid="fa-history-modal">
                        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2"><History size={16} className="text-primary" /><p className="text-sm font-bold text-white min-w-0 truncate">Full Attire History · {hist.name}</p><button onClick={() => setHist(null)} className="ml-auto text-zinc-500" aria-label="Close"><X size={18} /></button></div>
                        <div className="overflow-y-auto p-3 space-y-2">
                            {!hist.rows ? <Loader2 className="animate-spin text-primary mx-auto my-8" /> : !hist.rows.length ? <p className="text-xs text-zinc-500 py-6 text-center">No history.</p> : hist.rows.map((h: any) => { const st = ST[h.status] || ST.pending; return (
                                <div key={h.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex gap-3 text-[11px]">
                                    {h.submission?.imageUrl && <img src={h.submission.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="text-white font-bold">{h.submissionId} <span className={cn("ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black", st.c)}>{st.l}</span></p>
                                        <p className="text-zinc-500">Submitted by {h.submission?.omName || "—"} · {dt(h.submission?.submittedAt)}</p>
                                        {h.reviewedAt && <p className="text-zinc-400">Reviewed by {h.reviewedByName} ({h.reviewedByRole}) · {dt(h.reviewedAt)}</p>}
                                        {h.status === "rejected" && <p className="text-red-200 [overflow-wrap:anywhere]">{h.reasonText}{h.explanation ? ` — ${h.explanation}` : ""}</p>}
                                    </div>
                                </div>
                            ); })}
                        </div>
                    </div>
                </div>
            )}

            {zoom && <div className="fixed inset-0 z-[140] bg-black flex items-center justify-center p-2" onClick={() => setZoom("")}><img src={zoom} alt="" className="max-w-full max-h-full object-contain" /><button className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Close"><X size={18} /></button></div>}
        </div>
    );
}

function RejectDialog({ sub, r, reasons, onCancel, onConfirm }: { sub: any; r: any; reasons: string[]; onCancel: () => void; onConfirm: (b: any) => Promise<{ ok: boolean; error?: string }> }) {
    const [sel, setSel] = useState<string[]>([]);
    const [other, setOther] = useState("");
    const [explanation, setExplanation] = useState("");
    const [evidence, setEvidence] = useState<{ url: string; name: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const pick = async (f?: File) => {
        if (!f) return;
        if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) return setErr("Choose a JPG, PNG or WEBP image.");
        if (f.size > 5 * 1024 * 1024) return setErr("The image must be smaller than 5 MB.");
        setUploading(true); setErr("");
        try { const up = await uploadToCloudinary(f); setEvidence({ url: up.secure_url, name: f.name }); } catch { setErr("Could not upload the image."); } finally { setUploading(false); }
    };
    const confirm = async () => {
        if (!sel.length) return setErr("Select at least one rejection reason.");
        if (sel.includes("Other") && other.trim().length < 2) return setErr('Please write the reason for "Other".');
        if (explanation.trim().length < 5) return setErr("Write a detailed explanation (at least 5 characters).");
        if (uploading) return setErr("Please wait — the image is still uploading.");
        setSaving(true); setErr("");
        const res = await onConfirm({ reasons: sel, other: other.trim(), explanation: explanation.trim(), ...(evidence ? { evidenceUrl: evidence.url } : {}) });
        setSaving(false);
        if (!res.ok) setErr(res.error || "Could not save.");
    };
    const row = (k: string, v: any) => <div className="flex gap-2 text-[11px]"><span className="w-28 shrink-0 text-zinc-500">{k}</span><span className="text-zinc-200 min-w-0 [overflow-wrap:anywhere]">{v || "—"}</span></div>;
    return (
        <div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" data-testid="fa-reject-dialog">
            <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2 shrink-0"><XCircle size={18} className="text-red-400" /><h2 className="text-base font-bold text-white">Reject Full Attire</h2><button onClick={onCancel} className="ml-auto text-zinc-500" aria-label="Close"><X size={18} /></button></div>
                <div className="overflow-y-auto p-5 space-y-4">
                    <div className="flex gap-3">
                        <img src={sub.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover bg-black shrink-0" />
                        <div className="space-y-0.5 min-w-0">
                            {row("Professor", `${r.professorName}${sub.type === "group" ? ` (position ${r.position})` : ""}`)}{row("Employee ID", r.professorId)}{row("College", r.collegeName || sub.collegeName)}
                            {row("Submission", sub.id)}{row("Submitted By", sub.omName)}{row("Capture Date", dt(sub.capturedAt))}{row("Review Date", dt(new Date().toISOString()))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Rejection Reason (one or more) *</p>
                        <div className="grid grid-cols-2 gap-2">
                            {reasons.map(x => (
                                <label key={x} className={cn("min-h-[44px] flex items-center gap-2 px-3 rounded-xl border text-xs cursor-pointer", sel.includes(x) ? "border-red-500/50 bg-red-500/10 text-white" : "border-zinc-800 text-zinc-300")}>
                                    <input type="checkbox" checked={sel.includes(x)} onChange={() => setSel(p => (p.includes(x) ? p.filter(y => y !== x) : [...p, x]))} className="accent-red-500 w-4 h-4" data-testid="fa-reason" value={x} /> {x}
                                </label>
                            ))}
                        </div>
                        {sel.includes("Other") && <input value={other} onChange={e => setOther(e.target.value)} placeholder="Write the other reason" data-testid="fa-other" className="mt-2 w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-white" />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Detailed Explanation *</p>
                        <textarea value={explanation} onChange={e => setExplanation(e.target.value)} data-testid="fa-explanation" placeholder="e.g. Professor was not wearing the required formal waistcoat during verification." className="w-full h-24 resize-none bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Supporting Evidence (optional)</p>
                        {evidence ? (
                            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2"><img src={evidence.url} alt="" className="w-10 h-10 rounded object-cover" /><span className="text-xs text-zinc-300 truncate flex-1">{evidence.name}</span><button onClick={() => setEvidence(null)} className="text-zinc-500" aria-label="Remove"><Trash2 size={14} /></button></div>
                        ) : (
                            <label className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-xs text-zinc-400 cursor-pointer">
                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {uploading ? "Uploading…" : "Attach an image"}
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="fa-evidence" onChange={e => pick(e.target.files?.[0])} />
                            </label>
                        )}
                    </div>
                    {err && <p className="text-xs text-red-400 flex items-center gap-1.5" data-testid="fa-reject-error"><AlertTriangle size={13} /> {err}</p>}
                </div>
                <div className="p-4 border-t border-zinc-800 grid grid-cols-2 gap-2 shrink-0" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
                    <button onClick={onCancel} className="h-12 rounded-xl border border-zinc-700 text-sm font-bold text-zinc-300">Cancel</button>
                    <button onClick={confirm} disabled={saving || uploading} data-testid="fa-confirm-reject" className="h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Confirm Rejection</button>
                </div>
            </div>
        </div>
    );
}