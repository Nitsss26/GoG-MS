"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import {
    Clock, CheckCircle2, AlertTriangle, Building2, Calendar,
    FileText, BookOpen, Share2, Save, ExternalLink, User,
    ShieldAlert, Sparkles, Check, X
} from "lucide-react";
import Link from "next/link";
import { ClassStatusBadge } from "@/components/academic/ClassRecordDetails";
import { finalVerificationText } from "@/lib/academic-status";

const fmtAt = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** One verification stage: who and when (or "Pending") */
function StageLine({ label, v }: { label: string; v?: any }) {
    const st = v?.status || "PENDING";
    const color = st === "VERIFIED" ? "text-emerald-400" : st === "REVERTED" ? "text-red-400" : "text-zinc-500";
    return (
        <div className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-zinc-400 font-bold uppercase tracking-wider shrink-0">{label}</span>
            <span className={`text-right ${color}`}>
                {st === "VERIFIED" ? "Verified" : st === "REVERTED" ? "Reverted" : "Pending"}
                {v?.byName && <span className="block text-zinc-500">{v.byName} · {fmtAt(v.at)}</span>}
            </span>
        </div>
    );
}


export default function OMDailyLecturesPage() {
    const { user } = useAuth();
    // Only the OM records timings and notes distribution; HOI / AD / CL / CH see the same page read-only
    const canEdit = user?.role === "OM";
    const todayStr = new Date().toISOString().split("T")[0];

    // "All" = every college this user may see (the server limits it to the user's own college)
    const [campus, setCampus] = useState("All");
    const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
    const [date, setDate] = useState(todayStr);
    const [lectures, setLectures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Local edit state indexed by lecture item id
    const [editStates, setEditStates] = useState<Record<string, {
        actualInTime: string;
        actualOutTime: string;
        isLate: boolean;
        remarksWhyLate: string;
        notesShared: boolean;
        notesNotSharedRemarks: string;
        assignmentSharedInProfGroup: boolean;
    }>>({});

    useEffect(() => {
        fetchDailyLectures();
    }, [campus, date]);

    const fetchDailyLectures = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/om/lectures?campus=${encodeURIComponent(campus)}&date=${date}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load lectures");
            const list = data.lectures || [];
            setColleges(data.colleges || []);
            setLectures(list);

            // Populate initial edit states
            const initialMap: Record<string, any> = {};
            list.forEach((l: any) => {
                initialMap[l.id] = {
                    actualInTime: l.actualInTime || "",
                    actualOutTime: l.actualOutTime || "",
                    isLate: Boolean(l.isLate),
                    remarksWhyLate: l.remarksWhyLate || "",
                    notesShared: Boolean(l.lectureNotes?.isSharedWithStudents),
                    notesNotSharedRemarks: l.lectureNotes?.notSharedRemarks || "",
                    assignmentSharedInProfGroup: Boolean(l.assignment?.isSharedInProfGroup)
                };
            });
            setEditStates(initialMap);
        } catch (e) {
            console.error("Failed to load OM daily lectures", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (id: string, field: string, value: any) => {
        setEditStates((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const handleSaveRow = async (lec: any) => {
        const state = editStates[lec.id];
        if (!state) return;

        setSavingId(lec.id);
        setMessage(null);
        try {
            const res = await fetch("/api/om/lectures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reportId: lec.reportId,
                    facultyId: lec.facultyId,
                    date: lec.date,
                    lectureNumber: lec.lectureNumber,
                    courseName: lec.courseName,
                    topicsCovered: lec.topicsCovered,
                    actualInTime: state.actualInTime,
                    actualOutTime: state.actualOutTime,
                    isLate: state.isLate,
                    remarksWhyLate: state.remarksWhyLate,
                    notesShared: state.notesShared,
                    notesNotSharedRemarks: state.notesNotSharedRemarks,
                    assignmentSharedInProfGroup: state.assignmentSharedInProfGroup,
                    sprintEntryId: lec.sprintEntryId
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: `Lecture tracking updated for ${lec.facultyName}!` });
                fetchDailyLectures();
            } else {
                setMessage({ type: "error", text: data.error || "Save failed." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setSavingId(null);
        }
    };

    // Calculate pending OM assignment shares count
    const urgentSharesCount = lectures.filter((l) => l.needsOMAssignmentShare).length;

    return (
        <div className="w-full max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-6 [contain:inline-size]">
            {/* Header */}
            <div className="relative group bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                            <Clock size={24} className="text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Operations Manager &bull; Daily Lecture Tracking
                            </h1>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Log Actual Class Timings &bull; Verify Notes Shared to Students &bull; Share Approved Assignments in Prof Group
                            </p>
                            {!canEdit && (
                                <p className="text-[11px] text-sky-300 mt-2 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2.5 py-1.5 inline-block">
                                    View only — the OM records timings and notes distribution.{user?.role === "HOI" ? " Your final verification is in Class Verification." : ""}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl">
                        <Building2 size={16} className="text-amber-400 shrink-0" />
                        <select
                            value={campus}
                            onChange={(e) => setCampus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                            {[{ id: "All", name: colleges.length === 1 ? colleges[0].name : "All my colleges" }, ...(colleges.length === 1 ? [] : colleges)].map((cl) => ({ key: cl.id, label: cl.name })).map(({ key: c, label }) => (
                                <option key={c} value={c} className="bg-zinc-900 text-white">
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-xs font-bold text-white focus:outline-none"
                    />
                </div>
            </div>

            {/* Urgent Warning Banner if OM needs to share assignments */}
            {canEdit && urgentSharesCount > 0 && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 flex items-center gap-3 animate-pulse">
                    <ShieldAlert size={24} className="text-rose-400 shrink-0" />
                    <div className="flex-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">
                            Action Required: {urgentSharesCount} Assignment{urgentSharesCount > 1 ? "s" : ""} Approved by Curriculum Lead Not Yet Shared!
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Curriculum Lead has approved the assignment. Please forward/post the assignment in the Professor Group and check the tick mark below to clear the alert.
                        </p>
                    </div>
                </div>
            )}

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

            {/* Daily Lectures Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : lectures.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500">
                    <Clock size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No lectures scheduled or reported for this date.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {lectures.map((lec) => {
                        const state = editStates[lec.id] || {
                            actualInTime: "",
                            actualOutTime: "",
                            isLate: false,
                            remarksWhyLate: "",
                            notesShared: false,
                            notesNotSharedRemarks: "",
                            assignmentSharedInProfGroup: false
                        };

                        const hasAssignment = Boolean(lec.assignment?.hasAssignment);
                        const isAssignmentApproved = Boolean(lec.isAssignmentApprovedByCL);
                        const isSharedInGroup = Boolean(state.assignmentSharedInProfGroup);
                        const isBotherAlert = isAssignmentApproved && !isSharedInGroup;
                        const isGreen = lec.isGoodToGo;

                        return (
                            <div
                                key={lec.id}
                                className={`p-6 rounded-2xl border transition-all ${
                                    isBotherAlert
                                        ? "bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/20"
                                        : isGreen
                                        ? "bg-emerald-950/10 border-emerald-500/20"
                                        : "bg-zinc-900/60 border-zinc-800/80"
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                    {/* Faculty & Class Information */}
                                    <div className="space-y-2 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-base font-black text-white">{lec.facultyName}</span>
                                            <span className="text-xs text-zinc-500">&bull;</span>
                                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                                                {colleges.find(c => c.id === lec.college)?.name || lec.college}
                                            </span>
                                            <span className="text-xs text-zinc-400">
                                                Slot #{lec.lectureNumber}: <strong>{lec.timeStart} - {lec.timeStop}</strong>
                                            </span>
                                            {lec.section && (
                                                <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                                                    Sec {lec.section} ({lec.stream})
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm font-semibold text-zinc-200">
                                            {lec.courseName} &bull; <span className="text-zinc-400 font-normal">{lec.topicsCovered}</span>
                                        </p>

                                        <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0 m-0 space-y-3 disabled:opacity-60">
                                        {/* Row of quick controls for In/Out and Late */}
                                        <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                                                    Actual In Time
                                                </label>
                                                <input
                                                    type="time"
                                                    value={state.actualInTime}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        handleFieldChange(lec.id, "actualInTime", val);
                                                        // Auto mark late if actualInTime > scheduled timeStart
                                                        if (val && lec.timeStart && val > lec.timeStart) {
                                                            handleFieldChange(lec.id, "isLate", true);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                                                    Actual Out Time
                                                </label>
                                                <input
                                                    type="time"
                                                    value={state.actualOutTime}
                                                    onChange={(e) => handleFieldChange(lec.id, "actualOutTime", e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                                />
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                                        Late Status
                                                    </label>
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={state.isLate}
                                                            onChange={(e) => handleFieldChange(lec.id, "isLate", e.target.checked)}
                                                            className="w-3.5 h-3.5 text-amber-500 rounded"
                                                        />
                                                        <span className="text-[10px] font-bold text-amber-400">Class Late</span>
                                                    </label>
                                                </div>
                                                <input
                                                    type="text"
                                                    disabled={!state.isLate}
                                                    placeholder="Remarks why late..."
                                                    value={state.remarksWhyLate}
                                                    onChange={(e) => handleFieldChange(lec.id, "remarksWhyLate", e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                        </div>

                                        {/* Notes Shared to Students Verification */}
                                        <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                            <div className="flex items-center gap-2">
                                                <FileText size={15} className="text-indigo-400" />
                                                <span className="font-semibold text-zinc-300">Lecture Notes Distribution:</span>
                                                <label className="flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-800 border border-zinc-700 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={state.notesShared}
                                                        onChange={(e) => handleFieldChange(lec.id, "notesShared", e.target.checked)}
                                                        className="w-4 h-4 text-emerald-500 rounded"
                                                    />
                                                    <span className={state.notesShared ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                                                        {state.notesShared ? "Shared to Students" : "Not Yet Shared"}
                                                    </span>
                                                </label>
                                            </div>

                                            {!state.notesShared && (
                                                <input
                                                    type="text"
                                                    placeholder="Reason / Remarks if notes NOT shared..."
                                                    value={state.notesNotSharedRemarks}
                                                    onChange={(e) => handleFieldChange(lec.id, "notesNotSharedRemarks", e.target.value)}
                                                    className="sm:w-72 px-3 py-1.5 bg-zinc-800 border border-amber-500/40 rounded-xl text-xs text-amber-300 placeholder:text-zinc-500"
                                                />
                                            )}
                                        </div>

                                        {/* Assignment Section & OM Sharing in Prof Group */}
                                        {hasAssignment ? (
                                            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen size={15} className="text-pink-400" />
                                                        <span className="font-bold text-white text-xs">Assignment: {lec.assignment.title}</span>
                                                        <span className="text-xs text-zinc-400">
                                                            (Completed: <strong className="text-pink-400">{lec.assignment.studentsCompletedCount || 0}</strong> students)
                                                        </span>
                                                    </div>

                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        isAssignmentApproved
                                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                    }`}>
                                                        CL Status: {isAssignmentApproved ? "✓ Approved by CL" : "⏳ Pending CL Approval"}
                                                    </span>
                                                </div>

                                                {/* OM Tick mark for Professor Group Sharing */}
                                                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={state.assignmentSharedInProfGroup}
                                                            onChange={(e) => handleFieldChange(lec.id, "assignmentSharedInProfGroup", e.target.checked)}
                                                            className="w-4 h-4 text-emerald-500 rounded"
                                                        />
                                                        <span className="text-xs font-bold text-zinc-200">
                                                            OM Responsibility: Shared this assignment in the Professor Group
                                                        </span>
                                                    </label>

                                                    {isBotherAlert ? (
                                                        <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider animate-bounce">
                                                            ⚠️ Share Pending in Prof Group!
                                                        </span>
                                                    ) : isSharedInGroup ? (
                                                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                                                            <Check size={14} /> Shared in Group
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-zinc-500">
                                                            Pending CL verification before group share
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                        </fieldset>
                                    </div>

                                    {/* Right side: OM save button, or the verification trail for HOI / CL / CH / AD */}
                                    <div className="shrink-0 w-full lg:w-64 flex flex-col gap-3">
                                        {canEdit ? (
                                            <button
                                                onClick={() => handleSaveRow(lec)}
                                                disabled={savingId === lec.id}
                                                className="self-end flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                                            >
                                                <Save size={14} /> {savingId === lec.id ? "Saving..." : "Update Lecture"}
                                            </button>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2" data-testid="verification-trail">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Verification</span>
                                                    <ClassStatusBadge status={lec.pipelineStatus} />
                                                </div>
                                                <StageLine label="OM" v={lec.omVerification} />
                                                <StageLine label="Final (CL/CH/HOI)" v={lec.finalVerification?.status && lec.finalVerification.status !== "PENDING" ? lec.finalVerification : (lec.hoiVerification?.status === "VERIFIED" ? lec.hoiVerification : lec.clChVerification)} />
                                                {finalVerificationText(lec) && <p className="text-[11px] font-bold text-emerald-400">{finalVerificationText(lec)}</p>}
                                                <div className="pt-2 border-t border-zinc-800 space-y-1 text-[11px] text-zinc-500">
                                                    <p>Entry / exit: {lec.omTimesUpdatedByName ? <span className="text-zinc-300">{lec.omTimesUpdatedByName} · {fmtAt(lec.omTimesUpdatedAt)}</span> : "not recorded"}</p>
                                                    <p>Notes to groups: {lec.submittedToGroup ? <span className="text-emerald-400">{lec.submittedToGroupByName || "OM"}{lec.submittedToGroupAt ? ` · ${fmtAt(lec.submittedToGroupAt)}` : ""}</span> : "not yet"}</p>
                                                </div>
                                                {lec.reportId && (
                                                    <Link href={`/academic/verification?record=${lec.reportId}`}
                                                        className={`flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider ${user?.role === "HOI" && ["PENDING_CL_CH", "PENDING_HOI"].includes(lec.pipelineStatus) ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"}`}>
                                                        {user?.role === "HOI" && ["PENDING_CL_CH", "PENDING_HOI"].includes(lec.pipelineStatus) ? "Final Verify" : "Open Record"} <ExternalLink size={11} />
                                                    </Link>
                                                )}
                                            </div>
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
}
