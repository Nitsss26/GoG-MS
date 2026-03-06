"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Calendar, Plus, CheckCircle2, Clock, Upload, Loader2, X, MapPin, Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function HolidaysPage() {
    const { user, holidays, proposeHoliday, colleges } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", date: "", collegeId: "", forAll: false });
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) return null;

    const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try { const res = await uploadToCloudinary(file); setProofUrl(res.secure_url); } catch (err) { console.error(err); }
        setUploading(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        proposeHoliday({
            name: form.name,
            date: form.date,
            proofUrl: proofUrl || undefined,
            collegeId: form.forAll ? undefined : (form.collegeId || undefined),
            forAll: form.forAll || undefined,
        });
        setForm({ name: "", date: "", collegeId: "", forAll: false });
        setProofUrl(null);
        setShowForm(false);
    };

    const getCollegeName = (id?: string) => {
        if (!id) return null;
        return colleges.find(c => c.id === id)?.shortName || id;
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header className="flex justify-between items-end">
                <div><h1 className="text-xl font-bold text-white tracking-tight">Holiday Management</h1><p className="text-xs text-zinc-400 mt-1">Report holidays for your institution. HR approval required for announcement & attendance.</p></div>
                <button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><Plus size={14} /> Report Holiday</button>
            </header>

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="divide-y divide-zinc-800/50">
                    {holidays.length === 0 ? <div className="p-12 text-center text-xs text-zinc-500 italic">No holidays defined.</div> :
                        holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(h => (
                            <div key={h.id} className="p-5 flex items-center gap-4 hover:bg-zinc-800/20 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Calendar size={18} className="text-blue-400" /></div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-white">{h.name}</h4>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[10px] text-zinc-500">{h.date}</span>
                                        <span className="text-[10px] text-zinc-600">·</span>
                                        <span className="text-[10px] text-zinc-500">by {h.proposedByName || h.proposedBy}</span>
                                        {h.collegeId && (
                                            <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-0.5">
                                                <Building2 size={8} /> {getCollegeName(h.collegeId)}
                                            </span>
                                        )}
                                        {h.forAll && (
                                            <span className="text-[8px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20 flex items-center gap-0.5">
                                                <Globe size={8} /> All Colleges
                                            </span>
                                        )}
                                        {h.customMessage && <span className="text-[9px] text-zinc-600 italic truncate max-w-[200px]">"{h.customMessage}"</span>}
                                        {h.proofUrl && <a href={h.proofUrl} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline">Proof ↗</a>}
                                    </div>
                                </div>
                                <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                                    h.status === "Approved" ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                )}>{h.status === "Approved" ? <><CheckCircle2 size={10} className="inline mr-0.5" /> Approved</> : <><Clock size={10} className="inline mr-0.5" /> Pending</>}</span>
                            </div>
                        ))}
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative z-10 space-y-5 shadow-2xl">
                            <h2 className="text-base font-bold text-white flex items-center gap-2"><Calendar size={16} className="text-primary" /> Report Holiday</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Holiday / Event Name</label>
                                    <input type="text" required placeholder="e.g. Founder's Day, Exam Holiday" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</label>
                                    <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                </div>

                                {/* College Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Applies To</label>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={form.forAll} onChange={e => setForm({ ...form, forAll: e.target.checked, collegeId: "" })} className="rounded border-zinc-700 bg-zinc-800 text-primary" />
                                            <span className="text-xs text-zinc-300">All Colleges</span>
                                        </label>
                                    </div>
                                    {!form.forAll && (
                                        <select value={form.collegeId} onChange={e => setForm({ ...form, collegeId: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white">
                                            <option value="">Select College</option>
                                            {colleges.map(c => <option key={c.id} value={c.id}>{c.shortName} — {c.city}</option>)}
                                        </select>
                                    )}
                                </div>

                                {/* Proof */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Proof Upload (optional)</label>
                                    {!proofUrl ? (
                                        <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center hover:border-primary/50 cursor-pointer" onClick={() => fileRef.current?.click()}>
                                            {uploading ? <Loader2 size={18} className="mx-auto text-primary animate-spin" /> : <Upload size={18} className="mx-auto text-zinc-600 mb-1" />}
                                            <p className="text-[10px] text-zinc-400">{uploading ? "Uploading..." : "Click to upload proof"}</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                            <a href={proofUrl} target="_blank" rel="noopener" className="text-[10px] text-green-400 hover:underline flex-1">Proof uploaded ↗</a>
                                            <button type="button" onClick={() => setProofUrl(null)} className="text-zinc-500 hover:text-red-400"><X size={12} /></button>
                                        </div>
                                    )}
                                    <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleProofUpload} />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-zinc-400 border border-zinc-700 rounded-lg">Cancel</button>
                                    <button type="submit" className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg">Submit to HR</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
