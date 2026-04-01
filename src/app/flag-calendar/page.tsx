"use client";

import { useAuth } from "@/context/AuthContext";
import { FLAG_CONFIG, INDIAN_HOLIDAYS_2026 } from "@/lib/colleges";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, Search, X, Check, Clock, CalendarOff, Sun, UserCheck, CalendarDays, AlertTriangle, MapPin, LogIn, CheckCircle2, Edit2, RefreshCw } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Searchable Employee Combobox ───
function EmployeeCombobox({ employees, selectedId, onSelect }: { employees: any[]; selectedId: string; onSelect: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const filtered = employees.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        (e.designation || e.role)?.toLowerCase().includes(search.toLowerCase())
    );

    const selected = employees.find(e => e.id === selectedId);

    return (
        <div ref={wrapperRef} className="relative min-w-[260px]">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 block mb-1.5">Viewing Calendar For</label>
            <button
                onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
                className={cn(
                    "w-full bg-zinc-900 border rounded-xl px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-all cursor-pointer",
                    open ? "border-primary/50 ring-1 ring-primary/20" : "border-zinc-800 hover:border-zinc-700"
                )}
            >
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-primary text-[10px] font-bold uppercase shrink-0">
                    {selected?.name?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate text-[11px]">{selected?.name || "Select..."}</p>
                    <p className="text-[9px] text-zinc-500 truncate">{selected?.designation || selected?.role}</p>
                </div>
                <Search size={12} className="text-zinc-500 shrink-0" />
            </button>

            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-zinc-800/50">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                ref={inputRef}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search employee..."
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-7 pr-7 py-2 text-[11px] text-white outline-none placeholder:text-zinc-600 focus:border-primary/30"
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-6 text-center text-[10px] text-zinc-600 italic">No employees found</div>
                        ) : (
                            filtered.map(e => (
                                <button
                                    key={e.id}
                                    onClick={() => { onSelect(e.id); setOpen(false); setSearch(""); }}
                                    className={cn(
                                        "w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-all hover:bg-zinc-800/50",
                                        e.id === selectedId && "bg-primary/5"
                                    )}
                                >
                                    <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-[9px] font-bold text-zinc-400 uppercase shrink-0">
                                        {e.name?.[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-white truncate">{e.name}</p>
                                        <p className="text-[8px] text-zinc-500 truncate">{e.designation || e.role}</p>
                                    </div>
                                    {e.id === selectedId && <Check size={12} className="text-primary shrink-0" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Helper: format date as dd/mm/yyyy ───
function formatDDMMYYYY(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

export default function FlagCalendarPage() {
    const { user, attendanceRecords, holidays, employees, leaves, getReportees, updateSingleDaySchedule, colleges, getExpectedTiming } = useAuth();
    const router = useRouter();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(user?.id || "");
    
    // Schedule Override States
    const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null); // dateStr
    const [newLocation, setNewLocation] = useState("");
    const [newTime, setNewTime] = useState("09:30");
    const [newClockOutTime, setNewClockOutTime] = useState("18:30");
    const [isUpdating, setIsUpdating] = useState(false);

    if (!user) return null;

    // Hierarchy visibility logic using getReportees — sorted alphabetically
    const reportees = getReportees(user.id);
    const viewableEmployees = [user, ...reportees].sort((a, b) => {
        if (a.id === user.id) return -1; // Keep self at top
        if (b.id === user.id) return 1;
        return (a.name || "").localeCompare(b.name || "");
    });

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || user;
    const records = attendanceRecords.filter(r => r.employeeId === selectedEmployeeId);

    const isManager = ["HOI", "AD", "HR", "FOUNDER"].includes(user.role);
    const isViewingReportee = selectedEmployeeId !== user.id;

    // Helper for today's time check
    const currentTimeIST = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const isBeforeCutoff = currentTimeIST < "11:59";

    // Build calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDow = firstDay.getDay();

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(7).fill(null);
    let dayNum = 1;

    for (let i = startDow; i < 7 && dayNum <= daysInMonth; i++) { week[i] = dayNum; dayNum++; }
    weeks.push(week);
    while (dayNum <= daysInMonth) {
        week = new Array(7).fill(null);
        for (let i = 0; i < 7 && dayNum <= daysInMonth; i++) { week[i] = dayNum; dayNum++; }
        weeks.push(week);
    }

    const dateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const getApprovedHolidays = (d: string) => holidays.filter(h => h.date === d && h.status === "Approved");
    const getIndianHoliday = (d: string) => INDIAN_HOLIDAYS_2026.find(h => h.date === d);
    const getLeaveStatus = (d: string) => leaves?.find(l => l.employeeId === selectedEmployeeId && l.status === "Approved" && d >= l.startDate && d <= l.endDate);

    const getFlags = (d: string) => {
        const rec = records.find(r => r.date === d);
        let activeFlags = rec ? Object.entries(rec.flags).filter(([_, v]) => v).map(([k]) => k) : [];

        const dateObj = new Date(d);
        const isSunday = dateObj.getDay() === 0;
        const isHoliday = getApprovedHolidays(d).length > 0 || !!getIndianHoliday(d);
        const isOnLeave = !!getLeaveStatus(d);
        const isWorkingDay = !isSunday && !isHoliday && !isOnLeave;
        const isPastMar17 = d >= "2026-03-17";
        const isPastToday = d > now.toISOString().split("T")[0];

        if (!rec && isWorkingDay && isPastMar17 && !isPastToday) {
            activeFlags.push("absent");
        }
        return activeFlags;
    };

    // ─── Monthly KPI Calculations ───
    const monthlyKPIs = useMemo(() => {
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;
        let holidayDays = 0;
        let sundayDays = 0;
        const flagCounts: Record<string, number> = {};
        Object.keys(FLAG_CONFIG).forEach(k => flagCounts[k] = 0);

        for (let i = 1; i <= daysInMonth; i++) {
            const ds = dateStr(i);
            const dateObj = new Date(year, month, i);
            const isSunday = dateObj.getDay() === 0;
            const isHoliday = getApprovedHolidays(ds).length > 0 || !!getIndianHoliday(ds);
            const leaveMatch = getLeaveStatus(ds);
            const rec = records.find(r => r.date === ds);
            const flags = getFlags(ds);

            if (isSunday) { sundayDays++; continue; }
            if (isHoliday) { holidayDays++; continue; }
            if (leaveMatch && !rec) { leaveDays++; continue; }
            if (rec && rec.status !== "Absent") { presentDays++; }

            flags.filter(f => f !== "absent").forEach(f => { flagCounts[f] = (flagCounts[f] || 0) + 1; });
            if (flags.includes("absent")) { absentDays++; }
        }

        const totalFlags = Object.values(flagCounts).reduce((a, b) => a + b, 0);
        return { presentDays, absentDays, leaveDays, holidayDays, sundayDays, flagCounts, totalFlags };
    }, [selectedEmployeeId, month, year, records, holidays, leaves]);

    const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); setSelectedDay(null); };
    const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); setSelectedDay(null); };

    const monthName = new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto w-full">
            {/* ─── Header ─── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Attendance Intelligence</p>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
                        <Flag size={18} className="text-primary" /> Flag Calendar
                    </h1>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        Comprehensive monthly view of attendance, flags, leaves & holidays for <span className="text-white font-bold">{selectedEmployee?.name || "—"}</span>
                    </p>
                </div>

                {viewableEmployees.length > 1 && (
                    <EmployeeCombobox
                        employees={viewableEmployees}
                        selectedId={selectedEmployeeId}
                        onSelect={(id) => { setSelectedEmployeeId(id); setSelectedDay(null); }}
                    />
                )}
            </header>

            {/* ─── Expanded Summary KPIs ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* Present */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3.5 group hover:border-green-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <UserCheck size={13} className="text-green-400" />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Present</p>
                    </div>
                    <p className="text-xl font-black text-green-400">{monthlyKPIs.presentDays}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">Working days attended</p>
                </div>

                {/* Absent */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3.5 group hover:border-red-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <CalendarOff size={13} className="text-red-400" />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Absent</p>
                    </div>
                    <p className={cn("text-xl font-black", monthlyKPIs.absentDays > 0 ? "text-red-400" : "text-zinc-600")}>{monthlyKPIs.absentDays}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">No clock-in recorded</p>
                </div>

                {/* On Leave */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3.5 group hover:border-pink-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center">
                            <CalendarDays size={13} className="text-pink-400" />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">On Leave</p>
                    </div>
                    <p className="text-xl font-black text-pink-400">{monthlyKPIs.leaveDays}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">Approved leave days</p>
                </div>

                {/* Holidays */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3.5 group hover:border-purple-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Sun size={13} className="text-purple-400" />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Holidays</p>
                    </div>
                    <p className="text-xl font-black text-purple-400">{monthlyKPIs.holidayDays}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">Includes national & approved</p>
                </div>

                {/* Total Flags */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3.5 group hover:border-amber-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Flag size={13} className="text-amber-400" />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Total Flags</p>
                    </div>
                    <p className={cn("text-xl font-black", monthlyKPIs.totalFlags > 0 ? "text-amber-400" : "text-zinc-600")}>{monthlyKPIs.totalFlags}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">Disciplinary incidents</p>
                </div>

                {/* Sundays */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3.5 group hover:border-blue-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <CalendarDays size={13} className="text-blue-400" />
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Sundays</p>
                    </div>
                    <p className="text-xl font-black text-blue-400">{monthlyKPIs.sundayDays}</p>
                    <p className="text-[8px] text-zinc-600 mt-0.5">Weekly off days</p>
                </div>
            </div>

            {/* ─── Flag Breakdown Pills ─── */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Flag Breakdown — {monthName}</p>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {Object.entries(FLAG_CONFIG).filter(([key]) => key !== "absent").map(([key, cfg]) => {
                        const count = monthlyKPIs.flagCounts[key] || 0;
                        return (
                            <div key={key} className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold transition-all whitespace-nowrap shrink-0",
                                count > 0 ? cfg.color : "text-zinc-600 bg-zinc-800/30 border-zinc-800/50"
                            )}>
                                <span>{cfg.emoji}</span>
                                <span>{cfg.label}</span>
                                <span className={cn(
                                    "ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",
                                    count > 0 ? "bg-white/10" : "bg-zinc-800"
                                )}>{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Calendar ─── */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                {/* Month Navigation */}
                <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
                    <button onClick={prev} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                    <div className="text-center">
                        <h2 className="text-sm font-bold text-white">{monthName}</h2>
                        <p className="text-[9px] text-zinc-500 mt-0.5">{selectedEmployee?.name} · {(selectedEmployee as any)?.designation || selectedEmployee?.role}</p>
                    </div>
                    <button onClick={next} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-zinc-800/50">
                    {DAYS.map((d, i) => (
                        <div key={d} className={cn(
                            "py-2.5 text-center text-[9px] font-bold uppercase tracking-widest",
                            i === 0 ? "text-blue-400/60" : "text-zinc-500"
                        )}>{d}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="divide-y divide-zinc-800/30">
                    {weeks.map((wk, wi) => (
                        <div key={wi} className="grid grid-cols-7">
                            {wk.map((day, di) => {
                                if (!day) return <div key={di} className="min-h-[100px] border-r border-zinc-800/30 last:border-r-0 bg-zinc-950/30" />;

                                const ds = dateStr(day);
                                const flags = getFlags(ds);
                                const approvedHols = getApprovedHolidays(ds);
                                const indianHol = getIndianHoliday(ds);
                                const isToday = ds === now.toISOString().split("T")[0];
                                const isSelected = selectedDay === ds;
                                const isHoliday = approvedHols.length > 0 || !!indianHol;
                                const isSunday = di === 0;
                                const rec = records.find(r => r.date === ds);
                                const leaveMatch = getLeaveStatus(ds);
                                const isFuture = ds > now.toISOString().split("T")[0];

                                const holidayName = indianHol?.name || approvedHols[0]?.name || "";

                                return (
                                    <div key={di} onClick={() => setSelectedDay(isSelected ? null : ds)}
                                        className={cn(
                                            "min-h-[100px] border-r border-zinc-800/30 last:border-r-0 p-1.5 cursor-pointer transition-all hover:bg-zinc-800/20 relative flex flex-col",
                                            isToday && "bg-primary/[0.04] ring-1 ring-inset ring-primary/20",
                                            isSelected && "bg-zinc-800/30 ring-1 ring-inset ring-primary/40",
                                            isSunday && !isHoliday && "bg-blue-500/[0.04]"
                                        )}>
                                        {/* Day Number */}
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn(
                                                "text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                                                isToday ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" :
                                                isSunday ? "text-blue-400/70" : "text-zinc-400"
                                            )}>{day}</span>
                                            {isToday && <span className="text-[6px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-wider">Today</span>}
                                        </div>

                                        {/* ─── Status Pills ─── */}
                                        <div className="flex flex-col gap-[3px] flex-1">
                                            {/* Holiday Pill */}
                                            {isHoliday && (
                                                <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-purple-500/10 border border-purple-500/15">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                                    <span className="text-[7px] font-bold text-purple-400 truncate leading-tight">{holidayName || "Holiday"}</span>
                                                </div>
                                            )}

                                            {/* Sunday label (if not holiday) */}
                                            {isSunday && !isHoliday && (
                                                <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-blue-500/10 border border-blue-500/15">
                                                    <span className="text-[7px] font-bold text-blue-400 truncate">Sunday</span>
                                                </div>
                                            )}

                                            {/* Leave Pill */}
                                            {(rec?.status === "On Leave" || (leaveMatch && !rec)) && (
                                                <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-pink-500/10 border border-pink-500/15">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
                                                    <span className="text-[7px] font-bold text-pink-400 truncate leading-tight">On Leave</span>
                                                </div>
                                            )}

                                            {/* Present Pill with clock times */}
                                            {rec && rec.status !== "On Leave" && rec.status !== "Absent" && !isHoliday && (
                                                <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-green-500/10 border border-green-500/15">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                                                    <span className="text-[7px] font-bold text-green-400 truncate leading-tight">
                                                        {rec.clockIn ? `${rec.clockIn}` : "Present"}{rec.clockOut ? ` → ${rec.clockOut}` : ""}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Absent Pill */}
                                            {flags.includes("absent") && (
                                                <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-red-500/10 border border-red-500/15">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                    <span className="text-[7px] font-bold text-red-400 truncate leading-tight">Absent</span>
                                                </div>
                                            )}

                                            {/* Individual Flag Pills */}
                                            {flags.filter(f => f !== "absent").map(f => (
                                                <div key={f} className={cn(
                                                    "flex items-center gap-1 px-1.5 py-[3px] rounded-md border",
                                                    FLAG_CONFIG[f]?.color || "text-zinc-500 bg-zinc-800/30 border-zinc-700/30"
                                                )}>
                                                    <span className="text-[7px] leading-none">{FLAG_CONFIG[f]?.emoji}</span>
                                                    <span className="text-[7px] font-bold truncate leading-tight">{FLAG_CONFIG[f]?.label}</span>
                                                </div>
                                            ))}

                                            {/* Future day (no data yet) */}
                                            {isFuture && !isHoliday && !isSunday && (
                                                <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-zinc-800/20 border border-zinc-800/30">
                                                    <span className="text-[7px] text-zinc-600 italic truncate">Upcoming</span>
                                                </div>
                                            )}

                                            {/* ─── Actions ─── */}
                                            <div className="mt-auto pt-2 space-y-1">
                                                {/* Clock-In / Mark as Present for Today */}
                                                {isToday && !rec?.clockIn && !isHoliday && !isSunday && selectedEmployeeId === user.id && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isBeforeCutoff) router.push('/attendance');
                                                            else router.push(`/attendance?action=map&date=${ds}`);
                                                        }}
                                                        className={cn(
                                                            "flex items-center justify-center gap-1 w-full py-1 text-[7px] font-bold rounded transition-all active:scale-95",
                                                            isBeforeCutoff 
                                                                ? "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20" 
                                                                : "bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20"
                                                        )}
                                                    >
                                                        {isBeforeCutoff ? <LogIn size={8} /> : <CheckCircle2 size={8} />}
                                                        {isBeforeCutoff ? "Clock-In" : "Mark as Present"}
                                                    </button>
                                                )}

                                                {/* Mark as Present for Absent Days */}
                                                {flags.includes("absent") && !isToday && selectedEmployeeId === user.id && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/attendance?action=map&date=${ds}`);
                                                        }}
                                                        className="flex items-center justify-center gap-1 w-full py-1 text-[7px] font-bold rounded bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 transition-all active:scale-95"
                                                    >
                                                        <CheckCircle2 size={8} />
                                                        Mark as Present
                                                    </button>
                                                )}

                                                {/* Schedule Override Button (Managers Only) */}
                                                {isManager && isViewingReportee && (isFuture || (isToday && !rec?.clockIn)) && !isHoliday && !isSunday && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const current = getExpectedTiming(selectedEmployeeId, ds);
                                                            setNewLocation(current.location);
                                                            setNewTime(current.in);
                                                            setNewClockOutTime(current.out);
                                                            setShowScheduleModal(ds);
                                                        }}
                                                        className="flex items-center justify-center gap-1 w-full py-1 text-[7px] font-bold rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all active:scale-95"
                                                    >
                                                        <Clock size={8} />
                                                        Change Schedule
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Schedule Override Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden scale-in-95 animate-in duration-200">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-primary/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Clock className="text-primary" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">Modify Schedule</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{formatDDMMYYYY(showScheduleModal)}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowScheduleModal(null)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                                <X size={18} className="text-zinc-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2 ml-1">Work Location</label>
                                <div className="max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                                    <div className="grid grid-cols-1 gap-2">
                                        {[...colleges, { id: "WFH", name: "Work From Home" }].map(loc => (
                                            <button
                                                key={loc.id}
                                                onClick={() => setNewLocation(loc.id)}
                                                className={cn(
                                                    "px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all text-left flex items-center gap-2",
                                                    newLocation === loc.id 
                                                        ? "bg-primary/10 border-primary/40 text-primary" 
                                                        : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600"
                                                )}
                                            >
                                                <MapPin size={12} className={newLocation === loc.id ? "text-primary" : "text-zinc-500"} />
                                                <span>{loc.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2 ml-1">Arrival Time</label>
                                            <input 
                                                type="time" 
                                                value={newTime}
                                                onChange={e => setNewTime(e.target.value)}
                                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2 ml-1">Clock Out</label>
                                            <input 
                                                type="time" 
                                                value={newClockOutTime}
                                                onChange={e => setNewClockOutTime(e.target.value)}
                                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            setIsUpdating(true);
                                            await updateSingleDaySchedule(selectedEmployeeId, showScheduleModal, newLocation, newTime, newClockOutTime);
                                            setIsUpdating(false);
                                    setShowScheduleModal(null);
                                }}
                                disabled={isUpdating}
                                className="w-full bg-primary text-black font-black text-xs py-4 rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {isUpdating ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                                {isUpdating ? "UPDATING..." : "CONFIRM OVERRIDE"}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ─── Selected Day Details ─── */}
            {selectedDay && (
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    {/* Detail Header */}
                    <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white">
                                {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" })} · {formatDDMMYYYY(selectedDay)}
                            </h3>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{selectedEmployee?.name} · Day Details</p>
                        </div>
                        <button onClick={() => setSelectedDay(null)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Holiday pills */}
                        {getIndianHoliday(selectedDay) && (
                            <div className="flex items-center gap-2.5 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                                    <Sun size={14} className="text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-purple-400">{getIndianHoliday(selectedDay)?.name}</p>
                                    <p className="text-[9px] text-purple-300/60">National / Festival Holiday</p>
                                </div>
                            </div>
                        )}
                        {getApprovedHolidays(selectedDay).map(h => (
                            <div key={h.id} className="flex items-center gap-2.5 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                                    <Sun size={14} className="text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-purple-400">{h.name}</p>
                                    {h.customMessage && <p className="text-[9px] text-purple-300/60">{h.customMessage}</p>}
                                </div>
                            </div>
                        ))}

                        {(() => {
                            const rec = records.find(r => r.date === selectedDay);
                            const leave = getLeaveStatus(selectedDay);
                            const flagsRaw = getFlags(selectedDay);

                            if (!rec && !leave) {
                                if (flagsRaw.includes("absent")) {
                                    return (
                                        <div className="flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                                                <CalendarOff size={14} className="text-red-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-red-400">Absent</p>
                                                <p className="text-[9px] text-red-300/60">No clock-in record found for this working day</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <p className="text-xs text-zinc-500 italic px-1">No attendance record for this day.</p>
                                );
                            }

                            if (leave && !rec) {
                                return (
                                    <div className="flex items-center gap-2.5 p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                                        <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0">
                                            <CalendarDays size={14} className="text-pink-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-pink-400">On Leave</p>
                                            <p className="text-[9px] text-pink-300/60">{leave.reason || "Approved leave"}</p>
                                        </div>
                                    </div>
                                );
                            }

                            // Full attendance record
                            const recFlags = Object.entries(rec!.flags).filter(([_, v]) => v).map(([k]) => k);
                            return (
                                <div className="space-y-4">
                                    {/* Clock Data Cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-xl p-3">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Clock size={10} className="text-green-400" />
                                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Clock In</p>
                                            </div>
                                            <p className="text-sm font-bold text-white">{rec!.clockIn}</p>
                                        </div>
                                        <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-xl p-3">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Clock size={10} className="text-amber-400" />
                                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Clock Out</p>
                                            </div>
                                            <p className="text-sm font-bold text-white">{rec!.clockOut || "—"}</p>
                                        </div>
                                        <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-xl p-3">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <MapPin size={10} className="text-blue-400" />
                                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Location</p>
                                            </div>
                                            <p className="text-sm font-bold text-white">{rec!.location}</p>
                                        </div>
                                    </div>

                                    {/* Flag pills */}
                                    {recFlags.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Active Flags</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {recFlags.map((k) => (
                                                    <span key={k} className={cn("text-[10px] font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5", FLAG_CONFIG[k]?.color)}>
                                                        <span>{FLAG_CONFIG[k]?.emoji}</span> {FLAG_CONFIG[k]?.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                                            <Check size={14} className="text-green-400" />
                                            <p className="text-xs text-green-400 font-bold">Clean Record — No flags raised</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ─── Legend ─── */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Legend</p>
                <div className="flex flex-wrap gap-2">
                    {/* Status pills */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/15 text-[9px] font-bold text-green-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Present
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/15 text-[9px] font-bold text-red-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Absent
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/15 text-[9px] font-bold text-pink-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-400" /> On Leave
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/15 text-[9px] font-bold text-purple-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Holiday
                    </div>
                    {/* Separator */}
                    <div className="w-px h-5 bg-zinc-800 mx-1 self-center" />
                    {/* Flag pills */}
                    {Object.entries(FLAG_CONFIG).filter(([k]) => k !== "absent").map(([k, cfg]) => (
                        <div key={k} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold", cfg.color)}>
                            <span>{cfg.emoji}</span> {cfg.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
