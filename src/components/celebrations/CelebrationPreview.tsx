"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, RotateCcw, Sparkles, X, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREVIEW_MSG } from "./GlobalCelebrationEffects";
import type { TodayCelebration } from "@/lib/celebration-themes";

/**
 * Preview of a celebration on the real OMS: the actual pages (dashboard, attendance, …) open inside a frame and get
 * the draft banner / effect from here, rendered by the same components as the live OMS. Nothing is saved or recorded.
 */
const PAGES = [["/", "Dashboard"], ["/attendance", "Attendance"], ["/leave", "Leave"], ["/announcements", "Announcements"], ["/tickets", "Tickets"]] as const;

export default function CelebrationPreview({ title, payload, onClose, onSave, saving, pages = true }: {
    title: string; payload: TodayCelebration; onClose: () => void; onSave?: () => void; saving?: boolean; pages?: boolean;
}) {
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
    const [path, setPath] = useState<string>("/");
    const frame = useRef<HTMLIFrameElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const [stageW, setStageW] = useState(1000);
    const [phase, setPhase] = useState<"opening" | "subtle">(payload.effect?.opening ? "opening" : "subtle");
    const send = useCallback((p?: "opening" | "subtle") => {
        try { frame.current?.contentWindow?.postMessage({ type: PREVIEW_MSG, payload, ...(p ? { phase: p } : {}) }, window.location.origin); } catch { /* ignore */ }
    }, [payload]);
    useEffect(() => {
        const on = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === `${PREVIEW_MSG}:ready` && e.source === frame.current?.contentWindow) send(phase); };
        window.addEventListener("message", on);
        return () => window.removeEventListener("message", on);
    }, [send, phase]);
    useEffect(() => { send(); }, [payload, send]);
    useEffect(() => {
        const el = stage.current; if (!el) return;
        const ro = new ResizeObserver(() => setStageW(el.clientWidth)); ro.observe(el); setStageW(el.clientWidth);
        return () => ro.disconnect();
    }, []);
    useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

    const W = device === "desktop" ? 1280 : 390, H = device === "desktop" ? 800 : 780;
    const scale = Math.min(1, (stageW - 16) / W);
    const play = (p: "opening" | "subtle") => { setPhase(p); send(p); };
    const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors disabled:opacity-50";
    const src = `${path}${path.includes("?") ? "&" : "?"}celebrationPreview=1`;

    return (
        <div className="fixed inset-0 z-[130] bg-black/80 flex flex-col" role="dialog" aria-modal="true" data-testid="cel-preview">
            <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-white mr-auto min-w-0 truncate">{title}</p>
                <div className="flex gap-1 p-1 rounded-lg border border-zinc-800 bg-zinc-900" role="tablist">
                    <button role="tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")} data-testid="cel-prev-desktop" className={cn(btn, "h-7 border-transparent", device === "desktop" ? "bg-zinc-800 text-primary" : "text-zinc-400")}><Monitor size={13} /> Desktop</button>
                    <button role="tab" aria-selected={device === "mobile"} onClick={() => setDevice("mobile")} data-testid="cel-prev-mobile" className={cn(btn, "h-7 border-transparent", device === "mobile" ? "bg-zinc-800 text-primary" : "text-zinc-400")}><Smartphone size={13} /> Mobile</button>
                </div>
                {pages && (
                    <select value={path} onChange={e => setPath(e.target.value)} data-testid="cel-prev-page" aria-label="Preview page" className="h-9 px-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200">
                        {PAGES.map(([p, l]) => <option key={p} value={p}>{l}{p === "/" ? "" : " (effects only)"}</option>)}
                    </select>
                )}
                {payload.effect && <>
                    <button onClick={() => play("opening")} data-testid="cel-prev-replay" className={`${btn} border-amber-500/40 bg-amber-500/10 text-amber-200`}><RotateCcw size={13} /> Replay Opening Animation</button>
                    {payload.effect.subtle && <button onClick={() => play("subtle")} data-testid="cel-prev-subtle" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}><Sparkles size={13} /> Subtle All-Day Effect</button>}
                </>}
                {onSave && <button onClick={onSave} disabled={saving} data-testid="cel-prev-save" className={`${btn} border-primary/40 bg-primary text-white`}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save</button>}
                <button onClick={onClose} data-testid="cel-prev-close" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}><X size={13} /> Close Preview</button>
            </div>
            <div ref={stage} className="flex-1 min-h-0 overflow-auto p-2 flex justify-center items-start" data-testid="cel-prev-stage">
                <div style={{ width: W * scale, height: H * scale }} className="shrink-0">
                    <iframe ref={frame} key={`${device}|${path}`} src={src} title="Preview" data-testid="cel-prev-frame" onLoad={() => send(phase)}
                        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl" />
                </div>
            </div>
            <p className="shrink-0 text-center text-[10px] text-zinc-500 py-1.5 bg-zinc-950 border-t border-zinc-800">Preview with the real OMS pages — nothing is saved until you press Save. Banners appear on the Dashboard only; other pages show the animation.</p>
        </div>
    );
}