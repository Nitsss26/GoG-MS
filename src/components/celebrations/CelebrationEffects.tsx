"use client";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { ThemeKey } from "@/lib/celebration-themes";

/**
 * One decorative animation layer for every celebration (birthday confetti + all festival themes).
 * Used by the live OMS (GlobalCelebrationEffects) and by every preview — the same component and settings.
 *   phase "opening": ~7 s stronger effect, then it eases into "subtle" (if subtle is on), otherwise stops.
 *   phase "subtle":  a few slow particles + small edge decorations only.
 * Fixed full-screen canvas with pointer-events: none (never blocks clicks / typing / scrolling), paused while the tab
 * is hidden, nothing at all with prefers-reduced-motion, everything cleaned up on unmount.
 */
const OPENING_MS = 7000;
const GOLD = ["#fbbf24", "#f59e0b", "#fde68a", "#fcd34d"];
const HOLI = ["#ec4899", "#8b5cf6", "#22c55e", "#f97316", "#eab308", "#06b6d4", "#ef4444"];
const TRI = ["#ff9933", "#ffffff", "#138808"];
const BULBS = ["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#fb923c"];
const PETALS = ["#f472b6", "#fb7185", "#fda4af", "#f43f5e"];
const MARIGOLD = ["#f97316", "#fb923c", "#f59e0b", "#facc15"];

