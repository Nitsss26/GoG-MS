"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { LeaveRequest } from "@/context/AuthContext";
import { Search, CalendarCheck, CheckCircle2, XCircle, Eye, X, Clock, Calendar, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTab = "Pending" | "Approved" | "Rejected" | "All";
type ModalState =
    | { type: "details"; leave: LeaveRequest }
    | { type: "approve" | "reject"; leave: LeaveRequest }
    | null;

const isPending = (l: LeaveRequest) => l.status === "Pending" || l.status === "Pending HOI Approval";

export default function HRLeaveManagementPage() {
    const { user, employees, colleges, leaves, hrProcessLeave } = useAuth();
    const [tab, setTab] = useState<StatusTab>("Pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [modal, setModal] = useState<ModalState>(null);
    const [remarks, setRemarks] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    // Opened from Employee Management → "Manage Leave": pre-filter to that employee
    useEffect(() => {
        const employeeId = new URLSearchParams(window.location.search).get("employee");
        if (employeeId) {
            setSearchTerm(employeeId);
            setTab("All");
        }
    }, []);

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) {
        return <div className="p-8 text-center text-zinc-500">Access Denied. HR Personnel Only.</div>;
    }

    const hois = employees.filter(e => e.role === "HOI");
    const getEmployee = (id: string) => employees.find(e => e.id === id);
    const getLocationLabel = (loc?: string) => {
        if (!loc) return "";
        const c = (colleges || []).find(l => l.id === loc || l.name === loc || l.shortName === loc);
        return c ? c.name : loc;
    };
    const getHOIName = (employeeId: string) => {
        const emp = getEmployee(employeeId);
        if (!emp) return "";
        const ids = Array.isArray(emp.reportsTo) ? emp.reportsTo : (emp.reportsTo ? [emp.reportsTo] : []);
        return hois.find(h => ids.includes(h.id))?.name || "";
    };
    const getLeaveLocation = (l: LeaveRequest) => getLocationLabel(getEmployee(l.employeeId)?.location || l.location);
    const getName = (id?: string) => (id ? (getEmployee(id)?.name || id) : "");
    const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "");

    // Leave administration: everyone else's requests. HR's own leave lives in the personal Leave page
    // (Core → Leave) and is decided by another HR or a Founder, so it is not repeated here.
    const adminLeaves = leaves.filter(l => l.employeeId !== user.id);

    const counts = {
        Pending: adminLeaves.filter(isPending).length,
        Approved: adminLeaves.filter(l => l.status === "Approved").length,
        Rejected: adminLeaves.filter(l => l.status === "Rejected").length,
        All: adminLeaves.length,
    };

    const term = searchTerm.toLowerCase();
    const displayed = adminLeaves
        .filter(l => tab === "All" || (tab === "Pending" ? isPending(l) : l.status === tab))
        .filter(l =>
            (l.employeeName || "").toLowerCase().includes(term) ||
            (l.employeeId || "").toLowerCase().includes(term) ||
            getHOIName(l.employeeId).toLowerCase().includes(term) ||
            getLeaveLocation(l).toLowerCase().includes(term)
        )
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const openModal = (type: "details" | "approve" | "reject", leave: LeaveRequest) => {
        setError("");
        setRemarks("");
        setModal({ type, leave });
    };

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal || modal.type === "details") return;
        setIsSaving(true);
        setError("");
        const result = await hrProcessLeave(modal.leave.id, modal.type, remarks.trim() || undefined);
        setIsSaving(false);
        if (result.success) setModal(null);
        else setError(result.msg || "Could not update the leave. Please try again.");
    };

    // Each kind of leave gets its own colour so Casual / Sick / Short etc. stand apart at a glance
    const leaveKindClass = (type: string) => {
        const t = (type || "").toLowerCase();
        if (t.includes("sick")) return "text-rose-400 bg-rose-500/10 border-rose-500/20";
        if (t.includes("casual")) return "text-sky-400 bg-sky-500/10 border-sky-500/20";
        if (t.includes("short")) return "text-purple-400 bg-purple-500/10 border-purple-500/20";
        if (t.includes("privilege")) return "text-teal-400 bg-teal-500/10 border-teal-500/20";
        if (t.includes("maternity")) return "text-pink-400 bg-pink-500/10 border-pink-500/20";
        return "text-zinc-300 bg-zinc-800 border-zinc-700";
    };

    const statusClass = (status: string) =>
        status.includes("Pending") ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
            status === "Approved" ? "text-green-400 bg-green-500/10 border-green-500/20" :
                "text-red-400 bg-red-500/10 border-red-500/20";

    // Always read the latest copy of the leave for the open modal
    const modalLeave = modal ? (leaves.find(l => l.id === modal.leave.id) || modal.leave) : null;

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"><CalendarCheck size={26} className="text-primary" /> Leave Management</h1>
                    <p className="text-zinc-500 mt-1">Directly approve or reject employee / faculty leave requests. HOI approval is not required first.</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit">
                {(["Pending", "Approved", "Rejected", "All"] as StatusTab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", tab === t ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}>
                        {t} ({counts[t]})
                    </button>
                ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search by employee, ID, HOI or location..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                </div>

                {/* Card list: one card per request — details | reason | status + actions — so every card lines up */}
                <div className="p-4 space-y-3">
                    {displayed.length === 0 ? (
                        <div className="p-12 text-center text-xs text-zinc-500 italic">No leave requests found.</div>
                    ) : displayed.map(l => (
                        <div key={l.id} data-leave-card className="bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-5 space-y-4 hover:border-zinc-700 transition-colors">
                            {/* Top: who and when (left) · status and actions (right) */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                        isPending(l) ? "bg-amber-500/10 text-amber-500" : l.status === "Approved" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                        {isPending(l) ? <Clock size={17} /> : l.status === "Approved" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                            <h4 className="text-sm font-bold text-white truncate max-w-full" title={l.employeeName}>{l.employeeName}</h4>
                                            <span className="text-[10px] font-mono text-zinc-500">{l.employeeId}</span>
                                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", leaveKindClass(l.type))}>{l.type}</span>
                                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", l.leaveType === "Emergency" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-zinc-300 bg-zinc-800 border-zinc-700")}>{l.leaveType}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]">
                                            <span className="flex items-center gap-1.5 text-zinc-300"><Calendar size={12} className="text-zinc-500 shrink-0" /> {l.startDate} → {l.endDate} <span className="text-zinc-500">({l.days} day{l.days === 1 ? "" : "s"})</span></span>
                                            <span className="flex items-center gap-1.5 text-zinc-500 min-w-0"><User size={12} className="shrink-0" /> HOI: <span className="text-zinc-300 truncate">{getHOIName(l.employeeId) || "Not Assigned"}</span></span>
                                            <span className="flex items-center gap-1.5 text-zinc-500 min-w-0"><MapPin size={12} className="shrink-0" /> <span className="text-zinc-300 truncate">{getLeaveLocation(l) || "Not Assigned"}</span></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
                                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border whitespace-nowrap", statusClass(l.status))}>{l.status}</span>
                                    {isPending(l) && (
                                        <>
                                            <button onClick={() => openModal("approve", l)} className="px-4 py-1.5 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">Approve</button>
                                            <button onClick={() => openModal("reject", l)} className="px-4 py-1.5 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Reject</button>
                                        </>
                                    )}
                                    <button onClick={() => openModal("details", l)} title="View Details" className="px-3 py-1.5 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"><Eye size={12} /> Details</button>
                                </div>
                            </div>

                            {/* Bottom: the complete reason, full width — the card grows with the text, nothing is cut */}
                            <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl px-4 py-3">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Reason</p>
                                <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{l.reason || <span className="text-zinc-600 italic">No reason given</span>}</p>
                                {l.reasonForAction && <p className="text-[10px] text-amber-500/80 italic mt-2 pt-2 border-t border-zinc-800/60 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">Action Note: {l.reasonForAction}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Approve / Reject Modal */}
            {modal && modalLeave && modal.type !== "details" && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {modal.type === "approve"
                                    ? <><CheckCircle2 size={20} className="text-green-400" /> Approve Leave</>
                                    : <><XCircle size={20} className="text-red-400" /> Reject Leave</>}
                            </h2>
                            <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAction} className="p-6 space-y-5">
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                <p className="text-sm text-white font-bold">{modalLeave.employeeName}</p>
                                <p className="text-xs text-zinc-500">{modalLeave.employeeId} • {modalLeave.type} • {modalLeave.days} day(s)</p>
                                <p className="text-xs text-zinc-400 mt-2">{modalLeave.startDate} → {modalLeave.endDate}</p>
                                {modalLeave.status === "Pending HOI Approval" && (
                                    <p className="text-[10px] text-amber-500 mt-2">HOI has not acted on this request yet. Your decision will be final.</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Remarks (optional)</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    rows={3}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                            </div>
                            {error && <p className="text-xs text-red-400">{error}</p>}
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={cn("w-full text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                                    modal.type === "approve" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500")}
                            >
                                {isSaving ? "Saving..." : modal.type === "approve" ? "Approve Leave" : "Reject Leave"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {modal && modalLeave && modal.type === "details" && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Eye size={20} className="text-primary" /> Leave Details</h2>
                            <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-3">
                            {([
                                ["Employee Name", modalLeave.employeeName],
                                ["Employee ID", modalLeave.employeeId],
                                ["Assigned HOI", getHOIName(modalLeave.employeeId) || "Not Assigned"],
                                ["Location", getLeaveLocation(modalLeave) || "Not Assigned"],
                                ["Leave Type", `${modalLeave.type} (${modalLeave.leaveType}, ${modalLeave.classification})`],
                                ["From Date", modalLeave.startDate],
                                ["To Date", modalLeave.endDate],
                                ["Days", String(modalLeave.days)],
                                ["Reason", modalLeave.reason],
                                ["Applied At", formatDate(modalLeave.appliedAt)],
                                ["Current Status", modalLeave.status],
                                ["HOI Approval", modalLeave.hoiApproval],
                                ["HR Approval", modalLeave.hrApproval],
                                ["Approved By", modalLeave.approvedBy ? `${modalLeave.approvedByName || getName(modalLeave.approvedBy)} (${modalLeave.approvedByRole})` : ""],
                                ["Approved At", formatDate(modalLeave.approvedAt)],
                                ["Rejected By", modalLeave.rejectedBy ? `${modalLeave.rejectedByName || getName(modalLeave.rejectedBy)} (${modalLeave.rejectedByRole})` : ""],
                                ["Rejected At", formatDate(modalLeave.rejectedAt)],
                                ["Remarks", modalLeave.reasonForAction],
                            ] as [string, string | undefined][]).filter(([, value]) => value).map(([label, value]) => (
                                <div key={label} className="flex justify-between gap-4 text-sm border-b border-zinc-800/50 pb-2">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pt-0.5 shrink-0">{label}</span>
                                    <span className="text-zinc-200 text-right break-words min-w-0">{value}</span>
                                </div>
                            ))}
                            {modalLeave.proofUrls && modalLeave.proofUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {modalLeave.proofUrls.map((url, idx) => (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 hover:text-white transition-colors">View Document {idx + 1}</a>
                                    ))}
                                </div>
                            )}
                            {isPending(modalLeave) && (
                                <div className="flex gap-2 pt-3">
                                    <button onClick={() => openModal("approve", modalLeave)} className="flex-1 px-3 py-2 text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">Approve</button>
                                    <button onClick={() => openModal("reject", modalLeave)} className="flex-1 px-3 py-2 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Reject</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}