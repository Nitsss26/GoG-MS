"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef } from "react";
import {
    Play, Square, Clock, Timer, AlertTriangle, CheckCircle2,
    BookOpen, Upload, Camera, FileText, Mic, Users, X, Loader2,
    Calendar, Download
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import * as XLSX from "xlsx";
import { format } from "date-fns";

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
    const [reportData, setReportData] = useState({
        numberOfAttendees: "",
        totalStudents: "",
        semester: "",
        issuesFaced: "",
        reasonForLessAttendance: "",
        topicsCovered: "",
        courseName: "",
    });
    const [recordingFile, setRecordingFile] = useState<File | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [photoCoords, setPhotoCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Date state for schedule and export
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [exportLoading, setExportLoading] = useState(false);

    useEffect(() => {
        if (user?.id) fetchLectures();
    }, [user, selectedDate]);

    const fetchLectures = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/faculty/lectures?facultyId=${user?.id}&date=${selectedDate}`);
            const data = await res.json();
            if (data.lectures) {
                setLectures(data.lectures);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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
        setUploading(true);
        try {
            let recordingUrl = "";
            let classPhotoUrl = "";
            if (recordingFile) {
                const result = await uploadToCloudinary(recordingFile);
                recordingUrl = result.secure_url;
            }
            if (photoFile) {
                const result = await uploadToCloudinary(photoFile);
                classPhotoUrl = result.secure_url;
            }
            const res = await fetch("/api/faculty/lectures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId: user?.id,
                    date: selectedDate,
                    lectureNumber: lec.lectureNumber,
                    courseName: reportData.courseName,
                    topicsCovered: reportData.topicsCovered,
                    stream: lec.stream,
                    year: lec.year,
                    semester: lec.semester,
                    numberOfAttendees: parseInt(reportData.numberOfAttendees) || 0,
                    totalStudents: parseInt(reportData.totalStudents) || 0,
                    issuesFaced: reportData.issuesFaced,
                    reasonForLessAttendance: reportData.reasonForLessAttendance,
                    classPhotoUrl,
                    classPhotoLat: photoCoords?.lat,
                    classPhotoLng: photoCoords?.lng,
                    recordingUrl,
                    recordingDurationSeconds: recordingDuration,
                    sprintPlanId: lec.sprintPlanId,
                    scheduledDuration: lec.scheduledDuration,
                })
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Report submitted successfully!" });
                setShowReport(null);
                resetReportForm();
                fetchLectures();
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setUploading(false);
        }
    };

    const resetReportForm = () => {
        setReportData({ numberOfAttendees: "", totalStudents: "", semester: "", issuesFaced: "", reasonForLessAttendance: "", topicsCovered: "", courseName: "" });
        setRecordingFile(null);
        setPhotoFile(null);
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

    const istDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const today = new Date(istDate);
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const yearDisplay = today.getFullYear();
    const todayLabel = `${day}-${month}-${yearDisplay}`;
    const weekday = today.toLocaleDateString("en-IN", { weekday: "long" });

    return (
        <div className="max-w-6xl mx-auto pt-10 pb-20 px-4 sm:px-6 space-y-10 min-h-screen bg-transparent">
            {/* Header Block */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-[2.5rem] blur opacity-25" />
                <div className="relative bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/80 rounded-[2.5rem] p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-2xl">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                <Timer size={32} className="text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tighter">My Lectures</h1>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em] italic">{weekday}</p>
                                    <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                        <Calendar size={12} className="text-emerald-400" />
                                        <input 
                                            type="date" 
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="bg-transparent text-[10px] font-black text-emerald-400 uppercase tracking-widest outline-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-3 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Live Schedule Sync</span>
                    </div>
                </div>
            </div>

            {/* Export Controls */}
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-[2rem] p-8 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl">
                <div className="flex flex-col md:flex-row items-center gap-6 w-full lg:w-auto">
                    <div className="space-y-2 w-full md:w-auto">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar size={12} className="text-emerald-500" /> Date From
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full md:w-48 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                        />
                    </div>
                    <div className="space-y-2 w-full md:w-auto">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar size={12} className="text-emerald-500" /> Date To
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full md:w-48 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <button
                        onClick={downloadExcelReport}
                        disabled={exportLoading}
                        className="w-full lg:w-auto px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {exportLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {exportLoading ? "Generating Record..." : "Download Report"}
                        </span>
                    </button>
                    <div className="hidden lg:block h-12 w-px bg-zinc-800/80" />
                    {/* <div className="hidden lg:block text-right">
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Format</p>
                        <p className="text-xs font-black text-emerald-400 italic">MS-EXCEL .XLSX</p>
                    </div> */}
                </div>
            </div>

            {message && (
                <div className={`flex items-center gap-4 rounded-3xl px-8 py-5 text-sm font-bold backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-6 duration-500 border-l-4 ${message.type === "success" ? "bg-emerald-500/5 border-emerald-500/50 text-emerald-400" :
                    message.type === "warning" ? "bg-amber-500/5 border-amber-500/50 text-amber-400" :
                        "bg-red-500/5 border-red-500/50 text-red-400"
                    }`}>
                    {message.type === "success" ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                    <span className="flex-1 tracking-tight">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="p-2 hover:bg-white/10 rounded-full transition-all">✕</button>
                </div>
            )}

            {/* Tactical Grid Table */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-2xl" />
                    <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Initializing Grid...</p>
                </div>
            ) : lectures.length === 0 ? (
                <div className="rounded-[3rem] bg-zinc-900/20 backdrop-blur-md border border-zinc-800/80 p-24 text-center shadow-inner group overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent" />
                    <div className="relative z-10">
                        <div className="w-24 h-24 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-8 border border-zinc-700/50 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                            <BookOpen size={40} className="text-zinc-600" />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-3 tracking-tighter">Terminal Empty</h3>
                        <p className="text-zinc-500 text-sm max-w-sm mx-auto font-medium">Verify your <span className="text-emerald-500 font-bold">Sprint Plan</span> to broadcast today&apos;s academic modules.</p>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="rounded-[2rem] bg-zinc-900/40 border border-zinc-800/80 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-zinc-800/30">
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-r border-zinc-800/50 w-16 text-center">Lec</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Lesson Details</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Class Details</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Schedule</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Attendance</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">Status</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {lectures.map((lec) => (
                                        <tr key={lec.lectureNumber} className={`group transition-all duration-300 ${lec.status === "In Progress" ? "bg-emerald-500/[0.03]" : "hover:bg-white/[0.02]"}`}>
                                            <td className="py-6 px-6 border-r border-zinc-800/50 text-center relative">
                                                <span className={`text-xl font-black tabular-nums transition-colors ${lec.status === "In Progress" ? "text-emerald-400" :
                                                    lec.status === "Completed" ? "text-zinc-700" : "text-zinc-500"
                                                    }`}>{lec.lectureNumber}</span>
                                                {lec.status === "In Progress" && (
                                                    <span className="absolute top-1/2 -translate-y-1/2 left-3 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
                                                )}
                                            </td>
                                            <td className="py-6 px-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-sm font-black tracking-tight transition-colors ${lec.status === "In Progress" ? "text-emerald-400" : "text-white"
                                                        }`}>{lec.courseName}</span>
                                                    <span className="text-[11px] text-zinc-500 font-medium opacity-80 italic line-clamp-1">{lec.topicsCovered}</span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-6">
                                                <div className="flex flex-col gap-1.5 min-w-[140px]">
                                                    {lec.stream && <div className="flex items-center gap-2"><span className="text-[10px] font-black text-indigo-400 capitalize">Stream:</span> <span className="text-[10px] font-bold text-zinc-300">{lec.stream}</span></div>}
                                                    {lec.year && <div className="flex items-center gap-2"><span className="text-[10px] font-black text-emerald-400 capitalize">Year:</span> <span className="text-[10px] font-bold text-zinc-300">{lec.year}</span></div>}
                                                    {lec.semester && <div className="flex items-center gap-2"><span className="text-[10px] font-black text-violet-400 capitalize">Sem:</span> <span className="text-[10px] font-bold text-zinc-300">{lec.semester}</span></div>}
                                                </div>
                                            </td>
                                            <td className="py-6 px-6 font-mono text-xs">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-zinc-300 font-bold tabular-nums">
                                                        <Clock size={12} className="text-amber-500" />
                                                        <span className="tabular-nums whitespace-nowrap">{lec.timeStart} – {lec.timeStop}</span>
                                                    </div>
                                                    <span className="text-[10px] text-zinc-600 font-bold uppercase italic">
                                                        Duration: {lec.scheduledDuration} mins
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-6">
                                                {lec.status === "Completed" ? (
                                                    <div className="flex flex-col gap-2 w-32">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Attendees</span>
                                                            <span className="text-sm font-black text-white tabular-nums">{lec.report?.numberOfAttendees} <span className="text-zinc-700 font-bold">/</span> {lec.report?.totalStudents || "40"}</span>
                                                        </div>
                                                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-1000 ${(lec.report?.numberOfAttendees! / (lec.report?.totalStudents || 40)) < 0.5
                                                                ? "bg-amber-500"
                                                                : "bg-emerald-500"
                                                                }`} style={{ width: `${Math.min(100, (lec.report?.numberOfAttendees! / (lec.report?.totalStudents || 40)) * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-zinc-700">
                                                        <Users size={14} />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest italic opacity-50">Pending</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-6 px-6 text-center uppercase tracking-widest text-[10px] font-black">
                                                <div className={`mx-auto w-fit px-3 py-1.5 rounded-lg border transition-all ${lec.status === "Completed" ? "bg-zinc-800/40 border-zinc-800 text-zinc-600" :
                                                    "bg-zinc-900 border-zinc-800/50 text-zinc-500"
                                                    }`}>
                                                    {lec.status}
                                                </div>
                                            </td>
                                            <td className="py-6 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {lec.status !== "Completed" ? (
                                                        <button onClick={() => {
                                                            setShowReport(lec.lectureNumber);
                                                            setReportData({
                                                                courseName: lec.courseName,
                                                                topicsCovered: lec.topicsCovered,
                                                                semester: lec.semester || "",
                                                                numberOfAttendees: lec.report?.numberOfAttendees?.toString() || "",
                                                                totalStudents: lec.report?.totalStudents?.toString() || "40",
                                                                issuesFaced: "",
                                                                reasonForLessAttendance: ""
                                                            });
                                                        }}
                                                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg active:scale-95 text-[10px] font-black uppercase tracking-widest">
                                                            <Upload size={14} />
                                                            Submit Report
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => {
                                                            setShowReport(lec.lectureNumber);
                                                            setReportData({
                                                                courseName: lec.courseName,
                                                                topicsCovered: lec.topicsCovered,
                                                                semester: lec.semester || "",
                                                                numberOfAttendees: lec.report?.numberOfAttendees?.toString() || "",
                                                                totalStudents: lec.report?.totalStudents?.toString() || "",
                                                                issuesFaced: "",
                                                                reasonForLessAttendance: ""
                                                            });
                                                        }}
                                                            className="p-3 bg-zinc-800 hover:bg-zinc-700 text-amber-500 rounded-xl border border-zinc-700/50 transition-all shadow-md active:scale-95">
                                                            <FileText size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                        Lec: <span className="text-zinc-300">#{showReport}</span> <span className="text-zinc-800">/</span> <span className="text-indigo-400 italic line-clamp-1">{lectures.find(l => l.lectureNumber === showReport)?.courseName}</span>
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
                                        {lectures.find(l => l.lectureNumber === showReport)?.stream || "—"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Year</label>
                                    <div className="px-3 py-2 bg-zinc-800/30 border border-zinc-800 rounded-xl text-[10px] font-black text-emerald-400 capitalize truncate">
                                        {lectures.find(l => l.lectureNumber === showReport)?.year || "—"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Sem</label>
                                    <div className="px-3 py-2 bg-zinc-800/30 border border-zinc-800 rounded-xl text-[10px] font-black text-violet-400 capitalize truncate">
                                        {lectures.find(l => l.lectureNumber === showReport)?.semester || "—"}
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
                                            <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Present</label>
                                            <input type="number"
                                                value={reportData.numberOfAttendees}
                                                onChange={e => setReportData(p => ({ ...p, numberOfAttendees: e.target.value }))}
                                                className="w-full h-10 px-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-black font-mono text-white focus:border-amber-500/50 outline-none transition-all"
                                                placeholder="0" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Total</label>
                                            <input type="number"
                                                value={reportData.totalStudents}
                                                onChange={e => setReportData(p => ({ ...p, totalStudents: e.target.value }))}
                                                className="w-full h-10 px-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-black font-mono text-white focus:border-amber-500/50 outline-none transition-all"
                                                placeholder="40" />
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
                                </div>

                                {/* Media Validation Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest pl-0.5 flex items-center gap-1.5">
                                            <Camera size={12} className="text-zinc-500" /> Photo
                                        </label>
                                        <div className="relative group/photo">
                                            <input type="file" accept="image/*" capture="environment"
                                                onChange={e => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])}
                                                className="hidden" id="photo-upload" />
                                            <label htmlFor="photo-upload" className="flex items-center gap-3 px-4 py-3 bg-zinc-800/20 border-2 border-dashed border-zinc-800 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-all">
                                                {photoFile ? <CheckCircle2 className="text-emerald-500" size={18} /> : <Upload className="text-zinc-700" size={18} />}
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase">{photoFile ? "Attached" : "Take Photo"}</span>
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
                                            <Mic size={12} className="text-zinc-500" /> Recording
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
                            </div>
                        </div>

                        {/* Modal Command Center */}
                        <div className="p-6 bg-zinc-950/30 border-t border-zinc-800/50 flex items-center gap-3">
                            <button onClick={() => { setShowReport(null); resetReportForm(); }}
                                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                                Cancel
                            </button>
                            <button onClick={() => {
                                const lec = lectures.find(l => l.lectureNumber === showReport);
                                if (lec) submitReport(lec);
                            }}
                                disabled={uploading || !photoFile || !recordingFile}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-30">
                                {uploading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
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
