"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    GraduationCap, CalendarCheck2, Video, FileText, CheckCircle2,
    AlertCircle, Clock, Users, ArrowUpRight, ShieldCheck, Sparkles,
    BookOpen, Layers, CheckSquare, MessageSquareText
} from "lucide-react";

export default function CurriculumDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalPlans: 0,
        verifiedPlans: 0,
        pendingLectures: 0,
        verifiedLectures: 0,
        pendingAssignments: 0,
        activeTasks: 0,
        todayMoMs: 0
    });
    const [recentLectures, setRecentLectures] = useState<any[]>([]);
    const [pendingPlans, setPendingPlans] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [plansRes, lecturesRes, tasksRes, momRes] = await Promise.all([
                fetch("/api/curriculum/sprint-plan"),
                fetch("/api/curriculum/lectures"),
                fetch("/api/curriculum/tasks"),
                fetch("/api/curriculum/mom")
            ]);

            const plansData = await plansRes.json();
            const lecturesData = await lecturesRes.json();
            const tasksData = await tasksRes.json();
            const momData = await momRes.json();

            const plans = plansData.plans || [];
            const lectures = lecturesData.lectures || [];
            const tasks = tasksData.tasks || [];
            const moms = momData.moms || [];

            const verifiedPlans = plans.filter((p: any) => p.isVerifiedByCL).length;
            const verifiedLectures = lectures.filter((l: any) => l.clVerificationStatus === "VERIFIED").length;
            const pendingLectures = lectures.filter((l: any) => l.clVerificationStatus === "PENDING" || !l.clVerificationStatus).length;
            const pendingAssignments = lectures.filter((l: any) => l.assignment?.hasAssignment && l.assignment?.verificationStatus === "PENDING").length;
            const activeTasks = tasks.filter((t: any) => t.status !== "VERIFIED").length;

            setStats({
                totalPlans: plans.length,
                verifiedPlans,
                pendingLectures,
                verifiedLectures,
                pendingAssignments,
                activeTasks,
                todayMoMs: moms.length
            });

            setRecentLectures(lectures.slice(0, 5));
            setPendingPlans(plans.filter((p: any) => !p.isVerifiedByCL).slice(0, 5));
        } catch (e) {
            console.error("Failed to load curriculum dashboard data", e);
        } finally {
            setLoading(false);
        }
    };

    // CL and CH share one portal; only the designation badge differs
    const designationBadge = user?.role === "CURRICULUM_HEAD" ? "CH" : user?.role === "CURRICULUM_LEAD" ? "CL" : user?.role === "FOUNDER" ? "Founder" : user?.role === "AD" ? "AD" : "";

    return (
        <div className="max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-8">
            {/* Top Hero Banner */}
            <div className="relative group overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-zinc-900/80 to-zinc-950 p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl group-hover:bg-violet-600/20 transition-all duration-700" />
                <div className="absolute -left-16 -bottom-16 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl group-hover:bg-emerald-600/20 transition-all duration-700" />

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 border border-violet-400/30">
                            <GraduationCap size={32} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black tracking-tight text-white" data-testid="clch-portal-title">
                                    CL / CH Portal
                                </h1>
                                {designationBadge && (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-teal-500/15 text-teal-300 border-teal-500/30" data-testid="clch-designation">
                                        {designationBadge}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-zinc-400 mt-1 max-w-xl">
                                Organisation-wide sprint plan approval, class verification, lecture notes review, assignment compliance, task delegation and daily minutes of meeting — every campus, HOI and professor.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/curriculum/sprint-plans"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-lg shadow-violet-600/20 active:scale-95"
                        >
                            <CalendarCheck2 size={15} /> Verify Sprint Plans
                        </Link>
                        <Link
                            href="/curriculum/lectures"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 transition-all active:scale-95"
                        >
                            <Video size={15} /> Review Lectures
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick KPI Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sprint Plans</span>
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <Layers size={16} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white">{stats.verifiedPlans}</span>
                        <span className="text-xs text-zinc-500 font-semibold">/ {stats.totalPlans} locked</span>
                    </div>
                    <div className="mt-2 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full rounded-full transition-all"
                            style={{ width: `${stats.totalPlans > 0 ? (stats.verifiedPlans / stats.totalPlans) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Lectures</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                            <Clock size={16} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-400">{stats.pendingLectures}</span>
                        <span className="text-xs text-zinc-500 font-semibold">need review</span>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500 font-medium">Lectures turn green once notes/assignments approved</p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Assignments</span>
                        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                            <CheckSquare size={16} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-pink-400">{stats.pendingAssignments}</span>
                        <span className="text-xs text-zinc-500 font-semibold">pending check</span>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500 font-medium">OM shares in group once CL verifies</p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Professor Tasks</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <Sparkles size={16} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-400">{stats.activeTasks}</span>
                        <span className="text-xs text-zinc-500 font-semibold">in-progress</span>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500 font-medium">Assigned by Curriculum Lead / Head</p>
                </div>
            </div>

            {/* Portal Action Navigation Grid */}
            <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-violet-400" />
                    Core Academic Operations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link
                        href="/curriculum/sprint-plans"
                        className="group p-6 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-violet-500/40 transition-all duration-300 flex flex-col justify-between"
                    >
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-4 group-hover:scale-110 transition-transform">
                                <CalendarCheck2 size={24} />
                            </div>
                            <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors">
                                Campus Timetable & Sprints
                            </h3>
                            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                                View synchronized timetable sheets matching campus schedules. Verify and lock next week’s plans campus-wise.
                            </p>
                        </div>
                        <div className="mt-5 flex items-center gap-1 text-xs font-bold text-violet-400 group-hover:translate-x-1 transition-transform">
                            Open Timetable Grid <ArrowUpRight size={14} />
                        </div>
                    </Link>

                    <Link
                        href="/curriculum/lectures"
                        className="group p-6 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between"
                    >
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                                <Video size={24} />
                            </div>
                            <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                                Lecture Quality Hub
                            </h3>
                            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                                Review faculty recordings, verify lecture notes & optional assignments, add remarks, and mark Good to Go (Green).
                            </p>
                        </div>
                        <div className="mt-5 flex items-center gap-1 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                            Verify Lectures <ArrowUpRight size={14} />
                        </div>
                    </Link>

                    <Link
                        href="/curriculum/tasks"
                        className="group p-6 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between"
                    >
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                                <BookOpen size={24} />
                            </div>
                            <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                                Faculty Tasks Delegation
                            </h3>
                            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                                Assign tasks to professors (curriculum revamps, assessments, question papers), set deadlines, and track completion.
                            </p>
                        </div>
                        <div className="mt-5 flex items-center gap-1 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                            Manage Tasks <ArrowUpRight size={14} />
                        </div>
                    </Link>

                    <Link
                        href="/curriculum/mom"
                        className="group p-6 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-sky-500/40 transition-all duration-300 flex flex-col justify-between"
                    >
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-110 transition-transform">
                                <MessageSquareText size={24} />
                            </div>
                            <h3 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                                Campus Daily Meeting MoM
                            </h3>
                            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                                Campus-wise daily sync minutes. Faculty, HOI, OM, CL, and CH collaborate and update action items collaboratively.
                            </p>
                        </div>
                        <div className="mt-5 flex items-center gap-1 text-xs font-bold text-sky-400 group-hover:translate-x-1 transition-transform">
                            View Daily MoMs <ArrowUpRight size={14} />
                        </div>
                    </Link>
                </div>
            </div>

            {/* Quick Action Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Sprint Verification */}
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarCheck2 size={18} className="text-indigo-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                Unlocked / Pending Sprint Plans
                            </h3>
                        </div>
                        <Link href="/curriculum/sprint-plans" className="text-xs text-indigo-400 hover:underline">
                            View All
                        </Link>
                    </div>

                    {pendingPlans.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500">
                            All submitted sprint plans are verified & locked!
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pendingPlans.map((p, idx) => (
                                <div key={idx} className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-white">{p.facultyName}</p>
                                        <p className="text-[11px] text-zinc-400">{p.college || "Campus"} &bull; {p.weekStartDate} to {p.weekEndDate}</p>
                                    </div>
                                    <Link
                                        href={`/curriculum/sprint-plans?campus=${encodeURIComponent(p.college || "")}`}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[10px] font-bold border border-indigo-500/20"
                                    >
                                        Inspect
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Lecture Submissions */}
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Video size={18} className="text-emerald-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                Recent Lecture Submissions
                            </h3>
                        </div>
                        <Link href="/curriculum/lectures" className="text-xs text-emerald-400 hover:underline">
                            Open Quality Hub
                        </Link>
                    </div>

                    {recentLectures.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500">
                            No lecture reports logged yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentLectures.map((l, idx) => (
                                <div key={idx} className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-white">{l.facultyName}</p>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                l.clVerificationStatus === "VERIFIED"
                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                            }`}>
                                                {l.clVerificationStatus || "PENDING"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-400">{l.subject} &bull; {l.date} ({l.timeSlot})</p>
                                    </div>
                                    <Link
                                        href="/curriculum/lectures"
                                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold"
                                    >
                                        Review
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}