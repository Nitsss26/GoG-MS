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
        // "Notes shared with the students" is filled by the OM (Submitted to Groups), not in this form
        isNotesSharedWithStudents: false,
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
        notesMissingReason: "",
        // Topic fully covered? (null = not answered yet) · topics left when "No"
        topicFullyCovered: null as boolean | null,
        topicsLeft: ""
    });
    const [snapshotFiles, setSnapshotFiles] = useState<File[]>([]);
    const [drawerKey, setDrawerKey] = useState<string | null>(null);
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

    // Open the class record form, pre-filled when the record was reverted for correction
    const openReport = (lec: Lecture) => {
        const r: any = lec.report || {};
        setShowReport(lec.lectureNumber);
        setReportLec(lec);
        setSnapshotFiles([]);
        setMessage(null);
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
            // kept as the OM set it (re-submitting does not change it)
            isNotesSharedWithStudents: Boolean(r.lectureNotes?.isSharedWithStudents),
            notesNotSharedRemarks: r.lectureNotes?.notSharedRemarks || "",
            notesMissing: Boolean(r.notesMissing),
            notesMissingReason: r.notesMissingReason || "",
            topicFullyCovered: typeof r.topicFullyCovered === "boolean" ? r.topicFullyCovered : null,
            topicsLeft: r.topicsLeft || "",
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


    // Table rows (derived from the same lecture list; nothing is changed)
    // nowTick: Scheduled → In Progress flips without a reload
    const rows = useMemo(() => lectures.map(l => ({ ...toLectureRow(l, "lecture"), college: campusName || undefined })), [lectures, nowTick, campusName]); // eslint-disable-line react-hooks/exhaustive-deps
    const drawerRow = drawerKey ? rows.find(r => r.key === drawerKey) || null : null;
    const openDrawer = (lec: Lecture) => { setMenuFor(null); setDrawerKey(toLectureRow(lec, "lecture").key); };
    const closeDrawer = () => setDrawerKey(null);

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
        const hasSnapshot = !!(photoFile || reportLec?.report?.classPhotoUrl || (reportLec?.report?.snapshotUrls || []).length);
        if (!hasSnapshot) {
            setMessage({ type: "error", text: "Class snapshots are compulsory. Attach at least one photo of the class." });
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
        if (reportData.topicFullyCovered === null) {
            setMessage({ type: "error", text: "Choose whether the topic was fully covered (Yes / No)." });
            return;
        }
        if (reportData.topicFullyCovered === false && reportData.topicsLeft.trim().length < 5) {
            setMessage({ type: "error", text: "Write which topics are still left (at least 5 characters)." });
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
                    topicFullyCovered: reportData.topicFullyCovered,
                    topicsLeft: reportData.topicFullyCovered ? "" : reportData.topicsLeft.trim(),
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
            isNotesSharedWithStudents: false,
            notesNotSharedRemarks: "",
            hasAssignment: false,
            assignmentTitle: "",
            assignmentDescription: "",
            assignmentUrl: "",
            assignmentDeadline: "",
            studentsCompletedCount: "",
            totalStudentsExpected: "",
            notesMissing: false,
            notesMissingReason: "",
            topicFullyCovered: null,
            topicsLeft: ""
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
                        <LectureTable
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
            {showReport !== null && (() => {
                const present = parseInt(reportData.numberOfAttendees);
                const total = parseInt(reportData.totalStudents);
                const pct = present >= 0 && total > 0 ? Math.min(100, Math.round((present / total) * 100)) : null;
                const lowAttendance = present > 0 && total > 0 && present / total < 0.5;
                const hasNotes = !!(notesFile || reportData.notesUrl.trim());
                const closeReport = () => { if (!uploading) { setShowReport(null); resetReportForm(); } };
                return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] lg:max-h-[calc((100dvh-3rem)/1.1)] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
                        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lecture-report-title">
                        <div className="shrink-0 h-1 w-full bg-gradient-to-r from-amber-500 via-teal-500 to-violet-500" />

                        {/* Header */}
                        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-amber-500/[0.07] via-zinc-900 to-emerald-500/[0.06]">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                        <FileText size={18} className="text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 id="lecture-report-title" className="text-base font-semibold text-white leading-tight">Lecture Report</h2>
                                        <p className="text-xs text-zinc-400 mt-0.5 truncate" title={reportLec?.courseName}>
                                            {reportLec?.courseName || "—"} <span className="text-zinc-600">· Lecture #{showReport}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={closeReport} disabled={uploading} aria-label="Close"
                                    className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-40">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {([["Stream", reportLec?.stream, "border-indigo-500/25 bg-indigo-500/10 text-indigo-300"], ["Year", reportLec?.year, "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"], ["Semester", reportLec?.semester, "border-violet-500/25 bg-violet-500/10 text-violet-300"]] as [string, string | undefined, string][]).map(([k, v, tone]) => (
                                    <span key={k} className={cnReport("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px]", tone)}>
                                        <span className="opacity-70">{k}</span>
                                        <span className="font-semibold capitalize">{v || "—"}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5 space-y-4" style={{ scrollbarGutter: "stable" }}>

                            <ReportSection step={1} accent="indigo" icon={<BookOpen size={14} className="text-indigo-400" />} title="Topics Covered" tag="From lecture plan">
                                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                                    {reportData.topicsCovered || <span className="text-zinc-600">No topics recorded</span>}
                                </p>
                            </ReportSection>

                            <ReportSection step={2} accent="amber" title="Attendance" icon={<Users size={14} className="text-amber-400" />} tag="Required" required>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel htmlFor="rep-present">Students present</FieldLabel>
                                        <input id="rep-present" type="number" inputMode="numeric" min={0} max={total || undefined} data-testid="present-input"
                                            value={reportData.numberOfAttendees}
                                            onChange={e => setReportData(p => ({ ...p, numberOfAttendees: e.target.value }))}
                                            className={REPORT_INPUT + " font-mono tabular-nums"} placeholder="0" />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="rep-total">Total students</FieldLabel>
                                        <input id="rep-total" type="number" inputMode="numeric" min={1}
                                            value={reportData.totalStudents}
                                            onChange={e => setReportData(p => ({ ...p, totalStudents: e.target.value }))}
                                            className={REPORT_INPUT + " font-mono tabular-nums"} placeholder="60" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                                        <span className="text-zinc-500">Attendance rate</span>
                                        <span className={cnReport("font-semibold tabular-nums", pct === null ? "text-zinc-600" : pct < 50 ? "text-amber-400" : "text-emerald-400")}>
                                            {pct === null ? "—" : `${pct}%`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                        <div className={cnReport("h-full rounded-full transition-[width] duration-300", pct !== null && pct < 50 ? "bg-amber-500" : "bg-emerald-500")}
                                            style={{ width: `${pct ?? 0}%` }} />
                                    </div>
                                </div>
                                {lowAttendance && (
                                    <div className="mt-3">
                                        <FieldLabel htmlFor="rep-low-reason" tone="warn">Reason for low attendance (below 50%) *</FieldLabel>
                                        <textarea id="rep-low-reason"
                                            value={reportData.reasonForLessAttendance}
                                            onChange={e => setReportData(p => ({ ...p, reasonForLessAttendance: e.target.value }))}
                                            className={REPORT_TEXTAREA + " border-amber-500/30 focus:border-amber-500/60"}
                                            placeholder="Briefly explain why attendance was low" />
                                    </div>
                                )}
                            </ReportSection>

                            <ReportSection step={3} accent="sky" title="Class Evidence" icon={<Camera size={14} className="text-sky-400" />} tag="Snapshots required" required>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>Class snapshots <span className="text-rose-400">*</span>{reportLec?.report?.classPhotoUrl || (reportLec?.report?.snapshotUrls || []).length ? " · already uploaded" : ""}</FieldLabel>
                                        <input type="file" accept="image/*" multiple className="hidden" id="photo-upload"
                                            onChange={e => {
                                                const files = Array.from(e.target.files || []);
                                                if (files[0]) handlePhotoSelect(files[0]);
                                                setSnapshotFiles(files.slice(1));
                                            }} />
                                        <UploadTile htmlFor="photo-upload" done={!!photoFile}
                                            icon={<Upload size={16} />}
                                            title={photoFile ? `${1 + snapshotFiles.length} photo${snapshotFiles.length ? "s" : ""} attached` : "Attach photos"}
                                            hint={photoFile ? (photoCoords ? "Location captured" : "Click to replace") : "JPG or PNG"} />
                                    </div>
                                    <div>
                                        <FieldLabel>Recording (optional){reportLec?.report?.recordingUrl ? " · already uploaded" : ""}</FieldLabel>
                                        <input type="file" accept="audio/*,video/*" className="hidden" id="audio-upload"
                                            onChange={e => e.target.files?.[0] && handleRecordingSelect(e.target.files[0])} />
                                        <UploadTile htmlFor="audio-upload" done={!!recordingFile || !!reportLec?.report?.recordingUrl}
                                            icon={<Mic size={16} />}
                                            title={recordingFile ? recordingFile.name : reportLec?.report?.recordingUrl ? "Recording on file" : "Upload recording"}
                                            hint={recordingFile || reportLec?.report?.recordingUrl ? "Click to replace" : "Audio or video file"} />
                                    </div>
                                </div>
                            </ReportSection>

                            <ReportSection step={4} accent="teal" title="Lecture Notes" icon={<BookOpen size={14} className="text-teal-400" />} tag="Required" required>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>Notes file</FieldLabel>
                                        <input type="file" id="notes-upload" className="hidden"
                                            onChange={e => setNotesFile(e.target.files?.[0] || null)} />
                                        <UploadTile htmlFor="notes-upload" done={!!notesFile} compact
                                            icon={<FileText size={16} />}
                                            title={notesFile ? notesFile.name : "Choose file"}
                                            hint={notesFile ? "Click to replace" : "PDF, DOC, PPT"} />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="rep-notes-link">Or notes link</FieldLabel>
                                        <input id="rep-notes-link" type="url" data-testid="notes-link"
                                            value={reportData.notesUrl}
                                            onChange={e => setReportData(p => ({ ...p, notesUrl: e.target.value }))}
                                            placeholder="https://drive.google.com/..."
                                            className={REPORT_INPUT} />
                                    </div>
                                </div>

                                {!hasNotes && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                        <CheckRow checked={reportData.notesMissing} testId="notes-missing" tone="warn"
                                            onChange={v => setReportData(p => ({ ...p, notesMissing: v }))}
                                            label="Unable to submit notes" />
                                        {reportData.notesMissing && (
                                            <div>
                                                <FieldLabel htmlFor="rep-notes-missing" tone="warn">Reason * (sent to OM for verification)</FieldLabel>
                                                <textarea id="rep-notes-missing" data-testid="notes-missing-reason"
                                                    value={reportData.notesMissingReason}
                                                    onChange={e => setReportData(p => ({ ...p, notesMissingReason: e.target.value }))}
                                                    placeholder="e.g. Out of station on official duty; notes will be shared on return"
                                                    className={REPORT_TEXTAREA + " border-amber-500/30 focus:border-amber-500/60"} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Topic coverage: Yes / No (required); No → topics still left */}
                                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3" data-testid="topic-coverage">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-zinc-200">Topic fully covered? <span className="text-red-400">*</span></span>
                                        <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden" role="radiogroup" aria-label="Topic fully covered">
                                            {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => (
                                                <button key={l} type="button" role="radio" aria-checked={reportData.topicFullyCovered === v} data-testid={`topic-covered-${l.toLowerCase()}`}
                                                    onClick={() => setReportData(p => ({ ...p, topicFullyCovered: v }))}
                                                    className={`h-9 min-w-[64px] px-4 text-xs font-bold transition-colors ${reportData.topicFullyCovered === v
                                                        ? (v ? "bg-emerald-600 text-white" : "bg-amber-500 text-zinc-950")
                                                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {reportData.topicFullyCovered === false && (
                                        <div>
                                            <FieldLabel htmlFor="rep-topics-left" tone="warn">Which topics are left? *</FieldLabel>
                                            <textarea id="rep-topics-left" data-testid="topics-left"
                                                value={reportData.topicsLeft}
                                                onChange={e => setReportData(p => ({ ...p, topicsLeft: e.target.value }))}
                                                placeholder="e.g. Deletion in linked lists and practice questions — to be covered in the next class"
                                                className={REPORT_TEXTAREA + " border-amber-500/30 focus:border-amber-500/60"} />
                                        </div>
                                    )}
                                </div>

                            </ReportSection>

                            <ReportSection step={5} accent="violet" title="Assignment" icon={<ClipboardList size={14} className="text-violet-400" />} tag="Optional · Verified by CL">
                                <CheckRow checked={reportData.hasAssignment} id="has-assignment-toggle"
                                    onChange={v => setReportData(p => ({ ...p, hasAssignment: v }))}
                                    label="Add an assignment for this lecture"
                                    hint="You can also add it later, up to Saturday 10:00 AM." />

                                {reportData.hasAssignment && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <FieldLabel htmlFor="rep-asg-title">Assignment title</FieldLabel>
                                                <input id="rep-asg-title" type="text"
                                                    value={reportData.assignmentTitle}
                                                    onChange={e => setReportData(p => ({ ...p, assignmentTitle: e.target.value }))}
                                                    placeholder="e.g. Implement a doubly linked list"
                                                    className={REPORT_INPUT} />
                                            </div>
                                            <div>
                                                <FieldLabel htmlFor="rep-asg-deadline">Submission deadline</FieldLabel>
                                                <input id="rep-asg-deadline" type="date"
                                                    value={reportData.assignmentDeadline}
                                                    onChange={e => setReportData(p => ({ ...p, assignmentDeadline: e.target.value }))}
                                                    className={REPORT_INPUT + " [color-scheme:dark]"} />
                                            </div>
                                        </div>
                                        <div>
                                            <FieldLabel htmlFor="rep-asg-desc">Details / instructions</FieldLabel>
                                            <textarea id="rep-asg-desc"
                                                value={reportData.assignmentDescription}
                                                onChange={e => setReportData(p => ({ ...p, assignmentDescription: e.target.value }))}
                                                placeholder="Problem statement or specific instructions"
                                                className={REPORT_TEXTAREA} />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <FieldLabel>Assignment file</FieldLabel>
                                                <input type="file" id="assignment-upload" className="hidden"
                                                    onChange={e => setAssignmentFile(e.target.files?.[0] || null)} />
                                                <UploadTile htmlFor="assignment-upload" done={!!assignmentFile} compact
                                                    icon={<FileText size={16} />}
                                                    title={assignmentFile ? assignmentFile.name : "Choose file"}
                                                    hint={assignmentFile ? "Click to replace" : "Optional"} />
                                            </div>
                                            <div>
                                                <FieldLabel htmlFor="rep-asg-link">Or assignment link</FieldLabel>
                                                <input id="rep-asg-link" type="url"
                                                    value={reportData.assignmentUrl}
                                                    onChange={e => setReportData(p => ({ ...p, assignmentUrl: e.target.value }))}
                                                    placeholder="https://..."
                                                    className={REPORT_INPUT} />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <FieldLabel htmlFor="rep-asg-done">Students completed / responded</FieldLabel>
                                                <input id="rep-asg-done" type="number" inputMode="numeric" min={0}
                                                    value={reportData.studentsCompletedCount}
                                                    onChange={e => setReportData(p => ({ ...p, studentsCompletedCount: e.target.value }))}
                                                    placeholder="Number of students"
                                                    className={REPORT_INPUT + " font-mono tabular-nums sm:max-w-[calc(50%-0.375rem)]"} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ReportSection>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-900">
                            {message?.type === "error" && !uploading && (
                                <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300" data-testid="report-error">{message.text}</p>
                            )}
                            {uploading && (
                                <div className="mb-3">
                                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                                        <span className="truncate">{uploadLabel}</span>
                                        <span className="tabular-nums">{uploadProgress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                        <div className="h-full bg-emerald-500 transition-[width] duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <button onClick={closeReport} disabled={uploading}
                                    className="h-11 px-5 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40">
                                    Cancel
                                </button>
                                <button onClick={() => { const lec = reportLec; if (lec) submitReport(lec); }}
                                    data-testid="final-submit"
                                    disabled={uploading}
                                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                                    {uploading ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Upload size={16} /> Submit Report</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

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

/* ── Lecture Report form building blocks ─────────────────────────────── */
const REPORT_INPUT = "w-full h-10 px-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-colors";
const REPORT_TEXTAREA = "w-full min-h-[76px] px-3 py-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 resize-y transition-colors";
const cnReport = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const REPORT_ACCENT: Record<string, { box: string; head: string; step: string }> = {
    indigo: { box: "border-indigo-500/20 border-l-indigo-500", head: "bg-indigo-500/[0.07] border-indigo-500/15", step: "bg-indigo-500/20 text-indigo-300" },
    amber: { box: "border-amber-500/20 border-l-amber-500", head: "bg-amber-500/[0.07] border-amber-500/15", step: "bg-amber-500/20 text-amber-300" },
    sky: { box: "border-sky-500/20 border-l-sky-500", head: "bg-sky-500/[0.07] border-sky-500/15", step: "bg-sky-500/20 text-sky-300" },
    teal: { box: "border-teal-500/20 border-l-teal-500", head: "bg-teal-500/[0.07] border-teal-500/15", step: "bg-teal-500/20 text-teal-300" },
    violet: { box: "border-violet-500/20 border-l-violet-500", head: "bg-violet-500/[0.07] border-violet-500/15", step: "bg-violet-500/20 text-violet-300" },
};

function ReportSection({ step, title, icon, tag, required, accent = "indigo", children }: { step: number; title: string; icon?: React.ReactNode; tag?: string; required?: boolean; accent?: string; children: React.ReactNode }) {
    const a = REPORT_ACCENT[accent] || REPORT_ACCENT.indigo;
    return (
        <section className={cnReport("rounded-xl border border-l-[3px] bg-zinc-950/30 overflow-hidden", a.box)}>
            <div className={cnReport("flex items-center justify-between gap-3 px-4 py-3 border-b", a.head)}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cnReport("shrink-0 w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center", a.step)}>{step}</span>
                    {icon}
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{title}</h3>
                </div>
                {tag && (
                    <span className={cnReport("shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border",
                        required ? "text-rose-300 border-rose-500/25 bg-rose-500/10" : "text-emerald-300 border-emerald-500/25 bg-emerald-500/10")}>{tag}</span>
                )}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function FieldLabel({ children, htmlFor, tone }: { children: React.ReactNode; htmlFor?: string; tone?: "warn" }) {
    return <label htmlFor={htmlFor} className={cnReport("block text-xs font-medium mb-1.5", tone === "warn" ? "text-amber-300" : "text-zinc-400")}>{children}</label>;
}

function UploadTile({ htmlFor, done, icon, title, hint, compact }: { htmlFor: string; done: boolean; icon: React.ReactNode; title: string; hint: string; compact?: boolean }) {
    return (
        <label htmlFor={htmlFor}
            className={cnReport("flex items-center gap-3 px-3 rounded-lg border border-dashed cursor-pointer transition-colors",
                compact ? "h-10" : "h-[60px]",
                done ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-zinc-700 bg-zinc-950/40 hover:border-sky-500/50 hover:bg-sky-500/[0.05]")}>
            <span className={cnReport("shrink-0", done ? "text-emerald-400" : "text-sky-400/80")}>{done ? <CheckCircle2 size={16} /> : icon}</span>
            <span className="min-w-0 flex-1">
                <span className={cnReport("block text-xs font-medium truncate", done ? "text-emerald-200" : "text-zinc-300")} title={title}>{title}</span>
                {!compact && <span className="block text-[11px] text-zinc-500 truncate">{hint}</span>}
            </span>
        </label>
    );
}

function CheckRow({ checked, onChange, label, hint, id, testId, tone }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id?: string; testId?: string; tone?: "warn" }) {
    return (
        <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
            <input id={id} type="checkbox" data-testid={testId} checked={checked} onChange={e => onChange(e.target.checked)}
                className={cnReport("mt-0.5 w-4 h-4 rounded cursor-pointer shrink-0", tone === "warn" ? "accent-amber-500" : "accent-emerald-500")} />
            <span className="min-w-0">
                <span className={cnReport("block text-sm font-medium", tone === "warn" ? "text-amber-200" : "text-zinc-200")}>{label}</span>
                {hint && <span className="block text-xs text-zinc-500 mt-0.5">{hint}</span>}
            </span>
        </label>
    );
}