"use client";

import { useState, useEffect } from "react";
import SprintPlanWorkflowPanel from "@/components/academic/SprintPlanWorkflowPanel";
import { getPlanStatus } from "@/lib/academic-status";
import {
    CalendarDays, Lock, Clock, BookOpen, ArrowLeft, ArrowRight,
    Check, AlertTriangle, ShieldCheck, CheckCircle2, Download
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

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
    const [workSchedules, setWorkSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const getWeekDates = (offset = 0) => {
        const now = new Date();
        const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const ist = new Date(istStr);
        const dayOfWeek = ist.getDay();

        // Find current week's Monday (Associated Monday for Sun-Sat week)
        const diffToCurrentMon = dayOfWeek === 0 ? 1 : (1 - dayOfWeek);
        const mon = new Date(ist);
        mon.setDate(ist.getDate() + diffToCurrentMon + (offset * 7));

        const formatDate = (d: Date) => d.getFullYear() + "-" +
            (d.getMonth() + 1).toString().padStart(2, '0') + "-" +
            d.getDate().toString().padStart(2, '0');

        const dates: { day: string; date: string }[] = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            dates.push({ day: DAYS[i], date: formatDate(d) });
        }

        const sun = new Date(mon);
        sun.setDate(mon.getDate() - 1);
        const sat = new Date(mon);
        sat.setDate(mon.getDate() + 5);

        return {
            start: dates[0].date,
            end: dates[5].date,
            dates,
            displayRange: `${formatDateDMY(formatDate(sun))} to ${formatDateDMY(formatDate(sat))}`
        };
    };

    const weekInfo = getWeekDates(weekOffset);

    useEffect(() => {
        if (facultyId) {
            fetchPlan();
        }
    }, [facultyId, weekOffset]);

    const fetchPlan = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/faculty/sprint-plan?facultyId=${facultyId}&weekStartDate=${weekInfo.start}`);
            const data = await res.json();
            if (!res.ok) {
                setPlan(null);
                setMessage({ type: "error", text: data.error || "Could not load the sprint plan." });
                return;
            }

            setWorkSchedules(data.schedules || []);

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

    const exportToPDF = () => {
        if (!plan || !plan.entries || plan.entries.length === 0) return;
        const doc = new jsPDF();
        const fullWeekRange = weekInfo.displayRange;

        // Header with brand alignment
        doc.setFillColor(15, 15, 20);
        doc.rect(0, 0, 210, 45, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text("GEEKS OF GURUKUL", 15, 22);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(161, 161, 170);
        doc.text("OFFICIAL ACADEMIC SPRINT & TEACHING SCHEDULE", 15, 30);

        doc.setDrawColor(63, 63, 70);
        doc.setLineWidth(0.5);
        doc.line(15, 35, 195, 35);

        // Branding Accents
        doc.setFillColor(79, 70, 229);
        doc.rect(15, 12, 2, 12, 'F');

        // Monitoring Metadata
        doc.setTextColor(24, 24, 27);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("MONITORING ARCHIVE", 15, 55);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(82, 82, 91);
        doc.text(`Faculty Name:`, 15, 62);
        doc.text(`Week Range:`, 15, 68);
        doc.text(`Campus/College:`, 15, 74);
        doc.text(`Doc Status:`, 115, 62);
        doc.text(`Exported By:`, 115, 68);

        doc.setTextColor(24, 24, 27);
        doc.setFont("helvetica", "bold");
        doc.text(`${facultyName.toUpperCase()}`, 45, 62);
        doc.text(`${fullWeekRange}`, 45, 68);
        doc.text(`${plan.college || "Global HQ"}`, 45, 74);
        doc.text(`${plan.isLocked ? "FINALIZED & LOCKED" : "ACTIVE DRAFT"}`, 145, 62);
        doc.text(`HOI / Academic Manager`, 145, 68);

        const tableData: any[] = [];
        weekInfo.dates.forEach(({ day, date }) => {
            const dayEntries = (plan.entries || []).filter((e: any) => e.date === date || e.day === day)
                .sort((a: any, b: any) => a.timeStart.localeCompare(b.timeStart));

            if (dayEntries.length === 0) return;

            // Matching Logic for Location
            const sch = workSchedules.find(s =>
                s.date === date ||
                s.date?.toUpperCase() === day?.toUpperCase() ||
                s.date?.toLowerCase() === day?.toLowerCase() ||
                (s.date && date && s.date.replace(/[-\/]/g, '') === date.replace(/[-\/]/g, ''))
            );
            const locationStr = sch?.location || "Not Assigned";

            dayEntries.forEach((entry: any, idx: number) => {
                tableData.push([
                    idx === 0 ? `${day}\n(${formatDateDMY(date)})` : "",
                    idx === 0 ? locationStr : "",
                    `${entry.timeStart} - ${entry.timeStop}`,
                    entry.subjectName,
                    entry.topics || "Discussion & Practice",
                    `${entry.stream} / ${entry.year}`,
                    entry.section || "—"
                ]);
            });
        });

        autoTable(doc, {
            startY: 85,
            head: [['Day / Date', 'Campus Loc', 'Time Slot', 'Subject', 'Topic / Module', 'Stream/Year', 'Sec']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [39, 39, 42],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 25 },
                1: { cellWidth: 25, textColor: [16, 185, 129], fontStyle: 'bold' },
                2: { cellWidth: 28, halign: 'center' },
                3: { fontStyle: 'bold', cellWidth: 32 },
                4: { fontStyle: 'italic', cellWidth: 50 },
                5: { cellWidth: 30, halign: 'center' },
                6: { cellWidth: 10, halign: 'center' }
            },
            styles: {
                fontSize: 8,
                cellPadding: 4,
                lineColor: [228, 228, 231],
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
                doc.setTextColor(150, 150, 150);
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                doc.text(str, 15, pageHeight - 10);
                doc.text("GoG IMS • Academic Performance Monitoring", 135, pageHeight - 10);
            }
        });

        doc.save(`SprintPlan_${facultyName}_${weekInfo.start}.pdf`);
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
                            {weekInfo.displayRange}
                        </span>
                    </div>
                    <button onClick={() => setWeekOffset(prev => prev + 1)}
                        className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/50 transition-all active:scale-95">
                        <ArrowRight size={16} />
                    </button>
                </div>

                {/* <div className="flex items-center gap-3">
                    <button 
                        onClick={() => exportToPDF()}
                        disabled={!plan || loading}
                        className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-30 inline-flex items-center gap-2"
                    >
                        <Download size={14} />
                        Download Schedule
                    </button>
                </div> */}
            </div>

            {message && (
                <div className={cn(
                    "flex items-center gap-4 px-6 py-4 rounded-2xl text-xs font-bold animate-in slide-in-from-top-4 duration-300",
                    message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                )}>
                    {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (!plan || getPlanStatus(plan) === "DRAFT") ? (
                <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-3xl p-16 text-center shadow-inner relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative z-10 space-y-4">
                        <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-700/50 shadow-2xl transition-transform group-hover:scale-110">
                            <BookOpen size={32} className="text-zinc-600" />
                        </div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-widest">Grid Not Initialized</h3>
                        <p className="text-xs text-zinc-500 font-bold max-w-xs mx-auto mb-6">{plan ? "The professor is still preparing this plan (Draft). It appears here once it is submitted." : "The faculty has not yet established an academic archive for this temporal range."}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Lifecycle: lock / unlock / unlock requests (HOI, CL, CH, AD of this college) */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 shadow-xl">
                        <SprintPlanWorkflowPanel plan={plan} mode="reviewer"
                            onChanged={(p, msg) => { setPlan(p); setMessage({ type: "success", text: msg }); }} />
                        {!plan.canManage && <p className="text-[10px] text-zinc-500 mt-2">You can view this plan. Locking / unlocking is done by HOI, CL, CH or AD of the professor&apos;s college.</p>}
                    </div>

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
                                            <div key={idx} className="px-5 py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center">
                                                <div className="md:col-span-2 flex items-center gap-2">
                                                    <Clock size={12} className="text-indigo-400" />
                                                    <span className="text-[10px] font-black text-white tabular-nums">{entry.timeStart} – {entry.timeStop}</span>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-[10px] font-black text-white uppercase tracking-tight line-clamp-1">{entry.subjectName}</div>
                                                    <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{entry.subjectCode}</div>
                                                </div>
                                                <div className="md:col-span-4">
                                                    <div className="text-[10px] text-zinc-400 font-medium italic line-clamp-1">{entry.topics || "No topics listed"}</div>
                                                    {(entry.lectureType || entry.unitNumber || entry.className || entry.section) && (
                                                        <div className="text-[9px] text-zinc-500 mt-0.5">{[entry.lectureType, entry.unitNumber ? `Unit ${entry.unitNumber}` : "", entry.className, entry.section ? `Sec ${entry.section}` : ""].filter(Boolean).join(" · ")}</div>
                                                    )}
                                                    {entry.content && <div className="text-[9px] text-zinc-500 mt-0.5 line-clamp-2">{entry.content}</div>}
                                                </div>
                                                <div className="md:col-span-3 flex justify-start md:justify-end">
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
