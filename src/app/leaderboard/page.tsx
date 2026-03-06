"use client";
import { useAuth } from "@/context/AuthContext";
import { useMemo } from "react";
import { Trophy, Star, Flag, Award, ChevronLeft, Activity, Users } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
    const { employees, performanceStars, attendanceRecords, additionalResponsibilities } = useAuth();

    const stats = useMemo(() => {
        return performanceStars.map(s => {
            const emp = employees.find(e => e.id === s.employeeId);
            if (!emp) return null;

            const flagsList = attendanceRecords
                .filter(r => r.employeeId === s.employeeId)
                .flatMap(r => {
                    return Object.entries(r.flags)
                        .filter(([_, value]) => value === true)
                        .map(([key, _]) => key);
                });

            const responsibilities = additionalResponsibilities.filter(r => r.employeeId === s.employeeId && r.status === "Approved");

            return {
                ...s,
                emp,
                flagsList,
                flagsCount: flagsList.length,
                responsibilities,
                totalPoints: (s.rating * 10) + (responsibilities.length * 5) - (flagsList.length * 2)
            };
        }).filter(Boolean);
    }, [employees, performanceStars, attendanceRecords, additionalResponsibilities]);

    const omRankings = stats
        .filter(s => s.emp?.role === "OM")
        .sort((a, b) => b.totalPoints - a.totalPoints);

    const facultyRankings = stats
        .filter(s => (s.emp?.role === "FACULTY" || s.emp?.role === "PROFESSOR") && !["AD", "HOI", "TL", "HR", "FOUNDER"].includes(s.emp?.role || ""))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white p-6 md:p-10 space-y-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Link href="/" className="flex items-center gap-2 text-primary hover:gap-3 transition-all text-sm font-bold">
                        <ChevronLeft size={16} /> <span className="uppercase tracking-widest">Back to Dashboard</span>
                    </Link>
                    <div className="space-y-1">
                        <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-white via-zinc-400 to-zinc-800 bg-clip-text text-transparent tracking-tighter leading-none text-white">
                            LEADER<span className="text-primary">BOARD</span>
                        </h1>
                        <p className="text-zinc-500 text-sm font-medium tracking-wide uppercase">Recognizing excellence across the institution &middot; March 2026 Edition</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="px-6 py-4 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 shadow-2xl backdrop-blur-3xl flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Scale</p>
                            <p className="text-2xl font-black text-white">{employees.length} <span className="text-xs text-zinc-600">Active</span></p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Rankings Section */}
            <div className="max-w-7xl mx-auto space-y-24">

                {/* OMs SECTION */}
                <section className="space-y-10">
                    <div className="flex items-center gap-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                <Trophy className="text-yellow-500" size={24} />
                            </div>
                            OPERATIONS MANAGERS
                        </h2>
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 to-transparent" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5 items-stretch">
                        {omRankings.map((s, i) => (
                            <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="OM" />
                        ))}
                    </div>
                </section>

                {/* FACULTY SECTION */}
                <section className="space-y-10">
                    <div className="flex items-center gap-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Award className="text-emerald-500" size={24} />
                            </div>
                            ACADEMIC FACULTY
                        </h2>
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 to-transparent" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5 items-stretch">
                        {facultyRankings.map((s, i) => (
                            <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="FACULTY" />
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}

function LeaderboardBox({ data, rank, type }: { data: any; rank: number; type: "OM" | "FACULTY" }) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
    const isTop3 = rank <= 3;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.05 }}
            whileHover={{ y: -8 }}
            className={cn(
                "group relative aspect-square rounded-[2rem] border transition-all duration-300 flex flex-col items-center justify-between p-5 overflow-visible",
                isTop3
                    ? type === "OM"
                        ? "bg-yellow-500/5 border-yellow-500/30 shadow-[0_20px_40px_-15px_rgba(234,179,8,0.1)]"
                        : "bg-emerald-500/5 border-emerald-500/30 shadow-[0_20px_40px_-15px_rgba(16,185,129,0.1)]"
                    : "bg-zinc-900/40 border-zinc-800 shadow-xl hover:border-zinc-700/50"
            )}
        >
            {/* Rank Indicator */}
            <div className={cn(
                "absolute -top-3 -left-3 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shadow-2xl z-30 transition-transform group-hover:scale-110",
                rank === 1 ? "bg-yellow-500 text-black shadow-yellow-500/20" :
                    rank === 2 ? "bg-zinc-400 text-black shadow-zinc-400/20" :
                        rank === 3 ? "bg-amber-700 text-white shadow-amber-700/20" :
                            "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
            )}>
                #{rank}
            </div>

            {/* Medal Sticker */}
            {medal && (
                <div className="absolute -top-4 -right-4 text-3xl z-30 drop-shadow-2xl transition-transform group-hover:rotate-12 group-hover:scale-125 duration-500">
                    {medal}
                </div>
            )}

            {/* Avatar Container */}
            <div className="relative mt-2">
                <div className={cn(
                    "w-24 h-24 rounded-3xl border-[6px] overflow-hidden shadow-2xl transition-all duration-500 group-hover:rounded-[2rem]",
                    rank === 1 ? "border-yellow-500" : rank === 2 ? "border-zinc-400" : rank === 3 ? "border-amber-700" : "border-zinc-800 group-hover:border-zinc-600"
                )}>
                    {data.emp?.photoUrl ? (
                        <img src={data.emp.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                            <span className="text-3xl font-black text-zinc-500">{data.emp?.name[0]}</span>
                        </div>
                    )}
                </div>

                {/* Flag Stacking Logic */}
                {data.flagsList.length > 0 && (
                    <div className="absolute -bottom-2 -right-2 flex items-center z-40">
                        {data.flagsList.slice(0, 3).map((f: any, idx: number) => (
                            <div
                                key={idx}
                                className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 shadow-xl flex items-center justify-center -ml-4 first:ml-0 transition-transform hover:z-50 hover:scale-110"
                                style={{ transform: `translateX(${idx * 2}px) translateZ(0)` }}
                            >
                                <Flag size={14} className="text-red-500" />
                            </div>
                        ))}
                        {data.flagsList.length > 3 && (
                            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center -ml-4 text-[10px] font-bold text-zinc-400">
                                +{data.flagsList.length - 3}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="text-center w-full space-y-1 mb-2">
                <h3 className="text-sm font-black text-white group-hover:text-primary transition-colors truncate px-2" title={data.emp?.name}>
                    {data.emp?.name}
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{data.emp?.dept}</p>
            </div>

            {/* Stats Bar */}
            <div className="w-full flex items-center justify-between gap-2 px-2 pb-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 shadow-inner group-hover:border-primary/20 transition-colors">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-black text-white">{data.rating}</span>
                </div>

                {data.responsibilities.length > 0 && (
                    <div className="flex -space-x-2">
                        {data.responsibilities.slice(0, 3).map((r: any, idx: number) => (
                            <div
                                key={idx}
                                className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center backdrop-blur-sm hover:z-10 hover:border-blue-400 transition-colors"
                                title={r.description}
                            >
                                <Activity size={12} className="text-blue-400" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Interaction Glow */}
            <div className="absolute inset-0 rounded-[2rem] bg-primary/0 group-hover:bg-primary/[0.02] transition-colors pointer-events-none" />
        </motion.div>
    );
}
