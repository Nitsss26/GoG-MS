"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useMemo, useRef } from "react";
import SprintPlanTimetableGrid from "@/components/academic/SprintPlanTimetableGrid";
import SprintPlanWorkflowPanel from "@/components/academic/SprintPlanWorkflowPanel";
import { PLAN_AUTHORITY_ROLES } from "@/lib/academic-status";
import {
    CalendarDays, Lock, Unlock, CheckCircle2, AlertTriangle, Eye, X,
    ArrowLeft, ArrowRight, RefreshCw, Filter, Building2, ShieldCheck,
    MessageSquare, Check
} from "lucide-react";


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

export default function CurriculumSprintPlansPage() {
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
                fetchCampusSprintData();
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
                fetchCampusSprintData();
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

    return (
        <div className="w-full [contain:inline-size] max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-6">
            {/* Control Header */}
            <div className="relative group bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                            <CalendarDays size={24} className="text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Campus Sprint Verification & Timetable
                            </h1>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Automated Timetable aggregation &bull; Grouped by Clock-in Location &bull; Concurrent Slot Resolution
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters & Week Picker */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Campus Selector */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl">
                        <Building2 size={16} className="text-amber-400 shrink-0" />
                        <select
                            value={selectedCampus}
                            onChange={(e) => setSelectedCampus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                            {colleges.length !== 1 && <option value="All" className="bg-zinc-900 text-white">All my colleges</option>}
                            {colleges.map((c) => (
                                <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Week Navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setWeekOffset((p) => p - 1)}
                            className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/50 transition-all active:scale-95"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div className="px-4 py-2 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-xs font-black text-white tracking-wider">
                            {weekInfo.start} <span className="text-zinc-500">to</span> {weekInfo.end}
                        </div>
                        <button
                            onClick={() => setWeekOffset((p) => p + 1)}
                            className="p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/50 transition-all active:scale-95"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={fetchCampusSprintData}
                        className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Notification message */}
            {message && (
                <div
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${
                        message.type === "success"
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border border-red-500/20 text-red-400"
                    }`}
                >
                    {message.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Curriculum Verification Bar */}
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isCampusFullyVerified ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                    }`}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{colleges.find(c => c.id === selectedCampus)?.name || "All colleges"} Status:</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isCampusFullyVerified
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}>
                                {isCampusFullyVerified ? "All plans locked" : "Pending lock"}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            {plans.length} submitted sprint plan(s) for this week · {plans.filter(p => p.status === "UNLOCK_REQUESTED").length} unlock request(s) waiting.
                        </p>
                    </div>
                </div>

                {isAuthorized && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            placeholder="Add CL/CH Remarks (Optional)..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                        />
                        {!isCampusFullyVerified ? (
                            <button
                                onClick={() => handleCampusLockToggle(true)}
                                disabled={actionLoading || plans.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                            >
                                <Lock size={14} /> Lock All Submitted Plans
                            </button>
                        ) : (
                            <button
                                onClick={() => handleCampusLockToggle(false)}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-black uppercase tracking-wider rounded-xl border border-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Unlock size={14} /> Unlock All Plans
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Faculty plans summary (top) + campus timetable */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                Faculty Plans Summary <span className="text-zinc-500">({plans.length})</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {SUMMARY_GROUPS.map(g => {
                                    const n = plans.filter(p => g.statuses.includes(p.status)).length;
                                    return (
                                        <span key={g.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${g.chip} ${n === 0 ? "opacity-40" : ""}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} /> {g.label} <span className="tabular-nums">{n}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        {plans.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-2">No submitted sprint plans for this week.</p>
                        ) : (
                            /* One plan per row, stacked vertically: [professor] [status + actions] [view] */
                            <div className="flex flex-col gap-2.5" data-testid="campus-plan-list">
                                {plans.map((p) => (
                                    <div
                                        key={p._id}
                                        data-testid="campus-plan-card"
                                        className={`w-full p-3.5 sm:px-4 rounded-xl bg-zinc-800/30 border border-l-4 grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)_auto] gap-3 lg:gap-5 lg:items-start ${STATUS_ACCENT[p.status] || "border-l-zinc-600"} ${highlightPlan === p._id ? "border-orange-400/70 ring-1 ring-orange-400/40" : "border-zinc-700/50"}`}
                                    >
                                        {/* Professor */}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-white truncate">{p.facultyName}</h4>
                                                {p.isVerifiedByCL && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CL/CH ✓</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                                {p.entries?.length || 0} class{(p.entries?.length || 0) === 1 ? "" : "es"} &bull; {p.stream || "General"}
                                            </p>
                                            {p.clRemarks && <p className="text-[10px] text-zinc-500 italic mt-1 [overflow-wrap:anywhere]">Remarks: {p.clRemarks}</p>}
                                        </div>

                                        {/* Status, lock / unlock actions, unlock request */}
                                        <div className="min-w-0">
                                            <SprintPlanWorkflowPanel plan={p} mode="reviewer" compact
                                                onChanged={(_, msg) => { setMessage({ type: "success", text: msg }); fetchCampusSprintData(); }} />
                                        </div>

                                        {/* View */}
                                        <button onClick={() => setViewPlan(p)} data-testid="view-plan"
                                            className="w-full lg:w-auto shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-all whitespace-nowrap">
                                            <Eye size={13} /> View Sprint Plan
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* The timetable can be wider than the screen: it scrolls inside its own box */}
                    <div className="overflow-x-auto [contain:inline-size] rounded-2xl">
                        <SprintPlanTimetableGrid
                            entries={allEntries}
                            weekRangeText={`${weekInfo.start} to ${weekInfo.end}`}
                            weekDates={weekInfo.dates}
                            key={selectedCampus}
                            currentCampus={selectedCampus}
                        />
                    </div>
                </div>
            )}

            {/* One professor's complete weekly sprint plan */}
            {viewPlan && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={() => setViewPlan(null)}>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} data-testid="plan-modal">
                        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-white">{viewPlan.facultyName} — Sprint Plan</h3>
                                <p className="text-[11px] text-zinc-400 mt-0.5">{viewPlan.weekStartDate?.split("-").reverse().join("-")} to {viewPlan.weekEndDate?.split("-").reverse().join("-")} · {(viewPlan.entries || []).length} class(es) · Version {viewPlan.version || 1}</p>
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
                                            {day} <span className="text-zinc-500 font-bold ml-2">{list[0]?.date?.split("-").reverse().join("-")}</span>
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