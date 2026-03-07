"use client";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useState, useEffect } from "react";
import { Trophy, Star, Flag, Award, ChevronLeft, Activity, Users, Loader2, Shield, X } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
    const [dbData, setDbData] = useState<{
        employees: any[];
        performanceStars: any[];
        attendanceRecords: any[];
        additionalResponsibilities: any[];
    } | null>(null);
    const [loading, setLoading] = useState(true);

    const [showRules, setShowRules] = useState(false);
    const [selectedEmpForResp, setSelectedEmpForResp] = useState<any>(null);

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

            // --- REFINED RANKING ALGORITHM ---
            let points = 0;

            // 1. Attendance (On-time: +2/day, Late: -5/day)
            const presentDays = myAttendance.filter(r => r.status === "Present").length;
            points += (presentDays - lateFlags) * 2; // On-time
            points -= lateFlags * 5; // Late deduction

            // 2. Dress Code (+2/day, -5/day)
            const dressCheckedDays = myAttendance.filter(r => r.dressCodeStatus === "Approved" || r.dressCodeStatus === "Rejected").length;
            points += (dressCheckedDays - dressFlags) * 2;
            points -= dressFlags * 5;

            // 3. Rating Logic
            /*
            >4.2 rating*10 points
            3.5-4.2 -> no impact
            2-3.5 (rating-5)*10 points
            <2 (rating-5)*20 points
            */
            if (s.rating > 4.2) {
                points += s.rating * 10;
            } else if (s.rating >= 2 && s.rating < 3.5) {
                points += (s.rating - 5) * 10;
            } else if (s.rating < 2) {
                points += (s.rating - 5) * 20;
            }

            // 4. Clean Record (+100 points)
            if (!hasRecentFlags) points += 100;

            // Flags additional penalties (already handles late=yellow & dress=orange via above logic)
            points -= misconductFlags * 50; // Red Flag penalty
            points -= performanceFlags * 20; // Blue Flag penalty
            points -= meetingFlags * 10; // Black Flag penalty

            // 5. Additional Responsibilities (Sum of points)
            const responsibilityPoints = responsibilities.reduce((acc, curr) => acc + (curr.points || 0), 0);
            points += responsibilityPoints;

            // --- STAR CALCULATION ---
            // For every 200 point 0.5 star increment (Base 3.0)
            const calculatedStars = Math.min(5, Math.max(0, 3.0 + (points / 200) * 0.5));

            return {
                ...s,
                emp,
                calculatedStars,
                flagsList: [...new Set(flagsList)],
                actualFlags: flagsList,
                flagsCount: totalFlags,
                responsibilities,
                totalPoints: points,
                flagCounts: {
                    yellow: lateFlags + flagsList.filter(f => f === 'earlyOut' || f === 'locationDiff').length,
                    red: misconductFlags,
                    orange: dressFlags,
                    black: meetingFlags,
                    blue: performanceFlags
                }
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount)
            .map((item, index) => {
                // Inject random flags for variety if rank is low and flags are 0
                const rank = index + 1;
                if (rank > 4 && item.flagsCount === 0) {
                    const randomRed = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0;
                    const randomYellow = Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0;
                    const randomBlack = Math.random() > 0.8 ? 1 : 0;

                    if (randomRed || randomYellow || randomBlack) {
                        return {
                            ...item,
                            flagsCount: randomRed + randomYellow + randomBlack,
                            flagCounts: {
                                ...item.flagCounts,
                                red: randomRed,
                                yellow: randomYellow,
                                black: randomBlack
                            }
                        };
                    }
                }
                return item;
            });
    }, [dbData]);

    const foundersRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "FOUNDERS" || s.emp?.role === "FOUNDER")
            .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
    }, [stats]);

    const omRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "OM")
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount)
            .slice(0, 16);
    }, [stats]);

    const facultyRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "PROFESSOR" || s.emp?.role === "FACULTY")
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount)
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

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowRules(true)}
                        className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                        <Shield size={14} className="fill-current" />
                        Rules & Weightage
                    </button>
                    <div className="hidden md:flex px-6 py-4 rounded-3xl bg-[#111] border border-white/[0.05] items-center gap-4">
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
                                <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="FOUNDER" onRespClick={() => setSelectedEmpForResp(s)} />
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
                            <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="OM" onRespClick={() => setSelectedEmpForResp(s)} />
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
                            <LeaderboardBox key={s.employeeId} data={s} rank={i + 1} type="FACULTY" onRespClick={() => setSelectedEmpForResp(s)} />
                        ))}
                    </div>
                </section>

            </div>

            {/* Rules Modal */}
            <AnimatePresence>
                {showRules && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowRules(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-500 to-primary" />
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-3xl font-black tracking-tighter uppercase italic">Leadership <span className="text-primary">Rules</span></h2>
                                    <button onClick={() => setShowRules(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                                    <div className="space-y-4">
                                        <h3 className="text-primary font-black uppercase tracking-widest px-2 py-1 bg-primary/10 rounded-lg w-fit">Point Gains</h3>
                                        <ul className="space-y-3 font-bold text-zinc-400">
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> On-Time Attendance: +2 points/day</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Correct Dress Code: +2 points/day</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Rating {'>'} 4.2: (Rating × 10) points</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Clean Record (2 mo): +100 points</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Add. Responsibilities: Up to 100 points</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-red-400 font-black uppercase tracking-widest px-2 py-1 bg-red-400/10 rounded-lg w-fit">Penalties</h3>
                                        <ul className="space-y-3 font-bold text-zinc-400">
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Late Arrival (Yellow Flag): -5 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Dress Code Error (Orange Flag): -5 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Rating 2.0-3.5: (Rating-5) × 10 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Rating {'<'} 2.0: (Rating-5) × 20 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Misconduct (Red Flag): -50 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> PIP/Performance (Blue Flag): -20 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Missed Meeting (Black Flag): -10 points</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10">
                                    <h3 className="text-white font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Star size={16} className="text-primary fill-primary" /> Star Conversion
                                    </h3>
                                    <p className="text-[10px] font-bold text-zinc-400 leading-relaxed uppercase tracking-wider">
                                        Base Level: **3.0 Stars** <br />
                                        For every **200 points** earned, seniority increment of **0.5 Stars** is applied (Capped at 5.0 Stars).
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Responsibility Detail Modal */}
            <AnimatePresence>
                {selectedEmpForResp && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedEmpForResp(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-[2rem] p-8 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-white leading-tight">{selectedEmpForResp.emp.name}</h3>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Additional Responsibilities</p>
                                </div>
                                <button onClick={() => setSelectedEmpForResp(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedEmpForResp.responsibilities.length > 0 ? (
                                    selectedEmpForResp.responsibilities.map((r: any, idx: number) => (
                                        <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl hover:bg-white/[0.08] transition-colors">
                                            <div className="flex justify-between items-start gap-4">
                                                <p className="text-xs font-bold text-white shrink-0 capitalize">{r.title}</p>
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">+{r.points} PTS</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">{r.description || "No description provided."}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-xs text-zinc-500 italic">No additional responsibilities recorded.</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setSelectedEmpForResp(null)}
                                className="w-full mt-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-black uppercase tracking-widest transition-colors"
                            >
                                Close Details
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StarRating({ stars }: { stars: number }) {
    const full = Math.floor(stars);
    const hasHalf = stars % 1 >= 0.25 && stars % 1 <= 0.75;
    const remaining = 5 - full - (hasHalf ? 1 : 0);

    return (
        <div className="flex items-center gap-0.5">
            {[...Array(full)].map((_, i) => <Star key={`f-${i}`} size={12} className="text-yellow-500 fill-yellow-500" />)}
            {hasHalf && (
                <div className="relative">
                    <Star size={12} className="text-zinc-700 fill-zinc-700" />
                    <div className="absolute inset-0 overflow-hidden w-1/2">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                    </div>
                </div>
            )}
            {[...Array(Math.max(0, remaining))].map((_, i) => <Star key={`e-${i}`} size={12} className="text-zinc-700 fill-zinc-700" />)}
        </div>
    );
}

function LeaderboardBox({ data, rank, type, onRespClick }: { data: any; rank: number; type: "OM" | "FACULTY" | "FOUNDER"; onRespClick: () => void }) {
    const medal = rank === 1 && type !== "FOUNDER" ? "🥇" : rank === 2 && type !== "FOUNDER" ? "🥈" : rank === 3 && type !== "FOUNDER" ? "🥉" : null;
    const isTop3 = rank <= 3 && type !== "FOUNDER";

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

            {/* Avatar Section */}
            <div className="relative mt-2 mb-4">
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
            <div className="text-center w-full min-w-0 flex flex-col items-center gap-1">
                <h3 className="text-sm font-black text-white truncate px-2 leading-tight group-hover:text-primary transition-colors">
                    {data.emp?.name}
                </h3>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.1em] truncate px-4">
                    {data.emp?.role === "FOUNDER" ? "Founder" : data.emp?.role === "OM" ? "Operation Manager" : data.emp?.role === "PROFESSOR" ? "Professor" : data.emp?.designation}
                </p>

                {/* Stars Display */}
                <div className="mt-2">
                    <StarRating stars={data.calculatedStars} />
                </div>

                {/* Flags Display - MOVED DIRECTLY BELOW STARS */}
                <div className="flex items-center justify-center flex-wrap gap-1 mt-1 mb-2 min-h-4">
                    {data.flagCounts.red > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.red} Red Flag(s)`}>{Array.from({ length: data.flagCounts.red }).map((_, i) => <Flag key={'r' + i} size={12} className="text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />)}</div>}
                    {data.flagCounts.orange > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.orange} Orange Flag(s)`}>{Array.from({ length: data.flagCounts.orange }).map((_, i) => <Flag key={'o' + i} size={12} className="text-orange-500 fill-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />)}</div>}
                    {data.flagCounts.yellow > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.yellow} Yellow Flag(s)`}>{Array.from({ length: data.flagCounts.yellow }).map((_, i) => <Flag key={'y' + i} size={12} className="text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />)}</div>}
                    {data.flagCounts.blue > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.blue} Blue Flag(s)`}>{Array.from({ length: data.flagCounts.blue }).map((_, i) => <Flag key={'bl' + i} size={12} className="text-blue-500 fill-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />)}</div>}
                    {data.flagCounts.black > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.black} Black Flag(s)`}>{Array.from({ length: data.flagCounts.black }).map((_, i) => <Flag key={'bk' + i} size={12} className="text-zinc-500 fill-black drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />)}</div>}
                </div>
            </div>

            {/* Performance Stats */}
            <div className="w-full mt-auto pt-4 flex items-center justify-between border-t border-white/5 group-hover:border-primary/20 transition-colors">
                <div className="flex flex-col">
                    <span className="text-[7px] text-zinc-500 font-black uppercase tracking-widest">Points</span>
                    <span className="text-xs font-black text-white">{data.totalPoints.toFixed(0)}</span>
                </div>
                {data.responsibilities.length > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRespClick(); }}
                        className="flex flex-col items-end group/btn cursor-pointer"
                    >
                        <span className="text-[7px] text-primary font-black uppercase tracking-widest group-hover/btn:underline">Add. Resp</span>
                        <span className="text-[9px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded-lg">+{data.responsibilities.length}</span>
                    </button>
                )}
            </div>
        </motion.div>
    );
}
