"use client";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useState } from "react";
import { Trophy, Star, Flag, Award, ChevronLeft, Users, Shield, X, TrendingUp, Plus, History, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { resolveImageUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { calculatePerformance, LEADERBOARD_START_DATE, getLeaderboardStats } from "@/lib/performance-utils";

export default function LeaderboardPage() {
    const { user, employees, performanceStars, attendanceRecords, additionalResponsibilities, holidays, getReportees } = useAuth();

    const [showRules, setShowRules] = useState(false);
    const [selectedEmpForAudit, setSelectedEmpForAudit] = useState<any>(null);
    const [selectedEmpForResp, setSelectedEmpForResp] = useState<any>(null);
    const [respDescription, setRespDescription] = useState("");
    const [respPoints, setRespPoints] = useState<number>(10);
    const [isSubmittingResp, setIsSubmittingResp] = useState(false);
    const { addAdditionalResponsibility } = useAuth();
    const isADorFounder = user?.role === "AD" || user?.role === "FOUNDER";

    const stats = useMemo(() => {
        if (!employees || !performanceStars || !user) return [];
        return getLeaderboardStats(employees, attendanceRecords, additionalResponsibilities, holidays, performanceStars);
    }, [employees, performanceStars, attendanceRecords, additionalResponsibilities, user]);

    const foundersRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role === "FOUNDER")
            .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
    }, [stats]);

    const omRankings = useMemo(() => {
        return stats
            .filter(s => {
                const r = s.emp?.role?.toUpperCase();
                return r === "OM" || r === "MARKETING_TEAM" || r === "TECH_TEAM";
            })
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount)
            .slice(0, 16);
    }, [stats]);

    const facultyRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role?.toUpperCase() === "PROFESSOR" || s.emp?.role?.toUpperCase() === "FACULTY")
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount)
            .slice(0, 24);
    }, [stats]);

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 lg:p-10 space-y-12 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
                <div className="space-y-4">
                    <Link href="/" className="flex items-center gap-2 text-primary hover:gap-3 transition-all text-xs font-bold">
                        <ChevronLeft size={16} /> <span className="uppercase tracking-widest font-black">Back to Dashboard</span>
                    </Link>
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-6xl font-black text-white tracking-tighter leading-none">
                            LEADER<span className="text-primary italic">BOARD</span>
                        </h1>
                        <p className="text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase">Institute Performance Rankings &middot; {new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }).toUpperCase()}</p>
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
                            <p className="text-xl font-black text-white">{employees?.filter(e => e.status === "Active").length || 0} <span className="text-[10px] text-primary">ACTIVE</span></p>
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

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                            {foundersRankings.map((s, i) => (
                                <LeaderboardBox key={s.employeeId || `founder-${i}`} data={s} rank={i + 1} type="FOUNDER" onRespClick={() => setSelectedEmpForResp(s)} onAuditClick={() => setSelectedEmpForAudit(s)} canAdd={isADorFounder} />
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

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                        {omRankings.map((s, i) => (
                            <LeaderboardBox key={s.employeeId || `om-${i}`} data={s} rank={i + 1} type="OM" onRespClick={() => setSelectedEmpForResp(s)} onAuditClick={() => setSelectedEmpForAudit(s)} canAdd={isADorFounder} />
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
                            <h2 className="text-xl font-black text-white tracking-widest uppercase">Professors & Faculty</h2>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                        {facultyRankings.map((s, i) => (
                            <LeaderboardBox key={s.employeeId || `faculty-${i}`} data={s} rank={i + 1} type="FACULTY" onRespClick={() => setSelectedEmpForResp(s)} onAuditClick={() => setSelectedEmpForAudit(s)} canAdd={isADorFounder} />
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
                            className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl overflow-hidden custom-scrollbar max-h-[90vh] overflow-y-auto"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-500 to-primary" />
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-3xl font-black tracking-tighter uppercase italic">Leaderboard <span className="text-primary">Rules</span></h2>
                                    <button onClick={() => setShowRules(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                                    <div className="space-y-4">
                                        <h3 className="text-primary font-black uppercase tracking-widest px-2 py-1 bg-primary/10 rounded-lg w-fit">Point Gains</h3>
                                        <ul className="space-y-3 font-bold text-zinc-400">
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Perfect On-Time Attendance: +2 points/day</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Correct Dress Code: +2 points/day</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Rating {'>'} 4.2: (Rating × 10) points</li>
                                            <li className="flex items-start gap-2"><span className="text-emerald-400">✔</span> Add. Responsibilities: Up to 100 points</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-red-400 font-black uppercase tracking-widest px-2 py-1 bg-red-400/10 rounded-lg w-fit">Penalties</h3>
                                        <ul className="space-y-3 font-bold text-zinc-400">
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Late Arrival (Yellow Flag): -5 points</li>
                                            <li className="flex items-start gap-2"><span className="text-red-400">✘</span> Early Clock-out: -5 points</li>
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
                                        Base Level: <strong className="text-primary italic">3.0 Stars</strong> <br />
                                        For every <strong className="text-primary italic">200 points</strong> earned, seniority increment of <strong className="text-primary italic">0.5 Stars</strong> is applied (Capped at 5.0 Stars).
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
                                                <p className="text-xs font-bold text-white shrink-0 capitalize">{r.description || r.title}</p>
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">+{r.points} PTS</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-[10px] text-zinc-500 italic font-bold uppercase tracking-widest">No responsibility history</p>
                                    </div>
                                )}
                            </div>

                            {isADorFounder && (
                                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Plus size={14} className="text-primary" />
                                        </div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Assign New Responsibility</h4>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Task Description</label>
                                            <textarea 
                                                value={respDescription}
                                                onChange={(e) => setRespDescription(e.target.value)}
                                                placeholder="e.g., Conducted extra workshop for students..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-all resize-none h-20"
                                            />
                                        </div>
                                        
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Points (Max 100)</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={respPoints}
                                                onChange={(e) => setRespPoints(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/40 transition-all"
                                            />
                                        </div>

                                        <button
                                            disabled={isSubmittingResp || !respDescription.trim()}
                                            onClick={async () => {
                                                setIsSubmittingResp(true);
                                                try {
                                                    await addAdditionalResponsibility(selectedEmpForResp.emp.id, respDescription, respPoints);
                                                    setRespDescription("");
                                                    setRespPoints(10);
                                                    // Note: Ideally refresh or update local state, but AuthContext handles notification
                                                    alert("Responsibility assigned successfully and sent for approval.");
                                                    setSelectedEmpForResp(null);
                                                } finally {
                                                    setIsSubmittingResp(false);
                                                }
                                            }}
                                            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                                        >
                                            {isSubmittingResp ? "Assigning..." : "Assign & Submit Request"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedEmpForResp(null)}
                                className="w-full mt-4 py-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-xs font-black uppercase tracking-widest transition-colors text-zinc-400"
                            >
                                Close View
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Point History Audit Modal */}
            <AnimatePresence>
                {selectedEmpForAudit && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedEmpForAudit(null)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            {/* Decorative Header */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-blue-500 to-primary" />
                            
                            {/* User Profile Header */}
                            <div className="p-8 pb-4 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                                        <img src={resolveImageUrl(selectedEmpForAudit.emp.photoUrl || selectedEmpForAudit.emp.passport_size_photo)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight">{selectedEmpForAudit.emp.name}</h3>
                                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">{selectedEmpForAudit.emp.role} &middot; {selectedEmpForAudit.emp.location}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedEmpForAudit(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Summary Stats */}
                            <div className="px-8 py-6 bg-white/[0.02] grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Current Points</p>
                                    <p className="text-3xl font-black text-primary italic leading-none">{selectedEmpForAudit.totalPoints.toFixed(0)}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-zinc-800/20 border border-white/5">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Current Stars</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xl font-black text-white italic leading-none">{selectedEmpForAudit.calculatedStars.toFixed(1)}</p>
                                        <StarRating stars={selectedEmpForAudit.calculatedStars} />
                                    </div>
                                </div>
                            </div>

                            {/* Audit Timeline */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <History size={16} className="text-primary" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Point History Ledger</h4>
                                </div>

                                {selectedEmpForAudit.auditTrail.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedEmpForAudit.auditTrail.map((entry: any, idx: number) => (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                key={idx} 
                                                className="group relative pl-6 border-l border-white/5 hover:border-primary/20 transition-all py-1"
                                            >
                                                {/* Timeline Dot */}
                                                <div className={cn(
                                                    "absolute left-[-4.5px] top-3 w-2 h-2 rounded-full border border-black",
                                                    entry.points > 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                                )} />
                                                
                                                <div className="flex items-center justify-between gap-4 bg-white/[0.03] border border-white/5 p-4 rounded-2xl group-hover:bg-white/[0.05] transition-colors">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={10} className="text-zinc-600" />
                                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                                                {new Date(entry.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-bold text-white leading-tight">{entry.reason}</p>
                                                        <span className={cn(
                                                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                                            entry.type === 'Penalty' ? "text-red-400 bg-red-400/10" : 
                                                            entry.type === 'Holiday' ? "text-blue-400 bg-blue-400/10" :
                                                            "text-emerald-400 bg-emerald-400/10"
                                                        )}>
                                                            {entry.type}
                                                        </span>
                                                    </div>
                                                    <div className={cn(
                                                        "text-lg font-black italic",
                                                        entry.points > 0 ? "text-emerald-400" : "text-red-400"
                                                    )}>
                                                        {entry.points > 0 ? `+${entry.points}` : entry.points}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                        <AlertCircle size={40} className="mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No history recorded yet</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-6 border-t border-white/5 bg-[#050505]">
                                <button onClick={() => setSelectedEmpForAudit(null)} className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-[10px] font-black uppercase tracking-widest transition-all text-white">
                                    Close Performance Ledger
                                </button>
                            </div>
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

function LeaderboardBox({ data, rank, type, onRespClick, onAuditClick, canAdd }: { data: any; rank: number; type: "OM" | "FACULTY" | "FOUNDER" | "HOI"; onRespClick: () => void; onAuditClick: () => void; canAdd: boolean }) {
    const medal = rank === 1 && type !== "FOUNDER" ? "🥇" : rank === 2 && type !== "FOUNDER" ? "🥈" : rank === 3 && type !== "FOUNDER" ? "🥉" : null;
    const isTop3 = (rank <= 3) && type !== "FOUNDER";

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: rank * 0.05 }}
            onClick={onAuditClick}
            className={cn(
                "group relative w-full h-auto min-h-[14rem] rounded-[1.8rem] md:rounded-[2.2rem] border transition-all duration-500 flex flex-col items-center p-4 sm:p-5 overflow-visible cursor-pointer",
                isTop3 || type === "FOUNDER"
                    ? "bg-gradient-to-b from-primary/10 to-transparent border-primary/30 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)]"
                    : "bg-[#111] border-white/[0.05] hover:border-primary/30"
            )}
        >
            {/* Rank Badge */}
            <div className={cn(
                "absolute -top-1.5 -left-1.5 sm:-top-3 sm:-left-3 w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl flex items-center justify-center text-[7px] sm:text-xs font-black z-30 shadow-2xl rotate-[-10deg] group-hover:rotate-0 transition-transform",
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
                <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 text-lg sm:text-3xl z-30 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] group-hover:scale-125 transition-transform duration-300">
                    {medal}
                </div>
            )}

            {/* Avatar Section */}
            <div className="relative mt-0.5 mb-2 sm:mb-3">
                <div className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl border-2 md:border-4 overflow-hidden shadow-2xl transition-all duration-500 transform group-hover:scale-105 relative z-10 bg-[#222]",
                    rank === 1 ? "border-yellow-500" : rank === 2 ? "border-zinc-300" : rank === 3 ? "border-amber-600" : "border-white/5"
                )}>
                    {data.emp?.photoUrl || data.emp?.passport_size_photo || data.emp?.upload_your_passport_size_photo ? (
                        <img
                            src={resolveImageUrl(data.emp?.photoUrl || data.emp?.passport_size_photo || data.emp?.upload_your_passport_size_photo)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center');
                                const initial = document.createElement('span');
                                initial.innerText = data.emp?.name?.[0] || 'U';
                                initial.className = "text-lg sm:text-xl md:text-2xl font-black text-zinc-700";
                                (e.target as HTMLImageElement).parentElement!.appendChild(initial);
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg sm:text-xl md:text-2xl font-black text-zinc-700">
                            {data.emp?.name?.[0]}
                        </div>
                    )}
                </div>
            </div>

            {/* Identity Info */}
            <div className="text-center w-full min-w-0 flex flex-col items-center gap-0.5 flex-1">
                <h3 className="text-[10px] sm:text-[11px] md:text-sm font-black text-white truncate px-2 leading-tight group-hover:text-primary transition-colors">
                    {data.emp?.name}
                </h3>
                <p className="text-[6px] sm:text-[7px] text-zinc-500 font-bold uppercase tracking-[0.1em] truncate px-4">
                    {data.emp?.role === "FOUNDER" ? "Founder" : 
                     data.emp?.role === "OM" ? "Operation Manager" : 
                     data.emp?.role === "MARKETING_TEAM" ? "Marketing Team" : 
                     data.emp?.role === "TECH_TEAM" ? "Tech Team" : 
                     data.emp?.role === "PROFESSOR" ? "Professor" : 
                     data.emp?.designation}
                </p>

                {/* Stars Display */}
                <div className="mt-1">
                    <StarRating stars={data.calculatedStars} />
                </div>

                {/* Flags Display */}
                <div className="flex items-center justify-center flex-wrap gap-1 mt-1 mb-1.5 min-h-3" style={{ minHeight: "12px" }}>
                    {data.flagCounts.red > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.red} Red Flag(s)`}>{Array.from({ length: data.flagCounts.red }).map((_, i) => <Flag key={'r' + i} size={9} className="text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />)}</div>}
                    {data.flagCounts.orange > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.orange} Orange Flag(s)`}>{Array.from({ length: data.flagCounts.orange }).map((_, i) => <Flag key={'o' + i} size={9} className="text-orange-500 fill-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />)}</div>}
                    {data.flagCounts.yellow > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.yellow} Yellow Flag(s)`}>{Array.from({ length: data.flagCounts.yellow }).map((_, i) => <Flag key={'y' + i} size={9} className="text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />)}</div>}
                    {data.flagCounts.blue > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.blue} Blue Flag(s)`}>{Array.from({ length: data.flagCounts.blue }).map((_, i) => <Flag key={'bl' + i} size={9} className="text-blue-500 fill-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />)}</div>}
                    {data.flagCounts.black > 0 && <div className="flex items-center gap-0.5" title={`${data.flagCounts.black} Black Flag(s)`}>{Array.from({ length: data.flagCounts.black }).map((_, i) => <Flag key={'bk' + i} size={9} className="text-zinc-500 fill-black drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />)}</div>}
                </div>
            </div>

            {/* Performance Stats */}
            <div className="w-full mt-2 pt-2.5 border-t border-white/5 group-hover:border-primary/20 transition-colors flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[6px] sm:text-[7px] text-zinc-500 font-black uppercase tracking-widest truncate">Points</span>
                    <span className="text-[10px] sm:text-xs font-black text-white leading-none">{data.totalPoints.toFixed(0)}</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onRespClick(); }}
                    className="flex flex-col items-end group/btn cursor-pointer overflow-hidden p-1 -m-1 rounded-lg hover:bg-primary/5 transition-colors"
                >
                    <span className="text-[6px] sm:text-[7px] text-primary font-black uppercase tracking-widest group-hover/btn:underline truncate mb-0.5">
                        {canAdd ? "Assign/View" : "View History"}
                    </span>
                    <div className={cn(
                        "px-2 py-0.5 rounded-md shadow-lg transition-all",
                        data.responsibilities.length > 0 
                            ? "bg-primary shadow-primary/20" 
                            : "bg-primary/40 shadow-primary/10 group-hover:bg-primary/60"
                    )}>
                        <span className="text-[9px] font-black text-primary-foreground leading-none">
                            {data.responsibilities.length > 0 ? `+${data.responsibilities.length}` : '0'}
                        </span>
                    </div>
                </button>
            </div>
        </motion.div>
    );
}
