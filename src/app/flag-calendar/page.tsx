"use client";

import { useAuth } from "@/context/AuthContext";
import { FLAG_CONFIG, INDIAN_HOLIDAYS_2026 } from "@/lib/colleges";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Flag, AlertTriangle } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FlagCalendarPage() {
    const { user, attendanceRecords, holidays } = useAuth();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    if (!user) return null;

    const myRecords = attendanceRecords.filter(r => r.employeeId === user.id);

    // Build calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Adjust start day: 0=Mon, 5=Sat, skip Sun
    let startDow = firstDay.getDay(); // 0=Sun .. 6=Sat
    startDow = startDow === 0 ? -1 : startDow - 1; // Mon=0, Sat=5, Sun=-1

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(6).fill(null);
    let dayNum = 1;

    // Fill first week
    if (startDow >= 0 && startDow < 6) {
        for (let i = startDow; i < 6 && dayNum <= daysInMonth; i++) {
            const d = new Date(year, month, dayNum);
            if (d.getDay() !== 0) { // Skip Sundays
                week[i] = dayNum;
            }
            dayNum++;
        }
        // Skip Sunday after Saturday
        if (dayNum <= daysInMonth) {
            const nextD = new Date(year, month, dayNum);
            if (nextD.getDay() === 0) dayNum++;
        }
    } else {
        // Month starts on Sunday, skip it
        dayNum = 2;
        week[0] = dayNum;
        dayNum++;
    }
    weeks.push(week);

    while (dayNum <= daysInMonth) {
        week = new Array(6).fill(null);
        for (let i = 0; i < 6 && dayNum <= daysInMonth; i++) {
            const d = new Date(year, month, dayNum);
            if (d.getDay() !== 0) {
                week[i] = dayNum;
                dayNum++;
            } else {
                dayNum++; // Skip Sunday
                i--; // Don't consume a slot
            }
        }
        weeks.push(week);
    }

    const dateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const getApprovedHolidays = (d: string) => holidays.filter(h => h.date === d && h.status === "Approved");
    const getIndianHoliday = (d: string) => INDIAN_HOLIDAYS_2026.find(h => h.date === d);

    const getFlags = (d: string) => {
        const rec = myRecords.find(r => r.date === d);
        if (!rec) return [];
        return Object.entries(rec.flags).filter(([_, v]) => v).map(([k]) => k);
    };

    // Monthly flag summary
    const monthFlags: Record<string, number> = {};
    Object.keys(FLAG_CONFIG).forEach(k => monthFlags[k] = 0);
    myRecords.forEach(rec => {
        const d = new Date(rec.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
            Object.entries(rec.flags).filter(([_, v]) => v).forEach(([k]) => { monthFlags[k] = (monthFlags[k] || 0) + 1; });
        }
    });
    const totalFlags = Object.values(monthFlags).reduce((a, b) => a + b, 0);

    const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); setSelectedDay(null); };
    const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); setSelectedDay(null); };

    const monthName = new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><Flag size={18} className="text-primary" /> Flag Calendar</h1>
                <p className="text-xs text-zinc-400 mt-1">Monthly view of your attendance flags and holidays.</p>
            </header>

            {/* Flag Summary KPIs */}
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-[8px] text-zinc-500 font-bold uppercase">Total</p>
                    <p className={cn("text-lg font-bold", totalFlags > 0 ? "text-red-400" : "text-green-400")}>{totalFlags}</p>
                </div>
                {Object.entries(FLAG_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 text-center">
                        <p className="text-[8px] text-zinc-500 font-bold uppercase truncate">{cfg.emoji}</p>
                        <p className="text-lg font-bold text-white">{monthFlags[key] || 0}</p>
                        <p className="text-[7px] text-zinc-600 truncate">{cfg.label}</p>
                    </div>
                ))}
            </div>

            {/* Calendar */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                {/* Month Navigation */}
                <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
                    <button onClick={prev} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                    <h2 className="text-sm font-bold text-white">{monthName}</h2>
                    <button onClick={next} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-6 border-b border-zinc-800/50">
                    {DAYS.map(d => (
                        <div key={d} className="py-2 text-center text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{d}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="divide-y divide-zinc-800/30">
                    {weeks.map((wk, wi) => (
                        <div key={wi} className="grid grid-cols-6">
                            {wk.map((day, di) => {
                                if (!day) return <div key={di} className="min-h-[80px] border-r border-zinc-800/30 last:border-r-0 bg-zinc-950/30" />;

                                const ds = dateStr(day);
                                const flags = getFlags(ds);
                                const approvedHols = getApprovedHolidays(ds);
                                const indianHol = getIndianHoliday(ds);
                                const isToday = ds === now.toISOString().split("T")[0];
                                const isSelected = selectedDay === ds;
                                const isHoliday = approvedHols.length > 0 || !!indianHol;
                                const rec = myRecords.find(r => r.date === ds);

                                return (
                                    <div key={di} onClick={() => setSelectedDay(isSelected ? null : ds)}
                                        className={cn("min-h-[80px] border-r border-zinc-800/30 last:border-r-0 p-2 cursor-pointer transition-all hover:bg-zinc-800/20 relative",
                                            isToday && "bg-primary/5",
                                            isSelected && "bg-zinc-800/30 ring-1 ring-primary/30",
                                            isHoliday && "bg-green-500/5"
                                        )}>
                                        {/* Day Number */}
                                        <div className="flex justify-between items-start">
                                            <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                                                isToday ? "bg-primary text-primary-foreground" : "text-zinc-400"
                                            )}>{day}</span>
                                        </div>

                                        {/* Holiday Label */}
                                        {indianHol && <p className="text-[7px] text-green-400 font-bold truncate mt-1">{indianHol.name}</p>}
                                        {approvedHols.map(h => <p key={h.id} className="text-[7px] text-green-400 font-bold truncate">{h.name}</p>)}

                                        {/* Attendance Status */}
                                        {rec && !isHoliday && (
                                            <div className="mt-1">
                                                <p className="text-[7px] text-zinc-600 truncate">{rec.clockIn}{rec.clockOut ? ` → ${rec.clockOut}` : ""}</p>
                                            </div>
                                        )}

                                        {/* Flag Dots */}
                                        {flags.length > 0 && (
                                            <div className="flex gap-0.5 mt-1 flex-wrap">
                                                {flags.map(f => (
                                                    <div key={f} className={cn("w-2 h-2 rounded-full", FLAG_CONFIG[f]?.dotColor || "bg-zinc-500")} title={FLAG_CONFIG[f]?.label} />
                                                ))}
                                            </div>
                                        )}

                                        {/* Holiday dot */}
                                        {isHoliday && flags.length === 0 && (
                                            <div className="flex gap-0.5 mt-1">
                                                <div className="w-2 h-2 rounded-full bg-green-400" title="Holiday" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Selected Day Details */}
            {selectedDay && (
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white">{new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>

                    {getIndianHoliday(selectedDay) && <p className="text-xs text-green-400 font-bold bg-green-500/10 p-2 rounded-lg border border-green-500/20">🟢 {getIndianHoliday(selectedDay)?.name}</p>}
                    {getApprovedHolidays(selectedDay).map(h => <p key={h.id} className="text-xs text-green-400 font-bold bg-green-500/10 p-2 rounded-lg border border-green-500/20">🟢 {h.name} {h.customMessage && `— ${h.customMessage}`}</p>)}

                    {(() => {
                        const rec = myRecords.find(r => r.date === selectedDay);
                        if (!rec) return <p className="text-xs text-zinc-500 italic">No attendance record for this day.</p>;
                        const flags = Object.entries(rec.flags).filter(([_, v]) => v);
                        return (
                            <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Clock In</p><p className="text-white">{rec.clockIn}</p></div>
                                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Clock Out</p><p className="text-white">{rec.clockOut || "—"}</p></div>
                                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Location</p><p className="text-white">{rec.location}</p></div>
                                </div>
                                {flags.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase">Flags</p>
                                        <div className="flex gap-2 flex-wrap">
                                            {flags.map(([k]) => (
                                                <span key={k} className={cn("text-[9px] font-bold px-2.5 py-1 rounded-full border", FLAG_CONFIG[k]?.color)}>
                                                    {FLAG_CONFIG[k]?.emoji} {FLAG_CONFIG[k]?.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-green-400 font-bold">✓ Clean — No flags</p>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Legend */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Legend</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(FLAG_CONFIG).map(([k, cfg]) => (
                        <div key={k} className="flex items-center gap-2 text-[10px]">
                            <span className="text-zinc-400">{cfg.emoji} {cfg.label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-zinc-400">🟢 Holiday</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
