"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth, ReimbursementClaim } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Receipt, Plus, Clock, CheckCircle2, XCircle, ExternalLink, Upload, Loader2, X, Eye, Calendar, IndianRupee, AlertCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const EXPENSE_TYPES = ["Travel", "Food", "Internet", "Equipment", "Medical", "Stationery", "Books & Certification", "Phone & Data", "Fuel", "Accommodation", "Training", "Software", "Other"];

export default function ReimbursementPage() {
    const { user, reimbursements, addReimbursement } = useAuth();
    const router = useRouter();

    // HR/Founder should see the management page
    useEffect(() => {
        if (user && (user.role === "HR" || user.role === "FOUNDER")) {
            router.replace("/hr/reimbursements");
        }
    }, [user, router]);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ type: "Travel", amount: "", monthYear: "", description: "", driveLink: "", email: "", phone: "" });
    const [proofUrls, setProofUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const proofRef = useRef<HTMLInputElement>(null);
    const [viewClaim, setViewClaim] = useState<ReimbursementClaim | null>(null);
    const [imageModal, setImageModal] = useState<string | null>(null);

    // Month filter
    const now = new Date();
    const [filterMonth, setFilterMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    if (!user) return null;
    const emp = user as any;
    const myReimbursements = reimbursements.filter(r => r.employeeId === user.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filtered = myReimbursements.filter(r => r.monthYear === filterMonth);

    // KPIs for filtered month
    const totalThisMonth = filtered.reduce((a, r) => a + r.amount, 0);
    const pendingCount = filtered.filter(r => r.status === "Pending").length;
    const approvedCount = filtered.filter(r => r.status.startsWith("Approved")).length;
    const approvedAmount = filtered.filter(r => r.status.startsWith("Approved")).reduce((a, r) => a + r.amount, 0);
    const rejectedCount = filtered.filter(r => r.status === "Rejected").length;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addReimbursement({ type: form.type, amount: parseFloat(form.amount), monthYear: form.monthYear, description: form.description, driveLink: form.driveLink, email: form.email || emp.email, phone: form.phone || emp.phone || "", proofUrls: proofUrls.length > 0 ? proofUrls : undefined });
        setForm({ type: "Travel", amount: "", monthYear: "", description: "", driveLink: "", email: "", phone: "" });
        setProofUrls([]);
        setShowForm(false);
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

    const statusConfig: Record<string, { color: string; icon: any; bg: string }> = {
        "Pending": { color: "text-amber-400", icon: Clock, bg: "bg-amber-500/10 border-amber-500/20" },
        "Approved - Pending Payment": { color: "text-blue-400", icon: CheckCircle2, bg: "bg-blue-500/10 border-blue-500/20" },
        "Approved - Payment Done": { color: "text-green-400", icon: CheckCircle2, bg: "bg-green-500/10 border-green-500/20" },
        "Rejected": { color: "text-red-400", icon: XCircle, bg: "bg-red-500/10 border-red-500/20" },
    };

    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                    <h1 className="text-xl font-bold text-white tracking-tight">Reimbursement Claims</h1>
                    <p className="text-xs text-zinc-400 mt-1">Submit and track your expense reimbursement requests.</p>
                </div>
                <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-2">
                    <button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-primary/20 shrink-0">
                        <Plus size={14} /> <span className="hidden sm:inline">New Claim</span><span className="sm:hidden">New Claim</span>
                    </button>
                    <select
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-primary transition-colors min-w-[110px]"
                    >
                        {months.map(m => (
                            <option key={m} value={m}>
                                {new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-6 lg:grid-cols-5 gap-2 lg:gap-3">
                <div className="col-span-2 lg:col-span-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 lg:p-4 space-y-1 group hover:border-primary/20 transition-colors">
                    <p className="text-[8px] lg:text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">This Month</p>
                    <p className="text-base lg:text-lg font-bold text-white">₹{totalThisMonth.toLocaleString()}</p>
                </div>
                <div className="col-span-2 lg:col-span-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 lg:p-4 space-y-1 group hover:border-amber-500/20 transition-colors">
                    <p className="text-[8px] lg:text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">Pending</p>
                    <p className="text-base lg:text-lg font-bold text-amber-400">{pendingCount}</p>
                </div>
                <div className="col-span-2 lg:col-span-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 lg:p-4 space-y-1 group hover:border-green-500/20 transition-colors">
                    <p className="text-[8px] lg:text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">Approved</p>
                    <p className="text-base lg:text-lg font-bold text-green-400">{approvedCount}</p>
                </div>
                <div className="col-span-3 lg:col-span-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 lg:p-4 space-y-1 group hover:border-green-500/20 transition-colors">
                    <p className="text-[8px] lg:text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">Approved Amount</p>
                    <p className="text-base lg:text-lg font-bold text-green-400">₹{approvedAmount.toLocaleString()}</p>
                </div>
                <div className="col-span-3 lg:col-span-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-3 lg:p-4 space-y-1 group hover:border-red-500/20 transition-colors">
                    <p className="text-[8px] lg:text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">Rejected</p>
                    <p className="text-base lg:text-lg font-bold text-red-400">{rejectedCount}</p>
                </div>
            </div>

            {/* Claims List */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/50 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white">Requests — {new Date(filterMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
                    <span className="text-[10px] text-zinc-500">{filtered.length} claim{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-zinc-800/50">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center text-xs text-zinc-500 italic">No reimbursement claims for this month.</div>
                    ) : filtered.map(r => {
                        const sc = statusConfig[r.status] || statusConfig["Pending"];
                        const Icon = sc.icon;
                        return (
                            <div key={r.id} className="p-4 flex items-start gap-4 hover:bg-zinc-800/20 transition-colors">
                                <div className="mt-0.5"><Icon size={16} className={sc.color} /></div>
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold text-white">{r.type} — ₹{r.amount.toLocaleString()}</h4>
                                            <p className="text-[10px] text-zinc-500 truncate">{r.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={cn("text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap", sc.bg, sc.color)}>{r.status}</span>
                                            <button onClick={() => setViewClaim(r)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-primary transition-colors" title="View Details"><Eye size={12} /></button>
                                        </div>
                                    </div>
                                    {r.rejectionReason && <p className="text-[10px] text-red-400 italic bg-red-500/5 p-2 rounded-lg border border-red-500/10">❌ Reason: {r.rejectionReason}</p>}
                                    {r.hrRemarks && <p className="text-[10px] text-blue-400 italic bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">💬 HR Remarks: {r.hrRemarks}</p>}
                                    <p className="text-[9px] text-zinc-600">Submitted: {r.date}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* View Details Modal */}
            <AnimatePresence>
                {viewClaim && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewClaim(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative z-10 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
                            <div className="flex justify-between items-start">
                                <h2 className="text-base font-bold text-white flex items-center gap-2"><Receipt size={16} className="text-primary" /> Claim Details</h2>
                                <button onClick={() => setViewClaim(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Type</p><p className="text-white font-bold">{viewClaim.type}</p></div>
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Amount</p><p className="text-white font-bold">₹{viewClaim.amount.toLocaleString()}</p></div>
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Month</p><p className="text-white">{viewClaim.monthYear}</p></div>
                                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Status</p><p className={statusConfig[viewClaim.status]?.color || "text-white"}>{viewClaim.status}</p></div>
                                <div className="col-span-2"><p className="text-[9px] text-zinc-500 font-bold uppercase">Description</p><p className="text-zinc-300 leading-relaxed">{viewClaim.description}</p></div>
                            </div>
                            {viewClaim.rejectionReason && <p className="text-[10px] text-red-400 italic bg-red-500/5 p-3 rounded-lg border border-red-500/10">❌ Rejection Reason: {viewClaim.rejectionReason}</p>}
                            {viewClaim.hrRemarks && <p className="text-[10px] text-blue-400 italic bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">💬 HR Remarks: {viewClaim.hrRemarks}</p>}
                            {viewClaim.driveLink && <a href={viewClaim.driveLink} target="_blank" rel="noopener" className="text-[10px] text-primary flex items-center gap-1 hover:underline"><ExternalLink size={10} /> Google Drive Folder</a>}
                            {viewClaim.proofUrls && viewClaim.proofUrls.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase">Proof Images</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {viewClaim.proofUrls.map((url, i) => (
                                            <img key={i} src={url} alt={`Proof ${i + 1}`} onClick={() => setImageModal(url)} className="w-full h-24 object-cover rounded-lg border border-zinc-800 cursor-pointer hover:border-primary/50 transition-colors" />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <p className="text-[9px] text-zinc-600 pt-2 border-t border-zinc-800">Submitted on {viewClaim.date}</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Full Image Modal */}
            <AnimatePresence>
                {imageModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90" />
                        <motion.img initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} src={imageModal} className="relative z-10 max-w-[90vw] max-h-[85vh] rounded-xl object-contain" />
                    </div>
                )}
            </AnimatePresence>

            {/* New Claim Modal */}
            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative z-10 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
                            <h2 className="text-base font-bold text-white flex items-center gap-2"><Receipt size={16} className="text-primary" /> New Reimbursement Claim</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Name</label>
                                        <input type="text" readOnly value={user.name} className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2.5 text-xs text-zinc-400" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email</label>
                                        <input type="email" value={form.email || emp.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Mobile</label>
                                        <input type="tel" value={form.phone || emp.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Month-Year</label>
                                        <input type="month" required value={form.monthYear} onChange={e => setForm({ ...form, monthYear: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expense Type</label>
                                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white">
                                            {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount (₹)</label>
                                        <input type="number" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" placeholder="0" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                                    <textarea required rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white resize-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Google Drive Folder Link (Bills/Invoices)</label>
                                    <input type="url" value={form.driveLink} onChange={e => setForm({ ...form, driveLink: e.target.value })} placeholder="https://drive.google.com/..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Invoice / Bill Proof (Images)</label>
                                    <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => proofRef.current?.click()}>
                                        {uploading ? <Loader2 size={20} className="mx-auto text-primary animate-spin" /> : <Upload size={20} className="mx-auto text-zinc-600 mb-1" />}
                                        <p className="text-[10px] text-zinc-400">{uploading ? "Uploading to Cloudinary..." : "Click to upload invoices (images/PDF)"}</p>
                                        <p className="text-[8px] text-zinc-600">Multiple files supported</p>
                                    </div>
                                    <input ref={proofRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleProofUpload} />
                                    {proofUrls.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {proofUrls.map((url, i) => (
                                                <div key={i} className="relative group">
                                                    <img src={url} alt={`Proof ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-zinc-800" />
                                                    <button type="button" onClick={() => setProofUrls(prev => prev.filter((_, j) => j !== i))}
                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <X size={8} className="text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-xs font-bold text-zinc-400 border border-zinc-700 rounded-xl hover:bg-zinc-800">Cancel</button>
                                    <button type="submit" disabled={uploading} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50">Submit Claim</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
