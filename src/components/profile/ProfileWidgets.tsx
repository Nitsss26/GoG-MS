"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, Download, X, Loader2, Upload, RefreshCw, ExternalLink, FileText, Lock, AlertCircle } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import type { ProfileField } from "@/lib/profile-fields";

/** Where a document opens: the server checks access and reads the link from the employee record */
export const docUrl = (employeeId: string, key: string, download = false) =>
    `/api/documents/view?employee=${encodeURIComponent(employeeId)}&doc=${encodeURIComponent(key)}${download ? "&download=1" : ""}`;

function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const fileNameOf = (res: Response, fallback: string) => {
    const m = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "");
    return m ? m[1] : fallback;
};

/** Secure preview (PDF / image) with download — opens through the server, never a raw storage link */
export function DocumentPreview({ employeeId, docKey, label, onClose }: { employeeId: string; docKey: string; label: string; onClose: () => void }) {
    const closeRef = useRef(onClose); closeRef.current = onClose;
    const [state, setState] = useState<{ kind: "loading" | "pdf" | "image" | "other" | "external" | "error"; url?: string; msg?: string; name?: string; blob?: Blob }>({ kind: "loading" });
    useEffect(() => {
        let gone = false, obj = "";
        (async () => {
            try {
                const res = await fetch(docUrl(employeeId, docKey), { cache: "no-store" });
                if (!res.ok) { const j = await res.json().catch(() => ({})); if (!gone) setState({ kind: "error", msg: j.error || "The document could not be opened." }); return; }
                const blob = await res.blob();
                obj = URL.createObjectURL(blob);
                const t = blob.type;
                const name = fileNameOf(res, label);
                if (!gone) setState({ kind: t === "application/pdf" ? "pdf" : t.startsWith("image/") && t !== "image/svg+xml" ? "image" : "other", url: obj, name, blob });
            } catch {
                // stored on a host that cannot be read from here → open the original link (still access-checked)
                if (!gone) setState({ kind: "external" });
            }
        })();
        const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
        window.addEventListener("keydown", k);
        return () => { gone = true; if (obj) URL.revokeObjectURL(obj); window.removeEventListener("keydown", k); };
    }, [employeeId, docKey, label]);
    const download = () => { if (state.blob) saveBlob(state.blob, state.name || label); else window.open(docUrl(employeeId, docKey, true), "_blank", "noopener"); };
    const btn = "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-bold";
    return (
        <div className="fixed inset-0 z-[140] bg-black/80 flex flex-col" role="dialog" aria-modal="true" aria-label={label} data-testid="doc-preview">
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-5 py-3 bg-zinc-950 border-b border-zinc-800">
                <FileText size={16} className="text-emerald-400 shrink-0" />
                <p className="text-sm font-bold text-white mr-auto min-w-0 truncate" data-testid="doc-preview-name">{label}</p>
                {state.kind !== "error" && state.kind !== "loading" && <button onClick={download} data-testid="doc-preview-download" className={`${btn} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}><Download size={13} /> Download</button>}
                <button onClick={onClose} data-testid="doc-preview-close" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}><X size={13} /> Close</button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
                <div className="w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    {state.kind === "loading" && <Loader2 className="animate-spin text-zinc-400" />}
                    {state.kind === "pdf" && <iframe src={state.url} title={label} className="w-full h-full min-h-[60vh] bg-white rounded-lg" data-testid="doc-preview-pdf" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {state.kind === "image" && <img src={state.url} alt={label} className="max-w-full max-h-full object-contain rounded-lg" data-testid="doc-preview-image" />}
                    {(state.kind === "other" || state.kind === "external") && (
                        <div className="text-center space-y-3 max-w-sm" data-testid="doc-preview-other">
                            <p className="text-sm text-zinc-300">{state.kind === "other" ? "This file type cannot be previewed here." : "This file is stored outside OMS storage and opens in a new tab."}</p>
                            <a href={docUrl(employeeId, docKey, state.kind === "other")} target="_blank" rel="noopener noreferrer" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200 inline-flex`}><ExternalLink size={13} /> {state.kind === "other" ? "Download file" : "Open document"}</a>
                        </div>
                    )}
                    {state.kind === "error" && <p className="text-sm text-red-300 flex items-center gap-2" data-testid="doc-preview-error"><AlertCircle size={15} /> {state.msg}</p>}
                </div>
            </div>
        </div>
    );
}

const inputCls = "w-full min-w-0 h-9 px-3 rounded-lg bg-zinc-950 border text-xs text-white outline-none focus:border-emerald-500/50";

