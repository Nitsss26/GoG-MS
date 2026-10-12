"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown, Loader2, FileText, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";

export type ExportItem = { label: string; hint?: string; kind?: "pdf" | "xlsx" | "csv"; testid?: string; run: () => Promise<void> };

/** Dropdown with export actions; shows progress, then a success or error message */
export default function ExportMenu({ label = "Export", items, testid, className = "", align = "right" }: {
    label?: string; items: (ExportItem | "divider" | { heading: string })[]; testid?: string; className?: string; align?: "left" | "right";
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);
    useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4500); return () => clearTimeout(t); }, [msg]);

    const run = async (it: ExportItem) => {
        setOpen(false); setBusy(it.label); setMsg(null);
        try { await it.run(); setMsg({ ok: true, text: "Download started." }); }
        catch (e: any) { setMsg({ ok: false, text: e?.message || "Could not generate the file." }); }
        finally { setBusy(null); }
    };
    const Icon = (k?: string) => k === "pdf" ? <FileText size={14} className="text-red-400" /> : k === "xlsx" ? <FileSpreadsheet size={14} className="text-emerald-400" /> : <Download size={14} className="text-sky-400" />;

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button type="button" onClick={() => setOpen(o => !o)} disabled={!!busy} data-testid={testid}
                className="flex items-center gap-2 h-9 px-4 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold transition-all disabled:opacity-70 whitespace-nowrap">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy ? "Preparing…" : label} <ChevronDown size={13} className="text-zinc-500" />
            </button>
            {open && (
                <div className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1.5 z-[60] w-64 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1.5`} data-testid={testid ? `${testid}-menu` : undefined}>
                    {items.map((it, i) => it === "divider" ? <div key={i} className="my-1 h-px bg-zinc-800" />
                        : "heading" in it ? <p key={i} className="px-2.5 pt-1.5 pb-1 text-[9px] font-black text-zinc-500 uppercase tracking-widest">{it.heading}</p>
                        : (
                            <button key={i} type="button" onClick={() => run(it)} data-testid={it.testid}
                                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 transition-colors">
                                <span className="mt-0.5">{Icon(it.kind)}</span>
                                <span className="min-w-0"><span className="block text-xs font-bold text-white">{it.label}</span>{it.hint && <span className="block text-[10px] text-zinc-500">{it.hint}</span>}</span>
                            </button>
                        ))}
                </div>
            )}
            {msg && (
                <div className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1.5 z-[55] w-64 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold border shadow-xl ${msg.ok ? "bg-emerald-950 border-emerald-500/30 text-emerald-300" : "bg-red-950 border-red-500/30 text-red-300"}`} data-testid={testid ? `${testid}-msg` : undefined}>
                    {msg.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />} {msg.text}
                </div>
            )}
        </div>
    );
}