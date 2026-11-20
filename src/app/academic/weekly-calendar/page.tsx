"use client";

import { dmy as toDmy, dmyTime as toDmyTime } from "@/lib/date-display";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { CalendarDays, Calendar, ArrowLeft, ArrowRight, RefreshCw, X, Filter, LayoutGrid, List, ExternalLink, AlertTriangle, Building2, Network, ChevronDown, Users, BookOpen, GraduationCap, GitBranch, Layers, SlidersHorizontal, RotateCcw, Download, FileSpreadsheet, FileText, Loader2, Coffee, Clock, FlaskConical, ImageDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";
import { CALENDAR_ROLES, PROFESSOR_ROLES, PLAN_STATUS_LABEL, PROFESSOR_EDITABLE_CLASS_STATUSES, CLASS_STATUS_LABEL, CLASS_STATUS_STYLE } from "@/lib/academic-status";
import { ClassStatusBadge, ClassRecordActions } from "@/components/academic/ClassRecordDetails";

/**
 * Weekly Calendar (Modules 21–23) — generated from submitted / locked sprint plans.
 * The server decides which colleges and professors are visible; the filters here only narrow that list.
 */
const DAYS = [
    { code: "MON", name: "Monday" }, { code: "TUE", name: "Tuesday" }, { code: "WED", name: "Wednesday" },
    { code: "THU", name: "Thursday" }, { code: "FRI", name: "Friday" }, { code: "SAT", name: "Saturday" },
];
/** Timetable card colours (hex, inline styles): one per professor / subject; no yellow (that means "pending") */
const CARD_COLORS = ["#38bdf8", "#f472b6", "#34d399", "#a78bfa", "#22d3ee", "#fb923c", "#818cf8", "#a3e635", "#fb7185", "#2dd4bf"];
/** Campus accent colours (only for the campus chips / section frames — the timetable keeps its own palette) */
const CAMPUS_ACCENTS = [
    { text: "text-sky-300", border: "border-sky-500/40", headBg: "bg-sky-500/[0.07]", iconBg: "bg-sky-500/15", pill: "border-sky-500/30 bg-sky-500/10 text-sky-200", btn: "border-sky-500/40 text-sky-200 bg-sky-500/10", chipActive: "bg-sky-500/20 border-sky-400/60 text-sky-100", chipIdle: "bg-zinc-900 border-zinc-800 text-sky-300 hover:border-sky-500/50" },
    { text: "text-violet-300", border: "border-violet-500/40", headBg: "bg-violet-500/[0.07]", iconBg: "bg-violet-500/15", pill: "border-violet-500/30 bg-violet-500/10 text-violet-200", btn: "border-violet-500/40 text-violet-200 bg-violet-500/10", chipActive: "bg-violet-500/20 border-violet-400/60 text-violet-100", chipIdle: "bg-zinc-900 border-zinc-800 text-violet-300 hover:border-violet-500/50" },
    { text: "text-amber-300", border: "border-amber-500/40", headBg: "bg-amber-500/[0.07]", iconBg: "bg-amber-500/15", pill: "border-amber-500/30 bg-amber-500/10 text-amber-200", btn: "border-amber-500/40 text-amber-200 bg-amber-500/10", chipActive: "bg-amber-500/20 border-amber-400/60 text-amber-100", chipIdle: "bg-zinc-900 border-zinc-800 text-amber-300 hover:border-amber-500/50" },
    { text: "text-pink-300", border: "border-pink-500/40", headBg: "bg-pink-500/[0.07]", iconBg: "bg-pink-500/15", pill: "border-pink-500/30 bg-pink-500/10 text-pink-200", btn: "border-pink-500/40 text-pink-200 bg-pink-500/10", chipActive: "bg-pink-500/20 border-pink-400/60 text-pink-100", chipIdle: "bg-zinc-900 border-zinc-800 text-pink-300 hover:border-pink-500/50" },
    { text: "text-teal-300", border: "border-teal-500/40", headBg: "bg-teal-500/[0.07]", iconBg: "bg-teal-500/15", pill: "border-teal-500/30 bg-teal-500/10 text-teal-200", btn: "border-teal-500/40 text-teal-200 bg-teal-500/10", chipActive: "bg-teal-500/20 border-teal-400/60 text-teal-100", chipIdle: "bg-zinc-900 border-zinc-800 text-teal-300 hover:border-teal-500/50" },
];
/** Branch filter can hold several branches: "All" or the names joined with this separator */
const BR_SEP = "\u0001";
const branchList = (v?: string) => (!v || v === "All" ? [] : v.split(BR_SEP).filter(Boolean));
const EMPTY_FILTERS: Record<string, string> = { day: "All", subject: "All", className: "All", section: "All", branch: "All", year: "All", semester: "All" };
/** Monday (YYYY-MM-DD) of the week that contains ymd */
const mondayStr = (ymd: string) => { const d = new Date(ymd + "T00:00:00Z"); const dow = d.getUTCDay(); d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); return d.toISOString().slice(0, 10); };
// College classes run in the day: a time written as 1:00–6:59 (no AM/PM, e.g. "1:05") is an afternoon time
const toMin = (t?: string) => { if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return 0; const [h, m] = t.split(":").map(Number); return (h >= 1 && h <= 6 ? h + 12 : h) * 60 + m; };
const istToday = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const shiftWeek = (ymd: string, weeks: number) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + weeks * 7); return d.toISOString().slice(0, 10); };
const dmy = (s: string) => toDmy(s);
/** "2026-11-09" → "09 Nov 2026" */
const shortDmy = (s: string) => (s ? toDmy(s) : "");
/** View modes (HOI / OM / AD / Founder / CL / CH): the selected college(s) as one timetable, one per year or one per semester */
type ViewMode = "full" | "year" | "sem";
/** roles that see the "Campus not assigned" group (professors whose college HR has not set) */
const UNASSIGNED_ROLES = ["AD", "CURRICULUM_LEAD", "CURRICULUM_HEAD", "FOUNDER"];
const VIEW_MODES: { key: ViewMode; label: string }[] = [{ key: "full", label: "Full College" }, { key: "year", label: "Year-Wise" }, { key: "sem", label: "Semester-Wise" }];
/** first number in a value ("2nd Year" → 2, "Semester 3" → 3); no number → after the numbered ones */
const ordNum = (v: string) => { const m = String(v || "").match(/\d+/); return m ? Number(m[0]) : 999; };
const yearOf = (c: any) => String(c.year || "").trim();
const semOf = (c: any) => String(c.semester || "").trim();
/** download: what the timetable heading already shows, so the class boxes leave it out */
type SheetHide = { year?: boolean; sem?: boolean; branch?: boolean };
/** download heading: year / semester / branch of a timetable, each shown as a coloured pill */
type SheetTag = { kind: "year" | "sem" | "branch"; text: string };
const TAG_STYLE: Record<SheetTag["kind"], { bg: string; line: string; color: string }> = {
    year: { bg: "#fef3c7", line: "#f59e0b", color: "#92400e" },
    sem: { bg: "#dbeafe", line: "#3b82f6", color: "#1e3a8a" },
    branch: { bg: "#ede9fe", line: "#8b5cf6", color: "#4c1d95" },
};
const semText = (v: string) => (/^\d+$/.test(v) ? `Semester ${v}` : v);
/** Groups of classes by the year / semester stored on the sprint plan entries (no guessing; missing → "… not set") */
const branchOf = (c: any) => String(c.branch || "").trim();
/** byBranch (Branch-Wise button): each year / semester table is split once more by branch (Full College: one table per branch) */
const groupClasses = (list: any[], mode: ViewMode, byBranch = false): { key: string; label: string; tags: SheetTag[]; list: any[] }[] => {
    if (mode === "full" && !byBranch) return [{ key: "all", label: "", tags: [], list }];
    const map = new Map<string, { key: string; label: string; tags: SheetTag[]; y: string; s: string; br: string; list: any[] }>();
    for (const c of list) {
        const y = yearOf(c), sm = semOf(c), br = byBranch ? branchOf(c) : "";
        const base = mode === "full" ? "" : mode === "year" ? y.toLowerCase() : `${y.toLowerCase()}||${sm.toLowerCase()}`;
        const key = byBranch ? `${base}##${br.toLowerCase()}` : base;
        const baseLabel = mode === "full" ? "" : mode === "year" ? (y || "Year not set") : [y, sm ? semText(sm) : "Semester not set"].filter(Boolean).join(" / ");
        const label = byBranch ? [baseLabel, br || "Branch not set"].filter(Boolean).join(" / ") : baseLabel;
        const tags: SheetTag[] = [
            ...(mode === "year" ? [{ kind: "year" as const, text: y || "Year not set" }] : []),
            ...(mode === "sem" ? [...(y ? [{ kind: "year" as const, text: y }] : []), { kind: "sem" as const, text: sm ? semText(sm) : "Semester not set" }] : []),
            ...(byBranch ? [{ kind: "branch" as const, text: br || "Branch not set" }] : []),
        ];
        if (!map.has(key)) map.set(key, { key, label, tags, y, s: sm, br, list: [] });
        map.get(key)!.list.push(c);
    }
    return Array.from(map.values()).sort((a, b) =>
        (mode === "full" ? 0 : ordNum(a.y) - ordNum(b.y) || a.y.localeCompare(b.y)) || (mode === "sem" ? ordNum(a.s) - ordNum(b.s) || a.s.localeCompare(b.s) : 0)
        || (byBranch ? Number(!a.br) - Number(!b.br) || a.br.localeCompare(b.br) : 0));
};
/**
 * Logo on the downloaded timetable (image / PDF). Put your own logo file at  public/calendar-logo.png  (PNG or JPG
 * renamed to .png) — it is used first. Without it, the sidebar logo is used; if that cannot load, "Geeks of Gurukul" text.
 */
