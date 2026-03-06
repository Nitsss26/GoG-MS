"use client";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useState, useEffect } from "react";
import { Trophy, Star, Flag, Award, ChevronLeft, Activity, Users, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
    const [dbData, setDbData] = useState<{
        employees: any[];
        performanceStars: any[];
        attendanceRecords: any[];
        additionalResponsibilities: any[];
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            try {
                const res = await fetch('/api/data/leaderboard');
                const data = await res.json();
                if (data.success) {
                    setDbData(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboardData();
    }, []);

    const stats = useMemo(() => {
        if (!dbData) return [];
        const { employees, performanceStars, attendanceRecords, additionalResponsibilities } = dbData;

        return performanceStars.map(s => {
            const emp = employees.find(e => e.id === s.employeeId);
            if (!emp) return null;

            const myAttendance = attendanceRecords.filter(r => r.employeeId === s.employeeId);

            // Flags analysis
            const flagsList = myAttendance.flatMap(r => {
                return Object.entries(r.flags || {})
                    .filter(([_, value]) => value === true)
                    .map(([key, _]) => key);
            });

            const lateFlags = flagsList.filter(f => f === 'late').length;
            const dressFlags = flagsList.filter(f => f === 'dressCode').length;
            const misconductFlags = flagsList.filter(f => f === 'misconduct').length;
            const performanceFlags = flagsList.filter(f => f === 'performance').length;
            const meetingFlags = flagsList.filter(f => f === 'meetingAbsent').length;

            const totalFlags = flagsList.length;
            const hasRecentFlags = totalFlags > 0;

            const responsibilities = additionalResponsibilities.filter(r => r.employeeId === s.employeeId && r.status === "Approved");

            // --- ADVANCED RANKING ALGORITHM ---
            // 1. Rating & Stars (Max roughly 75 points)
            let points = (s.rating * 15);

            // 2. On-Time Bonus (Max 20 pts, -3 per late)
            const onTimeBonus = Math.max(0, 20 - (lateFlags * 3));
            points += onTimeBonus;

            // 3. Dress Code Bonus (Max 15 pts, -3 per violation)
            const dressBonus = Math.max(0, 15 - (dressFlags * 3));
            points += dressBonus;

            // 4. Clean Record Bonus (0 flags in last 2 months = +25 pts)
            if (!hasRecentFlags) points += 25;

            // 5. Rating Consistency (Rating > 4.2 = +10 pts)
            if (s.rating > 4.2) points += 10;

            // 6. Additional Responsibilities (+8 per approved responsibility)
            points += (responsibilities.length * 8);

            // 7. Penalties for misconduct/performance (-15 each)
            points -= (misconductFlags * 15);
            points -= (performanceFlags * 15);
            points -= (meetingFlags * 15);

            return {
                ...s,
                emp,
                flagsList: [...new Set(flagsList)], // Unique flag types for display
                actualFlags: flagsList, // All flags for counting
                flagsCount: totalFlags,
                responsibilities,
                totalPoints: points
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    }, [dbData]);

    const foundersRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "Founders")
            .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
    }, [stats]);

    const omRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "OM")
            .sort((a, b) => a.emp.name.localeCompare(b.emp.name))
            .slice(0, 16);
    }, [stats]);

    const facultyRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "PROFESSOR" || s.emp?.role === "FACULTY")
            .sort((a, b) => a.emp.name.localeCompare(b.emp.name))
            .slice(0, 24);
    }, [stats]);

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 lg:p-10 space-y-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Link href="/" className="flex items-center gap-2 text-primary hover:gap-3 transition-all text-xs font-bold">
                        <ChevronLeft size={16} /> <span className="uppercase tracking-widest font-black">Back to Dashboard</span>
                    </Link>
                    <div className="space-y-1">
                        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                            LEADER<span className="text-primary italic">BOARD</span>
                        </h1>
                        <p className="text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase">Institutional Performance Rankings &middot; March 2026</p>
                    </div>
                </div>

                <div className="hidden md:flex gap-4">
                    <div className="px-6 py-4 rounded-3xl bg-[#111] border border-white/[0.05] flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em]">Institutional Hub</p>
                            <p className="text-xl font-black text-white">{dbData?.employees?.length || 0} <span className="text-[10px] text-primary">ACTIVE</span></p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Rankings Section */}
            <div className="max-w-7xl mx-auto space-y-20 pb-20">

                {/* FOUNDERS SECTION */}
                {foundersRankings.length > 0 && (
                    <section className="space-y-10">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Shield className="text-primary" size={20} />
                                </div>
                                <h2 className="text-xl font-black text-white tracking-widest uppercase">Founders</h2>
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {foundersRankings.map((s, i) => (
                                <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="FOUNDER" />
                            ))}
                        </div>
                    </section>
                )}

                {/* OMs SECTION */}
                <section className="space-y-10">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                <Trophy className="text-yellow-500" size={20} />
                            </div>
                            <h2 className="text-xl font-black text-white tracking-widest uppercase">Operation Managers</h2>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {omRankings.map((s, i) => (
                            <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="OM" />
                        ))}
                    </div>
                </section>

                {/* PROFESSORS SECTION */}
                <section className="space-y-10">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Award className="text-emerald-500" size={20} />
                            </div>
                            <h2 className="text-xl font-black text-white tracking-widest uppercase">Professors</h2>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {facultyRankings.map((s, i) => (
                            <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="FACULTY" />
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}

function LeaderboardBox({ data, rank, type }: { data: any; rank: number; type: "OM" | "FACULTY" | "FOUNDER" }) {
    const medal = rank === 1 && type !== "FOUNDER" ? "🥇" : rank === 2 && type !== "FOUNDER" ? "🥈" : rank === 3 && type !== "FOUNDER" ? "🥉" : null;
    const isTop3 = rank <= 3 && type !== "FOUNDER";

    // Map flag types to requested emojis
    const getFlagIcon = (type: string) => {
        switch (type) {
            case 'late': case 'earlyOut': case 'locationDiff': return "🟡";
            case 'misconduct': return "🔴";
            case 'dressCode': return "🟠";
            case 'meetingAbsent': return "⚫";
            case 'performance': return "🔵";
            default: return "🚩";
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: rank * 0.05 }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            className={cn(
                "group relative w-full aspect-[4/5] rounded-[2rem] border transition-all duration-500 flex flex-col items-center p-6 overflow-visible",
                isTop3 || type === "FOUNDER"
                    ? type === "OM"
                        ? "bg-gradient-to-b from-yellow-500/10 to-transparent border-yellow-500/30 shadow-[0_0_40px_-15px_rgba(234,179,8,0.2)]"
                        : type === "FOUNDER"
                            ? "bg-gradient-to-b from-primary/10 to-transparent border-primary/30 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)]"
                            : "bg-gradient-to-b from-emerald-500/10 to-transparent border-emerald-500/30 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)]"
                    : "bg-[#111] border-white/[0.05] hover:border-primary/30"
            )}
        >
            {/* Rank Badge */}
            <div className={cn(
                "absolute -top-3 -left-3 w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black z-30 shadow-2xl rotate-[-10deg] group-hover:rotate-0 transition-transform",
                type === "FOUNDER" ? "bg-primary text-primary-foreground" :
                    rank === 1 ? "bg-yellow-500 text-black" :
                        rank === 2 ? "bg-zinc-300 text-black" :
                            rank === 3 ? "bg-amber-600 text-white" :
                                "bg-zinc-800 border border-white/10 text-zinc-400"
            )}>
                {type === "FOUNDER" ? "👑" : `#${rank}`}
            </div>

            {/* Medal for Top Performer */}
            {medal && (
                <div className="absolute -top-4 -right-4 text-3xl z-30 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] group-hover:scale-125 transition-transform duration-300">
                    {medal}
                </div>
            )}

            {/* Avatar Section - Square with stacked flags behind */}
            <div className="relative mt-2 mb-6">
                {/* Flags Stacking Behind Avatar */}
                <div className="absolute inset-0 -top-2 -left-2 flex flex-wrap gap-1 items-start justify-start z-0 opacity-40 group-hover:opacity-100 transition-opacity">
                    {data.actualFlags.slice(0, 5).map((f: string, idx: number) => (
                        <span key={idx} className="text-xl filter drop-shadow-md transform hover:scale-125 transition-transform" title={f}>
                            {getFlagIcon(f)}
                        </span>
                    ))}
                </div>

                <div className={cn(
                    "w-24 h-24 rounded-3xl border-4 overflow-hidden shadow-2xl transition-all duration-500 transform group-hover:scale-105 relative z-10 bg-[#222]",
                    rank === 1 ? "border-yellow-500" : rank === 2 ? "border-zinc-300" : rank === 3 ? "border-amber-600" : "border-white/5"
                )}>
                    {data.emp?.photoUrl ? (
                        <img src={data.emp.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-zinc-700">
                            {data.emp?.name[0]}
                        </div>
                    )}
                </div>
            </div>

            {/* Identity Info */}
            <div className="text-center w-full min-w-0 flex-1 flex flex-col justify-center gap-1">
                <h3 className="text-sm font-black text-white truncate px-2 leading-tight group-hover:text-primary transition-colors">
                    {data.emp?.name}
                </h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.15em] truncate px-4">
                    {data.emp?.role === "FOUNDER" ? "Founder" : data.emp?.role === "OM" ? "Operation Manager" : data.emp?.role === "PROFESSOR" ? "Professor" : data.emp?.dept}
                </p>
            </div>

            {/* Performance Stats */}
            <div className="w-full space-y-3 mt-6">
                <div className="flex items-center justify-between bg-black/40 rounded-2xl px-3 py-2 border border-white/5 group-hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-1.5 font-black">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-xs text-white">{data.rating}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Activity size={12} className="text-blue-400" />
                        <span className="text-[10px] font-black text-zinc-300">#{data.totalPoints.toFixed(0)} PTS</span>
                    </div>
                </div>

                {/* Responsibilities count */}
                {data.responsibilities.length > 0 && (
                    <div className="text-[8px] font-black text-primary/70 uppercase tracking-widest text-center animate-pulse">
                        +{data.responsibilities.length} Responsibilities
                    </div>
                )}
            </div>
        </motion.div>
    );
}
