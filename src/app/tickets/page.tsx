"use client";

import { useState, useRef } from "react";
import { NORMAL_ISSUES, EXISTING_CATEGORIES, ATTENDANCE_ISSUES, ATTENDANCE_TICKET_CATEGORY, ATTENDANCE_OVERRIDE_CATEGORY, TICKET_TYPE_LABEL, ticketTypeOf, ticketIssueOf } from "@/lib/ticket-types";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { AlertCircle, Clock, CheckCircle2, MessageSquare, Plus, FileText, ArrowRight, Upload, Loader2, X, Image as ImageIcon, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TicketsPage() {
    const { user, raiseTicket, resolveTicket, updateTicket, addADRemarks, forwardTicket, tickets, getReportees, employees, restoreAttendanceCredits, pipRecords } = useAuth();
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const blankForm = () => ({
        ticketType: "NORMAL" as "NORMAL" | "ATTENDANCE",
        targetCategory: "HR Desk",          // existing category (desk) — drives routing and the ticket ID
        issueCategory: "",                  // the issue chosen in the category dropdown
        subject: "",
        content: "",
        targetEmployeeIds: [] as string[],
        targetDate: new Date().toISOString().split('T')[0],
        attendanceDate: new Date().toISOString().split('T')[0],
        issueTime: "",
    });
    const [ticketForm, setTicketForm] = useState(blankForm());
    // Dashboard: tabs + filters
    const [typeTab, setTypeTab] = useState<"ALL" | "NORMAL" | "ATTENDANCE">("ALL");
    const [fCategory, setFCategory] = useState("All");
    const [fEmployee, setFEmployee] = useState("");
    const [fDate, setFDate] = useState("");
    const [fStatus, setFStatus] = useState("All");
    const [fHandler, setFHandler] = useState("All");
    const [ticketError, setTicketError] = useState("");
    const [proofUrls, setProofUrls] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [resolutionModal, setResolutionModal] = useState<{ show: boolean, ticketId: string, ticketSubject: string, category: string, targetEmp?: string, targetDate?: string } | null>(null);
    const [resolutionRemarks, setResolutionRemarks] = useState("");
    const [isResolving, setIsResolving] = useState(false);
    const [forwardModal, setForwardModal] = useState<{ show: boolean, ticketId: string, ticketSubject: string } | null>(null);
    const [forwardTarget, setForwardTarget] = useState("");
    const [forwardRemarks, setForwardRemarks] = useState("");
    const [isForwarding, setIsForwarding] = useState(false);
    const [adRemarksModal, setAdRemarksModal] = useState<{ show: boolean, ticketId: string, ticketSubject: string } | null>(null);
    const [adRemarksText, setAdRemarksText] = useState("");
    const [isSavingRemarks, setIsSavingRemarks] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    if (!user) return null;

    const reportees = getReportees(user.id);
    const reporteeIds = reportees.map(r => r.id);
    const isUserInPIP = pipRecords.some(p => p.employeeId === user.id && p.status === "Active");
    const isHR = user.role === "HR";
    const isFounder = user.role === "FOUNDER";
    const isAD = user.role === "AD";
    const isSystemAdmin = isHR || isFounder || isAD;
    const isHOI = user.role === "HOI";

    const myTickets = tickets.filter(t => t.raisedBy === user.id || reporteeIds.includes(t.raisedBy)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Show all tickets to HR, Founder, and AD
    const displayTickets = (isHR || isFounder || isAD) 
        ? tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) 
        : myTickets;

    // ── Dashboard filters (type tab, category, employee, date, status, handler) ──
    const nameOf = (id?: string) => (id ? employees.find(e => e.id === id)?.name || id : "");
    const typedTickets = displayTickets.filter(t => typeTab === "ALL" || ticketTypeOf(t) === typeTab);
    const categoryOptions = Array.from(new Set(displayTickets.filter(t => typeTab === "ALL" || ticketTypeOf(t) === typeTab).map(ticketIssueOf).filter(Boolean))).sort();
    const handlerOptions = Array.from(new Set(displayTickets.map(t => t.routeTo).filter(Boolean) as string[]));
    const filteredTickets = typedTickets.filter(t =>
        (fCategory === "All" || ticketIssueOf(t) === fCategory)
        && (!fEmployee.trim() || `${t.employeeName} ${t.raisedBy}`.toLowerCase().includes(fEmployee.trim().toLowerCase()))
        && (!fDate || String(t.createdAt || "").slice(0, 10) === fDate || t.attendanceDate === fDate)
        && (fStatus === "All" || (fStatus === "Pending" ? t.status === "In Progress" : t.status === fStatus))
        && (fHandler === "All" || t.routeTo === fHandler));
    const fmtTs = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

    const handleSubmitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        // Proof is mandatory for ALL tickets now
        if (proofUrls.length === 0) return;

        if (!ticketForm.issueCategory) { setTicketError(ticketForm.ticketType === "ATTENDANCE" ? "Select the attendance issue." : "Select the ticket category."); return; }
        if (ticketForm.ticketType === "ATTENDANCE" && ticketForm.targetCategory !== ATTENDANCE_OVERRIDE_CATEGORY && !ticketForm.attendanceDate) { setTicketError("Select the attendance date."); return; }
        setTicketError("");
        const extra = ticketForm.ticketType === "ATTENDANCE" && ticketForm.targetCategory !== ATTENDANCE_OVERRIDE_CATEGORY
            ? { ticketType: "ATTENDANCE" as const, issueCategory: ticketForm.issueCategory, attendanceDate: ticketForm.attendanceDate, issueTime: ticketForm.issueTime || undefined }
            : { ticketType: ticketForm.ticketType, issueCategory: ticketForm.issueCategory };
        setIsSubmitting(true);
        try {
            if (ticketForm.targetCategory === "Attendance Override Request") {
                const targets = ticketForm.targetEmployeeIds.length > 0 ? ticketForm.targetEmployeeIds : [user.id];
                for (const targetId of targets) {
                    await raiseTicket(
                        ticketForm.targetCategory as any,
                        ticketForm.subject,
                        ticketForm.content,
                        undefined,
                        undefined,
                        proofUrls,
                        targetId,
                        ticketForm.targetDate,
                        extra
                    );
                }
            } else {
                await raiseTicket(
                    ticketForm.targetCategory as any,
                    ticketForm.subject,
                    ticketForm.content,
                    undefined,
                    undefined,
                    proofUrls,
                    undefined,
                    undefined,
                    extra
                );
            }

            setShowNewTicketModal(false);
            setTicketForm(blankForm());
            setProofUrls([]);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        setIsUploading(true);
        try {
            for (const file of Array.from(files)) {
                const res = await uploadToCloudinary(file);
                setProofUrls(prev => [...prev, res.secure_url]);
            }
        } catch (err) { console.error(err); }
        setIsUploading(false);
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="ticket-cards">
                {[
                    { k: "total", label: "Total Tickets", value: displayTickets.length, color: "text-white" },
                    { k: "normal", label: "Normal Tickets", value: displayTickets.filter(t => ticketTypeOf(t) === "NORMAL").length, color: "text-sky-400" },
                    { k: "attendance", label: "Attendance Tickets", value: displayTickets.filter(t => ticketTypeOf(t) === "ATTENDANCE").length, color: "text-violet-400" },
                    { k: "open", label: "Open Tickets", value: displayTickets.filter(t => t.status === "Open").length, color: "text-amber-500" },
                    { k: "pending", label: "Pending Tickets", value: displayTickets.filter(t => t.status === "In Progress").length, color: "text-blue-500" },
                    { k: "resolved", label: "Resolved Tickets", value: displayTickets.filter(t => t.status === "Resolved").length, color: "text-green-500" },
                ].map(c => (
                    <div key={c.k} className="card p-4 space-y-1" data-testid={`ticket-card-${c.k}`}>
                        <p className="text-[9px] text-muted font-bold uppercase tracking-widest">{c.label}</p>
                        <p className={cn("text-lg font-bold", c.color)} data-testid={`ticket-card-${c.k}-value`}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Ticket Stream */}
            <div className="card">
                <div className="p-4 border-b border-border space-y-3 bg-surface-light/50">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <h3 className="text-sm font-semibold text-white">Active Queue</h3>
                        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5" data-testid="ticket-tabs">
                            {([["ALL", "All Tickets"], ["NORMAL", "Normal Tickets"], ["ATTENDANCE", "Attendance Tickets"]] as const).map(([k, l]) => (
                                <button key={k} onClick={() => { setTypeTab(k); setFCategory("All"); }} data-testid={`ticket-tab-${k}`}
                                    className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold transition-all", typeTab === k ? "bg-primary/15 text-primary" : "text-zinc-500 hover:text-white")}>{l}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]" data-testid="ticket-filters">
                        <select value={fCategory} onChange={e => setFCategory(e.target.value)} data-testid="ticket-filter-category" className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white outline-none">
                            <option value="All">Category: All</option>
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={fEmployee} onChange={e => setFEmployee(e.target.value)} placeholder="Employee name / ID" data-testid="ticket-filter-employee" className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white outline-none w-40" />
                        <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} title="Ticket date / attendance date" data-testid="ticket-filter-date" className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white outline-none [color-scheme:dark]" />
                        <select value={fStatus} onChange={e => setFStatus(e.target.value)} data-testid="ticket-filter-status" className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white outline-none">
                            <option value="All">Status: All</option><option value="Open">Open</option><option value="Pending">Pending (In Progress)</option><option value="Resolved">Resolved</option>
                        </select>
                        <select value={fHandler} onChange={e => setFHandler(e.target.value)} data-testid="ticket-filter-handler" className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white outline-none">
                            <option value="All">Handler: All</option>
                            {handlerOptions.map(h => <option key={h} value={h}>{nameOf(h)}</option>)}
                        </select>
                        {(fCategory !== "All" || fEmployee || fDate || fStatus !== "All" || fHandler !== "All") && (
                            <button onClick={() => { setFCategory("All"); setFEmployee(""); setFDate(""); setFStatus("All"); setFHandler("All"); }} className="text-zinc-400 hover:text-white px-1">Clear</button>
                        )}
                    </div>
                </div>
                <div className="divide-y divide-border">
                    {filteredTickets.length === 0 ? (
                        <div className="p-12 text-center text-xs text-muted font-medium italic">
                            No tickets registered in the current pipeline.
                        </div>
                    ) : (
                        filteredTickets.map((ticket) => {
                            const targetEmp = ticket.targetEmployeeId ? employees.find(e => e.id === ticket.targetEmployeeId) : null;
                            return (
                                <div key={ticket.id} data-testid="ticket-row" data-id={ticket.id} className="p-5 flex items-start gap-4 group hover:bg-surface-light/50 transition-colors">
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
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[9px]">
                                                    <span data-testid="ticket-type" className={cn("px-1.5 py-0.5 rounded border font-black uppercase tracking-wider", ticketTypeOf(ticket) === "ATTENDANCE" ? "border-violet-500/30 bg-violet-500/10 text-violet-300" : "border-sky-500/30 bg-sky-500/10 text-sky-300")}>{TICKET_TYPE_LABEL[ticketTypeOf(ticket)]}</span>
                                                    <span data-testid="ticket-issue" className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/60 text-zinc-300 font-bold">{ticketIssueOf(ticket)}</span>
                                                    {ticket.attendanceDate && <span className="text-zinc-400">Attendance date: <b className="text-zinc-200">{ticket.attendanceDate}</b>{ticket.issueTime ? ` · ${ticket.issueTime}` : ""}</span>}
                                                    {ticket.routeTo && <span className="text-zinc-500">Handler: <b className="text-zinc-300">{nameOf(ticket.routeTo)}</b></span>}
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
                                        {ticket.proofUrls && ticket.proofUrls.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {ticket.proofUrls.map((url, i) => {
                                                    let isPdf = url.toLowerCase().endsWith('.pdf');
                                                    let isCloudinary = url.includes('cloudinary.com');
                                                    let previewUrl = url;
                                                    if (!isPdf && !url.match(/\.[a-zA-Z0-9]+$/)) previewUrl += '.jpg';
                                                    else if (isPdf && isCloudinary) previewUrl = url.replace(/\.pdf$/i, '.jpg');

                                                    return (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-9 h-9 relative group">
                                                            {isPdf && !isCloudinary ? (
                                                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 rounded-md border border-zinc-700 group-hover:border-primary transition-colors">
                                                                    <FileText size={14} className="text-zinc-500" />
                                                                </div>
                                                            ) : (
                                                                <img src={previewUrl} alt={`Proof ${i + 1}`} className="w-full h-full object-cover rounded-md border border-zinc-700 group-hover:border-primary transition-colors" />
                                                            )}
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {ticket.resolutionNotes && (
                                            <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                                                <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-widest">Resolution Notes</p>
                                                <p className="text-[11px] text-zinc-300 font-medium">{ticket.resolutionNotes}</p>
                                            </div>
                                        )}
                                        {(ticket.resolvedByName || (ticket.statusHistory && ticket.statusHistory.length > 0)) && (
                                            <details className="text-[10px] text-zinc-400" data-testid="ticket-history">
                                                <summary className="cursor-pointer text-zinc-500 font-bold uppercase tracking-widest text-[9px]">
                                                    History{ticket.resolvedByName ? ` · Resolved by ${ticket.resolvedByName}${ticket.resolvedAt ? ` on ${fmtTs(ticket.resolvedAt)}` : ""}` : ""}
                                                </summary>
                                                <div className="mt-1.5 space-y-1">
                                                    {(ticket.statusHistory || []).map((h, i) => (
                                                        <div key={i} className="bg-zinc-800/30 border border-zinc-700/30 rounded px-2 py-1">
                                                            <span className="font-bold text-zinc-300">{h.action}</span> · {h.byName}{h.role ? ` (${h.role})` : ""} · {fmtTs(h.at)}{h.remarks ? <span className="italic"> — “{h.remarks}”</span> : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                        {ticket.adRemarks && (
                                            <div className="bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10">
                                                <p className="text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-widest">AD Remarks</p>
                                                <p className="text-[11px] text-zinc-300 font-medium italic">"{ticket.adRemarks}"</p>
                                            </div>
                                        )}
                                        {ticket.forwardHistory && ticket.forwardHistory.length > 0 && (
                                            <div className="space-y-2 mt-2">
                                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Forward History</p>
                                                {ticket.forwardHistory.map((h, i) => {
                                                    const toEmp = employees.find(e => e.id === h.forwardedTo);
                                                    const byEmp = employees.find(e => e.id === h.forwardedBy);
                                                    return (
                                                        <div key={i} className="text-[9px] text-zinc-500 bg-zinc-800/30 p-2 rounded border border-zinc-700/30">
                                                            <span className="font-bold text-zinc-400">{byEmp?.name}</span> forwarded to <span className="font-bold text-indigo-400">{toEmp?.name}</span>
                                                            <div className="mt-1 text-zinc-500 italic">"{h.remarks}"</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {(isHR || (ticket.routeTo === user.id && ticket.status !== "Resolved")) && (
                                            <button
                                                onClick={() => {
                                                    const defaultNote = ticket.targetCategory === "Attendance Override Request" 
                                                        ? `Attendance overridden for ${targetEmp?.name} on ${ticket.targetDate}.` 
                                                        : "";
                                                    setResolutionRemarks(defaultNote);
                                                    setResolutionModal({ 
                                                        show: true, 
                                                        ticketId: ticket.id, 
                                                        ticketSubject: ticket.subject,
                                                        category: ticket.targetCategory,
                                                        targetEmp: targetEmp?.name,
                                                        targetDate: ticket.targetDate
                                                    });
                                                }}
                                                className="btn-outline py-1.5 px-3 text-[10px] h-auto border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 whitespace-nowrap flex items-center gap-2"
                                            >
                                                <CheckCircle2 size={12} /> Resolve Ticket
                                            </button>
                                        )}
                                        {(isHR || ticket.routeTo === user.id) && ticket.status === "Open" && (
                                            <button
                                                onClick={() => updateTicket(ticket.id, { status: "In Progress" })}
                                                data-testid="ticket-in-progress"
                                                className="btn-outline py-1.5 px-3 text-[10px] h-auto border-blue-500/20 text-blue-400 hover:bg-blue-500/10 whitespace-nowrap flex items-center gap-2"
                                            >
                                                <Clock size={12} /> Mark In Progress
                                            </button>
                                        )}
                                        {isHR && ticket.status !== "Resolved" && (
                                            <button
                                                onClick={() => {
                                                    setForwardModal({ show: true, ticketId: ticket.id, ticketSubject: ticket.subject });
                                                    setForwardTarget("");
                                                    setForwardRemarks("");
                                                }}
                                                className="btn-outline py-1.5 px-3 text-[10px] h-auto border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 whitespace-nowrap flex items-center gap-2"
                                            >
                                                <ArrowRight size={12} /> Forward
                                            </button>
                                        )}
                                        {isAD && (
                                            <button
                                                onClick={() => {
                                                    setAdRemarksModal({ show: true, ticketId: ticket.id, ticketSubject: ticket.subject });
                                                    setAdRemarksText(ticket.adRemarks || "");
                                                }}
                                                className="btn-outline py-1.5 px-3 text-[10px] h-auto border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 whitespace-nowrap flex items-center gap-2"
                                            >
                                                <MessageSquare size={12} /> Add Remarks
                                            </button>
                                        )}
                                    </div>
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
                    <div className="card w-full max-w-lg p-6 relative z-10 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto" data-testid="ticket-modal">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <FileText size={16} className="text-primary" /> {ticketForm.ticketType === "ATTENDANCE" ? "Raise Attendance Ticket" : "Raise Support Ticket"}
                            </h2>
                            <button onClick={() => setShowNewTicketModal(false)} className="text-muted hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitTicket} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Ticket Type</label>
                                    <select
                                        data-testid="ticket-type-select"
                                        className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                        value={ticketForm.ticketType}
                                        onChange={e => {
                                            const t = e.target.value as "NORMAL" | "ATTENDANCE";
                                            setTicketForm({ ...ticketForm, ticketType: t, issueCategory: "", targetCategory: t === "ATTENDANCE" ? ATTENDANCE_TICKET_CATEGORY : "HR Desk" });
                                        }}
                                    >
                                        <option value="NORMAL">Normal Ticket</option>
                                        <option value="ATTENDANCE">Attendance / Clock-In &amp; Clock-Out Ticket</option>
                                    </select>
                                </div>
                                {ticketForm.ticketType === "NORMAL" ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Ticket Category</label>
                                            <select
                                                data-testid="ticket-category-select"
                                                required
                                                className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                                value={ticketForm.issueCategory}
                                                onChange={e => {
                                                    const issue = NORMAL_ISSUES.find(i => i.label === e.target.value);
                                                    // choosing an issue pre-selects the desk that handles it (the desk can still be changed)
                                                    setTicketForm({ ...ticketForm, issueCategory: e.target.value, targetCategory: issue?.route || ticketForm.targetCategory || "HR Desk" });
                                                }}
                                            >
                                                <option value="">Select Category</option>
                                                {NORMAL_ISSUES.map(i => <option key={i.label} value={i.label}>{i.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Desk</label>
                                            <select
                                                data-testid="ticket-desk-select"
                                                required
                                                className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                                value={ticketForm.targetCategory}
                                                onChange={e => setTicketForm({ ...ticketForm, targetCategory: e.target.value })}
                                            >
                                                {EXISTING_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-1.5 col-span-2">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Select Attendance Issue</label>
                                        <select
                                            data-testid="ticket-category-select"
                                            required
                                            className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                            value={ticketForm.issueCategory ? `${ticketForm.targetCategory}||${ticketForm.issueCategory}` : ""}
                                            onChange={e => {
                                                const [cat, issue] = e.target.value.split("||");
                                                setTicketForm({ ...ticketForm, targetCategory: cat || ATTENDANCE_TICKET_CATEGORY, issueCategory: issue || "" });
                                            }}
                                        >
                                            <option value="">Select Attendance Issue</option>
                                            {ATTENDANCE_ISSUES.map(i => <option key={i} value={`${ATTENDANCE_TICKET_CATEGORY}||${i}`}>{i}</option>)}
                                            <option value={`${ATTENDANCE_OVERRIDE_CATEGORY}||${ATTENDANCE_OVERRIDE_CATEGORY}`}>{ATTENDANCE_OVERRIDE_CATEGORY}</option>
                                        </select>
                                    </div>
                                )}

                                {ticketForm.ticketType === "ATTENDANCE" && ticketForm.targetCategory !== ATTENDANCE_OVERRIDE_CATEGORY && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Attendance Date</label>
                                            <input type="date" required data-testid="ticket-attendance-date" max={new Date().toISOString().split('T')[0]}
                                                className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary [color-scheme:dark]"
                                                value={ticketForm.attendanceDate} onChange={e => setTicketForm({ ...ticketForm, attendanceDate: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Issue Time</label>
                                            <input type="time" data-testid="ticket-issue-time"
                                                className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary [color-scheme:dark]"
                                                value={ticketForm.issueTime} onChange={e => setTicketForm({ ...ticketForm, issueTime: e.target.value })} />
                                        </div>
                                    </>
                                )}

                                {ticketForm.targetCategory === "Attendance Override Request" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">Select Employee</label>
                                            {isHOI ? (
                                                <select
                                                    required
                                                    multiple
                                                    className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary h-28"
                                                    value={ticketForm.targetEmployeeIds}
                                                    onChange={e => {
                                                        const opts = Array.from(e.target.selectedOptions, option => option.value);
                                                        setTicketForm({ ...ticketForm, targetEmployeeIds: opts });
                                                    }}
                                                >
                                                    <option value={user.id}>{user.name} (Yourself)</option>
                                                    {reportees.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <select
                                                    required
                                                    disabled
                                                    className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-zinc-500 outline-none cursor-not-allowed"
                                                    value={user.id}
                                                >
                                                    <option value={user.id}>{user.name} (Yourself)</option>
                                                </select>
                                            )}
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
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Description</label>
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
                                        <span>Proof (Mandatory)</span>
                                        {proofUrls.length > 0 && <span className="text-green-500">✓ {proofUrls.length} file(s)</span>}
                                    </label>
                                    {!isUploading ? (
                                        <div
                                            onClick={() => fileRef.current?.click()}
                                            className={cn("w-full border-2 border-dashed rounded-lg p-4 text-center hover:bg-surface-light transition-colors cursor-pointer group",
                                                proofUrls.length === 0 ? "border-amber-500/30" : "border-green-500/30"
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
                            {ticketError && <p className="text-[11px] text-red-400" data-testid="ticket-error">{ticketError}</p>}
                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <button type="button" onClick={() => setShowNewTicketModal(false)} className="btn-outline text-xs py-2 px-6">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={proofUrls.length === 0 || isSubmitting}
                                    className="btn-primary text-xs py-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed group min-w-[140px]"
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={14} className="animate-spin inline mr-2" />
                                    ) : (
                                        ticketForm.ticketType === "ATTENDANCE" ? "Submit Attendance Ticket" : "Submit Ticket"
                                    )}
                                    {!isSubmitting && <ArrowRight size={14} className="inline ml-1 group-hover:translate-x-1 transition-transform" />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Resolution Modal */}
            <AnimatePresence>
                {resolutionModal?.show && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResolutionModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-sm p-6 relative z-10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Resolve Ticket</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[200px]">{resolutionModal.ticketSubject}</p>
                                </div>
                            </div>

                            {resolutionModal.category === "Attendance Override Request" && (
                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                    <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 items-center flex gap-1">
                                        <Clock size={10} /> Attendance Correction
                                    </p>
                                    <p className="text-[11px] text-zinc-300 font-medium">Validating override for <span className="text-white font-bold">{resolutionModal.targetEmp}</span> on <span className="text-white font-bold">{resolutionModal.targetDate}</span>.</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Resolution Remarks (Mandatory)</label>
                                <textarea 
                                    autoFocus
                                    className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary resize-none h-24"
                                    placeholder="Briefly describe how this issue was resolved..."
                                    value={resolutionRemarks}
                                    onChange={e => setResolutionRemarks(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setResolutionModal(null)} className="flex-1 btn-outline text-[10px] py-2.5">Cancel</button>
                                <button 
                                    disabled={isResolving || !resolutionRemarks.trim()}
                                    onClick={async () => {
                                        setIsResolving(true);
                                        try {
                                            await resolveTicket(resolutionModal.ticketId, resolutionRemarks);
                                            setResolutionModal(null);
                                            setResolutionRemarks("");
                                        } finally { setIsResolving(false); }
                                    }}
                                    className={cn("flex-1 text-[10px] font-bold py-2.5 rounded-lg transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20", 
                                        (isResolving || !resolutionRemarks.trim()) && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isResolving ? "Processing..." : "Confirm Resolution"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Forward Ticket Modal */}
            <AnimatePresence>
                {forwardModal?.show && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setForwardModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-sm p-6 relative z-10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                    <ArrowRight size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Forward Ticket</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[200px]">{forwardModal.ticketSubject}</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Select Recipient</label>
                                <select 
                                    className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary"
                                    value={forwardTarget}
                                    onChange={e => setForwardTarget(e.target.value)}
                                >
                                    <option value="">Select Official...</option>
                                    <optgroup label="Associate Directors">
                                        {employees.filter(e => e.role === "AD").map(e => (
                                            <option key={e.id} value={e.id}>{e.name} (AD)</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Heads of Institute">
                                        {employees.filter(e => e.role === "HOI").map(e => (
                                            <option key={e.id} value={e.id}>{e.name} (HOI) - {e.location}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Tech Leads">
                                        {employees.filter(e => e.role === "TL").map(e => (
                                            <option key={e.id} value={e.id}>{e.name} (TL)</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Forwarding Remarks</label>
                                <textarea 
                                    className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary resize-none h-24"
                                    placeholder="Why are you forwarding this?..."
                                    value={forwardRemarks}
                                    onChange={e => setForwardRemarks(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setForwardModal(null)} className="flex-1 btn-outline text-[10px] py-2.5">Cancel</button>
                                <button 
                                    disabled={isForwarding || !forwardTarget || !forwardRemarks.trim()}
                                    onClick={async () => {
                                        setIsForwarding(true);
                                        try {
                                            await forwardTicket(forwardModal.ticketId, forwardTarget, forwardRemarks);
                                            setForwardModal(null);
                                        } finally { setIsForwarding(false); }
                                    }}
                                    className={cn("flex-1 text-[10px] font-bold py-2.5 rounded-lg transition-all bg-indigo-600 text-white hover:bg-indigo-700", 
                                        (isForwarding || !forwardTarget || !forwardRemarks.trim()) && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isForwarding ? "Forwarding..." : "Forward Ticket"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* AD Remarks Modal */}
            <AnimatePresence>
                {adRemarksModal?.show && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAdRemarksModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-sm p-6 relative z-10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">AD Remarks</h3>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[200px]">{adRemarksModal.ticketSubject}</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Official Comments</label>
                                <textarea 
                                    autoFocus
                                    className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white outline-none focus:border-primary resize-none h-24"
                                    placeholder="Add your remarks here..."
                                    value={adRemarksText}
                                    onChange={e => setAdRemarksText(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setAdRemarksModal(null)} className="flex-1 btn-outline text-[10px] py-2.5">Cancel</button>
                                <button 
                                    disabled={isSavingRemarks || !adRemarksText.trim()}
                                    onClick={async () => {
                                        setIsSavingRemarks(true);
                                        try {
                                            await addADRemarks(adRemarksModal.ticketId, adRemarksText);
                                            setAdRemarksModal(null);
                                        } finally { setIsSavingRemarks(false); }
                                    }}
                                    className={cn("flex-1 text-[10px] font-bold py-2.5 rounded-lg transition-all bg-indigo-600 text-white hover:bg-indigo-700", 
                                        (isSavingRemarks || !adRemarksText.trim()) && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isSavingRemarks ? "Saving..." : "Save Remarks"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}