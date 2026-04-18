"use client";

import { useState, useEffect } from "react";
import {
    Calendar, Clock, CheckCircle2, AlertTriangle,
    Zap, ShieldAlert, FileText, X, Play, Users,
    ArrowLeft, ArrowRight, BookOpen, Sparkles, Brain,
    Cpu, SearchCode, MessageSquareQuote, Quote, TrendingUp,
    Info, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';

interface FacultyLecturesViewProps {
    facultyId: string;
    facultyName: string;
}

export default function FacultyLecturesView({ facultyId, facultyName }: FacultyLecturesViewProps) {
    const [loading, setLoading] = useState(true);
    const [lectures, setLectures] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);

    // Modal state
    const [showReport, setShowReport] = useState<number | null>(null);
    const [reportData, setReportData] = useState({
        numberOfAttendees: "",
        totalStudents: "40",
        topicsCovered: "",
        issuesFaced: "",
        reasonForLessAttendance: "",
        pedagogicalAnalysis: null,
        isAIProcessed: false,
        transcription: ""
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState<"AUDIT" | "AI">("AUDIT");

    useEffect(() => {
        if (facultyId) {
            fetchLectures();
        }
    }, [facultyId, weekOffset]);

    const getWeekRange = (offset: number) => {
        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const dayOfWeek = istTime.getDay();
        
        const diffToCurrentMon = dayOfWeek === 0 ? 1 : (1 - dayOfWeek);
        const mon = new Date(istTime);
        mon.setDate(istTime.getDate() + diffToCurrentMon + (offset * 7));

        const sun = new Date(mon);
        sun.setDate(mon.getDate() - 1);
        const sat = new Date(mon);
        sat.setDate(mon.getDate() + 5);

        const format = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `${format(sun)} – ${format(sat)}`;
    };

    const fetchLectures = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            const istTime = new Date(istString);
            const dayOfWeek = istTime.getDay();
            
            const diffToCurrentMon = dayOfWeek === 0 ? 1 : (1 - dayOfWeek);
            const monday = new Date(istTime);
            monday.setDate(istTime.getDate() + diffToCurrentMon + (weekOffset * 7));
            
            const weekStart = monday.getFullYear() + "-" +
                (monday.getMonth() + 1).toString().padStart(2, '0') + "-" +
                monday.getDate().toString().padStart(2, '0');

            const res = await fetch(`/api/faculty/lectures?facultyId=${facultyId}&weekStartDate=${weekStart}`);
            const data = await res.json();
            setLectures(data.lectures || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    const resetReportForm = () => {
        setReportData({
            numberOfAttendees: "",
            totalStudents: "40",
            topicsCovered: "",
            issuesFaced: "",
            reasonForLessAttendance: "",
            pedagogicalAnalysis: null,
            isAIProcessed: false,
            transcription: ""
        });
        setActiveModalTab("AUDIT");
    };

    const handleGenerateAIAnalysis = async (reportId: string) => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        try {
            // STEP 1: TRANSCRIBE
            setReportData(prev => ({ ...prev, transcription: "Step 1/2: transcribing session audio..." }));
            
            const transRes = await fetch('/api/manager/lectures/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId })
            });
            
            const transText = await transRes.text();
            let transData;
            try {
                transData = JSON.parse(transText);
            } catch (err) {
                console.error("[UI] Transcribe Parse Error:", transText);
                throw new Error("Transcription phase failed (Server timeout). Please check connection.");
            }

            if (!transData.success) {
                throw new Error(transData.error || "Transcription failed");
            }

            // Immediately show transcription
            setReportData(prev => ({ 
                ...prev, 
                transcription: transData.transcription
            }));

            // STEP 2: ANALYZE
            setReportData(prev => ({ 
                ...prev, 
                pedagogicalAnalysis: { summary: "Step 2/2: analyzing pedagogical metrics..." } 
            }));

            const analRes = await fetch('/api/manager/lectures/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId })
            });

            const analText = await analRes.text();
            let analData;
            try {
                analData = JSON.parse(analText);
            } catch (err) {
                console.error("[UI] Analyze Parse Error:", analText);
                throw new Error("Analysis phase failed. Please try again.");
            }

            if (analData.success) {
                setReportData(prev => ({ 
                    ...prev, 
                    pedagogicalAnalysis: analData.analysis,
                    isAIProcessed: true
                }));
                // Refresh list
                fetchLectures();
            } else {
                alert(analData.error || "Analysis failed");
            }
        } catch (e: any) {
            console.error("[UI] Analysis Flow Error:", e);
            alert(`Analysis failed: ${e.message || "Unknown error"}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Lecture Schedule</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter tabular-nums">{getWeekRange(weekOffset)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all border border-zinc-800/50 hover:border-zinc-700">
                        <ArrowLeft size={14} />
                    </button>
                    <div className="px-4 py-1.5 bg-zinc-900/50 rounded-lg text-[10px] font-black text-white uppercase tracking-widest min-w-[100px] text-center border border-zinc-800/50">
                        Week {weekOffset === 0 ? "Current" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}
                    </div>
                    <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all border border-zinc-800/50 hover:border-zinc-700">
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : lectures.length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-3xl p-16 text-center">
                    <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-700/50 shadow-inner">
                        <BookOpen size={32} className="text-zinc-600" />
                    </div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-widest">Grid Empty</h3>
                    <p className="text-xs text-zinc-500 font-bold mt-2 max-w-xs mx-auto">No lectures have been scheduled in the sprint for this temporal range.</p>
                </div>
            ) : (
                <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/50 overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-zinc-950/50">
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/80">Lec</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/80">Time / Day</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/80">Course Details</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/80 text-center">Audit Status</th>
                                    <th className="px-6 py-4 text-right text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/80">Attachments</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {lectures.map((lec: any) => (
                                    <tr key={lec._id} className="group hover:bg-white/[0.02] transition-all">
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-black text-white tabular-nums tracking-tighter">#{lec.lectureNumber.toString().padStart(2, '0')}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-100 uppercase tracking-widest">
                                                    <Clock size={12} className="text-indigo-400" />
                                                    {lec.timeStart} – {lec.timeStop}
                                                </div>
                                                <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-1 ml-4.5">{lec.day} · {lec.date}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-white uppercase tracking-tight">{lec.courseName}</span>
                                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-0.5">{lec.stream} · {lec.year} ({lec.semester})</span>
                                                <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest mt-1 italic">Topic: {lec.topicsCovered}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 border-l border-zinc-800/10">
                                            <div className="flex items-center justify-center">
                                                {lec.report ? (
                                                    <div className={cn(
                                                        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-sm",
                                                        lec.report.auditStatus === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            lec.report.auditStatus === "Flagged" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                                "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                    )}>
                                                        {lec.report.auditStatus === "Approved" ? <CheckCircle2 size={12} /> :
                                                            lec.report.auditStatus === "Flagged" ? <AlertTriangle size={12} /> :
                                                                <Clock size={12} />}
                                                        {lec.report.auditStatus || "Pending"}
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border bg-zinc-800/50 text-zinc-500 border-zinc-700/30">
                                                        <Clock size={12} /> No Report
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 border-l border-zinc-800/10">
                                            <div className="flex items-center justify-end gap-3">
                                                {lec.report ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2">
                                                            {lec.report.recordingUrl && (
                                                                <div title="Recording Captured" className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-sm">
                                                                    <Play size={10} fill="currentColor" />
                                                                </div>
                                                            )}
                                                            {lec.report.classPhotoUrl && (
                                                                <div title="Photo Proof Uploaded" className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 shadow-sm">
                                                                    <Users size={10} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={() => {
                                                            setReportData({
                                                                ...lec.report,
                                                                transcription: lec.report.transcription || ""
                                                            });
                                                            setShowReport(lec.lectureNumber);
                                                        }} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/10 transition-all flex items-center gap-2 group-hover:scale-105 active:scale-95 shadow-sm">
                                                            <FileText size={14} />
                                                            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Open Audit</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50">Unavailable</div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Lecture Report Modal (Read-only view for Managers) */}
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
                                <div className="flex items-center gap-4">
                                    <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                                        <button 
                                            onClick={() => setActiveModalTab("AUDIT")}
                                            className={cn(
                                                "px-4 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                activeModalTab === "AUDIT" ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-white"
                                            )}
                                        >Audit</button>
                                        <button 
                                            onClick={() => setActiveModalTab("AI")}
                                            className={cn(
                                                "px-4 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5",
                                                activeModalTab === "AI" ? "bg-indigo-600 text-white shadow-lg" : "text-zinc-500 hover:text-white"
                                            )}
                                        >
                                            <Sparkles size={10} />
                                            AI Report
                                        </button>
                                    </div>
                                    <div className="w-px h-6 bg-zinc-800" />
                                    <button onClick={() => { setShowReport(null); resetReportForm(); }}
                                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-600 hover:text-white">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-7 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {activeModalTab === "AUDIT" ? (
                                <>
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

                                    <div className="space-y-1">
                                        <label className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-0.5">Topics Covered</label>
                                        <div className="px-4 py-3 bg-zinc-800/20 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 italic line-clamp-3">
                                            {reportData.topicsCovered || "No topics specified."}
                                        </div>
                                    </div>

                                    <div className="bg-zinc-950/40 rounded-2xl p-5 border border-zinc-800/80 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <Users size={12} className="text-amber-500/80" /> Attendance Audit
                                            </h4>
                                            {(reportData as any).numberOfAttendees && (reportData as any).totalStudents && (
                                                <span className="text-[9px] font-black text-amber-500/80 uppercase italic">
                                                    {Math.round((parseInt((reportData as any).numberOfAttendees) / parseInt((reportData as any).totalStudents)) * 100)}% Engagement
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                                                <p className="text-[8px] text-zinc-600 font-black uppercase mb-1">Present</p>
                                                <p className="text-sm font-black font-mono text-white">{(reportData as any).numberOfAttendees || 0}</p>
                                            </div>
                                            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                                                <p className="text-[8px] text-zinc-600 font-black uppercase mb-1">Total Strength</p>
                                                <p className="text-sm font-black font-mono text-white">{(reportData as any).totalStudents || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-1">Class Evidence</p>
                                            <div className="aspect-video bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden relative group/img">
                                                {(reportData as any).classPhotoUrl ? (
                                                    <>
                                                        <img src={(reportData as any).classPhotoUrl} alt="Class Photo" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                                                        <a href={(reportData as any).classPhotoUrl} target="_blank" rel="noopener noreferrer"
                                                            className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                            <Zap size={24} className="text-white drop-shadow-lg" />
                                                        </a>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-20">
                                                        <Zap size={24} />
                                                        <span className="text-[7px] font-black uppercase">No Image</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest pl-1">Session Recording</p>
                                            <div className="aspect-video bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden relative group/rec">
                                                {(reportData as any).recordingUrl ? (
                                                    <>
                                                        <div className="w-full h-full bg-indigo-500/5 flex flex-col items-center justify-center gap-1 group-hover/rec:bg-indigo-500/10 transition-colors">
                                                            <Play size={24} className="text-indigo-500/40 group-hover/rec:text-indigo-400 group-hover/rec:scale-110 transition-all" fill="currentColor" />
                                                            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mt-1">Ready for Sync</span>
                                                        </div>
                                                        <a href={(reportData as any).recordingUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" />
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-20">
                                                        <Play size={24} />
                                                        <span className="text-[7px] font-black uppercase">No Recording</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-8">
                                    {isAnalyzing ? (
                                        <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center">
                                            <div className="relative">
                                                <div className="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Brain className="text-indigo-400 animate-pulse" size={32} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-white italic uppercase tracking-[0.2em]">Analyzing Lecture</h3>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-[240px]">Gemini is processing audio vectors for pedagogical insights...</p>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-4 w-full max-w-sm pt-8">
                                                <div className="flex flex-col items-center gap-2 opacity-40">
                                                    <Cpu size={16} className="text-zinc-400" />
                                                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 w-full animate-[shimmer_2s_infinite]" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2 opacity-40">
                                                    <SearchCode size={16} className="text-zinc-400" />
                                                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 w-2/3" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2 opacity-40">
                                                    <MessageSquareQuote size={16} className="text-zinc-400" />
                                                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : reportData.pedagogicalAnalysis ? (
                                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {/* AI Header Stats */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center space-y-1">
                                                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Master Score</p>
                                                    <p className="text-2xl font-black text-white italic tracking-tighter">{(reportData.pedagogicalAnalysis as any).score}%</p>
                                                </div>
                                                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center space-y-1">
                                                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Enagement</p>
                                                    <p className="text-2xl font-black text-emerald-400 italic tracking-tighter">{(reportData.pedagogicalAnalysis as any).engagement}%</p>
                                                </div>
                                                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center space-y-1">
                                                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Clarity</p>
                                                    <p className="text-2xl font-black text-amber-400 italic tracking-tighter">{(reportData.pedagogicalAnalysis as any).clarity}%</p>
                                                </div>
                                                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center space-y-1">
                                                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Quality</p>
                                                    <p className="text-2xl font-black text-indigo-400 italic tracking-tighter">{(reportData.pedagogicalAnalysis as any).pedagogy}%</p>
                                                </div>
                                            </div>

                                            {/* Summary */}
                                            <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5 space-y-4">
                                                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <TrendingUp size={16} className="text-indigo-400" /> Executive summary
                                                </h3>
                                                <div className="text-sm font-bold text-zinc-400 leading-relaxed italic prose prose-invert max-w-none">
                                                    <ReactMarkdown>{(reportData.pedagogicalAnalysis as any).summary}</ReactMarkdown>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                        <Sparkles size={14} />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 font-bold italic tracking-tight">"{(reportData.pedagogicalAnalysis as any).industryBenchmarking}"</p>
                                                </div>
                                            </div>

                                            {/* Flags */}
                                            {((reportData.pedagogicalAnalysis as any).flags?.length > 0) && (
                                                <div className="space-y-3">
                                                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                        <ShieldAlert size={14} className="text-red-500" /> Pedagogical Observations
                                                    </h3>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {(reportData.pedagogicalAnalysis as any).flags.map((flag: any, i: number) => (
                                                            <div key={i} className={cn(
                                                                "p-4 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.01]",
                                                                flag.type === "critical" ? "bg-red-500/5 border-red-500/20" : 
                                                                flag.type === "warning" ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/20"
                                                            )}>
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                                                    flag.type === "critical" ? "bg-red-500/10 text-red-500" : 
                                                                    flag.type === "warning" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                                                                )}>
                                                                    {flag.type === "critical" ? <AlertTriangle size={16} /> : <Info size={16} />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-zinc-100 italic">{flag.message}</p>
                                                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{flag.timestamp || "00:00"}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sections Timeline */}
                                            <div className="space-y-4">
                                                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Clock size={14} className="text-indigo-400" /> Session Roadmap
                                                </h3>
                                                <div className="space-y-4 relative pl-4 border-l border-zinc-800 ml-2">
                                                    {(reportData.pedagogicalAnalysis as any).sections.map((section: any, i: number) => (
                                                        <div key={i} className="relative space-y-2">
                                                            <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-zinc-900 border-2 border-indigo-500" />
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-xs font-black text-white italic uppercase">{section.title}</h4>
                                                                <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">{section.startTime} - {section.endTime}</span>
                                                            </div>
                                                            <p className="text-[11px] font-bold text-zinc-500 leading-relaxed">{section.summary}</p>
                                                            <div className="flex flex-wrap gap-2 pt-1">
                                                                {section.keyTakeaways.map((tk: string, j: number) => (
                                                                    <span key={j} className="text-[8px] font-black text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-700/50 uppercase tracking-tighter">
                                                                        {tk}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Sentence Improvements */}
                                            {((reportData.pedagogicalAnalysis as any).sentenceImprovements?.length > 0) && (
                                                <div className="space-y-4">
                                                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                        <MessageSquareQuote size={14} className="text-emerald-400" /> Diction Refinements
                                                    </h3>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {(reportData.pedagogicalAnalysis as any).sentenceImprovements.map((imp: any, i: number) => (
                                                            <div key={i} className="bg-zinc-950/50 rounded-2xl border border-zinc-800/80 p-5 space-y-4 group/imp hover:bg-zinc-950 transition-all">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Quote size={10} className="text-zinc-600" />
                                                                        <p className="text-xs font-bold text-zinc-500 italic line-through opacity-50">{imp.original}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Sparkles size={12} className="text-emerald-400" />
                                                                        <p className="text-xs font-black text-white italic tracking-tight">{imp.improved}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
                                                                    <p className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest">{imp.reason}</p>
                                                                    <span className="text-[8px] font-black text-zinc-600">{imp.timestamp}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Gap Analysis */}
                                            <div className="bg-gradient-to-br from-indigo-500/10 to-transparent p-6 rounded-3xl border border-indigo-500/10 space-y-6">
                                                <h3 className="text-xs font-black text-indigo-100 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <Sparkles size={16} className="text-indigo-400" /> Gap Analysis
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Missing Concepts</h4>
                                                        <div className="flex flex-col gap-2">
                                                            {(reportData.pedagogicalAnalysis as any).gapAnalysis.missingConcepts.map((c: string, i: number) => (
                                                                <div key={i} className="flex items-center gap-3">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400/40" />
                                                                    <p className="text-xs font-bold text-zinc-300">{c}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Improvement Path</h4>
                                                        <div className="flex flex-col gap-2">
                                                            {(reportData.pedagogicalAnalysis as any).suggestions.slice(0, 3).map((s: string, i: number) => (
                                                                <div key={i} className="flex items-center gap-3">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/40" />
                                                                    <p className="text-xs font-bold text-zinc-300">{s}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Full Transcript */}
                                                {reportData.transcription && (
                                                    <div className="space-y-4">
                                                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                            <MessageSquare size={14} className="text-zinc-400" /> Session Transcript
                                                        </h3>
                                                        <div className="bg-zinc-950/30 border border-zinc-800/80 rounded-2xl p-6 max-h-60 overflow-y-auto custom-scrollbar">
                                                            <pre className="text-[11px] font-medium text-zinc-400 whitespace-pre-wrap leading-relaxed font-mono">
                                                                {reportData.transcription}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center">
                                            <div className="w-20 h-20 bg-zinc-800/50 rounded-[2rem] flex items-center justify-center border border-zinc-700/50 shadow-inner">
                                                <Sparkles size={32} className="text-zinc-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-white italic uppercase tracking-[0.2em]">No Report Generated</h3>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-xs">Run the neural analysis to extract pedagogical insights from this lecture's recording.</p>
                                            </div>
                                            <button 
                                                onClick={() => handleGenerateAIAnalysis((reportData as any)._id)}
                                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center gap-2 group"
                                            >
                                                <Brain size={16} className="group-hover:rotate-12 transition-transform" />
                                                Generate AI Report
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-8 border-t border-zinc-800/50 bg-zinc-950/20">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex flex-col gap-2 w-full sm:w-auto">
                                    <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest pl-1">HOI Audit Decision</p>
                                    <div className="flex items-center gap-2">
                                        <button onClick={async () => {
                                            const res = await fetch('/api/manager/lectures/audit', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ reportId: (reportData as any)._id, status: 'Approved' })
                                            });
                                            if (res.ok) fetchLectures();
                                        }} className={cn(
                                            "flex-1 sm:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                                            (reportData as any).auditStatus === "Approved" ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                        )}>Approve</button>

                                        <button onClick={async () => {
                                            const res = await fetch('/api/manager/lectures/audit', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ reportId: (reportData as any)._id, status: 'Flagged' })
                                            });
                                            if (res.ok) fetchLectures();
                                        }} className={cn(
                                            "flex-1 sm:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                                            (reportData as any).auditStatus === "Flagged" ? "bg-red-500 text-white border-red-500 shadow-red-500/20" : "text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20"
                                        )}>Flag</button>

                                        <button onClick={async () => {
                                            const res = await fetch('/api/manager/lectures/audit', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ reportId: (reportData as any)._id, status: 'Pending' })
                                            });
                                            if (res.ok) fetchLectures();
                                        }} className={cn(
                                            "flex-1 sm:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                                            (reportData as any).auditStatus === "Pending" ? "bg-amber-500 text-white border-amber-500 shadow-amber-500/20" : "text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20"
                                        )}>Reset</button>
                                    </div>
                                </div>
                                <button onClick={() => setShowReport(null)}
                                    className="w-full sm:w-auto px-10 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg">
                                    Close Audit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
