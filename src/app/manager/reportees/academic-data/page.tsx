"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import {
    Users, Calendar, BookOpen, Clock,
    ChevronRight, ArrowLeft, Filter, Search,
    GraduationCap, Briefcase, Download, Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import FacultySprintPlanView from "@/components/academic/FacultySprintPlanView";
import FacultyLecturesView from "@/components/academic/FacultyLecturesView";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export default function AcademicMonitoring() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ plans: [], reports: [], reportees: [] });
    const [sprintSummary, setSprintSummary] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    // NEW: Export States
    const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [exportLoading, setExportLoading] = useState(false);
    const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

    // Selection state
    const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"PLANS" | "REPORTS">("PLANS");

    useEffect(() => {
        if (user?.id) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetching reportees (the API now returns roles)
            const res = await fetch(`/api/manager/reportees/academic-data?managerId=${user?.id}`);
            const json = await res.json();

            // Filter reportees to only show FACULTY and PROFESSOR roles as requested
            const facultiesOnly = (json.reportees || []).filter((r: any) =>
                ["FACULTY", "PROFESSOR"].includes(r.role)
            );

            setData({ ...json, reportees: facultiesOnly });

            // Fetch Sprint Summary for next week
            const summaryRes = await fetch(`/api/manager/reportees/sprint-summary?managerId=${user?.id}`);
            const summaryJson = await summaryRes.json();
            setSprintSummary(summaryJson.summary || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const downloadBulkReport = async () => {
        if (!user?.id) return;
        setExportLoading(true);
        try {
            const res = await fetch(`/api/manager/lectures/export?managerId=${user.id}&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();

            if (!data.reports || data.reports.length === 0) {
                alert("No reports with recordings found in this date range.");
                return;
            }

            const worksheetData = data.reports.map((l: any, i: number) => ({
                "Sr #": i + 1,
                "Date": format(new Date(l.date || Date.now()), "dd-MM-yyyy"),
                "Faculty Name": l.facultyName,
                "Faculty ID": l.facultyId,
                "Subject": l.courseName,
                "Topics": l.topicsCovered,
                "Stream/Year/Sem": `${l.stream} / ${l.year} / ${l.semester}`,
                "Attendees": l.numberOfAttendees,
                "Total Students": l.totalStudents,
                "Attendance %": l.totalStudents ? ((l.numberOfAttendees / l.totalStudents) * 100).toFixed(1) + "%" : "0%",
                "AI Rating": l.rating,
                "LQS Score": l.score,
                "Recording Link": l.recordingUrl || "N/A",
                "Photo Link": l.classPhotoUrl || "N/A"
            }));

            const ws = XLSX.utils.json_to_sheet(worksheetData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Lecture Audit Export");

            // Auto-size columns
            const colWidths = Object.keys(worksheetData[0] || {}).map(key => ({
                wch: Math.max(key.length, ...worksheetData.map((row: any) => row[key]?.toString().length || 0)) + 2
            }));
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `Team_Lecture_Reports_${startDate}_to_${endDate}.xlsx`);
            setMessage({ type: "success", text: "Reports exported successfully!" });
        } catch (e: any) {
            console.error(e);
            alert("Export failed: " + e.message);
        } finally {
            setExportLoading(false);
        }
    };

    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) {
        return <div className="p-20 text-center text-zinc-500">Access Restricted</div>;
    }

    // Filter faculty list by search
    const filteredFaculties = data.reportees.filter((f: any) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
            {!selectedFaculty ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <Link href="/manager" className="text-[10px] font-black text-zinc-500 hover:text-indigo-400 flex items-center gap-1 mb-2 uppercase tracking-widest transition-colors group">
                                <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> Back to Hub
                            </Link>
                            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <BookOpen className="text-emerald-400" size={24} />
                                </div>
                                Academic Monitoring
                            </h1>
                            <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-black italic">Team Performance & Sync Status</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/50">
                            {/* NEW: Export Controls for HOIs */}
                            <div className="flex items-center gap-2 px-3 border-r border-zinc-800 pr-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest pl-1">Range Start</span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-zinc-800 text-[10px] font-black text-white px-2 py-1 rounded outline-none border border-zinc-700 w-28 cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest pl-1">Range End</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-zinc-800 text-[10px] font-black text-white px-2 py-1 rounded outline-none border border-zinc-700 w-28 cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={downloadBulkReport}
                                    disabled={exportLoading}
                                    className="h-10 px-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ml-2"
                                >
                                    {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    <span className="text-[9px] font-black uppercase tracking-widest">
                                        {exportLoading ? "Generating..." : "Export All"}
                                    </span>
                                </button>
                            </div>

                            {/* Summary Badge for Manager */}
                            <div className="hidden lg:flex items-center gap-4 px-4 border-r border-zinc-800">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Team Readiness</span>
                                    <span className="text-[10px] font-black text-emerald-400 italic">
                                        {sprintSummary.filter(s => s.nextWeek.hasPlan).length}/{data.reportees.length} Prepared for Next Week
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3">
                                <Search size={14} className="text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Search Faculty..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-zinc-300 focus:outline-none w-40 sm:w-60"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Reportee Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredFaculties.length === 0 ? (
                        <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-3xl p-20 text-center">
                            <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                                <Users size={32} className="text-zinc-600" />
                            </div>
                            <h3 className="text-lg font-black text-white italic uppercase tracking-widest">No Reportees Found</h3>
                            <p className="text-xs text-zinc-500 font-bold mt-2">There are no faculty members currently assigned to your monitoring session.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredFaculties.map((faculty: any) => (
                                <button
                                    key={faculty.id}
                                    onClick={() => setSelectedFaculty(faculty)}
                                    className="group relative bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 text-left transition-all hover:bg-zinc-800/80 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-lg font-black text-indigo-400 border border-zinc-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all shadow-inner">
                                            {faculty.name?.[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors truncate uppercase italic">{faculty.name}</h3>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 truncate">{faculty.designation || "Faculty"} · {faculty.dept}</p>

                                            {/* Week Status Grid */}
                                            <div className="mt-4 flex flex-col gap-2">
                                                {(() => {
                                                    const s = sprintSummary.find(item => item.facultyId === faculty.id);

                                                    const formatSunToSat = (mondayStr: string) => {
                                                        if (!mondayStr) return "N/A";
                                                        const [y, m, d] = mondayStr.split("-").map(Number);
                                                        const monDate = new Date(y, m - 1, d);

                                                        const sun = new Date(monDate);
                                                        sun.setDate(monDate.getDate() - 1);

                                                        const sat = new Date(monDate);
                                                        sat.setDate(monDate.getDate() + 5);

                                                        const fmt = (dt: Date) => `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`;
                                                        return `(${fmt(sun)}-${fmt(sat)})`;
                                                    };

                                                    return (
                                                        <>
                                                            {/* Current Week Badge */}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em]">Current {s?.currentWeek.startDate && formatSunToSat(s.currentWeek.startDate)}</span>
                                                                <div className={cn(
                                                                    "px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                                                    s?.currentWeek.hasPlan ? (s.currentWeek.isLocked ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20") : "bg-red-500/10 text-red-400 border-red-500/20"
                                                                )}>
                                                                    <Calendar size={10} />
                                                                    {s?.currentWeek.hasPlan ? (s.currentWeek.isLocked ? "Finalized" : "Draft") : "Pending"}
                                                                </div>
                                                            </div>

                                                            {/* Next Week Badge */}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em]">Next {s?.nextWeek.startDate && formatSunToSat(s.nextWeek.startDate)}</span>
                                                                <div className={cn(
                                                                    "px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                                                    s?.nextWeek.hasPlan ? (s.nextWeek.isLocked ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20") : "bg-red-500/10 text-red-400 border-red-500/20"
                                                                )}>
                                                                    <Calendar size={10} />
                                                                    {s?.nextWeek.hasPlan ? (s.nextWeek.isLocked ? "Finalized" : "Draft") : "Pending"}
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            <div className="mt-4 flex items-center justify-between border-t border-zinc-800/50 pt-4">
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950 rounded text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                                                    <Clock size={10} /> ID: {faculty.id}
                                                </div>
                                                <div className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                                    <ChevronRight size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Detail View Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedFaculty(null)}
                                className="p-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80 rounded-2xl transition-all active:scale-95 group shadow-lg"
                            >
                                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight uppercase italic">{selectedFaculty.name}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-black rounded-md border border-indigo-500/10 uppercase tracking-widest">
                                        {selectedFaculty.role}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                        Emp ID: {selectedFaculty.id}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 p-1 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                            <button
                                onClick={() => setActiveTab("PLANS")}
                                className={cn(
                                    "px-6 py-2.5 text-[10px] font-black rounded-xl transition-all tracking-[0.2em] uppercase",
                                    activeTab === "PLANS" ? "bg-indigo-600 text-white shadow-lg" : "text-zinc-500 hover:text-white"
                                )}
                            >
                                Sprint Plan
                            </button>
                            <button
                                onClick={() => setActiveTab("REPORTS")}
                                className={cn(
                                    "px-6 py-2.5 text-[10px] font-black rounded-xl transition-all tracking-[0.2em] uppercase",
                                    activeTab === "REPORTS" ? "bg-emerald-600 text-white shadow-lg" : "text-zinc-500 hover:text-white"
                                )}
                            >
                                Lecture Audit
                            </button>
                        </div>
                    </div>

                    {/* Mirrored Faculty Content */}
                    <div className="pt-2">
                        {activeTab === "PLANS" ? (
                            <FacultySprintPlanView
                                facultyId={selectedFaculty.id}
                                facultyName={selectedFaculty.name}
                            />
                        ) : (
                            <FacultyLecturesView
                                facultyId={selectedFaculty.id}
                                facultyName={selectedFaculty.name}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
