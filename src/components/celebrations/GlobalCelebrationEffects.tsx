"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import CelebrationEffects from "./CelebrationEffects";
import type { TodayCelebration } from "@/lib/celebration-themes";

/**
 * Celebrations across the whole signed-in OMS (mounted once in SidebarWrapper, so it stays while the user moves
 * between pages — the opening animation is not restarted by navigation).
 *   • loads today's celebration once per user and day (GET /api/celebrations/today)
 *   • the opening effect runs once per celebration and date (recorded on the server), then the subtle effect continues
 *   • the dashboard reads the banner from here (useCelebration) — no second request
 *   • "Turn off animations" (per user, this browser) + prefers-reduced-motion are respected
 * Preview mode (Celebration Management → Preview): the page runs inside the preview frame with ?celebrationPreview=1;
 * the frame receives the draft celebration from the preview window (same origin only) and never records anything.
 */
type Ctx = { data: TodayCelebration | null; preview: boolean };
const CelebrationContext = createContext<Ctx>({ data: null, preview: false });
export const useCelebration = () => useContext(CelebrationContext);
export const PREVIEW_FRAME_NAME = "gog-celebration-preview";
export const PREVIEW_MSG = "gog-celebration-preview";

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const motionKey = (id?: string) => `gog_celebration_motion_off:${id || ""}`;

export function CelebrationProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
    const [data, setData] = useState<TodayCelebration | null>(null);
    const [preview, setPreview] = useState(false);
    const [phase, setPhase] = useState<"opening" | "subtle">("subtle");
    const [playKey, setPlayKey] = useState(0);
    const [off, setOff] = useState(false);
    const loadedFor = useRef("");

    // preview frame? (window.name keeps it while the preview navigates to other pages)
    useEffect(() => {
        try {
            const inFrame = window.self !== window.top;
            if (inFrame && new URLSearchParams(window.location.search).get("celebrationPreview") === "1") window.name = PREVIEW_FRAME_NAME;
            if (inFrame && window.name === PREVIEW_FRAME_NAME) setPreview(true);
        } catch { /* ignore */ }
    }, []);

    // live data (not in preview)
    const load = useCallback(async () => {
        if (!userId) return;
        const key = `${userId}|${istToday()}`;
        if (loadedFor.current === key) return;
        loadedFor.current = key;
        try {
            const r = await fetch("/api/celebrations/today", { cache: "no-store" });
            const d = r.ok ? await r.json() : null;
            if (!d || loadedFor.current !== key || window.name === PREVIEW_FRAME_NAME) return;
            setData(d);
            setPhase(d.effect?.opening ? "opening" : "subtle");
            if (d.effect?.opening) fetch("/api/celebrations/today", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seen: d.effect.key }) }).catch(() => { });
        } catch { loadedFor.current = ""; }
    }, [userId]);
    useEffect(() => {
        setData(null);
        if (preview || !userId) return;
        load();
        // a new day (page left open overnight): load again; checked locally, no request until the date changes
        const t = setInterval(() => { if (loadedFor.current && !loadedFor.current.endsWith(istToday())) { loadedFor.current = ""; load(); } }, 5 * 60000);
        return () => clearInterval(t);
    }, [userId, preview, load]);

    // preview messages
    useEffect(() => {
        if (!preview) return;
        const on = (e: MessageEvent) => {
            if (e.origin !== window.location.origin || e.data?.type !== PREVIEW_MSG) return;
            if (e.data.payload !== undefined) setData(e.data.payload);
            if (e.data.phase) { setPhase(e.data.phase); setPlayKey(k => k + 1); }
        };
        window.addEventListener("message", on);
        try { window.parent.postMessage({ type: `${PREVIEW_MSG}:ready` }, window.location.origin); } catch { /* ignore */ }
        return () => window.removeEventListener("message", on);
    }, [preview]);

    useEffect(() => { try { setOff(!preview && localStorage.getItem(motionKey(userId)) === "1"); } catch { setOff(false); } }, [userId, preview]);
    const toggle = () => { const v = !off; setOff(v); try { v ? localStorage.setItem(motionKey(userId), "1") : localStorage.removeItem(motionKey(userId)); } catch { /* ignore */ } };

    const effect = data?.effect;
    const show = !!effect && !off && (phase === "opening" || effect.subtle);
    return (
        <CelebrationContext.Provider value={{ data, preview }}>
            {children}
            {show && effect && <CelebrationEffects key={`${effect.key}|${effect.theme}`} theme={effect.theme} phase={phase} subtle={effect.subtle} playKey={playKey} />}
            {effect && !preview && (
                <button type="button" onClick={toggle} data-testid="cel-motion-toggle" aria-pressed={!off}
                    title={off ? "Turn celebration animations on" : "Turn celebration animations off"}
                    className="fixed z-[91] bottom-3 left-3 lg:left-[236px] h-8 px-2.5 rounded-full border border-zinc-700 bg-zinc-900/90 text-[10px] font-bold text-zinc-300 hover:text-white flex items-center gap-1.5 shadow-lg">
                    <Sparkles size={12} className={off ? "text-zinc-500" : "text-amber-300"} /> {off ? "Animations off" : "Animations on"}
                </button>
            )}
        </CelebrationContext.Provider>
    );
}

/** The global effects layer + banner data (named as in the requirement) */
export const GlobalCelebrationEffects = CelebrationProvider;
export default CelebrationProvider;