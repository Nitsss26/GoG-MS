"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
    Star, Save, CheckCircle2, AlertCircle, ChevronRight, ChevronDown, TrendingUp, Calendar, Info, X, Search,
    Home, BarChart3, Trophy, Award, CloudUpload, MessageSquareText, HelpCircle, FileText, ClipboardList, Loader2, GraduationCap, Briefcase, History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_TONES = ["bg-sky-500/20 text-sky-200", "bg-violet-500/20 text-violet-200", "bg-orange-500/25 text-orange-200", "bg-pink-500/20 text-pink-200", "bg-amber-500/25 text-amber-200", "bg-emerald-500/20 text-emerald-200", "bg-teal-500/20 text-teal-200"];
const toneOf = (id: string) => AVATAR_TONES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const initialsOf = (name: string) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
/** Leaderboard points from the score — same rule the page has always used */
const pointsFor = (score: number) => {
    if (score > 4.2) return Math.round(score * 10);
    if (score >= 2.0 && score <= 3.5) return Math.round((score - 5) * 10);
    if (score < 2.0) return Math.round((score - 5) * 20);
    return 0;
};
const scoreLabel = (s: number) => s > 4.2 ? "Exceptional" : s >= 3.6 ? "Good Performance" : s >= 3.0 ? "Meets Expectations" : s >= 2.0 ? "Needs Improvement" : "Unsatisfactory";
const GUIDELINES = [
    { score: 5.0, text: "Exceptional performance, significantly exceeds expectations", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    { score: 4.0, text: "Strong performance, exceeds expectations", tone: "bg-lime-500/15 text-lime-300 border-lime-500/30" },
    { score: 3.0, text: "Meets expectations (standard)", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
    { score: 2.0, text: "Needs improvement", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    { score: 1.0, text: "Unsatisfactory performance", tone: "bg-red-500/15 text-red-300 border-red-500/30" },
];
/** Last 12 months + next month, e.g. "October 2026" */
const periodOptions = () => {
    const now = new Date();
    return Array.from({ length: 13 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + 1 - i, 1);
        return `${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}`;
    });
};

/** Monthly Feedback audiences — the role decides the tab, the logged-in user's reportee scope decides who is listed */
const AUDIENCES = {
    faculty: { label: "For Faculty", roles: ["FACULTY", "PROFESSOR"], icon: GraduationCap, noun: "faculty member" },
    om: { label: "For OM", roles: ["OM"], icon: Briefcase, noun: "Operation Manager" },
} as const;
type Audience = keyof typeof AUDIENCES;

function Section({ n, title, hint, children, right }: { n: number; title: string; hint?: string; children?: React.ReactNode; right?: React.ReactNode }) {
    return (
        <section className={children ? "space-y-3" : ""}>
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2.5 text-sm font-bold text-white">
                    <span className="w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-black flex items-center justify-center">{n}</span>
                    {title}{hint && <span className="text-[11px] font-normal text-zinc-500">({hint})</span>}
                </h2>
                {right}
            </div>
            {children ?? null}
        </section>
    );
}

export default function MonthlyReportPage() {
    const { user, employees, getReportees, addMonthlyRating, updateMonthlyFeedback } = useAuth();
    // Feedback already given for the selected month: view it, or update it (pre-filled form)
    const [editing, setEditing] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string>("");
    const [score, setScore] = useState<number>(4.0);
    const [bonusPoints, setBonusPoints] = useState<number>(0);
    const [screenshotUrl, setScreenshotUrl] = useState<string>("");
    const [comment, setComment] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [period, setPeriod] = useState<string>(() => {
        const now = new Date();
        const month = now.toLocaleString('en-US', { month: 'long' });
        return `${month} ${now.getFullYear()}`;
    });
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<Audience>("faculty");
    // keep the chosen tab across refreshes (?tab=om)
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get("tab");
        if (t === "om" || t === "faculty") setTab(t);
    }, []);
    const switchTab = (t: Audience) => {
        if (t === tab) return;
        setTab(t);
        setSelectedId("");
        setSearch("");
        setMessage(null);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", t);
        window.history.replaceState(null, "", url.toString());
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => { setEditing(false); setViewOpen(false); }, [selectedId, period]);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const myReportees = useMemo(() => {
        if (!user) return [];
        const reports = getReportees(user.id) || [];
        return reports.filter(e => e.status === "Active" && !(e as any).isRemoved);
    }, [user, employees, getReportees]);
    const audience = AUDIENCES[tab];
    const tabReportees = useMemo(() => myReportees.filter(e => (audience.roles as readonly string[]).includes(e.role)), [myReportees, audience]);
    const tabCount = (t: Audience) => myReportees.filter(e => (AUDIENCES[t].roles as readonly string[]).includes(e.role)).length;

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
            if (editing) {
                // Update the existing feedback of this month (server: scope check, audit, e-mail to employee + own HOI)
                const r = await updateMonthlyFeedback(selectedId, period, score, projectedPoints, comment, screenshotUrl || "");
                if (!r.success) { setMessage({ type: 'error', text: r.msg || "Could not update the feedback." }); return; }
                setMessage({ type: 'success', text: r.unchanged ? "No changes to save." : "Feedback Updated Successfully" });
                if (!r.unchanged) setEditing(false);
                return;
            }
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

    const periods = periodOptions();
    if (!periods.includes(period)) periods.unshift(period);
    const q = search.trim().toLowerCase();
    const listed = q ? tabReportees.filter(e => `${e.name} ${e.id} ${e.designation || ""}`.toLowerCase().includes(q)) : tabReportees;
    const selected = tabReportees.find(e => e.id === selectedId);
    const existing = selected?.monthlyScores?.find((s: any) => s.period === period) as any;
    const givenFor = (emp: any) => !!emp.monthlyScores?.some((s: any) => s.period === period);
    const fmtDt = (v?: string) => { if (!v) return "—"; const d = new Date(v); return isNaN(d.getTime()) ? v : (/T/.test(v) ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : v.split("-").reverse().join("-")); };
    const startUpdate = () => {
        if (!existing) return;
        const sc = Number(existing.score) || 4.0;
        setScore(sc);
        setBonusPoints((Number(existing.points) || 0) - pointsFor(sc));   // points = score points + bonus
        setComment(existing.comment || "");
        setScreenshotUrl(existing.screenshotUrl || "");
        setMessage(null); setViewOpen(false); setEditing(true);
    };
    const basePoints = pointsFor(score);
    const scoreTone = score > 4.2 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : score <= 3.5 ? "text-red-400 border-red-500/40 bg-red-500/10" : "text-sky-300 border-sky-500/40 bg-sky-500/10";
    const card = "rounded-2xl border border-zinc-800 bg-zinc-900/60";
    const periodSelect = (testid: string, cls: string) => (
        <div className={`relative ${cls}`}>
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select value={period} onChange={e => setPeriod(e.target.value)} data-testid={testid}
                className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs font-bold text-white outline-none focus:border-sky-500/50 cursor-pointer">
                {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto pt-5 pb-16 px-4 sm:px-6 space-y-5 w-full [contain:inline-size]">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Link href="/" className="hover:text-white"><Home size={13} /></Link><ChevronRight size={12} />
                <Link href="/manager" className="hover:text-white">Manager Hub</Link><ChevronRight size={12} />
                <span className="text-zinc-300">Monthly Feedback</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <TrendingUp size={30} className="shrink-0 text-emerald-400" />
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight" data-testid="page-title">Monthly Feedback</h1>
                        <p className="text-xs text-zinc-400">Assign productivity scores and bonus points to your faculty and Operation Managers.</p>
                    </div>
                </div>
                {periodSelect("period-top", "w-full sm:w-48 shrink-0")}
            </div>

            {/* Audience tabs */}
            <div role="tablist" aria-label="Feedback for" className="inline-flex w-full sm:w-auto p-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 gap-1" data-testid="audience-tabs">
                {(Object.keys(AUDIENCES) as Audience[]).map(t => {
                    const A = AUDIENCES[t];
                    const on = tab === t;
                    return (
                        <button key={t} type="button" role="tab" aria-selected={on} onClick={() => switchTab(t)} data-testid={`tab-${t}`}
                            className={cn("flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                                on ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30" : "text-zinc-400 hover:text-white hover:bg-zinc-800/70")}>
                            <A.icon size={15} /> {A.label}
                            <span className={cn("min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[10px] tabular-nums", on ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400")}>{tabCount(t)}</span>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className={`${card} p-5 sm:p-6 space-y-6 min-w-0`}>
                    <Section n={1} title="Select Employee"
                        right={
                            <div className="relative w-44 sm:w-56">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." data-testid="emp-search"
                                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50" />
                            </div>
                        }>
                        <p className="-mt-1 text-[11px] text-zinc-500">Choose an active {audience.noun} from your reportees.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[19.6rem] overflow-y-auto pr-1" data-testid="emp-list">
                            {listed.map(emp => {
                                const on = selectedId === emp.id;
                                return (
                                    <button key={emp.id} type="button" onClick={() => setSelectedId(emp.id)} data-testid="emp-card"
                                        className={cn("flex items-center gap-3 p-3 rounded-xl border text-left transition-all min-w-0",
                                            on ? "border-emerald-500/60 bg-emerald-500/[0.07] shadow-[0_0_18px_rgba(16,185,129,0.12)]" : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900")}>
                                        <span className={cn("shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-black", toneOf(emp.id))}>{initialsOf(emp.name)}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className={cn("block text-sm font-bold truncate", on ? "text-emerald-300" : "text-white")}>{emp.name}</span>
                                            <span className="block text-[11px] text-zinc-500 truncate">{emp.designation || "—"} · {emp.id}</span>
                                        </span>
                                        <span data-testid="fb-status" className={cn("shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", givenFor(emp) ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" : "text-zinc-400 bg-zinc-800/60 border-zinc-700")}>{givenFor(emp) ? "Feedback Given" : "Pending"}</span>
                                        {on && <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />}
                                    </button>
                                );
                            })}
                            {tabReportees.length === 0 && <p className="md:col-span-2 py-6 text-center text-xs text-zinc-500" data-testid="emp-empty">{tab === "om" ? "No Operation Managers found in your access." : "No faculty members found in your access."}</p>}
                            {tabReportees.length > 0 && listed.length === 0 && <p className="md:col-span-2 py-6 text-center text-xs text-zinc-500">No employee matches “{search}”.</p>}
                        </div>
                    </Section>

                    {selected && existing && !editing && (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 space-y-3" data-testid="fb-given">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 size={16} /> Feedback Already Given</p>
                                <span className="text-[11px] text-zinc-400">{selected.name} · {period}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div><p className="text-zinc-500">Score</p><p className="text-white font-bold">{Number(existing.score).toFixed(1)} / 5</p></div>
                                <div><p className="text-zinc-500">Points</p><p className={cn("font-bold", existing.points >= 0 ? "text-emerald-400" : "text-red-400")}>{existing.points >= 0 ? "+" : ""}{existing.points}</p></div>
                                <div><p className="text-zinc-500">Feedback Date</p><p className="text-white">{fmtDt(existing.date)}</p></div>
                                <div><p className="text-zinc-500">Given By</p><p className="text-white">{existing.ratedByName || "—"}</p></div>
                            </div>
                            {existing.updatedAt && <p className="text-[10px] text-zinc-400" data-testid="fb-updated">Last updated {fmtDt(existing.updatedAt)} by {existing.updatedByName || "—"}</p>}
                            {viewOpen && (
                                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2 text-[11px]" data-testid="fb-view">
                                    <div><p className="text-zinc-500">Comments</p><p className="text-zinc-200 whitespace-pre-wrap">{existing.comment || "—"}</p></div>
                                    {existing.screenshotUrl && <a href={existing.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline"><FileText size={12} /> Meeting screenshot</a>}
                                    {existing.history?.length ? (
                                        <div><p className="text-zinc-500 mb-1">Update history</p>
                                            {existing.history.slice().reverse().map((h: any, i: number) => (
                                                <p key={i} className="text-zinc-400">{fmtDt(h.at)} · {h.byName} — before: score {Number(h.previous?.score).toFixed(1)}, {h.previous?.points >= 0 ? "+" : ""}{h.previous?.points} pts</p>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setViewOpen(v => !v)} data-testid="fb-view-btn" className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-200 hover:border-zinc-500">{viewOpen ? "Hide Feedback" : "View Feedback"}</button>
                                <button type="button" onClick={startUpdate} data-testid="fb-update-btn" className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white">Update Feedback</button>
                            </div>
                        </div>
                    )}
                    {editing && selected && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-2.5" data-testid="fb-editing">
                            <p className="text-xs text-amber-200">Updating {period} feedback for <b>{selected.name}</b> — the original submission date is kept.</p>
                            <button type="button" onClick={() => setEditing(false)} className="text-[11px] font-bold text-zinc-300 hover:text-white">Cancel</button>
                        </div>
                    )}

                    {(!existing || editing) && (<>
                    <Section n={2} title="Performance Details">
                        <div className="grid grid-cols-1 md:grid-cols-2 min-[1400px]:grid-cols-[1.35fr_1fr_1fr] gap-3">
                            {/* Score */}
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 min-w-0 md:col-span-2 min-[1400px]:col-span-1">
                                <p className="flex items-center gap-2 text-xs font-bold text-white"><span className="shrink-0 w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center"><BarChart3 size={14} /></span> Productivity Score</p>
                                <p className="text-[10px] text-zinc-500 mt-1">Set score between 1.0 – 5.0</p>
                                <div className="flex items-center gap-3 mt-3">
                                    <input type="range" min="1.0" max="5.0" step="0.1" value={score} onChange={e => setScore(parseFloat(e.target.value))} data-testid="score-range"
                                        className="flex-1 min-w-0 h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-zinc-800" />
                                    <span className={cn("shrink-0 w-14 h-10 rounded-xl border flex items-center justify-center text-lg font-black tabular-nums", scoreTone)} data-testid="score-value">{score.toFixed(1)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-3">
                                    <div className="flex gap-1">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} className={i <= Math.floor(score) ? "text-amber-400 fill-amber-400" : "text-zinc-700"} />)}</div>
                                    <span className={cn("text-[11px] font-bold", score > 4.2 || score >= 3.6 ? "text-emerald-400" : score >= 3.0 ? "text-sky-300" : score >= 2.0 ? "text-amber-400" : "text-red-400")}>{scoreLabel(score)}</span>
                                </div>
                            </div>
                            {/* Bonus */}
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 min-w-0 flex flex-col">
                                <p className="flex items-center gap-2 text-xs font-bold text-white"><span className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center"><Trophy size={14} /></span> Bonus Points</p>
                                <p className="text-[10px] text-zinc-500 mt-1 flex-1"><span className="text-zinc-400">Optional.</span> Award bonus points for specific achievements in this period.</p>
                                <div className="relative mt-3">
                                    <input type="number" value={bonusPoints} onChange={e => setBonusPoints(parseInt(e.target.value) || 0)} placeholder="0" data-testid="bonus-input"
                                        className="w-full pl-3 pr-16 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm font-bold text-white outline-none focus:border-amber-500/50 tabular-nums" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-zinc-500">Bonus</span>
                                </div>
                            </div>
                            {/* Final */}
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 min-w-0 flex flex-col">
                                <p className="flex items-center gap-2 text-xs font-bold text-white"><span className="shrink-0 w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 flex items-center justify-center"><Award size={14} /></span> Final Points</p>
                                <p className="text-[10px] text-zinc-500 mt-1 flex-1">Score points {basePoints >= 0 ? "+" : ""}{basePoints} · Bonus {bonusPoints >= 0 ? "+" : ""}{bonusPoints}. Added to the monthly leaderboard.</p>
                                <div className={cn("mt-3 flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-black tabular-nums",
                                    projectedPoints > 0 ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400" : projectedPoints < 0 ? "border-red-500/30 bg-red-500/[0.06] text-red-400" : "border-zinc-800 bg-zinc-950 text-zinc-400")} data-testid="final-points">
                                    <span>{projectedPoints >= 0 ? "+" : ""}{projectedPoints}</span>
                                    <span className="text-[9px] uppercase tracking-widest opacity-70">Impact</span>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section n={3} title="Proof of 1:1 Meeting" hint="Optional">
                        {screenshotUrl ? (
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="shrink-0 w-16 h-10 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={screenshotUrl} alt="Meeting proof" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold text-emerald-400">Meeting proof uploaded</p>
                                        <a href={screenshotUrl} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-zinc-500 truncate hover:underline">{screenshotUrl}</a>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setScreenshotUrl("")} className="shrink-0 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Remove"><X size={15} /></button>
                            </div>
                        ) : (
                            <label className={cn("flex flex-col items-center justify-center gap-1 py-5 rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-950/30 transition-all", isUploading ? "opacity-70" : "cursor-pointer hover:border-sky-500/40 hover:bg-zinc-900/60")}>
                                {isUploading ? <Loader2 size={22} className="text-sky-300 animate-spin" /> : <CloudUpload size={22} className="text-zinc-300" />}
                                <span className="text-xs font-bold text-white">{isUploading ? "Uploading screenshot..." : "Click to upload screenshot"}</span>
                                <span className="text-[10px] text-zinc-500">Verify the session with a screenshot (JPG, PNG)</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                            </label>
                        )}
                    </Section>

                    <Section n={4} title="Remarks / Feedback" hint="Optional">
                        <div className="relative">
                            <MessageSquareText size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
                            <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 500))} rows={3} maxLength={500}
                                placeholder={"Add context for this performance assessment...\n(e.g. key achievements, areas of improvement, etc.)"}
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/50 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50 resize-none" />
                            <span className="absolute right-3 bottom-2.5 text-[10px] text-zinc-600 tabular-nums">{comment.length}/500</span>
                        </div>
                    </Section>

                    <Section n={5} title="Reporting Period" right={periodSelect("period-bottom", "w-48 sm:w-64")}>{null}</Section>

                    <div className="space-y-2">
                    {selected && (
                        <p className="text-[11px] text-zinc-400">Submitting for <span className="font-bold text-white">{selected.name}</span> · {period} · <span className={projectedPoints >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{projectedPoints >= 0 ? "+" : ""}{projectedPoints} points</span></p>
                    )}
                    <button disabled={isSubmitting || !selectedId || isUploading} data-testid="submit-record"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : isUploading ? "Uploading Screenshot..." : <><Save size={16} /> {editing ? "Update Feedback" : "Submit Performance Record"}</>}
                    </button>
                    {!selectedId && <p className="text-center text-[10px] text-zinc-600">Select {tab === "om" ? "an Operation Manager" : "a faculty member"} to submit.</p>}
                    </div>
                    </>)}

                    {message && (
                        <div className={cn("p-3.5 rounded-xl flex items-center gap-3 border", message.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400")} data-testid="form-message">
                            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <p className="text-xs font-semibold">{message.text}</p>
                        </div>
                    )}
                </form>

                {/* ── Side panel ── */}
                <aside className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5">
                    <div className={`${card} p-5`}>
                        <h3 className="flex items-center gap-2.5 text-sm font-bold text-white mb-4"><span className="w-7 h-7 rounded-full bg-sky-500/15 text-sky-300 flex items-center justify-center"><Info size={14} /></span> Instructions</h3>
                        <ol className="space-y-3.5">
                            {[
                                "Choose For Faculty or For OM, then select an employee. Only active employees are shown.",
                                "Adjust the productivity score. 3.0 is standard, 5.0 is exceptional.",
                                "Bonus points are optional and awarded for specific achievements in this period.",
                                "Upload proof of the 1:1 meeting (optional) and add remarks.",
                            ].map((t, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-300 flex items-center justify-center">{i + 1}</span>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed pt-0.5">{t}</p>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
                        <FileText size={64} className="absolute -right-2 -bottom-2 text-emerald-500/10" />
                        <h3 className="flex items-center gap-2.5 text-sm font-bold text-white mb-2"><span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center"><HelpCircle size={14} /></span> Need Help?</h3>
                        <p className="relative text-[11px] text-zinc-400 leading-relaxed">Contact the HR department if a reportee is missing or if you need to correct a submitted record.</p>
                        <Link href="/sop" className="relative mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">View Policy Guide <ChevronRight size={13} /></Link>
                    </div>

                    <div className={`${card} p-5 md:col-span-2 xl:col-span-1`}>
                        <h3 className="flex items-center gap-2.5 text-sm font-bold text-white mb-3"><span className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-300 flex items-center justify-center"><ClipboardList size={14} /></span> Scoring Guidelines</h3>
                        <table className="w-full text-[11px]">
                            <thead><tr className="text-[10px] text-zinc-500"><th className="text-left font-bold pb-2 w-12">Score</th><th className="text-left font-bold pb-2">Description</th><th className="text-right font-bold pb-2">Points</th></tr></thead>
                            <tbody className="divide-y divide-zinc-800/70">
                                {GUIDELINES.map(g => {
                                    const pts = pointsFor(g.score);
                                    return (
                                        <tr key={g.score}>
                                            <td className="py-2"><span className={cn("inline-flex w-9 justify-center py-1 rounded-md border font-black tabular-nums", g.tone)}>{g.score.toFixed(1)}</span></td>
                                            <td className="py-2 pr-2 text-zinc-300">{g.text}</td>
                                            <td className={cn("py-2 text-right font-bold tabular-nums", pts > 0 ? "text-emerald-400" : pts < 0 ? "text-red-400" : "text-zinc-500")}>{pts > 0 ? "+" : ""}{pts}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <p className="mt-3 text-[10px] text-zinc-500 leading-relaxed">Above 4.2 earns points, 3.6 – 4.2 is neutral, 3.5 and below reduces points. Bonus points are added on top.</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}