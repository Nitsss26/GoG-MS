"use client";

import { dmy as toDmy, dmyTime as toDmyTime } from "@/lib/date-display";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useMemo, useRef } from "react";
import SprintPlanTimetableGrid from "@/components/academic/SprintPlanTimetableGrid";
import SprintPlanWorkflowPanel, { PlanStatusBadge, PlanHistoryModal, RelockChanges, planReads } from "@/components/academic/SprintPlanWorkflowPanel";
import { PLAN_AUTHORITY_ROLES, getPlanStatus, roleShort } from "@/lib/academic-status";
import {
    CalendarDays, Lock, Unlock, CheckCircle2, AlertTriangle, Eye, X,
    ArrowLeft, ArrowRight, RefreshCw, Filter, Building2, ShieldCheck,
    MessageSquare, Check, Search, Layers, Hourglass, FilePenLine, History, CheckCheck,
    ChevronRight, ChevronDown, Clock, Pencil, FileText, Loader2
} from "lucide-react";
import { useMinWidth } from "@/lib/use-min-width";


function getWeekDates(offset = 0) {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + offset * 7);

    const dates = [];
    const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
    for (let i = 0; i < 6; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.getFullYear() + "-" +
            (d.getMonth() + 1).toString().padStart(2, '0') + "-" +
            d.getDate().toString().padStart(2, '0');
        dates.push({ day: DAYS[i], date: dateStr });
    }

    return {
        start: dates[0].date,
        end: dates[5].date,
        dates
    };
}

// Summary chips and card accents per sprint plan status
const SUMMARY_GROUPS = [
    { label: "Submitted", statuses: ["SUBMITTED", "RESUBMITTED"], chip: "bg-blue-500/10 text-blue-300 border-blue-500/20", dot: "bg-blue-400" },
    { label: "Locked", statuses: ["LOCKED", "LOCKED_AGAIN"], chip: "bg-amber-500/10 text-amber-300 border-amber-500/20", dot: "bg-amber-400" },
    { label: "Unlock requests", statuses: ["UNLOCK_REQUESTED"], chip: "bg-orange-500/10 text-orange-300 border-orange-500/20", dot: "bg-orange-400" },
    { label: "In revision", statuses: ["UNLOCKED_FOR_REVISION"], chip: "bg-purple-500/10 text-purple-300 border-purple-500/20", dot: "bg-purple-400" },
];
const STATUS_ACCENT: Record<string, string> = {
    SUBMITTED: "border-l-blue-400", RESUBMITTED: "border-l-blue-400",
    LOCKED: "border-l-amber-400", LOCKED_AGAIN: "border-l-amber-400",
    UNLOCK_REQUESTED: "border-l-orange-400", UNLOCKED_FOR_REVISION: "border-l-purple-400",
};

const fmtDT = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : toDmyTime(d);
};
const fmtD = (ymd?: string) => (ymd ? toDmy(ymd) : "");

