"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Users, Code2, Megaphone, BookOpen, UserCog, UserX, ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgChartData, OrgPerson } from "@/lib/org-chart";

/* ── Layout constants: every card has the same size so each hierarchy depth lines up across the whole chart ── */
const CARD_W = 228;
const CARD_H = 64;
const GAP_Y = 52;          // vertical space between depths (half above the bus, half below)
const GAP_X = 28;          // horizontal space between sibling subtrees
const TAIL = 14;           // line under a section row
const LINE = "bg-white/35";

type Tone = { ring: string; glow: string; avatar: string };
const TONES: Record<string, Tone> = {
    exec: { ring: "border-amber-400/45", glow: "shadow-[0_0_22px_-6px_rgba(251,191,36,0.55)]", avatar: "bg-amber-500/15 text-amber-300 border-amber-400/40" },
    tl: { ring: "border-sky-400/40", glow: "shadow-[0_0_20px_-7px_rgba(56,189,248,0.55)]", avatar: "bg-sky-500/15 text-sky-300 border-sky-400/40" },
    ad: { ring: "border-blue-400/40", glow: "shadow-[0_0_20px_-7px_rgba(96,165,250,0.55)]", avatar: "bg-blue-500/15 text-blue-300 border-blue-400/40" },
    hr: { ring: "border-violet-400/40", glow: "shadow-[0_0_20px_-7px_rgba(167,139,250,0.55)]", avatar: "bg-violet-500/15 text-violet-300 border-violet-400/40" },
    hrexec: { ring: "border-fuchsia-400/35", glow: "shadow-[0_0_18px_-8px_rgba(232,121,249,0.5)]", avatar: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/40" },
    hoi: { ring: "border-purple-400/45", glow: "shadow-[0_0_20px_-7px_rgba(192,132,252,0.55)]", avatar: "bg-purple-500/15 text-purple-300 border-purple-400/40" },
    clch: { ring: "border-teal-400/40", glow: "shadow-[0_0_18px_-8px_rgba(45,212,191,0.5)]", avatar: "bg-teal-500/15 text-teal-300 border-teal-400/40" },
    faculty: { ring: "border-rose-400/35", glow: "shadow-[0_0_16px_-8px_rgba(251,113,133,0.5)]", avatar: "bg-rose-500/15 text-rose-300 border-rose-400/40" },
    om: { ring: "border-indigo-400/40", glow: "shadow-[0_0_16px_-8px_rgba(129,140,248,0.5)]", avatar: "bg-indigo-500/15 text-indigo-300 border-indigo-400/40" },
    tech: { ring: "border-cyan-400/35", glow: "shadow-[0_0_16px_-8px_rgba(34,211,238,0.5)]", avatar: "bg-cyan-500/15 text-cyan-300 border-cyan-400/40" },
    marketing: { ring: "border-orange-400/35", glow: "shadow-[0_0_16px_-8px_rgba(251,146,60,0.5)]", avatar: "bg-orange-500/15 text-orange-300 border-orange-400/40" },
    muted: { ring: "border-zinc-700", glow: "", avatar: "bg-zinc-800 text-zinc-400 border-zinc-700" },
};
const toneOf = (p: OrgPerson): string => {
    if (p.role === "FOUNDER") return "exec";
    if (p.role === "TL") return "tl";
    if (p.role === "AD") return "ad";
    if (p.role === "HR_EXECUTIVE" || /\bhr\s*exec/i.test(p.designation)) return "hrexec";
    if (p.role === "HR") return "hr";
    if (p.role === "HOI") return "hoi";
    if (p.role === "CURRICULUM_LEAD" || p.role === "CURRICULUM_HEAD") return "clch";
    if (p.role === "OM") return "om";
    if (p.role === "TECH_TEAM") return "tech";
    if (p.role === "MARKETING_TEAM") return "marketing";
    return "faculty";
};
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

/* ── Lines ── */
const VLine = ({ h, className }: { h: number; className?: string }) => <div className={cn("w-[2px] shrink-0", LINE, className)} style={{ height: h }} />;

/* ── Employee card ── */
// Org chart shows the full title for short executive designations (display only — the stored designation is unchanged)
const FULL_TITLE: Record<string, string> = { COO: "Chief Operating Officer", CEO: "Chief Executive Officer", CTO: "Chief Technology Officer", CFO: "Chief Financial Officer" };
const fullTitle = (d?: string) => (d && FULL_TITLE[d.trim().toUpperCase()]) || d || "";
export function PersonCard({ p, highlight }: { p: OrgPerson; highlight?: boolean }) {
    const t = TONES[toneOf(p)];
    return (
        <div data-person={p.id} data-testid="org-card"
            className={cn("relative z-10 bg-zinc-950 border rounded-2xl flex items-center gap-3 px-3 transition-shadow", t.ring, t.glow, highlight && "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950")}
            style={{ width: CARD_W, height: CARD_H }}>
            <div className={cn("relative w-10 h-10 rounded-full border flex items-center justify-center text-[12px] font-black shrink-0 overflow-hidden", t.avatar)}>
                {initials(p.name)}{p.photo && <img src={p.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-white uppercase tracking-wide truncate" title={p.name} data-testid="org-name">{p.name}</p>
                <p className="text-[10px] text-zinc-400 font-semibold truncate mt-0.5" title={fullTitle(p.designation)} data-testid="org-desig">{fullTitle(p.designation)}</p>
            </div>
        </div>
    );
}

function PlaceholderCard({ label }: { label: string }) {
    return (
        <div className="relative z-10 border border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center bg-zinc-950" style={{ width: CARD_W, height: CARD_H }}>
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wide">{label}</p>
            <p className="text-[10px] text-zinc-600">Not assigned yet</p>
        </div>
    );
}

/** One or more cards in a row joined underneath (CEO·COO·CTO, or several TLs). Always ends with a short tail so all rows are equal height. */
function SectionRow({ people, placeholder, highlightId }: { people: OrgPerson[]; placeholder: string; highlightId?: string | null }) {
    if (!people.length) return <div className="flex flex-col items-center" data-testid={`org-section-${placeholder.toLowerCase().replace(/[^a-z]/g, "")}`}><PlaceholderCard label={placeholder} /><VLine h={TAIL} /></div>;
    return (
        <div className="relative flex flex-col items-center" data-testid={`org-section-${placeholder.toLowerCase().replace(/[^a-z]/g, "")}`}>
            <div className="relative flex" style={{ gap: 18 }}>
                {people.map(p => (
                    <div key={p.id} className="flex flex-col items-center">
                        <PersonCard p={p} highlight={highlightId === p.id} />
                        <VLine h={TAIL} />
                    </div>
                ))}
                {people.length > 1 && <div className={cn("absolute bottom-0 h-[2px]", LINE)} style={{ left: CARD_W / 2, right: CARD_W / 2 }} />}
            </div>
        </div>
    );
}

/** Team group: header strip + every employee card, always visible (no expand / collapse). Cards keep the same size. */
function GroupBox({ id, label, icon, tone, people, highlightId, emptyText }: {
    id: string; label: string; icon: ReactNode; tone: string; people: OrgPerson[]; highlightId?: string | null; emptyText: string;
}) {
    const cols = people.length > 14 ? 3 : people.length > 5 ? 2 : 1;
    const t = TONES[tone];
    return (
        <div data-testid={`org-group-${id}`} className={cn("rounded-2xl border bg-zinc-950/70 backdrop-blur-sm", t.ring)}>
            <div className="w-full flex items-center gap-2 px-3 h-9 text-left rounded-2xl" style={{ minWidth: CARD_W + 16 }}>
                <span className={cn("w-6 h-6 rounded-full border flex items-center justify-center", t.avatar)}>{icon}</span>
                <span className={cn("text-[10px] font-black text-white tracking-[0.14em] flex-1", label !== "OMs" && "uppercase")}>{label}</span>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full px-2 py-0.5" data-testid={`org-group-count-${id}`}>{people.length}</span>
            </div>
            <div className="p-2 pt-1 grid gap-2" data-testid={`org-group-body-${id}`} style={{ gridTemplateColumns: `repeat(${cols}, ${CARD_W}px)` }}>
                {people.map(p => <PersonCard key={p.id} p={p} highlight={highlightId === p.id} />)}
                {!people.length && <p className="text-[10px] text-zinc-500 italic px-2 py-3">{emptyText}</p>}
            </div>
        </div>
    );
}

/** Children hanging from a parent with a horizontal bus. `drop` lengthens the line for a child (to skip a depth).
 *  A `detached` child sits at the same level but is not hung from this bus (it is joined by its own lines). */
function Branches({ items }: { items: { key: string; node: ReactNode; drop?: number; detached?: boolean }[] }) {
    if (!items.length) return null;
    const joined = items.map((c, i) => (c.detached ? -1 : i)).filter(i => i >= 0);
    const first = joined.length ? joined[0] : -1, last = joined.length ? joined[joined.length - 1] : -1;
    return (
        <div className="flex flex-col items-center">
            <VLine h={GAP_Y / 2} />
            <div className="flex items-start">
                {items.map((c, i) => (
                    <div key={c.key} className="relative flex flex-col items-center" style={{ paddingLeft: GAP_X / 2, paddingRight: GAP_X / 2 }}>
                        {joined.length > 1 && i > first && i <= last && <div className={cn("absolute top-0 left-0 w-1/2 h-[2px]", LINE)} />}
                        {joined.length > 1 && i >= first && i < last && <div className={cn("absolute top-0 right-0 w-1/2 h-[2px]", LINE)} />}
                        {c.detached ? <div className="shrink-0" style={{ height: GAP_Y / 2 + (c.drop || 0) }} /> : <VLine h={GAP_Y / 2 + (c.drop || 0)} />}
                        {c.node}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Tech Lead → CL / CH → HOIs: drawn from the measured card positions so the lines stay aligned at any zoom ── */
const TL_BRANCH_X = 44; // x of the Tech Lead → Curriculum Team line, measured from the Tech Lead card's left edge
const CLCH_LINE = "rgba(255,255,255,0.35)"; // same colour as every other line in the chart (LINE = bg-white/35)
function useClchLinks(rootRef: React.RefObject<HTMLDivElement | null>, deps: unknown[], setShift: (f: (s: number) => number) => void) {
    const [links, setLinks] = useState<{ w: number; h: number; paths: string[] } | null>(null);
    const measure = useCallback(() => {
        const root = rootRef.current; if (!root) return;
        const r = root.getBoundingClientRect();
        const scale = root.offsetWidth ? r.width / root.offsetWidth : 1;
        const box = (el: Element | null) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { l: (b.left - r.left) / scale, t: (b.top - r.top) / scale, r: (b.right - r.left) / scale, b: (b.bottom - r.top) / scale };
        };
        const tl = box(root.querySelector('[data-testid="org-section-techlead"] [data-person]'));
        const clch = box(root.querySelector('[data-testid="org-clch-node"]'));
        const hois = Array.from(root.querySelectorAll('[data-testid="org-hoi"] > [data-person]')).map(box).filter(Boolean) as NonNullable<ReturnType<typeof box>>[];
        if (!clch) { setLinks(null); return; }
        const paths: string[] = [];
        const midY = hois.length ? hois[0].t + CARD_H / 2 : clch.t + CARD_H / 2;
        if (tl) {
            // Separate branch: leaves the Tech Lead card left of its centre (the centre line belongs to the AD / HR bus),
            // so it never runs on top of another line. The Curriculum Team card is nudged so its centre is on this line.
            const x = tl.l + TL_BRANCH_X;
            const delta = x - (clch.l + clch.r) / 2;
            if (Math.abs(delta) > 1) { setShift(s => s + 2 * delta); return; }
            // Where it crosses the HOI bus (if the bus runs past it), draw a small bridge so the lines stay separate
            const busY = clch.t - GAP_Y / 2, r = 6;
            const crosses = hois.some(h => h.r < x) && hois.some(h => h.l > x);
            paths.push(crosses
                ? `M ${x} ${tl.b} V ${busY - r} A ${r} ${r} 0 0 1 ${x} ${busY + r} V ${clch.t}`
                : `M ${x} ${tl.b} V ${clch.t}`);
        }
        // CL / CH → HOIs on its left and right (segments between neighbouring cards on the same row)
        const row = [clch, ...hois].sort((a, b) => a.l - b.l);
        for (let i = 0; i < row.length - 1; i++) if (row[i + 1].l > row[i].r) paths.push(`M ${row[i].r} ${midY} H ${row[i + 1].l}`);
        setLinks({ w: root.scrollWidth, h: root.scrollHeight, paths });
    }, [rootRef, setShift]);
    useLayoutEffect(() => { measure(); }, [measure, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const root = rootRef.current; if (!root || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => measure());
        ro.observe(root);
        // card widths can change once the web fonts / photos have loaded → measure again
        document.fonts?.ready.then(() => measure()).catch(() => {});
        const t = window.setTimeout(measure, 800);
        return () => { ro.disconnect(); window.clearTimeout(t); };
    }, [measure, rootRef]);
    return links;
}

/** The whole hierarchy is always rendered — no dropdowns, expand or collapse controls. */
export default function OrgChart({ data, highlightId }: { data: OrgChartData; highlightId?: string | null }) {

    // Depth of a section row = CARD_H + TAIL; teams under Tech Lead skip one depth so their cards align with Faculty / OM
    const skipDepth = CARD_H + GAP_Y;
    const rootRef = useRef<HTMLDivElement>(null);
    const [clchShift, setClchShift] = useState(0);
    const clchLinks = useClchLinks(rootRef, [data, clchShift], setClchShift);

    const group = (id: string, label: string, icon: ReactNode, tone: string, people: OrgPerson[], emptyText: string) => (
        <GroupBox id={id} label={label} icon={icon} tone={tone} people={people} highlightId={highlightId} emptyText={emptyText} />
    );

    const hoiNodes = data.hois.map(h => ({
        key: `hoi-${h.person.id}`,
        node: (
            <div className="flex flex-col items-center" data-testid="org-hoi" data-hoi={h.person.id}>
                <PersonCard p={h.person} highlight={highlightId === h.person.id} />
                {/* Under each HOI: Faculty and OMs in separate groups (display grouping only — reporting lines are unchanged) */}
                <div data-testid="org-hoi-members" className="flex flex-col items-center">
                    {(() => {
                        const faculty = h.members.filter(m => m.role === "PROFESSOR" || m.role === "FACULTY");
                        const oms = h.members.filter(m => m.role === "OM");
                        const others = h.members.filter(m => !["PROFESSOR", "FACULTY", "OM"].includes(m.role));
                        return (
                            <Branches items={[
                                { key: "faculty", node: group(`hoi-faculty-${h.person.id}`, "Faculty", <BookOpen size={12} />, "faculty", faculty, "No faculty under this HOI yet.") },
                                { key: "om", node: group(`hoi-om-${h.person.id}`, "OMs", <UserCog size={12} />, "om", oms, "No OM under this HOI yet.") },
                                ...(others.length ? [{ key: "other", node: group(`hoi-other-${h.person.id}`, "Other Team", <Users size={12} />, "hoi", others, "") }] : []),
                            ]} />
                        );
                    })()}
                </div>
            </div>
        ),
    }));

    // CL / CH: on the same level as the HOIs, straight below the Tech Lead, joined to the HOIs on its left and right
    // (not hung from the AD / HR bus). Display only — reporting data is unchanged.
    const clchNode = {
        key: "clch", detached: true,
        node: <div data-testid="org-clch-node" style={{ marginLeft: Math.max(0, clchShift), marginRight: Math.max(0, -clchShift) }}>{group("clch", "Curriculum Team", <BookOpen size={12} />, "clch", data.clch, "No Curriculum Team members onboarded yet.")}</div>,
    };
    const clchAt = hoiNodes.length > 1 ? Math.floor(hoiNodes.length / 2) : 0;
    const adChildren = [
        ...hoiNodes.slice(0, clchAt), clchNode, ...hoiNodes.slice(clchAt),
        ...(data.noHoi.length ? [{ key: "nohoi", node: group("nohoi", "No HOI Assigned", <UserX size={12} />, "muted", data.noHoi, "") }] : []),
    ];

    /*
     * Layout (three columns side by side):
     *   left   : Tech Team · Marketing Team — joined ONLY to the Tech Lead (side line from the Tech Lead card)
     *   centre : CEO · COO · CTO → Tech Lead · AD · HR → (shared line under all three) → HOIs · CL / CH
     *   right  : HR Executive — joined ONLY to HR (side line from the HR card)
     */
    const MID = GAP_Y / 2 + CARD_H / 2;                 // y of a row-2 card's middle inside the band
    const BAND = GAP_Y / 2 + CARD_H + TAIL + GAP_Y / 2; // row-2 band height (top line, card, tail, line to the shared bus)
    const TOP = CARD_H + TAIL + GAP_Y / 2;              // executives row + line down to the row-2 bus
    const second = [
        { key: "tl", people: data.techLeads, label: "Tech Lead" },
        { key: "ad", people: data.ads, label: "AD" },
        { key: "hr", people: data.hrHeads, label: "HR" },
    ];
    const sideColumn = (side: "left" | "right", items: { key: string; node: ReactNode; drop?: number }[], testId: string) => (
        <div className="flex flex-col items-center" data-testid={testId}
            style={side === "left" ? { paddingLeft: GAP_X / 2 } : { paddingRight: GAP_X / 2 }}>
            <div style={{ height: TOP }} />
            <div className="relative w-full" style={{ height: BAND }}>
                {/* side line from the Tech Lead / HR card, then down to the groups */}
                <div className={cn("absolute h-[2px]", LINE, side === "left" ? "left-1/2 right-0" : "left-0 right-1/2")} style={{ top: MID }} />
                <div className={cn("absolute w-[2px] left-1/2 -translate-x-1/2 bottom-0", LINE)} style={{ top: MID }} />
            </div>
            <Branches items={items} />
        </div>
    );

    return (
        <div ref={rootRef} className="relative flex items-start px-10 pt-6 pb-16" data-testid="org-chart">
            {clchLinks && (
                <svg className="absolute left-0 top-0 pointer-events-none" width={clchLinks.w} height={clchLinks.h} style={{ zIndex: 5 }} data-testid="org-clch-links" aria-hidden>
                    {clchLinks.paths.map((d, i) => <path key={i} d={d} fill="none" stroke={CLCH_LINE} strokeWidth={2} data-testid="org-clch-link" />)}
                </svg>
            )}
            {sideColumn("left", [
                { key: "tech", drop: skipDepth, node: group("tech", "Tech Team", <Code2 size={12} />, "tech", data.techTeam, "No Tech Team employees yet.") },
                { key: "marketing", drop: skipDepth, node: group("marketing", "Marketing Team", <Megaphone size={12} />, "marketing", data.marketingTeam, "No Marketing Team employees yet.") },
            ], "org-col-techlead")}

            <div className="flex flex-col items-center" data-testid="org-col-main">
                <SectionRow people={data.executives} placeholder="CEO" highlightId={highlightId} />
                <VLine h={GAP_Y / 2} />
                <div className="flex w-full items-start">
                    <div className="flex-1 self-stretch relative"><div className={cn("absolute left-0 right-0 h-[2px]", LINE)} style={{ top: MID }} /></div>
                    <div className="flex items-start">
                        {second.map((c, i) => (
                            <div key={c.key} className="relative flex flex-col items-center" style={{ paddingLeft: GAP_X / 2, paddingRight: GAP_X / 2 }}>
                                {/* top bus from the executives */}
                                {i > 0 && <div className={cn("absolute top-0 left-0 w-1/2 h-[2px]", LINE)} />}
                                {i < second.length - 1 && <div className={cn("absolute top-0 right-0 w-1/2 h-[2px]", LINE)} />}
                                {/* side lines: Tech Lead → left column, HR → right column */}
                                {i === 0 && <div className={cn("absolute left-0 w-1/2 h-[2px]", LINE)} style={{ top: MID }} />}
                                {i === second.length - 1 && <div className={cn("absolute right-0 w-1/2 h-[2px]", LINE)} style={{ top: MID }} />}
                                <VLine h={GAP_Y / 2} />
                                <SectionRow people={c.people} placeholder={c.label} highlightId={highlightId} />
                                <VLine h={GAP_Y / 2} />
                                {/* shared bus under all three → HOIs and CL / CH */}
                                {i > 0 && <div className={cn("absolute bottom-0 left-0 w-1/2 h-[2px]", LINE)} />}
                                {i < second.length - 1 && <div className={cn("absolute bottom-0 right-0 w-1/2 h-[2px]", LINE)} />}
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 self-stretch relative"><div className={cn("absolute left-0 right-0 h-[2px]", LINE)} style={{ top: MID }} /></div>
                </div>
                <Branches items={adChildren} />
            </div>

            {sideColumn("right", [
                { key: "hrexec", node: group("hrexec", "HR Team", <UserCog size={12} />, "hrexec", data.hrExecutives, "No HR Team members onboarded yet.") },
            ], "org-col-hr")}
        </div>
    );
}

/* ── Canvas: horizontal/vertical scroll, drag-to-pan, zoom in/out, fit to screen ── */
export function OrgCanvas({ children }: { children: ReactNode }) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [zoom, setZoom] = useState(1);
    const fitted = useRef(false);

    useLayoutEffect(() => {
        const el = inner.current; if (!el) return;
        const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
        ro.observe(el); setSize({ w: el.offsetWidth, h: el.offsetHeight });
        return () => ro.disconnect();
    }, []);

    // Keep the top of the chart (CEO · COO · CTO) in view: centre horizontally, scroll to top
    const wantCentre = useRef(false);
    const centre = () => { wantCentre.current = true; setTick(t => t + 1); };
    const [tick, setTick] = useState(0);
    // runs after the new zoom has been laid out, so scrollWidth is already the zoomed width
    useLayoutEffect(() => {
        const o = outer.current;
        if (!wantCentre.current || !o) return;
        wantCentre.current = false;
        o.scrollTo({ left: Math.max(0, (o.scrollWidth - o.clientWidth) / 2), top: 0 });
    }, [zoom, tick, size]);
    const fit = useCallback(() => {
        const o = outer.current; if (!o || !size.w) return;
        const z = Math.min(1, (o.clientWidth - 24) / size.w, (o.clientHeight - 24) / size.h);
        setZoom(Math.max(0.25, Math.round(z * 100) / 100));
        centre();
    }, [size]);

    // Until the user zooms / pans: fit the width (not below 60 % so names stay readable) and centre on the executives.
    // Re-runs while data is still arriving, so the first view is right even after the live list loads.
    useEffect(() => {
        const o = outer.current;
        if (fitted.current || !o || !size.w) return;
        setZoom(Math.max(0.6, Math.min(1, Math.round(((o.clientWidth - 24) / size.w) * 100) / 100)));
        centre();
    }, [size]);
    const userMoved = () => { fitted.current = true; };

    // Drag to pan (mouse); touch devices use native scrolling
    const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
    const onDown = (e: React.PointerEvent) => {
        userMoved();
        if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button")) return;
        const o = outer.current!; drag.current = { x: e.clientX, y: e.clientY, l: o.scrollLeft, t: o.scrollTop };
    };
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current; if (!d) return;
        const o = outer.current!; o.scrollLeft = d.l - (e.clientX - d.x); o.scrollTop = d.t - (e.clientY - d.y);
    };
    const stop = () => { drag.current = null; };

    // Download the whole chart (always at 100 %, whatever the current zoom) as an image or a PDF
    const [exporting, setExporting] = useState<"" | "png" | "pdf">("");
    const [menu, setMenu] = useState(false);
    const [exportError, setExportError] = useState("");
    const download = async (kind: "png" | "pdf") => {
        const el = inner.current; if (!el || exporting) return;
        setMenu(false); setExporting(kind); setExportError("");
        try {
            const { toPng } = await import("html-to-image");
            // Employee photos from other websites cannot be drawn into the file directly: load each one through
            // our own server (/api/image-proxy) as a data URL for the export, then put the original back.
            const restore: [HTMLImageElement, string][] = [];
            await Promise.all(Array.from(el.querySelectorAll("img")).map(async img => {
                const src = img.getAttribute("src") || "";
                if (!/^https?:\/\//i.test(src) || src.startsWith(window.location.origin)) return;
                try {
                    const r = await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`);
                    if (!r.ok) return;
                    const blob = await r.blob();
                    const dataUrl: string = await new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = bad; fr.readAsDataURL(blob); });
                    await new Promise<void>(ok => { img.onload = () => ok(); img.onerror = () => ok(); restore.push([img, src]); img.src = dataUrl; });
                } catch { /* this photo stays as it is (initials are shown if it cannot be drawn) */ }
            }));
            const w = el.offsetWidth, h = el.offsetHeight;
            // sharp output, but within the browser's canvas limits for very large charts
            const ratio = Math.max(0.25, Math.min(2, 16000 / w, 16000 / h, Math.sqrt(120_000_000 / (w * h))));
            const opts: any = { width: w, height: h, pixelRatio: ratio, backgroundColor: "#09090b", style: { transform: "none" }, cacheBust: true,
                imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" };
            // Try the full chart first; if a font or an employee photo (another website / private storage) cannot be
            // read by the browser, retry without web fonts, then without photos (initials stay on the cards).
            const attempts: any[] = [
                opts,
                { ...opts, skipFonts: true },
                { ...opts, skipFonts: true, cacheBust: false, filter: (n: HTMLElement) => n.tagName !== "IMG" },
            ];
            let dataUrl = "", lastErr: any = null;
            for (const a of attempts) {
                try { dataUrl = await toPng(el, a); if (dataUrl && dataUrl.length > 100) break; }
                catch (err) { lastErr = err; dataUrl = ""; }
            }
            restore.forEach(([img, src]) => { img.onload = null; img.onerror = null; img.src = src; });
            if (!dataUrl) throw lastErr || new Error("empty image");
            const name = `GOG-Organization-Chart-${new Date().toISOString().slice(0, 10)}`;
            if (kind === "png") {
                const a = document.createElement("a"); a.href = dataUrl; a.download = `${name}.png`; a.click();
            } else {
                const { default: jsPDF } = await import("jspdf");
                const k = Math.min(1, 14000 / Math.max(w, h)); // PDF page size limit
                const pw = w * k, ph = h * k;
                const pdf = new jsPDF({ orientation: pw >= ph ? "landscape" : "portrait", unit: "pt", format: [pw, ph], compress: true });
                pdf.addImage(dataUrl, "PNG", 0, 0, pw, ph);
                pdf.save(`${name}.pdf`);
            }
        } catch (e: any) {
            setExportError(`Could not create the file${e?.message ? ` (${String(e.message).slice(0, 80)})` : ""}. Please try again.`);
            console.error("[org chart] export failed", e);
        } finally { setExporting(""); }
    };

    const btn = "w-9 h-9 bg-zinc-900/95 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all";
    return (
        <div className="relative rounded-3xl border border-zinc-900 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)] bg-zinc-950/60 overflow-hidden">
            <div className="flex items-center justify-end gap-1.5 px-3 py-2.5 border-b border-zinc-900 bg-zinc-950/80" data-testid="org-controls" onClickCapture={userMoved}>
                {exportError && <span className="text-[10px] text-red-400 mr-auto" data-testid="org-export-error">{exportError}</span>}
                <div className="relative">
                    <button className={cn(btn, "w-auto px-3 gap-1.5 text-[11px] font-bold")} title="Download the organization chart" data-testid="org-download"
                        onClick={() => setMenu(m => !m)} disabled={!!exporting}>
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {exporting ? "Preparing…" : "Download"}
                    </button>
                    {menu && (
                        <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl p-1" data-testid="org-download-menu">
                            <button onClick={() => download("png")} data-testid="org-download-png" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-zinc-200 hover:bg-zinc-900"><ImageIcon size={13} /> Image (PNG)</button>
                            <button onClick={() => download("pdf")} data-testid="org-download-pdf" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-zinc-200 hover:bg-zinc-900"><FileText size={13} /> PDF</button>
                        </div>
                    )}
                </div>
                <span className="text-[10px] font-bold text-zinc-500 w-10 text-right" data-testid="org-zoom">{Math.round(zoom * 100)}%</span>
                <button className={btn} title="Zoom Out" data-testid="org-zoom-out" onClick={() => setZoom(z => Math.max(0.25, Math.round((z - 0.1) * 100) / 100))}><ZoomOut size={15} /></button>
                <button className={btn} title="Zoom In" data-testid="org-zoom-in" onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 100) / 100))}><ZoomIn size={15} /></button>
                <button className={btn} title="Fit to Screen" data-testid="org-fit" onClick={fit}><Maximize2 size={14} /></button>
                <button className={btn} title="Actual size (100%)" onClick={() => { setZoom(1); centre(); }}><RotateCcw size={14} /></button>
            </div>
            <div ref={outer} data-testid="org-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={stop} onPointerLeave={stop} onWheel={userMoved} onTouchStart={userMoved}
                className="overflow-auto h-[72vh] min-h-[460px] cursor-grab active:cursor-grabbing custom-scrollbar select-none">
                <div style={{ width: Math.max(size.w * zoom, 1), height: Math.max(size.h * zoom, 1) }} className="relative mx-auto">
                    <div ref={inner} className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${zoom})`, width: "max-content" }}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}