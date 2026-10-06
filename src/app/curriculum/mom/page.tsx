"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import {
    MessageSquareText, Users, Calendar, Building2, Save,
    Plus, Trash2, CheckCircle2, History, AlertCircle, Clock
} from "lucide-react";

const CAMPUSES = [
    "SAGE Bhopal",
    "MANIT Bhopal",
    "LNCT Bhopal",
    "Oriental Bhopal",
    "RKDF Bhopal",
    "SIRT Bhopal",
    "Global HQ"
];

export default function CampusDailyMoMPage() {
    const { user } = useAuth();
    const todayStr = new Date().toISOString().split("T")[0];

    const [campus, setCampus] = useState(user?.location || "SAGE Bhopal");
    const [date, setDate] = useState(todayStr);
    const [meetingTitle, setMeetingTitle] = useState("Daily Campus Academic & Operations Standup");
    const [meetingTime, setMeetingTime] = useState("17:30");
    const [attendees, setAttendees] = useState<string[]>([]);
    const [newAttendee, setNewAttendee] = useState("");
    const [discussionPoints, setDiscussionPoints] = useState("");
    const [actionItems, setActionItems] = useState<{ task: string; owner: string; status: string }[]>([]);
    const [newActionTask, setNewActionTask] = useState("");
    const [newActionOwner, setNewActionOwner] = useState("");
    const [escalations, setEscalations] = useState("");
    const [updateLog, setUpdateLog] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        fetchMoM();
    }, [campus, date]);

    const fetchMoM = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/curriculum/mom?campus=${encodeURIComponent(campus)}&date=${date}`);
            const data = await res.json();
            if (data.mom) {
                const m = data.mom;
                setMeetingTitle(m.meetingTitle || "Daily Campus Academic & Operations Standup");
                setMeetingTime(m.meetingTime || "17:30");
                setAttendees(m.attendees || []);
                setDiscussionPoints(m.discussionPoints || "");
                setActionItems(m.actionItems || []);
                setEscalations(m.escalations || "");
                setUpdateLog(m.updateLog || []);
            } else {
                setMeetingTitle("Daily Campus Academic & Operations Standup");
                setMeetingTime("17:30");
                setAttendees(user?.name ? [user.name] : []);
                setDiscussionPoints("");
                setActionItems([]);
                setEscalations("");
                setUpdateLog([]);
            }
        } catch (e) {
            console.error("Failed to load MoM", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMoM = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/curriculum/mom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campus,
                    date,
                    meetingTitle,
                    meetingTime,
                    attendees,
                    discussionPoints,
                    actionItems,
                    escalations,
                    updatedBy: user?.id,
                    updatedByName: user?.name,
                    updatedByRole: user?.role
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Campus Daily MoM successfully updated & recorded!" });
                fetchMoM();
            } else {
                setMessage({ type: "error", text: data.error || "Failed to save MoM." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const addAttendee = () => {
        if (!newAttendee.trim()) return;
        if (!attendees.includes(newAttendee.trim())) {
            setAttendees([...attendees, newAttendee.trim()]);
        }
        setNewAttendee("");
    };

    const removeAttendee = (name: string) => {
        setAttendees(attendees.filter((a) => a !== name));
    };

    const addActionItem = () => {
        if (!newActionTask.trim()) return;
        setActionItems([
            ...actionItems,
            { task: newActionTask.trim(), owner: newActionOwner.trim() || "Unassigned", status: "PENDING" }
        ]);
        setNewActionTask("");
        setNewActionOwner("");
    };

    const toggleActionStatus = (idx: number) => {
        const updated = [...actionItems];
        updated[idx].status = updated[idx].status === "COMPLETED" ? "PENDING" : "COMPLETED";
        setActionItems(updated);
    };

    const removeActionItem = (idx: number) => {
        setActionItems(actionItems.filter((_, i) => i !== idx));
    };

    return (
        <div className="max-w-7xl mx-auto pt-8 pb-14 px-4 sm:px-6 space-y-6">
            {/* Header */}
            <div className="relative group bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shadow-inner">
                        <MessageSquareText size={24} className="text-sky-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            Campus Daily Standup MoM
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Collaborative Minutes &bull; Faculties &bull; HOI &bull; OM &bull; Curriculum Lead & Head
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl">
                        <Building2 size={16} className="text-sky-400 shrink-0" />
                        <select
                            value={campus}
                            onChange={(e) => setCampus(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                            {CAMPUSES.map((c) => (
                                <option key={c} value={c} className="bg-zinc-900 text-white">
                                    {c}
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

                    <button
                        onClick={handleSaveMoM}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-sky-600/20 active:scale-95 disabled:opacity-50"
                    >
                        <Save size={15} /> {saving ? "Saving..." : "Save MoM"}
                    </button>
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
                    {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{message.text}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Meeting Metadata & Attendees */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Clock size={16} className="text-sky-400" /> Meeting Overview
                            </h3>

                            <div>
                                <label className="text-[11px] text-zinc-400 font-bold block mb-1">Meeting Title</label>
                                <input
                                    type="text"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] text-zinc-400 font-bold block mb-1">Time</label>
                                <input
                                    type="time"
                                    value={meetingTime}
                                    onChange={(e) => setMeetingTime(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                />
                            </div>
                        </div>

                        {/* Attendees List */}
                        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Users size={16} className="text-emerald-400" /> Attendees ({attendees.length})
                            </h3>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add attendee name..."
                                    value={newAttendee}
                                    onChange={(e) => setNewAttendee(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addAttendee()}
                                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                />
                                <button
                                    onClick={addAttendee}
                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-xl"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {attendees.map((a, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200"
                                    >
                                        {a}
                                        <button onClick={() => removeAttendee(a)} className="text-zinc-500 hover:text-red-400">
                                            &times;
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Collaborative Audit Log */}
                        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <History size={16} className="text-zinc-400" /> Update Audit Log
                            </h3>
                            {updateLog.length === 0 ? (
                                <p className="text-xs text-zinc-500 italic">No updates logged yet today.</p>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {updateLog.slice(-5).reverse().map((u, i) => (
                                        <div key={i} className="text-[11px] p-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
                                            <div className="flex items-center justify-between text-zinc-300 font-bold">
                                                <span>{u.updatedByName || "User"}</span>
                                                <span className="text-[10px] text-sky-400">{u.updatedByRole}</span>
                                            </div>
                                            <p className="text-zinc-500 text-[10px] mt-0.5">
                                                {new Date(u.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right 2 cols: Discussion Points, Action Items & Escalations */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Discussion Points */}
                        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                    Key Discussion Points & Syllabus Pace
                                </h3>
                                <span className="text-[10px] text-zinc-500">Shared across Faculty & Leadership</span>
                            </div>
                            <textarea
                                value={discussionPoints}
                                onChange={(e) => setDiscussionPoints(e.target.value)}
                                placeholder="&bull; Topic coverage speed&#10;&bull; Student attendance anomalies&#10;&bull; Lab infrastructure notes..."
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 h-40 resize-none font-sans leading-relaxed"
                            />
                        </div>

                        {/* Action Items */}
                        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                Assigned Action Items
                            </h3>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    placeholder="Action item task description..."
                                    value={newActionTask}
                                    onChange={(e) => setNewActionTask(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="Assignee (e.g., Prof. Ankit / OM)"
                                    value={newActionOwner}
                                    onChange={(e) => setNewActionOwner(e.target.value)}
                                    className="sm:w-48 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white"
                                />
                                <button
                                    onClick={addActionItem}
                                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold"
                                >
                                    Add Task
                                </button>
                            </div>

                            <div className="space-y-2">
                                {actionItems.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={item.status === "COMPLETED"}
                                                onChange={() => toggleActionStatus(idx)}
                                                className="w-4 h-4 rounded text-sky-600 focus:ring-0 cursor-pointer"
                                            />
                                            <div>
                                                <p className={`text-xs font-semibold ${item.status === "COMPLETED" ? "line-through text-zinc-500" : "text-white"}`}>
                                                    {item.task}
                                                </p>
                                                <p className="text-[10px] text-zinc-400">Assigned: <strong className="text-sky-400">{item.owner}</strong></p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeActionItem(idx)}
                                            className="text-zinc-500 hover:text-red-400 p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Escalations / Blockers */}
                        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                            <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider">
                                Campus Escalations & Urgent Blockers
                            </h3>
                            <textarea
                                value={escalations}
                                onChange={(e) => setEscalations(e.target.value)}
                                placeholder="College administration roadblocks, lab system issues, missing faculty substitute..."
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 h-24 resize-none leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
