"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
    GraduationCap, Building2, Users, MapPin, CalendarCheck, Clock, Lock, CheckCircle2, BadgeCheck, Hourglass, ShieldCheck,
    Search, ChevronLeft, ChevronRight, X, Loader2, RefreshCw, CalendarDays, FileText, AlertTriangle, BookOpen, Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_AUTHORITY_ROLES, APPROVAL_STYLE, PLAN_STATUS_STYLE, CLASS_STATUS_LABEL, CLASS_STATUS_STYLE, roleShort } from "@/lib/academic-status";
import SprintPlanWorkflowPanel from "@/components/academic/SprintPlanWorkflowPanel";

/**
 * Academic Directory — organisation-wide academic view shared by the CL / CH Portal and the AD Portal
 * (HOI sees the same page limited to its own scope). All data comes from /api/academic/directory, which
 * enforces the scope on the server; every action reuses the existing sprint plan / class verification APIs.
 */
type Dir = {
    role: string; orgWide: boolean; isAdmin: boolean; week: string; weekEnd: string;
    campuses: { id: string; name: string }[];
    summary: Record<string, number>;
    professors: any[]; hois: any[]; oms: any[]; clch: any[] | null;
};
type Tab = "professors" | "hois" | "oms" | "clch";

const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtDay = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const fmtAt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

const PLAN_FILTERS: { v: string; l: string; test: (p: any) => boolean }[] = [
    { v: "All", l: "Sprint Plan: All", test: () => true },
    { v: "NONE", l: "No plan this week", test: p => !p.plan },
    { v: "DRAFT", l: "Draft", test: p => p.plan?.status === "DRAFT" },
    { v: "PENDING", l: "Pending approval", test: p => ["SUBMITTED", "RESUBMITTED"].includes(p.plan?.status) },
    { v: "UNLOCK", l: "Unlock requested", test: p => p.plan?.status === "UNLOCK_REQUESTED" },
    { v: "APPROVED", l: "Approved / Locked", test: p => ["LOCKED", "LOCKED_AGAIN", "UNLOCK_REQUESTED"].includes(p.plan?.status) },
    { v: "REVISION", l: "Unlocked for revision", test: p => p.plan?.status === "UNLOCKED_FOR_REVISION" },
    { v: "SUBMITTED_ANY", l: "Submitted (any stage)", test: p => p.plan && p.plan.status !== "DRAFT" },
];
const VERIFY_FILTERS: { v: string; l: string; test: (p: any) => boolean }[] = [
    { v: "All", l: "Verification: All", test: () => true },
    { v: "HAS_CLASSES", l: "Has scheduled classes", test: p => p.classes.scheduled > 0 },
    { v: "SUBMITTED", l: "Classes submitted", test: p => p.classes.submitted > 0 },
    { v: "PENDING_OM", l: "Pending OM", test: p => p.classes.pendingOM > 0 },
    { v: "PENDING_FINAL", l: "Pending final verification", test: p => p.classes.pendingFinal > 0 },
    { v: "COMPLETED", l: "Verified (completed)", test: p => p.classes.completed > 0 },
    { v: "REVERTED", l: "Reverted", test: p => p.classes.reverted > 0 },
    { v: "NO_CLASSES", l: "No classes", test: p => p.classes.scheduled === 0 },
];
const VSTATUS_STYLE: Record<string, string> = {
    "Completed": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    "Pending Final": "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    "Pending OM": "bg-blue-500/10 text-blue-300 border-blue-500/30",
    "Reverted": "bg-red-500/10 text-red-300 border-red-500/30",
    "In Progress": "bg-teal-500/10 text-teal-300 border-teal-500/30",
    "Not Started": "bg-zinc-800 text-zinc-400 border-zinc-700",
    "No Classes": "bg-zinc-900 text-zinc-500 border-zinc-800",
};

