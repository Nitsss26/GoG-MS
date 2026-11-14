"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef, useMemo } from "react";
import {
    Play, Square, Clock, Timer, AlertTriangle, CheckCircle2,
    BookOpen, Upload, Camera, FileText, Mic, Users, X, Loader2,
    Calendar, Download, GraduationCap, Building2, ChevronDown, Search, RotateCcw,
    CalendarDays, Eye, MoreVertical, Info, ClipboardList, ExternalLink, Plus
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ClassRecordDetails, ClassRecordActions } from "@/components/academic/ClassRecordDetails";
import AddAssignmentDialog from "@/components/academic/AddAssignmentDialog";
import LectureTable, { LectureDrawer, RowButton, toLectureRow } from "@/components/academic/LectureTable";
import LectureReportForm from "@/components/academic/LectureReportForm";
import { PROFESSOR_EDITABLE_CLASS_STATUSES, DEFAULT_CLASS_STRENGTH } from "@/lib/academic-status";

interface Lecture {
    _id?: string;
    lectureNumber: number;
    sprintPlanId?: string;
    courseName: string;
    topicsCovered: string;
    subjectCode?: string;
    stream?: string;
    year?: string;
    semester?: string;
    timeStart: string;
    timeStop: string;
    scheduledDuration: number;
    status: string;
    date: string;
    // Class record pipeline (from the sprint plan entry)
    sprintEntryId?: string;
    pipelineStatus?: string;
    classEnded?: boolean;
    defaultTotalStudents?: number;
    section?: string;
    className?: string;
    lectureType?: string;
    unitNumber?: string;
    report?: {
        _id?: string;
        numberOfAttendees?: number;
        totalStudents?: number;
        recordingUrl?: string;
        classPhotoUrl?: string;
        warnings?: string[];
        summary?: string;
        transcription?: string;
        keywords?: string;
        aiAnalysisAt?: string;
        status?: string;
        actualInTime?: string;
        actualOutTime?: string;
        isLate?: boolean;
        remarksWhyLate?: string;
        lectureNotes?: {
            notesUrl?: string;
            notesContent?: string;
            isSharedWithStudents?: boolean;
            notSharedRemarks?: string;
            verificationStatus?: string;
            leadRemarks?: string;
        };
        assignment?: {
            hasAssignment?: boolean;
            title?: string;
            description?: string;
            assignmentUrl?: string;
            deadline?: string;
            studentsCompletedCount?: number;
            totalStudentsExpected?: number;
            verificationStatus?: string;
            leadRemarks?: string;
            isSharedInProfGroup?: boolean;
        };
        clVerificationStatus?: string;
        clRemarks?: string;
        [key: string]: any;
    } | null;
}

