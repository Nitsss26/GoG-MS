"use client";

import { dmy as toDmy, dmyTime as toDmyTime } from "@/lib/date-display";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
    FileText, Calendar, Users, Camera, Mic, AlertTriangle, CheckCircle2, BookOpen, Clock, X,
    Search, RotateCcw, Download, Loader2, ChevronDown, BarChart3, XCircle, Link2, Image as ImageIcon,
    Eye, Upload, ClipboardList, MoreVertical, Sparkles, CalendarDays, Info, ExternalLink, Plus,
    Building2, Pencil,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ClassRecordDetails, ClassRecordActions } from "@/components/academic/ClassRecordDetails";
import LectureTable, { LectureDrawer, RowButton, toLectureRow } from "@/components/academic/LectureTable";
import AddAssignmentDialog from "@/components/academic/AddAssignmentDialog";
import LectureReportForm from "@/components/academic/LectureReportForm";

/**
 * My Class Records (Lecture Report) — history of the professor's classes with attendance, notes,
 * assignments, attachments and the verification status. Data: /api/faculty/lectures (own lectures only).
 */
interface ReportEntry {
    _id?: string;
    lectureNumber: number;
    courseName: string;
    topicsCovered: string;
    date: string;
    stream: string;
    year: string;
    semester: string;
    numberOfAttendees: number;
    totalStudents: number;
    classStartTime: string;
    classEndTime: string;
    actualDurationMinutes: number;
    scheduledDuration: number;
    recordingUrl: string;
    classPhotoUrl: string;
    status: string;
    warnings: string[];
    summary?: string;
    transcription?: string;
    aiAnalysisAt?: string;
    analysis?: {
        segmentedReport: {
            timeSegment: string;
            topic: string;
            score: number;
            observations: string;
        }[];
        sentimentAnalysis: string;
        deadAirAlerts: string[];
        complianceCheck: {
            opening: boolean;
            engagement: boolean;
            accuracy: boolean;
        };
        finalScorecard: {
            clarity: number;
            engagement: number;
            accuracy: number;
            totalAuditScore: number;
        };
    };
    keywords?: string[];
    timeStart?: string;
    timeStop?: string;
}

type Row = ReportEntry & { [key: string]: any };

const todayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const shiftDays = (ymd: string, n: number) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtShort = (ymd?: string) => ymd ? toDmy(ymd) : "";
const dmy = (ymd: string) => toDmy(ymd);