/** Read tracking of a plan (current version): Read / Updated After Read / Awaiting Review / not locked yet */
type ReadState = "READ" | "UPDATED" | "AWAITING" | "NOT_LOCKED";
const readStateOf = (p: any): ReadState => {
    const st = getPlanStatus(p);
    if (!["LOCKED", "LOCKED_AGAIN"].includes(st)) return "NOT_LOCKED";
    if (planReads(p).length > 0 && !p.canMarkRead) return "READ";
    if ((p.hoiReads || []).some((r: any) => (r.version || 1) < (p.version || 1))) return "UPDATED";
    return planReads(p).length > 0 ? "READ" : "AWAITING";
};
const READ_META: Record<ReadState, { label: string; cls: string; Icon: any }> = {
    READ: { label: "Read", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", Icon: CheckCheck },
    UPDATED: { label: "Updated After Read", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", Icon: FilePenLine },
    AWAITING: { label: "Awaiting Review", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", Icon: Hourglass },
    NOT_LOCKED: { label: "Not locked yet", cls: "bg-zinc-800 text-zinc-400 border-zinc-700", Icon: Unlock },
};
/** Icon + colour of an activity-history step, from its action text */
const stepMeta = (action = "") => {
    const a = action.toLowerCase();
    if (a.includes("read")) return { Icon: CheckCheck, cls: "text-teal-300 border-teal-500/30 bg-teal-500/10" };
    if (a.includes("unlock")) return { Icon: Unlock, cls: "text-violet-300 border-violet-500/30 bg-violet-500/10" };
    if (a.includes("lock")) return { Icon: Lock, cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
    if (a.includes("tim")) return { Icon: Clock, cls: "text-sky-300 border-sky-500/30 bg-sky-500/10" };
    if (a.includes("submit")) return { Icon: FileText, cls: "text-blue-300 border-blue-500/30 bg-blue-500/10" };
    return { Icon: Pencil, cls: "text-zinc-300 border-zinc-600 bg-zinc-800" };
};

export default function CurriculumSprintPlansPage() {
    const wide = useMinWidth(768); // table (scrolls inside its box) from tablet up, cards on phone
    const { user } = useAuth();
    const [weekOffset, setWeekOffset] = useState(0);
    // Colleges come from the database (Location), limited by the server to what this user may see
    const [selectedCampus, setSelectedCampus] = useState("All");
    const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
    const [highlightPlan, setHighlightPlan] = useState<string | null>(null);
    const [viewPlan, setViewPlan] = useState<any | null>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [allEntries, setAllEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    // Plans waiting for a reviewer in ANY week (professors usually plan the coming week)
    const [queue, setQueue] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [readFilter, setReadFilter] = useState<"ALL" | ReadState>("ALL");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [historyPlan, setHistoryPlan] = useState<any | null>(null);
    const [readBusy, setReadBusy] = useState<string | null>(null);
    // visible width of the scrolling table box — the expanded activity panel stays this wide (no sideways scrolling)
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [boxW, setBoxW] = useState(0);
    useEffect(() => {
        const el = boxRef.current; if (!el) return;
        const ro = new ResizeObserver(() => setBoxW(el.clientWidth)); ro.observe(el); setBoxW(el.clientWidth);
        return () => ro.disconnect();
    });

    const weekInfo = getWeekDates(weekOffset);

    // Deep link from the unlock-request email: ?week=YYYY-MM-DD&campus=<college>&plan=<id>
    useEffect(() => {
        try {
            const q = new URLSearchParams(window.location.search);
            const w = q.get("week");
            if (q.get("campus")) setSelectedCampus(q.get("campus") as string);
            if (q.get("plan")) setHighlightPlan(q.get("plan"));
            if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) {
                const base = new Date(getWeekDates(0).start + "T00:00:00Z").getTime();
                setWeekOffset(Math.round((new Date(w + "T00:00:00Z").getTime() - base) / (7 * 86400000)));
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchCampusSprintData();
    }, [weekOffset, selectedCampus]);

    const fetchQueue = async () => {
        try {
            const res = await fetch(`/api/curriculum/sprint-plan?campus=${encodeURIComponent(selectedCampus)}&queue=1`);
            const data = await res.json();
            if (res.ok) setQueue(data.queue || []);
        } catch { /* the weekly view still works */ }
    };
    useEffect(() => { fetchQueue(); }, [selectedCampus]);
    const openQueued = (q: any) => {
        const base = new Date(getWeekDates(0).start + "T00:00:00Z").getTime();
        setWeekOffset(Math.round((new Date(q.weekStartDate + "T00:00:00Z").getTime() - base) / (7 * 86400000)));
        setHighlightPlan(q._id);
        setTimeout(() => document.querySelector('[data-testid="campus-timetable"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    };
    const collegeLabel = (v?: string) => colleges.find(c => c.id === v || c.name === v)?.name || v || "Not assigned";
    const dmyDate = (ymd?: string) => (ymd ? toDmy(ymd) : "");

    // Only the latest request may update the page (week / date can change while a request is running)
    const latestRequest = useRef(0);
    const fetchCampusSprintData = async () => {
        const requestNo = ++latestRequest.current;
        setLoading(true);
        try {
            const res = await fetch(`/api/curriculum/sprint-plan?campus=${encodeURIComponent(selectedCampus)}&weekStartDate=${weekInfo.start}`);
            const data = await res.json();
            if (requestNo !== latestRequest.current) return;
            if (!res.ok) throw new Error(data.error || "Could not load sprint plans");
            setPlans(data.plans || []);
            setAllEntries(data.allEntries || []);
            setColleges(data.colleges || []);
        } catch (e) {
            console.error("Failed to fetch campus sprint plans", e);
        } finally {
            if (requestNo === latestRequest.current) setLoading(false);
        }
    };

    const isCampusFullyVerified = useMemo(() => {
        if (plans.length === 0) return false;
        return plans.every(p => ["LOCKED", "LOCKED_AGAIN"].includes(p.status));
    }, [plans]);

    const handleCampusLockToggle = async (lock: boolean) => {
        setActionLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/curriculum/sprint-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: lock ? "VERIFY_AND_LOCK_CAMPUS" : "UNLOCK_CAMPUS",
                    campus: selectedCampus,
                    weekStartDate: weekInfo.start,
                    clRemarks: remarks || (lock ? "Verified & Approved for teaching schedule" : "Unlocked for syllabus adjustments")
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({
                    type: (data.skipped || []).length && !data.modifiedCount ? "error" : "success",
                    text: (lock ? `${data.modifiedCount || 0} submitted plan(s) locked.` : `${data.modifiedCount || 0} plan(s) unlocked for revision.`)
                        + ((data.skipped || []).length ? ` Skipped: ${data.skipped.join("; ")}` : "")
                });
                fetchCampusSprintData(); fetchQueue();
            } else {
                setMessage({ type: "error", text: data.error || "Action failed." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePlanLockToggle = async (planId: string, lock: boolean) => {
        setActionLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/curriculum/sprint-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: lock ? "VERIFY_AND_LOCK_PLAN" : "UNLOCK_PLAN",
                    planId,
                    clRemarks: remarks || "Individual verification update"
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({
                    type: "success",
                    text: lock ? "Faculty sprint plan verified & locked." : "Sprint plan unlocked."
                });
                fetchCampusSprintData(); fetchQueue();
            } else {
                setMessage({ type: "error", text: data.error || "Action failed." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    // Lock / unlock: HOI, CL, CH, AD (the server also checks the college of every plan)
    const isAuthorized = !!user?.role && PLAN_AUTHORITY_ROLES.includes(user.role);

    // HOI / CL / CH / AD only review plans here (professors lock / unlock their own) — no lock / unlock controls on this page

    // Rows: this week's plans + plans of other weeks that are still waiting (unlock request / to read)
    const rows = useMemo(() => {
        const map = new Map<string, any>();
        plans.forEach(p => map.set(String(p._id), p));
        queue.forEach(q => { if (!map.has(String(q._id))) map.set(String(q._id), q); });
        return Array.from(map.values()).sort((a, b) => (b.weekStartDate || "").localeCompare(a.weekStartDate || "") || String(a.facultyName || "").localeCompare(String(b.facultyName || "")));
    }, [plans, queue]);
    const counts = useMemo(() => ({
        ALL: rows.length,
        AWAITING: rows.filter(r => readStateOf(r) === "AWAITING").length,
        READ: rows.filter(r => readStateOf(r) === "READ").length,
        UPDATED: rows.filter(r => readStateOf(r) === "UPDATED").length,
    }), [rows]);
    const shownRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(r => (readFilter === "ALL" || readStateOf(r) === readFilter)
            && (!q || [r.facultyName, r.facultyId, collegeLabel(r.college)].some(v => String(v || "").toLowerCase().includes(q))));
    }, [rows, readFilter, search, colleges]);

    const lastActivity = (p: any) => {
        const h = (p.history || []).slice(-1)[0];
        if (!h) return null;
        return { text: `${h.action}${h.byName && !/\bby\b/i.test(h.action) ? ` by ${h.byName}` : ""}`, at: h.at };
    };
    const submittedOn = (p: any) => p.lockedAt || p.resubmittedAt || p.submittedAt || null;

    // "Mark as Read" — the same server action as before
    const markRead = async (p: any) => {
        setReadBusy(String(p._id)); setMessage(null);
        try {
            const res = await fetch("/api/sprint-plan/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: p._id, action: "mark_read" }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Action failed");
            setMessage({ type: "success", text: data.message || "Marked as read." });
            fetchCampusSprintData(); fetchQueue();
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally { setReadBusy(null); }
    };

    const actBtn = "inline-flex items-center justify-center gap-1 h-7 px-2 rounded-lg border text-[10.5px] font-semibold whitespace-nowrap transition-colors disabled:opacity-50";
    const Actions = ({ p, row = false }: { p: any; row?: boolean }) => (
        <div className={row ? "grid grid-cols-2 gap-1.5 w-[232px] [&>button]:w-full" : "flex flex-wrap items-center gap-1.5"} onClick={e => e.stopPropagation()}>
            {p.canMarkRead && (
                <button onClick={() => markRead(p)} disabled={readBusy === String(p._id)} data-testid="mark-read" className={`${actBtn} border-teal-500/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20`}>
                    {readBusy === String(p._id) ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />} Mark as Read
                </button>
            )}
            <button onClick={() => setHistoryPlan(p)} data-testid="row-history" className={`${actBtn} border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800`}><History size={13} /> History</button>
            <button onClick={() => setViewPlan(p)} data-testid="view-plan" className={`${actBtn} border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800`}><FileText size={13} /> View Plan</button>
            <button onClick={() => openQueued(p)} data-testid="queue-open" title="Show this week's timetable" className={`${actBtn} border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}><CalendarDays size={13} /> Go to Week</button>
        </div>
    );
    const ReadBadge = ({ p }: { p: any }) => {
        const m = READ_META[readStateOf(p)];
        const reads = planReads(p);
        return (
            <span data-testid="read-status" data-state={readStateOf(p)} title={reads.map((r: any) => `${r.byName}${r.at ? ` · ${fmtDT(r.at)}` : ""}`).join("\n")}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10.5px] font-bold leading-tight whitespace-nowrap ${m.cls}`}>
                <m.Icon size={12} className="shrink-0" /> {m.label}
            </span>
        );
    };
    /** Expanded row: activity history (oldest first) + what changed after re-lock + (CL / CH / AD) the unlock controls */
    const ActivityPanel = ({ p }: { p: any }) => {
        const hist = p.history || [];
        return (
            <div className="space-y-3" data-testid="activity-panel">
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-300"><Clock size={15} /></span>
                    <div><p className="text-sm font-bold text-white">Activity History</p><p className="text-[11px] text-zinc-500">Changes and plan status updates for this sprint plan.</p></div>
                </div>
                {hist.length === 0 ? <p className="text-xs text-zinc-500 pl-11">No history recorded yet.</p> : (
                    <ol className="relative pl-11 space-y-2" data-testid="activity-list">
                        <span className="absolute left-[15px] top-2 bottom-2 w-px bg-zinc-800" />
                        {hist.map((h: any, i: number) => {
                            const m = stepMeta(h.action);
                            return (
                                <li key={i} className="relative grid grid-cols-1 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-x-6 gap-y-0.5 items-start" data-testid="activity-step">
                                    <span className={`absolute -left-[33px] top-1 w-2.5 h-2.5 rounded-full border-2 ${i === hist.length - 1 ? "border-zinc-400 bg-zinc-950" : "border-emerald-500 bg-emerald-500"}`} />
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <span className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center ${m.cls}`}><m.Icon size={13} /></span>
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-bold text-white [overflow-wrap:anywhere]">{h.action}{h.byName ? ` · ${h.byName}` : ""}{h.role ? <span className="font-medium text-zinc-500"> ({roleShort(h.role)})</span> : null}</p>
                                            <p className="text-[10.5px] text-zinc-500">{fmtDT(h.at)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[11.5px] text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere] md:border-l md:border-zinc-800 md:pl-4 md:py-1">{h.note || "—"}</p>
                                </li>
                            );
                        })}
                    </ol>
                )}
                <RelockChanges plan={p} compact />
            </div>
        );
    };

    const STAT_CARDS = [
        { k: "ALL", label: "Total Plans", Icon: Layers, cls: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30", box: "border-zinc-800" },
        { k: "AWAITING", label: "Awaiting Review", Icon: Hourglass, cls: "text-amber-300 bg-amber-500/15 border-amber-500/30", box: "border-amber-500/25" },
        { k: "READ", label: "Read", Icon: CheckCheck, cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30", box: "border-emerald-500/25" },
        { k: "UPDATED", label: "Updated After Read", Icon: FilePenLine, cls: "text-sky-300 bg-sky-500/15 border-sky-500/30", box: "border-sky-500/25" },
    ] as const;
    const FILTERS = [["ALL", "All Plans"], ["AWAITING", "Awaiting Review"], ["READ", "Read"], ["UPDATED", "Updated After Read"]] as const;
    const th = "px-3 py-3 text-left text-[11px] font-semibold text-zinc-400 whitespace-nowrap border-b border-zinc-800 bg-zinc-900/80";
    const td = "px-3 py-3 align-middle border-b border-zinc-800/70 text-xs";

    return (
        <div className="w-full [contain:inline-size] max-w-[1400px] mx-auto pt-6 pb-14 px-4 sm:px-6 space-y-4">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/25"><CalendarDays size={22} className="text-indigo-300" /></div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Campus Sprint Verification &amp; Timetable</h1>
                        <p className="text-xs text-zinc-400 mt-0.5">Review submitted sprint plans across colleges with activity history and read tracking.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 h-10 px-3 bg-zinc-900 border border-zinc-700 rounded-xl min-w-0">
                        <Building2 size={15} className="text-zinc-400 shrink-0" />
                        <select value={selectedCampus} onChange={(e) => setSelectedCampus(e.target.value)} data-testid="campus-select"
                            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[220px]">
                            {colleges.length !== 1 && <option value="All" className="bg-zinc-900 text-white">All My Colleges</option>}
                            {colleges.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center h-10 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
                        <button onClick={() => setWeekOffset((p) => p - 1)} aria-label="Previous week" data-testid="week-prev" className="h-full px-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800"><ArrowLeft size={15} /></button>
                        <span className="flex items-center gap-2 px-2 text-xs font-semibold text-white whitespace-nowrap" data-testid="week-text"><CalendarDays size={14} className="text-zinc-400" /> {fmtD(weekInfo.start)} – {fmtD(weekInfo.end)}</span>
                        <button onClick={() => setWeekOffset((p) => p + 1)} aria-label="Next week" data-testid="week-next" className="h-full px-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800"><ArrowRight size={15} /></button>
                    </div>
                    <button onClick={() => { fetchCampusSprintData(); fetchQueue(); }} title="Refresh" aria-label="Refresh" className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700">
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Search + read filters */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by professor name, employee ID, or campus..." data-testid="plan-search"
                        className="w-full h-10 pl-9 pr-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder:text-zinc-500 outline-none focus:border-indigo-500/60" />
                </div>
                <div className="flex flex-wrap gap-1.5" role="tablist" data-testid="read-filters">
                    {FILTERS.map(([k, l]) => (
                        <button key={k} role="tab" aria-selected={readFilter === k} onClick={() => setReadFilter(k)} data-testid={`filter-${k}`}
                            className={`h-10 px-3.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${readFilter === k ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>{l}</button>
                    ))}
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {STAT_CARDS.map(c => (
                    <button key={c.k} onClick={() => setReadFilter(c.k as any)} data-testid={`stat-${c.k}`}
                        className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border bg-zinc-900/60 text-left hover:bg-zinc-900 transition-colors ${c.box} ${readFilter === c.k ? "ring-1 ring-indigo-500/50" : ""}`}>
                        <span className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center ${c.cls}`}><c.Icon size={18} /></span>
                        <span className="min-w-0"><span className="block text-[11px] text-zinc-400 truncate">{c.label}</span><span className="block text-xl sm:text-2xl font-black text-white tabular-nums">{counts[c.k as keyof typeof counts]}</span></span>
                    </button>
                ))}
            </div>

            {/* Notification message */}
            {message && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`} data-testid="page-message">
                    {message.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    <span>{message.text}</span>
                </div>
            )}


            {/* Plans table / cards */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden" data-testid="campus-plan-list">
                {loading && rows.length === 0 ? (
                    <div className="flex items-center justify-center py-16"><div className="w-9 h-9 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
                ) : shownRows.length === 0 ? (
                    <p className="text-xs text-zinc-500 px-4 py-10 text-center" data-testid="plans-empty">{rows.length === 0 ? "No submitted sprint plans for this week." : "No plans match this filter."}</p>
                ) : wide ? (
                    <div ref={boxRef} className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[1180px] border-separate border-spacing-0" data-testid="plans-table">
                            <thead>
                                <tr>
                                    <th className={`${th} w-[200px] sticky left-0 z-[3] !bg-zinc-900 shadow-[8px_0_12px_-8px_rgba(0,0,0,0.6)]`}>Professor</th><th className={th}>Employee ID</th><th className={`${th} w-[150px]`}>Campus</th>
                                    <th className={th}>Week</th><th className={th}>Submitted On</th><th className={th}>Plan State</th><th className={th}>Read Status</th>
                                    <th className={`${th} w-[190px]`}>Last Activity</th><th className={`${th} sticky right-0 z-[3] !bg-zinc-900 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)]`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shownRows.map(p => {
                                    const id = String(p._id); const open = expanded === id; const la = lastActivity(p);
                                    return [
                                        <tr key={id} onClick={() => setExpanded(open ? null : id)} data-testid="plan-row" aria-expanded={open}
                                            className={`cursor-pointer transition-colors ${open ? "bg-zinc-900/70" : highlightPlan === id ? "bg-amber-500/5" : "hover:bg-zinc-900/40"}`}>
                                            <td className={`${td} sticky left-0 z-[2] shadow-[8px_0_12px_-8px_rgba(0,0,0,0.6)] ${open ? "bg-[#141416]" : "bg-[#0c0c0f]"}`} data-col="professor">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {open ? <ChevronDown size={15} className="shrink-0 text-zinc-400" /> : <ChevronRight size={15} className="shrink-0 text-zinc-500" />}
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] text-white [overflow-wrap:anywhere]">{p.facultyName}</p>
                                                        <p className="text-[10.5px] text-zinc-500">{(p.entries || []).length} class{(p.entries || []).length === 1 ? "" : "es"}{p.stream ? ` · ${p.stream}` : ""}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`${td} font-mono text-zinc-300 whitespace-nowrap`}>{p.facultyId}</td>
                                            <td className={`${td} text-zinc-300 [overflow-wrap:anywhere]`}>{collegeLabel(p.college)}</td>
                                            <td className={`${td} text-zinc-300 whitespace-nowrap`}>{fmtD(p.weekStartDate)} –<br />{fmtD(p.weekEndDate)}</td>
                                            <td className={`${td} text-zinc-300 whitespace-nowrap`}>{submittedOn(p) ? <>{fmtDT(submittedOn(p)).split(", ")[0]},<br />{fmtDT(submittedOn(p)).split(", ")[1]}</> : "—"}</td>
                                            <td className={td}><PlanStatusBadge plan={p} /></td>
                                            <td className={td}><ReadBadge p={p} /></td>
                                            <td className={`${td} text-zinc-300`} data-testid="last-activity">{la ? <><span className="block [overflow-wrap:anywhere]">{la.text}</span><span className="block text-[10.5px] text-zinc-500">{fmtDT(la.at)}</span></> : "—"}</td>
                                            <td className={`${td} sticky right-0 z-[2] shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)] ${open ? "bg-[#141416]" : "bg-[#0c0c0f]"}`} data-col="actions"><Actions p={p} row /></td>
                                        </tr>,
                                        open && (
                                            <tr key={id + "-x"} data-testid="plan-row-expanded">
                                                <td colSpan={9} className="p-0 border-b border-zinc-800 bg-zinc-900/40"><div className="sticky left-0 px-4 sm:px-6 py-4" style={{ width: boxW ? `${boxW}px` : undefined }}><ActivityPanel p={p} /></div></td>
                                            </tr>
                                        ),
                                    ];
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* Phone: one card per plan */
                    <div className="divide-y divide-zinc-800" data-testid="plan-cards">
                        {shownRows.map(p => {
                            const id = String(p._id); const open = expanded === id; const la = lastActivity(p);
                            return (
                                <div key={id} className={`p-3.5 space-y-2.5 ${highlightPlan === id ? "bg-amber-500/5" : ""}`} data-testid="plan-card">
                                    <button onClick={() => setExpanded(open ? null : id)} aria-expanded={open} className="w-full flex items-start justify-between gap-2 text-left">
                                        <span className="min-w-0">
                                            <span className="block font-bold text-sm text-white [overflow-wrap:anywhere]">{p.facultyName} <span className="font-mono font-normal text-[10.5px] text-zinc-500">{p.facultyId}</span></span>
                                            <span className="block text-[11px] text-zinc-400 [overflow-wrap:anywhere]">{collegeLabel(p.college)} · {fmtD(p.weekStartDate)} – {fmtD(p.weekEndDate)}</span>
                                            {submittedOn(p) && <span className="block text-[10.5px] text-zinc-500">Submitted {fmtDT(submittedOn(p))}</span>}
                                        </span>
                                        {open ? <ChevronDown size={16} className="shrink-0 mt-0.5 text-zinc-400" /> : <ChevronRight size={16} className="shrink-0 mt-0.5 text-zinc-500" />}
                                    </button>
                                    <div className="flex flex-wrap gap-1.5"><PlanStatusBadge plan={p} /><ReadBadge p={p} /></div>
                                    {la && <p className="text-[11px] text-zinc-400 [overflow-wrap:anywhere]">{la.text} · {fmtDT(la.at)}</p>}
                                    <Actions p={p} />
                                    {open && <div className="pt-2 border-t border-zinc-800"><ActivityPanel p={p} /></div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Campus timetable of the selected week (as before) */}
            {!loading && (
                <div className="overflow-x-auto [contain:inline-size] rounded-2xl" data-testid="campus-timetable">
                    <SprintPlanTimetableGrid entries={allEntries} weekRangeText={`${weekInfo.start} to ${weekInfo.end}`} weekDates={weekInfo.dates}
                        key={selectedCampus} currentCampus={selectedCampus} campusChoices={colleges} />
                </div>
            )}

            {historyPlan && <PlanHistoryModal plan={historyPlan} onClose={() => setHistoryPlan(null)} />}

            {/* One professor's complete weekly sprint plan */}
            {viewPlan && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={() => setViewPlan(null)}>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} data-testid="plan-modal">
                        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-white">{viewPlan.facultyName} — Sprint Plan</h3>
                                <p className="text-[11px] text-zinc-400 mt-0.5">{toDmy(viewPlan.weekStartDate)} to {toDmy(viewPlan.weekEndDate)} · {(viewPlan.entries || []).length} class(es) · Version {viewPlan.version || 1}</p>
                            </div>
                            <button onClick={() => setViewPlan(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            {["MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => {
                                const list = (viewPlan.entries || []).filter((e: any) => (e.day || "").toUpperCase().startsWith(day))
                                    .sort((a: any, b: any) => (a.timeStart || "").localeCompare(b.timeStart || ""));
                                if (!list.length) return null;
                                return (
                                    <div key={day} className="rounded-xl border border-zinc-800 overflow-hidden">
                                        <div className="px-4 py-2 bg-zinc-800/50 text-[11px] font-black text-white tracking-widest">
                                            {day} <span className="text-zinc-500 font-bold ml-2">{toDmy(list[0]?.date)}</span>
                                        </div>
                                        <div className="divide-y divide-zinc-800">
                                            {list.map((e: any, i: number) => (
                                                <div key={i} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                                                    <div className="font-black text-white tabular-nums">{e.timeStart} – {e.timeStop}</div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-white">{e.subjectName}{e.subjectCode ? <span className="text-zinc-500 font-normal"> ({e.subjectCode})</span> : null}</p>
                                                        <p className="text-zinc-300 [overflow-wrap:anywhere]">Topic: {e.topics || "—"}</p>
                                                        {e.content && <p className="text-zinc-500 text-[11px] [overflow-wrap:anywhere]">Content: {e.content}</p>}
                                                    </div>
                                                    <div className="min-w-0 text-[11px] text-zinc-400 space-y-0.5">
                                                        <p>{[e.lectureType, e.unitNumber ? `Unit ${e.unitNumber}` : ""].filter(Boolean).join(" · ") || "—"}</p>
                                                        <p>{[e.className, e.section ? `Sec ${e.section}` : ""].filter(Boolean).join(" · ")}</p>
                                                        <p>{[e.stream, e.year, e.semester].filter(Boolean).join(" · ")}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {!(viewPlan.entries || []).length && <p className="text-sm text-zinc-500">No classes in this plan.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}