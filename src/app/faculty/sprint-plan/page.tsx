"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useRef } from "react";
import DynamicCollegeTimetable from "@/components/academic/DynamicCollegeTimetable";
import { motion, AnimatePresence } from "framer-motion";
import {
    CalendarDays, Plus, Trash2, Lock, Unlock, Save, AlertTriangle,
    Clock, BookOpen, ArrowLeft, ArrowRight, Check, X, Send, Settings, Edit2, Copy,
    Download
} from "lucide-react";
import TimePicker from "@/components/ui/TimePicker";
import Link from "next/link";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { validateSprintEntries, isValidTimeFormat } from "@/lib/time-utils";
import SprintPlanWorkflowPanel from "@/components/academic/SprintPlanWorkflowPanel";
import { getPlanStatus, LOCKED_PLAN_STATUSES, LECTURE_TYPES, UNIT_NUMBERS } from "@/lib/academic-status";

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
    section: string;
    // Weekly plan details (stream = Branch)
    lectureType?: string;
    unitNumber?: string;
    content?: string;
    className?: string;
    _id?: string;
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
    status?: string;
    isVerifiedByCL?: boolean;
    history?: any[];
    revisions?: any[];
    version?: number;
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
/** Class name built from the slot details, e.g. "Full Stack Web Development 1A" (stream + year number + section) */
const autoClassName = (e: { stream?: string; year?: string; section?: string }) => {
    const yr = (String(e.year || "").match(/\d+/) || [""])[0];
    const sec = String(e.section || "").trim().toUpperCase();
    return [String(e.stream || "").trim(), yr || sec ? `${yr}${sec}` : ""].filter(Boolean).join(" ");
};
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
    const [workSchedules, setWorkSchedules] = useState<any[]>([]); // Added for daily location
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [invalidIndices, setInvalidIndices] = useState<number[]>([]);
    const [copying, setCopying] = useState(false);
    const [activeTimePicker, setActiveTimePicker] = useState<{ idx: number; field: "timeStart" | "timeStop" } | null>(null);
    const [viewMode, setViewMode] = useState<"GRID" | "EDITOR">("GRID");
    const [allCampusEntries, setAllCampusEntries] = useState<any[]>([]);

    // Dynamic Dropdowns
    const [facultySubjects, setFacultySubjects] = useState<Record<string, string>>(SUBJECTS);
    const [facultyStreams, setFacultyStreams] = useState<string[]>(STREAMS);
    const [showPrefModal, setShowPrefModal] = useState(false);
    const [prefTab, setPrefTab] = useState<"SUBJECTS" | "STREAMS">("SUBJECTS");
    const [newSubject, setNewSubject] = useState({ code: "", name: "" });
    const [newStream, setNewStream] = useState("");

    const weekInfo = getWeekDates(weekOffset);
    // Lifecycle: a locked plan (or one waiting for an unlock decision) cannot be edited by anyone
    const planStatus = plan ? getPlanStatus(plan) : "DRAFT";
    const isFrozen = LOCKED_PLAN_STATUSES.includes(planStatus);
    const [submitting, setSubmitting] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    // bumps the college timetable after a save / lock / unlock so it reloads at once
    const [ttRefresh, setTtRefresh] = useState(0);

    // Open a specific week from a link (?week=YYYY-MM-DD), e.g. from a notification email
    useEffect(() => {
        try {
            const w = new URLSearchParams(window.location.search).get("week");
            if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(w)) return;
            const base = new Date(getWeekDates(0).start + "T00:00:00Z").getTime();
            const target = new Date(w + "T00:00:00Z");
            const dow = target.getUTCDay();
            target.setUTCDate(target.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
            setWeekOffset(Math.round((target.getTime() - base) / (7 * 86400000)));
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (user?.id) {
            fetchPlan();
            fetchPreferences();
        }
    }, [user, weekOffset]);

    const fetchPreferences = async () => {
        try {
            const res = await fetch(`/api/faculty/preferences?facultyId=${user?.id}`);
            const data = await res.json();
            if (data.subjects?.length > 0) {
                const subObj: Record<string, string> = {};
                data.subjects.forEach((s: any) => subObj[s.code] = s.name);
                setFacultySubjects(subObj);
            }
            if (data.streams?.length > 0) {
                setFacultyStreams(data.streams);
            }
        } catch (e) {
            console.error("Failed to fetch preferences", e);
        }
    };

    const savePreferences = async (updatedSubjects: Record<string, string>, updatedStreams: string[]) => {
        try {
            const subjectList = Object.entries(updatedSubjects).map(([code, name]) => ({ code, name }));
            await fetch("/api/faculty/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ facultyId: user?.id, subjects: subjectList, streams: updatedStreams })
            });
            setFacultySubjects(updatedSubjects);
            setFacultyStreams(updatedStreams);
        } catch (e) {
            console.error("Failed to save preferences", e);
        }
    };

    // Only the latest request may update the page (week / date can change while a request is running)
    const latestRequest = useRef(0);
    const fetchPlan = async () => {
        const requestNo = ++latestRequest.current;
        setLoading(true);
        try {
            const res = await fetch(`/api/faculty/sprint-plan?facultyId=${user?.id}&weekStartDate=${weekInfo.start}`);
            const data = await res.json();
            if (requestNo !== latestRequest.current) return;

            // New structure: { plans, schedules }
            const fetchedPlans = data.plans || [];
            const fetchedSchedules = data.schedules || [];

            setWorkSchedules(fetchedSchedules);

            if (fetchedPlans.length > 0) {
                const fetchedPlan = fetchedPlans[0];
                setPlan(fetchedPlan);
                setEntries(fetchedPlan.entries || []);
            } else {
                setPlan(null);
                setEntries([]);
            }

            try {
                const campusRes = await fetch(`/api/curriculum/sprint-plan?weekStartDate=${weekInfo.start}`);
                const campusData = await campusRes.json();
                if (campusData.allEntries) {
                    setAllCampusEntries(campusData.allEntries);
                }
            } catch (err) {
                console.error("Failed to fetch campus entries", err);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (requestNo === latestRequest.current) setLoading(false);
        }
    };

    const displayGridEntries = useMemo(() => {
        if (allCampusEntries.length > 0) return allCampusEntries;
        return entries.map(e => ({
            ...e,
            facultyId: user?.id || "",
            facultyName: user?.name || "Professor",
            college: plan?.college || user?.location || "Main Campus",
            location: plan?.college || user?.location || "Main Campus",
            isLocked: isFrozen,
            isVerifiedByCL: plan?.isVerifiedByCL
        }));
    }, [allCampusEntries, entries, user, plan]);

    const copyFromPreviousWeek = async () => {
        setCopying(true);
        setMessage(null);
        try {
            const prevStart = new Date(weekInfo.start);
            prevStart.setDate(prevStart.getDate() - 7);
            const prevStartStr = prevStart.getFullYear() + "-" +
                (prevStart.getMonth() + 1).toString().padStart(2, '0') + "-" +
                prevStart.getDate().toString().padStart(2, '0');

            const res = await fetch(`/api/faculty/sprint-plan?facultyId=${user?.id}&weekStartDate=${prevStartStr}`);
            const data = await res.json();

            // Note: Updated to handle results correctly based on the API response structure { plans, schedules }
            if (data.plans && data.plans.length > 0) {
                const prevPlan = data.plans[0];
                if (!prevPlan.entries || prevPlan.entries.length === 0) {
                    setMessage({ type: "error", text: "Previous week's plan has no entries." });
                    return;
                }

                // Map entries to current week corresponding dates
                const mappedEntries = prevPlan.entries.map((e: SprintEntry) => {
                    const currentDateForDay = weekInfo.dates.find(d => d.day === e.day)?.date;
                    return { ...e, _id: undefined, date: currentDateForDay || e.date };
                });

                // Append to current entries (user can save later)
                setEntries([...entries, ...mappedEntries]);
                setMessage({ type: "success", text: `Successfully copied ${mappedEntries.length} entries from previous week.` });
            } else {
                setMessage({ type: "error", text: "No sprint plan found for the previous week." });
            }
        } catch (e: any) {
            setMessage({ type: "error", text: "Failed to copy plan: " + e.message });
        } finally {
            setCopying(false);
        }
    };

    const addEntry = (day: string, date: string) => {
        setEntries([...entries, {
            day, date,
            timeStart: "09:20",
            timeStop: "10:10",
            stream: facultyStreams[0] || STREAMS[0],
            year: YEARS[0],
            semester: SEMESTERS[0],
            subjectCode: "",
            subjectName: "",
            topics: "",
            section: "",
            lectureType: LECTURE_TYPES[0],
            unitNumber: "1",
            content: "",
            className: autoClassName({ stream: facultyStreams[0] || STREAMS[0], year: YEARS[0], section: "" })
        }]);
    };

    const updateEntry = (idx: number, field: keyof SprintEntry, value: string) => {
        const updated = [...entries];
        const newEntry = { ...updated[idx], [field]: value };

        // Auto-update subject name if code changes
        if (field === "subjectCode" && facultySubjects[value]) {
            newEntry.subjectName = facultySubjects[value];
        }
        // Class is mapped automatically from stream, year and section
        if (field === "stream" || field === "year" || field === "section") {
            newEntry.className = autoClassName(newEntry);
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
        setInvalidIndices([]);

        // Validation
        const validation = validateSprintEntries(entries);
        if (!validation.valid) {
            setMessage({ type: "error", text: validation.error || "Validation failed" });
            setInvalidIndices(validation.invalidIndices || []);
            setSaving(false);
            return;
        }

        try {
            const res = await fetch("/api/faculty/sprint-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId: user?.id,
                    weekStartDate: weekInfo.start,
                    weekEndDate: weekInfo.end,
                    entries: entries.map(e => ({ ...e, className: autoClassName(e) }))
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: data.message || "Sprint plan saved successfully!" });
                setPlan(data.plan);
                setEntries(data.plan?.entries || entries);
                setTtRefresh(k => k + 1);
                return data.plan;
            } else {
                setMessage({ type: "error", text: data.error || "Failed to save" });
                if (data.invalidIndices) setInvalidIndices(data.invalidIndices);
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setSaving(false);
        }
    };

    // Save the entries, then lock the week yourself: "Finalize & Lock" (first time) / "Save & Re-Lock" (after unlocking)
    const submitWeek = async () => {
        if (entries.length === 0) {
            setMessage({ type: "error", text: "Add the classes of the week before locking." });
            return;
        }
        const missing = entries.findIndex(e => !e.subjectName || !e.topics);
        if (missing >= 0) {
            setMessage({ type: "error", text: `Class ${missing + 1} (${entries[missing].day}) needs a Subject and a Topic before locking.` });
            setInvalidIndices([missing]);
            return;
        }
        setSubmitting(true);
        try {
            const saved = await savePlan();
            if (!saved?._id) return;
            const res = await fetch("/api/sprint-plan/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: saved._id, action: "self_lock" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Locking failed");
            setPlan(data.plan);
            setEntries(data.plan?.entries || entries);
            setTtRefresh(k => k + 1);
            setMessage({ type: "success", text: data.message });
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    // Unlock your own locked plan straight away (HOI and CL / CH are informed)
    const unlockPlan = async () => {
        if (!plan?._id) return;
        setUnlocking(true);
        setMessage(null);
        try {
            const res = await fetch("/api/sprint-plan/action", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan._id, action: "self_unlock" })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Unlock failed");
            setPlan(data.plan);
            setEntries(data.plan?.entries || entries);
            setTtRefresh(k => k + 1);
            setMessage({ type: "success", text: data.message });
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setUnlocking(false);
        }
    };

    const exportToPDF = () => {
        if (entries.length === 0) {
            setMessage({ type: "error", text: "No entries to export. Please add slots to your plan." });
            return;
        }

        const doc = new jsPDF();
        const fullWeekRange = `${formatDateDMY(weekInfo.start)} to ${formatDateDMY(weekInfo.end)}`;

        // Header with premium aesthetics
        doc.setFillColor(15, 15, 20); // Deep dark background
        doc.rect(0, 0, 210, 45, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text("GEEKS OF GURUKUL", 15, 22);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(161, 161, 170); // zinc-400
        doc.text("OFFICIAL ACADEMIC SPRINT & TEACHING SCHEDULE", 15, 30);

        doc.setDrawColor(63, 63, 70); // zinc-700
        doc.setLineWidth(0.5);
        doc.line(15, 35, 195, 35);

        // Branding Accents
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.rect(15, 12, 2, 12, 'F');

        // Faculty Info Section
        doc.setTextColor(24, 24, 27); // zinc-950
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("PLAN METADATA", 15, 55);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(82, 82, 91); // zinc-500
        doc.text(`Faculty Name:`, 15, 62);
        doc.text(`Week Range:`, 15, 68);
        doc.text(`Primary College:`, 15, 74);
        doc.text(`Doc Status:`, 110, 62);
        doc.text(`Generated At:`, 110, 68);

        doc.setTextColor(24, 24, 27);
        doc.setFont("helvetica", "bold");
        doc.text(`${user?.name?.toUpperCase() || "N/A"}`, 45, 62);
        doc.text(`${fullWeekRange}`, 45, 68);
        doc.text(`${plan?.college || "Global HQ"}`, 45, 74);
        doc.text(`${isFrozen ? "FINALIZED & LOCKED" : "ACTIVE DRAFT"}`, 140, 62);
        doc.text(`${new Date().toLocaleString()}`, 140, 68);

        const tableData: any[] = [];
        weekInfo.dates.forEach(({ day, date }) => {
            const dayEntries = entries.filter(e => e.date === date || e.day === day)
                .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

            // Find location for this day
            const sch = workSchedules.find(s =>
                s.date === date ||
                s.date?.toUpperCase() === day?.toUpperCase() ||
                s.date?.toLowerCase() === day?.toLowerCase() ||
                (s.date && date && s.date.replace(/[-\/]/g, '') === date.replace(/[-\/]/g, ''))
            );
            const locationStr = sch?.location || "Not Assigned";

            if (dayEntries.length === 0) return;

            dayEntries.forEach((entry, idx) => {
                tableData.push([
                    idx === 0 ? `${day}\n(${formatDateDMY(date)})` : "",
                    idx === 0 ? locationStr : "",
                    `${entry.timeStart} - ${entry.timeStop}`,
                    entry.subjectName,
                    entry.topics || "Module Discussion",
                    `${entry.stream}\n(${entry.year})`,
                    entry.section || "—"
                ]);
            });
        });

        autoTable(doc, {
            startY: 85,
            head: [['Day / Date', 'Campus Loc', 'Time Slot', 'Subject', 'Topic / Module', 'Stream / Year', 'Sec']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [39, 39, 42], // zinc-800
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 25 },
                1: { cellWidth: 25, textColor: [16, 185, 129], fontStyle: 'bold' }, // Emerald color for location
                2: { cellWidth: 28, halign: 'center' },
                3: { fontStyle: 'bold', cellWidth: 32 },
                4: { fontStyle: 'italic', cellWidth: 50 },
                5: { cellWidth: 30, halign: 'center' },
                6: { cellWidth: 10, halign: 'center' }
            },
            styles: {
                fontSize: 8,
                cellPadding: 4,
                lineColor: [228, 228, 231], // zinc-200
                lineWidth: 0.1,
                valign: 'middle'
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            },
            margin: { top: 85 },
            didDrawPage: (data) => {
                const str = `Page ${data.pageNumber}`;
                doc.setFontSize(8);
                doc.setTextColor(161, 161, 170);
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                doc.text(str, 15, pageHeight - 10);
                doc.text("GoG IMS • Automated Sprint Verification Report", 135, pageHeight - 10);
            }
        });

        doc.save(`SprintPlan_${user?.name || 'Faculty'}_${weekInfo.start}.pdf`);
    };

    if (!user || !["FACULTY", "PROFESSOR", "MARKETING_TEAM", "TECH_TEAM"].includes(user.role)) {
        return <div className="flex items-center justify-center h-[80vh] text-zinc-400">Access restricted to Faculty/Professors & Specific Teams</div>;
    }

    return (
        <div className="w-full max-w-7xl mx-auto pt-8 pb-10 px-4 sm:px-6 space-y-6 [contain:inline-size]">
            {/* Header */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 sm:p-7 flex flex-col gap-4 shadow-2xl">
                    {/* Row 1: title + week navigation */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                            <CalendarDays size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight">
                                Sprint Management
                            </h1>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1 italic">Teaching Schedule</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setWeekOffset(prev => prev - 1)}
                            className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all hover:scale-110 active:scale-95">
                            <ArrowLeft size={16} />
                        </button>
                        <div className="px-4 py-3 bg-zinc-800/80 border border-zinc-700/50 rounded-xl shrink-0">
                            <span className="text-xs font-black text-white tabular-nums tracking-widest uppercase whitespace-nowrap">
                                {formatDateDMY(weekInfo.start)} <span className="text-zinc-600 font-bold mx-2">/</span> {formatDateDMY(weekInfo.end)}
                            </span>
                        </div>
                        <button onClick={() => setWeekOffset(prev => prev + 1)}
                            className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all hover:scale-110 active:scale-95">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                    </div>
                    {/* Row 2: dropdown settings and copy */}
                    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-800/70">
                        <button
                            onClick={() => { setPrefTab("SUBJECTS"); setShowPrefModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-500/10 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={14} /> Add Courses
                        </button>
                        <button
                            onClick={() => { setPrefTab("STREAMS"); setShowPrefModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/10 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={14} /> Add Streams
                        </button>
                        {/* <button
                            onClick={exportToPDF}
                            disabled={entries.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Download size={14} /> Download Plan
                        </button> */}
                        {!isFrozen && (
                            <button
                                onClick={copyFromPreviousWeek}
                                disabled={copying}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-amber-500/10 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                            >
                                <Copy size={14} /> {copying ? "Copying..." : "Copy Previous Week"}
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* Status Bar — lifecycle, history and Request Unlock */}
            {plan?._id && (
                <div className="flex flex-col gap-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-6 py-4 shadow-lg">
                    <SprintPlanWorkflowPanel plan={plan} mode="professor" onChanged={(p, msg) => { setPlan(p); setEntries(p?.entries || entries); setTtRefresh(k => k + 1); setMessage({ type: "success", text: msg }); }} />
                    <span className="text-xs text-zinc-400 font-medium" data-testid="plan-status-text">
                        {planStatus === "DRAFT" && "Draft — complete the week, review it and press \"Finalize & Lock\". No approval is needed; HOI is informed."}
                        {(planStatus === "SUBMITTED" || planStatus === "RESUBMITTED") && "Submitted earlier — you can now lock it yourself with \"Finalize & Lock\"."}
                        {planStatus === "UNLOCKED_FOR_REVISION" && "Unlocked for Editing — add, change or remove classes (past classes of this week too), then press \"Save & Re-Lock\". HOI and CL / CH get the list of changes."}
                        {["LOCKED", "LOCKED_AGAIN"].includes(planStatus) && <>{planStatus === "LOCKED_AGAIN" ? "Updated & Re-Locked" : "Locked"}{plan.lockedAt ? ` (since ${new Date(plan.lockedAt).toString() === "Invalid Date" ? plan.lockedAt : new Date(plan.lockedAt).toLocaleString("en-IN")})` : ""}. To change it, press <span className="text-orange-400 font-bold">Unlock Sprint Plan</span>.</>}
                        {planStatus === "UNLOCK_REQUESTED" && "Locked — an older unlock request is open. You can unlock the plan yourself with \"Unlock Sprint Plan\"."}
                    </span>
                </div>
            )}

            {message && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" :
                    "bg-red-500/10 border border-red-500/20 text-red-400"
                    }`}>
                    {message.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
                    <span className="text-xs font-medium">{message.text}</span>
                </div>
            )}

            {/* View Mode Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800 shadow-lg">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setViewMode("GRID")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            viewMode === "GRID"
                                ? "bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/20"
                                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        }`}
                    >
                        <CalendarDays size={14} /> My Timetable
                    </button>
                    <button
                        onClick={() => setViewMode("EDITOR")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            viewMode === "EDITOR"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                        }`}
                    >
                        <Edit2 size={14} /> Day-by-Day Slot Editor
                    </button>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium px-3 hidden sm:block">
                    {viewMode === "GRID" ? "Your classes · real class timings" : "Customize your individual teaching slots"}
                </div>
            </div>

            {/* Weekly Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : viewMode === "GRID" ? (
                <div className="[contain:inline-size]">
                    <DynamicCollegeTimetable weekStart={weekInfo.start} weekDates={weekInfo.dates} currentUserId={user?.id} refreshKey={ttRefresh} mineOnly />
                </div>
            ) : (
                <div className="space-y-4">
                    <datalist id="sprint-class-names">
                        {Array.from(new Set(entries.map(e => e.className).filter(Boolean))).map(c => <option key={c} value={c as string} />)}
                    </datalist>
                    <p className="text-[10px] text-zinc-500 px-1">Each class: Time From–Till · Subject · Topic · Branch · Section · Year / Semester, then Lecture Type · Unit. Class is filled automatically from Branch, Year and Section.</p>
                    {weekInfo.dates.map(({ day, date }) => {
                        const dayEntries = entries.filter(e => e.date === date || e.day === day);
                        // A calm accent per weekday: coloured day chip, tinted header, accent bar
                        const DAY_THEME: Record<string, { name: string; chip: string; header: string; border: string; add: string; slot: string; slotChip: string }> = {
                            MON: { name: "Monday", chip: "bg-sky-500/15 text-sky-300 border-sky-500/30", header: "from-sky-500/10", border: "border-l-sky-400", add: "text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/20", slot: "border-sky-500/25 bg-sky-500/[0.04]", slotChip: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
                            TUE: { name: "Tuesday", chip: "bg-teal-500/15 text-teal-300 border-teal-500/30", header: "from-teal-500/10", border: "border-l-teal-400", add: "text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/20", slot: "border-teal-500/25 bg-teal-500/[0.04]", slotChip: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
                            WED: { name: "Wednesday", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", header: "from-amber-500/10", border: "border-l-amber-400", add: "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20", slot: "border-amber-500/25 bg-amber-500/[0.04]", slotChip: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
                            THU: { name: "Thursday", chip: "bg-violet-500/15 text-violet-300 border-violet-500/30", header: "from-violet-500/10", border: "border-l-violet-400", add: "text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20", slot: "border-violet-500/25 bg-violet-500/[0.04]", slotChip: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
                            FRI: { name: "Friday", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30", header: "from-rose-500/10", border: "border-l-rose-400", add: "text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20", slot: "border-rose-500/25 bg-rose-500/[0.04]", slotChip: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
                            SAT: { name: "Saturday", chip: "bg-orange-500/15 text-orange-300 border-orange-500/30", header: "from-orange-500/10", border: "border-l-orange-400", add: "text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20", slot: "border-orange-500/25 bg-orange-500/[0.04]", slotChip: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
                        };
                        const theme = DAY_THEME[day] || DAY_THEME.MON;

                        return (
                            <div key={date} className={`rounded-xl bg-zinc-900/50 border border-zinc-800 border-l-4 ${theme.border} overflow-hidden`}>
                                <div className={`flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-gradient-to-r ${theme.header} to-transparent border-b border-zinc-800/60`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg border tracking-[0.2em] ${theme.chip}`}>{day}</span>
                                        <span className="text-sm font-bold text-white">{theme.name}</span>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{formatDateDMY(date)}</span>
                                        {dayEntries.length > 0 && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/70 px-2 py-0.5 rounded-md">{dayEntries.length} class{dayEntries.length > 1 ? "es" : ""}</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {/* Daily Location Tag — Positioned to the left of Add Slot button */}
                                        {(() => {
                                            // Robust matching: Check date, then uppercase/lowercase weekday strings
                                            const sch = workSchedules.find(s =>
                                                s.date === date ||
                                                s.date?.toUpperCase() === day?.toUpperCase() ||
                                                s.date?.toLowerCase() === day?.toLowerCase() ||
                                                (s.date && date && s.date.replace(/[-\/]/g, '') === date.replace(/[-\/]/g, ''))
                                            );

                                            if (!sch) return (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/20 border border-zinc-800/50 rounded-lg opacity-40">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">No Location</span>
                                                </div>
                                            );

                                            return (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/50 rounded-lg shadow-sm group-hover:border-emerald-500/30 transition-all">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                                                        {sch.location}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {!isFrozen && (
                                            <button onClick={() => addEntry(day, date)}
                                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-xl transition-all border active:scale-95 uppercase tracking-widest whitespace-nowrap ${theme.add}`}>
                                                <Plus size={14} /> Add Slot
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {dayEntries.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-xs text-zinc-600">No lectures scheduled</div>
                                ) : (
                                    <div className="p-3 space-y-3">
                                        {entries.map((entry, idx) => {
                                            if (entry.date !== date && entry.day !== day) return null;
                                            const slotNo = entries.slice(0, idx + 1).filter(x => x.date === date || x.day === day).length;
                                            return (
                                                <div key={idx} className={`rounded-xl border ${theme.slot} px-3 sm:px-4 pt-2.5 pb-3 space-y-2 shadow-sm shadow-black/30`} data-testid="plan-entry">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${theme.slotChip}`}>Slot {slotNo}</span>
                                                    <span className="text-[10px] text-zinc-500 tabular-nums">{entry.timeStart || "--:--"} – {entry.timeStop || "--:--"}</span>
                                                </div>
                                                <div className="grid grid-cols-12 gap-2 items-start [&>*]:min-w-0">
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex gap-1 items-center">
                                                        <button 
                                                            onClick={() => setActiveTimePicker({ idx, field: "timeStart" })}
                                                            disabled={isFrozen}
                                                            className={`flex-1 px-2 py-1.5 bg-zinc-800 border ${invalidIndices.includes(idx) ? 'border-red-500 animate-pulse' : 'border-zinc-700'} rounded text-[11px] text-white text-center focus:border-violet-500 hover:border-zinc-600 transition-colors disabled:opacity-50`}
                                                        >
                                                            {entry.timeStart || "09:20"}
                                                        </button>
                                                        <span className="text-zinc-600 font-bold">-</span>
                                                        <button 
                                                            onClick={() => setActiveTimePicker({ idx, field: "timeStop" })}
                                                            disabled={isFrozen}
                                                            className={`flex-1 px-2 py-1.5 bg-zinc-800 border ${invalidIndices.includes(idx) ? 'border-red-500 animate-pulse' : 'border-zinc-700'} rounded text-[11px] text-white text-center focus:border-violet-500 hover:border-zinc-600 transition-colors disabled:opacity-50`}
                                                        >
                                                            {entry.timeStop || "10:10"}
                                                        </button>
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col gap-1 relative">
                                                        <select value={entry.subjectCode} onChange={e => {
                                                            const code = e.target.value;
                                                            updateEntry(idx, "subjectCode", code);
                                                        }}
                                                            disabled={isFrozen}
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 font-medium appearance-none">
                                                            <option value="">-- Select Subject --</option>
                                                            {Object.entries(facultySubjects).map(([code, name]) => (
                                                                <option key={code} value={code}>{name}</option>
                                                            ))}
                                                        </select>
                                                        {!isFrozen && (
                                                            <button
                                                                onClick={() => { setPrefTab("SUBJECTS"); setShowPrefModal(true); }}
                                                                className="absolute right-2 top-2 text-zinc-500 hover:text-indigo-400 p-0.5">
                                                                <Settings size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-2">
                                                        <input value={entry.topics} onChange={e => updateEntry(idx, "topics", e.target.value)}
                                                            disabled={isFrozen} placeholder="Topic" title="Topic"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50" />
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-2 relative group-item">
                                                        <select value={entry.stream} onChange={e => updateEntry(idx, "stream", e.target.value)}
                                                            disabled={isFrozen} title="Branch / Stream"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 appearance-none">
                                                            {facultyStreams.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                        {!isFrozen && (
                                                            <button
                                                                onClick={() => { setPrefTab("STREAMS"); setShowPrefModal(true); }}
                                                                className="absolute right-2 top-2 text-zinc-500 hover:text-emerald-400 p-0.5">
                                                                <Edit2 size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-1">
                                                        <input value={entry.section} onChange={e => updateEntry(idx, "section", e.target.value)}
                                                            disabled={isFrozen} placeholder="Section"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50" />
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-1">
                                                        <div className="flex gap-1">
                                                            <select value={entry.year} onChange={e => updateEntry(idx, "year", e.target.value)}
                                                                disabled={isFrozen}
                                                                className="flex-1 px-1 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                            </select>
                                                            <select value={entry.semester} onChange={e => updateEntry(idx, "semester", e.target.value)}
                                                                disabled={isFrozen}
                                                                className="flex-1 px-1 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            {!isFrozen && (
                                                                <button onClick={() => removeEntry(idx)} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors shrink-0">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Lecture details: type, unit, class (automatic) */}
                                                <div className="grid grid-cols-12 gap-2 items-start [&>*]:min-w-0">
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-2">
                                                        <select value={entry.lectureType || ""} onChange={e => updateEntry(idx, "lectureType", e.target.value)}
                                                            disabled={isFrozen} title="Lecture Type"
                                                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                            <option value="">-- Lecture Type --</option>
                                                            {LECTURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-6 lg:col-span-1">
                                                        <select value={entry.unitNumber || ""} onChange={e => updateEntry(idx, "unitNumber", e.target.value)}
                                                            disabled={isFrozen} title="Unit Number"
                                                            className="w-full px-1 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50">
                                                            <option value="">Unit</option>
                                                            {UNIT_NUMBERS.map(u => <option key={u} value={u}>Unit {u}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-12 lg:col-span-9">
                                                        <div className="w-full px-2 py-1.5 bg-zinc-900/60 border border-dashed border-zinc-700 rounded text-[10px] text-zinc-300 truncate" title="Class (filled automatically from Stream, Year and Section)" data-testid="plan-class-auto">
                                                            <span className="text-zinc-500">Class:</span> <span className="font-semibold text-white">{autoClassName(entry) || "—"}</span>
                                                        </div>
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
            <div className="flex flex-wrap gap-3 sticky bottom-6 z-20 bg-zinc-950/80 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-zinc-800/80 shadow-2xl">
                {!isFrozen ? (
                    <>
                        <button onClick={savePlan} disabled={saving || submitting}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-indigo-500/10 active:scale-95 disabled:opacity-50">
                            <Save size={16} /> {saving ? "Synchronizing..." : planStatus === "DRAFT" || planStatus === "UNLOCKED_FOR_REVISION" ? "Save Draft" : "Save Changes"}
                        </button>
                        <button onClick={submitWeek} disabled={saving || submitting || entries.length === 0} data-testid="submit-week"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-500/10 active:scale-95 disabled:opacity-50">
                            <Lock size={16} /> {submitting ? "Locking..." : planStatus === "UNLOCKED_FOR_REVISION" ? "Save & Re-Lock" : "Finalize & Lock"}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-amber-500/5 text-amber-400 text-xs font-black uppercase tracking-wider rounded-2xl border border-amber-500/20">
                            <Lock size={16} /> {planStatus === "LOCKED_AGAIN" ? "Updated & Re-Locked" : "Plan locked"}
                        </div>
                        <button onClick={unlockPlan} disabled={unlocking} data-testid="unlock-plan"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 text-xs font-black uppercase tracking-wider rounded-2xl border border-orange-500/30 transition-all active:scale-95 disabled:opacity-50">
                            <Unlock size={16} /> {unlocking ? "Unlocking..." : "Unlock Sprint Plan"}
                        </button>
                    </>
                )}
            </div>

            {/* Preference Management Modal */}
            {showPrefModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                    <Settings size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white italic tracking-tight">MANAGE DROPDOWNS</h2>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dynamic Teaching Parameters</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPrefModal(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                                <X size={20} className="text-zinc-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-2xl mb-6">
                                <button
                                    onClick={() => setPrefTab("SUBJECTS")}
                                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all tracking-wider ${prefTab === "SUBJECTS" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:text-white"}`}
                                >
                                    SUBJECTS
                                </button>
                                <button
                                    onClick={() => setPrefTab("STREAMS")}
                                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all tracking-wider ${prefTab === "STREAMS" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-white"}`}
                                >
                                    COURSES / STREAMS
                                </button>
                            </div>

                            {prefTab === "SUBJECTS" ? (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            value={newSubject.code}
                                            onChange={e => setNewSubject(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                            placeholder="CODE (e.g. CS101)"
                                            className="w-1/3 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                                        />
                                        <input
                                            value={newSubject.name}
                                            onChange={e => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Subject Name"
                                            className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                if (!newSubject.code || !newSubject.name) return;
                                                const updated = { ...facultySubjects, [newSubject.code]: newSubject.name };
                                                setFacultySubjects(updated);
                                                savePreferences(updated, facultyStreams);
                                                setNewSubject({ code: "", name: "" });
                                            }}
                                            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all active:scale-95"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                        {Object.entries(facultySubjects).map(([code, name]) => (
                                            <div key={code} className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800/50 rounded-xl group/item">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">{code}</span>
                                                    <span className="text-xs font-medium text-zinc-300">{name}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const updated = { ...facultySubjects };
                                                        delete updated[code];
                                                        setFacultySubjects(updated);
                                                        savePreferences(updated, facultyStreams);
                                                    }}
                                                    className="p-1.5 opacity-0 group-hover/item:opacity-100 hover:text-red-400 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            value={newStream}
                                            onChange={e => setNewStream(e.target.value)}
                                            placeholder="Course/Stream Name (e.g. Computer Science)"
                                            className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                if (!newStream) return;
                                                const updated = [...facultyStreams, newStream];
                                                setFacultyStreams(updated);
                                                savePreferences(facultySubjects, updated);
                                                setNewStream("");
                                            }}
                                            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition-all active:scale-95"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                                        {facultyStreams.map((s, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800/50 rounded-xl group/item">
                                                <span className="text-xs font-medium text-zinc-300">{s}</span>
                                                <button
                                                    onClick={() => {
                                                        const updated = facultyStreams.filter((_, i) => i !== idx);
                                                        setFacultyStreams(updated);
                                                        savePreferences(facultySubjects, updated);
                                                    }}
                                                    className="p-1.5 opacity-0 group-hover/item:opacity-100 hover:text-red-400 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* CUSTOM CLOCK-STYLE TIME PICKER */}
            <AnimatePresence>
                {activeTimePicker && (
                    <TimePicker
                        value={entries[activeTimePicker.idx]?.[activeTimePicker.field] || (activeTimePicker.field === "timeStart" ? "09:20" : "10:10")}
                        onChange={(time) => {
                            updateEntry(activeTimePicker.idx, activeTimePicker.field, time);
                            setActiveTimePicker(null);
                        }}
                        onClose={() => setActiveTimePicker(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}