export function ApprovalBadge({ approval, className = "" }: { approval: any; className?: string }) {
    if (!approval) return null;
    return (
        <span data-testid="approval-badge" title={`${approval.label} by ${approval.byName || ""}${approval.byRole ? ` (${roleShort(approval.byRole)})` : ""}${approval.at ? ` · ${fmtAt(approval.at)}` : ""}`}
            className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide", APPROVAL_STYLE[approval.type] || APPROVAL_STYLE.APPROVED, className)}>
            <ShieldCheck size={10} /> {approval.label}
        </span>
    );
}

export default function AcademicDirectoryPage() {
    const { user } = useAuth();
    const role = user?.role || "";
    const [week, setWeek] = useState<string>("");
    const [data, setData] = useState<Dir | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<Tab>("professors");
    const [q, setQ] = useState("");
    const [campus, setCampus] = useState("All");
    const [hoi, setHoi] = useState("All");
    const [planF, setPlanF] = useState("All");
    const [verF, setVerF] = useState("All");
    const [openProf, setOpenProf] = useState<any | null>(null);
    const [openClch, setOpenClch] = useState<any | null>(null);
    const [toast, setToast] = useState("");

    const load = useCallback(async (w?: string) => {
        setLoading(true); setError("");
        try {
            const r = await fetch(`/api/academic/directory${w ? `?week=${w}` : ""}`, { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load the academic directory.");
            setData(d); if (!w) setWeek(d.week);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { if (user) load(); }, [user, load]);
    useEffect(() => {
        const onFocus = () => { if (week) load(week); };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [week, load]);
    const go = (n: number) => { const w = addDays(week, n * 7); setWeek(w); load(w); };

    const profs = useMemo(() => {
        if (!data) return [];
        const term = q.trim().toLowerCase();
        const pf = PLAN_FILTERS.find(f => f.v === planF)!; const vf = VERIFY_FILTERS.find(f => f.v === verF)!;
        return data.professors.filter(p => (!term || `${p.name} ${p.id}`.toLowerCase().includes(term))
            && (campus === "All" || p.campusId === campus || (campus === "NONE" && !p.campusId))
            && (hoi === "All" || (hoi === "NONE" ? !p.hois.length : p.hois.some((h: any) => h.id === hoi)))
            && pf.test(p) && vf.test(p));
    }, [data, q, campus, hoi, planF, verF]);

    const resetFilters = () => { setQ(""); setCampus("All"); setHoi("All"); setPlanF("All"); setVerF("All"); };
    const openCard = (t: Tab, f: { plan?: string; ver?: string } = {}) => { resetFilters(); setTab(t); if (f.plan) setPlanF(f.plan); if (f.ver) setVerF(f.ver); };

    if (!user) return null;
    if (!PLAN_AUTHORITY_ROLES.includes(role)) {
        return <div className="flex items-center justify-center h-[70vh] text-zinc-400 text-sm">The academic directory is available to HOI, CL, CH, AD and Founder.</div>;
    }

    const isClCh = role === "CURRICULUM_LEAD" || role === "CURRICULUM_HEAD";
    const title = isClCh ? "CL / CH Portal · Academic Directory" : role === "AD" ? "AD Portal · Academic Directory" : "Academic Directory";
    const s = data?.summary || {};
    const cards: { k: string; label: string; icon: any; tone: string; onClick: () => void; show?: boolean }[] = [
        { k: "hois", label: "Total HOIs", icon: Building2, tone: "text-purple-300", onClick: () => openCard("hois") },
        { k: "clch", label: "CL / CH Employees", icon: BookOpen, tone: "text-teal-300", onClick: () => (data?.isAdmin ? openCard("clch") : null), show: true },
        { k: "professors", label: "Total Professors", icon: GraduationCap, tone: "text-rose-300", onClick: () => openCard("professors") },
        { k: "oms", label: "Total OMs", icon: Users, tone: "text-indigo-300", onClick: () => openCard("oms") },
        { k: "campuses", label: "Total Campuses", icon: MapPin, tone: "text-emerald-300", onClick: () => openCard("professors") },
        { k: "sprintPlans", label: "Sprint Plans", icon: CalendarCheck, tone: "text-sky-300", onClick: () => openCard("professors", { plan: "SUBMITTED_ANY" }) },
        { k: "pendingApprovals", label: "Pending Plan Approvals", icon: Hourglass, tone: "text-amber-300", onClick: () => openCard("professors", { plan: "PENDING" }) },
        { k: "lockedPlans", label: "Locked Sprint Plans", icon: Lock, tone: "text-amber-300", onClick: () => openCard("professors", { plan: "APPROVED" }) },
        { k: "scheduledClasses", label: "Scheduled Classes", icon: CalendarDays, tone: "text-sky-300", onClick: () => openCard("professors", { ver: "HAS_CLASSES" }) },
        { k: "completedClasses", label: "Completed Classes", icon: CheckCircle2, tone: "text-emerald-300", onClick: () => openCard("professors", { ver: "SUBMITTED" }) },
        { k: "pendingOM", label: "Pending OM Verifications", icon: Clock, tone: "text-blue-300", onClick: () => openCard("professors", { ver: "PENDING_OM" }) },
        { k: "pendingFinal", label: "Pending Final Verifications", icon: BadgeCheck, tone: "text-indigo-300", onClick: () => openCard("professors", { ver: "PENDING_FINAL" }) },
        { k: "completedVerifications", label: "Completed Verifications", icon: ShieldCheck, tone: "text-emerald-300", onClick: () => openCard("professors", { ver: "COMPLETED" }) },
    ];

    const sel = "bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-primary/50";
    const th = "py-2.5 px-3 text-left text-[9px] font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap";
    const td = "py-2.5 px-3 align-top";

    return (
        <div className="p-4 sm:p-8 space-y-6" data-testid="academic-directory">
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2" data-testid="dir-title">
                        <Network className="text-primary" size={20} /> {title}
                    </h1>
                    <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
                        {data?.orgWide ? "Organisation-wide — every campus, HOI, professor and OM" : "Your campus and the professors appointed under you"} · live from the employee and academic records
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => go(-1)} className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center" title="Previous week"><ChevronLeft size={15} /></button>
                    <span className="text-xs font-bold text-white min-w-[150px] text-center" data-testid="dir-week">{week ? `${fmtDay(week)} – ${fmtDay(addDays(week, 6))}` : "…"}</span>
                    <button onClick={() => go(1)} className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center" title="Next week"><ChevronRight size={15} /></button>
                    <button onClick={() => load(week)} className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center" title="Refresh"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
                </div>
            </header>

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs px-4 py-3 flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}
            {toast && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs px-4 py-3 flex items-center gap-2" data-testid="dir-toast"><CheckCircle2 size={14} /> {toast}</div>}

            {/* Summary cards — each opens the matching filtered records */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2.5" data-testid="dir-cards">
                {cards.filter(c => c.show !== false).map(c => (
                    <button key={c.k} onClick={c.onClick} data-testid={`card-${c.k}`}
                        className="text-left rounded-xl border border-zinc-800/70 bg-zinc-900/70 hover:border-primary/40 hover:bg-zinc-900 p-3 transition-colors">
                        <c.icon size={14} className={c.tone} />
                        <p className="text-lg font-black text-white mt-1.5 leading-none" data-testid={`card-${c.k}-value`}>{data ? s[c.k] ?? 0 : "—"}</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1 leading-tight">{c.label}</p>
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
                {([["professors", `All Professors (${data?.professors.length ?? 0})`], ["hois", `All HOIs (${data?.hois.length ?? 0})`], ["oms", `All OMs (${data?.oms.length ?? 0})`], ...(data?.isAdmin ? [["clch", `CL / CH Management (${data?.clch?.length ?? 0})`]] : [])] as [Tab, string][]).map(([t, l]) => (
                    <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
                        className={cn("px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", tab === t ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}>{l}</button>
                ))}
            </div>

            {loading && !data && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>}

            {data && tab === "professors" && (
                <section className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[12rem]">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search professor name or ID…" data-testid="dir-search"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-primary/50" />
                        </div>
                        <select value={campus} onChange={e => setCampus(e.target.value)} className={sel} data-testid="dir-campus">
                            <option value="All">Campus: All</option><option value="NONE">Not Assigned</option>
                            {data.campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={hoi} onChange={e => setHoi(e.target.value)} className={sel} data-testid="dir-hoi">
                            <option value="All">HOI: All</option><option value="NONE">No HOI</option>
                            {data.hois.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                        <select value={planF} onChange={e => setPlanF(e.target.value)} className={sel} data-testid="dir-plan">
                            {PLAN_FILTERS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                        </select>
                        <select value={verF} onChange={e => setVerF(e.target.value)} className={sel} data-testid="dir-ver">
                            {VERIFY_FILTERS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                        </select>
                        {(q || campus !== "All" || hoi !== "All" || planF !== "All" || verF !== "All") && <button onClick={resetFilters} className="text-[11px] text-zinc-400 hover:text-white px-2">Clear</button>}
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40">
                        <table className="w-full min-w-[1040px] text-xs">
                            <thead className="bg-zinc-950/70"><tr>
                                <th className={th}>Professor</th><th className={th}>Campus</th><th className={th}>Assigned HOI</th><th className={th}>Sprint Plan</th>
                                <th className={th}>Weekly Schedule</th><th className={th}>Class Reports</th><th className={th}>Attendance · Notes</th>
                                <th className={th}>Verification</th><th className={cn(th, "text-right sticky right-0 bg-zinc-950")}>Actions</th>
                            </tr></thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {profs.map(p => (
                                    <tr key={p.id} data-testid="dir-prof-row" data-id={p.id} className="hover:bg-white/[0.02]">
                                        <td className={cn(td, "min-w-[150px]")}><p className="font-bold text-white">{p.name}</p><p className="text-[10px] text-zinc-500 font-mono">{p.id}</p></td>
                                        <td className={cn(td, "text-zinc-300")}>{p.campus}</td>
                                        <td className={cn(td, "text-zinc-300")}>{p.hois.length ? p.hois.map((h: any) => h.name).join(", ") : <span className="text-zinc-600">—</span>}</td>
                                        <td className={td} data-testid="dir-plan-cell">
                                            {p.plan ? (
                                                <div className="space-y-1">
                                                    <span className={cn("inline-block px-2 py-0.5 rounded-md border text-[10px] font-black uppercase", PLAN_STATUS_STYLE[p.plan.status])}>{p.plan.statusLabel}</span>
                                                    {p.plan.approval && <div><ApprovalBadge approval={p.plan.approval} /><p className="text-[10px] text-zinc-500 mt-0.5">by {p.plan.approval.byName}</p></div>}
                                                </div>
                                            ) : <span className="text-zinc-600">No plan</span>}
                                        </td>
                                        <td className={cn(td, "whitespace-nowrap")}>
                                            <p className="text-zinc-300">{p.classes.scheduled} class{p.classes.scheduled === 1 ? "" : "es"}</p>
                                            <Link href={`/academic/weekly-calendar?week=${data.week}`} className="text-[10px] text-primary hover:underline">View timetable</Link>
                                        </td>
                                        <td className={cn(td, "whitespace-nowrap")}><p className="text-zinc-300">{p.classes.submitted}/{p.classes.scheduled} submitted</p><p className="text-[10px] text-zinc-500">{p.classes.completed} verified</p></td>
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>
                                            <p>{p.classes.attendancePct === null ? "—" : `${p.classes.attendancePct}% present`}</p>
                                            <p className="text-[10px] text-zinc-500">{p.classes.notesSubmitted} notes · {p.classes.assignments} assignments</p>
                                            {p.classes.notesMissing ? <p className="text-[10px] text-amber-400">{p.classes.notesMissing} notes missing</p> : null}
                                        </td>
                                        <td className={td}><span className={cn("inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold", VSTATUS_STYLE[p.verificationStatus])} data-testid="dir-ver-status">{p.verificationStatus}</span></td>
                                        <td className={cn(td, "text-right sticky right-0 bg-zinc-950")}>
                                            <button onClick={() => setOpenProf(p)} data-testid="dir-review"
                                                className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold whitespace-nowrap">View / Review</button>
                                        </td>
                                    </tr>
                                ))}
                                {!profs.length && <tr><td colSpan={9} className="py-10 text-center text-zinc-500">No professors match these filters.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-zinc-600">{profs.length} of {data.professors.length} professors · week {fmtDay(data.week)} – {fmtDay(data.weekEnd)}</p>
                </section>
            )}

            {data && tab === "hois" && (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40" data-testid="dir-hois">
                    <table className="w-full min-w-[900px] text-xs">
                        <thead className="bg-zinc-950/70"><tr>
                            <th className={th}>HOI</th><th className={th}>Campus</th><th className={th}>Professors</th><th className={th}>OMs</th><th className={th}>Active Sprint Plans</th>
                            <th className={th}>Pending Approvals</th><th className={th}>Pending Verifications</th><th className={th}>Academic Progress</th><th className={cn(th, "text-right")}>Details</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {data.hois.map(h => (
                                <tr key={h.id} data-testid="dir-hoi-row" data-id={h.id}>
                                    <td className={td}><p className="font-bold text-white">{h.name}</p><p className="text-[10px] text-zinc-500 font-mono">{h.id}</p></td>
                                    <td className={cn(td, "text-zinc-300")}>{h.campus}</td>
                                    <td className={cn(td, "text-zinc-300")} data-testid="dir-hoi-profs">{h.professors}</td>
                                    <td className={cn(td, "text-zinc-300")}>{h.oms}</td>
                                    <td className={cn(td, "text-zinc-300")}>{h.activePlans}</td>
                                    <td className={td}>{h.pendingApprovals ? <span className="text-amber-300 font-bold">{h.pendingApprovals}</span> : <span className="text-zinc-500">0</span>}</td>
                                    <td className={cn(td, "text-zinc-300")}>{h.pendingVerifications}</td>
                                    <td className={td}>{h.progressPct === null ? <span className="text-zinc-600">No classes</span> : (
                                        <div className="flex items-center gap-2"><div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${h.progressPct}%` }} /></div><span className="text-zinc-300">{h.progressPct}%</span></div>
                                    )}</td>
                                    <td className={cn(td, "text-right")}>
                                        <button onClick={() => { resetFilters(); setHoi(h.id); setTab("professors"); }} data-testid="dir-hoi-view"
                                            className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold whitespace-nowrap">View Details</button>
                                    </td>
                                </tr>
                            ))}
                            {!data.hois.length && <tr><td colSpan={9} className="py-10 text-center text-zinc-500">No HOIs found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {data && tab === "oms" && (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40" data-testid="dir-oms">
                    <table className="w-full min-w-[700px] text-xs">
                        <thead className="bg-zinc-950/70"><tr><th className={th}>OM</th><th className={th}>Campus</th><th className={th}>Assigned HOI</th><th className={th}>Pending OM Verifications (this week)</th></tr></thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {data.oms.map(o => (
                                <tr key={o.id} data-testid="dir-om-row" data-id={o.id}>
                                    <td className={td}><p className="font-bold text-white">{o.name}</p><p className="text-[10px] text-zinc-500 font-mono">{o.id}</p></td>
                                    <td className={cn(td, "text-zinc-300")}>{o.campus}</td>
                                    <td className={cn(td, "text-zinc-300")}>{o.hois.map((h: any) => h.name).join(", ") || "—"}</td>
                                    <td className={cn(td, "text-zinc-300")}>{o.pendingOM}</td>
                                </tr>
                            ))}
                            {!data.oms.length && <tr><td colSpan={4} className="py-10 text-center text-zinc-500">No OMs found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {data && tab === "clch" && data.clch && (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40" data-testid="dir-clch">
                    <table className="w-full min-w-[900px] text-xs">
                        <thead className="bg-zinc-950/70"><tr>
                            <th className={th}>Employee</th><th className={th}>Designation</th><th className={th}>Campus</th><th className={th}>Plans Approved</th>
                            <th className={th}>Final Verifications</th><th className={th}>Reverted</th><th className={th}>Pending Records</th><th className={th}>Last Activity</th><th className={cn(th, "text-right")}>History</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {data.clch.map(c => (
                                <tr key={c.id} data-testid="dir-clch-row" data-id={c.id}>
                                    <td className={td}><p className="font-bold text-white">{c.name}</p><p className="text-[10px] text-zinc-500 font-mono">{c.id}</p></td>
                                    <td className={td}><span className="px-2 py-0.5 rounded-md border border-teal-500/30 bg-teal-500/10 text-teal-300 text-[10px] font-black" data-testid="dir-clch-desig">{c.designation}</span></td>
                                    <td className={cn(td, "text-zinc-300")}>{c.campus}</td>
                                    <td className={cn(td, "text-zinc-300")} data-testid="dir-clch-approvals">{c.approvals}</td>
                                    <td className={cn(td, "text-zinc-300")}>{c.verifications}</td>
                                    <td className={cn(td, "text-zinc-300")}>{c.reverts}</td>
                                    <td className={cn(td, "text-zinc-300")}>{c.pending}</td>
                                    <td className={cn(td, "text-zinc-400")}>{c.lastActivity ? fmtAt(c.lastActivity) : "—"}</td>
                                    <td className={cn(td, "text-right")}>
                                        <button onClick={() => setOpenClch(c)} className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold whitespace-nowrap">View Details</button>
                                    </td>
                                </tr>
                            ))}
                            {!data.clch.length && <tr><td colSpan={9} className="py-10 text-center text-zinc-500">No CL / CH employees found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {openProf && data && <ProfessorDrawer prof={openProf} week={data.week} weekEnd={data.weekEnd} onClose={() => setOpenProf(null)}
                onChanged={(msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); load(week); }} />}

            {openClch && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpenClch(null)}>
                    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <div><h3 className="text-sm font-bold text-white">{openClch.name} <span className="text-teal-300">· {openClch.designation}</span></h3><p className="text-[10px] text-zinc-500">{openClch.id} · {openClch.campus}</p></div>
                            <button onClick={() => setOpenClch(null)} className="text-zinc-500 hover:text-white"><X size={17} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-2">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Verification history</p>
                            {openClch.history.map((h: any, i: number) => (
                                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"><p className="text-xs text-white">{h.what}</p><p className="text-[10px] text-zinc-500">{h.kind} · {fmtAt(h.at)}</p></div>
                            ))}
                            {!openClch.history.length && <p className="text-xs text-zinc-500">No approvals or verifications yet.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Professor's week: sprint plan with the existing reviewer actions + class records with the verification link */
function ProfessorDrawer({ prof, week, weekEnd, onClose, onChanged }: { prof: any; week: string; weekEnd: string; onClose: () => void; onChanged: (msg: string) => void }) {
    const [plan, setPlan] = useState<any>(null);
    const [records, setRecords] = useState<any[] | null>(null);
    const [err, setErr] = useState("");
    useEffect(() => {
        let alive = true;
        fetch(`/api/faculty/sprint-plan?facultyId=${encodeURIComponent(prof.id)}&weekStartDate=${week}`).then(r => r.json()).then(d => { if (alive) setPlan((d.plans || [])[0] || null); }).catch(() => alive && setErr("Could not load the sprint plan."));
        fetch(`/api/academic/class-records?facultyId=${encodeURIComponent(prof.id)}&from=${week}&to=${weekEnd}&planned=1`).then(r => r.json()).then(d => { if (alive) setRecords(d.records || d.items || []); }).catch(() => alive && setRecords([]));
        return () => { alive = false; };
    }, [prof.id, week, weekEnd]);

    return (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
            <div className="w-full max-w-3xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="dir-drawer">
                <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-white">{prof.name}</h3>
                        <p className="text-[11px] text-zinc-500">{prof.id} · {prof.designation} · {prof.campus} · HOI: {prof.hois.map((h: any) => h.name).join(", ") || "—"}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-6">
                    {err && <p className="text-xs text-red-300">{err}</p>}
                    <section className="space-y-2">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><CalendarCheck size={12} /> Sprint Plan · {fmtDay(week)} – {fmtDay(weekEnd)}</h4>
                        {plan === null ? <p className="text-xs text-zinc-500">No sprint plan for this week.</p> : (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                                {/* status + "CL/CH / HOI / AD Approved" badge + approver come from the shared panel below */}
                                {plan.approval?.state === "APPROVED" && (plan.approval.byDesignation || plan.approval.remarks) && (
                                    <p className="text-[11px] text-zinc-400" data-testid="drawer-approval">
                                        {plan.approval.byDesignation && <>Approver designation: <b className="text-zinc-200">{plan.approval.byDesignation}</b></>}
                                        {plan.approval.remarks && <>{plan.approval.byDesignation ? " · " : ""}Remarks: <span className="text-zinc-200">{plan.approval.remarks}</span></>}
                                    </p>
                                )}
                                <SprintPlanWorkflowPanel plan={plan} mode="reviewer" onChanged={(p, msg) => { setPlan(p); onChanged(msg); }} />
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                        <thead><tr className="text-[9px] text-zinc-500 uppercase tracking-wider text-left"><th className="py-1.5 pr-3">Day</th><th className="py-1.5 pr-3">Time</th><th className="py-1.5 pr-3">Subject</th><th className="py-1.5 pr-3">Topic</th><th className="py-1.5">Class</th></tr></thead>
                                        <tbody className="divide-y divide-zinc-800/60">
                                            {(plan.entries || []).map((e: any, i: number) => (
                                                <tr key={i}><td className="py-1.5 pr-3 text-zinc-300">{e.day} {e.date ? fmtDay(e.date) : ""}</td><td className="py-1.5 pr-3 text-zinc-300">{e.timeStart}–{e.timeStop}</td><td className="py-1.5 pr-3 text-white">{e.subjectName}</td><td className="py-1.5 pr-3 text-zinc-400">{e.topics}</td><td className="py-1.5 text-zinc-400">{e.className || e.section}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                    <section className="space-y-2">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><FileText size={12} /> Class Reports</h4>
                        {records === null ? <Loader2 className="animate-spin text-primary" size={16} /> : !records.length ? <p className="text-xs text-zinc-500">No classes this week.</p> : (
                            <div className="space-y-2" data-testid="drawer-records">
                                {records.map((r: any) => (
                                    <div key={r._id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                                        <div className="min-w-[10rem] flex-1">
                                            <p className="text-xs text-white font-bold">{r.courseName || r.subjectName || "Class"} <span className="text-zinc-500 font-normal">· {fmtDay(r.date)} {r.timeStart || ""}</span></p>
                                            <p className="text-[10px] text-zinc-500">{r.topicsCovered || ""}</p>
                                        </div>
                                        <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", CLASS_STATUS_STYLE[r.pipelineStatus])}>{CLASS_STATUS_LABEL[r.pipelineStatus] || r.pipelineStatus}</span>
                                        <span className="text-[10px] text-zinc-400">{r.totalStudents ? `${r.numberOfAttendees || 0}/${r.totalStudents} present` : "—"}</span>
                                        <span className="text-[10px] text-zinc-400">{r.notesMissing ? "Notes missing" : r.lectureNotes?.notesUrl || r.lectureNotes?.notesContent ? "Notes ✓" : ""}{r.assignment?.hasAssignment ? " · Assignment ✓" : ""}{r.classPhotoUrl ? " · Photo ✓" : ""}</span>
                                        {!r.virtual && <Link href={`/academic/verification?record=${r._id}`} className="text-[10px] font-bold text-primary hover:underline">Review / Verify</Link>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
