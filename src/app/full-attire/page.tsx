"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
    Shirt, Search, Camera, RefreshCw, Check, X, Loader2, ChevronUp, ChevronDown, Users, User, AlertTriangle,
    CheckCircle2, XCircle, Clock, SwitchCamera, Send, Trash2,
} from "lucide-react";

/**
 * OM → Full Attire. Live camera only (no gallery / file picker): pick one professor (Single) or several (Select
 * Multiple), confirm the left → right standing order, capture ONE photo and submit it for HR review.
 * Professors come from the server (the OM's own college scope); the server checks the scope again on submit.
 */
type Prof = { id: string; name: string; dept: string; designation: string; college: string };
const MAX_GROUP = 20;
const MAX_BYTES = 5 * 1024 * 1024;
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const ST: Record<string, { l: string; c: string; I: any }> = {
    pending: { l: "Pending", c: "text-amber-300 bg-amber-500/10 border-amber-500/25", I: Clock },
    accepted: { l: "Accepted", c: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", I: CheckCircle2 },
    rejected: { l: "Rejected", c: "text-red-300 bg-red-500/10 border-red-500/25", I: XCircle },
};

export default function FullAttirePage() {
    const { user } = useAuth();
    const [data, setData] = useState<{ colleges: any[]; professors: Prof[]; submissions: any[] } | null>(null);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [mode, setMode] = useState<"single" | "multiple">("single");
    const [order, setOrder] = useState<string[]>([]);            // selection order = standing order (left → right)
    const [camOpen, setCamOpen] = useState(false);
    const [photo, setPhoto] = useState<{ blob: Blob; url: string; capturedAt: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const keyRef = useRef(newKey());

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/full-attire?view=om", { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load professors");
            setData(d); setError("");
        } catch (e: any) { setError(e.message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const profs = data?.professors || [];
    const byId = useMemo(() => new Map(profs.map(p => [p.id, p])), [profs]);
    const shown = profs.filter(p => !q.trim() || `${p.name} ${p.id}`.toLowerCase().includes(q.trim().toLowerCase()));

    const resetCapture = () => { if (photo) URL.revokeObjectURL(photo.url); setPhoto(null); keyRef.current = newKey(); };
    const toggle = (id: string) => {
        setNotice(null);
        if (photo) resetCapture();
        if (mode === "single") { setOrder(o => (o[0] === id ? [] : [id])); return; }
        setOrder(o => (o.includes(id) ? o.filter(x => x !== id) : o.length >= MAX_GROUP ? o : [...o, id]));
    };
    const move = (i: number, d: -1 | 1) => setOrder(o => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const switchMode = (m: "single" | "multiple") => { setMode(m); setOrder(o => (m === "single" ? o.slice(0, 1) : o)); if (photo) resetCapture(); };

    const submit = async () => {
        if (!photo || !order.length) return;
        setSubmitting(true); setNotice(null);
        try {
            const file = new File([photo.blob], `full-attire-${Date.now()}.jpg`, { type: "image/jpeg" });
            const up = await uploadToCloudinary(file);
            const r = await fetch("/api/full-attire", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientKey: keyRef.current, imageUrl: up.secure_url, capturedAt: photo.capturedAt, order }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not submit");
            setNotice({ ok: true, text: `${d.message} Submission ${d.id}.` });
            resetCapture(); setOrder([]); await load();
        } catch (e: any) { setNotice({ ok: false, text: e.message || "Could not submit" }); }
        finally { setSubmitting(false); }
    };

    if (!user) return null;
    if (user.role !== "OM") return <div className="p-8 text-center text-sm text-zinc-500">Full Attire capture is for Operations Managers.</div>;

    const group = order.length > 1;
    return (
        <div className="p-3 sm:p-6 space-y-4 max-w-5xl mx-auto w-full" data-testid="full-attire-om">
            <header className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2"><Shirt size={20} className="text-primary" /> Full Attire</h1>
                <p className="text-xs text-zinc-400">College: <span className="text-zinc-200 font-semibold" data-testid="fa-colleges">{(data?.colleges || []).map(c => c.name).join(", ") || "—"}</span></p>
                <p className="text-[11px] text-zinc-500">Live camera only — select the professor(s), then capture one photo and submit it for HR review.</p>
            </header>

            {notice && <div data-testid="fa-notice" className={cn("rounded-xl border px-4 py-3 text-xs flex items-start gap-2", notice.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200")}>{notice.ok ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}<span className="min-w-0 [overflow-wrap:anywhere]">{notice.text}</span><button onClick={() => setNotice(null)} className="ml-auto shrink-0 opacity-70" aria-label="Close"><X size={14} /></button></div>}
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-xs">{error}</div>}

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search professor name or ID" data-testid="fa-search" className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 text-sm text-white focus:outline-none focus:border-primary" /></div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 sm:w-80">
                    <button onClick={() => switchMode("single")} data-testid="fa-mode-single" className={cn("h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5", mode === "single" ? "bg-primary text-white" : "text-zinc-400")}><User size={14} /> Single Capture</button>
                    <button onClick={() => switchMode("multiple")} data-testid="fa-mode-multiple" className={cn("h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5", mode === "multiple" ? "bg-primary text-white" : "text-zinc-400")}><Users size={14} /> Select Multiple</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
                {/* professor list — big touch targets */}
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden" data-testid="fa-list">
                    <p className="px-4 py-2.5 border-b border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">Professors ({shown.length})</p>
                    {!data ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                        : !shown.length ? <p className="py-10 text-center text-xs text-zinc-500">No professors found.</p> : (
                            <div className="divide-y divide-zinc-800/70 max-h-[60vh] overflow-y-auto">
                                {shown.map(p => {
                                    const idx = order.indexOf(p.id);
                                    const on = idx >= 0;
                                    return (
                                        <button key={p.id} type="button" onClick={() => toggle(p.id)} data-testid="fa-prof" data-id={p.id} aria-pressed={on}
                                            className={cn("w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left active:bg-zinc-800/60", on ? "bg-primary/10" : "hover:bg-zinc-800/30")}>
                                            <span className={cn("w-7 h-7 shrink-0 border-2 flex items-center justify-center text-xs font-black", mode === "single" ? "rounded-full" : "rounded-lg", on ? "border-primary bg-primary text-white" : "border-zinc-600")}>
                                                {on ? (mode === "multiple" ? idx + 1 : <Check size={14} />) : null}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-bold text-white [overflow-wrap:anywhere]">{p.name}</span>
                                                <span className="block text-[11px] text-zinc-500 [overflow-wrap:anywhere]">{p.id} · {p.dept || p.designation}{p.college ? ` · ${p.college}` : ""}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                </section>

                {/* selection + standing order + capture */}
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 lg:sticky lg:top-4" data-testid="fa-selection">
                    {!order.length ? <p className="text-xs text-zinc-500 py-6 text-center">{mode === "single" ? "Tap a professor to capture their Full Attire." : "Tap professors in the order they will stand (left → right)."}</p> : <>
                        {!group ? (
                            <div className="space-y-1 text-xs" data-testid="fa-single">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selected Professor</p>
                                <p className="text-base font-bold text-white">{byId.get(order[0])?.name}</p>
                                <p className="text-zinc-400">Employee ID: {order[0]} · College: {byId.get(order[0])?.college || "—"}</p>
                            </div>
                        ) : (
                            <div className="space-y-2" data-testid="fa-order">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500" data-testid="fa-count">{order.length} Professors Selected — Standing Order</p>
                                <ol className="space-y-1.5">
                                    {order.map((id, i) => (
                                        <li key={id} className="flex items-center gap-2 rounded-xl bg-zinc-950/70 border border-zinc-800 px-2.5 py-1.5" data-testid="fa-order-item" data-id={id}>
                                            <span className="w-7 h-7 shrink-0 rounded-lg bg-primary/15 text-primary text-xs font-black flex items-center justify-center">{i + 1}</span>
                                            <span className="min-w-0 flex-1 text-sm text-white font-semibold [overflow-wrap:anywhere]">{byId.get(id)?.name}<span className="block text-[10px] font-normal text-zinc-500">{id}</span></span>
                                            <button onClick={() => move(i, -1)} disabled={i === 0 || !!photo} aria-label="Move left" data-testid="fa-up" className="w-9 h-9 shrink-0 rounded-lg border border-zinc-700 text-zinc-300 flex items-center justify-center disabled:opacity-30"><ChevronUp size={16} /></button>
                                            <button onClick={() => move(i, 1)} disabled={i === order.length - 1 || !!photo} aria-label="Move right" data-testid="fa-down" className="w-9 h-9 shrink-0 rounded-lg border border-zinc-700 text-zinc-300 flex items-center justify-center disabled:opacity-30"><ChevronDown size={16} /></button>
                                            <button onClick={() => toggle(id)} disabled={!!photo} aria-label="Remove" className="w-9 h-9 shrink-0 rounded-lg border border-zinc-800 text-zinc-500 flex items-center justify-center disabled:opacity-30"><Trash2 size={14} /></button>
                                        </li>
                                    ))}
                                </ol>
                                <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">Please arrange the professors from <b>left to right</b> in this order before capturing the photograph.</p>
                            </div>
                        )}

                        {photo ? (
                            <div className="space-y-2" data-testid="fa-preview">
                                <img src={photo.url} alt="Captured full attire" className="w-full max-h-[55vh] object-contain rounded-xl border border-zinc-700 bg-black" />
                                <p className="text-[10px] text-zinc-500">Captured {dt(photo.capturedAt)}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => { resetCapture(); setCamOpen(true); }} disabled={submitting} data-testid="fa-retake" className="h-12 rounded-xl border border-zinc-700 text-sm font-bold text-zinc-200 flex items-center justify-center gap-2"><RefreshCw size={15} /> Retake</button>
                                    <button onClick={submit} disabled={submitting} data-testid="fa-submit" className="h-12 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit for Review</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setCamOpen(true)} data-testid="fa-open-camera" className="w-full h-14 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                                <Camera size={18} /> {group ? "Capture Group Photo" : "Capture Image"}
                            </button>
                        )}
                    </>}
                </section>
            </div>

            {/* my submissions */}
            <section className="space-y-2" data-testid="fa-mine">
                <h2 className="text-sm font-bold text-white">My Submissions</h2>
                {!(data?.submissions || []).length ? <p className="text-xs text-zinc-500">No submissions yet.</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(data?.submissions || []).map((s: any) => (
                            <div key={s.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 flex gap-3" data-testid="fa-mine-item">
                                <a href={s.imageUrl} target="_blank" rel="noreferrer" className="shrink-0"><img src={s.imageUrl} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover bg-black border border-zinc-800" /></a>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-xs font-bold text-white">{s.id} <span className="font-normal text-zinc-500">· {s.type === "group" ? `Group (${s.reviews.length})` : "Single"}</span></p>
                                    <p className="text-[10px] text-zinc-500">{dt(s.submittedAt)}</p>
                                    <div className="space-y-1">
                                        {s.reviews.map((r: any) => { const st = ST[r.status] || ST.pending; return (
                                            <div key={r.id} className="text-[11px]">
                                                <span className="text-zinc-300">{s.type === "group" ? `${r.position}. ` : ""}{r.professorName}</span>{" "}
                                                <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black", st.c)}><st.I size={10} /> {st.l}</span>
                                                {r.status === "rejected" && <span className="block text-red-300/80 [overflow-wrap:anywhere]">{r.reasonText}{r.explanation ? ` — ${r.explanation}` : ""}</span>}
                                            </div>
                                        ); })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {camOpen && <CameraCapture onClose={() => setCamOpen(false)} onCaptured={(blob, capturedAt) => { setPhoto({ blob, url: URL.createObjectURL(blob), capturedAt }); setCamOpen(false); }} title={group ? `Group photo · ${order.length} professors` : byId.get(order[0])?.name || ""} names={order.map(id => byId.get(id)?.name || id)} />}
        </div>
    );
}

/** Live camera (getUserMedia) — no gallery, no file picker. Full-screen on phones. */
function CameraCapture({ onClose, onCaptured, title, names }: { onClose: () => void; onCaptured: (b: Blob, at: string) => void; title: string; names: string[] }) {
    const video = useRef<HTMLVideoElement>(null);
    const stream = useRef<MediaStream | null>(null);
    const [facing, setFacing] = useState<"environment" | "user">("environment");
    const [err, setErr] = useState("");
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setReady(false); setErr("");
            stream.current?.getTracks().forEach(t => t.stop());
            if (!navigator.mediaDevices?.getUserMedia) { setErr("This browser cannot open the camera. Use Chrome (Android) or Safari (iPhone) over HTTPS."); return; }
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
                if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
                stream.current = s;
                if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); setReady(true); }
            } catch (e: any) {
                setErr(e?.name === "NotAllowedError" || e?.name === "SecurityError"
                    ? "Camera permission was denied. Allow camera access for this site in the browser settings, then try again. (Photos cannot be chosen from the gallery.)"
                    : e?.name === "NotFoundError" ? "No camera was found on this device." : `Could not open the camera: ${e?.message || e}`);
            }
        })();
        return () => { cancelled = true; stream.current?.getTracks().forEach(t => t.stop()); };
    }, [facing]);

    const capture = async () => {
        const v = video.current; if (!v || !v.videoWidth) return;
        setBusy(true);
        const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        let q = 0.85; let blob: Blob | null = null;
        while (q >= 0.5) { blob = await new Promise(r => c.toBlob(r, "image/jpeg", q)); if (blob && blob.size <= MAX_BYTES) break; q -= 0.1; }
        setBusy(false);
        if (!blob || blob.size > MAX_BYTES) { setErr("The photo is too large. Please retake."); return; }
        stream.current?.getTracks().forEach(t => t.stop());
        onCaptured(blob, new Date().toISOString());
    };

    return (
        <div className="fixed inset-0 z-[130] bg-black flex flex-col" data-testid="fa-camera">
            <div className="flex items-center gap-2 px-3 py-2 text-white shrink-0" style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}>
                <p className="text-sm font-bold min-w-0 flex-1 truncate">{title}</p>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Close camera"><X size={18} /></button>
            </div>
            {names.length > 1 && <p className="px-3 pb-2 text-[11px] text-amber-200 shrink-0 [overflow-wrap:anywhere]">Left → right: {names.map((n, i) => `${i + 1}. ${n}`).join("  ·  ")}</p>}
            <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black">
                <video ref={video} playsInline muted autoPlay data-testid="fa-video" className="max-w-full max-h-full w-full h-full object-contain" />
                {!ready && !err && <Loader2 className="absolute animate-spin text-white/70" />}
                {err && <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-100 text-sm p-4 text-center" data-testid="fa-camera-error">{err}</div>}
            </div>
            <div className="shrink-0 flex items-center justify-center gap-6 py-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
                <button onClick={() => setFacing(f => (f === "environment" ? "user" : "environment"))} className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Switch camera"><SwitchCamera size={20} /></button>
                <button onClick={capture} disabled={!ready || busy} data-testid="fa-capture" aria-label="Capture" className="w-[72px] h-[72px] rounded-full border-4 border-white bg-white/20 active:bg-white/50 flex items-center justify-center disabled:opacity-40">
                    {busy ? <Loader2 className="animate-spin text-white" /> : <Camera size={26} className="text-white" />}
                </button>
                <span className="w-12 h-12" />
            </div>
        </div>
    );
}