export default function LectureReportPage() {
    const { user } = useAuth();
    const [allReports, setReports] = useState<Row[]>([]);
    // multi-college professor: All colleges or one college (from the API; empty for one college)
    const [colleges, setColleges] = useState<{ id: string; name: string; keys: string[] }[]>([]);
    const [colFilter, setColFilter] = useState("ALL");
    const reports = useMemo(() => {
        const c = colleges.find(x => x.id === colFilter);
        return !c ? allReports : allReports.filter((r: any) => c.keys.includes(String(r.college || r.report?.college || "")));
    }, [allReports, colleges, colFilter]);
    const [loading, setLoading] = useState(true);
    const [aiInsightReport, setAiInsightReport] = useState<ReportEntry | null>(null);
    const [pollingCount, setPollingCount] = useState(0);

    // filters: inputs + applied range
    const [fromInput, setFromInput] = useState(shiftDays(todayYmd(), -30));
    const [toInput, setToInput] = useState(todayYmd());
    const [range, setRange] = useState({ from: shiftDays(todayYmd(), -30), to: todayYmd() });

    const [asgFor, setAsgFor] = useState<Row | null>(null);
    // Submit / re-submit: the report form opens here as a side panel (same form as My Lectures)
    const [reportFor, setReportFor] = useState<Row | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number; up: boolean }>({ top: 0, right: 0, up: false });
    const [message, setMessage] = useState("");
    const [exporting, setExporting] = useState(false);
    const [nowTick, setNowTick] = useState(Date.now());

    // Links from notifications / Weekly Calendar (?date=YYYY-MM-DD&lecture=N): show that day and open its report form
    const deepLink = useRef<{ date: string; lecture: string } | null>(null);
    useEffect(() => {
        try {
            const sp = new URLSearchParams(window.location.search);
            const d = sp.get("date");
            if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
            deepLink.current = { date: d, lecture: sp.get("lecture") || "" };
            if (d < range.from || d > range.to) {
                const f = d < range.from ? d : range.from, t = d > range.to ? d : range.to;
                setFromInput(f); setToInput(t); setRange({ from: f, to: t });
            }
        } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        const dl = deepLink.current;
        if (!dl || loading) return;
        const r = reports.find(x => x.date === dl.date && (!dl.lecture || String(x.lectureNumber) === dl.lecture));
        if (!r) return;
        deepLink.current = null;
        const st = r.pipelineStatus || "PENDING_PROFESSOR";
        if (r.sprintEntryId && (st === "PENDING_PROFESSOR" || st === "OM_REVERTED" || st === "CL_CH_REVERTED" || st === "PENDING_OM")) setReportFor(r);
    }, [reports, loading]);

    useEffect(() => { if (user?.id) fetchReports(); }, [user, range, pollingCount]);
    useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 60000); return () => clearInterval(t); }, []);

    // Polling for AI analysis
    useEffect(() => {
        const needsPolling = allReports.some(r => (r.report?.recordingUrl || r.recordingUrl) && !(r.report?.aiAnalysisAt || r.aiAnalysisAt));
        if (needsPolling) {
            const timer = setTimeout(() => setPollingCount(prev => prev + 1), 5000);
            return () => clearTimeout(timer);
        }
    }, [allReports]);

    useEffect(() => {
        if (!menuFor) return;
        const close = () => setMenuFor(null);
        window.addEventListener("click", close);
        window.addEventListener("wheel", close, { passive: true });
        window.addEventListener("touchmove", close, { passive: true });
        window.addEventListener("resize", close);
        return () => { window.removeEventListener("click", close); window.removeEventListener("wheel", close); window.removeEventListener("touchmove", close); window.removeEventListener("resize", close); };
    }, [menuFor]);

    const latest = useRef(0);
    const fetchReports = async () => {
        const no = ++latest.current;
        if (!pollingCount) setLoading(true);
        try {
            const q = range.from === range.to ? `date=${range.from}` : `startDate=${range.from}&endDate=${range.to}`;
            const res = await fetch(`/api/faculty/lectures?facultyId=${user?.id}&${q}`);
            const data = await res.json();
            if (no !== latest.current) return;
            // newest first
            setReports((data.lectures || []).slice().sort((a: Row, b: Row) => (b.date + (b.timeStart || "")).localeCompare(a.date + (a.timeStart || ""))));
            setColleges(Array.isArray(data.colleges) ? data.colleges : []);
        } catch (e) {
            console.error(e);
        } finally {
            if (no === latest.current) setLoading(false);
        }
    };

    // ── derived ──
    const rep = (r: Row) => (r.report || r) as any; // planned rows carry the record in .report; old rows are the record
    const isRecorded = (r: Row) => !!r.report ? (r.report.status === "Completed" || (r.pipelineStatus && r.pipelineStatus !== "PENDING_PROFESSOR")) : r.status === "Completed";
    const keyOf = (r: Row) => `${r.date}#${r.lectureNumber}#${r._id || ""}`;
    // Table rows: old rows (the record itself, no .report) are treated as recorded, exactly like before
    const rows = useMemo(() => reports.map(r => {
        const legacy = !r.report && r.status === "Completed";
        const row = toLectureRow({ ...r, report: legacy ? r : r.report, classEnded: r.classEnded ?? true }, "lecture");
        return { ...row, key: keyOf(r), raw: r };
    }), [reports, nowTick]); // eslint-disable-line react-hooks/exhaustive-deps
    const counts = useMemo(() => ({
        total: rows.length,
        submitted: rows.filter(r => r.report === "SUBMITTED" || r.report === "VERIFIED").length,
        pending: rows.filter(r => r.report === "PENDING").length,
        reverted: rows.filter(r => r.report === "REVERTED").length,
        upcoming: rows.filter(r => r.report === "SCHEDULED" || r.report === "IN_PROGRESS").length,
    }), [rows]);
    const [drawerKey, setDrawerKey] = useState<string | null>(null);
    const drawerRow = drawerKey ? rows.find(r => r.key === drawerKey) || null : null;
    const [rangeOpen, setRangeOpen] = useState(false);

    const apply = () => {
        let a = fromInput, b = toInput;
        if (!a || !b) return;
        if (a > b) [a, b] = [b, a];
        setFromInput(a); setToInput(b);
        setRange({ from: a, to: b });
        setRangeOpen(false);
    };
    const reset = () => {
        const t = todayYmd(), f = shiftDays(t, -30);
        setFromInput(f); setToInput(t); setRange({ from: f, to: t }); setRangeOpen(false);
    };
    const preset = (from: string, to: string) => { setFromInput(from); setToInput(to); setRange({ from, to }); setRangeOpen(false); };

    const download = () => {
        if (!reports.length) { setMessage("No class records to download for this date range."); return; }
        setExporting(true);
        try {
            const out = reports.map(r => {
                const x = rep(r);
                return {
                    "Date": dmy(r.date), "Lecture #": r.lectureNumber, "Subject": r.courseName, "Topic": r.topicsCovered,
                    "Lecture Type": r.lectureType || x.lectureType || "", "Class": r.className || x.className || "", "Section": r.section || x.section || "",
                    "Stream": r.stream, "Year": r.year, "Semester": r.semester,
                    "Time": `${r.timeStart || x.classStartTime || ""} - ${r.timeStop || x.classEndTime || ""}`,
                    "Status": isRecorded(r) ? (r.pipelineStatus || "Completed") : (r.classEnded ?? true) ? "MISSED" : "PENDING",
                    "Attendees": isRecorded(r) ? x.numberOfAttendees ?? "" : "", "Total Students": isRecorded(r) ? x.totalStudents ?? "" : "",
                    "Notes": x.lectureNotes?.notesUrl || (x.notesMissing ? `Not submitted: ${x.notesMissingReason || ""}` : ""),
                    "Assignment": x.assignment?.assignmentUrl || "", "Recording": x.recordingUrl || "",
                };
            });
            const ws = XLSX.utils.json_to_sheet(out);
            ws["!cols"] = Object.keys(out[0]).map(k => ({ wch: Math.max(k.length, ...out.map((r: any) => String(r[k] ?? "").length)) + 2 }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Class Records");
            XLSX.writeFile(wb, `Class_Records_${user?.name || "Professor"}_${range.from}_to_${range.to}.xlsx`);
        } finally {
            setExporting(false);
        }
    };

    if (!user || !["FACULTY", "PROFESSOR"].includes(user.role)) {
        return <div className="flex items-center justify-center h-[80vh] text-zinc-400">Access restricted</div>;
    }

    const today = todayYmd();
    const inputCls = "w-full h-9 px-3 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]";
    const rangeText = range.from === range.to ? fmtShort(range.from) : `${fmtShort(range.from)} – ${fmtShort(range.to)}`;
    const warnRows = reports.filter(r => (rep(r).warnings || []).length > 0);
    // Reports are submitted on My Lectures (same form as before) — these links open it on the right class
    const submitHref = (r: Row) => `/faculty/lecture-report?date=${r.date}&lecture=${r.lectureNumber}`;
    const openForm = (r: Row) => { setMenuFor(null); setDrawerKey(null); setReportFor(r); };
    const isReverted = (r: Row) => ["OM_REVERTED", "CL_CH_REVERTED"].includes(r.pipelineStatus || "") && !!r.sprintEntryId;
    // submitted, OM has not verified yet → can still be edited
    const canEditPending = (r: Row) => r.pipelineStatus === "PENDING_OM" && !!r.sprintEntryId && !!r.report;
    const canSubmit = (r: Row) => (r.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR" && !!r.sprintEntryId && (r.classEnded ?? true) && !isRecorded(r);
    // "+ Add Report": the oldest class still waiting for its report, otherwise My Lectures
    const firstPending = [...reports].sort((a, b) => (a.date + (a.timeStart || "")).localeCompare(b.date + (b.timeStart || ""))).find(r => canSubmit(r) || isReverted(r));
    const open = rows.find(r => r.key === menuFor)?.raw as Row | undefined;
    const openMenu = (e: React.MouseEvent<HTMLButtonElement>, key: string) => {
        e.stopPropagation();
        const b = e.currentTarget.getBoundingClientRect();
        // the app zooms 1.1× on desktop: fixed-position values are in zoomed units
        const z = (e.currentTarget as any).currentCSSZoom || 1;
        const up = window.innerHeight - b.bottom < 240 * z;
        setMenuPos({ top: (up ? b.top - 4 : b.bottom + 4) / z, right: Math.max(8, Math.min((window.innerWidth - b.right) / z, window.innerWidth / z - 232)), up }); // keep the 224px menu on screen
        setMenuFor(menuFor === key ? null : key);
    };

    const STATS = [
        { label: "Total Lectures", value: counts.total, icon: BookOpen, ring: "border-emerald-500/30 shadow-[0_0_24px_-12px_rgba(16,185,129,0.6)]", ic: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", glow: "from-emerald-500/10" },
        { label: "Submitted", value: counts.submitted, icon: CheckCircle2, ring: "border-sky-500/30 shadow-[0_0_24px_-12px_rgba(14,165,233,0.6)]", ic: "bg-sky-500/15 text-sky-300 border-sky-500/30", glow: "from-sky-500/10" },
        { label: "Report Pending", value: counts.pending, icon: Clock, ring: "border-amber-500/35 shadow-[0_0_24px_-12px_rgba(245,158,11,0.6)]", ic: "bg-amber-500/15 text-amber-300 border-amber-500/30", glow: "from-amber-500/10" },
        { label: "Reverted", value: counts.reverted, icon: RotateCcw, ring: "border-red-500/30 shadow-[0_0_24px_-12px_rgba(239,68,68,0.6)]", ic: "bg-red-500/15 text-red-300 border-red-500/30", glow: "from-red-500/10" },
        { label: "Upcoming", value: counts.upcoming, icon: CalendarDays, ring: "border-violet-500/30 shadow-[0_0_24px_-12px_rgba(139,92,246,0.6)]", ic: "bg-violet-500/15 text-violet-300 border-violet-500/30", glow: "from-violet-500/10" },
    ];

    return (
        <div className="max-w-[1600px] mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_24px_-6px_rgba(16,185,129,0.45)]"><FileText size={22} className="text-emerald-400" /></div>
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-[28px] font-black text-white tracking-tight leading-tight">Lecture Reports</h1>
                        <p className="text-xs sm:text-sm text-zinc-400">Manage, submit and track your lecture reports, notes and assignments.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* College (only for a professor who teaches at more than one college) */}
                    {colleges.length > 1 && (
                        <label className="h-11 flex items-center gap-2.5 pl-3 pr-2 rounded-xl border border-zinc-800 bg-zinc-900/70 hover:border-emerald-500/40">
                            <Building2 size={16} className="text-emerald-400 shrink-0" />
                            <span className="min-w-0">
                                <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 leading-3">College</span>
                                <select value={colFilter} onChange={e => setColFilter(e.target.value)} data-testid="college-filter"
                                    className="block max-w-[200px] bg-zinc-900 text-xs font-bold text-white focus:outline-none [color-scheme:dark] cursor-pointer">
                                    {/* the open list uses these colours (Windows shows a white list otherwise) */}
                                    <option value="ALL" className="bg-zinc-900 text-white">All colleges</option>
                                    {colleges.map(c => <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.name}</option>)}
                                </select>
                            </span>
                        </label>
                    )}
                    {/* Date range */}
                    <div className="relative">
                        <button onClick={() => setRangeOpen(v => !v)} aria-expanded={rangeOpen} data-testid="range-button"
                            className="h-11 flex items-center gap-3 pl-3 pr-3.5 rounded-xl border border-zinc-800 bg-zinc-900/70 hover:border-emerald-500/40 text-left">
                            <Calendar size={16} className="text-emerald-400 shrink-0" />
                            <span className="min-w-0">
                                <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 leading-3">Date Range</span>
                                <span className="block text-xs font-bold text-white whitespace-nowrap" data-testid="range-text">{rangeText}</span>
                            </span>
                            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${rangeOpen ? "rotate-180" : ""}`} />
                        </button>
                        {rangeOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} />
                                <div className="absolute left-0 top-full mt-2 z-50 w-[min(290px,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-3 space-y-3" data-testid="range-popover">
                                    <div className="flex flex-wrap gap-1.5">
                                        {([["Today", today, today], ["Last 7 days", shiftDays(today, -6), today], ["Last 30 days", shiftDays(today, -30), today], ["Next 7 days", today, shiftDays(today, 6)]] as const).map(([l, a, b]) => (
                                            <button key={l} onClick={() => preset(a, b)} className="h-7 px-2.5 rounded-lg border border-zinc-800 bg-zinc-950/50 text-[11px] font-bold text-zinc-300 hover:text-white hover:border-emerald-500/40">{l}</button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="space-y-1"><span className="block text-[9.5px] font-black uppercase tracking-widest text-zinc-500">From</span><input type="date" value={fromInput} onChange={e => setFromInput(e.target.value)} className={inputCls} data-testid="date-from" /></label>
                                        <label className="space-y-1"><span className="block text-[9.5px] font-black uppercase tracking-widest text-zinc-500">To</span><input type="date" value={toInput} onChange={e => setToInput(e.target.value)} className={inputCls} data-testid="date-to" /></label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={apply} data-testid="apply" className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"><Search size={13} /> Apply</button>
                                        <button onClick={reset} className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black"><RotateCcw size={13} /> Reset</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={download} disabled={exporting} title="Download Excel report" data-testid="download"
                        className="h-11 px-3.5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 text-zinc-200 text-xs font-bold disabled:opacity-50">
                        {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} <span className="hidden sm:inline">Download</span>
                    </button>
                    <Link href={firstPending ? submitHref(firstPending) : "/faculty/lecture-report"} data-testid="add-report"
                        onClick={e => { if (firstPending) { e.preventDefault(); openForm(firstPending); } }}
                        title={firstPending ? `Next report due: ${firstPending.courseName} · ${fmtShort(firstPending.date)}` : "Open My Lectures"}
                        className="h-11 px-4 flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-black shadow-[0_0_24px_-8px_rgba(16,185,129,0.8)] active:scale-95 transition-all">
                        <Plus size={16} strokeWidth={3} /> Add Report
                    </Link>
                </div>
            </div>

            {/* ── Summary ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="record-stats">
                {STATS.map(c => (
                    <div key={c.label} className={`relative overflow-hidden flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-zinc-900/60 ${c.ring}`} data-testid="stat-card">
                        <div className={`absolute inset-0 bg-gradient-to-br ${c.glow} to-transparent pointer-events-none`} />
                        <div className={`relative shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${c.ic}`}><c.icon size={20} /></div>
                        <div className="relative min-w-0">
                            <p className="text-[11px] font-bold text-zinc-300 truncate">{c.label}</p>
                            <p className="text-[26px] font-black text-white tabular-nums leading-none mt-0.5">{loading ? "—" : c.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {message && (
                <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                    {message}<button onClick={() => setMessage("")} className="text-zinc-400 hover:text-white"><X size={14} /></button>
                </div>
            )}

            {/* ── Reports table ── */}
            <LectureTable viewKey="lecture-report"
                rows={rows}
                loading={loading}
                itemLabel="Report"
                variant="report"
                showPlanDetails
                defaultSort={{ key: "date", dir: -1 }}
                resetKey={`${range.from}|${range.to}`}
                activeKey={drawerKey}
                onOpen={(r) => { setMenuFor(null); setDrawerKey(r.key); }}
                emptyText={`No class records for ${rangeText}.`}
                renderActions={(row) => {
                    const r = row.raw as Row;
                    return (
                        <>
                            {isReverted(r) ? <button type="button" onClick={() => openForm(r)} data-testid="resubmit-report" title="Reverted to you — correct and re-submit" className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold whitespace-nowrap"><RotateCcw size={13} /> Fix &amp; Re-submit</button>
                                : canSubmit(r) ? <button type="button" onClick={() => openForm(r)} data-testid="submit-report" className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold whitespace-nowrap"><Upload size={13} /> Upload Report</button>
                                    : canEditPending(r) ? <button type="button" onClick={() => openForm(r)} data-testid="edit-report" title="Not verified by the OM yet — you can still edit it" className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold whitespace-nowrap"><Pencil size={13} /> Edit Report</button>
                                    : row.recorded ? <RowButton icon={Eye} onClick={() => setDrawerKey(row.key)} testId="view-record">View Report</RowButton>
                                        : <RowButton icon={Info} onClick={() => setDrawerKey(row.key)} testId="view-plan">View Plan</RowButton>}
                            <RowButton tone="ghost" icon={MoreVertical} title="More actions" testId="row-menu" onClick={(e) => openMenu(e, row.key)} />
                        </>
                    );
                }}
            />

            {/* Non-compliance warnings from the existing analysis */}
            {warnRows.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {warnRows.map((r, i) => (
                        <div key={i} className="flex gap-3 p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <div><p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Lec #{r.lectureNumber} · {fmtShort(r.date)}</p><p className="text-xs text-zinc-400 mt-0.5">{(rep(r).warnings || []).join(". ")}</p></div>
                        </div>
                    ))}
                </div>
            )}

            {/* ⋮ menu */}
            {open && (
                <div className="fixed z-[90] w-56 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1" data-testid="row-menu-list"
                    style={{ top: menuPos.top, right: menuPos.right, transform: menuPos.up ? "translateY(-100%)" : undefined }} onClick={e => e.stopPropagation()}>
                    {(() => {
                        const x = rep(open);
                        const item = (Icon: any, text: string, fn: () => void, disabled = false) => (
                            <button key={text} disabled={disabled} onClick={() => { fn(); setMenuFor(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 text-left">
                                <Icon size={13} className="text-zinc-400 shrink-0" /> {text}
                            </button>
                        );
                        return (<>
                            {item(Info, isRecorded(open) ? "View class record" : "Lecture details", () => setDrawerKey(keyOf(open)))}
                            {canSubmit(open) && item(Upload, "Upload report", () => openForm(open))}
                            {isReverted(open) && item(RotateCcw, "Fix & re-submit report", () => openForm(open))}
                            {canEditPending(open) && item(Pencil, "Edit report (before OM verification)", () => openForm(open))}
                            {open.date <= today && item(ClipboardList, x.assignment?.hasAssignment ? "Update assignment" : "Add assignment", () => setAsgFor(open))}
                            {x.recordingUrl && item(Sparkles, x.aiAnalysisAt ? "AI insights" : "AI insights (processing…)", () => setAiInsightReport({ ...x, lectureNumber: open.lectureNumber, courseName: open.courseName }), !x.aiAnalysisAt)}
                            {x.lectureNotes?.notesUrl && item(ExternalLink, "Open notes", () => window.open(x.lectureNotes.notesUrl, "_blank", "noopener"))}
                            {x.assignment?.assignmentUrl && item(ExternalLink, "Open assignment", () => window.open(x.assignment.assignmentUrl, "_blank", "noopener"))}
                            {x.recordingUrl && item(Mic, "Open recording", () => window.open(x.recordingUrl, "_blank", "noopener"))}
                            {item(CalendarDays, "Open in Weekly Calendar", () => { window.location.href = `/academic/weekly-calendar?week=${open.date}`; })}
                        </>);
                    })()}
                </div>
            )}

            {/* Lecture details drawer: class record (verification, comments, history) + existing actions */}
            <LectureDrawer row={drawerRow} onClose={() => setDrawerKey(null)}
                actions={drawerRow && (() => {
                    const r = drawerRow.raw as Row;
                    const x = rep(r);
                    return (<>
                        {isReverted(r) && <button type="button" onClick={() => openForm(r)} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold" data-testid="drawer-resubmit"><RotateCcw size={13} /> Fix &amp; Re-submit</button>}
                        {canSubmit(r) && <button type="button" onClick={() => openForm(r)} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold" data-testid="drawer-submit"><Upload size={13} /> Upload Report</button>}
                        {canEditPending(r) && <button type="button" onClick={() => openForm(r)} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold" data-testid="drawer-edit"><Pencil size={13} /> Edit Report</button>}
                        {r.date <= today && <RowButton icon={ClipboardList} onClick={() => setAsgFor(r)} testId="drawer-assignment">{x.assignment?.hasAssignment ? "Update Assignment" : "Upload Assignment"}</RowButton>}
                        {x.recordingUrl && <RowButton icon={Sparkles} disabled={!x.aiAnalysisAt} onClick={() => setAiInsightReport({ ...x, lectureNumber: r.lectureNumber, courseName: r.courseName })}>{x.aiAnalysisAt ? "AI Insights" : "AI processing…"}</RowButton>}
                        <RowButton icon={CalendarDays} onClick={() => { window.location.href = `/academic/weekly-calendar?week=${r.date}`; }}>Weekly Calendar</RowButton>
                    </>);
                })()}>
                {drawerRow && (() => {
                    const r = drawerRow.raw as Row;
                    if (r.report && isRecorded(r)) return (
                        <>
                            <ClassRecordDetails record={{ facultyName: user.name, courseName: r.courseName, topicsCovered: r.topicsCovered, className: r.className, section: r.section, stream: r.stream, year: r.year, semester: r.semester, date: r.date, ...r.report, pipelineStatus: r.pipelineStatus, timeStart: r.timeStart, timeStop: r.timeStop }} />
                            <ClassRecordActions
                                record={{ ...r.report, _id: r.report._id, pipelineStatus: r.pipelineStatus, classEnded: true }}
                                role={user.role} userId={user.id}
                                onDone={(m) => { setMessage(m); setDrawerKey(null); fetchReports(); }} />
                        </>
                    );
                    if (!r.report && isRecorded(r)) return (
                        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400">Older class record — attendance {r.numberOfAttendees ?? "—"} / {r.totalStudents ?? "—"}.{r.recordingUrl ? " A recording is attached (see AI Insights)." : ""}</p>
                    );
                    return (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400" data-testid="drawer-no-record">
                            {!r.sprintEntryId ? "This class is not linked to a sprint plan entry."
                                : (r.classEnded ?? true) ? <>The class has ended. Submit the class record with <b className="text-emerald-300">Submit Report</b> — it opens the report form on My Lectures.</>
                                    : <>The class record can be submitted after the class ends ({r.timeStop}).</>}
                        </div>
                    );
                })()}
            </LectureDrawer>

            {reportFor && (
                <LectureReportForm lecture={reportFor as any} facultyId={user.id} fallbackDate={reportFor.date}
                    onClose={() => setReportFor(null)}
                    onSubmitted={(m) => { setReportFor(null); setMessage(m); fetchReports(); }} />
            )}

            {asgFor && (
                <AddAssignmentDialog lecture={asgFor} facultyId={user.id} onClose={() => setAsgFor(null)}
                    onSaved={(m) => { setAsgFor(null); setMessage(m); fetchReports(); }} />
            )}

            {/* AI Insight Modal */}
            {aiInsightReport && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
                    onClick={() => setAiInsightReport(null)}>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
                        onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                    <CheckCircle2 size={24} className="text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white italic tracking-tight">Session <span className="text-amber-500">Intelligence</span></h2>
                                    <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest mt-1">Lec #{aiInsightReport.lectureNumber} • {aiInsightReport.courseName}</p>
                                </div>
                            </div>
                            <button onClick={() => setAiInsightReport(null)} 
                                className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl transition-all hover:scale-110 active:scale-95">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                            
                            {/* NEW: Audit Scorecards & Compliance */}
                            {aiInsightReport.analysis && (
                                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-xl">
                                        <h3 className="text-amber-500 font-black text-[10px] uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                            Audit Scorecard
                                        </h3>
                                        <div className="grid grid-cols-3 gap-8">
                                            {[
                                                { label: "Clarity", val: aiInsightReport.analysis.finalScorecard.clarity, color: "text-blue-400" },
                                                { label: "Engagement", val: aiInsightReport.analysis.finalScorecard.engagement, color: "text-emerald-400" },
                                                { label: "Accuracy", val: aiInsightReport.analysis.finalScorecard.accuracy, color: "text-indigo-400" }
                                            ].map((s, idx) => (
                                                <div key={idx} className="text-center space-y-2">
                                                    <div className="text-3xl font-black text-white tabular-nums">{s.val}<span className="text-zinc-700 text-sm">/10</span></div>
                                                    <div className={`text-[9px] font-black uppercase tracking-widest ${s.color}`}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-8 pt-8 border-t border-zinc-800/50 flex items-center justify-between">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Audit Score</div>
                                            <div className="text-2xl font-black text-amber-500 tabular-nums">
                                                {aiInsightReport.analysis.finalScorecard.totalAuditScore}<span className="text-zinc-800 text-xs">/30</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-xl space-y-6">
                                        <h3 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.4em] mb-2">Compliance Markers</h3>
                                        <div className="space-y-4">
                                            {[
                                                { label: "Learning Objectives Stated", ok: aiInsightReport.analysis.complianceCheck.opening },
                                                { label: "Periodic Engagement Check", ok: aiInsightReport.analysis.complianceCheck.engagement },
                                                { label: "Curriculum Alignment", ok: aiInsightReport.analysis.complianceCheck.accuracy }
                                            ].map((c, idx) => (
                                                <div key={idx} className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-zinc-400">{c.label}</span>
                                                    {c.ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <X size={16} className="text-red-500" />}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-4 border-t border-zinc-800/50">
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Faculty Tone</span>
                                            <p className="text-xs font-bold text-white italic capitalize">{aiInsightReport.analysis.sentimentAnalysis}</p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* NEW: Segmented Timeline Report */}
                            {aiInsightReport.analysis?.segmentedReport && (
                                <section>
                                    <h3 className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                        Chronological Audit Breakdown
                                    </h3>
                                    <div className="rounded-[2rem] border border-zinc-800 overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="bg-zinc-900 border-b border-zinc-800">
                                                    <th className="p-5 font-black text-zinc-500 uppercase tracking-widest w-40">Time Segment</th>
                                                    <th className="p-5 font-black text-zinc-500 uppercase tracking-widest">Topic Covered</th>
                                                    <th className="p-5 font-black text-zinc-500 uppercase tracking-widest text-center">Score</th>
                                                    <th className="p-5 font-black text-zinc-500 uppercase tracking-widest">Auditor Observations</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800/50">
                                                {aiInsightReport.analysis.segmentedReport.map((seg, idx) => (
                                                    <tr key={idx} className="bg-zinc-950/20">
                                                        <td className="p-5 font-bold text-zinc-400 tabular-nums">{seg.timeSegment}</td>
                                                        <td className="p-5 font-black text-white">{seg.topic}</td>
                                                        <td className="p-5 text-center">
                                                            <span className={`px-2 py-1 rounded font-black ${seg.score >= 8 ? 'text-emerald-400 bg-emerald-500/10' : seg.score >= 5 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'}`}>
                                                                {seg.score}/10
                                                            </span>
                                                        </td>
                                                        <td className="p-5 text-zinc-500 font-medium italic">{seg.observations}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            {/* Dead Air Alerts */}
                            {aiInsightReport.analysis?.deadAirAlerts && aiInsightReport.analysis.deadAirAlerts.length > 0 && (
                                <section className="p-6 bg-red-500/5 border border-red-500/10 rounded-[2rem]">
                                    <h3 className="text-red-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                                        <AlertTriangle size={14} />
                                        Engagement Alerts (Dead Air Detected)
                                    </h3>
                                    <div className="flex flex-wrap gap-3">
                                        {aiInsightReport.analysis.deadAirAlerts.map((alert, idx) => (
                                            <span key={idx} className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-bold text-red-400">
                                                {alert}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Summary Section */}
                            <section>
                                <h3 className="text-amber-500 font-black text-[10px] uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                    AI Executive Summary
                                </h3>
                                <div className="prose prose-invert max-w-none">
                                    <div className="p-8 rounded-[2rem] bg-zinc-900/50 border border-zinc-800 text-zinc-300 text-sm leading-relaxed font-medium whitespace-pre-wrap shadow-inner relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full group-hover:bg-amber-500/10 transition-colors" />
                                        {aiInsightReport.summary || "No summary available for this session."}
                                    </div>
                                </div>
                            </section>

                            {/* Keywords / Vocabulary */}
                            {aiInsightReport.keywords && aiInsightReport.keywords.length > 0 && (
                                <section className="animate-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-emerald-400 font-black text-[10px] uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        Technical Vocabulary
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {aiInsightReport.keywords.map((kw: string, idx: number) => (
                                            <span key={idx} className="px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:border-emerald-500/30 transition-all cursor-default">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Transcription Section */}
                            <section>
                                <h3 className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                    Full Session Transcript
                                </h3>
                                <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-zinc-800/50 text-zinc-400 text-xs leading-loose italic min-h-[400px] whitespace-pre-wrap shadow-inner">
                                    {aiInsightReport.transcription || "Transcription is empty or could not be generated."}
                                </div>
                            </section>

                            {/* Metadata */}
                            <div className="pt-6 border-t border-zinc-800 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                <span>Engine: Gemini 1.5 Flash</span>
                                <span>Analyzed: {aiInsightReport.aiAnalysisAt ? toDmyTime(aiInsightReport.aiAnalysisAt) : "N/A"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}