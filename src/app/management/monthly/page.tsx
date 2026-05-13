"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useMemo } from "react";
import {
    Star, Users, Save, CheckCircle2, AlertCircle, ChevronRight,
    TrendingUp, Calendar, Info, Plus, X
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MonthlyReportPage() {
    const { user, employees, getReportees, addMonthlyRating } = useAuth();
    const [selectedId, setSelectedId] = useState<string>("");
    const [score, setScore] = useState<number>(4.0);
    const [bonusPoints, setBonusPoints] = useState<number>(0);
    const [screenshotUrl, setScreenshotUrl] = useState<string>("");
    const [comment, setComment] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [period, setPeriod] = useState<string>(() => {
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'long' });
        return `${month} ${now.getFullYear()}`;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const myReportees = useMemo(() => {
        if (!user) return [];
        const reports = getReportees(user.id) || [];
        return reports.filter(e => e.status === "Active");
    }, [user, employees, getReportees]);

    const projectedPoints = useMemo(() => {
        let p = 0;
        if (score > 4.2) p = score * 10;
        else if (score >= 2.0 && score <= 3.5) p = (score - 5) * 10;
        else if (score < 2.0) p = (score - 5) * 20;
        else p = 0;
        return Math.round(p) + bonusPoints;
    }, [score, bonusPoints]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "GOG-MS"); // Standard preset for GOG

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/dtkim5oeu/image/upload`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.secure_url) {
                setScreenshotUrl(data.secure_url);
            }
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Failed to upload screenshot. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedId) {
            setMessage({ type: 'error', text: "Please select an employee first." });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        try {
            // Screenshot is now optional
            await addMonthlyRating(selectedId, score, period, screenshotUrl || "", projectedPoints, comment);
            setMessage({ type: 'success', text: "Performance data recorded. Total points: " + projectedPoints });
            // Reset
            setScore(4.0);
            setBonusPoints(0);
            setSelectedId("");
            setScreenshotUrl("");
            setComment("");
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
                    <TrendingUp className="text-primary" /> Management Hub: Monthly Productivity
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-zinc-800/50">
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                    Productivity Score
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range" min="1.0" max="5.0" step="0.1" value={score}
                                        onChange={(e) => setScore(parseFloat(e.target.value))}
                                        className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className={cn(
                                        "w-12 h-10 flex items-center justify-center text-lg font-black border rounded-xl transition-all shadow-inner",
                                        score > 4.2 ? "text-emerald-400 bg-emerald-400/5 border-emerald-500/20 shadow-emerald-500/5" :
                                        score <= 3.5 ? "text-red-400 bg-red-400/5 border-red-500/20 shadow-red-500/5" :
                                        "text-primary bg-primary/5 border-primary/20 shadow-primary/5"
                                    )}>
                                        {score.toFixed(1)}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} size={14} className={i <= Math.floor(score) ? "text-amber-400 fill-amber-400" : "text-zinc-800"} />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                    Bonus Points <span className="text-[10px] font-normal text-zinc-600">(Manual)</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        value={bonusPoints}
                                        onChange={(e) => setBonusPoints(parseInt(e.target.value) || 0)}
                                        className="w-full bg-zinc-800/30 border border-zinc-800 rounded-xl px-4 py-2 text-sm font-bold text-white focus:outline-none focus:border-primary/50 transition-all"
                                        placeholder="+0"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-zinc-500 group-focus-within:text-primary transition-colors">Bonus</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                    Final Points <span className="text-[10px] font-normal text-zinc-600">(Leaderboard)</span>
                                </label>
                                <div className={cn(
                                    "w-full bg-zinc-800/50 border rounded-xl px-4 py-2.5 text-sm font-black flex items-center justify-between transition-all",
                                    projectedPoints > 0 ? "border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]" :
                                    projectedPoints < 0 ? "border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)]" :
                                    "border-zinc-700/50 text-zinc-500"
                                )}>
                                    <span>{projectedPoints >= 0 ? "+" : ""}{projectedPoints}</span>
                                    <span className="text-[9px] uppercase tracking-widest opacity-60">Impact</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                            <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                Proof of 1:1 Meeting <span className="text-[10px] font-normal text-zinc-500">(Optional)</span>
                            </label>
                            <div className={cn(
                                "relative group overflow-hidden rounded-2xl border-2 border-dashed transition-all",
                                screenshotUrl ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
                            )}>
                                {screenshotUrl ? (
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-10 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden">
                                                <img src={screenshotUrl} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Meeting Proof Uploaded</p>
                                                <p className="text-[8px] text-zinc-500 truncate max-w-[200px]">{screenshotUrl}</p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setScreenshotUrl("")}
                                            className="p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center py-8 cursor-pointer group-hover:bg-zinc-800/20">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 group-hover:scale-110 transition-transform">
                                            {isUploading ? "..." : <Plus size={24} />}
                                        </div>
                                        <div className="mt-4 text-center">
                                            <p className="text-xs font-black text-white uppercase tracking-widest">{isUploading ? "Uploading Proof..." : "Click to Upload Screenshot"}</p>
                                            <p className="text-[9px] text-zinc-600 mt-1 uppercase font-bold tracking-widest">Verify session with a screenshot</p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                            <label className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                                Remarks / Feedback <span className="text-[10px] font-normal text-zinc-500">(Optional)</span>
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                className="w-full bg-zinc-800/30 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 transition-all resize-none"
                                placeholder="Add context for this performance assessment..."
                            />
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
                            disabled={isSubmitting || !selectedId || isUploading}
                            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? "Processing..." : isUploading ? "Uploading Screenshot..." : <><Save size={18} /> Submit Performance Record</>}
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
