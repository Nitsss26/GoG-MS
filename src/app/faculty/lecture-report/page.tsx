"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
    FileText, Calendar, Users, Camera, Mic, AlertTriangle, CheckCircle2, BookOpen, Clock, X,
    Search, RotateCcw, Download, Loader2, ChevronDown, BarChart3, XCircle, Link2, Image as ImageIcon,
    Eye, Upload, ClipboardList, MoreVertical, Sparkles, CalendarDays, Info, ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ClassRecordDetails, ClassRecordActions, ClassStatusBadge } from "@/components/academic/ClassRecordDetails";
import AddAssignmentDialog from "@/components/academic/AddAssignmentDialog";
import { DEFAULT_CLASS_STRENGTH } from "@/lib/academic-status";

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
const fmtShort = (ymd?: string) => ymd ? new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
const fmtDay = (ymd?: string) => ymd ? new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }) : "";
const dmy = (ymd: string) => ymd.split("-").reverse().join("-");

function Ring({ pct, color }: { pct: number; color: string }) {
    const r = 22, c = 2 * Math.PI * r;
    return (
        <div className="relative w-[58px] h-[58px] shrink-0">
            <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
                <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white tabular-nums">{Math.round(pct)}%</span>
        </div>
    );
}

export default function LectureReportPage() {
    const { user } = useAuth();
    const [reports, setReports] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiInsightReport, setAiInsightReport] = useState<ReportEntry | null>(null);
    const [pollingCount, setPollingCount] = useState(0);

    // filters: inputs + applied range
    const [fromInput, setFromInput] = useState(shiftDays(todayYmd(), -30));
    const [toInput, setToInput] = useState(todayYmd());
    const [range, setRange] = useState({ from: shiftDays(todayYmd(), -30), to: todayYmd() });
    const [subject, setSubject] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [appliedFilters, setAppliedFilters] = useState({ subject: "All", status: "All" });

    const [viewRecord, setViewRecord] = useState<Row | null>(null);
    const [asgFor, setAsgFor] = useState<Row | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number; up: boolean }>({ top: 0, right: 0, up: false });
    const [message, setMessage] = useState("");
    const [exporting, setExporting] = useState(false);
    const [nowTick, setNowTick] = useState(Date.now());

    useEffect(() => { if (user?.id) fetchReports(); }, [user, range, pollingCount]);
    useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 60000); return () => clearInterval(t); }, []);

    // Polling for AI analysis
    useEffect(() => {
        const needsPolling = reports.some(r => (r.report?.recordingUrl || r.recordingUrl) && !(r.report?.aiAnalysisAt || r.aiAnalysisAt));
        if (needsPolling) {
            const timer = setTimeout(() => setPollingCount(prev => prev + 1), 5000);
            return () => clearTimeout(timer);
        }
    }, [reports]);

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
        } catch (e) {
            console.error(e);
        } finally {
            if (no === latest.current) setLoading(false);
        }
    };

    // ── derived ──
    const rep = (r: Row) => (r.report || r) as any; // planned rows carry the record in .report; old rows are the record
    const isRecorded = (r: Row) => !!r.report ? (r.report.status === "Completed" || (r.pipelineStatus && r.pipelineStatus !== "PENDING_PROFESSOR")) : r.status === "Completed";
    const classEnded = (r: Row) => r.classEnded ?? true;
    const kind = (r: Row): "COMPLETED" | "PENDING" | "MISSED" => isRecorded(r) ? "COMPLETED" : classEnded(r) ? "MISSED" : "PENDING";
    const minsToStart = (r: Row) => {
        const t = r.timeStart || r.classStartTime?.slice(0, 5);
        if (!r.date || !t) return null;
        return Math.round((new Date(`${r.date}T${t.padStart(5, "0")}:00+05:30`).getTime() - nowTick) / 60000);
    };
    const subjects = useMemo(() => Array.from(new Set(reports.map(r => r.courseName).filter(Boolean))).sort(), [reports]);
    const shown = useMemo(() => reports.filter(r =>
        (appliedFilters.subject === "All" || r.courseName === appliedFilters.subject) &&
        (appliedFilters.status === "All" || kind(r) === appliedFilters.status)
    ), [reports, appliedFilters, nowTick]);
    const counts = useMemo(() => {
        const c = { total: shown.length, COMPLETED: 0, PENDING: 0, MISSED: 0 };
        shown.forEach(r => { c[kind(r)] += 1; });
        return c;
    }, [shown]);
    const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);
    const keyOf = (r: Row) => `${r.date}#${r.lectureNumber}#${r._id || ""}`;

    const apply = () => {
        let a = fromInput, b = toInput;
        if (!a || !b) return;
        if (a > b) [a, b] = [b, a];
        setFromInput(a); setToInput(b);
        setRange({ from: a, to: b });
        setAppliedFilters({ subject, status: statusFilter });
    };
    const reset = () => {
        const t = todayYmd(), f = shiftDays(t, -30);
        setFromInput(f); setToInput(t); setSubject("All"); setStatusFilter("All");
        setRange({ from: f, to: t }); setAppliedFilters({ subject: "All", status: "All" });
    };
    const pickDay = (d: string) => { if (!d) return; setFromInput(d); setToInput(d); setRange({ from: d, to: d }); };

    const download = () => {
        if (!shown.length) { setMessage("No class records to download for these filters."); return; }
        setExporting(true);
        try {
            const rows = shown.map(r => {
                const x = rep(r);
                return {
                    "Date": dmy(r.date), "Lecture #": r.lectureNumber, "Subject": r.courseName, "Topic": r.topicsCovered,
                    "Lecture Type": r.lectureType || x.lectureType || "", "Class": r.className || x.className || "", "Section": r.section || x.section || "",
                    "Stream": r.stream, "Year": r.year, "Semester": r.semester,
                    "Time": `${r.timeStart || x.classStartTime || ""} - ${r.timeStop || x.classEndTime || ""}`,
                    "Status": kind(r) === "COMPLETED" ? (r.pipelineStatus || "Completed") : kind(r),
                    "Attendees": isRecorded(r) ? x.numberOfAttendees ?? "" : "", "Total Students": isRecorded(r) ? x.totalStudents ?? "" : "",
                    "Notes": x.lectureNotes?.notesUrl || (x.notesMissing ? `Not submitted: ${x.notesMissingReason || ""}` : ""),
                    "Assignment": x.assignment?.assignmentUrl || "", "Recording": x.recordingUrl || "",
                };
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map((r: any) => String(r[k] ?? "").length)) + 2 }));
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

    const inputCls = "w-full px-3 py-2.5 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]";
    const label = "text-[11px] font-bold text-zinc-400 mb-1.5 block";
    const typeStyle = (t?: string) => {
        const x = (t || "").toLowerCase();
        if (x.includes("practical") || x.includes("lab")) return "bg-violet-500/15 text-violet-300 border-violet-500/30";
        if (x.includes("tutorial")) return "bg-pink-500/15 text-pink-300 border-pink-500/30";
        if (x.includes("revision")) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
        if (x.includes("test") || x.includes("assessment")) return "bg-red-500/15 text-red-300 border-red-500/30";
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    };
    const today = todayYmd();
    const openMenu = (e: React.MouseEvent, key: string) => {
        e.stopPropagation();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const up = window.innerHeight - r.bottom < 240;
        setMenuPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up });
        setMenuFor(menuFor === key ? null : key);
    };

    // ── cells ──
    const Lesson = ({ r }: { r: Row }) => {
        const x = rep(r);
        const cls = [r.className || x.className, (r.section || x.section) ? `Sec ${r.section || x.section}` : "", r.semester, r.year].filter(Boolean);
        return (
            <div className="min-w-0">
                <p className="text-sm font-black text-white leading-snug">{r.courseName}</p>
                {r.topicsCovered && <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5" title={r.topicsCovered}>{r.topicsCovered}</p>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {(r.lectureType || x.lectureType) && <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${typeStyle(r.lectureType || x.lectureType)}`}>{r.lectureType || x.lectureType}</span>}
                    {(r.unitNumber || x.unitNumber) && <span className="px-1.5 py-0.5 rounded-md border border-zinc-700 bg-zinc-800/60 text-[10px] font-bold text-zinc-300">Unit {r.unitNumber || x.unitNumber}</span>}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
                    {r.stream && <span className="text-indigo-300 font-semibold">{r.stream}</span>}{cls.length > 0 && <span> · {cls.join(" · ")}</span>}
                </p>
            </div>
        );
    };
    const Schedule = ({ r }: { r: Row }) => {
        const x = rep(r);
        const s = r.timeStart || x.classStartTime?.slice(0, 5), e = r.timeStop || x.classEndTime?.slice(0, 5);
        return (
            <div>
                <div className="flex items-center gap-1.5 text-xs font-black text-white tabular-nums whitespace-nowrap"><Clock size={13} className="text-amber-400" /> {s || "—"} – {e || "—"}</div>
                <p className="text-[10px] text-zinc-400 mt-0.5 whitespace-nowrap">{fmtShort(r.date)} ({fmtDay(r.date)})</p>
                {(r.scheduledDuration || x.actualDurationMinutes) ? <p className="text-[10px] text-zinc-500">{x.actualDurationMinutes || r.scheduledDuration} mins</p> : null}
            </div>
        );
    };
    const Attendance = ({ r }: { r: Row }) => {
        const x = rep(r);
        const tot = x.totalStudents || r.defaultTotalStudents || DEFAULT_CLASS_STRENGTH;
        if (!isRecorded(r) || typeof x.numberOfAttendees !== "number") return (
            <div className="w-full max-w-[7rem]">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap"><Users size={12} /> Not Marked Yet</div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-1.5" />
            </div>
        );
        const p = Math.min(100, (x.numberOfAttendees / tot) * 100);
        return (
            <div className="w-full max-w-[7rem]">
                <div className="flex items-center gap-1.5 text-xs font-black text-white tabular-nums"><Users size={13} className="text-emerald-400" /> {x.numberOfAttendees} / {tot}</div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mt-1.5"><div className={`h-full rounded-full ${p < 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${p}%` }} /></div>
            </div>
        );
    };
    const Status = ({ r }: { r: Row }) => {
        const k = kind(r);
        if (k === "COMPLETED") {
            const x = rep(r);
            return (
                <div className="space-y-1.5 min-w-0">
                    <div className="[&>span]:whitespace-normal [&>span]:leading-tight"><ClassStatusBadge status={r.pipelineStatus || "COMPLETED"} /></div>
                    <p className="text-[10px] text-zinc-500">{fmtShort(r.date)}</p>
                    {x.notesMissing && <span className="inline-block text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Notes missing</span>}
                </div>
            );
        }
        if (k === "MISSED") return (
            <div className="inline-flex items-start gap-2 px-2.5 py-2 rounded-xl border bg-red-500/10 border-red-500/25 text-red-300">
                <XCircle size={14} className="mt-0.5 shrink-0" /><div><p className="text-[10px] font-black uppercase tracking-wider">Report Missing</p><p className="text-[10px] text-zinc-400 whitespace-nowrap">{fmtShort(r.date)}</p></div>
            </div>
        );
        const m = minsToStart(r);
        const running = m !== null && m <= 0;
        return (
            <div className={`inline-flex items-start gap-2 px-2.5 py-2 rounded-xl border ${running ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-orange-500/10 border-orange-500/25 text-orange-300"}`}>
                {running ? <span className="mt-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" /> : <Clock size={14} className="mt-0.5 shrink-0" />}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider">{running ? "In Progress" : "Pending"}</p>
                    <p className="text-[10px] text-zinc-400 whitespace-nowrap">{running ? `Ends at ${r.timeStop}` : m !== null && m < 24 * 60 ? `Starts in ${Math.floor(m / 60) ? `${Math.floor(m / 60)} h ` : ""}${m % 60} min` : fmtShort(r.date)}</p>
                </div>
            </div>
        );
    };
    const Attachments = ({ r }: { r: Row }) => {
        const x = rep(r);
        const notes = x.lectureNotes?.notesUrl ? [x.lectureNotes.notesUrl] : [];
        const links = x.assignment?.assignmentUrl ? [x.assignment.assignmentUrl] : [];
        const photos: string[] = [...(x.snapshotUrls || []), ...(x.classPhotoUrl && !(x.snapshotUrls || []).includes(x.classPhotoUrl) ? [x.classPhotoUrl] : [])];
        const rec = x.recordingUrl ? [x.recordingUrl] : [];
        const item = (Icon: any, list: string[], title: string, tone: string) => (
            <div className="flex flex-col items-center gap-1">
                {list.length ? (
                    <a href={list[0]} target="_blank" rel="noopener noreferrer" title={`${title} (${list.length})`}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all hover:scale-105 ${tone}`}><Icon size={14} /></a>
                ) : (
                    <span title={`No ${title.toLowerCase()}`} className="w-8 h-8 rounded-lg border border-dashed border-zinc-800 flex items-center justify-center text-zinc-700"><Icon size={14} /></span>
                )}
                <span className={`text-[10px] font-bold tabular-nums ${list.length ? "text-zinc-300" : "text-zinc-700"}`}>{list.length || "–"}</span>
            </div>
        );
        return (
            <div className="flex items-start gap-1.5" data-testid="attachments">
                {item(FileText, notes, "Notes", "bg-emerald-500/10 border-emerald-500/25 text-emerald-300")}
                {item(Link2, links, "Assignment link", "bg-purple-500/10 border-purple-500/25 text-purple-300")}
                {item(ImageIcon, photos, "Photos", "bg-sky-500/10 border-sky-500/25 text-sky-300")}
                {item(Mic, rec, "Recording", "bg-indigo-500/10 border-indigo-500/25 text-indigo-300")}
            </div>
        );
    };
    const Actions = ({ r, wide }: { r: Row; wide?: boolean }) => {
        const k = kind(r);
        const notSubmitted = (r.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR";
        const btn = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black whitespace-nowrap transition-all active:scale-95";
        const reverted = ["OM_REVERTED", "CL_CH_REVERTED"].includes(r.pipelineStatus || "");
        const primary = reverted && r.sprintEntryId ? (
            <Link href={`/faculty/lectures?date=${r.date}&lecture=${r.lectureNumber}`} data-testid="resubmit-report" title="Reverted to you — correct and re-submit"
                className={`${btn} w-full bg-amber-500 hover:bg-amber-400 text-zinc-950`}><RotateCcw size={13} /> Re-submit Report</Link>
        ) : k === "COMPLETED" && r.report ? (
            <button onClick={() => setViewRecord(r)} data-testid="view-record" className={`${btn} w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700`}><Eye size={13} /> View</button>
        ) : notSubmitted && r.sprintEntryId && classEnded(r) ? (
            <Link href={`/faculty/lectures?date=${r.date}&lecture=${r.lectureNumber}`} data-testid="submit-report" className={`${btn} w-full bg-emerald-600 hover:bg-emerald-500 text-white`}><Upload size={13} /> Submit Report</Link>
        ) : (
            <button disabled title={`Available after the class ends (${r.timeStop || ""})`} className={`${btn} w-full bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed`}><Upload size={13} /> Submit Report</button>
        );
        const dayStarted = !!r.date && r.date <= today;
        const hasAsg = !!rep(r).assignment?.hasAssignment;
        return (
            <div className={`flex ${wide ? "flex-col sm:flex-row" : "flex-col"} gap-1.5`}>
                <div className={wide ? "sm:flex-1" : ""}>{primary}</div>
                <div className={`flex items-center gap-1.5 ${wide ? "sm:flex-1" : ""}`}>
                    <button onClick={() => setAsgFor(r)} disabled={!dayStarted || !r.sprintEntryId && !r.report} data-testid="add-assignment"
                        title={dayStarted ? (hasAsg ? "Update the assignment" : "Add an assignment for this class") : "Available from the class day"}
                        className={`${btn} flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed`}>
                        <ClipboardList size={13} /> {hasAsg ? "Edit Asg." : "Assignment"}
                    </button>
                    <button onClick={e => openMenu(e, keyOf(r))} aria-label="More actions" data-testid="row-menu"
                        className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700"><MoreVertical size={15} /></button>
                </div>
            </div>
        );
    };
    const open = shown.find(r => keyOf(r) === menuFor);
    const rangeText = range.from === range.to ? fmtShort(range.from) : `${fmtShort(range.from)} – ${fmtShort(range.to)}`;
    const warnRows = shown.filter(r => (rep(r).warnings || []).length > 0);

    return (
        <div className="max-w-7xl mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-5 w-full [contain:inline-size]">
            {/* ── Header banner ── */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/90 via-teal-950/70 to-zinc-900 p-6 sm:p-7">
                <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><FileText size={28} className="text-emerald-400" /></div>
                        <div className="min-w-0">
                            <h1 className="text-3xl font-black text-white tracking-tight">My Class Records</h1>
                            <p className="text-sm text-zinc-400 mt-0.5">History of your lectures, attendance, notes and assignments</p>
                        </div>
                    </div>
                    <div className="hidden xl:flex items-end gap-3 select-none" aria-hidden>
                        <svg width="140" height="84" viewBox="0 0 140 84" fill="none">
                            <path d="M100 62 C92 44 98 26 110 16 C108 32 112 46 112 62Z" fill="#34d399" opacity=".55" />
                            <path d="M112 62 C112 40 122 22 138 14 C130 32 126 48 122 62Z" fill="#10b981" opacity=".7" />
                            <rect x="98" y="60" width="30" height="22" rx="4" fill="#0e7490" opacity=".9" />
                            <rect x="4" y="66" width="88" height="16" rx="3" fill="#0f766e" />
                            <rect x="8" y="52" width="80" height="14" rx="3" fill="#be185d" opacity=".85" />
                            <rect x="2" y="39" width="86" height="13" rx="3" fill="#a16207" opacity=".9" />
                            <rect x="12" y="27" width="72" height="12" rx="3" fill="#1d4ed8" opacity=".85" />
                        </svg>
                        <p className="text-emerald-100/80 text-lg leading-6 -rotate-6 pb-4" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>Teach<br />Track <span className="text-pink-400">♥</span><br />Grow</p>
                    </div>
                    <label className="relative self-start lg:self-center flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-950/40 border border-emerald-500/30 text-white text-sm font-black cursor-pointer hover:border-emerald-400/60">
                        <Calendar size={15} className="text-emerald-400" /> {dmy(range.from === range.to ? range.from : today)} <ChevronDown size={14} className="text-zinc-400" />
                        <input type="date" value={range.from === range.to ? range.from : today} onChange={e => pickDay(e.target.value)} aria-label="Pick a day"
                            className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" data-testid="day-picker" />
                    </label>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-[1fr_1fr_1.2fr_1fr_auto_auto_auto] gap-3 items-end">
                    <div><span className={label}>Date From</span><input type="date" value={fromInput} onChange={e => setFromInput(e.target.value)} className={inputCls} data-testid="date-from" /></div>
                    <div><span className={label}>Date To</span><input type="date" value={toInput} onChange={e => setToInput(e.target.value)} className={inputCls} data-testid="date-to" /></div>
                    <div><span className={label}>Subject</span>
                        <select value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} data-testid="subject-filter">
                            <option value="All">All Subjects</option>
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select></div>
                    <div><span className={label}>Status</span>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls} data-testid="status-filter">
                            <option value="All">All Status</option>
                            <option value="COMPLETED">Conducted (report submitted)</option>
                            <option value="PENDING">Pending (upcoming)</option>
                            <option value="MISSED">Missed (no report)</option>
                        </select></div>
                    <button onClick={apply} data-testid="apply" className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black active:scale-95"><Search size={14} /> Apply</button>
                    <button onClick={reset} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black active:scale-95"><RotateCcw size={14} /> Reset</button>
                    <button onClick={download} disabled={exporting} className="col-span-2 md:col-span-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-black active:scale-95 disabled:opacity-50">
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download Report
                    </button>
                </div>
            </div>

            {/* ── Summary ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="record-stats">
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 to-zinc-900/40">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center"><BookOpen size={22} /></div>
                    <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-emerald-200">Total Classes</p><p className="text-2xl font-black text-white tabular-nums">{counts.total}</p><p className="text-[10px] text-zinc-400">in selected date range</p></div>
                    <BarChart3 size={34} className="text-emerald-500/50 shrink-0" />
                </div>
                {([
                    ["Conducted", counts.COMPLETED, "Classes completed", CheckCircle2, "#6366f1", "border-indigo-500/25 from-indigo-500/15", "bg-indigo-500/25 text-indigo-200", "text-indigo-200"],
                    ["Pending", counts.PENDING, "Yet to be conducted", Clock, "#f59e0b", "border-orange-500/25 from-orange-500/15", "bg-orange-500/25 text-orange-200", "text-orange-200"],
                    ["Missed", counts.MISSED, "Ended, report not submitted", XCircle, "#f43f5e", "border-pink-500/25 from-pink-500/15", "bg-pink-500/25 text-pink-200", "text-pink-200"],
                ] as const).map(([t, n, sub, Icon, col, tone, ic, tc]) => (
                    <div key={t} className={`flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-br to-zinc-900/40 ${tone}`}>
                        <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${ic}`}><Icon size={22} /></div>
                        <div className="flex-1 min-w-0"><p className={`text-[11px] font-bold ${tc}`}>{t}</p><p className="text-2xl font-black text-white tabular-nums">{n}</p><p className="text-[10px] text-zinc-400 truncate">{sub}</p></div>
                        <Ring pct={pct(n)} color={col} />
                    </div>
                ))}
            </div>

            {message && (
                <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                    {message}<button onClick={() => setMessage("")} className="text-zinc-400 hover:text-white"><X size={14} /></button>
                </div>
            )}

            {/* ── Records ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading records…</p>
                </div>
            ) : shown.length === 0 ? (
                <div className="rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800 p-16 text-center">
                    <div className="w-16 h-16 bg-zinc-800/60 rounded-full flex items-center justify-center mx-auto mb-4"><BookOpen size={28} className="text-zinc-600" /></div>
                    <h3 className="text-lg font-black text-white">No class records found</h3>
                    <p className="text-zinc-500 text-sm mt-1">Nothing for {rangeText}{appliedFilters.subject !== "All" || appliedFilters.status !== "All" ? " with these filters" : ""}.</p>
                </div>
            ) : (
                <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
                    <table className="hidden min-[1360px]:table w-full table-fixed text-left border-collapse" data-testid="records-table">
                        <colgroup>
                            <col className="w-11" /><col /><col className="w-[8.5rem]" /><col className="w-[7.5rem]" /><col className="w-[9.5rem]" /><col className="w-[11rem]" /><col className="w-[12rem]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-zinc-800/40 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                <th className="py-3 px-2 text-center">Lec</th><th className="py-3 px-3">Lesson & Class</th><th className="py-3 px-3">Schedule</th>
                                <th className="py-3 px-3">Attendance</th><th className="py-3 px-3">Status</th><th className="py-3 px-3">Attachments</th><th className="py-3 px-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {shown.map(r => (
                                <tr key={keyOf(r)} className="align-top hover:bg-white/[0.02]" data-testid="record-row">
                                    <td className="py-4 px-2 text-center"><span className="text-xl font-black text-zinc-400 tabular-nums">{r.lectureNumber || "—"}</span></td>
                                    <td className="py-4 px-3"><Lesson r={r} /></td>
                                    <td className="py-4 px-3"><Schedule r={r} /></td>
                                    <td className="py-4 px-3"><Attendance r={r} /></td>
                                    <td className="py-4 px-3"><Status r={r} /></td>
                                    <td className="py-4 px-3"><Attachments r={r} /></td>
                                    <td className="py-4 px-3"><Actions r={r} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="min-[1360px]:hidden grid grid-cols-1 md:grid-cols-2 gap-3 p-3" data-testid="records-cards">
                        {shown.map(r => (
                            <div key={keyOf(r)} className="p-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col" data-testid="record-card">
                                <div className="flex items-start gap-3">
                                    <span className="shrink-0 w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-black text-zinc-300">{r.lectureNumber || "—"}</span>
                                    <div className="flex-1 min-w-0"><Lesson r={r} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3"><Schedule r={r} /><Attendance r={r} /></div>
                                <div className="flex flex-wrap items-start justify-between gap-3"><Status r={r} /><Attachments r={r} /></div>
                                <div className="mt-auto pt-1"><Actions r={r} wide /></div>
                            </div>
                        ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500 flex flex-wrap justify-between gap-2">
                        <span>Showing {shown.length} class{shown.length === 1 ? "" : "es"} · {rangeText} · newest first</span>
                        <span>Report is submitted once (re-submit only after a revert); assignments can be added any time.</span>
                    </div>
                </div>
            )}

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
                            {kind(open) === "COMPLETED" && open.report && item(Eye, "View class record", () => setViewRecord(open))}
                            {["OM_REVERTED", "CL_CH_REVERTED"].includes(open.pipelineStatus || "") && open.report && item(Eye, "View class record", () => setViewRecord(open))}
                            {kind(open) === "MISSED" && (open.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR" && open.sprintEntryId && item(Upload, "Submit report", () => { window.location.href = `/faculty/lectures?date=${open.date}&lecture=${open.lectureNumber}`; })}
                            {open.date <= today && item(ClipboardList, x.assignment?.hasAssignment ? "Update assignment" : "Add assignment", () => setAsgFor(open))}
                            {x.recordingUrl && item(Sparkles, x.aiAnalysisAt ? "AI insights" : "AI insights (processing…)", () => setAiInsightReport({ ...x, lectureNumber: open.lectureNumber, courseName: open.courseName }), !x.aiAnalysisAt)}
                            {x.lectureNotes?.notesUrl && item(ExternalLink, "Open notes", () => window.open(x.lectureNotes.notesUrl, "_blank", "noopener"))}
                            {x.assignment?.assignmentUrl && item(ExternalLink, "Open assignment", () => window.open(x.assignment.assignmentUrl, "_blank", "noopener"))}
                            {item(CalendarDays, "Open in Weekly Calendar", () => { window.location.href = `/academic/weekly-calendar?week=${open.date}`; })}
                        </>);
                    })()}
                </div>
            )}

            {/* Class record details (verification, comments, history) */}
            {viewRecord && viewRecord.report && (
                <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[100] flex items-center justify-center py-10 px-4 overflow-y-auto" onClick={() => setViewRecord(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-3xl rounded-2xl overflow-hidden my-auto" onClick={e => e.stopPropagation()} data-testid="record-modal">
                        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-white">{viewRecord.courseName}</h2>
                                <p className="text-[11px] text-zinc-500">{fmtShort(viewRecord.date)} · {viewRecord.timeStart}–{viewRecord.timeStop}</p>
                                <div className="mt-2"><ClassStatusBadge status={viewRecord.pipelineStatus} /></div>
                            </div>
                            <button onClick={() => setViewRecord(null)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
                            <ClassRecordDetails record={{ ...viewRecord.report, pipelineStatus: viewRecord.pipelineStatus, timeStart: viewRecord.timeStart, timeStop: viewRecord.timeStop }} />
                            <ClassRecordActions
                                record={{ ...viewRecord.report, _id: viewRecord.report._id, pipelineStatus: viewRecord.pipelineStatus, classEnded: true }}
                                role={user.role} userId={user.id}
                                onDone={(m) => { setMessage(m); setViewRecord(null); fetchReports(); }} />
                        </div>
                    </div>
                </div>
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
                                <span>Analyzed: {aiInsightReport.aiAnalysisAt ? new Date(aiInsightReport.aiAnalysisAt).toLocaleString() : "N/A"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}