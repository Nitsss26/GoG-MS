// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth, ReimbursementClaim } from "@/context/AuthContext";
import { Receipt, Plus, Search, Filter, Wallet, CheckCircle2, XCircle, Clock, Check, MoreVertical, IndianRupee, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function FinancialsPage() {
    const { user, reimbursements, addReimbursement, updateReimbursementStatus, employees } = useAuth();
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [claimForm, setClaimForm] = useState({ description: "", amount: 0, type: "Travel" as any, proofDescription: "", validatorRole: "HOI" as any });

    if (!user) return null;

    const myClaims = reimbursements.filter(r => r.employeeId === user.id);
    const allClaims = user.role === "HR" ? reimbursements : myClaims;

    const handleClaimSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addReimbursement(claimForm);
        setShowClaimModal(false);
        setClaimForm({ description: "", amount: 0, type: "Travel", proofDescription: "", validatorRole: "HOI" });
    };

    const totalLiability = reimbursements.filter(r => r.status === "Approved").reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Institutional Financials</h1>
                    <p className="text-xs text-muted">Management of workforce reimbursements and statutory tax nodes.</p>
                </div>
                {!["HR", "FOUNDER"].includes(user.role) && (
                    <button onClick={() => setShowClaimModal(true)} className="btn-primary flex items-center gap-1.5 h-9 px-4">
                        <Plus size={14} /> New Expense Claim
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Pending Audit</p>
                    <p className="text-lg font-bold text-white">{reimbursements.filter(r => r.status === "Pending").length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Total Liability (Approved)</p>
                    <p className="text-lg font-bold text-primary">₹{totalLiability.toLocaleString("en-IN")}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Statutory Tax Node</p>
                    <p className="text-lg font-bold text-white">Active</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">PF Contribution</p>
                    <p className="text-lg font-bold text-white">12.0%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Reimbursement Registry */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-white">Reimbursement Ledger</h3>
                            <div className="flex items-center gap-2">
                                <Search className="text-muted" size={14} />
                                <input type="text" placeholder="Filter claims..." className="bg-transparent border-none text-[10px] text-white focus:outline-none w-24" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                        <th className="px-5 py-4">Claimant Node</th>
                                        <th className="px-5 py-4">Expense Description</th>
                                        <th className="px-5 py-4">Amount</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {allClaims.length === 0 ? (
                                        <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No financial claims indexed in the ledger.</td></tr>
                                    ) : (
                                        allClaims.map(claim => (
                                            <tr key={claim.id} className="hover:bg-surface-light transition-colors group">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-[10px] font-bold">{claim.employeeName[0]}</div>
                                                        <div>
                                                            <p className="font-bold text-white">{claim.employeeName}</p>
                                                            <p className="text-[9px] text-muted uppercase tracking-widest">{claim.date}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="space-y-1">
                                                        <p className="text-white font-medium">{claim.description}</p>
                                                        <span className="badge badge-zinc">{claim.type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 font-bold text-primary">₹{claim.amount.toLocaleString("en-IN")}</td>
                                                <td className="px-5 py-4">
                                                    <span className={cn("badge",
                                                        claim.status === "Approved" ? "badge-green" :
                                                            claim.status === "HOI Approved" ? "badge-primary" :
                                                                claim.status === "Pending" ? "badge-amber" :
                                                                    claim.status === "Paid" ? "badge-zinc" : "badge-zinc opacity-50"
                                                    )}>{claim.status}</span>
                                                    {claim.validatorRole && (
                                                        <p className="text-[8px] text-muted mt-1 uppercase font-bold tracking-tighter">Via {claim.validatorRole}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {user.role === "HR" && claim.status === "Pending" ? (
                                                        <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => updateReimbursementStatus(claim.id, "Approved")} className="h-7 w-7 flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary transition-colors hover:text-white">
                                                                <Check size={14} />
                                                            </button>
                                                            <button onClick={() => updateReimbursementStatus(claim.id, "Rejected")} className="h-7 w-7 flex items-center justify-center bg-zinc-800 text-muted border border-border rounded hover:bg-zinc-700 transition-colors hover:text-white">
                                                                <XCircle size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button className="p-1 text-muted hover:text-white"><MoreVertical size={14} /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Tax & Deductions Summary (Admin Only) */}
                    {user.role === "HR" && (
                        <div className="card p-5 space-y-4">
                            <h3 className="text-sm font-bold text-white">Institutional Withholdings</h3>
                            <div className="space-y-3">
                                <div className="p-3 bg-surface-light border border-border rounded-lg flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <span className="text-xs text-muted-foreground">Est. TDS Liability</span>
                                    </div>
                                    <span className="text-xs font-bold text-white">₹{(employees.reduce((acc, e) => acc + (e.salary / 12 * 0.1), 0) / 1000).toFixed(1)}K</span>
                                </div>
                                <div className="p-3 bg-surface-light border border-border rounded-lg flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <span className="text-xs text-muted-foreground">PF Contributions</span>
                                    </div>
                                    <span className="text-xs font-bold text-white">₹{(employees.reduce((acc, e) => acc + (e.salary / 12 * 0.12), 0) / 1000).toFixed(1)}K</span>
                                </div>
                            </div>
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle size={16} className="text-primary shrink-0 mt-0.5" />
                                <p className="text-[10px] text-muted-foreground leading-relaxed">Financial nodes are synchronized with the 2024 statutory tax codes. Deductions are processed during the monthly batch execution.</p>
                            </div>
                        </div>
                    )}

                    {/* Quick Financial Links */}
                    <div className="card p-5 space-y-4">
                        <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Disbursal Nodes</h4>
                        <div className="space-y-2">
                            <button className="w-full flex items-center justify-between p-2 hover:bg-surface-light rounded-lg transition-colors group">
                                <span className="text-xs text-muted group-hover:text-white">Bank Settlement Status</span>
                                <CheckCircle2 size={12} className="text-primary" />
                            </button>
                            <button className="w-full flex items-center justify-between p-2 hover:bg-surface-light rounded-lg transition-colors group">
                                <span className="text-xs text-muted group-hover:text-white">Tax Variance Reports</span>
                                <MoreVertical size={12} className="text-muted" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Claim Modal */}
            <AnimatePresence>
                {showClaimModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowClaimModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-md p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-base font-bold text-white">Submit Expense Claim</h2>
                                <button onClick={() => setShowClaimModal(false)}><XCircle size={18} className="text-muted hover:text-white" /></button>
                            </div>
                            <form onSubmit={handleClaimSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Purpose of Expense</label>
                                    <input type="text" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="e.g. Client Dinner - Bhopal" value={claimForm.description} onChange={e => setClaimForm({ ...claimForm, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Category</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={claimForm.type} onChange={e => setClaimForm({ ...claimForm, type: e.target.value as any })}>
                                            <option>Travel</option><option>Meals</option><option>Supplies</option><option>Other</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Amount (₹)</label>
                                        <input type="number" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white font-mono" placeholder="0.00" value={claimForm.amount} onChange={e => setClaimForm({ ...claimForm, amount: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Validator Node</label>
                                    <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={claimForm.validatorRole} onChange={e => setClaimForm({ ...claimForm, validatorRole: e.target.value as any })}>
                                        <option value="HOI">HOI (Academic/Ops)</option>
                                        <option value="AD">AD (Admin Director)</option>
                                        <option value="TL">TL (Tech Lead)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Proof Citation / Description</label>
                                    <textarea required rows={3} className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white resize-none" placeholder="Provide a brief explanation or reference to the proof..." value={claimForm.proofDescription} onChange={e => setClaimForm({ ...claimForm, proofDescription: e.target.value })} />
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                                    <Clock size={16} className="text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">Claims require HR audit for validation. Approved amounts are disbursed during the next institutional payroll cycle.</p>
                                </div>
                                <button type="submit" className="btn-primary w-full py-3">Submit for Institutional Audit</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