/** One editable profile field (same validation as the server) */
export function FieldInput({ field, value, onChange, error, colleges }: {
    field: ProfileField; value: string; onChange: (v: string) => void; error?: string; colleges?: { id: string; name: string }[];
}) {
    const border = error ? "border-red-500/60" : "border-zinc-700";
    const id = `pf-${field.key}`;
    const common = { id, "data-testid": id, "aria-invalid": !!error, "aria-label": field.label };
    let el: React.ReactNode;
    if (field.type === "select") {
        const opts = field.options || [];
        el = <select {...common} value={value} onChange={e => onChange(e.target.value)} className={cn(inputCls, border)}>
            <option value="">— Select —</option>
            {value && !opts.includes(value) && <option value={value}>{value}</option>}
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>;
    } else if (field.type === "college") {
        el = <select {...common} value={value} onChange={e => onChange(e.target.value)} className={cn(inputCls, border)}>
            <option value="">— Not assigned —</option>
            {(colleges || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>;
    } else if (field.type === "textarea") {
        el = <textarea {...common} value={value} onChange={e => onChange(e.target.value)} rows={2} maxLength={field.max} className={cn(inputCls, border, "h-auto py-2 resize-y")} />;
    } else {
        el = <input {...common} type={field.type === "tel" ? "tel" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"} value={value} maxLength={field.max} onChange={e => onChange(e.target.value)} className={cn(inputCls, border)} />;
    }
    return (
        <div className="min-w-0">
            {el}
            {error && <p className="text-[10px] text-red-300 mt-1" data-testid={`${id}-error`}>{error}</p>}
        </div>
    );
}

/** A document slot: View (secure preview) · Upload when missing · Replace when present. Nothing is ever removed. */
export function DocSlot({ employeeId, docKey, label, uploaded, restricted, editable, pending, onUploaded, compact }: {
    employeeId: string; docKey: string; label: string; uploaded: boolean; restricted?: boolean; editable?: boolean;
    pending?: string; onUploaded?: (url: string) => void; compact?: boolean;
}) {
    const [preview, setPreview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const file = useRef<HTMLInputElement>(null);
    const pick = async (f?: File) => {
        if (!f) return;
        if (f.size > 10 * 1024 * 1024) { setErr("File too large (max 10 MB)."); return; }
        if (!/^(application\/pdf|image\/(jpeg|png|webp))$/i.test(f.type)) { setErr("Upload a PDF, JPG, PNG or WebP file."); return; }
        setBusy(true); setErr("");
        try { const up = await uploadToCloudinary(f); onUploaded?.(up.secure_url); }
        catch (e: any) { setErr(e?.message || "Upload failed."); }
        finally { setBusy(false); if (file.current) file.current.value = ""; }
    };
    const has = uploaded || !!pending;
    const small = "inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[10px] font-bold";
    return (
        <div className={cn("rounded-xl border p-3 flex flex-col gap-2 min-w-0", has ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/[0.06] bg-white/[0.01]", compact && "p-2.5")} data-testid={`doc-${docKey}`} data-uploaded={uploaded ? "1" : "0"}>
            <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className={has ? "text-emerald-400 shrink-0" : "text-zinc-600 shrink-0"} />
                <p className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider flex-1 min-w-0 [overflow-wrap:anywhere]">{label}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                {restricted ? <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500" data-testid={`doc-${docKey}-restricted`}><Lock size={11} /> Restricted</span>
                    : pending ? <span className="text-[10px] font-bold text-amber-300" data-testid={`doc-${docKey}-pending`}>New file — press Save Changes</span>
                    : uploaded ? <button type="button" onClick={() => setPreview(true)} className={`${small} border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10`} data-testid={`doc-${docKey}-view`}><Eye size={11} /> View</button>
                    : <span className="text-[10px] font-bold text-zinc-500" data-testid={`doc-${docKey}-missing`}>Not Uploaded</span>}
                {editable && !restricted && <>
                    <button type="button" onClick={() => file.current?.click()} disabled={busy} className={`${small} border-zinc-600 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50`} data-testid={`doc-${docKey}-upload`}>
                        {busy ? <Loader2 size={11} className="animate-spin" /> : has ? <RefreshCw size={11} /> : <Upload size={11} />} {has ? "Replace" : "Upload"}
                    </button>
                    <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => pick(e.target.files?.[0])} data-testid={`doc-${docKey}-input`} />
                </>}
            </div>
            {err && <p className="text-[10px] text-red-300">{err}</p>}
            {preview && <DocumentPreview employeeId={employeeId} docKey={docKey} label={label} onClose={() => setPreview(false)} />}
        </div>
    );
}
