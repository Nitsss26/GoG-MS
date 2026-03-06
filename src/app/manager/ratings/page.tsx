"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Star, MessageSquare, Plus, Save, Activity, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function RatingsPortal() {
    const { user, getReportees, ratings, employees, addRating } = useAuth();
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [comment, setComment] = useState("");

    // Gatekeeping: Only AD/HOI (or FOUNDER for testing) should access this
    if (!user || !["AD", "HOI", "FOUNDER"].includes(user.role)) return null;

    const reportees = getReportees(user.id).filter(e => ["Faculty", "OM"].includes(e.designation) || e.designation.includes("OM") || e.designation.includes("Faculty"));

    const handleRate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || score === 0) return;

        // Current Bi-weekly Period determination (Naive implementation for UI)
        const d = new Date();
        const periodText = `H${d.getDate() <= 15 ? 1 : 2} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;

        addRating(selectedEmployee, user.id, score, periodText, comment);
        setSelectedEmployee(null);
        setScore(0);
        setComment("");
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Star size={20} className="text-yellow-500 fill-yellow-500" />
                    Bi-Weekly Ratings
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                    Evaluate and score your direct reportees (OMs & Faculties) to influence the global Leaderboard.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Eligible Reportees */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 bg-zinc-800/20">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Network size={14} className="text-primary" /> Eligible Reportees</h3>
                    </div>
                    <div className="divide-y divide-zinc-800/50 max-h-[500px] overflow-y-auto">
                        {reportees.length === 0 ? <div className="p-12 text-center text-xs text-zinc-500 italic">No eligible reportees found under your hierarchy.</div> :
                            reportees.map(r => {
                                const empRatings = ratings.filter(rt => rt.employeeId === r.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                const lastRating = empRatings[0];

                                return (
                                    <div key={r.id} className="p-5 hover:bg-zinc-800/20 transition-colors flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 font-bold text-primary flex items-center justify-center">
                                                {r.name[0]}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">{r.name}</h4>
                                                <p className="text-[10px] text-zinc-500 font-mono">{r.designation}</p>
                                                {lastRating && (
                                                    <p className="text-[9px] text-zinc-400 mt-1 flex items-center gap-1">
                                                        Last rated: <Star size={8} className="text-yellow-500 fill-yellow-500 block" /> {lastRating.score}/5 on {lastRating.date}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedEmployee(r.id)} className="opacity-0 group-hover:opacity-100 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg text-xs font-bold transition-all border border-primary/20">
                                            Rate Now
                                        </button>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Recent Ratings Log */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                    <div className="p-4 border-b border-zinc-800/50 bg-zinc-800/20">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Activity size={14} className="text-green-500" /> Recent Ratings Issued</h3>
                    </div>
                    <div className="divide-y divide-zinc-800/50 p-4 space-y-4">
                        {ratings.filter(rt => rt.ratedBy === user.id).slice(0, 5).map(rt => (
                            <div key={rt.id} className="bg-zinc-800/30 p-3 rounded-lg border border-zinc-700/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-xs font-bold text-white">{rt.employeeName}</p>
                                        <p className="text-[9px] text-zinc-500">{rt.period} · {rt.date}</p>
                                    </div>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={10} className={cn(s <= rt.score ? "text-yellow-500 fill-yellow-500" : "text-zinc-700")} />
                                        ))}
                                    </div>
                                </div>
                                {rt.comment && <p className="text-[10px] text-zinc-300 italic">"{rt.comment}"</p>}
                            </div>
                        ))}
                        {ratings.filter(rt => rt.ratedBy === user.id).length === 0 && <p className="text-xs text-zinc-500 italic text-center py-8">No ratings issued yet.</p>}
                    </div>
                </div>
            </div>

            {/* Rating Modal */}
            <AnimatePresence>
                {selectedEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEmployee(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative z-10 shadow-2xl">

                            <h2 className="text-lg font-bold text-white text-center mb-1">Issue Rating</h2>
                            <p className="text-xs text-zinc-400 text-center mb-6">Rating for {employees.find(e => e.id === selectedEmployee)?.name}</p>

                            <form onSubmit={handleRate} className="space-y-6">
                                {/* Star Selector */}
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <button key={s} type="button" onClick={() => setScore(s)} className="p-2 transition-transform hover:scale-110 active:scale-90">
                                            <Star size={32} className={cn("transition-colors", s <= score ? "text-yellow-500 fill-yellow-500" : "text-zinc-700 hover:text-zinc-600")} />
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare size={12} /> Remarks / Feedback</label>
                                    <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:border-primary/50 outline-none resize-none"
                                        placeholder="Optional context for this rating..." />
                                </div>

                                <button disabled={score === 0} type="submit" className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2">
                                    <Save size={16} /> Submit Rating
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
