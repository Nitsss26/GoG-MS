"use client";

import { useAuth, ReimbursementClaim } from "@/context/AuthContext";
import { Receipt, Clock, CheckCircle2, XCircle, Eye, X, Filter, User, Mail, Phone, FileText, Calendar, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ROLE_TAGS: Record<string, { label: string; color: string }> = {
    FACULTY: { label: "Faculty", color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
    OM: { label: "OM", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    HOI: { label: "HOI", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
    TL: { label: "TL", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    AD: { label: "AD", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
    HR: { label: "HR", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    FOUNDER: { label: "Founder", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

export default function HRReimbursementsPage() {
    const { user, employees, reimbursements, updateReimbursementStatus } = useAuth();
    const [reviewClaim, setReviewClaim] = useState<ReimbursementClaim | null>(null);
    const [actionModal, setActionModal] = useState<{ id: string; action: "reject" | "approve-pending" | "approve-done" } | null>(null);
    const [reason, setReason] = useState("");
    const [remarks, setRemarks] = useState("");
    const [imageModal, setImageModal] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("All");

    const now = new Date();
    const [filterMonth, setFilterMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const getRole = (employeeId: string) => {
        const emp = employees.find(e => e.id === employeeId);
        return emp?.role || "FACULTY";
    };

    const filtered = reimbursements
        .filter(r => r.monthYear === filterMonth)
        .filter(r => statusFilter === "All" || r.status === statusFilter)
        .sort((a, b) => {
            const order = ["Pending", "Approved - Pending Payment", "Approved - Payment Done", "Rejected"];
            return order.indexOf(a.status) - order.indexOf(b.status);
        });

    const monthAll = reimbursements.filter(r => r.monthYear === filterMonth);
    const totalAmount = monthAll.reduce((a, r) => a + r.amount, 0);
    const pendingCount = monthAll.filter(r => r.status === "Pending").length;
    const pendingAmount = monthAll.filter(r => r.status === "Pending").reduce((a, r) => a + r.amount, 0);
    const approvedAmount = monthAll.filter(r => r.status.startsWith("Approved")).reduce((a, r) => a + r.amount, 0);
    const approvedCount = monthAll.filter(r => r.status.startsWith("Approved")).length;
    const rejectedAmount = monthAll.filter(r => r.status === "Rejected").reduce((a, r) => a + r.amount, 0);
    const rejectedCount = monthAll.filter(r => r.status === "Rejected").length;

    const handleAction = (id: string, status: ReimbursementClaim["status"], reasonVal?: string, remarksVal?: string) => {
        updateReimbursementStatus(id, status, reasonVal, remarksVal);
        setActionModal(null);
        setReason("");
        setRemarks("");
        setReviewClaim(null);
    };

    const statusConfig: Record<string, { color: string; icon: any; bg: string; border: string }> = {
        "Pending": { color: "text-amber-400", icon: Clock, bg: "bg-amber-500/10", border: "border-amber-500/20" },
        "Approved - Pending Payment": { color: "text-blue-400", icon: CheckCircle2, bg: "bg-blue-500/10", border: "border-blue-500/20" },
        "Approved - Payment Done": { color: "text-green-400", icon: CheckCircle2, bg: "bg-green-500/10", border: "border-green-500/20" },
        "Rejected": { color: "text-red-400", icon: XCircle, bg: "bg-red-500/10", border: "border-red-500/20" },
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight">Reimbursement Management</h1>
                <p className="text-xs text-zinc-400 mt-1">Review and process employee reimbursement claims.</p>
            </header>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <Filter size={14} className="text-zinc-500" />
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white font-bold">
                    {months.map(m => <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white font-bold">
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved - Pending Payment">Approved - Pending Payment</option>
                    <option value="Approved - Payment Done">Approved - Payment Done</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 space-y-1">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Total Claims</p>
                    <p className="text-lg font-bold text-white">{monthAll.length}</p>
                    <p className="text-[9px] text-zinc-600">₹{totalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 space-y-1">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Pending</p>
                    <p className="text-lg font-bold text-amber-400">{pendingCount}</p>
                    <p className="text-[9px] text-amber-500/70">₹{pendingAmount.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 space-y-1">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Approved</p>
                    <p className="text-lg font-bold text-green-400">{approvedCount}</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 space-y-1">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Accepted Amt</p>
                    <p className="text-lg font-bold text-emerald-400">₹{approvedAmount.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 space-y-1">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Rejected</p>
                    <p className="text-lg font-bold text-red-400">{rejectedCount}</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4 space-y-1">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Rejected Amt</p>
                    <p className="text-lg font-bold text-red-400">₹{rejectedAmount.toLocaleString()}</p>
                </div>
            </div>

            {/* Title */}
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">Claims — {new Date(filterMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
                <span className="text-[10px] text-zinc-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Cards Grid */}
            {filtered.length === 0 ? (
                <div className="card p-12 text-center text-xs text-zinc-500 italic">No claims for this period.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filtered.map(r => {
                            const sc = statusConfig[r.status] || statusConfig["Pending"];
                            const Icon = sc.icon;
                            const role = getRole(r.employeeId);
                            const roleTag = ROLE_TAGS[role] || ROLE_TAGS["FACULTY"];
                            return (
                                <motion.div key={r.id} layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-700/50 transition-all group">
                                    {/* Card Top Bar */}
                                    <div className={cn("h-1 w-full", r.status === "Pending" ? "bg-amber-500" : r.status === "Rejected" ? "bg-red-500" : r.status === "Approved - Payment Done" ? "bg-green-500" : "bg-blue-500")} />

                                    <div className="p-4 space-y-3">
                                        {/* Header: Name + Role Tag + Status */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">{r.employeeName[0]}</div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-bold text-white truncate">{r.employeeName}</h4>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded-full border uppercase", roleTag.color)}>{roleTag.label}</span>
                                                        <span className="text-[9px] text-zinc-600">{r.employeeId}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={cn("text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0", sc.bg, sc.border, sc.color)}>
                                                {r.status === "Approved - Pending Payment" ? "Pending Pay" : r.status === "Approved - Payment Done" ? "Paid" : r.status}
                                            </span>
                                        </div>

                                        {/* Expense Info */}
                                        <div className="bg-zinc-800/30 rounded-xl p-3 space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase">{r.type}</span>
                                                <span className="text-sm font-bold text-white">₹{r.amount.toLocaleString()}</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">{r.description}</p>
                                            <p className="text-[9px] text-zinc-600">{r.monthYear} · Submitted {r.date}</p>
                                        </div>

                                        {/* Remarks */}
                                        {r.rejectionReason && <p className="text-[9px] text-red-400 italic bg-red-500/5 p-2 rounded-lg border border-red-500/10 line-clamp-2">❌ {r.rejectionReason}</p>}
                                        {r.hrRemarks && <p className="text-[9px] text-blue-400 italic bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 line-clamp-2">💬 {r.hrRemarks}</p>}

                                        {/* Proof Thumbnails */}
                                        {r.proofUrls && r.proofUrls.length > 0 && (
                                            <div className="flex gap-1.5">
                                                {r.proofUrls.slice(0, 3).map((url, i) => (
                                                    <img key={i} src={url} alt="" className="w-10 h-10 object-cover rounded-lg border border-zinc-800 cursor-pointer hover:border-primary/50" onClick={() => setImageModal(url)} />
                                                ))}
                                                {r.proofUrls.length > 3 && <span className="text-[8px] text-zinc-500 self-center">+{r.proofUrls.length - 3}</span>}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                                            <button onClick={() => setReviewClaim(r)} className="flex-1 py-2 text-[10px] font-bold bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 rounded-xl hover:bg-zinc-700/50 flex items-center justify-center gap-1 transition-colors"><Eye size={10} /> Review</button>
                                            {r.status === "Pending" && (
                                                <>
                                                    <button onClick={() => { setActionModal({ id: r.id, action: "approve-pending" }); setRemarks(""); }} className="flex-1 py-2 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl hover:bg-green-500/20 transition-colors">Approve</button>
                                                    <button onClick={() => { setActionModal({ id: r.id, action: "reject" }); setReason(""); setRemarks(""); }} className="flex-1 py-2 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors">Reject</button>
                                                </>
                                            )}
                                            {r.status === "Approved - Pending Payment" && (
                                                <button onClick={() => handleAction(r.id, "Approved - Payment Done", undefined, "Payment processed.")} className="flex-1 py-2 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-colors">Payment Done</button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Review Detail Modal */}
            <AnimatePresence>
                {reviewClaim && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReviewClaim(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative z-10 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
                            <div className="flex justify-between items-start">
                                <h2 className="text-base font-bold text-white flex items-center gap-2"><Receipt size={16} className="text-primary" /> Claim Review</h2>
                                <button onClick={() => setReviewClaim(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                            </div>

                            {/* Employee Info */}
                            <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Employee Information</h3>
                                    {(() => { const role = getRole(reviewClaim.employeeId); const tag = ROLE_TAGS[role] || ROLE_TAGS["FACULTY"]; return <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded-full border uppercase", tag.color)}>{tag.label}</span>; })()}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="flex items-center gap-2"><User size={12} className="text-zinc-500" /><span className="text-white font-bold">{reviewClaim.employeeName}</span></div>
                                    <div className="flex items-center gap-2"><Mail size={12} className="text-zinc-500" /><span className="text-zinc-400">{reviewClaim.email}</span></div>
                                    <div className="flex items-center gap-2"><Phone size={12} className="text-zinc-500" /><span className="text-zinc-400">{reviewClaim.phone}</span></div>
                                    <div className="flex items-center gap-2"><Calendar size={12} className="text-zinc-500" /><span className="text-zinc-400">{reviewClaim.date}</span></div>
                                </div>
                            </div>

                            {/* Claim Details */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Expense Type</p><p className="text-white font-bold">{reviewClaim.type}</p></div>
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Amount</p><p className="text-white font-bold text-lg">₹{reviewClaim.amount.toLocaleString()}</p></div>
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Month</p><p className="text-white">{reviewClaim.monthYear}</p></div>
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Status</p><p className={(statusConfig[reviewClaim.status]?.color || "text-white") + " font-bold"}>{reviewClaim.status}</p></div>
                            </div>

                            <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Description</p><p className="text-xs text-zinc-300 leading-relaxed mt-1">{reviewClaim.description}</p></div>

                            {reviewClaim.rejectionReason && <p className="text-[10px] text-red-400 italic bg-red-500/5 p-3 rounded-lg border border-red-500/10">❌ Rejection: {reviewClaim.rejectionReason}</p>}
                            {reviewClaim.hrRemarks && <p className="text-[10px] text-blue-400 italic bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">💬 HR Remarks: {reviewClaim.hrRemarks}</p>}

                            {reviewClaim.driveLink && <a href={reviewClaim.driveLink} target="_blank" rel="noopener" className="text-[10px] text-primary flex items-center gap-1 hover:underline"><FileText size={10} /> Google Drive Folder ↗</a>}

                            {/* Proof Images */}
                            {reviewClaim.proofUrls && reviewClaim.proofUrls.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase">Proof / Invoices ({reviewClaim.proofUrls.length} files)</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {reviewClaim.proofUrls.map((url, i) => (
                                            <img key={i} src={url} alt={`Proof ${i + 1}`} onClick={() => setImageModal(url)} className="w-full h-28 object-cover rounded-lg border border-zinc-800 cursor-pointer hover:border-primary/50 transition-colors" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {reviewClaim.status === "Pending" && (
                                <div className="flex gap-2 pt-3 border-t border-zinc-800">
                                    <button onClick={() => { setActionModal({ id: reviewClaim.id, action: "approve-pending" }); setRemarks(""); }} className="flex-1 py-2.5 text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl hover:bg-green-500/20 transition-colors">Approve</button>
                                    <button onClick={() => { setActionModal({ id: reviewClaim.id, action: "reject" }); setReason(""); setRemarks(""); }} className="flex-1 py-2.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors">Reject</button>
                                </div>
                            )}
                            {reviewClaim.status === "Approved - Pending Payment" && (
                                <div className="pt-3 border-t border-zinc-800">
                                    <button onClick={() => { handleAction(reviewClaim.id, "Approved - Payment Done", undefined, "Payment processed."); }} className="w-full py-2.5 text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-colors">Mark Payment Done</button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Approve / Reject Action Modal */}
            <AnimatePresence>
                {actionModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative z-10 space-y-4 shadow-2xl">
                            <div className={cn("absolute top-0 left-0 w-full h-1 rounded-t-2xl", actionModal.action === "reject" ? "bg-red-500" : "bg-green-500")} />
                            <h2 className="text-base font-bold text-white">
                                {actionModal.action === "reject" ? "Reject with Reason" : "Approve — Pending Payment"}
                            </h2>
                            {actionModal.action === "reject" && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Rejection Reason *</label>
                                    <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide reason for rejection..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white resize-none" />
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">HR Remarks (optional)</label>
                                <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add any additional remarks..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white resize-none" />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setActionModal(null)} className="px-4 py-2 text-xs text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800">Cancel</button>
                                {actionModal.action === "reject" ? (
                                    <button onClick={() => { if (reason.trim()) handleAction(actionModal.id, "Rejected", reason, remarks || undefined); }}
                                        disabled={!reason.trim()}
                                        className="bg-red-500/20 text-red-400 text-xs font-bold px-4 py-2 rounded-lg border border-red-500/20 hover:bg-red-500/30 disabled:opacity-50">Reject</button>
                                ) : (
                                    <button onClick={() => handleAction(actionModal.id, "Approved - Pending Payment", undefined, remarks || undefined)}
                                        className="bg-green-500/20 text-green-400 text-xs font-bold px-4 py-2 rounded-lg border border-green-500/20 hover:bg-green-500/30">Approve</button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Full Image Modal */}
            <AnimatePresence>
                {imageModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90" />
                        <motion.img initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} src={imageModal} className="relative z-10 max-w-[90vw] max-h-[85vh] rounded-xl object-contain" />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
