"use client";

import React, { useState, useMemo, useRef } from "react";
import {
    CalendarDays, Clock, MapPin, Download, Printer, Filter,
    CheckCircle2, Lock, Unlock, ShieldCheck, ChevronLeft, ChevronRight,
    Users, AlertCircle, Sparkles
} from "lucide-react";
import { COLLEGES } from "@/lib/colleges";

export interface SprintGridEntry {
    _id?: string;
    facultyId: string;
    facultyName: string;
    college?: string;
    location?: string;
    day: string;
    date: string;
    timeStart: string;
    timeStop: string;
    stream?: string;
    year?: string;
    semester?: string;
    section?: string;
    subjectCode?: string;
    subjectName?: string;
    topics?: string;
    isLocked?: boolean;
    isVerifiedByCL?: boolean;
    clRemarks?: string;
}

interface SprintPlanTimetableGridProps {
    entries: SprintGridEntry[];
    currentCampus?: string;
    weekRangeText?: string;
    weekDates?: { day: string; date: string }[];
    onWeekChange?: (direction: -1 | 1) => void;
    canVerify?: boolean;
    onVerifyLock?: (campus: string, isLock: boolean) => Promise<void>;
    isLocked?: boolean;
    isVerified?: boolean;
    availableCampuses?: string[];
}

// Standard academic slot columns from user reference
export const DEFAULT_TIME_SLOTS = [
    { start: "08:30", stop: "09:20", label: "8:30 To 9:20" },
    { start: "09:20", stop: "10:10", label: "9:20 To 10:10" },
    { start: "10:10", stop: "11:00", label: "10:10 To 11:00" },
    { start: "11:00", stop: "11:50", label: "11:00 To 11:50" },
    { isLunch: true, start: "11:50", stop: "12:20", label: "11:50 To 12:20\nLUNCH" },
    { start: "12:20", stop: "13:10", label: "12:20 To 13:10" },
    { start: "13:10", stop: "14:00", label: "13:10 To 14:00" },
    { start: "14:00", stop: "14:50", label: "14:00 To 14:50" }
];

const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Pastel theme colors matching the screenshot
const FACULTY_CARD_THEMES = [
    {
        bg: "bg-[#e8c4d8]/90 dark:bg-[#703b5b]/70",
        border: "border-[#caa1b8] dark:border-[#96547c]",
        text: "text-zinc-900 dark:text-pink-100",
        subtext: "text-zinc-700 dark:text-pink-200",
        badge: "bg-[#c99bb6] dark:bg-[#85456b] text-white"
    },
    {
        bg: "bg-[#fdeaa2]/90 dark:bg-[#6e5d26]/70",
        border: "border-[#e6ce78] dark:border-[#968038]",
        text: "text-zinc-900 dark:text-amber-100",
        subtext: "text-zinc-700 dark:text-amber-200",
        badge: "bg-[#d8bd58] dark:bg-[#85712e] text-white"
    },
    {
        bg: "bg-[#cce3f0]/90 dark:bg-[#2b536b]/70",
        border: "border-[#a6c8de] dark:border-[#417696]",
        text: "text-zinc-900 dark:text-sky-100",
        subtext: "text-zinc-700 dark:text-sky-200",
        badge: "bg-[#8cb8d4] dark:bg-[#346785] text-white"
    },
    {
        bg: "bg-[#d5ebd7]/90 dark:bg-[#305934]/70",
        border: "border-[#b1d4b4] dark:border-[#427a48]",
        text: "text-zinc-900 dark:text-emerald-100",
        subtext: "text-zinc-700 dark:text-emerald-200",
        badge: "bg-[#9bc29f] dark:bg-[#3b6e3f] text-white"
    }
];

