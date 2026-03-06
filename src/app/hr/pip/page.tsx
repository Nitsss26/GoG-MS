"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle, X, Upload, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PIPPermanentPortal() {
    const { user, pipRecords, removeFromPIP, employees } = useAuth();
    const [selectedPIP, setSelectedPIP] = useState<string | null>(null);
    const [removalReason, setRemovalReason] = useState("");
    const [proofUrls, setProofUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const proofInputRef = useRef<HTMLInputElement>(null);

    // Only HR can access this control portal
    if (!user || user.role !== "HR") return null;

    const activePIPs = pipRecords.filter(p => p.status === "Active");
    const completedPIPs = pipRecords.filter(p => p.status === "Completed");

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

    const handleRemovePIP = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPIP || !removalReason.trim()) return;

        removeFromPIP(selectedPIP, removalReason, proofUrls.length > 0 ? proofUrls : undefined);
        setSelectedPIP(null);
        setRemovalReason("");
        setProofUrls([]);
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <ShieldAlert size={20} className="text-orange-500" />
                    PIP Administration
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                    Manage active Performance Improvement Plans. Re-evaluate candidates based on performance evidence to exclude them from PIP.
                </p>
            </header>

            {/* PIP Rosters & Chances Monitor */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chances Monitor */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-xl lg:col-span-1">
                    <div className="bg-blue-500/5 border-b border-blue-500/10 p-4 shrink-0">
                        <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Chances Monitor</h3>
                        <p className="text-[9px] text-zinc-500 mt-0.5">Employees with warnings (&lt; 3 chances remaining)</p>
                    </div>
                    <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto">
                        {employees.filter(e => e.chancesRemaining < 3 && e.chancesRemaining > 0).length === 0 ?
                            <div className="p-12 text-center text-[10px] text-zinc-600 italic">No active warnings issued.</div> :
                            employees.filter(e => e.chancesRemaining < 3 && e.chancesRemaining > 0).map(e => (
                                <div key={e.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                                    <div>
                                        <h4 className="text-[11px] font-bold text-white">{e.name}</h4>
                                        <p className="text-[9px] text-zinc-500">{e.designation}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded border",
                                            e.chancesRemaining === 1 ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-orange-400 bg-orange-500/10 border-orange-500/20"
                                        )}>
                                            {e.chancesRemaining}/3 Chances
                                        </div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* Active List */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl lg:col-span-1">
                    <div className="bg-orange-500/10 border-b border-orange-500/20 p-4">
                        <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />Active PIP Candidates ({activePIPs.length})</h3>
                    </div>
                    <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto">
                        {activePIPs.length === 0 ? <div className="p-12 text-center text-xs text-zinc-500 italic">No employees currently under PIP.</div> :
                            activePIPs.map(p => {
                                const emp = employees.find(e => e.id === p.employeeId);
                                return (
                                    <div key={p.id} className="p-5 space-y-3 hover:bg-zinc-800/30 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-orange-400 shrink-0 capitalize">
                                                {p.employeeName[0]}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white leading-tight">{p.employeeName}</h4>
                                                <p className="text-[9px] text-zinc-400 font-mono">{emp?.designation || "Employee"} · Since {p.startDate}</p>
                                            </div>
                                        </div>
                                        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2.5">
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Instantiation Reason</p>
                                            <p className="text-[10px] text-zinc-300 leading-relaxed">{p.reason}</p>
                                        </div>
                                        <button onClick={() => setSelectedPIP(p.id)} className="w-full bg-primary hover:bg-primary/90 text-white text-[10px] font-bold py-2 rounded-lg transition-all shadow-lg hover:shadow-primary/20">
                                            Exclude / Remove from PIP
                                        </button>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* History List */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-xl lg:col-span-1 border-emerald-500/10">
                    <div className="bg-green-500/5 border-b border-green-500/10 p-4">
                        <h3 className="text-sm font-bold text-green-400 flex items-center gap-2"><CheckCircle size={14} /> Completed / Excluded</h3>
                    </div>
                    <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto">
                        {completedPIPs.length === 0 ? <div className="p-12 text-center text-xs text-zinc-500 italic">No historical PIP clearances.</div> :
                            completedPIPs.map(p => (
                                <div key={p.id} className="p-4 space-y-2">
                                    <h4 className="text-xs font-bold text-white">{p.employeeName}</h4>
                                    <p className="text-[10px] text-zinc-400">PIP Duration: {p.startDate} to {new Date(p.resolvedAt || "").toLocaleDateString()}</p>
                                    <div className="bg-green-500/5 border border-green-500/10 p-2.5 rounded-lg">
                                        <p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-0.5">Clearance Reason</p>
                                        <p className="text-[10px] text-zinc-400 italic line-clamp-2">"{p.resolvedReason}"</p>
                                        {p.resolvedProofs && (
                                            <div className="flex gap-2 mt-2">
                                                {p.resolvedProofs.slice(0, 2).map((_, idx) => (
                                                    <div key={idx} className="w-5 h-5 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center"><Upload size={10} className="text-zinc-500" /></div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* Exclusion Modal */}
            <AnimatePresence>
                {selectedPIP && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPIP(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative z-10 shadow-2xl">
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-base font-bold text-white flex items-center gap-2"><CheckCircle size={16} className="text-green-400" /> Exclude from PIP</h2>
                                <button onClick={() => setSelectedPIP(null)}><X size={18} className="text-zinc-500 hover:text-white transition-colors" /></button>
                            </div>

                            <div className="bg-zinc-800/80 border border-zinc-700 p-3 rounded-lg mb-4 flex items-start gap-2">
                                <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-zinc-300 leading-relaxed">
                                    This action immediately neutralizes the candidate's active PIP status. A mandatory clearance reason must be provided outlining their performance improvements, which will be accessible by the Founders.
                                </p>
                            </div>

                            <form onSubmit={handleRemovePIP} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex justify-between">
                                        <span>Exclusion Reason / Action Review</span>
                                        <span className="text-red-400">*</span>
                                    </label>
                                    <textarea required rows={4} value={removalReason} onChange={e => setRemovalReason(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none transition-colors"
                                        placeholder="Detailed explanation of the observable improvements..." />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Supporting Evidence (Optional)</label>
                                    <div className="border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center hover:border-zinc-600 transition-colors cursor-pointer bg-zinc-950"
                                        onClick={() => proofInputRef.current?.click()}>
                                        {uploading ? <Loader2 size={24} className="mx-auto text-primary animate-spin" /> : <Upload size={24} className="mx-auto text-zinc-600 mb-2" />}
                                        <p className="text-xs font-bold text-zinc-400">{uploading ? "Uploading encrypted assets..." : "Click to upload improvement metrics or evaluations"}</p>
                                    </div>
                                    <input ref={proofInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleProofUpload} />

                                    {proofUrls.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {proofUrls.map((url, i) => (
                                                <div key={i} className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded">
                                                    Evidence #{i + 1}
                                                    <button type="button" onClick={() => setProofUrls(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-400 ml-1"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 flex justify-end gap-3">
                                    <button type="button" onClick={() => setSelectedPIP(null)} className="px-5 py-2.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                    <button type="submit" className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-primary/20">Authorize Exclusion</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
