// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth, ResignationRequest } from "@/context/AuthContext";
import {
    DoorOpen,
    Send,
    Calendar,
    MessageSquare,
    Clock,
    User,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Info,
    ChevronRight,
    Search,
    FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ResignationPage() {
    const { user, resignationRequests, submitResignation, approveResignation, employees } = useAuth();
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [form, setForm] = useState({
        reason: "",
        preferredLastDay: ""
    });

    if (!user) return null;

    const myRequest = resignationRequests.find(r => r.employeeId === user.id);
    const pendingRequests = resignationRequests.filter(r => r.status === "Pending");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitResignation({ ...form, noticePeriodDays: 30 });
        setShowSubmitModal(false);
        setForm({ reason: "", preferredLastDay: "" });
    };

    if (user.role === "HR") {
        return (
            <div className="p-8 space-y-8 max-w-6xl mx-auto">
                <header>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Separation Registry</h1>
                    <p className="text-sm text-zinc-400 mt-1 italic">Institutional Offboarding & Exit Pipeline Control</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Stats */}
                    <div className="card p-6 space-y-2 border-zinc-800 bg-zinc-950/50">
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg w-fit"><AlertTriangle size={18} /></div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Active Pipeline</p>
                        <p className="text-3xl font-bold text-white">{pendingRequests.length}</p>
                        <p className="text-[10px] text-zinc-600 font-medium italic">Nodes awaiting institutional clearance</p>
                    </div>
                </div>

                <div className="card p-0 overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Resignation Queue</h3>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                            <input type="text" placeholder="Search Node..." className="bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-3 text-[10px] text-white focus:border-primary/50 transition-all outline-none" />
                        </div>
                    </div>
                    <div className="divide-y divide-zinc-900">
                        {pendingRequests.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <DoorOpen size={32} className="mx-auto text-zinc-800" />
                                <p className="text-xs text-zinc-600 font-medium">No active separation requests in the registry.</p>
                            </div>
                        ) : (
                            pendingRequests.map(req => (
                                <div key={req.id} className="p-6 flex items-center justify-between group hover:bg-zinc-900/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-primary font-bold">
                                            {req.employeeName[0]}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white uppercase tracking-tight">{req.employeeName}</h4>
                                            <p className="text-[10px] text-zinc-500">{req.submissionDate} · Ref: {req.id}</p>
                                        </div>
                                    </div>

                                    <div className="max-w-xs px-6 border-l border-zinc-800">
                                        <p className="text-[11px] text-zinc-400 line-clamp-2 italic font-medium">&quot;{req.reason}&quot;</p>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Notice Period</p>
                                            <p className="text-xs font-bold text-white">{req.noticePeriodDays} Days</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => approveResignation(req.id)} className="btn-primary py-2 px-6 text-[10px]">Verify & Approve</button>
                                            <button className="btn-outline border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/30 py-2 px-4 text-[10px]">Reject</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Institutional Separation</h1>
                    <p className="text-sm text-zinc-400 mt-1 italic">Formal Node Decoupling & Handover Protocol</p>
                </div>
                {!myRequest && (
                    <button
                        onClick={() => setShowSubmitModal(true)}
                        className="btn-outline border-red-500/20 text-red-500 hover:bg-red-500/10 flex items-center gap-2 px-6 shadow-lg shadow-red-500/5 transition-all"
                    >
                        <DoorOpen size={16} /> Declare Resignation
                    </button>
                )}
            </header>

            {myRequest ? (
                <div className="space-y-6">
                    <div className={cn(
                        "card p-8 border-2 relative overflow-hidden",
                        myRequest.status === "Pending" ? "border-amber-500/20 bg-amber-500/[0.02]" :
                            myRequest.status === "Approved" ? "border-green-500/20 bg-green-500/[0.02]" : "border-zinc-800"
                    )}>
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            {myRequest.status === "Pending" ? <Clock size={120} /> : <CheckCircle2 size={120} />}
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] border",
                                        myRequest.status === "Pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-green-500/10 text-primary border-primary/20"
                                    )}>
                                        {myRequest.status} Protocol
                                    </span>
                                    <h2 className="text-3xl font-bold text-white mt-4 italic">Transition In Progress</h2>
                                    <p className="text-sm text-zinc-400 font-medium">Request submitted on {myRequest.submissionDate}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                                <div className="p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-2">
                                    <Clock className="text-zinc-500" size={18} />
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Notice Period</p>
                                    <p className="text-base font-bold text-white">{myRequest.noticePeriodDays} Calendar Days</p>
                                </div>
                                <div className="p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-2">
                                    <Calendar className="text-zinc-500" size={18} />
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Requested End Date</p>
                                    <p className="text-base font-bold text-white">{myRequest.preferredLastDay}</p>
                                </div>
                                <div className="p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-2">
                                    <Info className="text-zinc-500" size={18} />
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">System Clearance</p>
                                    <p className="text-base font-bold text-white truncate">{myRequest.status === "Pending" ? "Awaiting HR Review" : "Clearance Issued"}</p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-zinc-800">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Institutional Reason Provided</h4>
                                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                                    <p className="text-xs text-zinc-400 leading-relaxed italic">&quot;{myRequest.reason}&quot;</p>
                                </div>
                            </div>

                            {myRequest.status === "Pending" && (
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 flex items-start gap-4">
                                    <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-amber-500">Separation Protocol Active</p>
                                        <p className="text-[11px] text-zinc-500 leading-relaxed">During the notice period, all critical operational nodes must be transferred. Institutional access will be revoked at 6:00 PM on the final approved date.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card p-6">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Exit Checklist Progression</h3>
                        <div className="space-y-4">
                            {[
                                { task: "Knowledge Transfer (KT) Completion", status: "In Progress" },
                                { task: "Institutional Asset Handover", status: "Pending" },
                                { task: "Final Arrears Settlement", status: "Pending" },
                                { task: "Systemic Access Revocations", status: "Pending" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/50 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-700">
                                            <ChevronRight size={12} />
                                        </div>
                                        <span className="text-xs font-medium text-zinc-400">{item.task}</span>
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-bold uppercase tracking-widest",
                                        item.status === "In Progress" ? "text-amber-500" : "text-zinc-600"
                                    )}>{item.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card p-12 text-center space-y-6 bg-zinc-950/50 border-dashed border-2">
                    <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto text-zinc-800">
                        <DoorOpen size={40} />
                    </div>
                    <div className="max-w-md mx-auto space-y-2">
                        <h2 className="text-base font-bold text-white uppercase tracking-widest">Active Institutional Node</h2>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">You are currently an active member of the GoG institution. Separation protocols are formal processes intended to decouple operational nodes from the workforce tree.</p>
                    </div>
                    <button
                        onClick={() => setShowSubmitModal(true)}
                        className="btn-outline border-zinc-800 text-zinc-500 hover:text-white"
                    >
                        Initiate Separation Request
                    </button>
                </div>
            )}

            {/* Submit Modal */}
            <AnimatePresence>
                {showSubmitModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSubmitModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-lg p-8 relative z-10 space-y-8 border-red-500/20 shadow-2xl">
                            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">Decoupling Declaration</h2>
                                    <p className="text-xs text-zinc-500 mt-1 italic italic">Institutional Separation Protocol Entry</p>
                                </div>
                                <button onClick={() => setShowSubmitModal(false)} className="p-2 hover:bg-zinc-900 rounded-xl">
                                    <XCircle size={20} className="text-zinc-600 hover:text-white transition-colors" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Terminal Reasoning</label>
                                    <textarea
                                        required
                                        rows={5}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-white resize-none focus:border-red-500/30 transition-all font-medium leading-relaxed"
                                        placeholder="Provide detailed context for the separation node request..."
                                        value={form.reason}
                                        onChange={e => setForm({ ...form, reason: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Preferred Decoupling Date</label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-xs text-white focus:border-red-500/30 transition-all outline-none"
                                            value={form.preferredLastDay}
                                            onChange={e => setForm({ ...form, preferredLastDay: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-[9px] text-zinc-600 italic px-1">Note: Formal notice periods apply based on institutional contracts.</p>
                                </div>

                                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 space-y-3">
                                    <div className="flex items-center gap-2 text-red-500">
                                        <AlertTriangle size={16} />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Critical Warning</p>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed italic italic">Submit resignation declarations are irreversible once approved by the Administrative Node. This action will initiate institutional decoupling procedures.</p>
                                </div>

                                <button type="submit" className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-600/20 tracking-widest italic italic">
                                    EXECUTE SEPARATION REQUEST
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