export default function LecturesPage() {
    const { user } = useAuth();
    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

    // Report form (side panel): which lecture
    const [showReport, setShowReport] = useState<number | null>(null);
    const [reportLec, setReportLec] = useState<Lecture | null>(null);
    const [drawerKey, setDrawerKey] = useState<string | null>(null);
    const [openLectureParam, setOpenLectureParam] = useState<number | null>(null);

    // Date state for schedule and export
    // The list shows selectedDate → rangeEnd (one day by default). startDate / endDate are the inputs (Apply / Download).
    const todayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const [selectedDate, setSelectedDate] = useState(todayYmd());
    const [rangeEnd, setRangeEnd] = useState(todayYmd());
    const [startDate, setStartDate] = useState(todayYmd());
    const [endDate, setEndDate] = useState(todayYmd());
    const [exportLoading, setExportLoading] = useState(false);
    const [campusName, setCampusName] = useState("");
    const [todayCount, setTodayCount] = useState<number | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number; up: boolean }>({ top: 0, right: 0, up: false });
    const [asgFor, setAsgFor] = useState<Lecture | null>(null);
    const [nowTick, setNowTick] = useState(Date.now());
    const [rangeOpen, setRangeOpen] = useState(false); // Date Range popover

    useEffect(() => {
        if (user?.id) fetchLectures();
    }, [user, selectedDate, rangeEnd]);

    // "Starts in …" counters
    useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 60000); return () => clearInterval(t); }, []);

    // Assigned campus name + today's lecture count (independent of the chosen range)
    useEffect(() => {
        if (!user?.id) return;
        const loc = (user as any).location;
        if (loc) fetch("/api/locations").then(r => r.ok ? r.json() : []).then((list: any[]) => {
            const l = (Array.isArray(list) ? list : []).find((x: any) => x.id === loc || x.name === loc || x.shortName === loc);
            setCampusName(l?.name || loc);
        }).catch(() => setCampusName(loc));
        fetch(`/api/faculty/lectures?facultyId=${user.id}&date=${todayYmd()}`).then(r => r.json()).then(d => setTodayCount((d.lectures || []).length)).catch(() => { });
    }, [user?.id]);

    // Close the ⋮ menu on outside click
    useEffect(() => {
        if (!menuFor) return;
        const close = () => setMenuFor(null);
        window.addEventListener("click", close);
        // the menu is fixed-positioned, so close it when the page scrolls or resizes
        window.addEventListener("wheel", close, { passive: true });
        window.addEventListener("touchmove", close, { passive: true });
        window.addEventListener("resize", close);
        return () => { window.removeEventListener("click", close); window.removeEventListener("wheel", close); window.removeEventListener("touchmove", close); window.removeEventListener("resize", close); };
    }, [menuFor]);

    // Opened from Weekly Calendar → "Complete Class": ?date=YYYY-MM-DD&lecture=N
    useEffect(() => {
        try {
            const q = new URLSearchParams(window.location.search);
            const d = q.get("date");
            if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { setSelectedDate(d); setRangeEnd(d); setStartDate(d); setEndDate(d); }
            const n = parseInt(q.get("lecture") || "");
            if (n > 0) setOpenLectureParam(n);
        } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        if (openLectureParam === null || loading) return;
        // wait until the lectures of the requested date are loaded
        if (!lectures.some(l => l.date === selectedDate)) return;
        const lec = lectures.find(l => l.lectureNumber === openLectureParam && l.date === selectedDate);
        if (lec && lec.classEnded && PROFESSOR_EDITABLE_CLASS_STATUSES.includes(lec.pipelineStatus || "PENDING_PROFESSOR")) openReport(lec);
        else if (lec) openDrawer(lec);
        setOpenLectureParam(null);
    }, [lectures, loading, openLectureParam]);

    // Open the class record form (side panel), pre-filled when the record was reverted for correction
    const openReport = (lec: Lecture) => {
        setShowReport(lec.lectureNumber);
        setReportLec(lec);
        setMessage(null);
    };

    // Only the latest request may update the page (week / date can change while a request is running)
    const latestRequest = useRef(0);
    const fetchLectures = async () => {
        const requestNo = ++latestRequest.current;
        try {
            setLoading(true);
            const q = rangeEnd && rangeEnd !== selectedDate ? `startDate=${selectedDate}&endDate=${rangeEnd}` : `date=${selectedDate}`;
            const res = await fetch(`/api/faculty/lectures?facultyId=${user?.id}&${q}`);
            const data = await res.json();
            if (requestNo !== latestRequest.current) return;
            if (data.lectures) {
                setLectures(data.lectures);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (requestNo === latestRequest.current) setLoading(false);
        }
    };


    // Table rows (derived from the same lecture list; nothing is changed)
    // nowTick: Scheduled → In Progress flips without a reload
    const rows = useMemo(() => lectures.map(l => ({ ...toLectureRow(l, "lecture"), college: campusName || undefined })), [lectures, nowTick, campusName]); // eslint-disable-line react-hooks/exhaustive-deps
    const drawerRow = drawerKey ? rows.find(r => r.key === drawerKey) || null : null;
    const openDrawer = (lec: Lecture) => { setMenuFor(null); setDrawerKey(toLectureRow(lec, "lecture").key); };
    const closeDrawer = () => setDrawerKey(null);


    const downloadExcelReport = async () => {
        if (!user?.id) return;
        setExportLoading(true);
        try {
            const res = await fetch(`/api/faculty/lectures?facultyId=${user.id}&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();

            if (!data.lectures || data.lectures.length === 0) {
                setMessage({ type: "warning", text: "No lectures found in this date range." });
                return;
            }

            const worksheetData = data.lectures.map((l: any) => ({
                "Lecture #": l.lectureNumber,
                "Date": format(new Date(l.date || Date.now()), "dd-MM-yyyy"),
                "Subject": l.courseName,
                "Topics": l.topicsCovered,
                "Stream": l.stream,
                "Year": l.year,
                "Sem": l.semester,
                "Time": `${l.timeStart} - ${l.timeStop}`,
                "Duration (min)": l.scheduledDuration,
                "Status": l.status,
                "Attendees": l.numberOfAttendees,
                "Total Students": l.totalStudents,
                "Attendance %": l.totalStudents ? ((l.numberOfAttendees / l.totalStudents) * 100).toFixed(1) + "%" : "0%",
                "Recording Link": l.recordingUrl || "Not Uploaded",
                "Photo Link": l.classPhotoUrl || "Not Uploaded",
                "Faculty ID": l.facultyId
            }));

            const ws = XLSX.utils.json_to_sheet(worksheetData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Lecture Reports");

            // Auto-size columns
            const colWidths = Object.keys(worksheetData[0] || {}).map(key => ({
                wch: Math.max(key.length, ...worksheetData.map((row: any) => row[key]?.toString().length || 0)) + 2
            }));
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `Lecture_Reports_${user.name}_${startDate}_to_${endDate}.xlsx`);
            setMessage({ type: "success", text: "Reports exported successfully!" });
        } catch (e: any) {
            setMessage({ type: "error", text: "Export failed: " + e.message });
        } finally {
            setExportLoading(false);
        }
    };


    if (!user || !["FACULTY", "PROFESSOR"].includes(user.role)) {
        return <div className="flex items-center justify-center h-[80vh] text-zinc-400 font-bold uppercase tracking-widest bg-zinc-950">Access Restricted</div>;
    }

    const todayStr = todayYmd();
    const fmtLong = (ymd: string) => new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).replace(/^(\w+) /, "$1, ");
    const fmtShort = (ymd?: string) => ymd ? new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
    const isRecorded = (l: Lecture) => !!l.report && (l.status === "Completed" || (l.pipelineStatus && l.pipelineStatus !== "PENDING_PROFESSOR"));
    const completedCount = lectures.filter(isRecorded).length;
    const pendingCount = lectures.length - completedCount;
    const rangeLabel = selectedDate === rangeEnd ? fmtShort(selectedDate) : `${fmtShort(selectedDate)} – ${fmtShort(rangeEnd)}`;
    const applyRange = () => {
        let a = startDate, b = endDate;
        if (!a || !b) return;
        if (a > b) [a, b] = [b, a];
        setStartDate(a); setEndDate(b); setSelectedDate(a); setRangeEnd(b);
    };
    const resetRange = () => { const t = todayYmd(); setStartDate(t); setEndDate(t); setSelectedDate(t); setRangeEnd(t); };
    const inputCls = "w-full h-9 px-3 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer [color-scheme:dark]";
    // ── Header / cards (Lecture Reports design) ──
    const shiftYmd = (ymd: string, n: number) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const weekStart = (ymd: string) => { const d = new Date(ymd + "T00:00:00Z"); const dow = d.getUTCDay(); return shiftYmd(ymd, dow === 0 ? -6 : 1 - dow); };
    const statCounts = {
        total: rows.length,
        submitted: rows.filter(r => r.report === "SUBMITTED" || r.report === "VERIFIED").length,
        pending: rows.filter(r => r.report === "PENDING").length,
        reverted: rows.filter(r => r.report === "REVERTED").length,
        upcoming: rows.filter(r => r.report === "SCHEDULED" || r.report === "IN_PROGRESS").length,
    };
    const STATS = [
        { label: "Total Lectures", value: statCounts.total, icon: BookOpen, ring: "border-emerald-500/30 shadow-[0_0_24px_-12px_rgba(16,185,129,0.6)]", ic: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", glow: "from-emerald-500/10" },
        { label: "Submitted", value: statCounts.submitted, icon: CheckCircle2, ring: "border-sky-500/30 shadow-[0_0_24px_-12px_rgba(14,165,233,0.6)]", ic: "bg-sky-500/15 text-sky-300 border-sky-500/30", glow: "from-sky-500/10" },
        { label: "Report Pending", value: statCounts.pending, icon: Clock, ring: "border-amber-500/35 shadow-[0_0_24px_-12px_rgba(245,158,11,0.6)]", ic: "bg-amber-500/15 text-amber-300 border-amber-500/30", glow: "from-amber-500/10" },
        { label: "Reverted", value: statCounts.reverted, icon: RotateCcw, ring: "border-red-500/30 shadow-[0_0_24px_-12px_rgba(239,68,68,0.6)]", ic: "bg-red-500/15 text-red-300 border-red-500/30", glow: "from-red-500/10" },
        { label: "Upcoming", value: statCounts.upcoming, icon: CalendarDays, ring: "border-violet-500/30 shadow-[0_0_24px_-12px_rgba(139,92,246,0.6)]", ic: "bg-violet-500/15 text-violet-300 border-violet-500/30", glow: "from-violet-500/10" },
    ];
    /** Oldest class in the range whose report can be submitted / re-submitted now (same rules as the row buttons) */
    const nextDue = [...lectures].sort((a, b) => (a.date + (a.timeStart || "")).localeCompare(b.date + (b.timeStart || "")))
        .find(l => !!l.sprintEntryId && (["OM_REVERTED", "CL_CH_REVERTED"].includes(l.pipelineStatus || "") || ((l.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR" && !!l.classEnded)));


    return (
        <div className="max-w-[1600px] mx-auto pt-6 pb-20 px-4 sm:px-6 space-y-4 min-h-screen w-full [contain:inline-size]">
            {/* ── Header (Lecture Reports design) ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_24px_-6px_rgba(16,185,129,0.45)]"><FileText size={22} className="text-emerald-400" /></div>
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-[28px] font-black text-white tracking-tight leading-tight">My Lectures</h1>
                        <p className="text-xs sm:text-sm text-zinc-400">Manage, submit and track your lecture reports, notes and assignments.</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                            <span className="flex items-center gap-1"><Building2 size={12} /> Assigned Campus: <span className="text-indigo-300 font-semibold">{campusName || "Not assigned"}</span></span>
                            <span className="flex items-center gap-1" data-testid="today-count"><CalendarDays size={12} /> Today: <span className="text-zinc-300 font-semibold">{todayCount ?? "—"} lecture{todayCount === 1 ? "" : "s"}</span></span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Date range (same From / To / Apply / Reset as before) */}
                    <div className="relative">
                        <button onClick={() => setRangeOpen(v => !v)} aria-expanded={rangeOpen} data-testid="range-button"
                            className="h-11 flex items-center gap-3 pl-3 pr-3.5 rounded-xl border border-zinc-800 bg-zinc-900/70 hover:border-emerald-500/40 text-left">
                            <Calendar size={16} className="text-emerald-400 shrink-0" />
                            <span className="min-w-0">
                                <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 leading-3">Date Range</span>
                                <span className="block text-xs font-bold text-white whitespace-nowrap" data-testid="range-text">{rangeLabel}</span>
                            </span>
                            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${rangeOpen ? "rotate-180" : ""}`} />
                        </button>
                        {rangeOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} />
                                <div className="absolute left-0 top-full mt-2 z-50 w-[min(290px,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-3 space-y-3" data-testid="range-popover">
                                    <div className="flex flex-wrap gap-1.5">
                                        {([["Today", todayStr, todayStr], ["This week", weekStart(todayStr), shiftYmd(weekStart(todayStr), 5)], ["Last 7 days", shiftYmd(todayStr, -6), todayStr], ["Next 7 days", todayStr, shiftYmd(todayStr, 6)]] as const).map(([l, a, b]) => (
                                            <button key={l} onClick={() => { setStartDate(a); setEndDate(b); setSelectedDate(a); setRangeEnd(b); setRangeOpen(false); }}
                                                className="h-7 px-2.5 rounded-lg border border-zinc-800 bg-zinc-950/50 text-[11px] font-bold text-zinc-300 hover:text-white hover:border-emerald-500/40">{l}</button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="space-y-1"><span className="block text-[9.5px] font-black uppercase tracking-widest text-zinc-500">From</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} data-testid="date-from" /></label>
                                        <label className="space-y-1"><span className="block text-[9.5px] font-black uppercase tracking-widest text-zinc-500">To</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} data-testid="date-to" /></label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { applyRange(); setRangeOpen(false); }} data-testid="apply-range" className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"><Search size={13} /> Apply</button>
                                        <button onClick={() => { resetRange(); setRangeOpen(false); }} className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black"><RotateCcw size={13} /> Reset</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={downloadExcelReport} disabled={exportLoading} title="Download Excel report for the selected dates" data-testid="download"
                        className="h-11 px-3.5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 text-zinc-200 text-xs font-bold disabled:opacity-50">
                        {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} <span>Download</span>
                    </button>
                    {/* + Add Report: opens the report form of the oldest class still waiting for it (same form as Submit Report) */}
                    <button onClick={() => { if (nextDue) openReport(nextDue); }} disabled={!nextDue} data-testid="add-report"
                        title={nextDue ? `Next report due: ${nextDue.courseName} · ${fmtShort(nextDue.date)}` : "No report is due in the selected dates"}
                        className="h-11 px-4 flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-black shadow-[0_0_24px_-8px_rgba(16,185,129,0.8)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                        <Plus size={16} strokeWidth={3} /> Add Report
                    </button>
                </div>
            </div>

            {/* ── Summary (5 cards, same status rules as the table) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="lecture-stats">
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
                <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 rounded-3xl px-8 py-5 text-sm font-bold backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-6 duration-500 border-l-4 min-w-[320px] max-w-lg ${message.type === "success" ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-400" :
                    message.type === "warning" ? "bg-amber-950/80 border-amber-500/50 text-amber-400" :
                        "bg-red-950/80 border-red-500/50 text-red-400"
                    }`}>
                    {message.type === "success" ? <CheckCircle2 size={24} className="flex-shrink-0" /> : <AlertTriangle size={24} className="flex-shrink-0" />}
                    <span className="flex-1 tracking-tight leading-relaxed">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="p-2 hover:bg-white/10 rounded-full transition-all flex-shrink-0">✕</button>
                </div>
            )}

            {/* ── Lectures: compact table (one row per lecture) ── */}
            {(() => {
                // Same rules as before: report once after the class ends, re-submit only when reverted
                const canSubmit = (lec: Lecture) => (lec.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR" && !!lec.sprintEntryId && !!lec.classEnded;
                const isReverted = (lec: Lecture) => ["OM_REVERTED", "CL_CH_REVERTED"].includes(lec.pipelineStatus || "") && !!lec.sprintEntryId;
                const open = rows.find(r => r.key === menuFor)?.raw as Lecture | undefined;
                return (
                    <>
                        <LectureTable viewKey="my-lectures"
                            rows={rows}
                            loading={loading}
                            variant="report"
                            onOpen={(r) => openDrawer(r.raw)}
                            activeKey={drawerKey}
                            resetKey={`${selectedDate}|${rangeEnd}`}
                            emptyText={`No lectures for ${rangeLabel}. Submit your Sprint Plan to see your classes here.`}
                            renderActions={(r) => {
                                const lec = r.raw as Lecture;
                                return (
                                    <>
                                        {isReverted(lec) ? <RowButton tone="warn" icon={RotateCcw} onClick={() => openReport(lec)} title="Reverted to you — correct and re-submit" testId="resubmit-report">Re-submit</RowButton>
                                            : canSubmit(lec) ? <RowButton tone="primary" icon={Upload} onClick={() => openReport(lec)} testId="submit-report">Submit Report</RowButton>
                                                : r.recorded ? <RowButton icon={Eye} onClick={() => openDrawer(lec)} testId="view-record">View Report</RowButton>
                                                    : <RowButton icon={Info} onClick={() => openDrawer(lec)} title={lec.sprintEntryId ? `Report opens after the class ends (${lec.timeStop})` : "Not linked to a sprint plan entry"} testId="lecture-details">View Plan</RowButton>}
                                        <RowButton tone="ghost" icon={MoreVertical} title="More actions" testId="row-menu" onClick={(e) => {
                                            e.stopPropagation();
                                            const b = e.currentTarget.getBoundingClientRect();
                                            // the app zooms 1.1× on desktop: fixed-position values are in zoomed units
                                            const z = (e.currentTarget as any).currentCSSZoom || 1;
                                            const up = window.innerHeight - b.bottom < 260 * z;
                                            setMenuPos({ top: (up ? b.top - 4 : b.bottom + 4) / z, right: Math.max(8, Math.min((window.innerWidth - b.right) / z, window.innerWidth / z - 232)), up }); // keep the 224px menu on screen
                                            setMenuFor(menuFor === r.key ? null : r.key);
                                        }} />
                                    </>
                                );
                            }}
                        />
                        {!loading && lectures.length > 0 && (
                            <p className="text-[11px] text-zinc-500 px-1">The report is submitted once after the class ends — re-submit only if OM / CL / CH / HOI reverts it. Assignments can be added any time from the class day.</p>
                        )}

                        {/* ⋮ menu (fixed, so it is never cut off) */}
                        {open && (
                            <div className="fixed z-[90] w-56 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1 text-left" data-testid="row-menu-list"
                                style={{ top: menuPos.top, right: menuPos.right, transform: menuPos.up ? "translateY(-100%)" : undefined }} onClick={e => e.stopPropagation()}>
                                {canSubmit(open) && <MenuItem icon={Upload} label="Submit report" onClick={() => { openReport(open); setMenuFor(null); }} />}
                                {isReverted(open) && <MenuItem icon={RotateCcw} label="Correct & re-submit report" onClick={() => { openReport(open); setMenuFor(null); }} />}
                                {isRecorded(open) && open.report && <MenuItem icon={FileText} label="View class record" onClick={() => { openDrawer(open); setMenuFor(null); }} />}
                                {open.date <= todayStr && <MenuItem icon={ClipboardList} label={open.report?.assignment?.hasAssignment ? "Update assignment" : "Add assignment"} onClick={() => { setAsgFor(open); setMenuFor(null); }} />}
                                {open.report?.notesMissing && isRecorded(open) && <MenuItem icon={FileText} label="Upload missing notes" onClick={() => { openDrawer(open); setMenuFor(null); }} />}
                                {open.report?.lectureNotes?.notesUrl && <MenuItem icon={ExternalLink} label="Open notes" onClick={() => { window.open(open.report!.lectureNotes!.notesUrl, "_blank", "noopener"); setMenuFor(null); }} />}
                                {open.report?.assignment?.assignmentUrl && <MenuItem icon={ExternalLink} label="Open assignment" onClick={() => { window.open(open.report!.assignment!.assignmentUrl, "_blank", "noopener"); setMenuFor(null); }} />}
                                <MenuItem icon={Info} label="Lecture details" onClick={() => { openDrawer(open); setMenuFor(null); }} />
                                <MenuItem icon={CalendarDays} label="Open in Weekly Calendar" onClick={() => { window.location.href = `/academic/weekly-calendar?week=${open.date}`; }} />
                            </div>
                        )}

                        {/* Lecture details drawer: plan + class record + existing actions */}
                        <LectureDrawer row={drawerRow} onClose={closeDrawer}
                            actions={drawerRow && (() => {
                                const lec = drawerRow.raw as Lecture;
                                return (<>
                                    {isReverted(lec) && <RowButton tone="warn" icon={RotateCcw} onClick={() => { closeDrawer(); openReport(lec); }} testId="drawer-resubmit">Correct & Re-submit</RowButton>}
                                    {canSubmit(lec) && <RowButton tone="primary" icon={Upload} onClick={() => { closeDrawer(); openReport(lec); }} testId="drawer-submit">Submit Report</RowButton>}
                                    {lec.date <= todayStr && <RowButton icon={ClipboardList} onClick={() => setAsgFor(lec)} testId="drawer-assignment">{lec.report?.assignment?.hasAssignment ? "Update Assignment" : "Upload Assignment"}</RowButton>}
                                    {lec.report?.lectureNotes?.notesUrl && <RowButton icon={ExternalLink} onClick={() => window.open(lec.report!.lectureNotes!.notesUrl, "_blank", "noopener")}>Open Notes</RowButton>}
                                    {lec.report?.assignment?.assignmentUrl && <RowButton icon={ExternalLink} onClick={() => window.open(lec.report!.assignment!.assignmentUrl, "_blank", "noopener")}>Open Assignment</RowButton>}
                                    <RowButton icon={CalendarDays} onClick={() => { window.location.href = `/academic/weekly-calendar?week=${lec.date}`; }}>Weekly Calendar</RowButton>
                                </>);
                            })()}>
                            {drawerRow && (() => {
                                const lec = drawerRow.raw as Lecture;
                                if (lec.report && isRecorded(lec)) return (
                                    <>
                                        {/* lecture fields first, so the record card shows subject / class / professor; the report's own values win */}
                                        <ClassRecordDetails record={{ facultyName: user.name, college: campusName, courseName: lec.courseName, topicsCovered: lec.topicsCovered, className: lec.className, section: lec.section, stream: lec.stream, year: lec.year, semester: lec.semester, date: lec.date, ...lec.report, pipelineStatus: lec.pipelineStatus, timeStart: lec.timeStart, timeStop: lec.timeStop }} />
                                        <ClassRecordActions
                                            record={{ ...lec.report, _id: lec.report._id, pipelineStatus: lec.pipelineStatus, classEnded: true }}
                                            role={user.role} userId={user.id}
                                            onDone={(m) => { setMessage({ type: "success", text: m }); closeDrawer(); fetchLectures(); }} />
                                    </>
                                );
                                return (
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400" data-testid="drawer-no-record">
                                        {!lec.sprintEntryId ? "This class is not linked to a sprint plan entry."
                                            : lec.classEnded ? <>The class has ended. Submit the class record (attendance, snapshots, notes, assignment) with <b className="text-emerald-300">Submit Report</b>.</>
                                                : <>The class record can be submitted after the class ends ({lec.timeStop}).</>}
                                    </div>
                                );
                            })()}
                        </LectureDrawer>
                    </>
                );
            })()}

            {/* Add / update assignment — any time after the class day starts, also after the report */}
            {asgFor && (
                <AddAssignmentDialog lecture={asgFor} facultyId={user.id} onClose={() => setAsgFor(null)}
                    onSaved={(m) => { setAsgFor(null); setMessage({ type: "success", text: m }); fetchLectures(); }} />
            )}

            {/* Lecture Report Modal */}
            {showReport !== null && reportLec && (
                <LectureReportForm lecture={reportLec} facultyId={user?.id} fallbackDate={selectedDate}
                    onClose={() => setShowReport(null)}
                    onSubmitted={(text) => { setMessage({ type: "success", text }); setShowReport(null); fetchLectures(); }} />
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
            `}</style>
        </div>
    );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 text-left">
            <Icon size={13} className="text-zinc-400 shrink-0" /> {label}
        </button>
    );
}