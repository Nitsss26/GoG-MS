"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import {
    CalendarDays, Plus, Trash2, Lock, Unlock, Save, AlertTriangle,
    Clock, BookOpen, ArrowLeft, ArrowRight, Check, X, Send
} from "lucide-react";
import Link from "next/link";

interface SprintEntry {
    day: string;
    date: string;
    timeStart: string;
    timeStop: string;
    stream: string;
    year: string;
    semester: string;
    subjectCode: string;
    subjectName: string;
    topics: string;
}

interface SprintPlanData {
    _id?: string;
    facultyId: string;
    facultyName: string;
    college: string;
    weekStartDate: string;
    weekEndDate: string;
    stream: string;
    year: string;
    isLocked: boolean;
    lockedAt?: string;
    entries: SprintEntry[];
    changeRequests?: any[];
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const TIME_SLOTS = [
    "08:30", "09:00", "09:20", "10:00", "10:10", "11:00", "11:50",
    "12:00", "12:20", "13:10", "13:30", "14:00", "14:50", "15:00"
];

const STREAMS = [
    "Full Stack Web Development", 
    "Computer Science (AI & ML)", 
    "Computer Science (Machine Learning)", 
    "Computer Science (Data Science)", 
    "Computer Science", 
    "Electronics & Communication", 
    "Mechanical Engineering", 
    "Electrical Engineering", 
    "Civil Engineering"
];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS = ["1st Semester", "2nd Semester", "3rd Semester", "4th Semester", "5th Semester", "6th Semester", "7th Semester", "8th Semester"];
const SUBJECTS: Record<string, string> = {
    "OOPS": "Object Oriented Programming",
    "REACT": "React.js UI Framework",
    "AI": "Artificial Intelligence",
    "DS": "Data Structures & Algorithms",
    "DBMS": "Database Management System",
    "ML": "Machine Learning",
    "NODE": "Node.js Backend",
    "PY": "Python Programming",
    "COA": "Computer Architecture",
    "OS": "Operating Systems"
};

function formatDateDMY(dateStr: string) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y}`;
}

function getWeekDates(offset = 0): { start: string; end: string; dates: { day: string; date: string }[] } {
    const now = new Date();
    const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const ist = new Date(istStr);

    // Find next Monday (or current Monday)
    const dayOfWeek = ist.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 6 ? 2 : (8 - dayOfWeek));
    const nextMonday = new Date(ist);
    nextMonday.setDate(ist.getDate() + daysUntilMonday + (offset * 7));

    const dates: { day: string; date: string }[] = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(nextMonday);
        d.setDate(nextMonday.getDate() + i);
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

export default function SprintPlanPage() {
    const { user } = useAuth();
    const [weekOffset, setWeekOffset] = useState(0);
    const [plan, setPlan] = useState<SprintPlanData | null>(null);
    const [entries, setEntries] = useState<SprintEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showChangeRequest, setShowChangeRequest] = useState(false);
    const [changeReason, setChangeReason] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const weekInfo = getWeekDates(weekOffset);

    useEffect(() => {
        if (user?.id) fetchPlan();
    }, [user, weekOffset]);

    const fetchPlan = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/faculty/sprint-plan?facultyId=${user?.id}&weekStartDate=${weekInfo.start}`);
            const data = await res.json();
            if (data.length > 0) {
                const p = data[0];
                setPlan(p);
                setEntries(p.entries || []);
            } else {
                setPlan(null);
                setEntries([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addEntry = (day: string, date: string) => {
        setEntries([...entries, {
            day, date,
            timeStart: "09:20",
            timeStop: "10:10",
            stream: STREAMS[0],
            year: YEARS[0],
            semester: SEMESTERS[0],
            subjectCode: Object.keys(SUBJECTS)[0],
            subjectName: SUBJECTS[Object.keys(SUBJECTS)[0]],
            topics: ""
        }]);
    };

    const updateEntry = (idx: number, field: keyof SprintEntry, value: string) => {
        const updated = [...entries];
        const newEntry = { ...updated[idx], [field]: value };
        
        // Auto-update subject name if code changes
        if (field === "subjectCode" && SUBJECTS[value]) {
            newEntry.subjectName = SUBJECTS[value];
        }
        
        updated[idx] = newEntry;
        setEntries(updated);
    };

    const removeEntry = (idx: number) => {
        setEntries(entries.filter((_, i) => i !== idx));
    };

    const savePlan = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/faculty/sprint-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId: user?.id,
                    weekStartDate: weekInfo.start,
                    weekEndDate: weekInfo.end,
                    entries
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Sprint plan saved successfully!" });
                setPlan(data.plan);
            } else {
                setMessage({ type: "error", text: data.error || "Failed to save" });
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setSaving(false);
        }
    };

    const lockPlan = async () => {
        try {
            const res = await fetch("/api/faculty/sprint-plan/lock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ facultyId: user?.id, weekStartDate: weekInfo.start })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Sprint plan locked!" });
                fetchPlan();
            } else {
                setMessage({ type: "error", text: data.error });
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    const submitChangeRequest = async () => {
        if (!changeReason.trim()) return;
        try {
            const res = await fetch("/api/faculty/sprint-plan/change-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId: user?.id,
                    weekStartDate: weekInfo.start,
                    reason: changeReason,
                    changes: { entries }
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Change request submitted for HOI approval" });
                setShowChangeRequest(false);
                setChangeReason("");
                fetchPlan();
            } else {
                setMessage({ type: "error", text: data.error });
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        }
    };

    if (!user || !["FACULTY", "PROFESSOR"].includes(user.role)) {
        return <div className="flex items-center justify-center h-[80vh] text-zinc-400">Access restricted to Faculty/Professors</div>;
    }

    return (
        <div className="max-w-7xl mx-auto pt-10 pb-10 px-4 sm:px-6 space-y-6">
            {/* Header */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                            <CalendarDays size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight">
                                Sprint Management
                            </h1>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1 italic">Tactical Teaching Schedule</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button onClick={() => setWeekOffset(prev => prev - 1)}
                            className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all hover:scale-110 active:scale-95">
                            <ArrowLeft size={16} />
                        </button>
                        <div className="px-5 py-3 bg-zinc-800/80 border border-zinc-700/50 rounded-xl">
                            <span className="text-xs font-black text-white tabular-nums tracking-widest uppercase">
                                {formatDateDMY(weekInfo.start)} <span className="text-zinc-600 font-bold mx-2">/</span> {formatDateDMY(weekInfo.end)}
                            </span>
                        </div>
                        <button onClick={() => setWeekOffset(prev => prev + 1)}
                            className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all hover:scale-110 active:scale-95">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            {plan?.isLocked && (
                <div className="flex items-center gap-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl px-6 py-4 shadow-lg animate-in slide-in-from-top-2 duration-500">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <Lock size={14} className="text-amber-500" />
                    </div>
                    <span className="text-xs text-zinc-400 font-medium italic">
                        Sprint state: <span className="text-amber-500 font-black uppercase tracking-widest">Locked</span>{plan.lockedAt ? ` (Since ${plan.lockedAt})` : ""}. Modification requires administrative change request.
                    </span>
                </div>
            )}

            {message && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${
                    message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" :
                    "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}>
                    {message.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
                    <span className="text-xs font-medium">{message.text}</span>
                </div>
            )}

            {/* Weekly Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-4">
                    {weekInfo.dates.map(({ day, date }) => {
                        const dayEntries = entries.filter(e => e.date === date || e.day === day);
                        const dayColors: Record<string, string> = {
                            MON: "border-blue-500/30", TUE: "border-teal-500/30", WED: "border-amber-500/30",
                            THU: "border-purple-500/30", FRI: "border-pink-500/30", SAT: "border-orange-500/30",
                        };

                        return (
                            <div key={date} className={`rounded-xl bg-zinc-900/50 border ${dayColors[day] || "border-zinc-800"} overflow-hidden`}>
                                <div className="flex items-center justify-between px-5 py-4 bg-zinc-800/30 border-b border-zinc-800/50">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black text-white bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/50 tracking-[0.2em]">{day}</span>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{formatDateDMY(date)}</span>
                                    </div>
                                    {!plan?.isLocked && (
                                        <button onClick={() => addEntry(day, date)}
                                            className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-xl transition-all border border-indigo-500/10 active:scale-95 uppercase tracking-widest">
                                            <Plus size={14} /> Add Slot
                                        </button>
                                    )}
                                </div>

                                {dayEntries.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-xs text-zinc-600">No lectures scheduled</div>
                                ) : (
                                    <div className="divide-y divide-zinc-800">
                                        {entries.map((entry, idx) => {
                                            if (entry.date !== date && entry.day !== day) return null;
                                            return (
                                                <div key={idx} className="px-4 py-3 grid grid-cols-12 gap-2 items-start">
                                                    <div className="col-span-2 flex gap-1">
                                                        <input value={entry.timeStart} onChange={e => updateEntry(idx, "timeStart", e.target.value)}
                                                            disabled={plan?.isLocked} placeholder="09:20"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white text-center focus:border-violet-500 focus:outline-none disabled:opacity-50" />
                                                        <input value={entry.timeStop} onChange={e => updateEntry(idx, "timeStop", e.target.value)}
                                                            disabled={plan?.isLocked} placeholder="10:10"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white text-center focus:border-violet-500 focus:outline-none disabled:opacity-50" />
                                                    </div>
                                                    <div className="col-span-3 flex flex-col gap-1">
                                                        <select value={entry.subjectCode} onChange={e => {
                                                                const code = e.target.value;
                                                                updateEntry(idx, "subjectCode", code);
                                                            }}
                                                            disabled={plan?.isLocked}
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 font-medium">
                                                            {Object.entries(SUBJECTS).map(([code, name]) => (
                                                                <option key={code} value={code}>{name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-3">
                                                        <input value={entry.topics} onChange={e => updateEntry(idx, "topics", e.target.value)}
                                                            disabled={plan?.isLocked} placeholder="Topics to cover"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50" />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <select value={entry.stream} onChange={e => updateEntry(idx, "stream", e.target.value)}
                                                            disabled={plan?.isLocked}
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                            {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-2 flex flex-col gap-1">
                                                        <div className="flex gap-1">
                                                            <select value={entry.year} onChange={e => updateEntry(idx, "year", e.target.value)}
                                                                disabled={plan?.isLocked}
                                                                className="flex-1 px-1 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                            </select>
                                                            <select value={entry.semester} onChange={e => updateEntry(idx, "semester", e.target.value)}
                                                                disabled={plan?.isLocked}
                                                                className="flex-1 px-1 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            {!plan?.isLocked && (
                                                                <button onClick={() => removeEntry(idx)} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors shrink-0">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-4 sticky bottom-8 bg-zinc-900/40 backdrop-blur-md p-4 rounded-3xl border border-zinc-800/80 shadow-2xl">
                {!plan?.isLocked ? (
                    <>
                        <button onClick={savePlan} disabled={saving}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-500/10 active:scale-95 disabled:opacity-50">
                            <Save size={16} /> {saving ? "Synchronizing..." : "Save Sprint Archive"}
                        </button>
                        {plan && (
                            <button onClick={lockPlan}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 text-xs font-black uppercase tracking-[0.2em] rounded-2xl border border-amber-500/20 transition-all active:scale-95">
                                <Lock size={16} /> Finalize & Lock
                            </button>
                        )}
                    </>
                ) : (
                    <button onClick={() => setShowChangeRequest(true)}
                        className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 text-xs font-black uppercase tracking-[0.2em] rounded-2xl border border-orange-500/20 transition-all active:scale-95">
                        <Send size={16} /> Dispatch Change Request (HOI)
                    </button>
                )}
            </div>

            {/* Change Request Modal */}
            {showChangeRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowChangeRequest(false)}>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md"
                        onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Send size={18} className="text-orange-400" />
                            Request Sprint Plan Change
                        </h3>
                        <p className="text-xs text-zinc-400 mb-4">
                            The sprint plan is locked. Provide a reason for the change — your request will be sent to the Head of Institute (HOI) for approval.
                        </p>
                        <textarea value={changeReason} onChange={e => setChangeReason(e.target.value)}
                            placeholder="Reason for change..."
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none resize-none h-24" />
                        <div className="flex gap-2 mt-4">
                            <button onClick={submitChangeRequest}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors">
                                <Send size={14} /> Submit Request
                            </button>
                            <button onClick={() => setShowChangeRequest(false)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
