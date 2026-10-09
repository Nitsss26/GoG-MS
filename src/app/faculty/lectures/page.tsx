"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef } from "react";
import {
    Play, Square, Clock, Timer, AlertTriangle, CheckCircle2,
    BookOpen, Upload, Camera, FileText, Mic, Users, X, Loader2,
    Calendar, Download, GraduationCap, Building2, ChevronDown, Search, RotateCcw,
    CalendarDays, Eye, MoreVertical, Info, ClipboardList, ExternalLink
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ClassRecordDetails, ClassRecordActions, ClassStatusBadge } from "@/components/academic/ClassRecordDetails";
import AddAssignmentDialog from "@/components/academic/AddAssignmentDialog";
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

    // Report modal
    const [showReport, setShowReport] = useState<number | null>(null);
    const [reportLec, setReportLec] = useState<Lecture | null>(null);
    const [reportData, setReportData] = useState({
        numberOfAttendees: "",
        totalStudents: "",
        semester: "",
        issuesFaced: "",
        reasonForLessAttendance: "",
        topicsCovered: "",
        courseName: "",
        // Notes
        notesUrl: "",
        notesContent: "",
        isNotesSharedWithStudents: true,
        notesNotSharedRemarks: "",
        // Assignment
        hasAssignment: false,
        assignmentTitle: "",
        assignmentDescription: "",
        assignmentUrl: "",
        assignmentDeadline: "",
        studentsCompletedCount: "",
        totalStudentsExpected: "",
        // Notes not submitted → reason (goes to OM)
        notesMissing: false,
        notesMissingReason: ""
    });
    const [snapshotFiles, setSnapshotFiles] = useState<File[]>([]);
    const [viewRecord, setViewRecord] = useState<Lecture | null>(null);
    const [openLectureParam, setOpenLectureParam] = useState<number | null>(null);
    const [recordingFile, setRecordingFile] = useState<File | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [notesFile, setNotesFile] = useState<File | null>(null);
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadLabel, setUploadLabel] = useState("");
    const [photoCoords, setPhotoCoords] = useState<{ lat: number; lng: number } | null>(null);

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
    const [planInfo, setPlanInfo] = useState<Lecture | null>(null);
    const [asgFor, setAsgFor] = useState<Lecture | null>(null);
    const [nowTick, setNowTick] = useState(Date.now());

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
        else if (lec) setViewRecord(lec);
        setOpenLectureParam(null);
    }, [lectures, loading, openLectureParam]);

    // Open the class record form, pre-filled when the record was reverted for correction
    const openReport = (lec: Lecture) => {
        const r: any = lec.report || {};
        setShowReport(lec.lectureNumber);
        setReportLec(lec);
        setSnapshotFiles([]);
        setReportData(p => ({
            ...p,
            courseName: lec.courseName,
            topicsCovered: lec.topicsCovered,
            semester: lec.semester || "",
            numberOfAttendees: r.numberOfAttendees !== undefined && r.submittedAt ? String(r.numberOfAttendees) : "",
            totalStudents: String(r.totalStudents || lec.defaultTotalStudents || DEFAULT_CLASS_STRENGTH),
            issuesFaced: r.issuesFaced || "",
            reasonForLessAttendance: r.reasonForLessAttendance || "",
            notesUrl: r.lectureNotes?.notesUrl || "",
            notesContent: "",
            isNotesSharedWithStudents: r.lectureNotes ? Boolean(r.lectureNotes.isSharedWithStudents) : true,
            notesMissing: Boolean(r.notesMissing),
            notesMissingReason: r.notesMissingReason || "",
            hasAssignment: Boolean(r.assignment?.hasAssignment),
            assignmentTitle: r.assignment?.title || "",
            assignmentDescription: r.assignment?.description || "",
            assignmentUrl: r.assignment?.assignmentUrl || "",
            assignmentDeadline: r.assignment?.deadline || "",
        }));
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


    const handleRecordingSelect = (file: File) => {
        setRecordingFile(file);
        const audio = new Audio(URL.createObjectURL(file));
        audio.addEventListener("loadedmetadata", () => setRecordingDuration(Math.round(audio.duration)));
    };

    const handlePhotoSelect = async (file: File) => {
        setPhotoFile(file);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setPhotoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setPhotoCoords(null)
            );
        }
    };

    const submitReport = async (lec: Lecture) => {
        // Attendance: 0 ≤ present ≤ total (checked again on the server)
        const total = parseInt(reportData.totalStudents);
        const present = parseInt(reportData.numberOfAttendees);
        if (!(total > 0) || reportData.numberOfAttendees === "" || isNaN(present) || present < 0 || present > total) {
            setMessage({ type: "error", text: `Students present must be a number from 0 to ${total > 0 ? total : "the total"}.` });
            return;
        }
        const hasNotes = !!(notesFile || reportData.notesUrl.trim());
        if (!hasNotes && !reportData.notesMissing) {
            setMessage({ type: "error", text: "Upload the notes or add a notes link. If you cannot, tick \"Unable to Submit Notes\" and give the reason." });
            return;
        }
        if (!hasNotes && reportData.notesMissingReason.trim().length < 10) {
            setMessage({ type: "error", text: "Please explain why the notes could not be submitted (at least 10 characters)." });
            return;
        }
        setUploading(true);
        try {
            const snapshotUrls: string[] = [];
            let notesFileUrl = "";
            let recordingUrl = "";
            let classPhotoUrl = "";
            let assignmentUrl = reportData.assignmentUrl;

            if (recordingFile) {
                setUploadLabel("Uploading Recording...");
                const result = await uploadToCloudinary(recordingFile, (p) => setUploadProgress(p));
                recordingUrl = result.secure_url;
            }
            if (photoFile) {
                setUploadLabel("Uploading Class Photo...");
                setUploadProgress(0);
                const result = await uploadToCloudinary(photoFile, (p) => setUploadProgress(p));
                classPhotoUrl = result.secure_url;
            }
            if (notesFile) {
                setUploadLabel("Uploading Lecture Notes...");
                setUploadProgress(0);
                const result = await uploadToCloudinary(notesFile, (p) => setUploadProgress(p));
                notesFileUrl = result.secure_url;
            }
            for (let i = 0; i < snapshotFiles.length; i++) {
                setUploadLabel(`Uploading Snapshot ${i + 1}/${snapshotFiles.length}...`);
                setUploadProgress(0);
                const result = await uploadToCloudinary(snapshotFiles[i], (p) => setUploadProgress(p));
                snapshotUrls.push(result.secure_url);
            }
            if (assignmentFile && reportData.hasAssignment) {
                setUploadLabel("Uploading Assignment Doc...");
                setUploadProgress(0);
                const result = await uploadToCloudinary(assignmentFile, (p) => setUploadProgress(p));
                assignmentUrl = result.secure_url;
            }

            setUploadLabel("Finalizing Report...");
            setUploadProgress(100);
            const res = await fetch("/api/faculty/lectures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId: user?.id,
                    date: lec.date || selectedDate,
                    lectureNumber: lec.lectureNumber,
                    sprintEntryId: lec.sprintEntryId,
                    notesFileUrl,
                    notesMissing: !hasNotes && reportData.notesMissing,
                    notesMissingReason: reportData.notesMissingReason,
                    snapshotUrls,
                    courseName: reportData.courseName,
                    topicsCovered: reportData.topicsCovered,
                    stream: lec.stream,
                    year: lec.year,
                    semester: lec.semester,
                    numberOfAttendees: present,
                    totalStudents: total,
                    issuesFaced: reportData.issuesFaced,
                    reasonForLessAttendance: reportData.reasonForLessAttendance,
                    classPhotoUrl: classPhotoUrl || undefined,
                    classPhotoLat: photoCoords?.lat,
                    classPhotoLng: photoCoords?.lng,
                    recordingUrl: recordingUrl || undefined,
                    recordingDurationSeconds: recordingDuration || undefined,
                    sprintPlanId: lec.sprintPlanId,
                    scheduledDuration: lec.scheduledDuration,
                    // Lecture Notes
                    notesUrl: reportData.notesUrl.trim(),
                    notesContent: reportData.notesContent,
                    isNotesSharedWithStudents: reportData.isNotesSharedWithStudents,
                    notesNotSharedRemarks: reportData.notesNotSharedRemarks,
                    // Assignment
                    hasAssignment: reportData.hasAssignment,
                    assignmentTitle: reportData.assignmentTitle,
                    assignmentDescription: reportData.assignmentDescription,
                    assignmentUrl: reportData.hasAssignment ? assignmentUrl : "",
                    assignmentDeadline: reportData.assignmentDeadline,
                    studentsCompletedCount: parseInt(reportData.studentsCompletedCount) || 0,
                    totalStudentsExpected: parseInt(reportData.totalStudentsExpected) || total,
                })
            });
            if (res.ok) {
                const okData = await res.json().catch(() => ({}));
                setMessage({ type: "success", text: okData.message || "Class record submitted. It now goes to OM for verification." });
                setShowReport(null);
                resetReportForm();
                fetchLectures();
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to submit report to database");
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setUploading(false);
            setUploadProgress(0);
            setUploadLabel("");
        }
    };

    const resetReportForm = () => {
        setReportData({
            numberOfAttendees: "",
            totalStudents: "",
            semester: "",
            issuesFaced: "",
            reasonForLessAttendance: "",
            topicsCovered: "",
            courseName: "",
            notesUrl: "",
            notesContent: "",
            isNotesSharedWithStudents: true,
            notesNotSharedRemarks: "",
            hasAssignment: false,
            assignmentTitle: "",
            assignmentDescription: "",
            assignmentUrl: "",
            assignmentDeadline: "",
            studentsCompletedCount: "",
            totalStudentsExpected: "",
            notesMissing: false,
            notesMissingReason: ""
        });
        setSnapshotFiles([]);
        setRecordingFile(null);
        setPhotoFile(null);
        setNotesFile(null);
        setAssignmentFile(null);
        setRecordingDuration(0);
        setPhotoCoords(null);
    };

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
    // minutes until a class starts (IST); negative once it has started
    const minsToStart = (l: Lecture) => {
        if (!l.date || !l.timeStart) return null;
        const start = new Date(`${l.date}T${l.timeStart.padStart(5, "0")}:00+05:30`).getTime();
        return Math.round((start - nowTick) / 60000);
    };
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const typeStyle = (t?: string) => {
        const x = (t || "").toLowerCase();
        if (x.includes("practical") || x.includes("lab")) return "bg-violet-500/15 text-violet-300 border-violet-500/30";
        if (x.includes("tutorial")) return "bg-pink-500/15 text-pink-300 border-pink-500/30";
        if (x.includes("revision")) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
        if (x.includes("test") || x.includes("assessment")) return "bg-red-500/15 text-red-300 border-red-500/30";
        if (x) return "bg-sky-500/15 text-sky-300 border-sky-500/30";
        return "";
    };
    const applyRange = () => {
        let a = startDate, b = endDate;
        if (!a || !b) return;
        if (a > b) [a, b] = [b, a];
        setStartDate(a); setEndDate(b); setSelectedDate(a); setRangeEnd(b);
    };
    const resetRange = () => { const t = todayYmd(); setStartDate(t); setEndDate(t); setSelectedDate(t); setRangeEnd(t); };
    const lecKey = (l: Lecture) => `${l.date}#${l.lectureNumber}#${l._id || ""}`;
    const inputCls = "w-full px-3 py-2.5 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer [color-scheme:dark]";

    return (
        <div className="max-w-7xl mx-auto pt-6 pb-20 px-4 sm:px-6 space-y-5 min-h-screen w-full [contain:inline-size]">
            {/* ── Header banner ── */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/90 via-teal-950/70 to-zinc-900 p-6 sm:p-7">
                <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 min-w-0">
                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                            <GraduationCap size={28} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-3xl font-black text-white tracking-tight">My Lectures</h1>
                            <p className="text-sm text-zinc-400 mt-0.5">View and manage your scheduled lectures, attendance, notes and assignments</p>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <label className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold cursor-pointer hover:bg-emerald-500/15">
                                    <Calendar size={13} />
                                    <span>{fmtLong(selectedDate === rangeEnd ? selectedDate : todayStr)}</span>
                                    <ChevronDown size={12} className="opacity-70" />
                                    {/* pick one day */}
                                    <input type="date" value={selectedDate} aria-label="Pick a day"
                                        onChange={e => { const d = e.target.value; if (!d) return; setStartDate(d); setEndDate(d); setSelectedDate(d); setRangeEnd(d); }}
                                        className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                                </label>
                                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[11px] font-bold text-zinc-300">
                                    <Building2 size={13} className="text-indigo-300" /> Assigned Campus: <span className="text-indigo-300">{campusName || "Not assigned"}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    {/* Decorative: books + plant */}
                    <div className="hidden lg:flex items-end gap-4 pr-2 select-none" aria-hidden>
                        <svg width="150" height="92" viewBox="0 0 150 92" fill="none">
                            <path d="M18 70 C10 52 16 34 28 24 C26 40 30 54 30 70Z" fill="#34d399" opacity=".55" />
                            <path d="M30 70 C30 48 40 30 56 22 C48 40 44 56 40 70Z" fill="#10b981" opacity=".7" />
                            <path d="M26 70 C18 58 6 54 0 56 C8 62 14 68 20 72Z" fill="#6ee7b7" opacity=".45" />
                            <rect x="16" y="68" width="30" height="22" rx="4" fill="#b45309" opacity=".85" />
                            <rect x="58" y="74" width="88" height="16" rx="3" fill="#0f766e" />
                            <rect x="62" y="60" width="80" height="14" rx="3" fill="#be185d" opacity=".85" />
                            <rect x="56" y="47" width="86" height="13" rx="3" fill="#a16207" opacity=".9" />
                            <rect x="66" y="35" width="72" height="12" rx="3" fill="#1d4ed8" opacity=".85" />
                            <rect x="58" y="79" width="84" height="2" fill="#99f6e4" opacity=".5" />
                            <rect x="62" y="65" width="76" height="2" fill="#fbcfe8" opacity=".5" />
                            <rect x="56" y="52" width="82" height="2" fill="#fde68a" opacity=".5" />
                        </svg>
                        <p className="text-emerald-100/80 text-xl leading-6 -rotate-6 pb-6" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>
                            Keep<br />Teaching,<br />Keep Inspiring <span className="text-pink-400">♥</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Date range + download ── */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3">
                    <div className="space-y-1.5 col-span-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} className="text-emerald-500" /> Date From</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputCls} sm:w-44`} data-testid="date-from" />
                    </div>
                    <div className="space-y-1.5 col-span-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} className="text-emerald-500" /> Date To</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputCls} sm:w-44`} data-testid="date-to" />
                    </div>
                    <button onClick={applyRange} data-testid="apply-range"
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all active:scale-95">
                        <Search size={14} /> Apply
                    </button>
                    <button onClick={resetRange}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black transition-all active:scale-95">
                        <RotateCcw size={14} /> Reset
                    </button>
                </div>
                <button onClick={downloadExcelReport} disabled={exportLoading}
                    className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-black shadow-lg transition-all active:scale-95 disabled:opacity-50">
                    {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {exportLoading ? "Generating…" : "Download Report"}
                </button>
            </div>

            {/* ── Summary ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" data-testid="lecture-stats">
                {[
                    { label: "Total Lectures", value: lectures.length, sub: selectedDate === rangeEnd ? "For selected date" : "For selected date range", icon: BookOpen, tone: "from-emerald-500/15 border-emerald-500/25", ic: "bg-emerald-500/20 text-emerald-300", tc: "text-emerald-200" },
                    { label: "Completed", value: completedCount, sub: "Class records submitted", icon: CheckCircle2, tone: "from-indigo-500/15 border-indigo-500/25", ic: "bg-indigo-500/25 text-indigo-200", tc: "text-indigo-200" },
                    { label: "Pending", value: pendingCount, sub: "Yet to be conducted / recorded", icon: Clock, tone: "from-orange-500/15 border-orange-500/25", ic: "bg-orange-500/25 text-orange-200", tc: "text-orange-200" },
                    { label: "Today's Lectures", value: todayCount ?? "—", sub: `On ${fmtShort(todayStr)}`, icon: CalendarDays, tone: "from-pink-500/15 border-pink-500/25", ic: "bg-pink-500/25 text-pink-200", tc: "text-pink-200" },
                ].map(c => (
                    <div key={c.label} className={`flex items-center gap-3 sm:gap-4 p-4 rounded-2xl border bg-gradient-to-br to-zinc-900/40 ${c.tone}`}>
                        <div className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${c.ic}`}><c.icon size={22} /></div>
                        <div className="min-w-0">
                            <p className={`text-[11px] font-bold ${c.tc}`}>{c.label}</p>
                            <p className="text-2xl font-black text-white leading-tight tabular-nums">{c.value}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{c.sub}</p>
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

            {/* ── Lectures: table on wide screens, cards on smaller ones (no sideways scrolling) ── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading lectures…</p>
                </div>
            ) : lectures.length === 0 ? (
                <div className="rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800 p-16 text-center">
                    <div className="w-16 h-16 bg-zinc-800/60 rounded-full flex items-center justify-center mx-auto mb-4"><BookOpen size={28} className="text-zinc-600" /></div>
                    <h3 className="text-lg font-black text-white">No lectures for {rangeLabel}</h3>
                    <p className="text-zinc-500 text-sm mt-1">Submit your <span className="text-emerald-400 font-bold">Sprint Plan</span> to see your classes here.</p>
                </div>
            ) : (() => {
                // ── shared cell renderers ──
                const info = (lec: Lecture) => {
                    const recorded = isRecorded(lec);
                    const editable = PROFESSOR_EDITABLE_CLASS_STATUSES.includes(lec.pipelineStatus || "PENDING_PROFESSOR") && !!lec.sprintEntryId;
                    const m = minsToStart(lec);
                    const running = !lec.classEnded && m !== null && m <= 0;
                    const att = lec.report?.numberOfAttendees;
                    const tot = lec.report?.totalStudents || lec.defaultTotalStudents || DEFAULT_CLASS_STRENGTH;
                    const pct = recorded && typeof att === "number" && tot ? Math.min(100, (att / tot) * 100) : 0;
                    return { key: lecKey(lec), recorded, editable, m, running, att, tot, pct };
                };
                const classLine = (lec: Lecture) => [lec.className, lec.section ? `Sec ${lec.section}` : "", lec.semester, lec.year].filter(Boolean);

                const Lesson = ({ lec }: { lec: Lecture }) => (
                    <div className="min-w-0">
                        <p className="text-sm font-black text-white leading-snug">{lec.courseName}</p>
                        {lec.topicsCovered && <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5" title={lec.topicsCovered}>{lec.topicsCovered}</p>}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {lec.lectureType && <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${typeStyle(lec.lectureType)}`}>{lec.lectureType}</span>}
                            {lec.unitNumber && <span className="px-1.5 py-0.5 rounded-md border border-zinc-700 bg-zinc-800/60 text-[10px] font-bold text-zinc-300">Unit {lec.unitNumber}</span>}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
                            {lec.stream && <span className="text-indigo-300 font-semibold">{lec.stream}</span>}
                            {classLine(lec).length > 0 && <span> · {classLine(lec).join(" · ")}</span>}
                        </p>
                    </div>
                );
                const Schedule = ({ lec }: { lec: Lecture }) => (
                    <div>
                        <div className="flex items-center gap-1.5 text-xs font-black text-white tabular-nums whitespace-nowrap"><Clock size={13} className="text-amber-400" /> {lec.timeStart} – {lec.timeStop}</div>
                        {lec.scheduledDuration ? <p className="text-[10px] text-zinc-500 mt-0.5">{lec.scheduledDuration} mins</p> : null}
                        <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1 whitespace-nowrap"><Calendar size={10} className="text-zinc-500" /> {fmtShort(lec.date)}</p>
                    </div>
                );
                const Attendance = ({ lec }: { lec: Lecture }) => {
                    const i = info(lec);
                    return i.recorded && typeof i.att === "number" ? (
                        <div className="w-full max-w-[8rem]">
                            <div className="flex items-center gap-1.5 text-xs font-black text-white tabular-nums"><Users size={13} className="text-emerald-400" /> {i.att} / {i.tot}</div>
                            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mt-1.5"><div className={`h-full rounded-full ${i.pct < 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${i.pct}%` }} /></div>
                        </div>
                    ) : (
                        <div className="w-full max-w-[8rem]">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap"><Users size={12} /> Not Marked Yet</div>
                            <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-1.5" />
                        </div>
                    );
                };
                const Status = ({ lec }: { lec: Lecture }) => {
                    const i = info(lec);
                    const reverted = ["OM_REVERTED", "CL_CH_REVERTED"].includes(lec.pipelineStatus || "");
                    if (i.recorded) return (
                        <div className="space-y-1.5 min-w-0">
                            <div className="[&>span]:whitespace-normal [&>span]:leading-tight"><ClassStatusBadge status={lec.pipelineStatus} /></div>
                            {reverted && (
                                <p className="text-[10px] font-bold text-red-300 whitespace-pre-wrap [overflow-wrap:anywhere] line-clamp-3" data-testid="revert-comment">
                                    {(lec.pipelineStatus === "OM_REVERTED" ? lec.report?.omVerification?.comment : (lec.report?.finalVerification?.comment || lec.report?.clChVerification?.comment || lec.report?.hoiVerification?.comment)) || ""}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-1 text-[9px] font-bold">
                                {lec.report?.notesMissing ? <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Notes missing</span>
                                    : lec.report?.lectureNotes?.notesUrl ? <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Notes</span> : null}
                                {lec.report?.assignment?.hasAssignment && <span className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">Assignment</span>}
                                {(lec.report?.delayFlags || []).some((f: any) => f.status === "OPEN") && <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Notes pending</span>}
                            </div>
                        </div>
                    );
                    const box = (tone: string, icon: React.ReactNode, title: string, sub: string) => (
                        <div className={`inline-flex items-start gap-2 px-2.5 py-2 rounded-xl border ${tone}`}>
                            {icon}<div><p className="text-[10px] font-black uppercase tracking-wider">{title}</p><p className="text-[10px] text-zinc-400 whitespace-nowrap">{sub}</p></div>
                        </div>
                    );
                    if (lec.classEnded) return box("bg-red-500/10 border-red-500/25 text-red-300", <AlertTriangle size={14} className="mt-0.5 shrink-0" />, "Report Pending", `Ended at ${lec.timeStop}`);
                    if (i.running) return box("bg-emerald-500/10 border-emerald-500/25 text-emerald-300", <span className="mt-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />, "In Progress", `Ends at ${lec.timeStop}`);
                    return box("bg-orange-500/10 border-orange-500/25 text-orange-300", <Clock size={14} className="mt-0.5 shrink-0" />, "Upcoming", i.m !== null && i.m < 24 * 60 ? `Starts in ${hhmm(i.m)} hrs` : `On ${fmtShort(lec.date)}`);
                };
                const Actions = ({ lec, full }: { lec: Lecture; full?: boolean }) => {
                    const i = info(lec);
                    // The class record (report) is submitted ONCE; afterwards only View + Assignment
                    const notSubmitted = (lec.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR";
                    const dayStarted = !!lec.date && lec.date <= todayStr;
                    const hasAsg = !!lec.report?.assignment?.hasAssignment;
                    const btn = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black whitespace-nowrap transition-all active:scale-95";
                    // Re-submit only when OM or CL / CH / HOI reverted the report back to the professor
                    const reverted = ["OM_REVERTED", "CL_CH_REVERTED"].includes(lec.pipelineStatus || "");
                    let first: React.ReactNode;
                    if (reverted && lec.sprintEntryId) {
                        first = <button onClick={() => openReport(lec)} data-testid="resubmit-report" title="Reverted to you — correct and re-submit"
                            className={`${btn} w-full bg-amber-500 hover:bg-amber-400 text-zinc-950`}><RotateCcw size={13} /> Re-submit Report</button>;
                    } else if (notSubmitted && lec.sprintEntryId && lec.classEnded) {
                        first = <button onClick={() => openReport(lec)} data-testid="submit-report" className={`${btn} w-full bg-emerald-600 hover:bg-emerald-500 text-white`}><Upload size={13} /> Submit Report</button>;
                    } else if (notSubmitted) {
                        first = <button disabled title={lec.sprintEntryId ? `Available after the class ends (${lec.timeStop})` : "Not linked to a sprint plan entry"} data-testid="submit-report-disabled"
                            className={`${btn} w-full bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed`}><Upload size={13} /> Submit Report</button>;
                    } else {
                        first = <span className={`${btn} w-full bg-emerald-500/5 text-emerald-400/90 border border-emerald-500/20 cursor-default`} data-testid="report-submitted"><CheckCircle2 size={13} /> Report Submitted</span>;
                    }
                    return (
                        <div className={`flex ${full ? "flex-col sm:flex-row" : "flex-col"} items-stretch gap-1.5`}>
                            <div className={full ? "sm:flex-1" : ""}>{first}</div>
                            <div className={`flex items-center gap-1.5 ${full ? "sm:flex-[1.4]" : ""}`}>
                                {i.recorded && lec.report ? (
                                    <button onClick={() => setViewRecord(lec)} data-testid="view-record" className={`${btn} flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700`}><Eye size={13} /> View</button>
                                ) : (
                                    <button onClick={() => setPlanInfo(lec)} data-testid="lecture-details" className={`${btn} flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700`}><Info size={13} /> Plan</button>
                                )}
                                <button onClick={() => setAsgFor(lec)} disabled={!dayStarted} data-testid="add-assignment"
                                    title={dayStarted ? (hasAsg ? "Update the assignment" : "Add an assignment for this class") : "Available from the class day"}
                                    className={`${btn} flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed`}>
                                    <ClipboardList size={13} /> {hasAsg ? "Edit Asg." : "Assignment"}
                                </button>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const up = window.innerHeight - r.bottom < 260;
                                    setMenuPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up });
                                    setMenuFor(menuFor === i.key ? null : i.key);
                                }} aria-label="More actions" data-testid="row-menu"
                                    className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700"><MoreVertical size={15} /></button>
                            </div>
                        </div>
                    );
                };
                const open = lectures.find(l => lecKey(l) === menuFor);

                return (
                    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
                        {/* Wide screens: fixed-layout table that always fits the page */}
                        <table className="hidden xl:table w-full table-fixed text-left border-collapse" data-testid="lectures-table">
                            <colgroup>
                                <col className="w-12" />
                                <col />
                                <col className="w-[8.5rem]" />
                                <col className="w-[9rem]" />
                                <col className="w-[10.5rem]" />
                                <col className="w-[15.5rem]" />
                            </colgroup>
                            <thead>
                                <tr className="bg-zinc-800/40 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    <th className="py-3 px-3 text-center">Lec</th>
                                    <th className="py-3 px-3">Lesson & Class</th>
                                    <th className="py-3 px-3">Schedule</th>
                                    <th className="py-3 px-3">Attendance</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {lectures.map(lec => {
                                    const i = info(lec);
                                    return (
                                        <tr key={i.key} className={`align-top transition-colors ${i.running ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]"}`} data-testid="lecture-row">
                                            <td className="py-4 px-3 text-center"><span className={`text-xl font-black tabular-nums ${i.running ? "text-emerald-400" : "text-zinc-400"}`}>{lec.lectureNumber || "—"}</span></td>
                                            <td className="py-4 px-3"><Lesson lec={lec} /></td>
                                            <td className="py-4 px-3"><Schedule lec={lec} /></td>
                                            <td className="py-4 px-3"><Attendance lec={lec} /></td>
                                            <td className="py-4 px-3"><Status lec={lec} /></td>
                                            <td className="py-4 px-3"><Actions lec={lec} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Smaller screens: one card per lecture */}
                        <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-3 p-3" data-testid="lectures-cards">
                            {lectures.map(lec => {
                                const i = info(lec);
                                return (
                                    <div key={i.key} className={`p-4 space-y-3 rounded-xl border flex flex-col ${i.running ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-zinc-800 bg-zinc-900/50"}`} data-testid="lecture-card">
                                        <div className="flex items-start gap-3">
                                            <span className="shrink-0 w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-black text-zinc-300">{lec.lectureNumber || "—"}</span>
                                            <div className="flex-1 min-w-0"><Lesson lec={lec} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Schedule lec={lec} />
                                            <Attendance lec={lec} />
                                        </div>
                                        <Status lec={lec} />
                                        <div className="mt-auto pt-1"><Actions lec={lec} full /></div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500 flex flex-wrap justify-between gap-2">
                            <span>Showing {lectures.length} lecture{lectures.length === 1 ? "" : "s"} · {rangeLabel}</span>
                            <span>The report is submitted once after the class ends — re-submit only if OM / CL / CH / HOI reverts it. Assignments can be added any time.</span>
                        </div>

                        {/* ⋮ menu (fixed, so it is never cut off) */}
                        {open && (
                            <div className="fixed z-[90] w-56 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1 text-left" data-testid="row-menu-list"
                                style={{ top: menuPos.top, right: menuPos.right, transform: menuPos.up ? "translateY(-100%)" : undefined }} onClick={e => e.stopPropagation()}>
                                {(() => { const i = info(open); const notSubmitted = (open.pipelineStatus || "PENDING_PROFESSOR") === "PENDING_PROFESSOR"; return (<>
                                    {notSubmitted && open.sprintEntryId && open.classEnded && <MenuItem icon={Upload} label="Submit report" onClick={() => { openReport(open); setMenuFor(null); }} />}
                                    {["OM_REVERTED", "CL_CH_REVERTED"].includes(open.pipelineStatus || "") && open.sprintEntryId && <MenuItem icon={RotateCcw} label="Correct & re-submit report" onClick={() => { openReport(open); setMenuFor(null); }} />}
                                    {i.recorded && open.report && <MenuItem icon={FileText} label="View class record" onClick={() => { setViewRecord(open); setMenuFor(null); }} />}
                                    {open.date <= todayStr && <MenuItem icon={ClipboardList} label={open.report?.assignment?.hasAssignment ? "Update assignment" : "Add assignment"} onClick={() => { setAsgFor(open); setMenuFor(null); }} />}
                                    {open.report?.notesMissing && i.recorded && <MenuItem icon={FileText} label="Upload missing notes" onClick={() => { setViewRecord(open); setMenuFor(null); }} />}
                                    {open.report?.lectureNotes?.notesUrl && <MenuItem icon={ExternalLink} label="Open notes" onClick={() => { window.open(open.report!.lectureNotes!.notesUrl, "_blank", "noopener"); setMenuFor(null); }} />}
                                    {open.report?.assignment?.assignmentUrl && <MenuItem icon={ExternalLink} label="Open assignment" onClick={() => { window.open(open.report!.assignment!.assignmentUrl, "_blank", "noopener"); setMenuFor(null); }} />}
                                    <MenuItem icon={Info} label="Class plan details" onClick={() => { setPlanInfo(open); setMenuFor(null); }} />
                                    <MenuItem icon={CalendarDays} label="Open in Weekly Calendar" onClick={() => { window.location.href = `/academic/weekly-calendar?week=${open.date}`; }} />
                                </>); })()}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Add / update assignment — any time after the class day starts, also after the report */}
            {asgFor && (
                <AddAssignmentDialog lecture={asgFor} facultyId={user.id} onClose={() => setAsgFor(null)}
                    onSaved={(m) => { setAsgFor(null); setMessage({ type: "success", text: m }); fetchLectures(); }} />
            )}

            {/* Class plan details (from the sprint plan) */}
            {planInfo && (
                <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setPlanInfo(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} data-testid="plan-info-modal">
                        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-white">{planInfo.courseName}{planInfo.subjectCode ? ` (${planInfo.subjectCode})` : ""}</h2>
                                <p className="text-xs text-zinc-400">{fmtLong(planInfo.date)} · {planInfo.timeStart}–{planInfo.timeStop}</p>
                            </div>
                            <button onClick={() => setPlanInfo(null)} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                            {([["Lecture", planInfo.lectureNumber ? `#${planInfo.lectureNumber}` : ""], ["Topic", planInfo.topicsCovered], ["Lecture Type", planInfo.lectureType], ["Unit", planInfo.unitNumber],
                            ["Class", planInfo.className], ["Section", planInfo.section], ["Stream", planInfo.stream], ["Year / Semester", [planInfo.year, planInfo.semester].filter(Boolean).join(" / ")],
                            ["Duration", planInfo.scheduledDuration ? `${planInfo.scheduledDuration} mins` : ""], ["Class Record", planInfo.classEnded ? (isRecorded(planInfo) ? "Submitted" : "Pending — submit now") : "After the class ends"]] as [string, any][]).map(([k, v]) => (
                                <div key={k} className="min-w-0"><p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{k}</p><p className="text-zinc-200 [overflow-wrap:anywhere]">{v || "—"}</p></div>
                            ))}
                        </div>
                        <div className="px-5 pb-5 flex flex-wrap gap-2">
                            {PROFESSOR_EDITABLE_CLASS_STATUSES.includes(planInfo.pipelineStatus || "PENDING_PROFESSOR") && planInfo.sprintEntryId && planInfo.classEnded && (
                                <button onClick={() => { const l = planInfo; setPlanInfo(null); openReport(l); }} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black"><Upload size={13} /> Submit Class Record</button>
                            )}
                            <a href={`/academic/weekly-calendar?week=${planInfo.date}`} className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-[11px] font-black"><CalendarDays size={13} /> Weekly Calendar</a>
                        </div>
                    </div>
                </div>
            )}

            {/* Class record details: verification stages, comments, history; add assignment / notes later */}
            {viewRecord && viewRecord.report && (
                <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[100] flex items-center justify-center py-10 px-4 overflow-y-auto" onClick={() => setViewRecord(null)}>
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-3xl rounded-[2rem] overflow-hidden my-auto" onClick={e => e.stopPropagation()} data-testid="record-modal">
                        <div className="p-6 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-white">{viewRecord.courseName}</h2>
                                <p className="text-[11px] text-zinc-500">{viewRecord.date} · {viewRecord.timeStart}–{viewRecord.timeStop}</p>
                                <div className="mt-2"><ClassStatusBadge status={viewRecord.pipelineStatus} /></div>
                            </div>
                            <button onClick={() => setViewRecord(null)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <ClassRecordDetails record={{ ...viewRecord.report, pipelineStatus: viewRecord.pipelineStatus, timeStart: viewRecord.timeStart, timeStop: viewRecord.timeStop }} />
                            <ClassRecordActions
                                record={{ ...viewRecord.report, _id: viewRecord.report._id, pipelineStatus: viewRecord.pipelineStatus, classEnded: true }}
                                role={user.role} userId={user.id}
                                onDone={(m) => { setMessage({ type: "success", text: m }); setViewRecord(null); fetchLectures(); }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Industrial Report Modal */}
            {showReport !== null && (
                <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[100] flex items-center justify-center py-10 px-4 sm:px-6 overflow-y-auto animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-[2rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] overflow-hidden animate-in zoom-in-95 duration-500 my-auto"
                        onClick={e => e.stopPropagation()}>

                        <div className="p-8 border-b border-zinc-800/50 bg-gradient-to-br from-zinc-800/10 to-transparent">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                            <FileText size={20} className="text-amber-500" />
                                        </div>
                                        <h2 className="text-xl font-black text-white tracking-widest uppercase italic">Lecture Report</h2>
                                    </div>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5 pl-1">
                                        Lec: <span className="text-zinc-300">#{showReport}</span> <span className="text-zinc-800">/</span> <span className="text-indigo-400 italic line-clamp-1">{reportLec?.courseName}</span>
                                    </p>
                                </div>
                                <button onClick={() => { setShowReport(null); resetReportForm(); }}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-600 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-7 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Class Info */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Stream</label>
                                    <div className="px-3 py-2 bg-zinc-800/30 border border-zinc-800 rounded-xl text-[10px] font-black text-indigo-400 capitalize truncate">
                                        {reportLec?.stream || "—"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Year</label>
                                    <div className="px-3 py-2 bg-zinc-800/30 border border-zinc-800 rounded-xl text-[10px] font-black text-emerald-400 capitalize truncate">
                                        {reportLec?.year || "—"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Sem</label>
                                    <div className="px-3 py-2 bg-zinc-800/30 border border-zinc-800 rounded-xl text-[10px] font-black text-violet-400 capitalize truncate">
                                        {reportLec?.semester || "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Topics Covered</label>
                                    <div className="px-4 py-3 bg-zinc-800/20 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 italic line-clamp-2">
                                        {reportData.topicsCovered}
                                    </div>
                                </div>

                                {/* Audit Indicators */}
                                <div className="bg-zinc-950/40 rounded-2xl p-5 border border-zinc-800/80 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Users size={12} className="text-amber-500/80" /> Attendance Audit
                                        </h4>
                                        {parseInt(reportData.numberOfAttendees) > 0 && parseInt(reportData.totalStudents) > 0 && (
                                            <span className="text-[9px] font-black text-amber-500/80 uppercase italic">
                                                {Math.round((parseInt(reportData.numberOfAttendees) / parseInt(reportData.totalStudents)) * 100)}% Engagement
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Students Present</label>
                                            <input type="number" min={0} max={parseInt(reportData.totalStudents) || undefined} data-testid="present-input"
                                                value={reportData.numberOfAttendees}
                                                onChange={e => setReportData(p => ({ ...p, numberOfAttendees: e.target.value }))}
                                                className="w-full h-10 px-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-black font-mono text-white focus:border-amber-500/50 outline-none transition-all"
                                                placeholder="0" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Out of (Total)</label>
                                            <input type="number"
                                                value={reportData.totalStudents}
                                                onChange={e => setReportData(p => ({ ...p, totalStudents: e.target.value }))}
                                                className="w-full h-10 px-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-black font-mono text-white focus:border-amber-500/50 outline-none transition-all"
                                                placeholder="60" />
                                        </div>
                                    </div>

                                    {parseInt(reportData.numberOfAttendees) > 0 && parseInt(reportData.totalStudents) > 0 &&
                                        (parseInt(reportData.numberOfAttendees) / parseInt(reportData.totalStudents)) < 0.5 && (
                                            <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
                                                <textarea
                                                    value={reportData.reasonForLessAttendance}
                                                    onChange={e => setReportData(p => ({ ...p, reasonForLessAttendance: e.target.value }))}
                                                    className="w-full px-4 py-3 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl text-xs font-bold text-zinc-300 placeholder:text-zinc-700 outline-none h-20 resize-none"
                                                    placeholder="Reason for low attendance..." />
                                            </div>
                                        )}
                                                                 {/* Media Validation Grid */}
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                         <label className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest pl-0.5 flex items-center gap-1.5">
                                             <Camera size={12} className="text-zinc-500" /> Class Snapshots (optional)
                                         </label>
                                         <div className="relative group/photo">
                                             <input type="file" accept="image/*" multiple
                                                 onChange={e => {
                                                     const files = Array.from(e.target.files || []);
                                                     if (files[0]) handlePhotoSelect(files[0]);
                                                     setSnapshotFiles(files.slice(1));
                                                 }}
                                                 className="hidden" id="photo-upload" />
                                             <label htmlFor="photo-upload" className="flex items-center gap-3 px-4 py-3 bg-zinc-800/20 border-2 border-dashed border-zinc-800 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-all">
                                                 {photoFile ? <CheckCircle2 className="text-emerald-500" size={18} /> : <Upload className="text-zinc-700" size={18} />}
                                                 <span className="text-[9px] font-bold text-zinc-500 uppercase">{photoFile ? `${1 + snapshotFiles.length} attached` : "Attach Photos"}</span>
                                             </label>
                                             {photoCoords && (
                                                 <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                                                     <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                     <div className="space-y-2">
                                         <label className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest pl-0.5 flex items-center gap-1.5">
                                             <Mic size={12} className="text-zinc-500" /> Recording{reportLec?.report?.recordingUrl ? " (already uploaded)" : ""}
                                         </label>
                                         <div className="relative group/audio">
                                             <input type="file" accept="audio/*,video/*"
                                                 onChange={e => e.target.files?.[0] && handleRecordingSelect(e.target.files[0])}
                                                 className="hidden" id="audio-upload" />
                                             <label htmlFor="audio-upload" className="flex items-center gap-3 px-4 py-3 bg-zinc-800/20 border-2 border-dashed border-zinc-800 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-all">
                                                 {recordingFile ? <CheckCircle2 className="text-emerald-500" size={18} /> : <Mic className="text-zinc-700" size={18} />}
                                                 <span className="text-[9px] font-bold text-zinc-500 uppercase">{recordingFile ? "Ready" : "Upload File"}</span>
                                             </label>
                                         </div>
                                     </div>
                                 </div>

                                 {/* NEW: Lecture Notes & Sharing */}
                                 <div className="bg-zinc-950/40 rounded-2xl p-5 border border-zinc-800/80 space-y-4">
                                     <div className="flex items-center justify-between">
                                         <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                             <BookOpen size={12} className="text-teal-400" /> Lecture Notes * (upload or link)
                                         </h4>
                                     </div>

                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                         <div className="space-y-1">
                                             <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Attach Notes File</label>
                                             <input
                                                 type="file"
                                                 onChange={e => setNotesFile(e.target.files?.[0] || null)}
                                                 className="text-[10px] text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-teal-500/20 file:text-teal-300 hover:file:bg-teal-500/30 cursor-pointer"
                                             />
                                         </div>
                                         <div className="space-y-1">
                                             <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Or Notes Link / URL</label>
                                             <input
                                                 type="url" data-testid="notes-link"
                                                 value={reportData.notesUrl}
                                                 onChange={e => setReportData(p => ({ ...p, notesUrl: e.target.value }))}
                                                 placeholder="https://drive.google.com/..."
                                                 className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-teal-500/50"
                                             />
                                         </div>
                                     </div>

                                     {/* No notes → mandatory reason, verified by OM (Module 8) */}
                                     {!notesFile && !reportData.notesUrl.trim() && (
                                         <div className="pt-2 border-t border-zinc-800/50 space-y-2">
                                             <label className="flex items-center gap-2 cursor-pointer">
                                                 <input type="checkbox" data-testid="notes-missing"
                                                     checked={reportData.notesMissing}
                                                     onChange={e => setReportData(p => ({ ...p, notesMissing: e.target.checked }))}
                                                     className="w-4 h-4 rounded cursor-pointer" />
                                                 <span className="text-xs font-bold text-amber-300">Unable to Submit Notes</span>
                                             </label>
                                             {reportData.notesMissing && (
                                                 <div>
                                                     <label className="text-[8px] text-amber-500 font-black uppercase tracking-widest">Reason * (sent to OM for verification)</label>
                                                     <textarea data-testid="notes-missing-reason"
                                                         value={reportData.notesMissingReason}
                                                         onChange={e => setReportData(p => ({ ...p, notesMissingReason: e.target.value }))}
                                                         placeholder="e.g. Out of station on official duty; notes will be shared on return"
                                                         className="w-full px-3 py-2 bg-amber-500/[0.04] border border-amber-500/30 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 outline-none h-16 resize-none mt-1" />
                                                 </div>
                                             )}
                                         </div>
                                     )}

                                     {/* Notes Sharing Tick Mark */}
                                     <div className="pt-2 border-t border-zinc-800/50 space-y-2">
                                         <label className="flex items-center gap-2 cursor-pointer">
                                             <input
                                                 type="checkbox"
                                                 checked={reportData.isNotesSharedWithStudents}
                                                 onChange={e => setReportData(p => ({ ...p, isNotesSharedWithStudents: e.target.checked }))}
                                                 className="w-4 h-4 rounded text-teal-500 focus:ring-0 cursor-pointer"
                                             />
                                             <span className="text-xs font-bold text-zinc-200">
                                                 Lecture notes have been shared to the students
                                             </span>
                                         </label>

                                         {!reportData.isNotesSharedWithStudents && (
                                             <div className="animate-in slide-in-from-top-2 duration-300">
                                                 <label className="text-[8px] text-amber-500 font-black uppercase tracking-widest">Reason why notes were not shared (Required for CL/OM check):</label>
                                                 <textarea
                                                     value={reportData.notesNotSharedRemarks}
                                                     onChange={e => setReportData(p => ({ ...p, notesNotSharedRemarks: e.target.value }))}
                                                     placeholder="Explain why notes were not shared to students today..."
                                                     className="w-full px-3 py-2 bg-amber-500/[0.04] border border-amber-500/30 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 outline-none h-16 resize-none mt-1"
                                                 />
                                             </div>
                                         )}
                                     </div>
                                 </div>

                                 {/* NEW: Assignment Section (Optional / Saturday) */}
                                 <div className="bg-zinc-950/40 rounded-2xl p-5 border border-zinc-800/80 space-y-4">
                                     <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-2">
                                             <input
                                                 type="checkbox"
                                                 id="has-assignment-toggle"
                                                 checked={reportData.hasAssignment}
                                                 onChange={e => setReportData(p => ({ ...p, hasAssignment: e.target.checked }))}
                                                 className="w-4 h-4 rounded text-purple-500 cursor-pointer"
                                             />
                                             <label htmlFor="has-assignment-toggle" className="text-xs font-black text-purple-300 uppercase tracking-wider cursor-pointer">
                                                 Add Assignment (optional — can also be added later, due by Saturday 10 AM)
                                             </label>
                                         </div>
                                         <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Verified by CL</span>
                                     </div>

                                     {reportData.hasAssignment && (
                                         <div className="space-y-3 pt-2 border-t border-purple-500/20 animate-in slide-in-from-top-2 duration-300">
                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                 <div className="space-y-1">
                                                     <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Assignment Title</label>
                                                     <input
                                                         type="text"
                                                         value={reportData.assignmentTitle}
                                                         onChange={e => setReportData(p => ({ ...p, assignmentTitle: e.target.value }))}
                                                         placeholder="e.g. Implement Doubly Linked List"
                                                         className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-purple-500/50"
                                                     />
                                                 </div>
                                                 <div className="space-y-1">
                                                     <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Submission Deadline</label>
                                                     <input
                                                         type="date"
                                                         value={reportData.assignmentDeadline}
                                                         onChange={e => setReportData(p => ({ ...p, assignmentDeadline: e.target.value }))}
                                                         className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-purple-500/50"
                                                     />
                                                 </div>
                                             </div>

                                             <div className="space-y-1">
                                                 <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Assignment Details / Instructions</label>
                                                 <textarea
                                                     value={reportData.assignmentDescription}
                                                     onChange={e => setReportData(p => ({ ...p, assignmentDescription: e.target.value }))}
                                                     placeholder="Specific instructions or problem statements..."
                                                     className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none h-16 resize-none"
                                                 />
                                             </div>

                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                 <div className="space-y-1">
                                                     <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Attach Assignment File</label>
                                                     <input
                                                         type="file"
                                                         onChange={e => setAssignmentFile(e.target.files?.[0] || null)}
                                                         className="text-[10px] text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 cursor-pointer"
                                                     />
                                                 </div>
                                                 <div className="space-y-1">
                                                     <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Or Assignment Link</label>
                                                     <input
                                                         type="url"
                                                         value={reportData.assignmentUrl}
                                                         onChange={e => setReportData(p => ({ ...p, assignmentUrl: e.target.value }))}
                                                         placeholder="https://..."
                                                         className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-purple-500/50"
                                                     />
                                                 </div>
                                                 <div className="space-y-1">
                                                     <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Students Completed / Responded</label>
                                                     <input
                                                         type="number"
                                                         value={reportData.studentsCompletedCount}
                                                         onChange={e => setReportData(p => ({ ...p, studentsCompletedCount: e.target.value }))}
                                                         placeholder="Count of students completed"
                                                         className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-white outline-none focus:border-purple-500/50"
                                                     />
                                                 </div>
                                             </div>
                                         </div>
                                     )}
                                 </div>    </div>
                            </div>
                        </div>

                        {/* Modal Command Center */}
                        <div className="p-6 bg-zinc-950/30 border-t border-zinc-800/50 flex items-center gap-3">
                            <button onClick={() => { setShowReport(null); resetReportForm(); }}
                                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                                Cancel
                            </button>
                            <button onClick={() => {
                                const lec = reportLec;
                                if (lec) submitReport(lec);
                            }}
                                data-testid="final-submit"
                                disabled={uploading || (!recordingFile && !reportLec?.report?.recordingUrl)}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-30">
                                {uploading ? (
                                    <div className="flex flex-col items-center gap-2 w-full">
                                        <div className="flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>{uploadLabel} ({uploadProgress}%)</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-white transition-all duration-300 ease-out" 
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={14} />
                                        <span>Submit Report</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
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