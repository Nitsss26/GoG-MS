"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { CalendarDays, Calendar, ArrowLeft, ArrowRight, RefreshCw, X, Filter, LayoutGrid, List, ExternalLink, AlertTriangle, Building2, Network, ChevronDown, Users, BookOpen, GraduationCap, GitBranch, Layers, SlidersHorizontal, RotateCcw, Download, FileSpreadsheet, FileText, Loader2, Coffee, Clock, FlaskConical } from "lucide-react";
import * as XLSX from "xlsx";
import { CALENDAR_ROLES, PROFESSOR_ROLES, PLAN_STATUS_LABEL, PROFESSOR_EDITABLE_CLASS_STATUSES, CLASS_STATUS_LABEL, CLASS_STATUS_STYLE } from "@/lib/academic-status";
import { FACULTY_CARD_THEMES } from "@/components/academic/SprintPlanTimetableGrid";
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
const EMPTY_FILTERS: Record<string, string> = { day: "All", subject: "All", className: "All", section: "All", branch: "All", year: "All", semester: "All" };
/** Monday (YYYY-MM-DD) of the week that contains ymd */
const mondayStr = (ymd: string) => { const d = new Date(ymd + "T00:00:00Z"); const dow = d.getUTCDay(); d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); return d.toISOString().slice(0, 10); };
// College classes run in the day: a time written as 1:00–6:59 (no AM/PM, e.g. "1:05") is an afternoon time
const toMin = (t?: string) => { if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return 0; const [h, m] = t.split(":").map(Number); return (h >= 1 && h <= 6 ? h + 12 : h) * 60 + m; };
const istToday = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const shiftWeek = (ymd: string, weeks: number) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + weeks * 7); return d.toISOString().slice(0, 10); };
const dmy = (s: string) => s.split("-").reverse().join("-");

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
    const [pdfBusy, setPdfBusy] = useState(false);

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
    const options = useMemo(() => {
        const uniq = (k: string) => Array.from(new Set(classes.map(c => c[k]).filter(Boolean))).sort() as string[];
        return { subject: uniq("subjectName"), className: uniq("className"), section: uniq("section"), branch: uniq("branch"), year: uniq("year"), semester: uniq("semester") };
    }, [classes]);

    const shown = useMemo(() => classes.filter(c =>
        (filters.day === "All" || c.day === filters.day || DAYS[new Date(c.date + "T00:00:00Z").getUTCDay() - 1]?.code === filters.day) &&
        (filters.subject === "All" || c.subjectName === filters.subject) &&
        (filters.className === "All" || c.className === filters.className) &&
        (filters.section === "All" || c.section === filters.section) &&
        (filters.branch === "All" || c.branch === filters.branch) &&
        (filters.year === "All" || c.year === filters.year) &&
        (filters.semester === "All" || c.semester === filters.semester)
    ), [classes, filters]);

    // Same colour per professor across the grid (Sprint Plan timetable palette)
    const profIds = useMemo(() => Array.from(new Set(classes.map(c => c.facultyId))), [classes]);
    /** "13:05" → "1:05 PM" */
    const t12 = (s?: string) => { if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return s || ""; const m = toMin(s); const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
    const profTheme = (id: string) => Math.max(0, profIds.indexOf(id)) % FACULTY_CARD_THEMES.length;
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
        // professors appointed under the HOI whose campus HR has not set yet — never hide their classes
        if (classes.some(c => !c.college) || (data?.professors || []).some((p: any) => !p.location)) {
            list.push({ id: "__none__", name: "Campus not assigned", keys: [""] });
        }
        return list;
    }, [data?.colleges, classes]);
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
    const pendingChanges = JSON.stringify(draft) !== JSON.stringify(filters) || draftFaculty !== facultyId;
    const applyFilters = () => { setFilters(draft); setFacultyId(draftFaculty); };
    const resetFilters = () => { const d = { ...EMPTY_FILTERS }; setDraft(d); setFilters(d); setDraftFaculty("All"); setFacultyId("All"); };
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
    const downloadPdf = async () => {
        setDlOpen(false);
        const sections = multiCampusView && campus === "ALL"
            ? campusList.map(cp => ({ name: cp.name, list: shown.filter(c => campusOf(c) === cp.id) })).filter(x => x.list.length)
            : [{ name: view === "mine" ? `My Weekly Schedule — ${user.name}` : (multiCampusView && campus !== "ALL" ? campusName(campus) : collegeTitle), list: shownCampus }];
        if (!sections.length || !sections.some(x => x.list.length)) { setNotice("No classes to download for these filters."); setTimeout(() => setNotice(""), 3000); return; }
        setPdfBusy(true);
        try {
            const { jsPDF } = await import("jspdf");
            const autoTable = (await import("jspdf-autotable")).default;
            const hex = (h: string): [number, number, number] => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
            // light-mode colours of FACULTY_CARD_THEMES, e.g. "bg-[#e8c4d8]/90"
            const palette = FACULTY_CARD_THEMES.map(t => ({
                fill: hex((t.bg.match(/bg-\[#([0-9a-f]{6})\]/i) || [, "e4e4e7"])[1] as string),
                line: hex((t.border.match(/border-\[#([0-9a-f]{6})\]/i) || [, "a1a1aa"])[1] as string),
            }));
            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            const W = doc.internal.pageSize.getWidth(), M = 28;
            sections.forEach((sec, si) => {
                if (si > 0) doc.addPage();
                // Title band
                doc.setFillColor(179, 134, 0); doc.roundedRect(M, M, 150, 40, 4, 4, "F");
                doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
                doc.text("GoG Weekly Calendar", M + 75, M + 17, { align: "center" });
                doc.setFontSize(8); doc.setFont("helvetica", "normal");
                doc.text(`${dmy(data.weekStart)} to ${dmy(data.weekEnd)}`, M + 75, M + 31, { align: "center" });
                doc.setFillColor(24, 24, 27); doc.roundedRect(M + 156, M, W - 2 * M - 156, 40, 4, 4, "F");
                doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
                doc.text(sec.name, M + 170, M + 25, { maxWidth: W - 2 * M - 300 });
                doc.setFontSize(9); doc.setTextColor(161, 161, 170);
                doc.text(`${sec.list.length} class${sec.list.length === 1 ? "" : "es"}`, W - M - 14, M + 25, { align: "right" });

                const grid = rowsFor(sec.list);
                const rows = grid.rows;
                // classes of the cell that starts at [row][day] (a class spans its rows, never split)
                const cellClasses: any[][][] = rows.map((r, ri) => dates.map(d => { const at = grid.cellAt(ri, d.date); return at && at !== "covered" ? at.items : []; }));
                const body = rows.map((r, ri) => [
                    r.other ? `${r.label}\n(check time)` : r.label,
                    ...dates.flatMap((d, di) => {
                        const at = grid.cellAt(ri, d.date);
                        if (at === "covered") return [];
                        const text = cellClasses[ri][di].map(c =>
                            `${c.subjectName || c.topics || "Lecture"}\n${view === "college" ? c.facultyName : (c.className || c.branch || "")}${c.section ? ` · Sec ${c.section}` : ""}\n${c.timeStart}–${c.timeStop}`).join("\n\n") || "—";
                        return [at && at.span > 1 ? { content: text, rowSpan: at.span } : text];
                    }),
                ]);
                autoTable(doc, {
                    startY: M + 50,
                    margin: { left: M, right: M },
                    head: [["TIME / DAY", ...dates.map(d => `${d.code}\n${d.date.split("-").reverse().slice(0, 2).join("/")}`)]],
                    body,
                    theme: "grid",
                    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 4, valign: "middle", halign: "center", lineColor: [212, 212, 216], lineWidth: 0.6, textColor: [39, 39, 42], overflow: "linebreak" },
                    headStyles: { fillColor: [26, 56, 82], textColor: [224, 242, 254], fontStyle: "bold", fontSize: 8.5, halign: "center" },
                    columnStyles: { 0: { cellWidth: 74, fontStyle: "bold", fillColor: [244, 244, 245], textColor: [24, 24, 27] } },
                    didParseCell: (h: any) => {
                        if (h.section !== "body") return;
                        const r = rows[h.row.index];
                        if (r.isLunch) { h.cell.styles.fillColor = h.column.index === 0 ? [102, 59, 20] : [254, 243, 199]; h.cell.styles.textColor = h.column.index === 0 ? [254, 243, 199] : [146, 64, 14]; h.cell.styles.fontStyle = "bold"; return; }
                        if (h.column.index === 0) return;
                        const list = cellClasses[h.row.index][h.column.index - 1];
                        if (!list.length) { h.cell.styles.textColor = [161, 161, 170]; return; }
                        h.cell.styles.fillColor = palette[profTheme(list[0].facultyId)].fill;
                        h.cell.styles.textColor = [24, 24, 27];
                    },
                    didDrawCell: (h: any) => {
                        if (h.section !== "body" || h.column.index === 0 || rows[h.row.index].isLunch) return;
                        const list = cellClasses[h.row.index][h.column.index - 1];
                        if (!list.length) return;
                        // coloured left edge = professor colour
                        doc.setFillColor(...palette[profTheme(list[0].facultyId)].line);
                        doc.rect(h.cell.x, h.cell.y, 3, h.cell.height, "F");
                    },
                });
                // Professor colour legend
                const profs = Array.from(new Map(sec.list.map(c => [c.facultyId, c.facultyName])).entries());
                let y = (doc as any).lastAutoTable.finalY + 14, x = M;
                if (view === "college" && profs.length) {
                    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(82, 82, 91);
                    doc.text("PROFESSORS:", x, y + 7); x += 64;
                    doc.setFont("helvetica", "normal");
                    profs.forEach(([id, name]) => {
                        const w = doc.getTextWidth(String(name)) + 22;
                        if (x + w > W - M) { x = M + 64; y += 14; }
                        const p = palette[profTheme(id)];
                        doc.setFillColor(...p.fill); doc.setDrawColor(...p.line); doc.roundedRect(x, y, 10, 10, 2, 2, "FD");
                        doc.setTextColor(39, 39, 42); doc.text(String(name), x + 14, y + 8);
                        x += w;
                    });
                }
            });
            const pages = doc.getNumberOfPages();
            for (let i = 1; i <= pages; i++) {
                doc.setPage(i); doc.setFontSize(7); doc.setTextColor(161, 161, 170);
                doc.text(`Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 14, { align: "right" });
            }
            doc.save(`Weekly_Calendar_${campus === "ALL" || !multiCampusView ? (multiCampusView ? "All_Campuses" : "My_Schedule") : campusName(campus).replace(/\s+/g, "_")}_${data?.weekStart}.pdf`);
        } catch (e: any) {
            setNotice(`Could not create the PDF: ${e.message}`); setTimeout(() => setNotice(""), 4000);
        } finally {
            setPdfBusy(false);
        }
    };

    // ── Timetable (same look and colours as the Sprint Plan timetable). compact = all-campuses overview ──
    const Timetable = ({ list, compact, title, badge }: { list: any[]; compact?: boolean; title?: string; badge?: string }) => {
        const grid = rowsFor(list);
        const rows = grid.rows;
        const profsHere = Array.from(new Map(list.map(c => [c.facultyId, c.facultyName])).entries());
        // Full-size timetable in the Sprint Management design (dark cards, coloured edge, Free Period cells).
        // Colour = professor in the college view, = subject in "My Schedule". Same design for the campus overview (compact).
        const colorKeys = showProfessor
            ? profsHere.map(([id]) => String(id))
            : Array.from(new Set([...list].sort((x, y) => (x.date + x.timeStart).localeCompare(y.date + y.timeStart)).map(c => String(c.subjectName || c.topics || "Lecture").toLowerCase())));
        const colorOf = (c: any) => CARD_COLORS[Math.max(0, colorKeys.indexOf(showProfessor ? String(c.facultyId) : String(c.subjectName || c.topics || "Lecture").toLowerCase())) % CARD_COLORS.length];
        const shortDate = (ymd: string) => new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        return (
            <div className={compact ? "bg-zinc-950/40" : "rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden"} data-testid="calendar-grid">
                {!compact && <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-900/60">
                    <p className="text-sm font-bold text-white min-w-0">{title}<span className="ml-2 text-[11px] font-semibold text-zinc-500">({list.length} class{list.length === 1 ? "" : "es"})</span></p>
                    <p className="text-[11px] text-zinc-500">{badge ? `${badge} · ` : ""}{dmy(data.weekStart)} to {dmy(data.weekEnd)}</p>
                </div>}
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-xs min-w-[860px]">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 bg-zinc-900 text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 w-[92px] border-b border-r border-zinc-800">Time</th>
                                {dates.map(d => {
                                    const isToday = d.date === today;
                                    return (
                                        <th key={d.date} className={`text-center px-2 py-2.5 border-b border-r border-zinc-800 last:border-r-0 ${isToday ? "bg-indigo-500/15" : "bg-zinc-900/80"}`} data-testid={`wc-day-${d.code}`}>
                                            <span className={`block text-[12px] font-bold ${isToday ? "text-indigo-200" : "text-white"}`}>{d.name}</span>
                                            <span className={`block text-[10.5px] font-medium ${isToday ? "text-indigo-300" : "text-zinc-500"}`}>{shortDate(d.date)}{isToday ? " · Today" : ""}</span>
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
                                    <td className={`sticky left-0 z-10 px-3 py-2.5 align-top whitespace-nowrap border-b border-r border-zinc-800 ${row.other ? "bg-zinc-800 text-zinc-300" : "bg-zinc-900 text-zinc-300"}`}>
                                        {row.label.includes(" – ") ? (
                                            <>
                                                <span className="font-semibold text-[11px]">{row.label.split(" – ")[0]}</span>
                                                <span className="block text-[10px] text-zinc-500">to {row.label.split(" – ")[1]}</span>
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
                                                                        className="relative w-full overflow-hidden rounded-lg border bg-zinc-900/90 pl-3 pr-2 py-1.5 text-left cursor-pointer hover:brightness-125 transition"
                                                                        style={{ borderColor: `${col}59`, backgroundImage: `linear-gradient(135deg, ${col}14, transparent 60%)` }}>
                                                                        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: col }} />
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
                                                                    className="relative w-full flex-1 overflow-hidden rounded-xl border bg-zinc-900/90 pl-3.5 pr-2.5 py-2.5 text-left cursor-pointer hover:brightness-125 transition"
                                                                    style={{ borderColor: `${col}59`, backgroundImage: `linear-gradient(135deg, ${col}14, transparent 60%)` }}>
                                                                    <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: col }} />
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
                                <span className="w-3 h-3 rounded-md border" style={{ background: `${CARD_COLORS[Math.max(0, colorKeys.indexOf(String(id))) % CARD_COLORS.length]}40`, borderColor: CARD_COLORS[Math.max(0, colorKeys.indexOf(String(id))) % CARD_COLORS.length] }} />
                                <span className="font-bold text-zinc-300">{name}</span>
                            </span>
                        ))}
                        <span className="sm:ml-auto text-[11px] text-zinc-500">Small label on a class = its class-record status. Click any class to see full details.</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]">
            {/* ── Header ── */}
            <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/70 via-zinc-900 to-emerald-950/50 p-5 sm:p-6">
                <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="shrink-0 w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center"><CalendarDays size={24} className="text-indigo-300" /></div>
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Weekly Calendar</h1>
                            <p className="text-xs sm:text-sm text-zinc-400">From submitted sprint plans · {multiCampusView && campus !== "ALL" ? campusName(campus) : campusList.length > 1 ? "Manage schedules across campuses" : (campusList[0]?.name || "your college")}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setWeek(w => shiftWeek(w, -1))} title="Previous week" className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"><ArrowLeft size={16} /></button>
                        <div className="relative">
                            <select value={weekPreset} onChange={e => { const v = e.target.value; setWeek(shiftWeek(istToday(), v === "last" ? -1 : v === "next" ? 1 : 0)); }}
                                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white cursor-pointer outline-none" data-testid="week-preset">
                                <option value="this">This Week</option>
                                <option value="last">Last Week</option>
                                <option value="next">Next Week</option>
                                {weekPreset === "other" && <option value="other">Other Week</option>}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                        <label className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-xs font-black text-white whitespace-nowrap cursor-pointer" data-testid="week-range" title="Pick any date to jump to its week">
                            <Calendar size={14} className="text-indigo-300" /> {data ? `${dmy(data.weekStart)} – ${dmy(data.weekEnd)}` : "…"}
                            <input type="date" value={week} onChange={e => e.target.value && setWeek(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" aria-label="Pick a week" />
                        </label>
                        <button onClick={() => setWeek(w => shiftWeek(w, 1))} title="Next week" className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"><ArrowRight size={16} /></button>
                        <button onClick={load} title="Refresh" className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
                    </div>
                    {/* decorative */}
                    <div className="hidden 2xl:flex items-end gap-2 select-none" aria-hidden>
                        <svg width="74" height="58" viewBox="0 0 74 58" fill="none">
                            <path d="M50 40 C44 28 48 14 58 6 C56 20 58 30 58 40Z" fill="#34d399" opacity=".6" />
                            <path d="M58 40 C58 24 64 12 74 6 C68 20 66 30 64 40Z" fill="#10b981" opacity=".75" />
                            <rect x="48" y="38" width="20" height="16" rx="3" fill="#0e7490" />
                            <rect x="2" y="44" width="44" height="10" rx="2" fill="#0f766e" /><rect x="5" y="35" width="40" height="9" rx="2" fill="#be185d" opacity=".85" /><rect x="1" y="27" width="42" height="8" rx="2" fill="#1d4ed8" opacity=".85" />
                        </svg>
                        <p className="text-emerald-100/80 text-sm leading-4 -rotate-6 pb-2" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>Plan · Track<br />Teach · Grow</p>
                    </div>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5" data-testid="filter-panel">
                <div className="flex items-start gap-3">
                    <div className="hidden sm:flex shrink-0 w-9 h-9 mt-5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center"><Filter size={15} className="text-indigo-300" /></div>
                    <div className={`flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 ${showProfessor ? "xl:grid-cols-[1.7fr_repeat(7,minmax(0,1fr))]" : "xl:grid-cols-4"}`}>
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
                        {showProfessor && sel("branch", "Branch", GitBranch, options.branch)}
                        {showProfessor && sel("year", "Year", Calendar, options.year)}
                        {showProfessor && sel("semester", "Semester", Layers, options.semester)}
                    </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 mt-4">
                    <button onClick={applyFilters} data-testid="apply-filters" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black active:scale-95"><SlidersHorizontal size={14} /> Apply Filters{pendingChanges ? " •" : ""}</button>
                    <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black active:scale-95"><RotateCcw size={14} /> Reset</button>
                    <div className="relative">
                        <button onClick={() => setDlOpen(o => !o)} disabled={pdfBusy} data-testid="download-report" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-black active:scale-95 disabled:opacity-60">
                            {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download <ChevronDown size={13} className={`transition-transform ${dlOpen ? "rotate-180" : ""}`} />
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

            {/* ── Campus switch (left) + My/College tabs + Calendar / List view (right) ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black transition-all ${campus === "ALL" ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.18)]" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"}`}>
                                <Network size={14} /> Show All Campuses
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
                <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                    <button onClick={() => setLayout("grid")} data-testid="view-calendar" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black ${layout === "grid" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}><LayoutGrid size={13} /> Calendar View</button>
                    <button onClick={() => setLayout("list")} data-testid="view-list" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black ${layout === "list" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}><List size={13} /> List View</button>
                </div>
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
            ) : multiCampusView && campus === "ALL" ? (
                /* All campuses: one compact timetable per campus, one below the other */
                <div className="space-y-4" data-testid="campus-sections">
                    {campusList.map((cp, i) => {
                        const list = shown.filter(c => campusOf(c) === cp.id);
                        const a = CAMPUS_ACCENTS[i % CAMPUS_ACCENTS.length];
                        return (
                            <section key={cp.id} className={`rounded-2xl border-2 ${a.border} bg-zinc-950/40 overflow-hidden`} data-testid="campus-section">
                                <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${a.headBg}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${a.iconBg}`}><Building2 size={18} className={a.text} /></span>
                                        <h2 className="text-base sm:text-lg font-black text-white truncate">{cp.name}</h2>
                                        <span className={`shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-black ${a.pill}`}>{list.length} class{list.length === 1 ? "" : "es"}</span>
                                    </div>
                                    <button onClick={() => { setCampus(cp.id); setFacultyId("All"); window.scrollTo({ top: 0, behavior: "smooth" }); }} data-testid="view-campus"
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[11px] font-black transition-all hover:brightness-125 ${a.btn}`}>
                                        View Campus Details <ArrowRight size={13} />
                                    </button>
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
                    badge={multiCampusView && campus !== "ALL" ? campusName(campus) : collegeTitle} />
            )}

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
                                        <Link href={`/faculty/lectures?date=${selected.date}&lecture=${selected.lectureNumber}`} data-testid="complete-class"
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