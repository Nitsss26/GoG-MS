"use client";

import { useState, useEffect } from "react";
import {
    Calendar, Clock, CheckCircle2, AlertTriangle,
    Zap, ShieldAlert, FileText, X, Play, Users,
    ArrowLeft, ArrowRight, BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        reasonForLessAttendance: ""
    });

    useEffect(() => {
        if (facultyId) {
            fetchLectures();
        }
    }, [facultyId, weekOffset]);

    const getWeekRange = (offset: number) => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7);
        const start = new Date(now.setDate(diff));
        const end = new Date(start);
        end.setDate(start.getDate() + 5);

        const format = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `${format(start)} – ${format(end)}`;
    };

    const fetchLectures = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1) + (weekOffset * 7);
            const monday = new Date(now.setDate(diff));
            const weekStart = monday.toISOString().split('T')[0];

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
            reasonForLessAttendance: ""
        });
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
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center">
                                                {lec.report ? (
                                                    <div className={cn(
                                                        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border",
                                                        (lec.report.warnings?.length || 0) > 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    )}>
                                                        {(lec.report.warnings?.length || 0) > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                                                        {(lec.report.warnings?.length || 0) > 0 ? "Flagged" : "Audited"}
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border bg-zinc-800/50 text-zinc-500 border-zinc-700/30">
                                                        <Clock size={12} /> Pending Submission
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 border-l border-zinc-800/10">
                                            <div className="flex items-center justify-end gap-2">
                                                {lec.report ? (
                                                    <button onClick={() => {
                                                        setReportData(lec.report);
                                                        setShowReport(lec.lectureNumber);
                                                    }} className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/10 transition-all flex items-center gap-2 group-hover:scale-105 active:scale-95">
                                                        <FileText size={16} />
                                                        <span className="text-[8px] font-black uppercase tracking-widest">Read Audit</span>
                                                    </button>
                                                ) : (
                                                    <div className="px-4 py-2 text-[8px] text-zinc-600 font-black uppercase tracking-widest italic opacity-50">Unavailable</div>
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
                                <button onClick={() => { setShowReport(null); resetReportForm(); }}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-600 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-7 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                        </div>

                        <div className="p-8 border-t border-zinc-800/50 flex justify-end">
                            <button onClick={() => setShowReport(null)}
                                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95">
                                Close Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