const CALENDAR_LOGO_URLS = ["/calendar-logo.png", "https://i.ibb.co/qYQkmMDR/unnamed-1.png"];
/** Download sheet colours: 12 clearly different light fills (+ strong edge), one per professor in that timetable */
const SHEET_COLORS = [
    { fill: "#fbcfe8", line: "#db2777" }, { fill: "#fde68a", line: "#d97706" }, { fill: "#bae6fd", line: "#0284c7" },
    { fill: "#bbf7d0", line: "#16a34a" }, { fill: "#ddd6fe", line: "#7c3aed" }, { fill: "#fed7aa", line: "#ea580c" },
    { fill: "#99f6e4", line: "#0d9488" }, { fill: "#fecaca", line: "#dc2626" }, { fill: "#d9f99d", line: "#65a30d" },
    { fill: "#c7d2fe", line: "#4f46e5" }, { fill: "#a5f3fc", line: "#0891b2" }, { fill: "#f5d0fe", line: "#c026d3" },
];
/** colour of the i-th professor: the 12 colours above first, then new distinct colours (golden-angle hues) — never two professors alike */
const hslHex = (h: number, sat: number, l: number) => {
    const a = (sat / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n: number) => { const k = (n + h / 30) % 12; const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); };
    return `#${f(0)}${f(8)}${f(4)}`;
};
const profPalette = (i: number) => {
    if (i < SHEET_COLORS.length) return SHEET_COLORS[i];
    const h = (i * 137.508 + 15) % 360;
    return { fill: hslHex(h, 80, 86), line: hslHex(h, 70, 42) };
};
const safeFile = (v: string) => String(v || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export default function WeeklyCalendarPage() {
    const { user } = useAuth();
    const role = user?.role || "";
    const isProf = PROFESSOR_ROLES.includes(role);
    const [view, setView] = useState<"mine" | "college">(isProf ? "mine" : "college");
    const [week, setWeek] = useState(istToday());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [college, setCollege] = useState("All");
    const [facultyId, setFacultyId] = useState("All");
    const [filters, setFilters] = useState<Record<string, string>>({ ...EMPTY_FILTERS });
    const [draft, setDraft] = useState<Record<string, string>>({ ...EMPTY_FILTERS });
    const [draftFaculty, setDraftFaculty] = useState("All");
    const [layout, setLayout] = useState<"grid" | "list">("grid");
    const [selected, setSelected] = useState<any | null>(null);
    const [notice, setNotice] = useState("");
    const [dlOpen, setDlOpen] = useState(false);
    // Filter panel: one line; the dropdowns open below it with the "Filters" button
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [branchOpen, setBranchOpen] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [mode, setMode] = useState<ViewMode>("full");
    // Branch-Wise: on / off next to the View Mode (works with Full College, Year-Wise and Semester-Wise)
    const [byBranch, setByBranch] = useState(false);
    const [imgBusy, setImgBusy] = useState("");          // file name of the image being created
    const [exportMsg, setExportMsg] = useState("");      // progress of "Download Complete Calendar"
    const [sheet, setSheet] = useState<{ id: string; college: string; sub: string; list: any[]; logo: string | null; hide?: SheetHide; tags?: SheetTag[] } | null>(null);   // image / PDF page being drawn
    const logoRef = useRef<string | null | undefined>(undefined);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const [closedTables, setClosedTables] = useState<Record<string, boolean>>({});   // collapsed timetables (by image file name)

    useEffect(() => {
        const w = new URLSearchParams(window.location.search).get("week");
        if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) setWeek(w);
    }, []);
    useEffect(() => { setView(isProf ? "mine" : "college"); }, [isProf]);

    const latestRequest = useRef(0);
    const load = async () => {
        const requestNo = ++latestRequest.current;
        setLoading(true); setError("");
        try {
            const q = new URLSearchParams({ week, view, college, facultyId });
            const res = await fetch(`/api/academic/weekly-calendar?${q}`);
            const d = await res.json();
            if (requestNo !== latestRequest.current) return;
            if (!res.ok) throw new Error(d.error || "Could not load the calendar");
            setData(d);
        } catch (e: any) {
            setError(e.message);
        } finally {
            if (requestNo === latestRequest.current) setLoading(false);
        }
    };
    useEffect(() => { if (user) load(); }, [user, week, view, college, facultyId]);

    const classes: any[] = data?.classes || [];
    // one fixed colour per professor (same in every timetable, week, on screen and in downloads): order of professor id
    const profOrder = useMemo(() => {
        const ids = Array.from(new Set([...(data?.professors || []).map((p: any) => String(p.id)), ...(data?.classes || []).map((c: any) => String(c.facultyId))]))
            .filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return new Map(ids.map((id, i) => [id, i]));
    }, [data]);
    const profColor = (id: any) => profPalette(profOrder.get(String(id)) ?? 0);
    const options = useMemo(() => {
        const uniq = (k: string) => Array.from(new Set(classes.map(c => c[k]).filter(Boolean))).sort() as string[];
        return { subject: uniq("subjectName"), className: uniq("className"), section: uniq("section"), branch: uniq("branch"), year: uniq("year"), semester: uniq("semester") };
    }, [classes]);

    const shown = useMemo(() => classes.filter(c =>
        (filters.day === "All" || c.day === filters.day || DAYS[new Date(c.date + "T00:00:00Z").getUTCDay() - 1]?.code === filters.day) &&
        (filters.subject === "All" || c.subjectName === filters.subject) &&
        (filters.className === "All" || c.className === filters.className) &&
        (filters.section === "All" || c.section === filters.section) &&
        (filters.branch === "All" || branchList(filters.branch).includes(c.branch)) &&
        (filters.year === "All" || c.year === filters.year) &&
        (filters.semester === "All" || c.semester === filters.semester)
    ), [classes, filters]);

    // Same colour per professor across the grid (Sprint Plan timetable palette)
    /** "13:05" → "1:05 PM" */
    const t12 = (s?: string) => { if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return s || ""; const m = toMin(s); const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
    const legend = useMemo(() => {
        const seen = new Map<string, string>();
        shown.forEach(c => { if (!seen.has(c.facultyId)) seen.set(c.facultyId, c.facultyName); });
        return Array.from(seen, ([id, name]) => ({ id, name }));
    }, [shown]);
    const [campus, setCampus] = useState<string>("ALL");

    const dates = useMemo(() => {
        if (!data?.weekStart) return [];
        return DAYS.map((d, i) => { const x = new Date(data.weekStart + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + i); return { ...d, date: x.toISOString().slice(0, 10) }; });
    }, [data?.weekStart]);

    // Rows follow the real class times (every start / end time of the shown classes) — no fixed slots.
    // Classes that overlap on a day share one cell; the cell spans from the earliest start to the latest end,
    // so a class is never split over several rows. Classes with an invalid time go to an "Other times" row.
    type GridCell = { span: number; items: any[] } | "covered";
    const rowsFor = (list: any[]) => {
        const hm = (m: number) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
        const sortByTime = (l: any[]) => [...l].sort((x, y) => toMin(x.timeStart) - toMin(y.timeStart));
        const valid = list.filter(c => toMin(c.timeStop) > toMin(c.timeStart));
        const invalid = list.filter(c => !(toMin(c.timeStop) > toMin(c.timeStart)));
        const b = Array.from(new Set(valid.flatMap(c => [toMin(c.timeStart), toMin(c.timeStop)]))).sort((x, y) => x - y);
        const rows: { label: string; isLunch?: boolean; other?: boolean; classesFor: (date: string) => any[] }[] =
            b.slice(0, -1).map((m, i) => ({ label: `${hm(m)} – ${hm(b[i + 1])}`, classesFor: () => [] }));
        const cells = new Map<string, Map<number, GridCell>>();
        for (const d of dates) {
            const m = new Map<number, GridCell>();
            let open: { row: number; end: number; cell: { span: number; items: any[] } } | null = null;
            for (const c of sortByTime(valid.filter(x => x.date === d.date))) {
                if (open && toMin(c.timeStart) < open.end) {
                    open.cell.items.push(c);
                    open.end = Math.max(open.end, toMin(c.timeStop));
                    open.cell.span = b.indexOf(open.end) - open.row;
                    continue;
                }
                const r0 = b.indexOf(toMin(c.timeStart));
                const cell = { span: b.indexOf(toMin(c.timeStop)) - r0, items: [c] };
                m.set(r0, cell);
                open = { row: r0, end: toMin(c.timeStop), cell };
            }
            for (const [r, cell] of Array.from(m)) if (cell !== "covered") for (let k = 1; k < cell.span; k++) m.set(r + k, "covered");
            cells.set(d.date, m);
        }
        if (invalid.length) rows.push({ label: "Other times", other: true, classesFor: (date: string) => sortByTime(invalid.filter(c => c.date === date)) });
        /** the cell that starts at this row (null = free, "covered" = part of a class above) */
        const cellAt = (rowIdx: number, date: string): GridCell | null => {
            const row = rows[rowIdx];
            if (row?.other) { const items = row.classesFor(date); return items.length ? { span: 1, items } : null; }
            return cells.get(date)?.get(rowIdx) ?? null;
        };
        return { rows, cellAt };
    };

    // ── Campuses (from the server's college scope) ──
    const campusList: { id: string; name: string; keys: string[] }[] = useMemo(() => {
        const list = (data?.colleges || []).map((c: any) => ({ id: String(c.id), name: String(c.name || c.id), keys: (c.keys || [c.id, c.name]).map(String) }));
        // classes whose college is not in the list (legacy location values) get their own group
        classes.forEach(c => {
            const v = String(c.college || "");
            if (v && !list.some((x: any) => x.keys.includes(v))) list.push({ id: v, name: v, keys: [v] });
        });
        // professors whose campus HR has not set yet → "Campus not assigned" (only AD, CL, CH and Founder see it; HOI / OM … see their own colleges)
        if (UNASSIGNED_ROLES.includes(role) && (classes.some(c => !c.college) || (data?.professors || []).some((p: any) => !p.location))) {
            list.push({ id: "__none__", name: "Campus not assigned", keys: [""] });
        }
        return list;
    }, [data?.colleges, classes, role]);
    // HOI / OM … with exactly one college: that college is selected automatically
    useEffect(() => {
        if (isProf || campus !== "ALL" || campusList.length !== 1 || campusList[0].id === "__none__") return;
        setCampus(campusList[0].id);
    }, [isProf, campusList, campus]);
    const campusOf = (c: any) => campusList.find(x => x.keys.includes(String(c.college || "")))?.id || String(c.college || "");
    const campusName = (id: string) => campusList.find(x => x.id === id)?.name || id;
    const multiCampusView = view === "college";
    const shownCampus = useMemo(() => campus === "ALL" ? shown : shown.filter(c => campusOf(c) === campus), [shown, campus, campusList]);

    const today = istToday();
    const collegeTitle = (data?.colleges || []).length === 1 ? data.colleges[0].name
        : college !== "All" ? ((data?.colleges || []).find((c: any) => c.id === college)?.name || college) : (data?.orgWide ? "All Colleges" : "Your College");

    if (!user) return null;
    if (!CALENDAR_ROLES.includes(role)) return <div className="flex items-center justify-center h-[80vh] text-zinc-400">The weekly calendar is not available for your role.</div>;

    const showProfessor = view === "college";
    // Filters are picked in a draft and applied with "Apply Filters"
    const fieldCls = "w-full pl-8 pr-2 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-indigo-500/50 truncate";
    const field = (label: string, Icon: any, el: React.ReactNode) => (
        <div key={label} className="min-w-0">
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">{label}</p>
            <div className="relative"><Icon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-300/80 pointer-events-none" />{el}</div>
        </div>
    );
    const sel = (key: string, label: string, Icon: any, opts: string[]) => field(label, Icon, (
        <select value={draft[key]} onChange={e => setDraft(f => ({ ...f, [key]: e.target.value }))} className={fieldCls}>
            <option value="All">All</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    ));
    // Branch: several can be picked; the list shows the branches of the chosen Year (and Semester)
    const branchOpts = Array.from(new Set(classes.filter(c => (draft.year === "All" || c.year === draft.year) && (draft.semester === "All" || c.semester === draft.semester)).map(c => c.branch).filter(Boolean))).sort() as string[];
    const draftBranches = branchList(draft.branch);
    const setDraftBranches = (list: string[]) => setDraft(f => ({ ...f, branch: list.length ? list.join(BR_SEP) : "All" }));
    // a Year / Semester change drops the picked branches that are not in that year / semester
    const pickYearSem = (key: "year" | "semester", v: string) => setDraft(f => {
        const nf = { ...f, [key]: v };
        const ok = new Set(classes.filter(c => (nf.year === "All" || c.year === nf.year) && (nf.semester === "All" || c.semester === nf.semester)).map(c => c.branch));
        const keep = branchList(nf.branch).filter(b => ok.has(b));
        return { ...nf, branch: keep.length ? keep.join(BR_SEP) : "All" };
    });
    const branchText = (list: string[]) => (!list.length ? "All" : list.length <= 2 ? list.join(", ") : `${list.length} branches`);
    const branchField = field("Branch", GitBranch, (
        <div className="relative" data-testid="filter-branch">
            <button type="button" onClick={() => setBranchOpen(o => !o)} data-testid="branch-button" aria-expanded={branchOpen}
                className={`${fieldCls} text-left flex items-center justify-between gap-1`}>
                <span className="truncate flex-1 text-left">{branchText(draftBranches)}</span><ChevronDown size={13} className={`shrink-0 text-zinc-400 transition-transform ${branchOpen ? "rotate-180" : ""}`} />
            </button>
            {branchOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setBranchOpen(false)} />
                    <div className="absolute left-0 mt-1 z-40 w-64 max-w-[80vw] max-h-72 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1.5" data-testid="branch-menu">
                        <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer text-xs font-bold text-white">
                            <input type="checkbox" checked={!draftBranches.length} onChange={() => setDraftBranches([])} className="accent-indigo-500" data-testid="branch-all" /> All branches
                        </label>
                        {branchOpts.length === 0 && <p className="px-2.5 py-2 text-[11px] text-zinc-500">No branch in this year / semester</p>}
                        {branchOpts.map(b => (
                            <label key={b} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer text-xs text-zinc-200">
                                <input type="checkbox" checked={draftBranches.includes(b)} data-testid="branch-option" data-branch={b}
                                    onChange={e => setDraftBranches(e.target.checked ? [...draftBranches, b] : draftBranches.filter(x => x !== b))} className="accent-indigo-500" />
                                <span className="[overflow-wrap:anywhere]">{b}</span>
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    ));
    const pendingChanges = JSON.stringify(draft) !== JSON.stringify(filters) || draftFaculty !== facultyId;
    const applyFilters = () => { setFilters(draft); setFacultyId(draftFaculty); setBranchOpen(false); setFiltersOpen(false); };
    const resetFilters = () => { const d = { ...EMPTY_FILTERS }; setDraft(d); setFilters(d); setDraftFaculty("All"); setFacultyId("All"); };
    // how many filters are on (shown on the Filters button)
    const activeFilters = Object.keys(EMPTY_FILTERS).filter(k => filters[k] !== "All").length + (facultyId !== "All" ? 1 : 0);
    const weekPreset = !data ? "this" : data.weekStart === mondayStr(istToday()) ? "this" : data.weekStart === mondayStr(shiftWeek(istToday(), -1)) ? "last" : data.weekStart === mondayStr(shiftWeek(istToday(), 1)) ? "next" : "other";
    const downloadReport = () => {
        const list = shownCampus;
        if (!list.length) { setNotice("No classes to download for these filters."); setTimeout(() => setNotice(""), 3000); return; }
        const rows = list.map(c => ({
            Campus: campusName(campusOf(c)), Date: dmy(c.date), Day: c.day, Time: `${c.timeStart} - ${c.timeStop}`,
            Professor: c.facultyName, Subject: c.subjectName, Topic: c.topics || "", "Lecture Type": c.lectureType || "", Unit: c.unitNumber || "",
            Class: c.className || "", Section: c.section || "", Branch: c.branch || "", Year: c.year || "", Semester: c.semester || "",
            "Sprint Plan": PLAN_STATUS_LABEL[c.planStatus] || c.planStatus || "", "Class Record": CLASS_STATUS_LABEL[c.recordStatus] || c.recordStatus || "", Attendance: c.attendance || "",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map((r: any) => String(r[k] ?? "").length)) + 2 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Weekly Calendar");
        XLSX.writeFile(wb, `Weekly_Calendar_${campus === "ALL" ? "All_Campuses" : campusName(campus).replace(/\s+/g, "_")}_${data?.weekStart}.xlsx`);
    };

    /** Colourful PDF of the calendar (same professor colours as the timetable) — one landscape page per campus */
    // ── Downloads (image + PDF): one printable timetable "sheet" — white page, landscape, colourful, GoG logo ──
    // every calendar role (HOI, OM, AD, Founder, CL / CH and Professors) gets the view modes and the downloads;
    // a professor's "My Schedule" is one group of its own (their own classes), the college view works as for HOI / OM
    const canGroup = true;
    const MINE = "__mine__";
    const campusesInView: { id: string; name: string; keys: string[] }[] = view === "mine"
        ? [{ id: MINE, name: `My Weekly Schedule — ${user.name}`, keys: [] }]
        : campus === "ALL" ? campusList : campusList.filter(x => x.id === campus);
    const classesOf = (cpId: string) => (cpId === MINE ? shown : shown.filter(c => campusOf(c) === cpId));
    const singleSection = view === "mine" || campus !== "ALL";
    const weekText = data?.weekStart && data?.weekEnd ? `${dmy(data.weekStart)} to ${dmy(data.weekEnd)}` : "";
    const modeTitle = (mode === "year" ? "Year-Wise" : mode === "sem" ? "Semester-Wise" : "Full College") + (byBranch ? " + Branch-Wise" : "");
    /** short college name for file names: the location's short name, else the initials ("Sage University Bhopal" → SUB) */
    const collegeShort = (id: string) => {
        if (id === MINE) return `${safeFile(user.name)}_My_Schedule`;
        const cp = campusList.find(x => x.id === id);
        if (!cp) return safeFile(id);
        const k = cp.keys.find(x => x && x !== cp.id && x !== cp.name && x.length <= 12);
        return safeFile(k || cp.name.split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase() || cp.name);
    };
    const imageFile = (campusId: string, label: string) => `${collegeShort(campusId)}_${safeFile(label || "Full_College")}_Weekly_Calendar.png`;

    /** the GoG logo as a data URL (needed inside the image); null → the "Geeks of Gurukul" wordmark is drawn instead */
    const loadLogo = async () => {
        // read again on every download, so a newly added / changed logo file is used at once (no page refresh needed)
        logoRef.current = null;
        for (const src of CALENDAR_LOGO_URLS) {
            try {
                const r = await fetch(src, { mode: "cors", cache: "no-cache" });
                if (!r.ok || !String(r.headers.get("content-type") || "").startsWith("image/")) continue;
                const blob = await r.blob();
                logoRef.current = await new Promise<string>((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = bad; fr.readAsDataURL(blob); });
                break;
            } catch { /* next */ }
        }
        return logoRef.current;
    };
    /** draw one sheet off screen and turn it into a PNG (landscape, A4 ratio) */
    const sheetToPng = async (spec: { college: string; sub: string; list: any[]; hide?: SheetHide; tags?: SheetTag[] }) => {
        const logo = await loadLogo();
        const id = `${Date.now()}-${Math.random()}`;
        setSheet({ ...spec, id, logo });
        let el: HTMLDivElement | null = null;
        for (let i = 0; i < 80; i++) { el = sheetRef.current; if (el && el.dataset.sheetId === id) break; await new Promise(r => setTimeout(r, 25)); }
        if (!el || el.dataset.sheetId !== id) throw new Error("sheet not ready");
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const base = Number(el.dataset.baseWidth) || 1600;
        el.style.width = `${base}px`; el.style.minHeight = "0px";
        if (el.scrollHeight > base / 1.414) el.style.width = `${Math.min(4800, Math.max(base, Math.ceil(el.scrollHeight * 1.25)))}px`;
        const W = el.scrollWidth;
        el.style.minHeight = `${Math.ceil(W / 1.414)}px`;
        const H = el.scrollHeight;
        const { toPng } = await import("html-to-image");
        const opts: any = { width: W, height: H, pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true };
        let url = "";
        try { url = await toPng(el, opts); } catch { url = await toPng(el, { ...opts, skipFonts: true }); }
        if (!url || url.length < 100) throw new Error("empty image");
        return { url, W, H };
    };
    /** several sheets → one landscape A4 PDF (one page per sheet) */
    const sheetsToPdf = async (specs: { college: string; sub: string; list: any[]; hide?: SheetHide; tags?: SheetTag[] }[], fileName: string, progress = false) => {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
        for (let i = 0; i < specs.length; i++) {
            if (progress) setExportMsg(`Creating PDF… ${i + 1} of ${specs.length}`);
            const img = await sheetToPng(specs[i]);
            if (i > 0) doc.addPage();
            const k = Math.min(PW / img.W, PH / img.H);
            doc.addImage(img.url, "PNG", (PW - img.W * k) / 2, (PH - img.H * k) / 2, img.W * k, img.H * k, undefined, "FAST");
        }
        doc.save(fileName);
    };

    const downloadPdf = async () => {
        setDlOpen(false);
        const sections = multiCampusView && campus === "ALL"
            ? campusList.map(cp => ({ college: cp.name, sub: "Full College • Weekly Timetable", list: shown.filter(c => campusOf(c) === cp.id) })).filter(x => x.list.length)
            : [{ college: view === "mine" ? `My Weekly Schedule — ${user.name}` : (multiCampusView && campus !== "ALL" ? campusName(campus) : collegeTitle), sub: view === "mine" ? "My Classes • Weekly Timetable" : "Full College • Weekly Timetable", list: shownCampus }];
        if (!sections.length || !sections.some(x => x.list.length)) { setNotice("No classes to download for these filters."); setTimeout(() => setNotice(""), 3000); return; }
        setPdfBusy(true);
        try {
            await sheetsToPdf(sections.filter(x => x.list.length), `Weekly_Calendar_${campus === "ALL" || !multiCampusView ? (multiCampusView ? "All_Campuses" : "My_Schedule") : campusName(campus).replace(/\s+/g, "_")}_${data?.weekStart}.pdf`);
        } catch (e: any) {
            console.error("[weekly-calendar] pdf failed", e);
            setNotice(`Could not create the PDF: ${e.message}`); setTimeout(() => setNotice(""), 4000);
        } finally {
            setSheet(null); setPdfBusy(false);
        }
    };

    /** a year / semester / branch timetable already names them in its heading → its class boxes leave them out */
    const sheetHide = (label?: string): SheetHide => (label ? { year: mode !== "full", sem: mode === "sem", branch: byBranch } : {});
    /** Download Image of one timetable */
    const downloadImage = async (file: string, list: any[], college: string, sub: string, hide?: SheetHide, tags?: SheetTag[]) => {
        if (imgBusy || pdfBusy || !list.length) return;
        setImgBusy(file);
        try {
            const img = await sheetToPng({ college, sub, list, hide, tags });
            const a = document.createElement("a"); a.href = img.url; a.download = file; a.click();
        } catch (e: any) {
            console.error("[weekly-calendar] image failed", e);
            setNotice("Could not create the image. Please try again."); setTimeout(() => setNotice(""), 4000);
        } finally {
            setSheet(null); setImgBusy("");
        }
    };
    const imageButton = (file: string, list: any[], college: string, sub: string, hide?: SheetHide, tags?: SheetTag[]) => (
        <button type="button" data-export-hide="1" data-testid="download-image" data-file={file} disabled={!!imgBusy || pdfBusy}
            onClick={() => downloadImage(file, list, college, sub, hide, tags)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[11px] font-black hover:bg-emerald-500/20 disabled:opacity-60">
            {imgBusy === file ? <Loader2 size={13} className="animate-spin" /> : <ImageDown size={13} />} {imgBusy === file ? "Preparing…" : "Download Image"}
        </button>
    );
    /** "Download Complete Calendar": the selected college(s), week and view mode → one PDF, one page per timetable */
    const downloadComplete = async () => {
        const specs: { college: string; sub: string; list: any[]; hide?: SheetHide; tags?: SheetTag[] }[] = [];
        for (const cp of campusesInView) {
            const list = classesOf(cp.id);
            if (!list.length) continue;
            for (const g of groupClasses(list, mode, byBranch)) specs.push({ college: cp.name, sub: `${modeTitle} • ${g.label || "Weekly Timetable"}`, list: g.list, hide: sheetHide(g.label), tags: g.tags });
        }
        if (!specs.length) { setNotice("No classes to download for this college and week."); setTimeout(() => setNotice(""), 3000); return; }
        setPdfBusy(true); setExportMsg("Creating PDF…");
        try {
            const where = view === "mine" ? collegeShort(MINE) : campus === "ALL" ? (campusesInView.length === 1 ? collegeShort(campusesInView[0].id) : "All_Colleges") : collegeShort(campus);
            await sheetsToPdf(specs, `${where}_${safeFile(modeTitle)}_Weekly_Calendar_${data?.weekStart}.pdf`, true);
        } catch (e: any) {
            console.error("[weekly-calendar] pdf failed", e);
            setNotice(`Could not create the PDF: ${e.message}`); setTimeout(() => setNotice(""), 4000);
        } finally { setSheet(null); setPdfBusy(false); setExportMsg(""); }
    };

    /** the printable sheet (white page; each class from its start time to its end time; same start = one below the other; empty periods = "Academic Lecture") */
    const renderSheet = () => {
        if (!sheet || !data) return null;
        const list = sheet.list;
        // Download layout: each class starts in the row of ITS OWN start time and its box reaches down to its end time.
        // Classes with the same start time are one box (one below the other); classes that overlap but start at different
        // times sit side by side in that day (the day column is split only where needed). No running class → "Academic Lecture".
        const validList = list.filter(c => toMin(c.timeStop) > toMin(c.timeStart));
        const invalid = list.filter(c => !(toMin(c.timeStop) > toMin(c.timeStart)));
        const bounds = Array.from(new Set(validList.flatMap(c => [toMin(c.timeStart), toMin(c.timeStop)]))).sort((x, y) => x - y);
        const sheetRows: { from: number; to: number; other?: boolean }[] = [
            ...bounds.slice(0, -1).map((m, i) => ({ from: m, to: bounds[i + 1] })),
            ...(invalid.length ? [{ from: -1, to: -1, other: true }] : []),
        ];
        const hmLabel = (m: number) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
        type SheetGroup = { start: number; end: number; items: any[]; lane: number };
        const lanes = dates.map(d => {
            const byStart = new Map<number, SheetGroup>();
            for (const c of validList.filter(x => x.date === d.date)) {
                const st = toMin(c.timeStart), en = toMin(c.timeStop);
                const g = byStart.get(st) || { start: st, end: en, items: [], lane: 0 };
                g.items.push(c); g.end = Math.max(g.end, en); byStart.set(st, g);
            }
            const groups = Array.from(byStart.values()).sort((a, b) => a.start - b.start);
            groups.forEach(g => g.items.sort((x, y) => toMin(x.timeStop) - toMin(y.timeStop) || String(x.subjectName || "").localeCompare(String(y.subjectName || ""))));
            const laneEnd: number[] = [];
            for (const g of groups) {
                let k = laneEnd.findIndex(e => e <= g.start);
                if (k < 0) { k = laneEnd.length; laneEnd.push(0); }
                g.lane = k; laneEnd[k] = g.end;
            }
            return { groups, count: Math.max(1, laneEnd.length) };
        });
        const freeStyle: React.CSSProperties = { textAlign: "center", color: "#9ca3af", fontSize: 13, fontWeight: 600, padding: "16px 0" };
        const profs = Array.from(new Map([...list].sort((x, y) => (x.date + x.timeStart).localeCompare(y.date + y.timeStart)).map(c => [String(c.facultyId), c.facultyName])).entries());
        // colour = professor: each professor keeps one fixed colour (profColor), the same in every timetable and on screen
        const pal = (id: string) => profColor(id);   // the professor's own colour (same as on screen)
        const GREEN = "#0b4a2e", LINE = "#d4d4d8";
        const extraLanes = lanes.reduce((n, l) => n + l.count - 1, 0);
        const baseWidth = 1600 + 230 * extraLanes;
        const shortDay = (ymd: string) => new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
        const gen = toDmyTime(new Date());
        const line = (Icon: any, text: React.ReactNode, bold = false) => (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 3, fontSize: 12, lineHeight: 1.3, color: bold ? "#18181b" : "#3f3f46", fontWeight: bold ? 800 : 600 }}>
                <Icon size={13} style={{ flexShrink: 0, marginTop: 1, color: "#3f3f46" }} /><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{text}</span>
            </div>
        );
        const sup = (v: string) => { const m = String(v || "").match(/^(\d+)(st|nd|rd|th)(.*)$/i); return m ? <>{m[1]}<sup style={{ fontSize: "0.7em" }}>{m[2]}</sup>{m[3]}</> : v; };
        const cards = (items: any[], filled = false) => (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 5, height: "100%" }}>
                                                            {items.map((c: any) => {
                                                                const p = pal(c.facultyId);
                                                                const lab = /lab|practical/i.test(`${c.lectureType || ""} ${c.subjectName || ""}`);
                                                                const strong = (v: React.ReactNode) => <b style={{ fontWeight: 900, color: "#18181b" }}>{v}</b>;   // year / semester stand out
                                                                const hd = sheet.hide || {};
                                                                const meta = [hd.branch && c.branch ? "" : (c.branch || c.className), c.year && !hd.year ? strong(sup(String(c.year))) : "", c.semester && !hd.sem ? strong(semText(String(c.semester))) : "", c.section ? `Sec ${c.section}` : ""].filter(Boolean);
                                                                return (
                                                                    <div key={c.id} data-testid="sheet-class" style={{ flex: "1 1 auto", background: filled ? "transparent" : p.fill, borderLeft: `5px solid ${filled ? "transparent" : p.line}`, borderRadius: 8, padding: "7px 8px", textAlign: "left" }}>
                                                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13.5, fontWeight: 900, color: "#18181b", lineHeight: 1.25 }}>
                                                                            {lab ? <FlaskConical size={15} style={{ flexShrink: 0, marginTop: 1, color: p.line }} /> : <BookOpen size={15} style={{ flexShrink: 0, marginTop: 1, color: p.line }} />}
                                                                            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{c.subjectName || c.topics || "Lecture"}{c.subjectCode ? <span style={{ fontWeight: 600 }}> ({c.subjectCode})</span> : null}</span>
                                                                        </div>
                                                                        {c.facultyName && line(Users, c.facultyName, true)}
                                                                        {meta.length > 0 && line(GraduationCap, meta.map((m, i) => <React.Fragment key={i}>{i > 0 ? " • " : ""}{m}</React.Fragment>))}
                                                                        {line(Clock, `${t12(c.timeStart)} – ${t12(c.timeStop)}${c.lectureType ? ` • ${c.lectureType}` : ""}`, true)}
                                                                        {(c.unitNumber || (c.topics && c.subjectName)) && line(Layers, [c.unitNumber ? `Unit ${c.unitNumber}` : "", c.topics && c.subjectName ? `Topic: ${c.topics}` : ""].filter(Boolean).join(" • "))}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
        );
        return (
            <div aria-hidden="true" style={{ position: "fixed", left: "-100000px", top: 0, pointerEvents: "none" }}>
                <div ref={sheetRef} data-sheet-id={sheet.id} data-base-width={baseWidth} data-testid="image-sheet" style={{ width: baseWidth, background: "#ffffff", padding: 26, fontFamily: "Inter, 'Segoe UI', Arial, Helvetica, sans-serif", color: "#18181b", boxSizing: "border-box" }}>
                    {/* header: logo · Weekly Calendar | college (green band) · dates · classes */}
                    <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 22px", background: "#ffffff" }}>
                            {sheet.logo
                                ? <img src={sheet.logo} alt="Geeks of Gurukul" data-testid="sheet-logo" style={{ height: 50, width: "auto", objectFit: "contain" }} />
                                : <div data-testid="sheet-logo-text" style={{ lineHeight: 1 }}><div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", letterSpacing: 1 }}>— Geeks of —</div><div style={{ fontSize: 30, fontWeight: 900, color: "#166534" }}>Gurukul</div></div>}
                            <div style={{ width: 1, alignSelf: "stretch", background: LINE }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <CalendarDays size={28} style={{ color: "#27272a" }} />
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: "#18181b", lineHeight: 1.1 }}>Weekly Calendar</div>
                                    {sheet.tags?.length
                                        // year / semester / branch of this timetable → coloured pills
                                        ? <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5 }} data-testid="sheet-sub" data-text={sheet.sub}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "#52525b" }}>{sheet.sub.split(" • ")[0]}</span>
                                            {sheet.tags.map((t, i) => (
                                                <span key={i} data-testid={`sheet-tag-${t.kind}`} style={{ display: "inline-flex", alignItems: "center", padding: "3px 11px", borderRadius: 999, background: TAG_STYLE[t.kind].bg, border: `1.5px solid ${TAG_STYLE[t.kind].line}`, color: TAG_STYLE[t.kind].color, fontSize: 14, fontWeight: 900, lineHeight: 1.3 }}>{sup(t.text)}</span>
                                            ))}
                                        </div>
                                        : <div style={{ fontSize: 13, fontWeight: 600, color: "#52525b", marginTop: 3 }} data-testid="sheet-sub" data-text={sheet.sub}>{sheet.sub}</div>}
                                </div>
                            </div>
                        </div>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: GREEN, padding: "12px 22px 12px 48px", clipPath: "polygon(28px 0, 100% 0, 100% 100%, 0 100%)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                <Building2 size={28} style={{ color: "#ffffff", flexShrink: 0 }} />
                                <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", lineHeight: 1.15 }} data-testid="sheet-college">{sheet.college}</div>
                            </div>
                            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(255,255,255,.45)", borderRadius: 999, padding: "7px 14px", color: "#ffffff", fontSize: 13, fontWeight: 800 }}><CalendarDays size={15} /> {shortDmy(data.weekStart)} – {shortDmy(data.weekEnd)}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(255,255,255,.45)", borderRadius: 999, padding: "7px 14px", color: "#ffffff", fontSize: 13, fontWeight: 800 }}><Layers size={15} /> {list.length} Class{list.length === 1 ? "" : "es"}</div>
                            </div>
                        </div>
                    </div>
                    {/* timetable */}
                    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: 150 }} />
                                {dates.map((d, di) => Array.from({ length: lanes[di].count }, (_, k) => <col key={`${d.date}-${k}`} />))}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={{ background: GREEN, color: "#ffffff", padding: "12px 8px", fontSize: 14, fontWeight: 800, borderRight: "1px solid rgba(255,255,255,.2)" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><CalendarDays size={16} /> Time / Day</span>
                                    </th>
                                    {dates.map((d, di) => (
                                        <th key={d.date} colSpan={lanes[di].count} style={{ background: GREEN, color: "#ffffff", padding: "10px 6px", fontSize: 17, fontWeight: 900, borderRight: "1px solid rgba(255,255,255,.2)" }}>
                                            {d.name}<div style={{ fontSize: 12.5, fontWeight: 600, color: "#d1fae5", marginTop: 2 }}>{shortDay(d.date)}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sheetRows.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <td style={{ background: "#eaf5ee", borderTop: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, padding: "10px 12px", verticalAlign: "middle" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 800, color: "#18181b", lineHeight: 1.3 }}>
                                                <Clock size={17} style={{ flexShrink: 0, color: "#27272a" }} />
                                                <span data-testid="sheet-time">{row.other ? <>Other times<br /><span style={{ fontSize: 11, fontWeight: 600, color: "#71717a" }}>check time</span></> : <>{hmLabel(row.from)} –<br />{hmLabel(row.to)}</>}</span>
                                            </div>
                                        </td>
                                        {dates.map((d, di) => {
                                            const L = lanes[di];
                                            const cellStyle = (busy: boolean): React.CSSProperties => ({ borderTop: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, padding: 6, verticalAlign: "top", background: busy ? "#f8faf9" : "#ffffff", height: 1 });
                                            if (row.other) {
                                                const items = invalid.filter(c => c.date === d.date);
                                                return <td key={d.date} colSpan={L.count} data-testid="sheet-cell" data-count={items.length} style={cellStyle(false)}>{items.length ? cards(items) : <div data-testid="sheet-free" style={freeStyle}>Academic Lecture</div>}</td>;
                                            }
                                            const running = L.groups.some(g => g.start < row.to && g.end > row.from);
                                            if (!running) return <td key={d.date} colSpan={L.count} data-testid="sheet-cell" data-count={0} style={cellStyle(false)}><div data-testid="sheet-free" style={freeStyle}>Academic Lecture</div></td>;
                                            return Array.from({ length: L.count }, (_, k) => {
                                                const g = L.groups.find(x => x.lane === k && x.start === row.from);
                                                if (g) {
                                                    const span = bounds.indexOf(g.end) - rIdx;
                                                    // the coloured box fills the cell down to the class's end line (one class); several classes
                                                    // starting together: a light box to the end line with their cards inside, one below the other
                                                    const one = g.items.length === 1, p0 = pal(g.items[0].facultyId);
                                                    return (
                                                        <td key={`${d.date}-${k}`} rowSpan={span > 1 ? span : undefined} data-testid="sheet-cell" data-count={g.items.length} data-span={span} style={{ ...cellStyle(false), position: "relative" }}>
                                                            {/* one class: coloured box with the professor's colour line on the left (no "border" key here — it would wipe that line) */}
                                                            <div data-testid="sheet-box" style={one
                                                                ? { position: "absolute", inset: 6, borderRadius: 8, background: p0.fill, borderLeft: `5px solid ${p0.line}` }
                                                                : { position: "absolute", inset: 6, borderRadius: 8, background: "#f1f5f3", border: "1px dashed #a1a1aa" }} />
                                                            <div style={{ position: "relative" }}>{cards(g.items, one)}</div>
                                                        </td>
                                                    );
                                                }
                                                if (L.groups.some(x => x.lane === k && x.start < row.from && x.end > row.from)) return null;   // covered by a class above
                                                return <td key={`${d.date}-${k}`} data-testid="sheet-cell" data-count={0} data-busy="1" style={cellStyle(true)} />;
                                            });
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* professors · generated on */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 14 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13 }}>
                            {profs.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#27272a", background: "#f4f4f5", borderRadius: 999, padding: "6px 12px" }}><Users size={14} /> Professors:</span>}
                            {profs.map(([id, name]) => { const p = pal(String(id)); return (
                                <span key={String(id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, color: "#27272a", background: "#f4f4f5", borderRadius: 999, padding: "6px 12px" }}>
                                    <span style={{ width: 14, height: 14, borderRadius: 4, background: p.fill, border: `2px solid ${p.line}` }} />{name}
                                </span>
                            ); })}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#52525b", fontWeight: 600, whiteSpace: "nowrap" }}>Generated on: {gen}</div>
                    </div>
                </div>
            </div>
        );
    };

    // ── Timetable (same look and colours as the Sprint Plan timetable). compact = all-campuses overview ──
    const Timetable = ({ list, compact, title, badge, exportFile, sheetCollege, sheetLabel, sheetTags }: { list: any[]; compact?: boolean; title?: string; badge?: string; exportFile?: string; sheetCollege?: string; sheetLabel?: string; sheetTags?: SheetTag[] }) => {
        const grid = rowsFor(list);
        const rows = grid.rows;
        const profsHere = Array.from(new Map(list.map(c => [c.facultyId, c.facultyName])).entries());
        // Full-size timetable in the Sprint Management design (dark cards, coloured edge, Free Period cells).
        // Colour = professor in the college view, = subject in "My Schedule". Same design for the campus overview (compact).
        const colorKeys = showProfessor
            ? profsHere.map(([id]) => String(id))
            : Array.from(new Set([...list].sort((x, y) => (x.date + x.timeStart).localeCompare(y.date + y.timeStart)).map(c => String(c.subjectName || c.topics || "Lecture").toLowerCase())));
        const colorOf = (c: any) => showProfessor ? profColor(c.facultyId).line : CARD_COLORS[Math.max(0, colorKeys.indexOf(String(c.subjectName || c.topics || "Lecture").toLowerCase())) % CARD_COLORS.length];
        const shortDate = (ymd: string) => new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        const closed = !!(exportFile && !compact && closedTables[exportFile]);
        return (
            <div className={compact ? "bg-zinc-950/40" : "rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden"} data-testid="calendar-grid" {...(exportFile && !compact ? { "data-export-root": "1" } : {})}>
                {!compact && <div className={`px-4 py-3 ${closed ? "" : "border-b"} border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-900/60`}>
                    <div className="flex items-center gap-3 min-w-0">
                        {exportFile && (
                            <button type="button" data-export-hide="1" data-testid="table-toggle" aria-expanded={!closed} title={closed ? "Show timetable" : "Hide timetable"}
                                onClick={() => setClosedTables(m => ({ ...m, [exportFile]: !closed }))}
                                className="shrink-0 w-7 h-7 rounded-lg border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center">
                                {closed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                            </button>
                        )}
                        <p className="text-sm sm:text-base font-black text-white min-w-0 [overflow-wrap:anywhere]" data-testid="calendar-title">{title}</p>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full border border-zinc-700 bg-zinc-950 text-[10.5px] font-bold text-zinc-200 tabular-nums" data-testid="calendar-count">{list.length} Class{list.length === 1 ? "" : "es"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">{!exportFile && badge ? `${badge} · ` : ""}<Calendar size={13} className="text-zinc-500" /> {shortDmy(data.weekStart)} – {shortDmy(data.weekEnd)}</p>
                        {exportFile && imageButton(exportFile, list, sheetCollege || String(title || "").replace(/^Weekly Schedule — /, ""), `${modeTitle} • ${sheetLabel || "Weekly Timetable"}`, sheetHide(sheetLabel), sheetTags)}
                    </div>
                </div>}
                {!closed && (<>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-xs min-w-[860px]">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 bg-[#0b4a2e] text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-100 w-[92px] border-b border-r border-emerald-900">Time</th>
                                {dates.map(d => {
                                    const isToday = d.date === today;
                                    return (
                                        <th key={d.date} className={`text-center px-2 py-2.5 border-b border-r border-emerald-900 last:border-r-0 ${isToday ? "bg-emerald-700" : "bg-[#0b4a2e]"}`} data-testid={`wc-day-${d.code}`}>
                                            <span className="block text-[12px] font-bold text-white">{d.name}</span>
                                            <span className={`block text-[10.5px] font-medium ${isToday ? "text-emerald-50" : "text-emerald-200/80"}`}>{shortDate(d.date)}{isToday ? " · Today" : ""}</span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rIdx) => row.isLunch ? (
                                <tr key={rIdx} data-testid="wc-lunch">
                                    <td className="sticky left-0 z-10 px-3 py-2 whitespace-nowrap border-b border-r border-zinc-800 bg-zinc-900 text-amber-200">
                                        <span className="font-semibold text-[11px]">{row.label.split(" – ")[0]}</span>
                                        {row.label.includes(" – ") && <span className="block text-[10px] text-zinc-500">to {row.label.split(" – ")[1]}</span>}
                                    </td>
                                    <td colSpan={dates.length} className="p-1.5 border-b border-zinc-800/70">
                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] py-2 flex items-center justify-center gap-1.5 text-amber-200/90 text-[11px] font-bold tracking-wide"><Coffee size={13} /> Lunch Break</div>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={rIdx}>
                                    <td className={`sticky left-0 z-10 px-3 py-2.5 align-top whitespace-nowrap border-b border-r border-zinc-800 ${row.other ? "bg-zinc-800 text-zinc-300" : "bg-[#0f2a1f] text-emerald-50"}`}>
                                        {row.label.includes(" – ") ? (
                                            <>
                                                <span className="font-semibold text-[11px]">{row.label.split(" – ")[0]}</span>
                                                <span className="block text-[10px] text-emerald-200/70">to {row.label.split(" – ")[1]}</span>
                                            </>
                                        ) : <span className="font-semibold text-[11px]">{row.label}</span>}
                                        {row.other && <span className="block text-[9px] text-zinc-500 tracking-wider">CHECK TIME</span>}
                                    </td>
                                    {dates.map(d => {
                                        const at = grid.cellAt(rIdx, d.date);
                                        if (at === "covered") return null;
                                        const isToday = d.date === today;
                                        const cell = at ? at.items : [];
                                        return (
                                            <td key={d.date} rowSpan={at && at.span > 1 ? at.span : undefined}
                                                className={`p-1.5 h-px border-b border-r border-zinc-800/70 last:border-r-0 ${cell.length ? "align-top" : "align-middle"} ${isToday ? "bg-indigo-500/[0.04]" : ""}`}>
                                                {cell.length === 0 ? (
                                                    <div className="h-full min-h-[52px] rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-1 text-zinc-500" data-testid="wc-free">
                                                        <Coffee size={13} className="text-zinc-600" /><span className="text-[10.5px] font-medium">Free Period</span>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col gap-1.5">
                                                        {cell.map(c => {
                                                            const col = colorOf(c);
                                                            const st = c.recordStatus || "PENDING_PROFESSOR";
                                                            const lab = /lab|practical/i.test(`${c.lectureType || ""} ${c.subjectName || ""}`);
                                                            const Icon = lab ? FlaskConical : BookOpen;
                                                            // Several classes in one time period → a compact card (one line each, full text on hover / click)
                                                            if (cell.length > 1) {
                                                                const sameTime = cell.every(x => x.timeStart === c.timeStart && x.timeStop === c.timeStop);
                                                                const meta = [c.branch || c.stream || c.className, c.year, c.section ? `Sec ${c.section}` : ""].filter(Boolean).join(" · ");
                                                                return (
                                                                    <button key={c.id} onClick={() => setSelected(c)} data-testid="calendar-class" data-color={col} data-dense="1"
                                                                        title={`${c.subjectName || ""}${c.facultyName ? ` · ${c.facultyName}` : ""}\n${meta}\n${t12(c.timeStart)} – ${t12(c.timeStop)} · ${CLASS_STATUS_LABEL[st] || st}\nClick for details`}
                                                                        className="relative w-full overflow-hidden rounded-lg border bg-zinc-900 pl-3 pr-2 py-1.5 text-left cursor-pointer hover:brightness-125 transition"
                                                                        style={{ borderColor: `${col}80`, backgroundImage: `linear-gradient(135deg, ${col}40, ${col}1f)` }}>
                                                                        <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: col }} />
                                                                        <span className="flex items-center gap-1.5 min-w-0">
                                                                            <Icon size={12} className="shrink-0" style={{ color: col }} />
                                                                            <span className="text-[11.5px] font-black leading-tight text-white truncate min-w-0">{c.subjectName || c.topics || "Lecture"}</span>
                                                                        </span>
                                                                        {showProfessor && c.facultyName && <span className="block mt-0.5 text-[10px] font-bold text-zinc-200 truncate">{c.facultyName}</span>}
                                                                        {meta && <span className="block text-[10px] text-zinc-400 truncate">{meta}</span>}
                                                                        {/* time only when it differs from the other classes of this period (the row already shows it) */}
                                                                        {!sameTime && <span className="block text-[9.5px] font-semibold text-zinc-300 tabular-nums truncate">{t12(c.timeStart)} – {t12(c.timeStop)}</span>}
                                                                        <span className={`mt-1 block max-w-full w-fit truncate text-[9px] leading-tight font-bold px-1 py-px rounded border ${CLASS_STATUS_STYLE[st] || ""}`} data-testid="wc-status">{CLASS_STATUS_LABEL[st] || st}</span>
                                                                    </button>
                                                                );
                                                            }
                                                            return (
                                                                <button key={c.id} onClick={() => setSelected(c)} data-testid="calendar-class" data-color={col}
                                                                    title={`${t12(c.timeStart)} – ${t12(c.timeStop)} · ${c.subjectName || ""} · ${c.facultyName || ""} — click for details`}
                                                                    className="relative w-full flex-1 overflow-hidden rounded-xl border bg-zinc-900 pl-3.5 pr-2.5 py-2.5 text-left cursor-pointer hover:brightness-125 transition"
                                                                    style={{ borderColor: `${col}80`, backgroundImage: `linear-gradient(135deg, ${col}40, ${col}1f)` }}>
                                                                    <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: col }} />
                                                                    <span className="flex items-start gap-1.5 min-w-0">
                                                                        <span className="shrink-0 w-5 h-5 rounded-md border flex items-center justify-center" style={{ color: col, background: `${col}26`, borderColor: `${col}59` }}><Icon size={12} /></span>
                                                                        <span lang="en" className="text-[12px] font-black leading-snug text-white break-words hyphens-auto min-w-0">{c.subjectName || c.topics || "Lecture"}</span>
                                                                    </span>
                                                                    {showProfessor && c.facultyName && <span className="block mt-1.5 text-[10.5px] font-bold text-zinc-200 [overflow-wrap:anywhere]">{c.facultyName}</span>}
                                                                    {(c.className || c.branch || c.stream) && <span className={`block ${showProfessor ? "" : "mt-1.5"} text-[10.5px] font-semibold text-zinc-300 [overflow-wrap:anywhere]`}>{[c.branch || c.stream || c.className, c.year].filter(Boolean).join(" · ") || c.className}</span>}
                                                                    {c.section && <span className="block text-[10.5px] text-zinc-400">Sec {c.section}</span>}
                                                                    <span className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-zinc-300 tabular-nums"><Clock size={11} className="text-zinc-500 shrink-0" /> {t12(c.timeStart)} – {t12(c.timeStop)}</span>
                                                                    <span className={`inline-block mt-2 max-w-full text-[9.5px] leading-tight font-bold px-1.5 py-0.5 rounded-md border ${CLASS_STATUS_STYLE[st] || ""}`} data-testid="wc-status">{CLASS_STATUS_LABEL[st] || st}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {showProfessor && profsHere.length > 0 && (
                    <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-zinc-800 text-xs" data-testid="calendar-key">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Colour = Professor</span>
                        {profsHere.map(([id, name]) => (
                            <span key={id} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-md border" style={{ background: `${profColor(id).line}40`, borderColor: profColor(id).line }} />
                                <span className="font-bold text-zinc-300">{name}</span>
                            </span>
                        ))}
                        <span className="sm:ml-auto text-[11px] text-zinc-500">Small label on a class = its class-record status. Click any class to see full details.</span>
                    </div>
                )}
                </>)}
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]">
            {/* ── Header ── */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5" data-testid="wc-header">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="shrink-0 w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-700 flex items-center justify-center"><CalendarDays size={24} className="text-zinc-200" /></div>
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Weekly Calendar</h1>
                            <p className="text-xs sm:text-sm text-zinc-400 truncate">View and manage weekly teaching schedules.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setWeek(w => shiftWeek(w, -1))} title="Previous week" className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"><ArrowLeft size={16} /></button>
                        <div className="relative">
                            <select value={weekPreset} onChange={e => { const v = e.target.value; setWeek(shiftWeek(istToday(), v === "last" ? -1 : v === "next" ? 1 : 0)); }}
                                className="appearance-none pl-3.5 pr-9 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white cursor-pointer outline-none" data-testid="week-preset">
                                <option value="this">This Week</option>
                                <option value="last">Last Week</option>
                                <option value="next">Next Week</option>
                                {weekPreset === "other" && <option value="other">Other Week</option>}
                            </select>
                            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                        <label className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-black text-white whitespace-nowrap cursor-pointer" data-testid="week-range" title="Pick any date to jump to its week">
                            <Calendar size={14} className="text-zinc-300" /> {data ? `${shortDmy(data.weekStart)} – ${shortDmy(data.weekEnd)}` : "…"}
                            <input type="date" value={week} onChange={e => e.target.value && setWeek(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" aria-label="Pick a week" />
                        </label>
                        <button onClick={() => setWeek(w => shiftWeek(w, 1))} title="Next week" className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"><ArrowRight size={16} /></button>
                        <button onClick={load} title="Refresh" className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
                    </div>
                </div>
            </div>

            {/* ── Filters: one line (Filters · Reset · Download); the dropdowns open below with "Filters" ── */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4" data-testid="filter-panel">
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen} data-testid="filters-toggle"
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black active:scale-95 border ${filtersOpen ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-950 hover:bg-zinc-800 border-zinc-700 text-zinc-100"}`}>
                        <SlidersHorizontal size={14} /> Filters
                        {activeFilters > 0 && <span className="px-1.5 py-px rounded-full bg-emerald-500 text-[10px] text-zinc-950" data-testid="filters-count">{activeFilters}</span>}
                        <ChevronDown size={13} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                    </button>
                    {activeFilters > 0 && !filtersOpen && (
                        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400" data-testid="filters-summary">
                            {[facultyId !== "All" ? (data?.professors || []).find((p: any) => p.id === facultyId)?.name || "1 professor" : "",
                              ...Object.keys(EMPTY_FILTERS).filter(k => filters[k] !== "All").map(k => k === "branch" ? branchText(branchList(filters.branch)) : k === "semester" ? semText(filters[k]) : filters[k])].filter(Boolean).join(" · ")}
                        </span>
                    )}
                    <div className="ml-auto flex flex-wrap justify-end gap-2 shrink-0">
                        <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-black active:scale-95"><RotateCcw size={14} /> Reset</button>
                        <div className="relative">
                            <button onClick={() => setDlOpen(o => !o)} disabled={pdfBusy} data-testid="download-report" title="Download PDF / Excel" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-black active:scale-95 disabled:opacity-60">
                                {pdfBusy && !exportMsg ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} <span className="xl:hidden 2xl:inline">Download</span> <ChevronDown size={13} className={`transition-transform ${dlOpen ? "rotate-180" : ""}`} />
                            </button>
                            {dlOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setDlOpen(false)} />
                                    <div className="absolute right-0 mt-2 z-40 w-60 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1.5" data-testid="download-menu">
                                        <button onClick={downloadPdf} data-testid="download-pdf" className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800 text-left">
                                            <FileText size={15} className="text-rose-300 mt-0.5 shrink-0" />
                                            <span><span className="block text-xs font-bold text-white">Download PDF</span><span className="block text-[10px] text-zinc-500">Colourful calendar, one page per campus</span></span>
                                        </button>
                                        <button onClick={() => { setDlOpen(false); downloadReport(); }} data-testid="download-excel" className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800 text-left">
                                            <FileSpreadsheet size={15} className="text-emerald-300 mt-0.5 shrink-0" />
                                            <span><span className="block text-xs font-bold text-white">Download Excel</span><span className="block text-[10px] text-zinc-500">All classes as rows (.xlsx)</span></span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {filtersOpen && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-col min-[1400px]:flex-row min-[1400px]:items-end gap-3 min-[1400px]:gap-2" data-testid="filter-fields">
                        <div className={`flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-3 xl:gap-2 ${showProfessor ? "xl:grid-cols-[1.25fr_repeat(7,minmax(0,1fr))]" : "xl:grid-cols-4"}`}>
                            {showProfessor && field("Professor", Users, (
                                <select value={draftFaculty} onChange={e => setDraftFaculty(e.target.value)} data-testid="filter-professor" className={fieldCls}>
                                    <option value="All">All Professors</option>
                                    {(data?.professors || []).filter((p: any) => campus === "ALL" || (campusList.find(x => x.id === campus)?.keys || []).includes(String(p.location || ""))).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            ))}
                            {sel("day", "Day", CalendarDays, DAYS.map(d => d.code))}
                            {sel("subject", "Subject", BookOpen, options.subject)}
                            {sel("className", "Class", GraduationCap, options.className)}
                            {sel("section", "Section", LayoutGrid, options.section)}
                            {showProfessor && field("Year", Calendar, (
                                <select value={draft.year} onChange={e => pickYearSem("year", e.target.value)} data-testid="filter-year" className={fieldCls}>
                                    <option value="All">All</option>{options.year.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            ))}
                            {showProfessor && branchField}
                            {showProfessor && field("Semester", Layers, (
                                <select value={draft.semester} onChange={e => pickYearSem("semester", e.target.value)} data-testid="filter-semester" className={fieldCls}>
                                    <option value="All">All</option>{options.semester.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            ))}
                        </div>
                        <div className="flex justify-end shrink-0">
                            <button onClick={applyFilters} data-testid="apply-filters" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black active:scale-95"><SlidersHorizontal size={14} /> Apply Filters{pendingChanges ? " •" : ""}</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Campus chips (+ My / College tabs for professors) ── */}
            <div className="flex flex-wrap items-center gap-2" data-testid="campus-chips">
                {isProf && (
                    <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 mr-1">
                        <button onClick={() => { setView("mine"); setFacultyId("All"); setDraftFaculty("All"); }} data-testid="tab-mine" className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${view === "mine" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-white"}`}>My Schedule</button>
                        <button onClick={() => setView("college")} data-testid="tab-college" className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${view === "college" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-white"}`}>College Schedule</button>
                    </div>
                )}
                {multiCampusView && campusList.length > 0 && (
                    <>
                        <button onClick={() => { setCampus("ALL"); setFacultyId("All"); setDraftFaculty("All"); }} data-testid="chip-all"
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black transition-all ${campus === "ALL" ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"}`}>
                            <Network size={14} /> All Campuses
                        </button>
                        {campusList.map((cp, i) => {
                            const a = CAMPUS_ACCENTS[i % CAMPUS_ACCENTS.length];
                            const active = campus === cp.id;
                            const n = shown.filter(c => campusOf(c) === cp.id).length;
                            return (
                                <button key={cp.id} onClick={() => { setCampus(cp.id); setFacultyId("All"); setDraftFaculty("All"); }} data-testid="chip-campus"
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black transition-all ${active ? a.chipActive : a.chipIdle}`}>
                                    <Building2 size={14} /> {cp.name}
                                    <span className={`px-1.5 rounded-md text-[10px] ${active ? "bg-black/20" : "bg-zinc-800"} tabular-nums`}>{n}</span>
                                </button>
                            );
                        })}
                    </>
                )}
            </div>

            {/* ── Calendar / List view · View Mode · Download Complete Calendar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5" data-testid="mode-bar-row">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                        <button onClick={() => setLayout("grid")} data-testid="view-calendar" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black ${layout === "grid" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}><LayoutGrid size={13} /> Calendar View</button>
                        <button onClick={() => setLayout("list")} data-testid="view-list" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black ${layout === "list" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}><List size={13} /> List View</button>
                    </div>
                    {canGroup && (
                        <div className="flex flex-wrap items-center gap-2" data-testid="mode-bar">
                            <span className="text-[11px] font-semibold text-zinc-400">View Mode:</span>
                            <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800" role="tablist">
                                {VIEW_MODES.map(m => (
                                    <button key={m.key} role="tab" aria-selected={mode === m.key} onClick={() => { setMode(m.key); setLayout("grid"); }} data-testid={`mode-${m.key}`}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${mode === m.key ? "bg-emerald-600 text-white" : "text-zinc-300 hover:text-white"}`}>{m.label}</button>
                                ))}
                            </div>
                            {/* Branch-Wise: a separate on / off button, so it can be used together with Year-Wise / Semester-Wise */}
                            <button type="button" aria-pressed={byBranch} onClick={() => { setByBranch(v => !v); setLayout("grid"); }} data-testid="mode-branch"
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black ${byBranch ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white"}`}>
                                <GitBranch size={13} /> Branch-Wise
                            </button>
                        </div>
                    )}
                </div>
                {canGroup && (
                    <button onClick={downloadComplete} disabled={pdfBusy || !data} data-testid="download-complete"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black active:scale-95 disabled:opacity-60">
                        {pdfBusy && exportMsg ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {exportMsg || "Download Complete Calendar"}
                    </button>
                )}
            </div>

            {notice && <div className="rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">{notice}</div>}
            {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"><AlertTriangle size={14} /> {error}</div>}

            {loading && !data ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : shownCampus.length === 0 && !(multiCampusView && campus === "ALL") ? (
                <div className="text-center py-16 text-sm text-zinc-500 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl" data-testid="calendar-empty">
                    No classes for this week{view === "mine" ? " — submit your sprint plan to see it here." : campus !== "ALL" ? ` at ${campusName(campus)}.` : "."}
                </div>
            ) : layout === "list" ? (
                <div className="space-y-4" data-testid="calendar-list">
                    {dates.map(d => {
                        const list = shownCampus.filter(c => c.date === d.date);
                        if (!list.length) return null;
                        return (
                            <div key={d.date} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                                <div className="px-4 py-2.5 bg-zinc-800/40 text-xs font-black text-white">{d.name} <span className="text-zinc-500 font-bold ml-2">{dmy(d.date)}</span></div>
                                <div className="divide-y divide-zinc-800">
                                    {list.map(c => (
                                        <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-white/[0.02]" data-testid="calendar-class">
                                            <span className="text-xs font-black text-white tabular-nums w-28 shrink-0">{c.timeStart}–{c.timeStop}</span>
                                            <span className="flex-1 min-w-0 text-xs text-zinc-200 truncate">{c.subjectName} · {[c.className, c.section ? `Sec ${c.section}` : ""].filter(Boolean).join(" / ") || c.branch}{showProfessor ? ` · ${c.facultyName}` : ""}{multiCampusView && campus === "ALL" ? ` · ${campusName(campusOf(c))}` : ""}</span>
                                            <ClassStatusBadge status={c.recordStatus} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : canGroup && (mode !== "full" || byBranch) ? (
                /* Year-Wise / Semester-Wise: one timetable per year / semester, one below the other (per college) */
                <div className="space-y-6" data-testid="group-sections" data-mode={mode}>
                    {campusesInView.map((cp, i) => {
                        const list = classesOf(cp.id);
                        const groups = groupClasses(list, mode, byBranch);
                        const a = CAMPUS_ACCENTS[i % CAMPUS_ACCENTS.length];
                        const tables = groups.map(g => (
                            <div key={g.key} data-testid="group-table" data-group={g.label}>
                                <Timetable list={g.list} title={`${cp.name} — ${g.label}`} exportFile={imageFile(cp.id, g.label)} sheetCollege={cp.name} sheetLabel={g.label} sheetTags={g.tags} />
                            </div>
                        ));
                        if (singleSection) return <div key={cp.id} className="space-y-4">{tables.length ? tables : <p className="py-10 text-center text-xs text-zinc-500">No classes this week.</p>}</div>;
                        return (
                            <section key={cp.id} className={`rounded-2xl border-2 ${a.border} bg-zinc-950/40 overflow-hidden`} data-testid="group-college">
                                <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${a.headBg}`}>
                                    <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${a.iconBg}`}><Building2 size={18} className={a.text} /></span>
                                    <h2 className="text-base sm:text-lg font-black text-white truncate">{cp.name}</h2>
                                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-black ${a.pill}`}>{groups.length && list.length ? `${groups.length} ${byBranch ? (mode === "full" ? "branch" : "timetable") : mode === "year" ? "year" : "semester"}${groups.length === 1 ? "" : byBranch && mode === "full" ? "es" : "s"}` : "No classes"}</span>
                                </div>
                                {list.length === 0 ? <p className="px-4 py-6 text-center text-xs text-zinc-500">No classes at this campus this week.</p> : <div className="p-3 sm:p-4 space-y-4">{tables}</div>}
                            </section>
                        );
                    })}
                </div>
            ) : multiCampusView && campus === "ALL" ? (
                /* All campuses: one compact timetable per campus, one below the other */
                <div className="space-y-4" data-testid="campus-sections">
                    {campusList.map((cp, i) => {
                        const list = shown.filter(c => campusOf(c) === cp.id);
                        const a = CAMPUS_ACCENTS[i % CAMPUS_ACCENTS.length];
                        return (
                            <section key={cp.id} className={`rounded-2xl border-2 ${a.border} bg-zinc-950/40 overflow-hidden`} data-testid="campus-section" {...(canGroup && list.length ? { "data-export-root": "1" } : {})}>
                                <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${a.headBg}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${a.iconBg}`}><Building2 size={18} className={a.text} /></span>
                                        <h2 className="text-base sm:text-lg font-black text-white truncate">{cp.name}</h2>
                                        <span className={`shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-black ${a.pill}`}>{list.length} class{list.length === 1 ? "" : "es"}</span>
                                        {canGroup && <span className="shrink-0 text-[11px] text-zinc-400">{weekText}</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {canGroup && list.length > 0 && imageButton(imageFile(cp.id, "Full_College"), list, cp.name, "Full College • Weekly Timetable")}
                                        <button onClick={() => { setCampus(cp.id); setFacultyId("All"); window.scrollTo({ top: 0, behavior: "smooth" }); }} data-testid="view-campus" data-export-hide="1"
                                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[11px] font-black transition-all hover:brightness-125 ${a.btn}`}>
                                            View Campus Details <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                                {list.length === 0 ? (
                                    <p className="px-4 py-6 text-center text-xs text-zinc-500">No classes at this campus this week.</p>
                                ) : <Timetable list={list} compact />}
                            </section>
                        );
                    })}
                </div>
            ) : (
                <Timetable list={shownCampus} title={view === "mine" ? `My Weekly Schedule — ${user.name}` : `Weekly Schedule — ${multiCampusView && campus !== "ALL" ? campusName(campus) : collegeTitle}`}
                    badge={multiCampusView && campus !== "ALL" ? campusName(campus) : collegeTitle}
                    exportFile={view === "mine" ? imageFile(MINE, "Full_Week") : canGroup && campus !== "ALL" ? imageFile(campus, "Full_College") : undefined}
                    sheetCollege={view === "mine" ? `My Weekly Schedule — ${user.name}` : campus !== "ALL" ? campusName(campus) : collegeTitle} />
            )}

            {renderSheet()}

            {selected && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={() => setSelected(null)}>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="class-modal">
                        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">{selected.subjectName}{selected.subjectCode ? ` (${selected.subjectCode})` : ""}</h3>
                                <p className="text-xs text-zinc-400">{dates.find(d => d.date === selected.date)?.name || selected.day} {dmy(selected.date)} · {selected.timeStart}–{selected.timeStop}</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                {[
                                    ["Professor", selected.facultyName], ["College", (data?.colleges || []).find((c: any) => c.id === selected.college)?.name || selected.college],
                                    ["Topic", selected.topics], ["Content", selected.content],
                                    ["Lecture Type", selected.lectureType], ["Unit", selected.unitNumber],
                                    ["Class", selected.className], ["Section", selected.section],
                                    ["Branch", selected.branch], ["Year / Semester", [selected.year, selected.semester].filter(Boolean).join(" / ")],
                                    ["Sprint Plan", PLAN_STATUS_LABEL[selected.planStatus] || selected.planStatus], ["Attendance", selected.attendance],
                                ].map(([k, v]) => (
                                    <div key={k as string} className="min-w-0"><p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{k}</p><p className="text-zinc-200 [overflow-wrap:anywhere] whitespace-pre-wrap">{v || "—"}</p></div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">Class record:</span>
                                <ClassStatusBadge status={selected.recordStatus} />
                                {selected.notesMissing && <span className="text-[10px] text-amber-400 font-bold">Notes missing</span>}
                                <span className="text-[10px] text-zinc-500">{selected.hasAssignment ? "Assignment added" : "No assignment yet"}</span>
                            </div>

                            {/* Professor: complete the class record / add assignment (Modules 6, 18) */}
                            {selected.facultyId === user.id && isProf && (
                                <div className="space-y-3 pt-2 border-t border-zinc-800">
                                    {!selected.classEnded ? (
                                        <p className="text-xs text-zinc-500">You can complete the class record after the class ends ({selected.timeStop}).</p>
                                    ) : PROFESSOR_EDITABLE_CLASS_STATUSES.includes(selected.recordStatus) && (
                                        <Link href={`/faculty/lecture-report?date=${selected.date}&lecture=${selected.lectureNumber}`} data-testid="complete-class"
                                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl">
                                            Complete Class / Upload Notes <ExternalLink size={12} />
                                        </Link>
                                    )}
                                    {selected.classEnded && (
                                        <ClassRecordActions
                                            record={{ virtual: !selected.recordId, _id: selected.recordId, facultyId: selected.facultyId, date: selected.date, lectureNumber: selected.lectureNumber, sprintEntryId: selected.sprintEntryId, pipelineStatus: selected.recordStatus, classEnded: selected.classEnded, assignment: { hasAssignment: selected.hasAssignment }, delayFlags: [], notesMissing: false }}
                                            role={role} userId={user.id}
                                            onDone={(m) => { setNotice(m); setSelected(null); load(); setTimeout(() => setNotice(""), 4000); }} />
                                    )}
                                </div>
                            )}
                            {!isProf && selected.recordId && (
                                <Link href={`/academic/verification?record=${selected.recordId}`} className="inline-flex items-center gap-2 text-xs text-indigo-300 hover:underline">Open class record <ExternalLink size={12} /></Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}