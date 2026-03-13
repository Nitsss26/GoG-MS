"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { AlertCircle, Clock, CheckCircle2, MessageSquare, Plus, FileText, ArrowRight, Upload, Loader2, X, Image as ImageIcon, Users } from "lucide-react";

export default function TicketsPage() {
    const { user, raiseTicket, resolveTicket, tickets, getReportees, employees, restoreAttendanceCredits, pipRecords } = useAuth();
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [ticketForm, setTicketForm] = useState({
        targetCategory: "HR Desk",
        subject: "",
        content: "",
        targetEmployeeId: "",
        targetDate: new Date().toISOString().split('T')[0]
    });
    const [proofUrls, setProofUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    if (!user) return null;

    const myReportees = getReportees(user.id);
    const isManager = ["AD", "HOI", "TL", "FOUNDER"].includes(user.role);
    const isUserInPIP = pipRecords.some(p => p.employeeId === user.id && p.status === "Active");

    const isHR = user.role === "HR";
    const isFounder = user.role === "FOUNDER";
    const isSystemAdmin = isHR || isFounder;

    const myTickets = tickets.filter(t => t.raisedBy === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const hrTickets = tickets.filter(t => isFounder || t.targetCategory === "HR Desk" || t.targetCategory === "Attendance Override Request").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const displayTickets = isSystemAdmin ? (isFounder ? tickets : hrTickets) : myTickets;

    const handleSubmitTicket = (e: React.FormEvent) => {
        e.preventDefault();
        // Mandatory proof for all except Attendance Override Request
        if (ticketForm.targetCategory !== "Attendance Override Request" && proofUrls.length === 0) return;

        raiseTicket(
            ticketForm.targetCategory as any,
            ticketForm.subject,
            ticketForm.content,
            undefined,
            undefined,
            proofUrls,
            ticketForm.targetCategory === "Attendance Override Request" ? ticketForm.targetEmployeeId : undefined,
            ticketForm.targetCategory === "Attendance Override Request" ? ticketForm.targetDate : undefined
        );
        setShowNewTicketModal(false);
        setTicketForm({ targetCategory: "HR Desk", subject: "", content: "", targetEmployeeId: "", targetDate: new Date().toISOString().split('T')[0] });
        setProofUrls([]);
    };

    const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const res = await uploadToCloudinary(file);
                setProofUrls(prev => [...prev, res.secure_url]);
            }
        } catch (err) { console.error(err); }
        setUploading(false);
    };

    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case "Open": return <AlertCircle size={14} className="text-amber-500" />;
            case "In Progress": return <Clock size={14} className="text-blue-500" />;
            case "Resolved": return <CheckCircle2 size={14} className="text-green-500" />;
            default: return <MessageSquare size={14} className="text-zinc-500" />;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Resolution Center</h1>
                    <p className="text-xs text-muted">Manage queries, appeals, and institutional support tickets.</p>
                </div>
                {!isHR && (
                    <button
                        onClick={() => setShowNewTicketModal(true)}
                        className="btn-primary text-[11px] h-9 flex items-center gap-2 px-4 whitespace-nowrap"
                    >
                        <Plus size={14} /> Raise Ticket
                    </button>
                )}
            </header>

            {isUserInPIP && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest">Notice: Performance Improvement Plan (PIP) Active</h3>
                        <p className="text-[10px] text-red-300 mt-1 leading-relaxed">
                            You are currently enrolled in a Performance Improvement Plan. Any Misconduct or Academic concerns raised against you will be monitored strictly. Additional discrepancies may lead to severe administrative actions.
                        </p>
                    </div>
                </div>
            )}

            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Total Active</p>
                    <p className="text-lg font-bold text-white">{displayTickets.filter(t => t.status !== "Resolved").length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Awaiting Action</p>
                    <p className="text-lg font-bold text-amber-500">{displayTickets.filter(t => t.status === "Open").length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">In Pipeline</p>
                    <p className="text-lg font-bold text-blue-500">{displayTickets.filter(t => t.status === "In Progress").length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Resolved Log</p>
                    <p className="text-lg font-bold text-green-500">{displayTickets.filter(t => t.status === "Resolved").length}</p>
                </div>
            </div>

            {/* Ticket Stream */}
            <div className="card">
                <div className="p-4 border-b border-border flex justify-between items-center bg-surface-light/50">
                    <h3 className="text-sm font-semibold text-white">Active Queue</h3>
                </div>
                <div className="divide-y divide-border">
                    {displayTickets.length === 0 ? (
                        <div className="p-12 text-center text-xs text-muted font-medium italic">
                            No tickets registered in the current pipeline.
                        </div>
                    ) : (
                        displayTickets.map((ticket) => {
                            const targetEmp = ticket.targetEmployeeId ? employees.find(e => e.id === ticket.targetEmployeeId) : null;
                            return (
                                <div key={ticket.id} className="p-5 flex items-start gap-4 group hover:bg-surface-light/50 transition-colors">
                                    <div className="mt-1">
                                        <StatusIcon status={ticket.status} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors">{ticket.subject}</h4>
                                                <div className="text-[10px] text-muted flex flex-wrap items-center gap-2 mt-1">
                                                    <span>Ref: {ticket.id}</span>
                                                    <span>·</span>
                                                    <span className="font-bold text-primary">{ticket.targetCategory}</span>
                                                    <span>·</span>
                                                    <span>By: {ticket.employeeName}</span>
                                                    <span>·</span>
                                                    <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <span className={cn("badge text-[9px]",
                                                ticket.status === "Open" ? "badge-amber" :
                                                    ticket.status === "In Progress" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                                        "badge-green"
                                            )}>
                                                {ticket.status}
                                            </span>
                                        </div>

                                        {ticket.targetCategory === "Attendance Override Request" && ticket.targetEmployeeId && (
                                            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg p-2.5">
                                                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {targetEmp?.name[0] || "?"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-white truncate">Target: {targetEmp?.name || ticket.targetEmployeeId}</p>
                                                    <p className="text-[9px] text-zinc-400">Request Date: <span className="text-primary font-bold">{ticket.targetDate}</span></p>
                                                </div>
                                                <ArrowRight size={12} className="text-primary/50" />
                                            </div>
                                        )}

                                        <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                            <p className="text-[11px] text-zinc-300 leading-relaxed">{ticket.content}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            {ticket.proofUrls && ticket.proofUrls.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {ticket.proofUrls.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noopener" className="flex items-center gap-1.5 bg-surface-light border border-border rounded-md px-2 py-1 text-[9px] text-zinc-400 hover:text-primary transition-colors">
                                                            <ImageIcon size={10} /> Proof {i + 1}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            {ticket.cc && ticket.cc.length > 0 && (
                                                <div className="flex items-center gap-2 text-[9px] text-zinc-500 bg-zinc-800/30 px-2 py-1 rounded-md border border-zinc-700/30">
                                                    <span className="font-bold text-zinc-400">CC:</span> {ticket.cc.join(", ")}
                                                </div>
                                            )}
                                        </div>
                                        {ticket.resolutionNotes && (
                                            <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                                                <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-widest">Resolution Notes</p>
                                                <p className="text-[11px] text-zinc-300 font-medium">{ticket.resolutionNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                    {(isHR || (ticket.routeTo === user.id && ticket.status !== "Resolved")) && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap gap-2">
                                            {isHR && (
                                                <button
                                                    onClick={() => {
                                                        const targetId = ticket.targetEmployeeId || ticket.raisedBy;
                                                        if (targetId) {
                                                            restoreAttendanceCredits(targetId);
                                                            resolveTicket(ticket.id, "Credits restored, flags cleared, and issue resolved by HR due to genuine circumstances/holiday.");
                                                        }
                                                    }}
                                                    className="btn-outline py-1.5 px-3 text-[10px] h-auto border-purple-500/20 text-purple-500 hover:bg-purple-500/10 whitespace-nowrap"
                                                >
                                                    Restore Credits & Clear Flags
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const note = ticket.targetCategory === "Attendance Override Request"
                                                        ? `Attendance overridden for ${targetEmp?.name} on ${ticket.targetDate}. Processed by system via HR approval.`
                                                        : "Ticket addressed by representative.";
                                                    resolveTicket(ticket.id, note);
                                                }}
                                                className="btn-outline py-1.5 px-3 text-[10px] h-auto border-green-500/20 text-green-500 hover:bg-green-500/10 whitespace-nowrap"
                                            >
                                                Mark Resolved
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* New Ticket Modal */}
            {showNewTicketModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowNewTicketModal(false)} />
                    <div className="card w-full max-w-lg p-6 relative z-10 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <FileText size={16} className="text-primary" /> Raise Support Ticket
                            </h2>
                            <button onClick={() => setShowNewTicketModal(false)} className="text-muted hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitTicket} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Target Category</label>
                                    <select
                                        className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                        value={ticketForm.targetCategory}
                                        onChange={e => setTicketForm({ ...ticketForm, targetCategory: e.target.value })}
                                    >
                                        <option value="HR Desk">HR Desk [Accounts/HR]</option>
                                        <option value="Misconduct">Misconduct / Institute Issues</option>
                                        <option value="Academic">Academic / Student Concerns</option>
                                        <option value="Technical">Technical Issues</option>
                                        {isManager && <option value="Attendance Override Request">Attendance Override Request</option>}
                                    </select>
                                </div>

                                {ticketForm.targetCategory === "Attendance Override Request" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">Select Employee</label>
                                            <select
                                                required
                                                className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary"
                                                value={ticketForm.targetEmployeeId}
                                                onChange={e => setTicketForm({ ...ticketForm, targetEmployeeId: e.target.value })}
                                            >
                                                <option value="">Choose Employee...</option>
                                                {myReportees.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">Target Date</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary"
                                                value={ticketForm.targetDate}
                                                onChange={e => setTicketForm({ ...ticketForm, targetDate: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Subject</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary"
                                        placeholder={ticketForm.targetCategory === "Attendance Override Request" ? "Request for Attendance Correction" : "Brief subject of the issue"}
                                        value={ticketForm.subject}
                                        onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Content</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary resize-none"
                                        placeholder="Detailed description..."
                                        value={ticketForm.content}
                                        onChange={e => setTicketForm({ ...ticketForm, content: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest flex justify-between">
                                        <span>Proof {ticketForm.targetCategory === "Attendance Override Request" ? "(Optional)" : "(Mandatory)"}</span>
                                        {proofUrls.length > 0 && <span className="text-green-500">✓ {proofUrls.length} file(s)</span>}
                                    </label>
                                    {!uploading ? (
                                        <div
                                            onClick={() => fileRef.current?.click()}
                                            className={cn("w-full border-2 border-dashed rounded-lg p-4 text-center hover:bg-surface-light transition-colors cursor-pointer group",
                                                proofUrls.length === 0 && ticketForm.targetCategory !== "Attendance Override Request" ? "border-amber-500/30" : "border-green-500/30"
                                            )}
                                        >
                                            <Upload size={20} className="mx-auto text-zinc-600 group-hover:text-primary transition-colors mb-2" />
                                            <p className="text-[10px] font-medium text-muted">Click to upload doc/image proof</p>
                                        </div>
                                    ) : (
                                        <div className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center bg-surface-light animate-pulse">
                                            <Loader2 size={18} className="mx-auto text-primary animate-spin mb-2" />
                                            <p className="text-[10px] font-medium text-primary">Uploading...</p>
                                        </div>
                                    )}
                                    <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleProofUpload} />
                                    {proofUrls.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {proofUrls.map((url, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-2 py-1">
                                                    <span className="text-[9px] text-primary truncate max-w-[100px]">File {i + 1}</span>
                                                    <button type="button" onClick={() => setProofUrls(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-500 font-bold">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <button type="button" onClick={() => setShowNewTicketModal(false)} className="btn-outline text-xs py-2 px-6">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={ticketForm.targetCategory !== "Attendance Override Request" && proofUrls.length === 0}
                                    className="btn-primary text-xs py-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    Submit Ticket <ArrowRight size={14} className="inline ml-1 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