export default function SprintPlanTimetableGrid({
    entries = [],
    currentCampus = "SAGE Bhopal",
    weekRangeText = "Current Academic Week",
    weekDates = [],
    onWeekChange,
    canVerify = false,
    onVerifyLock,
    isLocked = false,
    isVerified = false,
    availableCampuses = []
}: SprintPlanTimetableGridProps) {
    const tableRef = useRef<HTMLDivElement>(null);
    const [selectedCampus, setSelectedCampus] = useState<string>(currentCampus || "SAGE Bhopal");
    const [selectedStream, setSelectedStream] = useState<string>("All");
    const [selectedSemester, setSelectedSemester] = useState<string>("All");
    const [selectedSection, setSelectedSection] = useState<string>("All");
    const [actionLoading, setActionLoading] = useState(false);

    // Resolve campus list
    const campusOptions = useMemo(() => {
        const set = new Set<string>();
        if (currentCampus) set.add(currentCampus);
        COLLEGES.forEach(c => set.add(c.shortName || c.name));
        entries.forEach(e => {
            if (e.college) set.add(e.college);
            if (e.location) set.add(e.location);
        });
        availableCampuses.forEach(c => set.add(c));
        return Array.from(set).filter(Boolean);
    }, [currentCampus, entries, availableCampuses]);

    // Streams & Sections from entries
    const streams = useMemo(() => {
        const set = new Set<string>();
        entries.forEach(e => { if (e.stream) set.add(e.stream); });
        return Array.from(set);
    }, [entries]);

    const semesters = useMemo(() => {
        const set = new Set<string>();
        entries.forEach(e => { if (e.semester) set.add(e.semester); });
        return Array.from(set);
    }, [entries]);

    const sections = useMemo(() => {
        const set = new Set<string>();
        entries.forEach(e => { if (e.section) set.add(e.section); });
        return Array.from(set);
    }, [entries]);

    // Helper: Normalize campus string for matching
    const normalizeCampus = (c?: string) => (c || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Filtered entries for timetable
    const filteredEntries = useMemo(() => {
        const normSelected = normalizeCampus(selectedCampus);
        return entries.filter(e => {
            // Campus match
            const campusMatch = !selectedCampus || selectedCampus === "All" ||
                normalizeCampus(e.college).includes(normSelected) ||
                normSelected.includes(normalizeCampus(e.college)) ||
                normalizeCampus(e.location).includes(normSelected);

            if (!campusMatch && entries.length > 0) {
                // If college is not explicitly set on entry, allow if matching
                const hasAnyCampus = entries.some(x => Boolean(x.college || x.location));
                if (hasAnyCampus) return false;
            }

            if (selectedStream !== "All" && e.stream !== selectedStream) return false;
            if (selectedSemester !== "All" && e.semester !== selectedSemester) return false;
            if (selectedSection !== "All" && e.section !== selectedSection) return false;

            return true;
        });
    }, [entries, selectedCampus, selectedStream, selectedSemester, selectedSection]);

    // Unique faculties map for distinct consistent theme colors
    const facultyThemeMap = useMemo(() => {
        const map = new Map<string, number>();
        let colorIdx = 0;
        filteredEntries.forEach(e => {
            if (e.facultyName && !map.has(e.facultyName)) {
                map.set(e.facultyName, colorIdx % FACULTY_CARD_THEMES.length);
                colorIdx++;
            }
        });
        return map;
    }, [filteredEntries]);

    // Check if slot overlaps with an entry's timeStart and timeStop
    const getEntriesForSlot = (day: string, slotStart: string, slotStop: string) => {
        const slotStartMin = timeToMinutes(slotStart);
        const slotStopMin = timeToMinutes(slotStop);

        return filteredEntries.filter(e => {
            if (e.day?.toUpperCase()?.substring(0, 3) !== day.toUpperCase().substring(0, 3)) {
                return false;
            }
            const eStartMin = timeToMinutes(e.timeStart);
            const eStopMin = timeToMinutes(e.timeStop);

            // Overlap condition
            return (eStartMin < slotStopMin && eStopMin > slotStartMin);
        });
    };

    function timeToMinutes(timeStr: string) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    const handlePrint = () => {
        window.print();
    };

    const handleLockVerifyClick = async (lock: boolean) => {
        if (!onVerifyLock) return;
        setActionLoading(true);
        try {
            await onVerifyLock(selectedCampus, lock);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Top Bar / Controls */}
            <div className="bg-zinc-900/70 border border-zinc-800 backdrop-blur-xl rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                {/* Campus & Filter Selectors */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3 py-1.5">
                        <MapPin size={14} className="text-teal-400" />
                        <select
                            value={selectedCampus}
                            onChange={e => setSelectedCampus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                        >
                            {campusOptions.map(c => (
                                <option key={c} value={c} className="bg-zinc-900 text-white">{c}</option>
                            ))}
                        </select>
                    </div>

                    {streams.length > 0 && (
                        <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Stream:</span>
                            <select
                                value={selectedStream}
                                onChange={e => setSelectedStream(e.target.value)}
                                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                            >
                                <option value="All" className="bg-zinc-900 text-white">All Streams</option>
                                {streams.map(s => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
                            </select>
                        </div>
                    )}

                    {semesters.length > 0 && (
                        <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Sem:</span>
                            <select
                                value={selectedSemester}
                                onChange={e => setSelectedSemester(e.target.value)}
                                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                            >
                                <option value="All" className="bg-zinc-900 text-white">All Semesters</option>
                                {semesters.map(s => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
                            </select>
                        </div>
                    )}

                    {sections.length > 0 && (
                        <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Sec:</span>
                            <select
                                value={selectedSection}
                                onChange={e => setSelectedSection(e.target.value)}
                                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                            >
                                <option value="All" className="bg-zinc-900 text-white">All Sections</option>
                                {sections.map(sec => <option key={sec} value={sec} className="bg-zinc-900 text-white">Sec {sec}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Right Actions: Week Change, Export & Verification */}
                <div className="flex items-center gap-2">
                    {onWeekChange && (
                        <div className="flex items-center gap-1 bg-zinc-800/80 border border-zinc-700/60 rounded-xl p-1">
                            <button
                                onClick={() => onWeekChange(-1)}
                                className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                                title="Previous Week"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-2 text-[11px] font-bold text-zinc-300 whitespace-nowrap">
                                {weekRangeText}
                            </span>
                            <button
                                onClick={() => onWeekChange(1)}
                                className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                                title="Next Week"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl border border-zinc-700/60 transition-all shadow active:scale-95"
                    >
                        <Printer size={14} /> Print / PDF
                    </button>

                    {/* Curriculum Lead / Head verification & lock button */}
                    {canVerify && onVerifyLock && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleLockVerifyClick(!isLocked)}
                                disabled={actionLoading}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow active:scale-95 ${
                                    isLocked
                                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                            >
                                {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                                {isLocked ? "Unlock Sprint" : "Lock & Finalize"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Indicator Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-zinc-200">
                        Campus Timetable: <span className="text-teal-400 font-black">{selectedCampus}</span>
                    </span>
                    <span className="text-zinc-500 font-medium">
                        ({filteredEntries.length} lecture session{filteredEntries.length !== 1 ? 's' : ''} scheduled)
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {isVerified && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                            <ShieldCheck size={13} /> Curriculum Lead Verified
                        </span>
                    )}
                    {isLocked && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px] uppercase tracking-wider">
                            <Lock size={13} /> Finalized & Locked
                        </span>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* TIMETABLE GRID TABLE (EXACT VISUAL REPLICA OF USER REFERENCE IMAGE) */}
            {/* ========================================================================= */}
            <div
                ref={tableRef}
                className="overflow-x-auto rounded-2xl border-2 border-zinc-800/80 bg-white dark:bg-[#0c0d10] shadow-2xl p-0.5"
            >
                <table className="w-full border-collapse text-center select-none min-w-[1100px]">
                    <thead>
                        {/* Master Header Row 1: Orange/Gold Box Left + Title Banner Spanning Table */}
                        <tr className="border-b-2 border-zinc-800">
                            {/* Left Corner Box: "GoG <> [Campus Name]" */}
                            <th className="w-32 bg-[#ffcc66] dark:bg-[#b38600] text-zinc-950 font-black text-xs py-3 px-3 border-r-2 border-zinc-800 leading-tight">
                                <div>GoG &lt;&gt; {selectedCampus}</div>
                                <div className="text-[10px] font-bold opacity-90 mt-0.5 tracking-tight">[{weekRangeText}]</div>
                            </th>

                            {/* Main Title Banner: "Sprint Plan - [Campus Name] <> GoG : [Stream / Sem]" */}
                            <th
                                colSpan={DEFAULT_TIME_SLOTS.length}
                                className="bg-zinc-100 dark:bg-zinc-900/90 text-zinc-950 dark:text-white font-black text-base md:text-lg py-3.5 tracking-wide text-center"
                            >
                                Sprint Plan - {selectedCampus} &lt;&gt; GoG : {selectedStream !== "All" ? selectedStream : "All Branches"}
                                {selectedSemester !== "All" ? ` (${selectedSemester})` : ""}
                                {selectedSection !== "All" ? ` [Sec ${selectedSection}]` : ""}
                            </th>
                        </tr>

                        {/* Header Row 2: Day label left + Time slots along columns */}
                        <tr className="bg-[#bfe0f7] dark:bg-[#1a3852] text-zinc-950 dark:text-sky-100 font-black text-[11px] border-b-2 border-zinc-800">
                            <th className="py-2.5 px-3 border-r-2 border-zinc-800 bg-zinc-200 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-300">
                                DAY / TIME
                            </th>
                            {DEFAULT_TIME_SLOTS.map((slot, idx) => (
                                <th
                                    key={idx}
                                    className={`py-2 px-2 border-r border-zinc-300 dark:border-zinc-700/60 font-bold whitespace-pre-line leading-tight text-[11px] ${
                                        slot.isLunch
                                            ? "bg-[#fed8b1] dark:bg-[#663b14] text-zinc-950 dark:text-amber-100 w-24"
                                            : "w-36"
                                    }`}
                                >
                                    {slot.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                        {DAYS_OF_WEEK.map((dayName, dayIdx) => {
                            // Find date for this day if provided
                            const dayDateObj = weekDates.find(d => d.day?.toUpperCase().startsWith(dayName));
                            const dateLabel = dayDateObj ? dayDateObj.date.split("-").reverse().slice(0, 2).join("/") : "";

                            // Check if this day is a holiday (e.g., friday holiday in screenshot or entries note)
                            const isFridayHoliday = dayName === "FRI" && filteredEntries.filter(e => e.day === "FRI").length === 0;

                            return (
                                <tr key={dayName} className="h-28 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                                    {/* Left Row Header: Day name (MON, TUE, WED, ...) */}
                                    <td className="font-black text-xs md:text-sm py-4 px-3 border-r-2 border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                                        <div className="tracking-wider">{dayName}</div>
                                        {dateLabel && <div className="text-[10px] font-bold text-zinc-500 mt-0.5">{dateLabel}</div>}
                                    </td>

                                    {/* If entire day is marked as Holiday */}
                                    {isFridayHoliday && (
                                        <td
                                            colSpan={DEFAULT_TIME_SLOTS.length}
                                            className="bg-zinc-100/80 dark:bg-zinc-900/40 text-center font-bold text-zinc-500 italic text-sm tracking-widest border-r border-zinc-300 dark:border-zinc-800"
                                        >
                                            Holiday / Institutional Off
                                        </td>
                                    )}

                                    {!isFridayHoliday && DEFAULT_TIME_SLOTS.map((slot, sIdx) => {
                                        // Lunch cell
                                        if (slot.isLunch) {
                                            // Only render lunch span on first row or each row
                                            return (
                                                <td
                                                    key={sIdx}
                                                    className="bg-amber-100/70 dark:bg-amber-950/20 text-zinc-800 dark:text-amber-200/80 font-black text-xs border-r border-zinc-300 dark:border-zinc-800/80 text-center uppercase tracking-widest"
                                                >
                                                    LUNCH
                                                </td>
                                            );
                                        }

                                        // Regular slot: find entries that fall in this slot
                                        const slotEntries = getEntriesForSlot(dayName, slot.start, slot.stop);

                                        return (
                                            <td
                                                key={sIdx}
                                                className="p-1.5 align-middle border-r border-zinc-200 dark:border-zinc-800 relative min-w-[130px]"
                                            >
                                                {slotEntries.length === 0 ? (
                                                    <div className="h-full flex items-center justify-center text-[10px] text-zinc-300 dark:text-zinc-700 font-medium">
                                                        —
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {/* Multiple faculties at the same time in same section handling */}
                                                        {slotEntries.map((lec, lIdx) => {
                                                            const themeIdx = facultyThemeMap.get(lec.facultyName) ?? (lIdx % FACULTY_CARD_THEMES.length);
                                                            const theme = FACULTY_CARD_THEMES[themeIdx];

                                                            return (
                                                                <div
                                                                    key={lIdx}
                                                                    className={`rounded-lg p-2 text-left border shadow-sm transition-all hover:scale-[1.02] ${theme.bg} ${theme.border}`}
                                                                >
                                                                    {/* Subject / Topic */}
                                                                    <div className={`font-black text-[11px] leading-tight line-clamp-2 ${theme.text}`}>
                                                                        {lec.topics || lec.subjectName || "Academic Lecture"}
                                                                    </div>

                                                                    {/* Faculty Name */}
                                                                    <div className={`text-[10px] font-bold mt-1 flex items-center justify-between ${theme.subtext}`}>
                                                                        <span>{lec.facultyName}</span>
                                                                        {lec.section && (
                                                                            <span className="text-[9px] opacity-80">
                                                                                Sec {lec.section}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Timing tag if different from standard slot */}
                                                                    {(lec.timeStart !== slot.start || lec.timeStop !== slot.stop) && (
                                                                        <div className="text-[8px] font-semibold opacity-75 mt-0.5">
                                                                            {lec.timeStart} - {lec.timeStop}
                                                                        </div>
                                                                    )}

                                                                    {/* Multi-class badge indicator */}
                                                                    {slotEntries.length > 1 && (
                                                                        <div className="mt-1 flex items-center gap-1">
                                                                            <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${theme.badge}`}>
                                                                                Slot Share {lIdx + 1}/{slotEntries.length}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Faculty Color Legend:</span>
                    {Array.from(facultyThemeMap.entries()).map(([facName, tIdx]) => {
                        const theme = FACULTY_CARD_THEMES[tIdx];
                        return (
                            <div key={facName} className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-md border ${theme.bg} ${theme.border}`} />
                                <span className="text-xs font-bold text-zinc-300">{facName}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="text-[11px] text-zinc-500 font-medium">
                    * If multiple faculties schedule sessions in the same section slot, they are grouped and displayed side-by-side.
                </div>
            </div>
        </div>
    );
}
