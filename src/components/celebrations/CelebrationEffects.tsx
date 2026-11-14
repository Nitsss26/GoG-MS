"use client";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { ThemeKey } from "@/lib/celebration-themes";

/**
 * One decorative animation layer for every celebration (birthday confetti + all 40 themes of the theme registry).
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
const SILVER = ["#e5e7eb", "#f8fafc", "#cbd5e1"];
const ROSE = ["#e11d48", "#f43f5e", "#be123c", "#fb7185"];
const FLOWERS = ["#f472b6", "#facc15", "#fb923c", "#a78bfa", "#f87171", "#ffffff"];
const PARTY = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#facc15"];
const FIRE = ["#f43f5e", "#facc15", "#22d3ee", "#a3e635", "#f472b6", "#fb923c", "#ffffff"];

type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; rot: number; vr: number; life: number; kind: string; g?: number; max?: number; c2?: string };
type Spec = {
    kinds: { kind: string; colors: string[]; dir: "up" | "down" | "drift" }[];
    opening: number; subtle: number;                 // particle counts (desktop)
    decor?: "diyas" | "bulbs" | "moon" | "ribbons" | "waves" | "rakhi"
        | "lotus" | "strings" | "rangoli" | "candles" | "cake" | "pongal" | "pookalam" | "garba" | "topstar" | "globe" | "moonleft" | "lanterns" | "gwaves" | "aurora";
    bulbColors?: string[];
    bursts?: boolean;          // fireworks
    shooting?: boolean;        // shooting stars
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
    // ── added themes ──
    FIREWORKS: { kinds: [{ kind: "spark", colors: ["#ffffff", "#fde68a"], dir: "drift" }], opening: 10, subtle: 3, bursts: true },
    FLOATING_LANTERNS: { kinds: [{ kind: "lantern", colors: ["#f59e0b", "#fb923c", "#fbbf24"], dir: "up" }], opening: 22, subtle: 6 },
    FLOWER_RAIN: { kinds: [{ kind: "flower", colors: FLOWERS, dir: "down" }], opening: 45, subtle: 11 },
    ROSE_PETALS: { kinds: [{ kind: "rosepetal", colors: ROSE, dir: "drift" }], opening: 45, subtle: 11 },
    LOTUS_GLOW: { kinds: [{ kind: "glow", colors: ["#f9a8d4", "#fbcfe8", "#fde68a"], dir: "up" }], opening: 40, subtle: 10, decor: "lotus" },
    SPARKLE_RAIN: { kinds: [{ kind: "glitter", colors: [...GOLD, ...SILVER], dir: "down" }], opening: 110, subtle: 22 },
    FIREFLIES: { kinds: [{ kind: "firefly", colors: ["#d9f99d", "#fef08a", "#bef264"], dir: "drift" }], opening: 40, subtle: 14 },
    BOKEH_LIGHTS: { kinds: [{ kind: "bokeh", colors: ["#f472b6", "#60a5fa", "#fbbf24", "#a78bfa", "#34d399"], dir: "drift" }], opening: 22, subtle: 9 },
    LIGHT_STRINGS: { kinds: [{ kind: "spark", colors: ["#fde68a", "#ffffff"], dir: "down" }], opening: 18, subtle: 4, decor: "strings", bulbColors: ["#fde68a", "#f472b6", "#60a5fa", "#4ade80", "#fb923c"] },
    RANGOLI_REVEAL: { kinds: [{ kind: "dot", colors: ["#f43f5e", "#f59e0b", "#a855f7", "#22c55e", "#3b82f6"], dir: "drift" }], opening: 26, subtle: 6, decor: "rangoli" },
    FLOATING_BALLOONS: { kinds: [{ kind: "balloon", colors: PARTY, dir: "up" }], opening: 26, subtle: 6 },
    PARTY_POPPERS: { kinds: [], opening: 0, subtle: 0 },   // canvas-confetti (below)
    GIFT_BOXES: { kinds: [{ kind: "gift", colors: PARTY, dir: "down" }], opening: 20, subtle: 5 },
    BIRTHDAY_CANDLES: { kinds: [{ kind: "glow", colors: GOLD, dir: "up" }], opening: 30, subtle: 8, decor: "candles" },
    CAKE_ANIMATION: { kinds: [{ kind: "rect", colors: PARTY, dir: "down" }], opening: 50, subtle: 10, decor: "cake" },
    KITE_FESTIVAL: { kinds: [{ kind: "kite", colors: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"], dir: "drift" }], opening: 10, subtle: 5 },
    PONGAL_POT: { kinds: [{ kind: "bubble", colors: ["#ffffff", "#fef3c7"], dir: "up" }], opening: 40, subtle: 10, decor: "pongal" },
    ONAM_FLOWERS: { kinds: [{ kind: "flower", colors: ["#facc15", "#f97316", "#ffffff", "#ef4444"], dir: "drift" }], opening: 34, subtle: 9, decor: "pookalam" },
    GARBA_LIGHTS: { kinds: [{ kind: "spark", colors: BULBS, dir: "drift" }], opening: 40, subtle: 10, decor: "garba", bulbColors: BULBS },
    CHRISTMAS_STARS: { kinds: [{ kind: "xstar", colors: ["#fde68a", "#ffffff", "#fca5a5", "#86efac"], dir: "down" }], opening: 40, subtle: 10, decor: "topstar" },
    SNOW_GLOBE: { kinds: [{ kind: "swirl", colors: ["#ffffff", "#e0f2fe", "#bae6fd"], dir: "drift" }], opening: 110, subtle: 30, decor: "globe" },
    MOON_STARS: { kinds: [{ kind: "twinkle", colors: ["#ffffff", "#fef9c3", "#e0e7ff"], dir: "drift" }], opening: 60, subtle: 26, decor: "moonleft", shooting: true },
    EID_LANTERNS: { kinds: [{ kind: "glow", colors: GOLD, dir: "drift" }], opening: 20, subtle: 6, decor: "lanterns" },
    GRADIENT_WAVES: { kinds: [], opening: 0, subtle: 0, decor: "gwaves" },
    AURORA: { kinds: [{ kind: "twinkle", colors: ["#ffffff", "#ccfbf1"], dir: "drift" }], opening: 18, subtle: 8, decor: "aurora" },
};
/** Kinds that leave the screen on their own (no life limit) */
const ROAMING = new Set(["snow", "petal", "lantern", "balloon", "gift", "flower", "rosepetal", "kite", "xstar", "bubble"]);
/** Kinds with a natural life (fade in / out in place) */
const FADING = new Set(["firefly", "bokeh", "twinkle", "swirl"]);

