"use client";

import { useState, useEffect } from "react";
import {
    CalendarDays, Lock, Clock, BookOpen, ArrowLeft, ArrowRight,
    Check, AlertTriangle, ShieldCheck
} from "lucide-react";

interface FacultySprintPlanViewProps {
    facultyId: string;
    facultyName: string;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatDateDMY(dateStr: string) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y}`;
}

export default function FacultySprintPlanView({ facultyId, facultyName }: FacultySprintPlanViewProps) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const getWeekDates = (offset = 0) => {
        const now = new Date();
        const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const ist = new Date(istStr);
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
        return { start: dates[0].date, end: dates[5].date, dates };
    };

    const weekInfo = getWeekDates(weekOffset);

    useEffect(() => {
        if (facultyId) {
            fetchPlan();
        }
    }, [facultyId, weekOffset]);

    const fetchPlan = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/faculty/sprint-plan?facultyId=${facultyId}&weekStartDate=${weekInfo.start}`);
            const data = await res.json();
            if (data.plans?.length > 0) {
                setPlan(data.plans[0]);
            } else {
                setPlan(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                        <CalendarDays size={24} className="text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Teaching Schedule</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Reviewing: {facultyName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setWeekOffset(prev => prev - 1)}
                        className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all active:scale-95">
                        <ArrowLeft size={16} />
                    </button>
                    <div className="px-5 py-3 bg-zinc-800/80 border border-zinc-700/50 rounded-xl">
                        <span className="text-xs font-black text-white tabular-nums tracking-widest uppercase">
                            {formatDateDMY(weekInfo.start)} <span className="text-zinc-600 font-bold mx-2">/</span> {formatDateDMY(weekInfo.end)}
                        </span>
                    </div>
                    <button onClick={() => setWeekOffset(prev => prev + 1)}
                        className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all active:scale-95">
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {plan?.isLocked && (
                <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-6 py-4">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                    <span className="text-xs text-zinc-400 font-medium italic">
                        State: <span className="text-emerald-500 font-black uppercase tracking-widest">Locked & Synchronized</span>. This plan is finalized for the current week.
                    </span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : !plan ? (
                <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-3xl p-16 text-center">
                    <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={32} className="text-zinc-600" />
                    </div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-widest">No Plan Found</h3>
                    <p className="text-xs text-zinc-500 font-bold mt-2 mx-auto max-w-xs">The faculty has not yet initialized a teaching sprint for this temporal range.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {weekInfo.dates.map(({ day, date }) => {
                        const dayEntries = (plan.entries || []).filter((e: any) => e.date === date || e.day === day);
                        return (
                            <div key={date} className="rounded-xl bg-zinc-900/50 border border-zinc-800 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 bg-zinc-800/30 border-b border-zinc-800/50">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black text-white bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/50 tracking-[0.2em]">{day}</span>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{formatDateDMY(date)}</span>
                                    </div>
                                </div>
                                {dayEntries.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-xs text-zinc-600">No lectures scheduled for this day</div>
                                ) : (
                                    <div className="divide-y divide-zinc-800/50">
                                        {dayEntries.map((entry: any, idx: number) => (
                                            <div key={idx} className="px-5 py-4 grid grid-cols-12 gap-4 items-center">
                                                <div className="col-span-2 flex items-center gap-2">
                                                    <Clock size={12} className="text-indigo-400" />
                                                    <span className="text-[10px] font-black text-white tabular-nums">{entry.timeStart} – {entry.timeStop}</span>
                                                </div>
                                                <div className="col-span-3">
                                                    <div className="text-[10px] font-black text-white uppercase tracking-tight">{entry.subjectName}</div>
                                                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{entry.subjectCode}</div>
                                                </div>
                                                <div className="col-span-3">
                                                    <div className="text-[10px] text-zinc-400 font-medium italic truncate">{entry.topics || "No topics listed"}</div>
                                                </div>
                                                <div className="col-span-4 flex justify-end">
                                                    <div className="px-3 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50 text-[9px] font-black text-zinc-300 uppercase tracking-widest">
                                                        {entry.stream} · {entry.year}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
