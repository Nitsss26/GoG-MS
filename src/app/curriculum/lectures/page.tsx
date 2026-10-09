"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import {
    Video, FileText, CheckCircle2, XCircle, AlertTriangle,
    Clock, ExternalLink, MessageSquare, Check, X, ShieldCheck,
    Search, Filter, Building2, User, BookOpen, Layers
} from "lucide-react";

const CAMPUSES = [
    "ALL",
    "SAGE Bhopal",
    "MANIT Bhopal",
    "LNCT Bhopal",
    "Oriental Bhopal",
    "RKDF Bhopal",
    "SIRT Bhopal",
    "Global HQ"
];

export default function CurriculumLecturesPage() {
    const { user } = useAuth();
    const [lectures, setLectures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCampus, setSelectedCampus] = useState("ALL");
    const [selectedDate, setSelectedDate] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedLecture, setSelectedLecture] = useState<any | null>(null);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form states for CL Review
    const [notesStatus, setNotesStatus] = useState<"VERIFIED" | "NEEDS_REVISION">("VERIFIED");
    const [notesRemarks, setNotesRemarks] = useState("");
    const [assignmentStatus, setAssignmentStatus] = useState<"VERIFIED" | "NEEDS_REVISION">("VERIFIED");
    const [assignmentRemarks, setAssignmentRemarks] = useState("");
    const [overallRemarks, setOverallRemarks] = useState("");

    useEffect(() => {
        fetchLectures();
    }, [selectedCampus, selectedDate]);

    const fetchLectures = async () => {
        setLoading(true);
        try {
            let url = `/api/curriculum/lectures?`;
            if (selectedCampus !== "ALL") url += `campus=${encodeURIComponent(selectedCampus)}&`;
            if (selectedDate) url += `date=${selectedDate}&`;
            const res = await fetch(url);
            const data = await res.json();
            setLectures(data.lectures || []);
        } catch (e) {
            console.error("Failed to fetch lectures", e);
        } finally {
            setLoading(false);
        }
    };

    const openReviewModal = (lec: any) => {
        setSelectedLecture(lec);
        setNotesStatus(lec.lectureNotes?.verificationStatus === "NEEDS_REVISION" ? "NEEDS_REVISION" : "VERIFIED");
        setNotesRemarks(lec.lectureNotes?.leadRemarks || "");
        setAssignmentStatus(lec.assignment?.verificationStatus === "NEEDS_REVISION" ? "NEEDS_REVISION" : "VERIFIED");
        setAssignmentRemarks(lec.assignment?.leadRemarks || "");
        setOverallRemarks(lec.clRemarks || "");
        setReviewModalOpen(true);
    };

    const submitReview = async (overallAction: "VERIFY_GOOD_TO_GO" | "REQUEST_REVISION") => {
        if (!selectedLecture) return;
        setActionLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/curriculum/lectures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lectureId: selectedLecture._id,
                    action: overallAction,
                    clRemarks: overallRemarks,
                    notesStatus,
                    notesRemarks,
                    assignmentStatus,
                    assignmentRemarks
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({
                    type: "success",
                    text: overallAction === "VERIFY_GOOD_TO_GO"
                        ? "Lecture verified and marked Good to Go (Green)!"
                        : "Revisions requested for this lecture."
                });
                setReviewModalOpen(false);
                fetchLectures();
            } else {
                setMessage({ type: "error", text: data.error || "Review submission failed." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const filteredLectures = lectures.filter((l) => {
        if (statusFilter === "VERIFIED" && l.clVerificationStatus !== "VERIFIED") return false;
        if (statusFilter === "PENDING" && l.clVerificationStatus === "VERIFIED") return false;
        if (statusFilter === "NEEDS_REVISION" && l.clVerificationStatus !== "NEEDS_REVISION") return false;
        if (statusFilter === "WITH_ASSIGNMENT" && !l.assignment?.hasAssignment) return false;
        return true;
    });

    const isAuthorized = user?.role === "CURRICULUM_HEAD" || user?.role === "CURRICULUM_LEAD" || (user?.role as string) === "SUPERADMIN";

    return (
        <div className="max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-6">
            {/* Header */}
            <div className="relative group bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <Video size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Campus Lecture Quality & Verification Hub
                            </h1>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Inspect Recordings &bull; Validate Notes & Assignments &bull; Authorize &ldquo;Good to Go&rdquo; (Green)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl">
                        <Building2 size={16} className="text-emerald-400 shrink-0" />
                        <select
                            value={selectedCampus}
                            onChange={(e) => setSelectedCampus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                            {CAMPUSES.map((c) => (
                                <option key={c} value={c} className="bg-zinc-900 text-white">
                                    {c === "ALL" ? "All Campuses" : c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-xs font-bold text-white focus:outline-none"
                    />

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-xs font-bold text-white focus:outline-none"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending Review</option>
                        <option value="VERIFIED">Verified (Green)</option>
                        <option value="NEEDS_REVISION">Needs Revision</option>
                        <option value="WITH_ASSIGNMENT">Has Assignment</option>
                    </select>
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

            {/* Lecture Reports Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filteredLectures.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500">
                    <Video size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No lecture reports found for the selected criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredLectures.map((lec) => {
                        const isVerified = lec.clVerificationStatus === "VERIFIED";
                        const isRevision = lec.clVerificationStatus === "NEEDS_REVISION";
                        const hasAssignment = !!lec.assignment?.hasAssignment;

                        return (
                            <div
                                key={lec._id}
                                className={`p-6 rounded-2xl border transition-all ${
                                    isVerified
                                        ? "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50"
                                        : isRevision
                                        ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50"
                                        : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700"
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-base font-black text-white">{lec.facultyName}</span>
                                            <span className="text-xs text-zinc-500">&bull;</span>
                                            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                                                {lec.college || "Campus"}
                                            </span>
                                            <span className="text-xs text-zinc-400">
                                                {lec.date} ({lec.timeSlot})
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                isVerified
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                                                    : isRevision
                                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                                            }`}>
                                                {isVerified ? "✓ Good to Go (Verified)" : isRevision ? "⚠ Revision Requested" : "⏳ Pending CL Check"}
                                            </span>
                                        </div>

                                        <p className="text-sm font-semibold text-zinc-200">
                                            {lec.subject} &bull; <span className="text-zinc-400 font-normal">{lec.topicsCovered}</span>
                                        </p>

                                        {/* OM Timings & Late info */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-1">
                                            <span>Students: <strong className="text-white">{lec.attendanceCount || 0}</strong></span>
                                            {lec.actualInTime && (
                                                <span>Actual In: <strong className="text-white">{lec.actualInTime}</strong></span>
                                            )}
                                            {lec.actualOutTime && (
                                                <span>Actual Out: <strong className="text-white">{lec.actualOutTime}</strong></span>
                                            )}
                                            {lec.isLate && (
                                                <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    Late: {lec.remarksWhyLate || "Delayed"}
                                                </span>
                                            )}
                                        </div>

                                        {/* Notes & Assignment Badges */}
                                        <div className="flex flex-wrap items-center gap-3 pt-2">
                                            {/* Notes Badge */}
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs">
                                                <FileText size={14} className="text-indigo-400" />
                                                <span className="text-zinc-300">Notes:</span>
                                                <span className={`font-bold ${lec.lectureNotes?.isSharedWithStudents ? "text-emerald-400" : "text-amber-400"}`}>
                                                    {lec.lectureNotes?.isSharedWithStudents ? "Shared to Students" : "NOT Shared"}
                                                </span>
                                                {lec.lectureNotes?.notesUrl && (
                                                    <a
                                                        href={lec.lectureNotes.notesUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-indigo-400 hover:text-indigo-300 underline text-[11px] ml-1"
                                                    >
                                                        View Notes
                                                    </a>
                                                )}
                                                {!lec.lectureNotes?.isSharedWithStudents && lec.lectureNotes?.notSharedRemarks && (
                                                    <span className="text-[10px] text-zinc-400 italic">
                                                        ({lec.lectureNotes.notSharedRemarks})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Assignment Badge */}
                                            {hasAssignment ? (
                                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs">
                                                    <BookOpen size={14} className="text-pink-400" />
                                                    <span className="text-zinc-300">Assignment:</span>
                                                    <span className="font-bold text-white">{lec.assignment.title}</span>
                                                    <span className="text-zinc-500">|</span>
                                                    <span className="text-zinc-400">
                                                        Completed: <strong className="text-pink-400">{lec.assignment.studentsCompletedCount || 0}</strong>
                                                    </span>
                                                    {lec.assignment?.assignmentUrl && (
                                                        <a
                                                            href={lec.assignment.assignmentUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-pink-400 hover:text-pink-300 underline text-[11px] ml-1"
                                                        >
                                                            View
                                                        </a>
                                                    )}
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                        lec.assignment.isSharedInProfGroup
                                                            ? "bg-emerald-500/10 text-emerald-400"
                                                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    }`}>
                                                        {lec.assignment.isSharedInProfGroup ? "OM Shared in Prof Group" : "OM Group Share Pending"}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-zinc-500 italic">No Assignment attached</span>
                                            )}

                                            {/* Recording link */}
                                            {lec.recordingUrl && (
                                                <a
                                                    href={lec.recordingUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1 px-3 py-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-xs text-sky-400"
                                                >
                                                    <Video size={13} /> Class Recording <ExternalLink size={11} />
                                                </a>
                                            )}
                                        </div>

                                        {/* CL Remarks if existing */}
                                        {lec.clRemarks && (
                                            <p className="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
                                                <strong>CL/CH Feedback:</strong> {lec.clRemarks}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action button */}
                                    <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                                        <button
                                            onClick={() => openReviewModal(lec)}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 ${
                                                isVerified
                                                    ? "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                                                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                                            }`}
                                        >
                                            {isVerified ? "Re-evaluate" : "Review & Verify"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Curriculum Review Modal */}
            {reviewModalOpen && selectedLecture && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-emerald-400" />
                                    Curriculum Quality Inspection
                                </h3>
                                <p className="text-xs text-zinc-400">
                                    {selectedLecture.facultyName} &bull; {selectedLecture.subject} ({selectedLecture.date})
                                </p>
                            </div>
                            <button
                                onClick={() => setReviewModalOpen(false)}
                                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Notes Review Section */}
                        <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700/60 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <FileText size={15} className="text-indigo-400" />
                                    1. Lecture Notes Quality
                                </h4>
                                {selectedLecture.lectureNotes?.notesUrl && (
                                    <a
                                        href={selectedLecture.lectureNotes.notesUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                                    >
                                        Open Notes <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>

                            <p className="text-xs text-zinc-400">
                                Student Distribution: <strong className={selectedLecture.lectureNotes?.isSharedWithStudents ? "text-emerald-400" : "text-amber-400"}>
                                    {selectedLecture.lectureNotes?.isSharedWithStudents ? "Shared with Students" : "NOT Shared"}
                                </strong>
                                {!selectedLecture.lectureNotes?.isSharedWithStudents && selectedLecture.lectureNotes?.notSharedRemarks && (
                                    <span className="italic ml-1">({selectedLecture.lectureNotes.notSharedRemarks})</span>
                                )}
                            </p>

                            <div className="flex items-center gap-3 pt-1">
                                <button
                                    onClick={() => setNotesStatus("VERIFIED")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        notesStatus === "VERIFIED"
                                            ? "bg-emerald-600 text-white"
                                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                    }`}
                                >
                                    ✓ Notes Approved
                                </button>
                                <button
                                    onClick={() => setNotesStatus("NEEDS_REVISION")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        notesStatus === "NEEDS_REVISION"
                                            ? "bg-rose-600 text-white"
                                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                    }`}
                                >
                                    ⚠ Needs Improvement
                                </button>
                            </div>

                            <input
                                type="text"
                                placeholder="Lead remarks on lecture notes (e.g., diagrams missing, well structured)..."
                                value={notesRemarks}
                                onChange={(e) => setNotesRemarks(e.target.value)}
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Assignment Review Section */}
                        {selectedLecture.assignment?.hasAssignment ? (
                            <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700/60 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <BookOpen size={15} className="text-pink-400" />
                                        2. Assignment Verification
                                    </h4>
                                    {selectedLecture.assignment?.assignmentUrl && (
                                        <a
                                            href={selectedLecture.assignment.assignmentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-pink-400 hover:underline flex items-center gap-1"
                                        >
                                            Open Assignment <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>

                                <div className="text-xs text-zinc-400 space-y-1">
                                    <p><strong>Title:</strong> {selectedLecture.assignment.title}</p>
                                    <p><strong>Deadline:</strong> {selectedLecture.assignment.deadline || "Not Specified"}</p>
                                    <p><strong>Student Responses:</strong> <span className="text-pink-400 font-bold">{selectedLecture.assignment.studentsCompletedCount || 0}</span> students completed</p>
                                </div>

                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        onClick={() => setAssignmentStatus("VERIFIED")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            assignmentStatus === "VERIFIED"
                                                ? "bg-emerald-600 text-white"
                                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                        }`}
                                    >
                                        ✓ Assignment Approved for OM Sharing
                                    </button>
                                    <button
                                        onClick={() => setAssignmentStatus("NEEDS_REVISION")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            assignmentStatus === "NEEDS_REVISION"
                                                ? "bg-rose-600 text-white"
                                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                        }`}
                                    >
                                        ⚠ Revise Assignment
                                    </button>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Lead remarks on assignment (e.g., standard question format approved)..."
                                    value={assignmentRemarks}
                                    onChange={(e) => setAssignmentRemarks(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
                                />
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl bg-zinc-800/20 border border-zinc-800 text-xs text-zinc-500">
                                ℹ No assignment was submitted with this lecture (optional for non-Saturday sessions).
                            </div>
                        )}

                        {/* Overall CL Feedback */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                Overall Curriculum Lead Remarks / Instructions
                            </label>
                            <textarea
                                value={overallRemarks}
                                onChange={(e) => setOverallRemarks(e.target.value)}
                                placeholder="General feedback for faculty and institute review..."
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none h-20"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                            <button
                                onClick={() => submitReview("REQUEST_REVISION")}
                                disabled={actionLoading}
                                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-bold transition-colors"
                            >
                                Request Changes
                            </button>
                            <button
                                onClick={() => submitReview("VERIFY_GOOD_TO_GO")}
                                disabled={actionLoading}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                            >
                                ✓ Turn Green (Good to Go)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