type DecorArgs = { ctx: CanvasRenderingContext2D; W: number; H: number; t: number; k: number; sm: boolean; el: number; colors: string[] };
const glowAt = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgba: string) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); };
const flame = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) => {
    const fl = 0.85 + 0.15 * Math.sin(t / 80 + x) + 0.08 * Math.sin(t / 31 + x * 3);
    glowAt(ctx, x, y - s, s * 3.2, "rgba(251,191,36,0.35)");
    ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.9 * fl, s * 0.38, s * 0.95 * fl, Math.sin(t / 200 + x) * 0.08, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.7 * fl, s * 0.2, s * 0.5 * fl, 0, 0, 6.28); ctx.fill();
};
const candle = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string, t: number) => {
    ctx.fillStyle = c; ctx.fillRect(x - s * 0.35, y - s * 3, s * 0.7, s * 3);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; for (let i = 0; i < 3; i++) ctx.fillRect(x - s * 0.35, y - s * 3 + i * s, s * 0.7, s * 0.25);
    ctx.strokeStyle = "#3f3f46"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - s * 3); ctx.lineTo(x, y - s * 3.3); ctx.stroke();
    flame(ctx, x, y - s * 3.3, s * 0.9, t);
};
const lotus = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, t: number) => {
    glowAt(ctx, x, y - s * 0.5, s * 3 * (0.85 + 0.15 * Math.sin(t / 700)) * k, "rgba(244,114,182,0.32)");
    const petals = [[-1.1, "#f9a8d4"], [1.1, "#f9a8d4"], [-0.55, "#f472b6"], [0.55, "#f472b6"], [0, "#ec4899"]] as const;
    petals.forEach(([a, c]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.55, -s * 0.9, 0, -s * 1.6); ctx.quadraticCurveTo(-s * 0.55, -s * 0.9, 0, 0); ctx.fill(); ctx.restore(); });
    ctx.fillStyle = "#166534"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.15, s * 1.6, s * 0.3, 0, 0, 6.28); ctx.fill();
};
const lantern = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, k: number) => {
    glowAt(ctx, x, y + s * 1.2, s * 3.4 * k, "rgba(251,191,36,0.32)");
    ctx.fillStyle = "#a16207"; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.8, y + s * 0.5); ctx.lineTo(x - s * 0.8, y + s * 0.5); ctx.fill();
    const lg = ctx.createLinearGradient(x, y + s * 0.5, x, y + s * 2.2); lg.addColorStop(0, "#fde68a"); lg.addColorStop(1, "#f59e0b");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x - s * 0.8, y + s * 0.5); ctx.lineTo(x + s * 0.8, y + s * 0.5); ctx.lineTo(x + s * 0.55, y + s * 2.2); ctx.lineTo(x - s * 0.55, y + s * 2.2); ctx.fill();
    ctx.strokeStyle = "rgba(120,53,15,0.8)"; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.4, y + s * 0.5); ctx.lineTo(x + i * s * 0.28, y + s * 2.2); ctx.stroke(); }
    ctx.fillStyle = "#a16207"; ctx.fillRect(x - s * 0.6, y + s * 2.2, s * 1.2, s * 0.3); ctx.beginPath(); ctx.moveTo(x, y + s * 2.5); ctx.lineTo(x, y + s * 2.9); ctx.strokeStyle = "#ca8a04"; ctx.stroke();
    flame(ctx, x, y + s * 1.8, s * 0.35, t);
};
/** Decorations of the added themes (edges / corners only, light, never over the content) */
const EXTRA_DECOR: Record<string, (a: DecorArgs) => void> = {
    lotus: ({ ctx, W, H, t, k, sm }) => { const s = sm ? 12 : 17, y = H - (sm ? 8 : 12); [s * 2.4, s * 5.6, W - s * 2.4, W - s * 5.6].slice(0, sm ? 2 : 4).forEach((x, i) => lotus(ctx, sm && i === 1 ? W - s * 2.4 : x, y, s, k, t + i * 400)); },
    strings: ({ ctx, W, t, k, sm, colors }) => {
        const strands = sm ? 2 : 3, gap = sm ? 26 : 34;
        for (let sIdx = 0; sIdx < strands; sIdx++) {
            const x0 = (W / strands) * sIdx, x1 = (W / strands) * (sIdx + 1), sag = sm ? 18 : 30, y0 = 2;
            const yAt = (x: number) => { const u = (x - x0) / (x1 - x0); return y0 + 4 * sag * u * (1 - u); };
            ctx.strokeStyle = "rgba(161,161,170,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); for (let x = x0; x <= x1; x += 6) x === x0 ? ctx.moveTo(x, yAt(x)) : ctx.lineTo(x, yAt(x)); ctx.stroke();
            for (let x = x0 + gap / 2, i = 0; x < x1; x += gap, i++) {
                const y = yAt(x) + 6, on = 0.45 + 0.55 * Math.max(0, Math.sin(t / 350 + i * 1.3 + sIdx)), c = colors[(i + sIdx) % colors.length];
                glowAt(ctx, x, y, 11 * k, c + "66"); ctx.globalAlpha = 0.5 + 0.5 * on; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 2.6, 3.6, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
            }
        }
    },
    rangoli: ({ ctx, W, H, t, k, sm, el }) => {
        const reveal = Math.min(1, el / 6000);            // draws itself over 6 s, then turns slowly
        const R = sm ? 34 : 54; const cols = ["#f43f5e", "#f59e0b", "#a855f7", "#22c55e", "#3b82f6"];
        [[R * 0.9, H - R * 0.9], [W - R * 0.9, H - R * 0.9]].forEach(([cx, cy], j) => {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate((j ? -1 : 1) * t / 9000); ctx.globalAlpha = 0.75 * (k > 1 ? 1 : 0.8);
            cols.forEach((c, ring) => {
                const rr = R * (1 - ring * 0.18), n = 8 + ring * 4, shown = Math.floor(n * Math.min(1, Math.max(0, reveal * 5 - ring)));
                ctx.fillStyle = c;
                for (let i = 0; i < shown; i++) { const a = (i / n) * 6.283; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.12, R * 0.055, a, 0, 6.28); ctx.fill(); }
            });
            if (reveal > 0.9) { ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, 6.28); ctx.fill(); }
            ctx.restore();
        });
    },
    candles: ({ ctx, W, H, t, sm }) => { const s = sm ? 6 : 8, y = H - 6, cols = ["#f472b6", "#60a5fa", "#facc15", "#4ade80"]; const n = sm ? 2 : 4; for (let i = 0; i < n; i++) { candle(ctx, 20 + s + i * s * 2.4, y, s, cols[i % 4], t + i * 90); candle(ctx, W - 20 - s - i * s * 2.4, y, s, cols[(i + 2) % 4], t + i * 130); } },
    cake: ({ ctx, W, H, t, k, sm }) => {
        const w = sm ? 70 : 104, h = w * 0.62, x = W - w - (sm ? 12 : 22), y = H - h - 6;
        glowAt(ctx, x + w / 2, y + h * 0.3, w * 1.1 * k, "rgba(251,191,36,0.18)");
        ctx.fillStyle = "#7c2d12"; ctx.fillRect(x, y + h * 0.45, w, h * 0.55); ctx.fillStyle = "#f9a8d4"; ctx.fillRect(x + w * 0.08, y + h * 0.05, w * 0.84, h * 0.42);
        ctx.fillStyle = "#fdf2f8"; ctx.beginPath(); ctx.moveTo(x, y + h * 0.45); for (let i = 0; i <= 8; i++) ctx.quadraticCurveTo(x + (i - 0.5) * w / 8, y + h * 0.62, x + i * w / 8, y + h * 0.45); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + w * 0.08, y + h * 0.05); for (let i = 0; i <= 6; i++) ctx.quadraticCurveTo(x + w * 0.08 + (i - 0.5) * w * 0.84 / 6, y + h * 0.2, x + w * 0.08 + i * w * 0.84 / 6, y + h * 0.05); ctx.fill();
        ["#f59e0b", "#60a5fa", "#4ade80"].forEach((c, i) => candle(ctx, x + w * (0.3 + i * 0.2), y + h * 0.05, sm ? 3.2 : 4.4, c, t + i * 70));
        ctx.fillStyle = "#e5e7eb"; ctx.fillRect(x - 6, y + h, w + 12, 4);
    },
    pongal: ({ ctx, W, H, t, k, sm }) => {
        const s = sm ? 26 : 36;
        [[s * 1.6, H - 4], [W - s * 1.6, H - 4]].slice(0, 2).forEach(([x, y], j) => {
            glowAt(ctx, x, y - s, s * 2.2 * k, "rgba(251,191,36,0.2)");
            ctx.fillStyle = "#c2410c"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.6, s, s * 0.75, 0, 0, 6.28); ctx.fill();
            ctx.fillStyle = "#facc15"; ctx.fillRect(x - s * 0.9, y - s * 0.75, s * 1.8, s * 0.14);
            ctx.fillStyle = "#16a34a"; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x + i * s * 0.32, y - s * 0.5, s * 0.06, s * 0.1, 0, 0, 6.28); ctx.fill(); }
            ctx.fillStyle = "#9a3412"; ctx.beginPath(); ctx.ellipse(x, y - s * 1.32, s * 0.55, s * 0.14, 0, 0, 6.28); ctx.fill();
            ctx.fillStyle = "#fffbeb"; for (let i = 0; i < 5; i++) { const bx = x + (i - 2) * s * 0.22, by = y - s * 1.38 - Math.abs(Math.sin(t / 400 + i + j)) * s * 0.22; ctx.beginPath(); ctx.arc(bx, by, s * 0.15, 0, 6.28); ctx.fill(); }
            ctx.strokeStyle = "#65a30d"; ctx.lineWidth = sm ? 3 : 4; ctx.beginPath(); ctx.moveTo(x + (j ? -1 : 1) * s * 1.3, y); ctx.lineTo(x + (j ? -1 : 1) * s * 1.1, y - s * 2.6); ctx.stroke();
        });
    },
    pookalam: ({ ctx, W, H, t, k, sm }) => {
        const R = sm ? 32 : 48, cols = ["#facc15", "#f97316", "#ef4444", "#ffffff", "#16a34a"];
        [[R * 0.9, H - R * 0.9], [W - R * 0.9, H - R * 0.9]].forEach(([cx, cy]) => {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(t / 14000); ctx.globalAlpha = 0.7 * (k > 1 ? 1 : 0.85);
            cols.forEach((c, i) => { const rr = R * (1 - i * 0.19); ctx.fillStyle = c; ctx.beginPath(); for (let a = 0; a <= 6.3; a += 0.05) { const w = rr * (0.88 + 0.12 * Math.cos(a * (8 + i * 2))); a ? ctx.lineTo(Math.cos(a) * w, Math.sin(a) * w) : ctx.moveTo(w, 0); } ctx.fill(); });
            ctx.restore();
        });
    },
    garba: ({ ctx, W, H, t, k, sm, colors }) => {
        const R = sm ? 26 : 40;
        [[R * 1.4, H - R * 1.4, 1], [W - R * 1.4, H - R * 1.4, -1]].forEach(([cx, cy, d]) => {
            [1, 0.62].forEach((m, ring) => {
                const n = ring ? 8 : 12;
                for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + d * t / (ring ? 1400 : 2200) * (ring ? -1 : 1), x = cx + Math.cos(a) * R * m, y = cy + Math.sin(a) * R * m, c = colors[(i + ring) % colors.length]; glowAt(ctx, x, y, 8 * k, c + "77"); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.28); ctx.fill(); }
            });
            ctx.strokeStyle = "rgba(250,204,21,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R * 0.25, 0, 6.28); ctx.stroke();
        });
    },
    topstar: ({ ctx, W, t, k, sm }) => {
        const r = sm ? 12 : 17, x = W - r * 3, y = r * 2.4, pulse = 0.85 + 0.15 * Math.sin(t / 500);
        glowAt(ctx, x, y, r * 4 * k * pulse, "rgba(253,230,138,0.35)");
        ctx.fillStyle = "#fde047"; ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r * pulse; ctx.lineTo(x + Math.cos(i * 0.628 - 1.5708) * rr, y + Math.sin(i * 0.628 - 1.5708) * rr); } ctx.closePath(); ctx.fill();
    },
    globe: ({ ctx, W, H, k, sm }) => {
        // the glass edge of a globe around the screen (very light vignette)
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, "rgba(186,230,253,0)"); g.addColorStop(1, `rgba(186,230,253,${0.10 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const r = sm ? 20 : 28; ctx.strokeStyle = "rgba(224,242,254,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W - r * 1.6, H - r * 1.9, r, 0, 6.28); ctx.stroke();
        ctx.fillStyle = "rgba(120,53,15,0.8)"; ctx.fillRect(W - r * 2.5, H - r * 0.95, r * 1.8, r * 0.4);
    },
    moonleft: ({ ctx, k, sm }) => {
        const r = sm ? 16 : 24, x = r * 2.4, y = r * 2.2;
        glowAt(ctx, x, y, r * 3.2 * k, "rgba(254,249,195,0.32)");
        ctx.fillStyle = "#fef3c7"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
        ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.arc(x - r * 0.45, y - r * 0.2, r * 0.88, 0, 6.28); ctx.fill(); ctx.globalCompositeOperation = "source-over";
    },
    lanterns: ({ ctx, W, t, k, sm }) => {
        const s = sm ? 9 : 13; const xs = sm ? [W * 0.08, W * 0.92] : [W * 0.06, W * 0.16, W * 0.84, W * 0.94];
        xs.forEach((x0, i) => {
            const len = (i % 2 ? 26 : 44) * (sm ? 0.7 : 1), sw = Math.sin(t / 1100 + i) * 0.08, x = x0 + Math.sin(sw) * len, y = Math.cos(sw) * len;
            ctx.strokeStyle = "rgba(202,138,4,0.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x, y); ctx.stroke();
            lantern(ctx, x, y, s, t + i * 200, k);
        });
    },
    gwaves: ({ ctx, W, H, t, k }) => {
        const bands = [["rgba(99,102,241,", 0], ["rgba(236,72,153,", 1.7], ["rgba(20,184,166,", 3.4]] as const;
        bands.forEach(([c, ph], i) => {
            const base = H - 26 - i * 16, amp = 12 + i * 4;
            const g = ctx.createLinearGradient(0, base - amp, 0, H); g.addColorStop(0, `${c}${0.16 * k})`); g.addColorStop(1, `${c}0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
            for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, base + amp * Math.sin(x / (170 + i * 40) + t / (1700 + i * 300) + ph));
            ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        });
    },
    aurora: ({ ctx, W, t, k, sm }) => {
        const bands = [["rgba(45,212,191,", 0], ["rgba(167,139,250,", 2], ["rgba(74,222,128,", 4]] as const;
        bands.forEach(([c, ph], i) => {
            const top = (sm ? 10 : 18) + i * (sm ? 12 : 18), h = sm ? 46 : 70;
            ctx.beginPath(); ctx.moveTo(0, top);
            for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, top + 14 * Math.sin(x / 210 + t / (2300 + i * 500) + ph) + 8 * Math.sin(x / 90 + t / 1300));
            for (let x = W + 10; x >= 0; x -= 10) ctx.lineTo(x, top + h + 18 * Math.sin(x / 260 + t / (2600 + i * 400) + ph));
            ctx.closePath(); const g = ctx.createLinearGradient(0, top, 0, top + h + 18); g.addColorStop(0, `${c}0)`); g.addColorStop(0.5, `${c}${0.16 * k})`); g.addColorStop(1, `${c}0)`);
            ctx.fillStyle = g; ctx.fill();
        });
    },
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
        if (theme === "PARTY_POPPERS") {
            // party poppers: bursts of confetti + streamers from the bottom corners (opening), an occasional pop later
            const fire = confetti.create(cv, { resize: true, useWorker: false, disableForReducedMotion: true });
            const pop = (scale: number) => {
                const n = Math.max(6, Math.round((small() ? 26 : 50) * scale));
                const side = Math.random() < 0.5;
                fire({ particleCount: n, angle: side ? 60 : 120, spread: 45, origin: { x: side ? 0.02 : 0.98, y: 1 }, startVelocity: 55 * Math.max(0.55, scale), colors: PARTY, ticks: 240, scalar: 1 });
                fire({ particleCount: Math.round(n / 3), angle: side ? 65 : 115, spread: 25, origin: { x: side ? 0.02 : 0.98, y: 1 }, startVelocity: 60 * Math.max(0.55, scale), colors: PARTY, shapes: ["square"], scalar: 1.8, flat: true, ticks: 260 } as any);
            };
            const run = () => {
                clearTimers();
                if (inOpening()) {
                    timers.push(setInterval(() => {
                        if (document.hidden) return;
                        const left = 1 - (performance.now() - start) / OPENING_MS;
                        if (left <= 0) { cv.dataset.phase = "subtle"; run(); return; }
                        pop(left);
                    }, 650));
                } else if (subtle) {
                    cv.dataset.phase = "subtle";
                    timers.push(setInterval(() => { if (!document.hidden) pop(0.18); }, 6000));
                } else cv.dataset.phase = "done";
            };
            run();
            return () => { stopped = true; clearTimers(); fire.reset(); };
        }
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
        const fx: P[] = [];                 // fireworks sparks / shooting stars (not counted as particles)
        let nextBurst = 0, nextShoot = 0;
        const spawn = (initial = false): P => {
            const k = pick(spec.kinds);
            const SZ: Record<string, [number, number]> = { blob: [6, 13], feather: [10, 16], petal: [4, 7], snow: [1.5, 3.5], lantern: [9, 14], balloon: [12, 18], gift: [8, 12], flower: [5, 8], rosepetal: [6, 9], kite: [12, 18], xstar: [3, 6], bubble: [2, 5], firefly: [1.6, 2.6], bokeh: [18, 46], twinkle: [0.8, 2], swirl: [1.2, 3] };
            const big = SZ[k.kind] ? rnd(SZ[k.kind][0], SZ[k.kind][1]) : rnd(1.2, 2.8);
            const x = rnd(0, W);
            const y = k.dir === "up" ? (initial ? rnd(H * 0.3, H) : H + 10) : k.dir === "down" ? (initial ? rnd(-H * 0.2, H * 0.7) : -12) : rnd(0, H);
            const sp = k.dir === "drift" ? 0.25 : 0.5;
            const p: P = { x, y, vx: rnd(-0.3, 0.3), vy: k.dir === "up" ? -rnd(0.25, 0.8) : k.dir === "down" ? rnd(sp * 0.6, sp * 1.8) : rnd(-0.15, 0.15), r: big, c: pick(k.colors), a: 0, rot: rnd(0, 6.28), vr: rnd(-0.02, 0.02), life: 0, kind: k.kind };
            // per-kind motion of the added themes
            if (k.kind === "rosepetal") { p.x = initial ? rnd(0, W) : -20; p.y = rnd(-H * 0.1, H * 0.8); p.vx = rnd(0.35, 0.9); p.vy = rnd(0.12, 0.4); p.vr = rnd(-0.03, 0.03); }
            if (k.kind === "kite") { p.x = initial ? rnd(0, W) : -30; p.y = rnd(H * 0.06, H * 0.42); p.vx = rnd(0.25, 0.6); p.vy = 0; p.c2 = pick(k.colors); }
            if (k.kind === "balloon" || k.kind === "lantern") { p.vy = -rnd(0.35, 0.75); p.vx = rnd(-0.12, 0.12); p.rot = 0; p.vr = 0; }
            if (k.kind === "gift") { p.vy = rnd(0.35, 0.7); p.vr = rnd(-0.012, 0.012); p.c2 = pick(["#fde68a", "#ffffff", "#fca5a5"]); }
            if (k.kind === "bubble") { p.x = rnd(W * 0.02, W * 0.98); p.vy = -rnd(0.3, 0.7); }
            if (FADING.has(k.kind)) { p.x = rnd(0, W); p.y = k.kind === "twinkle" ? rnd(0, H * 0.55) : rnd(0, H); p.max = k.kind === "bokeh" ? rnd(500, 900) : k.kind === "twinkle" ? rnd(300, 700) : rnd(260, 520); p.vx = k.kind === "twinkle" ? 0 : rnd(-0.25, 0.25); p.vy = k.kind === "twinkle" ? 0 : rnd(-0.2, 0.2); p.life = initial ? Math.floor(rnd(0, p.max * 0.6)) : 0; }
            if (k.kind === "swirl") { p.vx = rnd(0.2, 0.6); p.vy = rnd(0.25, 0.6); }
            return p;
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
                case "lantern": {
                    const w = p.r, h = p.r * 1.35;
                    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 2.6); g.addColorStop(0, "rgba(251,191,36,0.45)"); g.addColorStop(1, "rgba(251,191,36,0)");
                    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 2.6, 0, 6.28); ctx.fill();
                    const lg = ctx.createLinearGradient(0, -h, 0, h); lg.addColorStop(0, "#fde68a"); lg.addColorStop(1, p.c);
                    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-w * 0.7, -h); ctx.lineTo(w * 0.7, -h); ctx.lineTo(w, h * 0.7); ctx.lineTo(-w, h * 0.7); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = "#fff7ed"; ctx.beginPath(); ctx.ellipse(0, h * 0.75, w * 0.35, w * 0.18, 0, 0, 6.28); ctx.fill(); break;
                }
                case "balloon": {
                    const sw = Math.sin(t / 700 + p.x) * 0.12; ctx.rotate(sw);
                    ctx.strokeStyle = "rgba(228,228,231,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, p.r * 1.25); ctx.quadraticCurveTo(p.r * 0.3, p.r * 2.2, 0, p.r * 3.2); ctx.stroke();
                    const bg = ctx.createRadialGradient(-p.r * 0.35, -p.r * 0.45, p.r * 0.1, 0, 0, p.r * 1.2); bg.addColorStop(0, "rgba(255,255,255,0.85)"); bg.addColorStop(0.25, p.c); bg.addColorStop(1, p.c);
                    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.85, p.r * 1.1, 0, 0, 6.28); ctx.fill();
                    ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(-p.r * 0.15, p.r * 1.1); ctx.lineTo(p.r * 0.15, p.r * 1.1); ctx.lineTo(0, p.r * 1.3); ctx.fill(); break;
                }
                case "gift": {
                    const s = p.r; ctx.fillStyle = p.c; ctx.fillRect(-s, -s * 0.8, s * 2, s * 1.8);
                    ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(-s, -s * 0.8, s * 2, s * 0.45);
                    ctx.fillStyle = p.c2 || "#fde68a"; ctx.fillRect(-s * 0.18, -s * 0.8, s * 0.36, s * 1.8); ctx.fillRect(-s, -s * 0.5, s * 2, s * 0.3);
                    ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.95, s * 0.35, s * 0.2, -0.5, 0, 6.28); ctx.ellipse(s * 0.35, -s * 0.95, s * 0.35, s * 0.2, 0.5, 0, 6.28); ctx.fill(); break;
                }
                case "flower": {
                    ctx.fillStyle = p.c;
                    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 1.2566) * p.r * 0.55, Math.sin(i * 1.2566) * p.r * 0.55, p.r * 0.5, p.r * 0.32, i * 1.2566, 0, 6.28); ctx.fill(); }
                    ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.28, 0, 6.28); ctx.fill(); break;
                }
                case "rosepetal": {
                    const sq = 0.55 + 0.45 * Math.abs(Math.sin(t / 600 + p.y / 50));   // turning in the air
                    const rg = ctx.createLinearGradient(-p.r, 0, p.r, 0); rg.addColorStop(0, p.c); rg.addColorStop(1, "#fda4af");
                    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, -p.r * sq); ctx.bezierCurveTo(p.r, -p.r * sq, p.r, p.r * 0.6 * sq, 0, p.r * sq); ctx.bezierCurveTo(-p.r * 0.6, p.r * 0.4 * sq, -p.r * 0.5, -p.r * 0.6 * sq, 0, -p.r * sq); ctx.fill(); break;
                }
                case "kite": {
                    const s = p.r; const sway = Math.sin(t / 900 + p.x / 90) * 0.25; ctx.rotate(sway - p.rot);
                    ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s * 1.2); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = p.c2 || "#fde68a"; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
                    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s * 1.2); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(s * 0.7, 0); ctx.stroke();
                    ctx.strokeStyle = p.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, s * 1.2);
                    for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(t / 300 + i) * 4, s * 1.2 + i * s * 0.45); ctx.stroke(); break;
                }
                case "xstar": {
                    const tw = 0.6 + 0.4 * Math.sin(t / 300 + p.x); ctx.globalAlpha = p.a * tw; ctx.fillStyle = p.c;
                    ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? p.r * 0.45 : p.r * 1.2; ctx.lineTo(Math.cos(i * 0.628 - 1.5708) * rr, Math.sin(i * 0.628 - 1.5708) * rr); } ctx.closePath(); ctx.fill(); break;
                }
                case "bubble": ctx.strokeStyle = p.c; ctx.globalAlpha = p.a * 0.6; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fill(); break;
                case "firefly": {
                    const bl = Math.max(0, Math.sin(t / 380 + p.r * 40)); ctx.globalAlpha = p.a * (0.25 + 0.75 * bl);
                    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 5); g.addColorStop(0, p.c); g.addColorStop(0.3, "rgba(190,242,100,0.35)"); g.addColorStop(1, "rgba(190,242,100,0)");
                    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r * 5, 0, 6.28); ctx.fill(); break;
                }
                case "bokeh": {
                    ctx.globalAlpha = p.a * 0.22; const g = ctx.createRadialGradient(0, 0, p.r * 0.2, 0, 0, p.r); g.addColorStop(0, p.c); g.addColorStop(0.8, p.c); g.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); break;
                }
                case "twinkle": { const tw = 0.3 + 0.7 * Math.abs(Math.sin(t / 500 + p.rot * 3)); ctx.globalAlpha = p.a * tw; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); break; }
                case "swirl": ctx.fillStyle = p.c; ctx.globalAlpha = p.a * 0.85; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); break;
                case "ember": ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill(); break;
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
            } else if (spec.decor && EXTRA_DECOR[spec.decor]) {
                EXTRA_DECOR[spec.decor]({ ctx, W, H, t, k, sm, el: performance.now() - start, colors: spec.bulbColors || BULBS });
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
            // fireworks: rockets burst into sparks (often in the opening, now and then later)
            if (spec.bursts && t >= nextBurst) {
                const cx = rnd(W * 0.12, W * 0.88), cy = rnd(H * 0.1, H * 0.42), col = pick(FIRE), n = inOpening() ? (small() ? 34 : 60) : (small() ? 18 : 28);
                for (let i = 0; i < n; i++) { const ang = (i / n) * 6.283 + rnd(-0.05, 0.05), v = rnd(1.4, 3.2); fx.push({ x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: rnd(1.2, 2.2), c: Math.random() < 0.8 ? col : "#ffffff", a: 1, rot: 0, vr: 0, life: 0, kind: "ember", g: 0.035, max: rnd(60, 95) }); }
                nextBurst = t + (inOpening() ? rnd(350, 700) : rnd(3500, 6000));
            }
            if (spec.shooting && t >= nextShoot) {
                fx.push({ x: rnd(W * 0.3, W), y: rnd(0, H * 0.25), vx: -rnd(6, 9), vy: rnd(2, 3.2), r: 1.6, c: "#ffffff", a: 1, rot: 0, vr: 0, life: 0, kind: "shoot", max: 55 });
                nextShoot = t + (inOpening() ? rnd(900, 1600) : rnd(6000, 11000));
            }
            for (let i = fx.length - 1; i >= 0; i--) {
                const p = fx[i]; p.life++; p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.vx *= p.kind === "ember" ? 0.985 : 1;
                const left = 1 - p.life / (p.max || 60); if (left <= 0) { fx.splice(i, 1); continue; }
                if (p.kind === "shoot") {
                    ctx.save(); const tg = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 10, p.y - p.vy * 10); tg.addColorStop(0, `rgba(255,255,255,${0.9 * left})`); tg.addColorStop(1, "rgba(255,255,255,0)");
                    ctx.strokeStyle = tg; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 10, p.y - p.vy * 10); ctx.stroke(); ctx.restore();
                } else { p.a = left; drawParticle(p, t); }
            }
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.life++; p.x += p.vx * boost; p.y += p.vy * boost; p.rot += p.vr; p.vx += rnd(-0.01, 0.01);
                if (p.kind === "swirl") { p.vx = Math.cos(t / 1800 + p.y / 160) * 0.7; p.vy = 0.25 + Math.sin(t / 2200 + p.x / 200) * 0.35; }
                if (p.kind === "kite") p.y += Math.sin(t / 800 + p.x / 60) * 0.25;
                p.a = Math.min(1, p.life / 40) * (inOpening() ? 0.95 : 0.75);
                if (p.max) p.a *= Math.max(0, Math.min(1, (p.max - p.life) / 60));
                const out = p.y < -60 || p.y > H + 60 || p.x < -60 || p.x > W + 60 || (p.max ? p.life >= p.max : !ROAMING.has(p.kind) && p.life > 900);
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