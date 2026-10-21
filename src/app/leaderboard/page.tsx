"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Star, Flag, Award, Users, Shield, X, Plus, History, Calendar, AlertCircle, ArrowLeft, ArrowRight, ChevronRight, ChevronDown, Crown, ShieldCheck, Building2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { resolveImageUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { calculatePerformance, LEADERBOARD_START_DATE, getLeaderboardStats } from "@/lib/performance-utils";

export default function LeaderboardPage() {
    const { 
        user, employees, performanceStars, attendanceRecords, 
        additionalResponsibilities, holidays, getReportees, 
        ratings, addAdditionalResponsibility, colleges
    } = useAuth();

    const [showRules, setShowRules] = useState(false);
    const [selectedEmpForAudit, setSelectedEmpForAudit] = useState<any>(null);
    const [selectedEmpForResp, setSelectedEmpForResp] = useState<any>(null);
    const [respDescription, setRespDescription] = useState("");
    const [respPoints, setRespPoints] = useState<number>(10);
    const [isSubmittingResp, setIsSubmittingResp] = useState(false);
    const isADorFounder = user?.role === "AD" || user?.role === "FOUNDER";
    // AD / Founder can add for anyone; an HOI can add for their own team. Every request goes for approval first.
    const myReporteeIds = useMemo(() => (user?.role === "HOI" ? getReportees(user.id).map(r => r.id) : []), [user, employees]);
    const canAddFor = (emp: any) => isADorFounder || (user?.role === "HOI" && !!emp && myReporteeIds.includes(emp.id));

    // Full responsibility history of the selected person (approved, pending and rejected)
    const [respHistory, setRespHistory] = useState<any[] | null>(null);
    const selectedRespEmpId = selectedEmpForResp?.emp?.id;
    useEffect(() => {
        setRespHistory(null);
        if (!selectedRespEmpId) return;
        let cancelled = false;
        fetch(`/api/responsibilities?employeeId=${encodeURIComponent(selectedRespEmpId)}`)
            .then(res => res.json())
            .then(data => { if (!cancelled && Array.isArray(data)) setRespHistory(data); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [selectedRespEmpId]);

    const stats = useMemo(() => {
        if (!employees || !performanceStars || !user) return [];
        return getLeaderboardStats(employees, attendanceRecords, additionalResponsibilities, holidays, performanceStars, ratings);
    }, [employees, performanceStars, attendanceRecords, additionalResponsibilities, holidays, user, ratings]);

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
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount);
    }, [stats]);

    const facultyRankings = useMemo(() => {
        return stats
            .filter(s => s.emp?.role?.toUpperCase() === "PROFESSOR" || s.emp?.role?.toUpperCase() === "FACULTY")
            .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount);
    }, [stats]);

    // ── Redesign: one scrolling board — all OMs first, then all Professors & Faculty — every rank as a card; Founders on their own tab ──
    const [board, setBoard] = useState<"TEAM" | "FOUNDER">("TEAM");
    const [institute, setInstitute] = useState("All");
    const instituteName = (loc?: string) => {
        if (!loc) return "—";
        const c = (colleges || []).find((x: any) => [x.id, x.name, x.shortName].includes(loc));
        return c ? (c.name || c.shortName) : loc;
    };
    const instituteKey = (loc?: string) => {
        const c = loc ? (colleges || []).find((x: any) => [x.id, x.name, x.shortName].includes(loc)) : null;
        return c ? c.id : (loc || "");
    };
    const instituteOptions = useMemo(() => {
        const keys = new Map<string, string>();
        [...omRankings, ...facultyRankings].forEach(s => { const k = instituteKey(s.emp?.location); if (k) keys.set(k, instituteName(s.emp?.location)); });
        return Array.from(keys.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [omRankings, facultyRankings, colleges]);
    const byInstitute = (rows: any[]) => rows.filter(s => institute === "All" || instituteKey(s.emp?.location) === institute);
    const monthLabel = new Date().toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    const sections = board === "TEAM"
        ? [
            { key: "OM", title: "Operation Managers", desc: "Top performing Operation Managers across institutes based on assigned weightage and performance metrics.", icon: Users, rows: byInstitute(omRankings), founder: false },
            { key: "FACULTY", title: "Professors & Faculty", desc: "Top performing Professors and Faculty across institutes based on assigned weightage and performance metrics.", icon: GraduationCap, rows: byInstitute(facultyRankings), founder: false },
        ]
        : [{ key: "FOUNDER", title: "Founders", desc: "Founders of the institute.", icon: Shield, rows: foundersRankings, founder: true }];
    const tabs = [
        { key: "TEAM" as const, label: "Operation Managers & Professors", count: omRankings.length + facultyRankings.length },
        ...(foundersRankings.length ? [{ key: "FOUNDER" as const, label: "Founders", count: foundersRankings.length }] : []),
    ];

    return (
        <div className="min-h-screen bg-[#04100c] text-white animate-in fade-in duration-500" data-testid="leaderboard">
            {/* ── Hero ── */}
            <header className="relative overflow-hidden border-b border-emerald-500/10">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_55%_0%,rgba(16,185,129,0.24),transparent_60%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_80%_at_95%_10%,rgba(16,185,129,0.10),transparent_70%)]" />
                    <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none" viewBox="0 0 1200 240" aria-hidden>
                        <path d="M0 190 C 250 120, 420 230, 640 150 S 1000 60, 1200 120" fill="none" stroke="url(#lbw)" strokeWidth="1.5" />
                        <path d="M0 215 C 300 150, 460 250, 700 170 S 1020 90, 1200 150" fill="none" stroke="url(#lbw)" strokeWidth="1" />
                        <defs><linearGradient id="lbw" x1="0" x2="1"><stop offset="0" stopColor="#10b981" stopOpacity="0" /><stop offset=".5" stopColor="#34d399" stopOpacity=".9" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
                    </svg>
                </div>
                <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 flex flex-wrap xl:flex-nowrap items-center gap-x-6 gap-y-5">
                    <div className="min-w-0 shrink-0">
                        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:gap-3 transition-all text-sm font-semibold">
                            <ArrowLeft size={18} /> Back to Dashboard
                        </Link>
                        <h1 className="mt-6 font-black tracking-tighter leading-none whitespace-nowrap text-[clamp(2.5rem,4.6vw,3.75rem)]">
                            <span className="text-white">LEADER</span><span className="relative inline-block italic pr-1 bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                                <Crown aria-hidden className="absolute -top-[0.55em] left-[0.1em] w-[0.5em] h-[0.5em] text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]" />
                                BOARD
                            </span>
                        </h1>
                        <p className="mt-3 text-sm text-zinc-300 tracking-[0.1em]">Institute Performance Rankings <span className="text-zinc-600 mx-1.5">·</span> {monthLabel}</p>
                    </div>

                    <div className="hidden min-[1400px]:flex flex-1 min-w-0 justify-center px-4" aria-hidden>
                        <div className="relative">
                            <div className="absolute inset-0 -m-6 rounded-full bg-emerald-500/20 blur-3xl" />
                            <Trophy size={92} strokeWidth={1.25} className="relative text-emerald-300 fill-emerald-600/30 drop-shadow-[0_0_22px_rgba(16,185,129,0.6)]" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 xl:ml-auto shrink-0">
                        <button onClick={() => setShowRules(true)} data-testid="lb-rules"
                            className="h-14 px-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/30 transition-colors flex items-center gap-3 text-sm font-semibold whitespace-nowrap">
                            <ShieldCheck size={18} className="text-emerald-400" /> Rules &amp; Weightage <ChevronRight size={16} className="text-zinc-500" />
                        </button>
                        <div className="h-14 px-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] flex items-center gap-3 whitespace-nowrap">
                            <div className="w-9 h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Users size={17} /></div>
                            <div className="leading-tight">
                                <p className="text-[11px] text-zinc-400">Institutional Hub</p>
                                <p className="text-lg font-black">{employees?.filter(e => e.status === "Active").length || 0} <span className="text-xs font-semibold text-emerald-400">Active</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Board ── */}
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-20">
                <div className="@container rounded-3xl border border-white/[0.06] bg-[#06120e]/80 p-4 sm:p-6 space-y-10">
                    {/* Toolbar: board switch + filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-1 p-1 rounded-xl border border-white/[0.06] bg-black/20" role="tablist" data-testid="lb-tabs">
                            {tabs.map(t => (
                                <button key={t.key} role="tab" aria-selected={board === t.key} onClick={() => setBoard(t.key)} data-testid={`lb-tab-${t.key}`}
                                    className={cn("h-9 px-3.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                                        board === t.key ? "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]" : "text-zinc-400 hover:text-white")}>
                                    {t.label} <span className={cn("text-[11px] tabular-nums px-1.5 rounded-md", board === t.key ? "bg-emerald-500/20" : "bg-white/5")}>{t.count}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 ml-auto">
                            <div className="h-11 px-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center gap-2.5 text-sm whitespace-nowrap" title="Points are counted from 1 May 2026 up to today">
                                <Calendar size={16} className="text-emerald-400" /> {monthLabel}
                            </div>
                            {board === "TEAM" && (
                                <label className="relative h-11 rounded-xl border border-white/10 bg-white/[0.03] flex items-center gap-2.5 pl-3.5 pr-2 text-sm">
                                    <Building2 size={16} className="text-zinc-400 shrink-0" />
                                    <select value={institute} onChange={e => setInstitute(e.target.value)} data-testid="lb-institute"
                                        className="appearance-none bg-transparent outline-none pr-7 text-white w-[11rem] truncate [color-scheme:dark] cursor-pointer">
                                        <option value="All" className="bg-[#0b1210] text-white">All Institutes</option>
                                        {instituteOptions.map(([k, n]) => <option key={k} value={k} className="bg-[#0b1210] text-white">{n}</option>)}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 pointer-events-none text-zinc-500" />
                                </label>
                            )}
                        </div>
                    </div>

                    {sections.map(sec => (
                        <section key={sec.key} className="space-y-4 scroll-mt-4" data-testid={`lb-section-${sec.key}`}>
                            {/* Section header */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="w-12 h-12 shrink-0 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-400"><sec.icon size={22} /></div>
                                <div className="min-w-0 flex-1 basis-[22rem]">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight whitespace-nowrap" data-testid="lb-title">{sec.title}</h2>
                                        <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-white/5 text-zinc-400">{sec.rows.length}</span>
                                        <div className="hidden sm:block h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
                                    </div>
                                    <p className="text-sm text-zinc-400 mt-0.5">{sec.desc}</p>
                                </div>
                            </div>

                            {sec.rows.length > 0 ? (
                                <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-5 gap-3 @5xl:gap-4 pt-3" data-testid="lb-grid">
                                    {sec.rows.map((s: any, i: number) => (
                                        <PodiumCard key={s.employeeId || i} data={s} rank={i + 1} institute={instituteName(s.emp?.location)}
                                            badgeLabel={sec.founder ? "👑" : undefined} plain={sec.founder}
                                            onHistory={() => setSelectedEmpForAudit(s)} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-10 text-center text-sm text-zinc-500 rounded-2xl border border-dashed border-white/[0.06]" data-testid="lb-empty">
                                    {institute !== "All" && !sec.founder ? "No one from this institute is on this leaderboard yet." : "No rankings to show yet."}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
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
                                {(respHistory || selectedEmpForResp.responsibilities).length > 0 ? (
                                    (respHistory || selectedEmpForResp.responsibilities).map((r: any, idx: number) => (
                                        <div key={r.id || idx} className="bg-white/5 border border-white/5 p-4 rounded-2xl hover:bg-white/[0.08] transition-colors">
                                            <div className="flex justify-between items-start gap-4">
                                                <p className="text-xs font-bold text-white capitalize min-w-0 break-words">{r.description || r.title}</p>
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">+{r.points} PTS</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                                    r.status === "Approved" ? "text-emerald-400 bg-emerald-400/10" :
                                                        r.status === "Rejected" ? "text-red-400 bg-red-400/10" :
                                                            "text-amber-400 bg-amber-400/10"
                                                )}>{r.status === "Pending" ? "Pending AD Approval" : r.status}</span>
                                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{r.date}{r.addedByName ? ` · By ${r.addedByName}` : ""}</span>
                                            </div>
                                            {r.status === "Rejected" && r.rejectionReason && <p className="text-[9px] text-zinc-500 italic mt-1">Reason: {r.rejectionReason}</p>}
                                            {r.status !== "Approved" && <p className="text-[8px] text-zinc-600 italic mt-1">Not counted in points</p>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-[10px] text-zinc-500 italic font-bold uppercase tracking-widest">No responsibility history</p>
                                    </div>
                                )}
                            </div>

                            {canAddFor(selectedEmpForResp.emp) && (
                                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Plus size={14} className="text-primary" />
                                        </div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-widest">{isADorFounder ? "Assign New Responsibility" : "Add Responsibility"}</h4>
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
                                                    const saved = await addAdditionalResponsibility(selectedEmpForResp.emp.id, respDescription, respPoints);
                                                    if (!saved) return;
                                                    setRespDescription("");
                                                    setRespPoints(10);
                                                    // Note: Ideally refresh or update local state, but AuthContext handles notification
                                                    alert(isADorFounder
                                                        ? "Responsibility assigned successfully and sent for approval."
                                                        : "Responsibility submitted. It is pending AD approval and will count in points only after it is approved.");
                                                    setSelectedEmpForResp(null);
                                                } finally {
                                                    setIsSubmittingResp(false);
                                                }
                                            }}
                                            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                                        >
                                            {isSubmittingResp ? "Submitting..." : isADorFounder ? "Assign & Submit Request" : "Submit for AD Approval"}
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
                            
                            <div className="p-6 border-t border-white/5 bg-[#050505] flex flex-col sm:flex-row gap-3">
                                <button onClick={() => { const e = selectedEmpForAudit; setSelectedEmpForAudit(null); setSelectedEmpForResp(e); }} data-testid="lb-open-resp"
                                    className="flex-1 py-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-widest transition-all text-amber-300 inline-flex items-center justify-center gap-2">
                                    <Award size={14} /> {canAddFor(selectedEmpForAudit.emp) ? "Responsibilities (View / Assign)" : "Additional Responsibilities"}
                                </button>
                                <button onClick={() => setSelectedEmpForAudit(null)} className="flex-1 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-[10px] font-black uppercase tracking-widest transition-all text-white">
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

function StarRating({ stars, size = 12 }: { stars: number; size?: number }) {
    const full = Math.floor(stars);
    const hasHalf = stars % 1 >= 0.25 && stars % 1 <= 0.75;
    const remaining = 5 - full - (hasHalf ? 1 : 0);

    return (
        <div className="flex items-center gap-0.5" title={`${stars.toFixed(1)} / 5`}>
            {[...Array(full)].map((_, i) => <Star key={`f-${i}`} size={size} className="text-amber-400 fill-amber-400" />)}
            {hasHalf && (
                <div className="relative">
                    <Star size={size} className="text-zinc-700 fill-zinc-700" />
                    <div className="absolute inset-0 overflow-hidden w-1/2">
                        <Star size={size} className="text-amber-400 fill-amber-400" />
                    </div>
                </div>
            )}
            {[...Array(Math.max(0, remaining))].map((_, i) => <Star key={`e-${i}`} size={size} className="text-zinc-700 fill-zinc-700" />)}
        </div>
    );
}

const roleLabel = (emp: any) =>
    emp?.role === "FOUNDER" ? "Founder" :
        emp?.role === "OM" ? "Operation Manager" :
            emp?.role === "MARKETING_TEAM" ? "Marketing Team" :
                emp?.role === "TECH_TEAM" ? "Tech Team" :
                    emp?.role === "PROFESSOR" ? "Professor" :
                        emp?.designation || "Faculty";

const photoOf = (emp: any) => emp?.photoUrl || emp?.passport_size_photo || emp?.upload_your_passport_size_photo || "";

/** Photo with the initial behind it, so a missing or broken photo still shows a clean avatar */
function Avatar({ emp, className = "" }: { emp: any; className?: string }) {
    const [broken, setBroken] = useState(false);
    const src = photoOf(emp);
    return (
        <div className={cn("relative shrink-0 overflow-hidden bg-zinc-800 flex items-center justify-center font-black text-zinc-400", className)}>
            <span>{(emp?.name || "?")[0]}</span>
            {src && !broken && <img src={resolveImageUrl(src)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />}
        </div>
    );
}

/** Every flag in its own colour; with more than 5, each colour once with its count (never overflows) */
function FlagRow({ data, className = "" }: { data: any; className?: string }) {
    const MAX_FLAGS = 5;
    const fc = data.flagCounts || {};
    const kinds = [
        { key: "red", label: "Red", count: fc.red || 0, cls: "text-red-500 fill-red-500" },
        { key: "orange", label: "Orange", count: fc.orange || 0, cls: "text-orange-500 fill-orange-500" },
        { key: "yellow", label: "Yellow", count: fc.yellow || 0, cls: "text-yellow-500 fill-yellow-500" },
        { key: "blue", label: "Blue", count: fc.blue || 0, cls: "text-blue-500 fill-blue-500" },
        { key: "black", label: "Black", count: fc.black || 0, cls: "text-zinc-500 fill-black" },
    ].filter(k => k.count > 0);
    const total = kinds.reduce((n, k) => n + k.count, 0);
    if (!total) return null;
    const breakdown = kinds.map(k => `${k.count} ${k.label}`).join(", ");
    return (
        <div className={cn("flex items-center flex-nowrap gap-1 overflow-hidden", className)} title={`${total} Flag(s): ${breakdown}`} data-testid="lb-flags">
            {total <= MAX_FLAGS
                ? kinds.flatMap(k => Array.from({ length: k.count }, (_, i) => <Flag key={k.key + i} size={12} data-flag={k.key} className={cn("shrink-0", k.cls)} />))
                : kinds.map(k => (
                    <span key={k.key} className="shrink-0 inline-flex items-center gap-[1px]" title={`${k.count} ${k.label} Flag(s)`}>
                        <Flag size={12} data-flag={k.key} className={cn("shrink-0", k.cls)} />
                        <span className="text-[9px] font-black text-zinc-300 leading-none">{k.count}</span>
                    </span>
                ))}
        </div>
    );
}

/** Small laurel branch (mirrored for the right side) */
function Laurel({ className = "", flip = false }: { className?: string; flip?: boolean }) {
    return (
        <svg viewBox="0 0 24 64" className={cn(className, flip && "-scale-x-100")} fill="currentColor" aria-hidden>
            <path d="M18 62 C 8 50, 6 30, 14 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            {[[13, 52, -35], [10, 42, -30], [9, 32, -20], [10, 22, -10], [12, 13, 0]].map(([x, y, r], i) => (
                <ellipse key={i} cx={x} cy={y} rx="6" ry="2.6" transform={`rotate(${r} ${x} ${y}) translate(-5 0)`} />
            ))}
            {[[15, 47, 35], [13, 37, 30], [13, 27, 25], [14, 18, 15]].map(([x, y, r], i) => (
                <ellipse key={`r${i}`} cx={x} cy={y} rx="5" ry="2.2" transform={`rotate(${r} ${x} ${y}) translate(4 0)`} />
            ))}
        </svg>
    );
}

const PODIUM_STYLE: Record<number, { card: string; ring: string; badge: string; crown?: string; laurel?: string; glow: string }> = {
    1: { card: "border-amber-400/70 bg-gradient-to-b from-amber-500/25 via-amber-900/10 to-[#0a0f0c]", ring: "border-amber-400", badge: "bg-amber-400 text-zinc-950", crown: "text-amber-400 fill-amber-400", laurel: "text-amber-600/80", glow: "shadow-[0_0_45px_-10px_rgba(251,191,36,0.55)]" },
    2: { card: "border-sky-200/50 bg-gradient-to-b from-sky-300/15 via-slate-800/20 to-[#0a0f0c]", ring: "border-slate-200", badge: "bg-slate-200 text-zinc-900", crown: "text-slate-200 fill-slate-200", laurel: "text-slate-400/70", glow: "shadow-[0_0_40px_-12px_rgba(186,230,253,0.4)]" },
    3: { card: "border-orange-500/60 bg-gradient-to-b from-orange-600/25 via-orange-950/10 to-[#0a0f0c]", ring: "border-orange-500", badge: "bg-orange-500 text-white", crown: "text-orange-400 fill-orange-400", laurel: "text-orange-700/80", glow: "shadow-[0_0_40px_-12px_rgba(249,115,22,0.5)]" },
};

function PodiumCard({ data, rank, onHistory, institute, badgeLabel, plain = false }: { data: any; rank: number; onHistory: () => void; institute?: string; badgeLabel?: string; plain?: boolean }) {
    const st = plain ? undefined : PODIUM_STYLE[rank];
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(rank, 10) * 0.04 }}
            className={cn("relative min-w-0 rounded-2xl border px-3 pt-4 pb-3.5 sm:px-4 flex flex-col items-center text-center", st ? cn(st.card, st.glow) : "border-white/[0.08] bg-[#0b1210]")}
            data-testid="lb-podium-card" data-rank={rank}>
            {st?.crown && <Crown aria-hidden className={cn("absolute -top-3.5 left-4 w-7 h-7 drop-shadow-lg", st.crown)} />}
            <span className={cn("absolute top-3 left-3 h-8 min-w-[2.5rem] px-2 rounded-lg flex items-center justify-center text-sm font-black tabular-nums z-10", st ? st.badge : "bg-zinc-800 text-zinc-300 border border-white/10")}>{badgeLabel ?? `#${rank}`}</span>

            <div className="relative mt-6 mb-3 flex items-center justify-center">
                {st?.laurel && <Laurel className={cn("w-5 h-14 -mr-1.5 shrink-0", st.laurel)} />}
                <Avatar emp={data.emp} className={cn("w-20 h-20 xl:w-24 xl:h-24 rounded-2xl border-[3px] text-2xl", st ? st.ring : "border-zinc-700")} />
                {st?.laurel && <Laurel flip className={cn("w-5 h-14 -ml-1.5 shrink-0", st.laurel)} />}
            </div>

            <h3 className="text-[15px] font-bold text-white leading-snug w-full truncate" title={data.emp?.name}>{data.emp?.name}</h3>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 w-full truncate" title={roleLabel(data.emp)}>{roleLabel(data.emp)}</p>
            <div className="mt-2"><StarRating stars={data.calculatedStars} size={16} /></div>
            <div className="mt-2 h-4 flex items-center justify-center"><FlagRow data={data} /></div>
            <p className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 min-w-0" title={institute} data-testid="lb-card-institute">
                <Building2 size={12} className="text-zinc-500 shrink-0" /><span className="truncate">{institute || "—"}</span>
            </p>

            <div className="w-full mt-3 pt-3 border-t border-white/10 flex flex-wrap items-end justify-between gap-2">
                <div className="text-left">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">Points</p>
                    <p className="text-xl font-black tabular-nums leading-none mt-1">{data.totalPoints.toFixed(0)}</p>
                </div>
                <button onClick={onHistory} data-testid="lb-history"
                    className="h-9 px-3 rounded-lg border border-emerald-500/45 bg-emerald-500/[0.07] hover:bg-emerald-500/15 text-emerald-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors">
                    View History <ArrowRight size={13} />
                </button>
            </div>
        </motion.div>
    );
}