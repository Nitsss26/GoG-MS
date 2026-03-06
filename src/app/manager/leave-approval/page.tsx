"use client";
import { useAuth } from "@/context/AuthContext";
import { Calendar, CheckCircle2, XCircle, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function LeaveApprovalPage() {
    const { user, leaves, approveLeave, rejectLeave, getReportees } = useAuth();
    const [tab, setTab] = useState<"reportees" | "self">("reportees");
    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) return null;

    const reportees = getReportees(user.id);
    const reporteeIds = reportees.map(r => r.id);
    const reporteeLeaves = leaves.filter(l => reporteeIds.includes(l.employeeId)).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const selfLeaves = leaves.filter(l => l.employeeId === user.id).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const displayed = tab === "reportees" ? reporteeLeaves : selfLeaves;
    const today = new Date().toISOString().split("T")[0];
    const currentlyOnLeave = reportees.filter(r => {
        const activeLeave = leaves.find(l => l.employeeId === r.id && l.status === "Approved" && today >= l.startDate && today <= l.endDate);
        return !!activeLeave;
    });

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight">Leave Management</h1>
                <p className="text-xs text-zinc-400 mt-1">Approve or reject leave requests from your reportees.</p>
            </header>

            <div className="flex gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit">
                <button onClick={() => setTab("reportees")} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", tab === "reportees" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}>
                    Reportee Leaves ({reporteeLeaves.filter(l => l.status === "Pending").length} pending)
                </button>
                <button onClick={() => setTab("self")} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", tab === "self" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}>
                    My Leaves ({selfLeaves.length})
                </button>
            </div>

            {tab === "reportees" && currentlyOnLeave.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} /> Currently On Leave Today ({currentlyOnLeave.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {currentlyOnLeave.map(r => (
                            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">
                                    {r.name[0]}
                                </div>
                                <span className="text-xs text-white font-medium">{r.name}</span>
                                <span className="text-[10px] text-zinc-500">{r.designation}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white">
                        {tab === "reportees" ? "Reportee Requests & History" : "My Leave History"}
                    </h3>
                </div>
                <div className="divide-y divide-zinc-800/50">
                    {displayed.length === 0 ? (
                        <div className="p-12 text-center text-xs text-zinc-500 italic">No leave requests found.</div>
                    ) : displayed.map(l => (
                        <div key={l.id} className="p-5 flex items-start gap-4 hover:bg-zinc-800/20 transition-colors">
                            <div className="mt-0.5">
                                {l.status === "Pending" ? <Clock size={16} className="text-amber-500" /> :
                                    l.status === "Approved" ? <CheckCircle2 size={16} className="text-green-500" /> :
                                        <XCircle size={16} className="text-red-500" />}
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-xs font-bold text-white">{l.employeeName}</h4>
                                        <p className="text-[10px] text-zinc-500">{l.type} · {l.leaveType} · {l.days} day(s)</p>
                                        <p className="text-[10px] text-zinc-400">{l.startDate} → {l.endDate}</p>
                                        {l.reason && <p className="text-[10px] text-zinc-500 italic mt-1">Reason: {l.reason}</p>}
                                    </div>
                                    <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        l.status === "Pending" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                            l.status === "Approved" ? "text-green-400 bg-green-500/10 border-green-500/20" :
                                                "text-red-400 bg-red-500/10 border-red-500/20"
                                    )}>{l.status}</span>
                                </div>
                                {tab === "reportees" && l.status === "Pending" && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <button onClick={() => approveLeave(l.id)} className="px-4 py-1.5 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">Approve</button>
                                        <button onClick={() => rejectLeave(l.id)} className="px-4 py-1.5 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Reject</button>
                                        {l.leaveType === "Emergency" && (
                                            <button
                                                onClick={() => { if (confirm("Are you sure you want to reject this emergency request and apply a 2-Day LOP penalty for invalid proof?")) rejectLeave(l.id, true); }}
                                                className="px-4 py-1.5 text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors"
                                            >
                                                Reject (Invalid Proof - 2 Day LOP)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
