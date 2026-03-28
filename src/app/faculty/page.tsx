"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    CalendarDays, BookOpen, Clock, Play, AlertTriangle, CheckCircle2,
    ArrowRight, Plus, FileText, Timer, Users, Mic
} from "lucide-react";

interface TodayLecture {
    lectureNumber: number;
    courseName: string;
    topicsCovered: string;
    timeStart: string;
    timeStop: string;
    scheduledDuration: number;
    status: string;
    classStartTime?: string;
    classEndTime?: string;
    actualDurationMinutes?: number;
    warnings?: string[];
    stream?: string;
}

export default function FacultyDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [lectures, setLectures] = useState<TodayLecture[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ completed: 0, inProgress: 0, scheduled: 0, warnings: 0 });

    useEffect(() => {
        if (!user || !["FACULTY", "PROFESSOR"].includes(user.role)) return;
        fetchTodaysLectures();
    }, [user]);

    const fetchTodaysLectures = async () => {
        try {
            const res = await fetch(`/api/faculty/lectures?facultyId=${user?.id}`);
            const data = await res.json();
            if (data.lectures) {
                setLectures(data.lectures);
                const completed = data.lectures.filter((l: any) => l.status === "Completed").length;
                const inProgress = data.lectures.filter((l: any) => l.status === "In Progress").length;
                const scheduled = data.lectures.filter((l: any) => l.status === "Scheduled").length;
                const warnings = data.lectures.filter((l: any) => l.warnings?.length > 0).length;
                setStats({ completed, inProgress, scheduled, warnings });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!user || !["FACULTY", "PROFESSOR"].includes(user.role)) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <AlertTriangle className="mx-auto mb-4 text-yellow-400" size={48} />
                    <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
                    <p className="text-zinc-400">This portal is only available for Faculty and Professors.</p>
                </div>
            </div>
        );
    }

    const now = new Date();
    const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istTime = new Date(istStr);
    const todayStr = istTime.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    return (
        <div className="max-w-7xl mx-auto pt-10 pb-10 px-4 sm:px-6 space-y-8">
            {/* Header */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-8 sm:p-10 shadow-2xl group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 rounded-[2.6rem] blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                            <BookOpen size={32} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500 tracking-tight">
                                Faculty Dashboard
                            </h1>
                            <p className="text-sm text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">{todayStr}</p>
                        </div>
                    </div>
                    <div className="flex flex-col md:items-end">
                        <p className="text-zinc-400 text-sm font-medium">Identity Confirmed</p>
                        <p className="text-xl font-black text-white tracking-tight italic">
                            Prof. <span className="text-indigo-400">{user.name.split(' ')[0]}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Scheduled Slots", value: stats.scheduled, icon: CalendarDays, color: "text-indigo-400", bg: "bg-indigo-500/5 border-indigo-500/10" },
                    { label: "Active Sessions", value: stats.inProgress, icon: Play, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/10" },
                    { label: "Reports Filed", value: stats.completed, icon: CheckCircle2, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/10" },
                    { label: "Compliance Alerts", value: stats.warnings, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/5 border-red-500/10" },
                ].map((stat) => (
                    <div key={stat.label} className={`rounded-[1.5rem] border p-5 transition-all hover:scale-[1.02] cursor-default shadow-lg ${stat.bg}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className={`p-2 rounded-lg bg-zinc-900/50`}>
                                <stat.icon size={18} className={stat.color} />
                            </div>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <p className={`text-3xl font-black ${stat.color} tabular-nums`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => router.push("/faculty/sprint-plan")}
                    className="group relative overflow-hidden rounded-[2rem] bg-zinc-900/40 border border-zinc-800/80 p-7 text-left hover:border-indigo-500/50 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CalendarDays size={80} className="text-indigo-400" />
                    </div>
                    <CalendarDays size={28} className="text-indigo-400 mb-4" />
                    <h3 className="text-white text-lg font-black tracking-tight mb-1">Sprint Plan</h3>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">Map out your weekly teaching objective and schedules.</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        Configure <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </button>

                <button onClick={() => router.push("/faculty/lectures")}
                    className="group relative overflow-hidden rounded-[2rem] bg-zinc-900/40 border border-zinc-800/80 p-7 text-left hover:border-emerald-500/50 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Timer size={80} className="text-emerald-400" />
                    </div>
                    <Timer size={28} className="text-emerald-400 mb-4" />
                    <h3 className="text-white text-lg font-black tracking-tight mb-1">My Lectures</h3>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">Monitor sessions and update attendance records.</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        Execute <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </button>

                <button onClick={() => router.push("/faculty/lecture-report")}
                    className="group relative overflow-hidden rounded-[2rem] bg-zinc-900/40 border border-zinc-800/80 p-7 text-left hover:border-amber-500/50 transition-all shadow-xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <FileText size={80} className="text-amber-400" />
                    </div>
                    <FileText size={28} className="text-amber-400 mb-4" />
                    <h3 className="text-white text-lg font-black tracking-tight mb-1">Lecture Ledger</h3>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">Review historical session data and audit trails.</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-amber-400 uppercase tracking-widest">
                        Audit Logs <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </button>
            </div>

            {/* Today's Schedule */}
            <div>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-400" />
                    Today&apos;s Schedule
                </h2>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : lectures.length === 0 ? (
                    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-8 text-center">
                        <CalendarDays size={32} className="mx-auto mb-3 text-zinc-600" />
                        <p className="text-zinc-400 text-sm">No lectures scheduled for today.</p>
                        <p className="text-zinc-500 text-xs mt-1">Upload a sprint plan to see your schedule here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {lectures.map((lec, i) => (
                            <div key={i} className={`rounded-xl border p-4 transition-all ${
                                lec.status === "In Progress" ? "bg-emerald-500/5 border-emerald-500/30" :
                                lec.status === "Completed" ? "bg-zinc-900/30 border-zinc-700/50" :
                                "bg-zinc-900/50 border-zinc-800"
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                            lec.status === "In Progress" ? "bg-emerald-500/20 text-emerald-400" :
                                            lec.status === "Completed" ? "bg-green-500/20 text-green-400" :
                                            "bg-zinc-700 text-zinc-300"
                                        }`}>
                                            L{lec.lectureNumber}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">{lec.courseName}</h3>
                                            <p className="text-xs text-zinc-400">{lec.topicsCovered}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-zinc-300 font-mono">{lec.timeStart} – {lec.timeStop}</p>
                                        <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            lec.status === "In Progress" ? "bg-emerald-500/20 text-emerald-400" :
                                            lec.status === "Completed" ? "bg-green-500/20 text-green-400" :
                                            "bg-zinc-700 text-zinc-300"
                                        }`}>{lec.status}</span>
                                    </div>
                                </div>
                                {lec.warnings && lec.warnings.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1.5 text-amber-400">
                                        <AlertTriangle size={12} />
                                        <span className="text-[10px]">{lec.warnings[0]}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
