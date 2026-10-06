"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useMemo } from "react";
import SprintPlanTimetableGrid from "@/components/academic/SprintPlanTimetableGrid";
import {
    CalendarDays, Lock, Unlock, CheckCircle2, AlertTriangle,
    ArrowLeft, ArrowRight, RefreshCw, Filter, Building2, ShieldCheck,
    MessageSquare, Check
} from "lucide-react";

const CAMPUSES = [
    "SAGE Bhopal",
    "MANIT Bhopal",
    "LNCT Bhopal",
    "Oriental Bhopal",
    "RKDF Bhopal",
    "SIRT Bhopal",
    "Global HQ"
];

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

export default function CurriculumSprintPlansPage() {
    const { user } = useAuth();
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedCampus, setSelectedCampus] = useState("SAGE Bhopal");
    const [plans, setPlans] = useState<any[]>([]);
    const [allEntries, setAllEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const weekInfo = getWeekDates(weekOffset);

    useEffect(() => {
        fetchCampusSprintData();
    }, [weekOffset, selectedCampus]);

    const fetchCampusSprintData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/curriculum/sprint-plan?campus=${encodeURIComponent(selectedCampus)}&weekStartDate=${weekInfo.start}`);
            const data = await res.json();
            setPlans(data.plans || []);
            setAllEntries(data.allEntries || []);
        } catch (e) {
            console.error("Failed to fetch campus sprint plans", e);
        } finally {
            setLoading(false);
        }
    };

    const isCampusFullyVerified = useMemo(() => {
        if (plans.length === 0) return false;
        return plans.every(p => p.isVerifiedByCL && p.isLocked);
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
                    type: "success",
                    text: lock ? "Campus sprint plans verified and locked successfully!" : "Campus sprint plans unlocked."
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

    const isAuthorized = user?.role === "CURRICULUM_HEAD" || user?.role === "CURRICULUM_LEAD" || user?.role === "SUPERADMIN";

    return (
        <div className="max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-6">
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
                            {CAMPUSES.map((c) => (
                                <option key={c} value={c} className="bg-zinc-900 text-white">
                                    {c}
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
                            <span className="text-sm font-bold text-white">{selectedCampus} Status:</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isCampusFullyVerified
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}>
                                {isCampusFullyVerified ? "Verified & Locked by CL/CH" : "Pending Verification"}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            {plans.length} faculty submitted sprint plans for this week.
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
                                <Lock size={14} /> Verify & Lock Campus Sprints
                            </button>
                        ) : (
                            <button
                                onClick={() => handleCampusLockToggle(false)}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-black uppercase tracking-wider rounded-xl border border-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Unlock size={14} /> Unlock Campus Sprints
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Timetable Grid View */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-6">
                    <SprintPlanTimetableGrid
                        entries={allEntries}
                        weekStartDate={weekInfo.start}
                        weekEndDate={weekInfo.end}
                        defaultCampus={selectedCampus}
                    />

                    {/* Individual Faculty Plans breakdown */}
                    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Campus Faculty Plans Summary ({plans.length})
                        </h3>
                        {plans.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-4">No faculty sprint plans found for this campus and week.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {plans.map((p) => (
                                    <div
                                        key={p._id}
                                        className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 flex flex-col justify-between gap-3"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-white">{p.facultyName}</h4>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                    p.isVerifiedByCL
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                }`}>
                                                    {p.isVerifiedByCL ? "Verified" : "Pending"}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 mt-1">
                                                {p.entries?.length || 0} scheduled classes &bull; {p.stream || "General"}
                                            </p>
                                            {p.clRemarks && (
                                                <p className="text-[10px] text-zinc-500 italic mt-2">
                                                    CL: {p.clRemarks}
                                                </p>
                                            )}
                                        </div>

                                        {isAuthorized && (
                                            <div className="pt-2 border-t border-zinc-700/50 flex items-center justify-between">
                                                <span className="text-[10px] text-zinc-500">
                                                    {p.isLocked ? "Locked" : "Open for edits"}
                                                </span>
                                                <button
                                                    onClick={() => handlePlanLockToggle(p._id, !p.isLocked)}
                                                    disabled={actionLoading}
                                                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                                                >
                                                    {p.isLocked ? "Unlock" : "Lock & Verify"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
