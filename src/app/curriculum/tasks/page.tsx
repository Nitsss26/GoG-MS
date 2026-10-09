"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import {
    Sparkles, Plus, CheckCircle2, Clock, AlertTriangle,
    User, Calendar, Flag, MessageSquare, ExternalLink, X, Check
} from "lucide-react";

export default function CurriculumTasksPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // New task form state
    const [facultyId, setFacultyId] = useState("");
    const [facultyName, setFacultyName] = useState("");
    const [campus, setCampus] = useState("SAGE Bhopal");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
    const [dueDate, setDueDate] = useState("");
    const [curriculumHeadRemarks, setCurriculumHeadRemarks] = useState("");

    // Faculty review state
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [feedback, setFeedback] = useState("");

    const isLeadOrHead = user?.role === "CURRICULUM_HEAD" || user?.role === "CURRICULUM_LEAD" || (user?.role as string) === "SUPERADMIN";

    useEffect(() => {
        fetchTasks();
    }, [user]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const url = isLeadOrHead ? "/api/curriculum/tasks" : `/api/curriculum/tasks?facultyId=${user?.id}`;
            const res = await fetch(url);
            const data = await res.json();
            setTasks(data.tasks || []);
        } catch (e) {
            console.error("Failed to load tasks", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/curriculum/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "CREATE_TASK",
                    facultyId,
                    facultyName,
                    campus,
                    title,
                    description,
                    priority,
                    dueDate,
                    curriculumHeadRemarks
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Curriculum task assigned to professor successfully!" });
                setShowCreateModal(false);
                setTitle("");
                setDescription("");
                fetchTasks();
            } else {
                setMessage({ type: "error", text: data.error || "Failed to create task." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleTaskReview = async (taskId: string, approved: boolean) => {
        setActionLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/curriculum/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: approved ? "APPROVE_TASK" : "REJECT_TASK",
                    taskId,
                    feedback
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: approved ? "Task marked verified & completed!" : "Feedback sent for revisions." });
                setReviewModalOpen(false);
                fetchTasks();
            } else {
                setMessage({ type: "error", text: data.error || "Action failed." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-6">
            {/* Header */}
            <div className="relative group bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                        <Sparkles size={24} className="text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            Professor Task Delegation Hub
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Curriculum Revamps &bull; Lab Manuals &bull; Question Banks &bull; Direct CL/CH Assignments
                        </p>
                    </div>
                </div>

                {isLeadOrHead && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                        <Plus size={16} /> Assign New Task
                    </button>
                )}
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

            {/* Task Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500">
                    <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No active tasks assigned.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {tasks.map((t) => {
                        const isVerified = t.status === "VERIFIED";
                        const isSubmitted = t.status === "SUBMITTED";
                        const isUrgent = t.priority === "URGENT" || t.priority === "HIGH";

                        return (
                            <div
                                key={t._id}
                                className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
                                    isVerified
                                        ? "bg-zinc-900/40 border-emerald-500/30"
                                        : isSubmitted
                                        ? "bg-amber-950/20 border-amber-500/40"
                                        : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700"
                                }`}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                            isUrgent
                                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                : "bg-zinc-800 text-zinc-400"
                                        }`}>
                                            {t.priority}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                            isVerified
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                : isSubmitted
                                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                        }`}>
                                            {t.status}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="text-base font-bold text-white leading-snug">{t.title}</h3>
                                        <p className="text-xs text-zinc-400 mt-1 line-clamp-3 leading-relaxed">{t.description}</p>
                                    </div>

                                    <div className="pt-2 border-t border-zinc-800/80 space-y-1.5 text-xs text-zinc-400">
                                        <div className="flex items-center justify-between">
                                            <span>Assigned To:</span>
                                            <strong className="text-white">{t.facultyName}</strong>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Campus:</span>
                                            <span className="text-indigo-400 font-semibold">{t.campus}</span>
                                        </div>
                                        {t.dueDate && (
                                            <div className="flex items-center justify-between">
                                                <span>Deadline:</span>
                                                <span className="text-amber-400 font-semibold">{t.dueDate}</span>
                                            </div>
                                        )}
                                    </div>

                                    {t.submissionRemarks && (
                                        <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/60 text-xs">
                                            <p className="text-zinc-300 font-semibold">Faculty Submission:</p>
                                            <p className="text-zinc-400 mt-0.5">{t.submissionRemarks}</p>
                                            {t.submissionUrl && (
                                                <a
                                                    href={t.submissionUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-amber-400 hover:underline flex items-center gap-1 mt-1 text-[11px]"
                                                >
                                                    View Deliverable <ExternalLink size={11} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isLeadOrHead && (
                                    <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-end gap-2">
                                        {isSubmitted && (
                                            <button
                                                onClick={() => {
                                                    setSelectedTask(t);
                                                    setFeedback(t.curriculumHeadRemarks || "");
                                                    setReviewModalOpen(true);
                                                }}
                                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all"
                                            >
                                                Review Submission
                                            </button>
                                        )}
                                        {!isVerified && !isSubmitted && (
                                            <button
                                                onClick={() => handleTaskReview(t._id, true)}
                                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-bold"
                                            >
                                                Mark Verified
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Task Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <Sparkles size={20} className="text-amber-400" />
                                Assign Task to Professor
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-zinc-400 font-bold block mb-1">Professor Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Dr. Ankit Sir"
                                        value={facultyName}
                                        onChange={(e) => setFacultyName(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-zinc-400 font-bold block mb-1">Campus</label>
                                    <select
                                        value={campus}
                                        onChange={(e) => setCampus(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                                    >
                                        <option value="SAGE Bhopal">SAGE Bhopal</option>
                                        <option value="MANIT Bhopal">MANIT Bhopal</option>
                                        <option value="LNCT Bhopal">LNCT Bhopal</option>
                                        <option value="Oriental Bhopal">Oriental Bhopal</option>
                                        <option value="RKDF Bhopal">RKDF Bhopal</option>
                                        <option value="SIRT Bhopal">SIRT Bhopal</option>
                                        <option value="Global HQ">Global HQ</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-zinc-400 font-bold block mb-1">Task Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Prepare Question Bank for 5th Sem FSWD"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                                />
                            </div>

                            <div>
                                <label className="text-zinc-400 font-bold block mb-1">Task Details & Objectives</label>
                                <textarea
                                    required
                                    placeholder="Provide detailed instructions..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white h-24 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-zinc-400 font-bold block mb-1">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={(e: any) => setPriority(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-zinc-400 font-bold block mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-wider"
                                >
                                    Assign Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewModalOpen && selectedTask && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-white">Review Task Deliverable</h3>
                        <p className="text-xs text-zinc-400">{selectedTask.title} &bull; {selectedTask.facultyName}</p>

                        <div className="p-3 bg-zinc-800 rounded-xl text-xs text-zinc-300">
                            <strong>Faculty Submission:</strong> {selectedTask.submissionRemarks || "No comments"}
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 font-bold block mb-1">Feedback / Remarks</label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Feedback for professor..."
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white resize-none h-20"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => handleTaskReview(selectedTask._id, false)}
                                className="px-4 py-2 bg-zinc-800 text-rose-400 rounded-xl text-xs font-bold"
                            >
                                Request Changes
                            </button>
                            <button
                                onClick={() => handleTaskReview(selectedTask._id, true)}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                            >
                                Approve & Verify
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