type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; rot: number; vr: number; life: number; kind: string };
type Spec = {
    kinds: { kind: string; colors: string[]; dir: "up" | "down" | "drift" }[];
    opening: number; subtle: number;                 // particle counts (desktop)
    decor?: "diyas" | "bulbs" | "moon" | "ribbons" | "waves" | "rakhi";
    bulbColors?: string[];
};
const SPECS: Record<string, Spec> = {
    DIYAS: { kinds: [{ kind: "glow", colors: GOLD, dir: "up" }], opening: 70, subtle: 16, decor: "diyas" },
    GOLDEN_SHIMMER: { kinds: [{ kind: "glitter", colors: GOLD, dir: "down" }], opening: 70, subtle: 16, decor: "bulbs", bulbColors: GOLD },
    HOLI_COLORS: { kinds: [{ kind: "blob", colors: HOLI, dir: "drift" }], opening: 60, subtle: 14 },
    EID_MOON: { kinds: [{ kind: "star", colors: ["#fef9c3", "#fde68a", "#ffffff"], dir: "down" }], opening: 45, subtle: 12, decor: "moon" },
    SNOWFALL: { kinds: [{ kind: "snow", colors: ["#ffffff", "#e0f2fe"], dir: "down" }], opening: 90, subtle: 22, decor: "bulbs", bulbColors: BULBS },
    NEW_YEAR: { kinds: [{ kind: "spark", colors: [...GOLD, "#ffffff"], dir: "drift" }, { kind: "rect", colors: HOLI, dir: "down" }], opening: 80, subtle: 16 },
    TRICOLOR_RIBBONS: { kinds: [{ kind: "dot", colors: TRI, dir: "down" }], opening: 50, subtle: 12, decor: "ribbons" },
    TRICOLOR_WAVES: { kinds: [{ kind: "dot", colors: TRI, dir: "drift" }], opening: 50, subtle: 12, decor: "waves" },
    NAVRATRI_LIGHTS: { kinds: [{ kind: "spark", colors: BULBS, dir: "drift" }], opening: 60, subtle: 14, decor: "bulbs", bulbColors: BULBS },
    MARIGOLD: { kinds: [{ kind: "petal", colors: MARIGOLD, dir: "down" }, { kind: "glow", colors: GOLD, dir: "up" }], opening: 60, subtle: 14 },
    PEACOCK: { kinds: [{ kind: "feather", colors: ["#0ea5e9"], dir: "drift" }, { kind: "spark", colors: ["#22d3ee", "#34d399", "#fde68a"], dir: "drift" }], opening: 26, subtle: 7 },
    RAKHI_PETALS: { kinds: [{ kind: "petal", colors: PETALS, dir: "down" }], opening: 55, subtle: 13, decor: "rakhi" },
    DUSSEHRA_LIGHTS: { kinds: [{ kind: "glow", colors: ["#f97316", ...GOLD], dir: "up" }], opening: 70, subtle: 16, decor: "bulbs", bulbColors: GOLD },
    ELEGANT: { kinds: [{ kind: "spark", colors: [...GOLD, "#ffffff"], dir: "drift" }], opening: 50, subtle: 12 },
};

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export default function CelebrationEffects({ theme, phase, subtle = true, playKey = 0, testId = "celebration-effects" }: {
    theme: ThemeKey; phase: "opening" | "subtle"; subtle?: boolean; playKey?: number; testId?: string;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cv = canvas.current;
        if (!cv || reducedMotion()) return;
        let stopped = false;
        let start = performance.now();
        const startPhase = phase;
        const small = () => window.innerWidth < 640;
        const inOpening = () => startPhase === "opening" && performance.now() - start < OPENING_MS;
        const timers: any[] = [];
        const clearTimers = () => { timers.forEach(t => clearInterval(t)); timers.length = 0; };
        cv.dataset.phase = startPhase;

        // ── birthday: canvas-confetti ──
        if (theme === "CONFETTI") {
            const fire = confetti.create(cv, { resize: true, useWorker: false, disableForReducedMotion: true });
            const run = () => {
                clearTimers();
                if (inOpening()) {
                    timers.push(setInterval(() => {
                        if (document.hidden) return;
                        const left = 1 - (performance.now() - start) / OPENING_MS; // intensity goes down
                        if (left <= 0) { cv.dataset.phase = "subtle"; run(); return; }
                        const n = Math.max(3, Math.round((small() ? 22 : 40) * left));
                        fire({ particleCount: n, angle: 60, spread: 70, origin: { x: 0, y: 0.05 }, startVelocity: 45 * left + 15, ticks: 260 });
                        fire({ particleCount: n, angle: 120, spread: 70, origin: { x: 1, y: 0.05 }, startVelocity: 45 * left + 15, ticks: 260 });
                        fire({ particleCount: Math.round(n / 2), angle: 270, spread: 120, origin: { x: 0.5, y: -0.1 }, startVelocity: 20, gravity: 0.8, ticks: 300 });
                    }, 320));
                } else if (subtle) {
                    cv.dataset.phase = "subtle";
                    // a few slowly falling pieces, all day
                    timers.push(setInterval(() => {
                        if (document.hidden) return;
                        fire({ particleCount: small() ? 1 : 2, angle: 270, spread: 40, origin: { x: Math.random(), y: -0.05 }, startVelocity: 1, gravity: 0.22, drift: rnd(-0.4, 0.4), ticks: 700, scalar: 0.8, decay: 0.95 });
                    }, 900));
                } else cv.dataset.phase = "done";
            };
            run();
            return () => { stopped = true; clearTimers(); fire.reset(); };
        }

        // ── festival themes: light canvas renderer ──
        const spec = SPECS[theme] || SPECS.ELEGANT;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        let W = 0, H = 0, dpr = 1;
        const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
        resize();
        window.addEventListener("resize", resize);
        const parts: P[] = [];
        const spawn = (initial = false): P => {
            const k = pick(spec.kinds);
            const big = k.kind === "blob" ? rnd(6, 13) : k.kind === "feather" ? rnd(10, 16) : k.kind === "petal" ? rnd(4, 7) : k.kind === "snow" ? rnd(1.5, 3.5) : rnd(1.2, 2.8);
            const x = rnd(0, W);
            const y = k.dir === "up" ? (initial ? rnd(H * 0.3, H) : H + 10) : k.dir === "down" ? (initial ? rnd(-H * 0.2, H * 0.7) : -12) : rnd(0, H);
            const sp = k.dir === "drift" ? 0.25 : 0.5;
            return { x, y, vx: rnd(-0.3, 0.3), vy: k.dir === "up" ? -rnd(0.25, 0.8) : k.dir === "down" ? rnd(sp * 0.6, sp * 1.8) : rnd(-0.15, 0.15), r: big, c: pick(k.colors), a: 0, rot: rnd(0, 6.28), vr: rnd(-0.02, 0.02), life: 0, kind: k.kind };
        };
        const target = () => {
            const base = inOpening() ? spec.opening : subtle ? spec.subtle : 0;
            return Math.round(base * (small() ? 0.55 : 1));
        };
        for (let i = 0; i < target(); i++) parts.push(spawn(true));

        const drawParticle = (p: P, t: number) => {
            ctx.save(); ctx.globalAlpha = p.a; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            switch (p.kind) {
                case "glow": { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 3); g.addColorStop(0, p.c); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r * 3, 0, 6.28); ctx.fill(); break; }
                case "blob": ctx.fillStyle = p.c; ctx.globalAlpha = p.a * 0.45; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); break;
                case "snow": ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); break;
                case "rect": ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2.4, p.r * 1.1); break;
                case "dot": ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.r * 1.2, 0, 6.28); ctx.fill(); break;
                case "petal": ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.28); ctx.fill(); break;
                case "glitter": case "star": case "spark": {
                    const tw = 0.55 + 0.45 * Math.sin(t / 260 + p.x);
                    ctx.globalAlpha = p.a * tw; ctx.fillStyle = p.c; const s = p.r * (p.kind === "spark" ? 2.2 : 1.8);
                    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.25, -s * 0.25); ctx.lineTo(s, 0); ctx.lineTo(s * 0.25, s * 0.25); ctx.lineTo(0, s); ctx.lineTo(-s * 0.25, s * 0.25); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.25, -s * 0.25); ctx.closePath(); ctx.fill(); break;
                }
                case "feather": {
                    ctx.globalAlpha = p.a * 0.6;
                    ctx.strokeStyle = "#14b8a6"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, p.r * 1.6); ctx.lineTo(0, -p.r * 1.2); ctx.stroke();
                    ctx.fillStyle = "#0f766e"; ctx.beginPath(); ctx.ellipse(0, -p.r * 0.2, p.r * 0.7, p.r, 0, 0, 6.28); ctx.fill();
                    ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.ellipse(0, -p.r * 0.25, p.r * 0.42, p.r * 0.6, 0, 0, 6.28); ctx.fill();
                    ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.ellipse(0, -p.r * 0.25, p.r * 0.18, p.r * 0.26, 0, 0, 6.28); ctx.fill(); break;
                }
            }
            ctx.restore();
        };

        const drawDiya = (x: number, y: number, s: number, glow: number, t: number) => {
            const fl = 0.85 + 0.15 * Math.sin(t / 90 + x) + 0.08 * Math.sin(t / 37 + x * 2);
            const g = ctx.createRadialGradient(x, y - s * 0.9, 0, x, y - s * 0.9, s * 3.2 * glow);
            g.addColorStop(0, `rgba(251,191,36,${0.42 * glow})`); g.addColorStop(1, "rgba(251,191,36,0)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s * 0.9, s * 3.2 * glow, 0, 6.28); ctx.fill();
            ctx.fillStyle = "#b45309"; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.42, 0, 0, Math.PI); ctx.fill();
            ctx.fillStyle = "#d97706"; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.18, 0, 0, 6.28); ctx.fill();
            ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.55 * fl, s * 0.2, s * 0.5 * fl, 0, 0, 6.28); ctx.fill();
            ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.45 * fl, s * 0.11, s * 0.28 * fl, 0, 0, 6.28); ctx.fill();
        };
        const drawDecor = (t: number) => {
            const k = inOpening() ? 1.5 : 1;
            const sm = small();
            if (spec.decor === "diyas") {
                const s = sm ? 9 : 13; const n = sm ? 2 : 3; const by = H - (sm ? 14 : 18);
                for (let i = 0; i < n; i++) { drawDiya(18 + s + i * s * 3.1, by, s, k, t); drawDiya(W - 18 - s - i * s * 3.1, by, s, k, t); }
            } else if (spec.decor === "bulbs") {
                const cols = spec.bulbColors || BULBS; const gap = sm ? 34 : 46; const n = Math.ceil(W / gap);
                ctx.strokeStyle = "rgba(161,161,170,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
                for (let i = 0; i <= n; i++) { const x = i * gap; const y = 3 + 5 * Math.sin(i * 0.9); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
                for (let i = 0; i <= n; i++) {
                    const x = i * gap; const y = 3 + 5 * Math.sin(i * 0.9) + 5; const on = 0.55 + 0.45 * Math.sin(t / 420 + i * 1.7);
                    const c = cols[i % cols.length]; const g = ctx.createRadialGradient(x, y, 0, x, y, 10 * k);
                    g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.globalAlpha = 0.35 * on * k; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10 * k, 0, 6.28); ctx.fill();
                    ctx.globalAlpha = 0.9 * on; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
                }
            } else if (spec.decor === "moon") {
                const r = sm ? 16 : 24; const x = W - r * 2.2; const y = r * 2.2;
                const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3 * k); g.addColorStop(0, "rgba(254,249,195,0.35)"); g.addColorStop(1, "rgba(254,249,195,0)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3 * k, 0, 6.28); ctx.fill();
                ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
                ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.2, r * 0.88, 0, 6.28); ctx.fill(); ctx.globalCompositeOperation = "source-over";
            } else if (spec.decor === "ribbons" || spec.decor === "waves") {
                const amp = spec.decor === "waves" ? 4 : 6; const len = spec.decor === "waves" ? W : Math.min(W * 0.28, 260);
                TRI.forEach((c, i) => {
                    ctx.strokeStyle = c; ctx.globalAlpha = (c === "#ffffff" ? 0.35 : 0.55) * (k > 1 ? 1 : 0.8); ctx.lineWidth = sm ? 3 : 4; const y0 = 4 + i * (sm ? 4 : 5);
                    const draw = (x0: number, dirX: number) => { ctx.beginPath(); for (let x = 0; x <= len; x += 6) { const y = y0 + amp * Math.sin(x / 38 + t / 700 + i) * (x / len); x ? ctx.lineTo(x0 + dirX * x, y) : ctx.moveTo(x0, y); } ctx.stroke(); };
                    if (spec.decor === "waves") draw(0, 1); else { draw(0, 1); draw(W, -1); }
                    ctx.globalAlpha = 1;
                });
            } else if (spec.decor === "rakhi") {
                const r = sm ? 9 : 12;
                [[r * 2.4, r * 2.4], [W - r * 2.4, r * 2.4]].forEach(([x, y], j) => {
                    ctx.strokeStyle = "rgba(244,63,94,0.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(j ? W : 0, y); ctx.lineTo(x, y); ctx.stroke();
                    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#f59e0b" : "#f43f5e"; ctx.beginPath(); ctx.ellipse(x + Math.cos(i * 0.785 + t / 2000) * r, y + Math.sin(i * 0.785 + t / 2000) * r, r * 0.45, r * 0.25, i * 0.785, 0, 6.28); ctx.fill(); }
                    ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 6.28); ctx.fill();
                });
            }
        };

        let raf = 0;
        const frame = (t: number) => {
            if (stopped) return;
            if (document.hidden) { raf = requestAnimationFrame(frame); return; } // paused while the tab is hidden
            ctx.clearRect(0, 0, W, H);
            const want = target();
            if (!want && !inOpening()) { cv.dataset.phase = "done"; drawDecor(t); if (!subtle) { ctx.clearRect(0, 0, W, H); return; } }
            cv.dataset.phase = inOpening() ? "opening" : "subtle";
            const boost = inOpening() ? 1.5 : 1;
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.life++; p.x += p.vx * boost; p.y += p.vy * boost; p.rot += p.vr; p.vx += rnd(-0.01, 0.01);
                p.a = Math.min(1, p.life / 40) * (inOpening() ? 0.95 : 0.75);
                const out = p.y < -30 || p.y > H + 30 || p.x < -40 || p.x > W + 40 || (p.kind !== "snow" && p.kind !== "petal" && p.life > 900);
                if (out) { if (parts.length > want) parts.splice(i, 1); else parts[i] = spawn(); continue; }
                drawParticle(p, t);
            }
            while (parts.length < want) parts.push(spawn());
            drawDecor(t);
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); clearTimers(); };
    }, [theme, phase, subtle, playKey]);

    return <canvas ref={canvas} aria-hidden="true" data-testid={testId} data-theme={theme} className="fixed inset-0 w-screen h-screen pointer-events-none z-[90]" style={{ pointerEvents: "none" }} />;
}