"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, CheckCircle2, XCircle, X, Clock, HelpCircle, AlertCircle, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LeavePage() {
    const { user, leaves, addLeaveRequest, approveLeave, rejectLeave } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        type: "Casual Leave",
        startDate: "",
        endDate: "",
        days: 1,
        classification: "Paid" as "Paid" | "Unpaid",
        leaveType: "Planned" as "Planned" | "Emergency",
        emergencyCategory: undefined as "Accident" | "Death" | "In Hospital" | undefined
    });
    const [proofUrls, setProofUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const proofInputRef = useRef<HTMLInputElement>(null);

    if (!user) return null;

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.leaveType === "Planned") {
            const now = new Date();
            const startD = new Date(formData.startDate);
            // Start date must be at least tomorrow
            if (startD.toDateString() === now.toDateString() || startD < now) {
                alert("Planned Leaves must be applied at least 1 day in advance.");
                return;
            }
            // Working hours: 9AM - 7PM
            const hour = now.getHours();
            if (hour < 9 || hour >= 19) {
                alert("Planned Leaves can only be applied during working hours (9 AM - 7 PM).");
                return;
            }
        }

        if (formData.leaveType === "Emergency") {
            if (!formData.emergencyCategory) {
                alert("Please select an emergency category.");
                return;
            }
            if (proofUrls.length === 0) {
                alert("Proof upload is mandatory for emergency leaves.");
                return;
            }
        }

        addLeaveRequest({ ...formData, proofUrls: proofUrls.length > 0 ? proofUrls : undefined });
        setShowModal(false);
        setFormData({
            type: "Casual Leave",
            startDate: "",
            endDate: "",
            days: 1,
            classification: "Paid",
            leaveType: "Planned",
            emergencyCategory: undefined
        });
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

    const filteredLeaves = user.role === "HR" ? leaves : leaves.filter(l => l.employeeId === user.id);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const usedLeavesThisMonth = leaves.filter(l => l.employeeId === user.id && l.status === "Approved" && new Date(l.startDate).getMonth() === currentMonth && new Date(l.startDate).getFullYear() === currentYear).reduce((a, c) => a + c.days, 0);
    const pendingRequestsThisMonth = leaves.filter(l => l.employeeId === user.id && l.status === "Pending" && l.appliedAt && new Date(l.appliedAt).getMonth() === currentMonth && new Date(l.appliedAt).getFullYear() === currentYear).length;

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Leave Management</h1>
                    <p className="text-xs text-muted">Manage workforce availability and personal leave credits.</p>
                </div>
                {!["HR", "FOUNDER"].includes(user.role) && (
                    <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 h-9 px-4">
                        <Plus size={14} /> Request
                    </button>
                )}
            </header>

            {/* Quota Widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Monthly Quota</p>
                    <p className="text-lg font-bold text-white">1.0 Days</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Used This Month</p>
                    <p className="text-lg font-bold text-white">{usedLeavesThisMonth.toFixed(1)} Days</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Available This Month</p>
                    <p className="text-lg font-bold text-primary">{Math.max(0, 1 - usedLeavesThisMonth).toFixed(1)} Days</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Pending This Month</p>
                    <p className="text-lg font-bold text-amber-500">{pendingRequestsThisMonth} Requests</p>
                </div>
            </div>

            {/* Leave Register */}
            <div className="card">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white">Leave Applications</h3>
                    <div className="flex gap-2">
                        <span className="flex items-center gap-1.5 text-[10px] text-muted"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Approved</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-muted"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                <th className="px-5 py-4">Employee</th>
                                <th className="px-5 py-4">Categorization</th>
                                <th className="px-5 py-4">Timeline</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredLeaves.length === 0 ? (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No active records in the leave register.</td></tr>
                            ) : (
                                filteredLeaves.map(req => (
                                    <tr key={req.id} className={cn("hover:bg-surface-light transition-colors group",
                                        (req.lossOfPayDays && req.lossOfPayDays > 0) ? "bg-red-500/[0.02]" : ""
                                    )}>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-xs font-bold ring-1 ring-white/5 uppercase">{req.employeeName[0]}</div>
                                                <div>
                                                    <p className="font-bold text-white leading-none">{req.employeeName}</p>
                                                    <p className="text-[10px] text-muted font-mono mt-1 opacity-60">{req.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1.5">
                                                <p className="text-white font-medium">{req.type}</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", req.classification === "Paid" ? "text-primary border-primary/20 bg-primary/5" : "text-amber-500 border-amber-500/20 bg-amber-500/5")}>{req.classification}</span>
                                                    {req.leaveType === "Emergency" && req.emergencyCategory && (
                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/5 text-red-400">🚨 {req.emergencyCategory}</span>
                                                    )}
                                                    {req.lossOfPayDays && req.lossOfPayDays > 0 && (
                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-500">2-Day LOP</span>
                                                    )}
                                                </div>
                                                {/* Critical HR Indicators */}
                                                {user.role === "HR" && req.appliedAt && (
                                                    <div className="flex flex-wrap gap-1 mt-1 opacity-80">
                                                        {(() => {
                                                            const appDate = new Date(req.appliedAt);
                                                            const startD = new Date(req.startDate);
                                                            const isSameDay = appDate.toDateString() === startD.toDateString();
                                                            const hour = appDate.getHours();
                                                            const isOffHours = hour >= 19 || hour < 9;
                                                            return <>
                                                                {isSameDay && <span className="text-[7px] font-black bg-zinc-800 text-zinc-400 px-1 rounded uppercase tracking-tighter">SAME-DAY</span>}
                                                                {isOffHours && <span className="text-[7px] font-black bg-zinc-800 text-zinc-400 px-1 rounded uppercase tracking-tighter">OFF-HOURS ({hour}:00)</span>}
                                                            </>;
                                                        })()}
                                                    </div>
                                                )}
                                                {req.reasonForAction && (
                                                    <div className="mt-1 text-[9px] text-amber-500/80 italic break-words">
                                                        Note: {req.reasonForAction}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1">
                                                <p className="text-white">{req.startDate} — {req.endDate}</p>
                                                <p className="text-[10px] text-muted-foreground">{req.days} Working Days</p>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn("badge",
                                                req.status === "Approved" ? "badge-green" :
                                                    req.status === "Pending" ? "badge-amber" : "badge-zinc"
                                            )}>{req.status}</span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {req.proofUrls && req.proofUrls.length > 0 && (
                                                    <div className="flex -space-x-2 mr-2">
                                                        {req.proofUrls.map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noopener"
                                                                className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-[#111] flex items-center justify-center text-primary hover:scale-110 transition-transform">
                                                                <Upload size={10} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}

                                                {user.role === "HR" && req.status === "Pending" ? (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { const reason = window.prompt("Reason for approval (Optional):"); approveLeave(req.id, reason || undefined); }} className="h-8 w-8 flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary transition-colors hover:text-white">
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                        <button onClick={() => { const reason = window.prompt("Reason for rejection:"); rejectLeave(req.id, false, reason || undefined); }} className="h-8 w-8 flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 transition-colors hover:text-white">
                                                            <XCircle size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button className="p-2 text-muted hover:text-white"><AlertCircle size={14} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Application Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card w-full max-w-md p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-base font-bold text-white">Log Leave Request</h2>
                                <button onClick={() => setShowModal(false)}><X size={18} className="text-muted hover:text-white" /></button>
                            </div>
                            <form onSubmit={handleApply} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Type</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                            <option>Casual Leave</option><option>Sick Leave</option><option>Privilege Leave</option><option>Maternity Leave</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Category</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={formData.classification} onChange={e => setFormData({ ...formData, classification: e.target.value as any })}>
                                            <option value="Paid">Paid</option><option value="Unpaid">Loss of Pay</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Leave Category</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(["Planned", "Emergency"] as const).map(lt => (
                                            <button key={lt} type="button" onClick={() => setFormData({ ...formData, leaveType: lt })}
                                                className={cn("p-2.5 rounded-lg text-[10px] font-bold border transition-all text-center",
                                                    formData.leaveType === lt ? "border-primary bg-primary/10 text-primary" : "border-zinc-700 text-zinc-500 hover:text-white bg-zinc-800/50"
                                                )}>
                                                {lt === "Planned" ? "📋 Planned Leave" : "🚨 Emergency Leave"}
                                            </button>
                                        ))}
                                    </div>
                                    {formData.leaveType === "Planned" && <p className="text-[9px] text-zinc-500 italic">Must apply at least 1 day before (9AM-7PM window).</p>}
                                    {formData.leaveType === "Emergency" && (
                                        <div className="space-y-3 pt-2">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Emergency Criticality</label>
                                                <select
                                                    required={formData.leaveType === "Emergency"}
                                                    className="w-full bg-surface-light border border-amber-500/30 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500"
                                                    value={formData.emergencyCategory || ""}
                                                    onChange={e => setFormData({ ...formData, emergencyCategory: e.target.value as any })}
                                                >
                                                    <option value="" disabled>Select Critical Category</option>
                                                    <option value="Accident">Accident</option>
                                                    <option value="Death">Death (Bereavement)</option>
                                                    <option value="In Hospital">In Hospital (Medical Emergency)</option>
                                                </select>
                                            </div>

                                            {/* LOP Warning Logic */}
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2 mt-2">
                                                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-red-400">🚨 Potential 2-Day Loss of Pay (LOP)</p>
                                                    <p className="text-[9px] text-red-300">
                                                        Emergency leaves require mandatory, valid proof. If the proof is deemed invalid or false by HR upon review, a 2-day paycut will be levied automatically.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Effective Date</label>
                                        <input type="date" required className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">End Date</label>
                                        <input type="date" required className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Cumulative Days</label>
                                    <input type="number" required min="1" step="0.5" className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={formData.days} onChange={e => setFormData({ ...formData, days: Number(e.target.value) })} />
                                </div>
                                <div className={cn("bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3", formData.leaveType === "Emergency" && "border-amber-500/30 bg-amber-500/5")}>
                                    {formData.leaveType === "Emergency" ? <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" /> : <HelpCircle size={16} className="text-primary shrink-0 mt-0.5" />}
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        {formData.leaveType === "Emergency"
                                            ? "Proof (Image/PDF) is MANDATORY for Emergency Leave. Only valid for Accident, Death, or Hospitalization."
                                            : "Proof upload is recommended for planned leaves and mandatory for sick leaves."}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Proof Upload</label>
                                    <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
                                        onClick={() => proofInputRef.current?.click()}>
                                        {uploading ? <Loader2 size={20} className="mx-auto text-primary animate-spin" /> : <Upload size={20} className="mx-auto text-zinc-600 mb-1" />}
                                        <p className="text-[10px] text-zinc-400">{uploading ? "Uploading..." : "Click to upload proof (images/PDF)"}</p>
                                    </div>
                                    <input ref={proofInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleProofUpload} />
                                    {proofUrls.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {proofUrls.map((url, i) => (
                                                <div key={i} className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1">
                                                    <a href={url} target="_blank" rel="noopener" className="text-[9px] text-green-400 hover:underline">File {i + 1} ↗</a>
                                                    <button type="button" onClick={() => setProofUrls(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400"><X size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="btn-primary w-full py-3">Submit Application</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
