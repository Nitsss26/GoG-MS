"use client";

/**
 * College-wise dynamic timetable (Sprint Plan).
 *  - Shows the classes of the professor's own college for the selected week (the server limits the data to that
 *    college; this component never widens it).
 *  - Rows are built from the college start / end time and the real start / stop times of the classes, so a class
 *    of any length takes exactly its own time (one card spanning rows, never split into hourly slots).
 *  - All days of the week side by side (time rows × days); filters: professor (All / one), class & section (All / one).
 *  - Shared college timings card: any professor of the college can set / change them; they apply to every week.
 *  - Refreshes every 30 seconds and whenever `refreshKey` changes (after a save / lock / unlock).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Users, Layers, RefreshCw, Save, AlertTriangle, Check, Lock, Pencil, Building2, Download, FileImage } from "lucide-react";

type Entry = {
    _id?: string; planId?: string; facultyId: string; facultyName: string; day: string; date: string;
    timeStart: string; timeStop: string; subjectName?: string; topics?: string; className?: string;
    stream?: string; year?: string; section?: string; lectureType?: string; planStatus?: string;
};
type Timing = { startTime: string; endTime: string; version: number; configuredByName?: string; configuredAt?: string; updatedByName?: string; updatedAt?: string; history?: any[] } | null;

const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const toMin = (t?: string) => (t && HM.test(t) ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : NaN);
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmt12 = (t?: string) => {
    const m = toMin(t); if (isNaN(m)) return t || "—";
    const h = Math.floor(m / 60);
    return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const classLabel = (e: Entry) => String(e.className || [e.stream, e.year, e.section].filter(Boolean).join(" ")).trim();
const classKey = (e: Entry) => classLabel(e).toLowerCase();
const when = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};
const STATUS: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-zinc-700/60 text-zinc-300" },
    LOCKED: { label: "Locked", cls: "bg-emerald-500/15 text-emerald-300" },
    LOCKED_AGAIN: { label: "Re-Locked", cls: "bg-emerald-500/15 text-emerald-300" },
    UNLOCKED_FOR_REVISION: { label: "Editing", cls: "bg-amber-500/15 text-amber-300" },
    SUBMITTED: { label: "Submitted", cls: "bg-sky-500/15 text-sky-300" },
    RESUBMITTED: { label: "Submitted", cls: "bg-sky-500/15 text-sky-300" },
    UNLOCK_REQUESTED: { label: "Locked", cls: "bg-emerald-500/15 text-emerald-300" },
};
// Download sheet: the same light, colourful look as the earlier timetable sheet (inline colours so the file keeps them)
const SHEET_THEMES = [
    { bg: "#e8c4d8", border: "#caa1b8", text: "#18181b", sub: "#3f3f46" },
    { bg: "#fdeaa2", border: "#e6ce78", text: "#18181b", sub: "#3f3f46" },
    { bg: "#cce3f0", border: "#a6c8de", text: "#18181b", sub: "#3f3f46" },
    { bg: "#d5ebd7", border: "#b1d4b4", text: "#18181b", sub: "#3f3f46" },
    { bg: "#ddd5f3", border: "#bfb2e6", text: "#18181b", sub: "#3f3f46" },
    { bg: "#fbd9c4", border: "#eab89a", text: "#18181b", sub: "#3f3f46" },
];
const PALETTE = [
    "border-sky-500/40 bg-sky-500/10", "border-teal-500/40 bg-teal-500/10", "border-violet-500/40 bg-violet-500/10",
    "border-amber-500/40 bg-amber-500/10", "border-rose-500/40 bg-rose-500/10", "border-lime-500/40 bg-lime-500/10",
    "border-orange-500/40 bg-orange-500/10", "border-fuchsia-500/40 bg-fuchsia-500/10",
];

export default function DynamicCollegeTimetable({ weekStart, weekDates, currentUserId, refreshKey = 0, mineOnly = false }: {
    weekStart: string; weekDates: { day: string; date: string }[]; currentUserId?: string; refreshKey?: number;
    /** Sprint Plan page: only the viewer's own classes (the college-wide view is in the Weekly Calendar) */
    mineOnly?: boolean;
}) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [college, setCollege] = useState<{ id: string; name: string } | null>(null);
    const [timing, setTiming] = useState<Timing>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [noCollege, setNoCollege] = useState<string>("");
    const [loadError, setLoadError] = useState("");
    const [loading, setLoading] = useState(true);
    const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
    const [profPick, setProf] = useState("ALL");
    const prof = mineOnly ? (currentUserId || "__none__") : profPick;
    const [cls, setCls] = useState("ALL");
    // timing form
    const [editing, setEditing] = useState(false);
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [saving, setSaving] = useState(false);
    const sheetRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState<"" | "png" | "pdf">("");
    const [exportError, setExportError] = useState("");
    const [tMsg, setTMsg] = useState<{ type: "success" | "error"; text: string; list?: string[] } | null>(null);

    const load = useCallback(async () => {
        try {
            const [a, b] = await Promise.all([
                fetch(`/api/curriculum/sprint-plan?weekStartDate=${weekStart}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
                fetch(`/api/academic/college-timings`, { cache: "no-store" })
                    .then(async r => { const d = await r.json().catch(() => null); return d && r.ok ? d : { __error: d?.error || `College timings could not be loaded (server error ${r.status}).` }; })
                    .catch(() => ({ __error: "College timings could not be loaded (network error)." })),
            ]);
            if (Array.isArray(a.allEntries)) setEntries(a.allEntries);
            setLoadError(b?.__error || "");
            if (b && "timing" in b) {
                setCollege(b.college || null); setTiming(b.timing || null); setCanEdit(!!b.canEdit); setNoCollege(b.college ? "" : (b.reason || "NO_LOCATION"));
            }
            setLastLoaded(new Date());
        } finally { setLoading(false); }
    }, [weekStart]);

    useEffect(() => { setLoading(true); load(); }, [load, refreshKey]);
    useEffect(() => {
        const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
        return () => clearInterval(t);
    }, [load]);
    const professors = useMemo(() => {
        const m = new Map<string, string>();
        entries.forEach(e => m.set(e.facultyId, e.facultyName || "Professor"));
        return Array.from(m, ([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name));
    }, [entries]);
    const classes = useMemo(() => {
        const m = new Map<string, string>();
        entries.forEach(e => { const k = classKey(e); if (k && (!mineOnly || e.facultyId === currentUserId)) m.set(k, classLabel(e)); });
        return Array.from(m, ([key, label]) => ({ key, label })).sort((x, y) => x.label.localeCompare(y.label));
    }, [entries, mineOnly, currentUserId]);

    // Classes of the week after the professor / class filters
    const weekEntries = useMemo(() => {
        const dates = new Set(weekDates.map(d => d.date));
        return entries.filter(e =>
            dates.has(e.date) && (prof === "ALL" || e.facultyId === prof) && (cls === "ALL" || classKey(e) === cls)
            && !isNaN(toMin(e.timeStart)) && toMin(e.timeStop) > toMin(e.timeStart));
    }, [entries, weekDates, prof, cls]);

    // Dynamic rows for the whole week: college start / end + every class start / stop
    const bounds = useMemo(() => {
        const s = new Set<number>();
        if (timing) { s.add(toMin(timing.startTime)); s.add(toMin(timing.endTime)); }
        weekEntries.forEach(e => { s.add(toMin(e.timeStart)); s.add(toMin(e.timeStop)); });
        return Array.from(s).filter(n => !isNaN(n)).sort((a, b) => a - b);
    }, [weekEntries, timing]);

    // Same class + section at overlapping times on a date (should not happen — highlighted when old data has it)
    const clashIds = useMemo(() => {
        const ids = new Set<string>();
        const list = entries.filter(e => e.section && classKey(e));
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            if (a.date === b.date && classKey(a) === classKey(b) && toMin(a.timeStart) < toMin(b.timeStop) && toMin(b.timeStart) < toMin(a.timeStop)) {
                ids.add(`${a.facultyId}|${a._id}`); ids.add(`${b.facultyId}|${b._id}`);
            }
        }
        return ids;
    }, [entries]);

    // Per day column: classes that overlap in time share one cell (each class keeps its own card and time);
    // the cell spans the rows from the earliest start to the latest end — a class is never split.
    const layout = useMemo(() => {
        const out = new Map<string, Map<number, { span: number; items: Entry[] } | "covered">>();
        for (const d of weekDates) {
            const m = new Map<number, { span: number; items: Entry[] } | "covered">();
            const list = weekEntries.filter(e => e.date === d.date)
                .sort((a, b) => toMin(a.timeStart) - toMin(b.timeStart) || (a.facultyId === currentUserId ? -1 : 1));
            let open: { row: number; endMin: number; cell: { span: number; items: Entry[] } } | null = null;
            for (const e of list) {
                if (open && toMin(e.timeStart) < open.endMin) {
                    open.cell.items.push(e);
                    open.endMin = Math.max(open.endMin, toMin(e.timeStop));
                    open.cell.span = bounds.indexOf(open.endMin) - open.row;
                    continue;
                }
                const r0 = bounds.indexOf(toMin(e.timeStart));
                const cell = { span: bounds.indexOf(toMin(e.timeStop)) - r0, items: [e] };
                m.set(r0, cell);
                open = { row: r0, endMin: toMin(e.timeStop), cell };
            }
            for (const [r, cell] of Array.from(m)) if (cell !== "covered") for (let k = 1; k < cell.span; k++) m.set(r + k, "covered");
            out.set(d.date, m);
        }
        return out;
    }, [weekDates, weekEntries, bounds, currentUserId]);

    const colour = (fid: string) => PALETTE[Math.max(0, professors.findIndex(p => p.id === fid)) % PALETTE.length];

    const saveTiming = async () => {
        setTMsg(null);
        if (!HM.test(start) || !HM.test(end)) { setTMsg({ type: "error", text: "Enter both the start and the end time." }); return; }
        if (toMin(start) >= toMin(end)) { setTMsg({ type: "error", text: "The start time must be before the end time." }); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/academic/college-timings", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime: start, endTime: end, version: timing?.version }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setTMsg({ type: "error", text: data.error || "Could not save the college timings.", list: data.conflicts });
                if (data.timing) setTiming(data.timing);
                return;
            }
            setTiming(data.timing); setEditing(false);
            setTMsg({ type: "success", text: data.message || "College timings saved." });
        } finally { setSaving(false); }
    };

    const rows = bounds.length > 1 ? bounds.slice(0, -1) : [];

    const sheetTheme = (fid: string) => SHEET_THEMES[Math.max(0, professors.findIndex(p => p.id === fid)) % SHEET_THEMES.length];
    const ddmmyyyy = (ymd?: string) => (ymd ? ymd.split("-").reverse().join("-") : "");
    const weekText = `${ddmmyyyy(weekDates[0]?.date)} to ${ddmmyyyy(weekDates[weekDates.length - 1]?.date)}`;
    const filterText = [prof !== "ALL" ? professors.find(p => p.id === prof)?.name : "", cls !== "ALL" ? classes.find(c => c.key === cls)?.label : ""].filter(Boolean).join(" · ");

    // Download the timetable (what is on screen, with the current filters) as a colourful PDF or PNG
    const download = async (kind: "png" | "pdf") => {
        const el = sheetRef.current;
        if (!el || exporting) return;
        setExporting(kind); setExportError("");
        try {
            const { toPng } = await import("html-to-image");
            const w = el.scrollWidth, h = el.scrollHeight;
            const opts: any = { width: w, height: h, pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true, style: { position: "static", left: "0", top: "0" } };
            let dataUrl = "";
            try { dataUrl = await toPng(el, opts); } catch { dataUrl = await toPng(el, { ...opts, skipFonts: true }); }
            if (!dataUrl || dataUrl.length < 100) throw new Error("empty image");
            const name = `Sprint-Plan-${(college?.name || "College").replace(/[^A-Za-z0-9]+/g, "-")}-${weekDates[0]?.date || weekStart}`;
            if (kind === "png") {
                const a = document.createElement("a"); a.href = dataUrl; a.download = `${name}.png`; a.click();
            } else {
                const { default: jsPDF } = await import("jspdf");
                const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt", format: [w, h], compress: true });
                pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
                pdf.save(`${name}.pdf`);
            }
        } catch (e: any) {
            console.error("[timetable] download failed", e);
            setExportError("Could not create the file. Please try again.");
        } finally { setExporting(""); }
    };

    return (
        <div className="space-y-4" data-testid="college-timetable">
            {/* College timings (shared by every professor of the college, for every week) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 flex-wrap" data-testid="college-name">
                            <Building2 size={16} className="text-amber-400 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">College</span>
                            <span className="text-sm font-bold text-white [overflow-wrap:anywhere]">{college?.name || (loadError ? "—" : "Not mapped")}</span>
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-3">College Timings</p>
                        {loadError ? (
                            <p className="text-sm text-red-400 mt-1 flex items-center gap-1.5" data-testid="college-load-error"><AlertTriangle size={13} /> {loadError}</p>
                        ) : noCollege ? (
                            <p className="text-sm text-amber-300 mt-1" data-testid="college-missing">
                                {noCollege === "NOT_PROFESSOR"
                                    ? "College timings are set by the professors of a college."
                                    : "Your college is not mapped yet. Ask HR to set your Location (college) in your employee profile — the timetable, college timings and conflicts all use it."}
                            </p>
                        ) : timing ? (
                            <p className="text-lg font-bold text-white mt-1" data-testid="college-timing-value">{fmt12(timing.startTime)} – {fmt12(timing.endTime)}</p>
                        ) : (
                            <p className="text-sm text-amber-300 mt-1" data-testid="college-timing-empty">Not set yet{canEdit ? " — set the college start and end time once; it is used for every week." : "."}</p>
                        )}
                        {timing && (
                            <p className="text-[11px] text-zinc-500 mt-1">
                                {timing.updatedByName ? `Last updated by ${timing.updatedByName}${timing.updatedAt ? ` · ${when(timing.updatedAt)}` : ""}` : timing.configuredByName ? `Set by ${timing.configuredByName}` : ""}
                                {" · applies to all weeks"}
                            </p>
                        )}
                    </div>
                    {canEdit && !editing && (
                        <button onClick={() => { setEditing(true); setTMsg(null); setStart(timing?.startTime || "09:00"); setEnd(timing?.endTime || "17:00"); }}
                            data-testid="edit-college-timing"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700">
                            <Pencil size={12} /> {timing ? "Update Timings" : "Set Timings"}
                        </button>
                    )}
                </div>
                {editing && (
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Start
                            <input type="time" value={start} onChange={e => setStart(e.target.value)} data-testid="college-start"
                                className="mt-1 block bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark]" />
                        </label>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">End
                            <input type="time" value={end} onChange={e => setEnd(e.target.value)} data-testid="college-end"
                                className="mt-1 block bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark]" />
                        </label>
                        <button onClick={saveTiming} disabled={saving} data-testid="save-college-timing"
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50">
                            <Save size={12} /> {saving ? "Saving..." : timing ? "Update" : "Save"}
                        </button>
                        <button onClick={() => { setEditing(false); setTMsg(null); }} className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white">Cancel</button>
                    </div>
                )}
                {tMsg && (
                    <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${tMsg.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`} data-testid="college-timing-msg">
                        <p className="flex items-center gap-1.5">{tMsg.type === "success" ? <Check size={12} /> : <AlertTriangle size={12} />} {tMsg.text}</p>
                        {tMsg.list && tMsg.list.length > 0 && <ul className="mt-1.5 ml-5 list-disc space-y-0.5 text-[11px] text-red-300/90">{tMsg.list.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <p className="text-[11px] text-zinc-500">
                    {mineOnly ? "Your classes: " : ""}{weekEntries.length} class{weekEntries.length === 1 ? "" : "es"} this week{(!mineOnly && prof !== "ALL") || cls !== "ALL" ? " (filtered)" : ""}{mineOnly ? " · the whole college is in the Weekly Calendar" : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
{!mineOnly && (
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400"><Users size={13} />
                        <select value={prof} onChange={e => setProf(e.target.value)} data-testid="tt-prof"
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white max-w-[200px]">
                            <option value="ALL">All Professors</option>
                            {currentUserId && <option value={currentUserId}>Only My Classes</option>}
                            {professors.filter(p => p.id !== currentUserId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </label>
                    )}
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400"><Layers size={13} />
                        <select value={cls} onChange={e => setCls(e.target.value)} data-testid="tt-class"
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white max-w-[200px]">
                            <option value="ALL">All Classes / Sections</option>
                            {classes.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                    </label>
                    <button onClick={() => download("pdf")} disabled={!!exporting || rows.length === 0} data-testid="tt-download-pdf"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-zinc-950 disabled:opacity-50">
                        <Download size={13} /> {exporting === "pdf" ? "Preparing..." : "Download PDF"}
                    </button>
                    <button onClick={() => download("png")} disabled={!!exporting || rows.length === 0} data-testid="tt-download-png" title="Download as image"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-50">
                        <FileImage size={13} /> {exporting === "png" ? "Preparing..." : "Image"}
                    </button>
                    <button onClick={() => load()} title="Refresh" className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
                </div>
            </div>

            {/* Grid: time rows × days (all professors of the college together, like the sheet view) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-x-auto">
                {loading && !entries.length ? (
                    <div className="py-14 flex justify-center"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
                ) : rows.length === 0 ? (
                    <p className="py-14 text-center text-sm text-zinc-500" data-testid="tt-empty">
                        No classes {(!mineOnly && prof !== "ALL") || cls !== "ALL" ? "match these filters" : mineOnly ? "in your plan" : "planned"} this week{timing ? "" : ". Set the college timings to see the full day"}.
                    </p>
                ) : (
                    <table className="w-full table-fixed border-collapse text-xs min-w-[900px]" data-testid="tt-grid">
                        <thead>
                            <tr className="bg-zinc-900/80">
                                <th className="sticky left-0 z-10 bg-zinc-900 text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 w-[104px] border-b border-r border-zinc-800"><Clock size={11} className="inline -mt-0.5 mr-1" />Time</th>
                                {weekDates.map(d => (
                                    <th key={d.date} className="text-center px-2 py-2.5 border-b border-r border-zinc-800 last:border-r-0" data-testid={`tt-day-${d.day}`}>
                                        <span className="block text-[11px] font-black tracking-widest text-white">{d.day}</span>
                                        <span className="block text-[10px] font-medium text-zinc-500">{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((m, r) => {
                                const outside = timing ? (m < toMin(timing.startTime) || m >= toMin(timing.endTime)) : false;
                                return (
                                    <tr key={m} data-testid="tt-row">
                                        <td className={`sticky left-0 z-10 px-3 py-2 align-top whitespace-nowrap border-b border-r border-zinc-800 ${outside ? "bg-red-950/60 text-red-300" : "bg-zinc-900 text-zinc-300"}`}>
                                            <span className="font-semibold">{fmt12(fromMin(m))}</span>
                                            <span className="block text-[10px] text-zinc-500">to {fmt12(fromMin(bounds[r + 1]))}</span>
                                        </td>
                                        {weekDates.map(d => {
                                            const cell = layout.get(d.date)?.get(r);
                                            if (cell === "covered") return null;
                                            if (!cell) return <td key={d.date} className="border-b border-r border-zinc-800/70 last:border-r-0 px-2 py-2 text-center text-[10px] text-zinc-700 align-middle" data-testid="tt-free">—</td>;
                                            return (
                                                <td key={d.date} rowSpan={cell.span} className="border-b border-r border-zinc-800/70 last:border-r-0 p-1.5 align-top">
                                                    <div className="space-y-1.5">
                                                        {cell.items.map((x, i) => {
                                                            const clash = clashIds.has(`${x.facultyId}|${x._id}`);
                                                            const st = STATUS[x.planStatus || ""] || null;
                                                            return (
                                                                <div key={(x._id || "") + i} className={`rounded-xl border p-2 ${clash ? "border-red-500/60 bg-red-500/10" : colour(x.facultyId)}`} data-testid="tt-card">
                                                                    <p className="text-[10px] font-bold text-zinc-300">{fmt12(x.timeStart)} – {fmt12(x.timeStop)}</p>
                                                                    <p className="text-[12px] font-bold text-white leading-snug [overflow-wrap:anywhere]">{x.subjectName || "Class"}</p>
                                                                    <p className="text-[10px] font-semibold text-amber-200/90 [overflow-wrap:anywhere]">{x.facultyName}{x.facultyId === currentUserId ? " (You)" : ""}</p>
                                                                    {classLabel(x) && <p className="text-[10px] text-zinc-300 [overflow-wrap:anywhere]">{classLabel(x)}</p>}
                                                                    {x.topics && <p className="text-[10px] text-zinc-400 line-clamp-2 [overflow-wrap:anywhere]">{x.topics}</p>}
                                                                    {(st || clash) && (
                                                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                                                            {st && <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${st.cls}`}>{["LOCKED", "LOCKED_AGAIN", "UNLOCK_REQUESTED"].includes(x.planStatus || "") && <Lock size={8} className="inline -mt-0.5 mr-0.5" />}{st.label}</span>}
                                                                            {clash && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Conflict</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {exportError && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {exportError}</p>}

            {/* Download sheet (kept off screen; drawn into the PDF / PNG) */}
            {rows.length > 0 && (
                <div aria-hidden="true" style={{ position: "fixed", left: "-100000px", top: 0, pointerEvents: "none" }}>
                    <div ref={sheetRef} style={{ width: 1400, background: "#ffffff", padding: 16, fontFamily: "Inter, Arial, sans-serif", color: "#18181b" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #27272a", fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 130, background: "#ffcc66", border: "2px solid #27272a", padding: "10px 6px", fontSize: 12, fontWeight: 900, lineHeight: 1.25 }}>
                                        GoG &lt;&gt; {college?.name || "College"}
                                        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>[{weekText}]</div>
                                    </th>
                                    <th colSpan={weekDates.length} style={{ background: "#f4f4f5", border: "2px solid #27272a", padding: "12px 8px", fontSize: 18, fontWeight: 900, textAlign: "center" }}>
                                        Sprint Plan - {college?.name || "College"} &lt;&gt; GoG{filterText ? ` : ${filterText}` : ""}
                                        {timing && <div style={{ fontSize: 11, fontWeight: 700, color: "#52525b", marginTop: 3 }}>College Timings: {fmt12(timing.startTime)} – {fmt12(timing.endTime)}</div>}
                                    </th>
                                </tr>
                                <tr>
                                    <th style={{ background: "#e4e4e7", border: "1px solid #27272a", padding: "8px 4px", fontSize: 11, fontWeight: 900 }}>TIME / DAY</th>
                                    {weekDates.map(d => (
                                        <th key={d.date} style={{ background: "#bfe0f7", border: "1px solid #27272a", padding: "8px 4px", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
                                            {d.day}<div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>{d.date.slice(8)}/{d.date.slice(5, 7)}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((m, r) => (
                                    <tr key={m}>
                                        <td style={{ background: "#f4f4f5", border: "1px solid #a1a1aa", padding: "8px 6px", fontWeight: 900, fontSize: 11, textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}>
                                            {fmt12(fromMin(m))} – {fmt12(fromMin(bounds[r + 1]))}
                                        </td>
                                        {weekDates.map(d => {
                                            const cell = layout.get(d.date)?.get(r);
                                            if (cell === "covered") return null;
                                            if (!cell) return <td key={d.date} style={{ border: "1px solid #d4d4d8", textAlign: "center", color: "#d4d4d8", fontSize: 11 }}>—</td>;
                                            return (
                                                <td key={d.date} rowSpan={cell.span} style={{ border: "1px solid #d4d4d8", padding: 5, verticalAlign: "top" }}>
                                                    {cell.items.map((x, i) => {
                                                        const t = sheetTheme(x.facultyId);
                                                        return (
                                                            <div key={(x._id || "") + i} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 7px", marginTop: i ? 5 : 0, color: t.text }}>
                                                                <div style={{ fontSize: 10, fontWeight: 800, color: t.sub }}>{fmt12(x.timeStart)} – {fmt12(x.timeStop)}</div>
                                                                <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.25 }}>{x.subjectName || "Class"}</div>
                                                                {x.topics && <div style={{ fontSize: 10, fontWeight: 600, color: t.sub }}>{x.topics}</div>}
                                                                <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2 }}>{x.facultyName}{classLabel(x) ? ` · ${classLabel(x)}` : ""}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <p className="text-[10px] text-zinc-600 px-1">
                Rows follow the real class times{timing ? " and the college hours" : ""}. Only your college is shown.{lastLoaded ? ` Updated ${lastLoaded.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · refreshes automatically.` : ""}
            </p>
        </div>
    );
}