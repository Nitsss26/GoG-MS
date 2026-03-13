"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useMemo } from "react";
import {
    Star, Users, Save, CheckCircle2, AlertCircle, ChevronRight,
    TrendingUp, Calendar, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function BiWeeklyReportPage() {
    const { user, employees, getReportees, addBiWeeklyRating } = useAuth();
    const [selectedId, setSelectedId] = useState<string>("");
    const [score, setScore] = useState<number>(5);
    const [points, setPoints] = useState<number>(0);
    const [period, setPeriod] = useState<string>(() => {
        const now = new Date();
        const start = now.getDate() <= 15 ? 1 : 16;
        const end = now.getDate() <= 15 ? 15 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const month = now.toLocaleString('default', { month: 'short' });
        return `${start}-${end} ${month} ${now.getFullYear()}`;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const myReportees = useMemo(() => {
        if (!user) return [];
        const reports = getReportees(user.id) || [];
        return reports.filter(e => e.status === "Active");
    }, [user, employees, getReportees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedId) {
            setMessage({ type: 'error', text: "Please select an employee first." });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        try {
            await addBiWeeklyRating(selectedId, score, period, points);
            setMessage({ type: 'success', text: "Performance data recorded and notification sent." });
            // Reset but keep period
            setScore(5);
            setPoints(0);
            setSelectedId("");
        } catch (err) {
            setMessage({ type: 'error', text: "Failed to save record. Please try again." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user || !["FOUNDER", "AD", "HOI", "TL"].includes(user.role)) {
        return <div className="p-8 text-center text-zinc-500">Access Restricted: Only Management can access this page.</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <TrendingUp className="text-primary" /> Management Hub: Bi-Weekly Productivity
                </h1>
                <p className="text-zinc-500 text-sm">Assign productivity scores and bonus points to your direct reportees.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-400">Select Employee</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {myReportees.map(emp => (
                                    <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => setSelectedId(emp.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                            selectedId === emp.id
                                                ? "bg-primary/10 border-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                                                : "bg-zinc-800/30 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold">
                                            {emp.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate">{emp.name}</p>
                                            <p className="text-[10px] opacity-60 truncate">{emp.designation}</p>
                                        </div>
                                        {selectedId === emp.id && <CheckCircle2 size={14} className="text-primary" />}
                                    </button>
                                ))}
                                {myReportees.length === 0 && <p className="text-xs text-zinc-600 italic col-span-2 py-4 text-center">No reportees found for your current role.</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-zinc-800/50">
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                    Productivity Score <span className="text-[10px] font-normal text-zinc-600">(0.0 - 5.0)</span>
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range" min="0" max="5" step="0.5"
                                        value={score} onChange={(e) => setScore(parseFloat(e.target.value))}
                                        className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <span className="w-12 text-center text-lg font-black text-primary bg-primary/10 border border-primary/20 rounded-lg py-1">
                                        {score.toFixed(1)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-1">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} size={14} className={i <= score ? "text-amber-400 fill-amber-400" : "text-zinc-800"} />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                    Bonus Points <span className="text-[10px] font-normal text-zinc-600">(0 - 50)</span>
                                </label>
                                <input
                                    type="number" min="0" max="50"
                                    value={points} onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                                    placeholder="Enter points (e.g. 10)"
                                />
                                <p className="text-[9px] text-zinc-600">These points directly impact the monthly leaderboard rankings.</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                            <label className="block text-sm font-bold text-zinc-400">Reporting Period</label>
                            <div className="flex items-center gap-3 p-3 bg-zinc-800/20 border border-zinc-800 rounded-xl">
                                <Calendar size={16} className="text-zinc-500" />
                                <input
                                    type="text" value={period} onChange={(e) => setPeriod(e.target.value)}
                                    className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                                />
                                <Info size={14} className="text-zinc-700" />
                            </div>
                        </div>

                        <button
                            disabled={isSubmitting || !selectedId}
                            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? "Processing..." : <><Save size={18} /> Submit Performance Record</>}
                        </button>

                        {message && (
                            <div className={cn(
                                "p-4 rounded-xl flex items-center gap-3 border animate-in fade-in slide-in-from-top-2",
                                message.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                            )}>
                                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                <p className="text-xs font-semibold">{message.text}</p>
                            </div>
                        )}
                    </form>
                </div>

                {/* Info Section */}
                <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Info size={16} className="text-blue-400" /> Instructions
                        </h3>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">1</span>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">Select a direct reportee from the list. Only active employees are shown.</p>
                            </div>
                            <div className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">2</span>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">Adjust the productivity score. 3.0 is standard, 5.0 is exceptional.</p>
                            </div>
                            <div className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">3</span>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">Bonus points are optional and awarded for specific achievements in this period.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 space-y-3">
                        <h3 className="text-sm font-bold text-primary">Need Help?</h3>
                        <p className="text-[10px] text-zinc-500">Contact the HR department if a reportee is missing or if you need to correct a submitted record.</p>
                        <button className="text-[10px] font-bold text-primary hover:underline">View Policy Guide →</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
