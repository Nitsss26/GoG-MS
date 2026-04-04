"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { 
    Users, Calendar, BookOpen, AlertTriangle, Clock, 
    CheckCircle2, ChevronRight, ArrowLeft, Filter, Search,
    BarChart3, FileText, Zap, ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AcademicMonitoring() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ plans: [], reports: [], reportees: [] });
    const [selectedReportee, setSelectedReportee] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<"PLANS" | "REPORTS">("PLANS");
    const [weekOffset, setWeekOffset] = useState(0);

    useEffect(() => {
        if (user?.id) {
            fetchData();
        }
    }, [user, weekOffset]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get Monday of the week based on offset
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1) + (weekOffset * 7);
            const monday = new Date(now.setDate(diff));
            const weekStart = monday.toISOString().split('T')[0];

            const res = await fetch(`/api/manager/reportees/academic-data?managerId=${user?.id}&weekStartDate=${weekStart}`);
            const json = await res.json();
            setData(json);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) {
        return <div className="p-20 text-center text-zinc-500">Access Restricted</div>;
    }

    const filteredPlans = selectedReportee === "all" 
        ? data.plans 
        : data.plans.filter((p: any) => p.facultyId === selectedReportee);

    const filteredReports = selectedReportee === "all"
        ? data.reports
        : data.reports.filter((r: any) => r.facultyId === selectedReportee);

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Link href="/manager" className="text-[10px] font-black text-zinc-500 hover:text-indigo-400 flex items-center gap-1 mb-2 uppercase tracking-widest transition-colors">
                        <ArrowLeft size={12} /> Back to Hub
                    </Link>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <BookOpen className="text-emerald-400" size={24} />
                        </div>
                        Academic Monitoring
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-bold">HOI Control Center • Team Performance</p>
                </div>

                <div className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/50">
                    <div className="flex items-center gap-2 px-3 border-r border-zinc-800">
                        <Filter size={14} className="text-zinc-500" />
                        <select 
                            value={selectedReportee} 
                            onChange={(e) => setSelectedReportee(e.target.value)}
                            className="bg-transparent text-xs font-bold text-zinc-300 focus:outline-none appearance-none cursor-pointer pr-4"
                        >
                            <option value="all">All Reportees</option>
                            {data.reportees.map((r: any) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><ArrowLeft size={14} /></button>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest min-w-[80px] text-center">Week {weekOffset === 0 ? "Current" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}</span>
                        <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><ArrowRight size={14} /></button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 w-full sm:w-fit">
                <button 
                    onClick={() => setActiveTab("PLANS")}
                    className={cn(
                        "flex-1 sm:flex-none px-8 py-3 text-[10px] font-black rounded-xl transition-all tracking-widest uppercase",
                        activeTab === "PLANS" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    Sprint Plans
                </button>
                <button 
                    onClick={() => setActiveTab("REPORTS")}
                    className={cn(
                        "flex-1 sm:flex-none px-8 py-3 text-[10px] font-black rounded-xl transition-all tracking-widest uppercase",
                        activeTab === "REPORTS" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    Lecture Audits
                </button>
            </div>            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Reportee-wise Grouping */}
                    {(selectedReportee === "all" ? data.reportees : data.reportees.filter((r: any) => r.id === selectedReportee)).map((reportee: any) => {
                        const reporteePlans = data.plans.filter((p: any) => p.facultyId === reportee.id);
                        const reporteeReports = data.reports.filter((r: any) => r.facultyId === reportee.id);
                        
                        // Hide reportees with no data if viewing "all" and they are empty? 
                        // Actually, better to show them as "No Submission" for accountability.
                        
                        return (
                            <section key={reportee.id} className="space-y-4">
                                <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 w-fit">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black text-indigo-400 border border-indigo-500/20">
                                        {reportee.name?.[0]}
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-white leading-none">{reportee.name}</h2>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{reportee.id} • {reportee.designation || "Faculty"}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 ml-2 sm:ml-6 border-l-2 border-zinc-800/30 pl-4 sm:pl-6">
                                    {activeTab === "PLANS" ? (
                                        reporteePlans.length === 0 ? (
                                            <div className="p-4 bg-zinc-900/20 rounded-2xl border border-zinc-800/50 border-dashed text-[10px] text-zinc-500 italic font-bold uppercase tracking-widest">
                                                No Sprint Plan Submitted
                                            </div>
                                        ) : (
                                            reporteePlans.map((plan: any) => (
                                                <div key={plan._id} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-all">
                                                    <div className="p-4 border-b border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                                                plan.isLocked ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                            )}>
                                                                {plan.isLocked ? "Locked" : "Draft"}
                                                            </div>
                                                            <span className="text-[10px] text-zinc-600 font-bold tabular-nums tracking-tighter italic">
                                                                Applied: {new Date(plan.createdAt || Date.now()).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {["MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => (
                                                                <div key={day} className={cn(
                                                                    "w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-black border",
                                                                    plan.entries.some((e: any) => e.day === day) ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" : "bg-zinc-800/30 border-zinc-800/50 text-zinc-600"
                                                                )}>
                                                                    {day[0]}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-zinc-900/30">
                                                        <div className="flex flex-wrap gap-2">
                                                            {plan.entries.slice(0, 8).map((e: any, idx: number) => (
                                                                <div key={idx} className="px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50 text-[9px] text-zinc-300">
                                                                    <span className="font-bold text-zinc-500 mr-1">{e.day}</span> {e.course}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        reporteeReports.length === 0 ? (
                                            <div className="p-4 bg-zinc-900/20 rounded-2xl border border-zinc-800/50 border-dashed text-[10px] text-zinc-500 italic font-bold uppercase tracking-widest">
                                                No Lecture Reports Found
                                            </div>
                                        ) : (
                                            reporteeReports.map((report: any) => (
                                                <div key={report._id} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all">
                                                    <div className="p-4 flex flex-col sm:flex-row gap-4">
                                                        <div className="w-full sm:w-32 aspect-video sm:aspect-square rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden relative shrink-0">
                                                            {report.classPhotoUrl ? (
                                                                <img src={report.classPhotoUrl} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-zinc-600"><Zap size={16} /></div>
                                                            )}
                                                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-black text-white uppercase tracking-widest">
                                                                {report.date}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="text-sm font-black text-white">{report.courseName} <span className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">{report.stream}</span></h3>
                                                                <div className={cn(
                                                                    "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border flex items-center gap-1.5",
                                                                    (report.warnings?.length || 0) > 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                )}>
                                                                    <ShieldAlert size={10} />
                                                                    {(report.warnings?.length || 0) > 0 ? "Flagged" : "Clear"}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                <div className="p-1.5 bg-zinc-800/40 rounded-lg text-center">
                                                                    <p className="text-[7px] text-zinc-500 font-black uppercase">Att.</p>
                                                                    <p className="text-[10px] font-black text-white">{report.numberOfAttendees}</p>
                                                                </div>
                                                                <div className="p-1.5 bg-zinc-800/40 rounded-lg text-center">
                                                                    <p className="text-[7px] text-zinc-500 font-black uppercase">Dur.</p>
                                                                    <p className="text-[10px] font-black text-white">{report.recordingDurationSeconds ? Math.floor(report.recordingDurationSeconds/60) : 0}m</p>
                                                                </div>
                                                                <div className="p-1.5 bg-zinc-800/40 rounded-lg text-center">
                                                                    <p className="text-[7px] text-zinc-500 font-black uppercase">Score</p>
                                                                    <p className="text-[10px] font-black text-emerald-400">{report.analysis?.score || "—"}</p>
                                                                </div>
                                                                <div className="p-1.5 bg-zinc-800/40 rounded-lg text-center">
                                                                    <p className="text-[7px] text-zinc-500 font-black uppercase">Warn</p>
                                                                    <p className="text-[10px] font-black text-red-400">{report.warnings?.length || 0}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ArrowRight({ size, className }: { size: number; className?: string }) {
    return <ChevronRight size={size} className={className} />;
}
