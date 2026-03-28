"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import {
    FileText, Calendar, Users, Camera, Mic, Upload, AlertTriangle,
    CheckCircle2, BookOpen, Clock, X
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";

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
    timeStart?: string;
    timeStop?: string;
}

export default function LectureReportPage() {
    const { user } = useAuth();
    const [reports, setReports] = useState<ReportEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState("");
    const [aiInsightReport, setAiInsightReport] = useState<ReportEntry | null>(null);

    useEffect(() => {
        if (user?.id) {
            const now = new Date();
            const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            const today = ist.getFullYear() + "-" +
                (ist.getMonth() + 1).toString().padStart(2, '0') + "-" +
                ist.getDate().toString().padStart(2, '0');
            setSelectedDate(today);
        }
    }, [user]);

    useEffect(() => {
        if (user?.id && selectedDate) {
            fetchReports();
        }
    }, [user, selectedDate]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/faculty/lectures?facultyId=${user?.id}&date=${selectedDate}`);
            const data = await res.json();
            setReports(data.lectures || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!user || !["FACULTY", "PROFESSOR"].includes(user.role)) {
        return <div className="flex items-center justify-center h-[80vh] text-zinc-400">Access restricted</div>;
    }

    return (
        <div className="max-w-6xl mx-auto pt-10 pb-16 px-4 sm:px-6 space-y-10">
            {/* Header & Controls */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight flex items-center gap-3">
                            <FileText size={32} className="text-amber-400" />
                            My Class Records
                        </h1>
                        <p className="text-sm text-zinc-500 mt-2 font-medium">History of your lectures and attendance</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-xs font-bold text-white focus:border-amber-500 focus:outline-none transition-all w-full sm:w-auto" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reports Explorer */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest animate-pulse">Updating Records...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="rounded-[2.5rem] bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 p-20 text-center shadow-2xl">
                    <div className="w-24 h-24 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-8 border border-zinc-700/50">
                        <BookOpen size={40} className="text-zinc-600" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3">No Records Found</h3>
                    <p className="text-zinc-500 text-sm max-w-sm mx-auto font-medium">No reports filed for <span className="text-amber-400/80 font-bold">{selectedDate}</span>. Access the dashboard to log your sessions.</p>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-700">
                    <div className="rounded-[2rem] bg-zinc-900/40 border border-zinc-800/80 overflow-hidden shadow-2xl backdrop-blur-sm">
                        <div className="overflow-x-auto border-b border-zinc-800/50">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-zinc-800/30">
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-r border-zinc-800/50 w-16 text-center">Lec</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Lesson Details</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Class Details</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Schedule</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Attendance</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">Status</th>
                                        <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-right">Attachments</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {reports.map((r, i) => (
                                        <tr key={i} className="group hover:bg-zinc-800/20 transition-all duration-300">
                                            <td className="py-6 px-6 border-r border-zinc-800/50 text-center">
                                                <span className="text-xl font-black text-zinc-600 group-hover:text-amber-400/50 transition-colors uppercase">{r.lectureNumber}</span>
                                            </td>
                                            <td className="py-6 px-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">{r.courseName}</span>
                                                    <span className="text-[11px] text-zinc-500 font-medium line-clamp-1 mt-1">{r.topicsCovered}</span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-6">
                                                <div className="flex flex-col gap-1.5 min-w-[140px]">
                                                    {r.stream && <div className="flex items-center gap-2"><span className="text-[10px] font-black text-indigo-400 capitalize">Stream:</span> <span className="text-[10px] font-bold text-zinc-300">{r.stream}</span></div>}
                                                    {r.year && <div className="flex items-center gap-2"><span className="text-[10px] font-black text-emerald-400 capitalize">Year:</span> <span className="text-[10px] font-bold text-zinc-300">{r.year}</span></div>}
                                                    {r.semester && <div className="flex items-center gap-2"><span className="text-[10px] font-black text-violet-400 capitalize">Sem:</span> <span className="text-[10px] font-bold text-zinc-300">{r.semester}</span></div>}
                                                </div>
                                            </td>
                                            <td className="py-6 px-6 font-mono text-xs">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-zinc-300 font-bold tabular-nums">
                                                        <Clock size={12} className="text-amber-500" />
                                                        {r.timeStart ? `${r.timeStart} – ${r.timeStop}` : (r.classStartTime ? `${r.classStartTime.substring(0, 5)} – ${r.classEndTime?.substring(0, 5) || "..."}` : "—")}
                                                    </div>
                                                    <span className="text-[10px] text-zinc-600 font-bold uppercase italic">
                                                        Duration: {r.actualDurationMinutes || r.scheduledDuration || "—"} mins
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Users size={14} className="text-zinc-500" />
                                                        <span className={`text-sm font-black tabular-nums ${
                                                            (r.numberOfAttendees && r.totalStudents && (r.numberOfAttendees/r.totalStudents) < 0.5) ? "text-amber-500" : "text-zinc-300"
                                                        }`}>
                                                            {r.numberOfAttendees ?? "0"} <span className="text-zinc-600 font-bold mx-0.5">/</span> {r.totalStudents || "40"}
                                                        </span>
                                                    </div>
                                                    {(r.numberOfAttendees !== undefined || r.totalStudents) && (
                                                        <div className="w-20 bg-zinc-800 h-1 rounded-full overflow-hidden mt-1">
                                                            <div className={`h-full transition-all duration-1000 ${
                                                                (r.numberOfAttendees! / (r.totalStudents || 40)) < 0.5 ? "bg-amber-500" : "bg-emerald-500"
                                                            }`} style={{ width: `${Math.min(100, (r.numberOfAttendees! / (r.totalStudents || 40)) * 100)}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-6 px-6 text-center">
                                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-widest ${
                                                    r.status === "Completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                                    r.status === "In Progress" ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse" :
                                                    "bg-zinc-800 border-zinc-700 text-zinc-500"
                                                }`}>{r.status}</span>
                                            </td>
                                            <td className="py-6 px-6 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    {r.recordingUrl ? (
                                                        <div className="flex items-center gap-2">
                                                            <a href={r.recordingUrl} target="_blank" title="Listen/Download" className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-indigo-400 rounded-xl transition-all hover:scale-110 active:scale-95 border border-zinc-700/50">
                                                                <Mic size={16} />
                                                            </a>
                                                            <button 
                                                                onClick={() => r.aiAnalysisAt && setAiInsightReport(r)} 
                                                                disabled={!r.aiAnalysisAt}
                                                                title={r.aiAnalysisAt ? "AI Analysis Ready" : "AI Analysis Pending..."} 
                                                                className={`p-2.5 rounded-xl transition-all border border-zinc-700/50 ${
                                                                    r.aiAnalysisAt ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:scale-110 cursor-pointer" : "bg-zinc-800 text-zinc-700 opacity-40 cursor-wait"
                                                                }`}>
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                        </div>
                                                    ) : <div className="w-10 h-10 rounded-xl border border-dashed border-zinc-800 flex items-center justify-center text-zinc-800"><Mic size={16} /></div>}
                                                    {r.classPhotoUrl ? (
                                                        <a href={r.classPhotoUrl} target="_blank" className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-xl transition-all hover:scale-110 active:scale-95 border border-zinc-700/50">
                                                            <Camera size={16} />
                                                        </a>
                                                    ) : <div className="w-10 h-10 rounded-xl border border-dashed border-zinc-800 flex items-center justify-center text-zinc-800"><Camera size={16} /></div>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Integrated Warnings Section */}
                    {reports.some(r => r.warnings?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {reports.filter(r => r.warnings?.length > 0).map((r, i) => (
                                <div key={i} className="flex gap-4 p-5 bg-amber-500/5 border border-amber-500/10 rounded-3xl shadow-lg hover:border-amber-500/20 transition-all">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                                        <AlertTriangle size={18} className="text-amber-500 text-bold" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest italic">Lec #{r.lectureNumber} Non-Compliance</p>
                                        <p className="text-xs text-zinc-400 font-medium leading-relaxed">{r.warnings.join(". ")}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
                            {(aiInsightReport as any).keywords?.length > 0 && (
                                <section className="animate-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-emerald-400 font-black text-[10px] uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        Technical Vocabulary
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {(aiInsightReport as any).keywords.map((kw: string, idx: number) => (
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
