"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Calendar, CheckCircle2, Clock, Building2, Globe, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function HolidayApprovalPage() {
    const { user, holidays, approveHoliday, proposeHoliday, colleges } = useAuth();
    const [approveMessages, setApproveMessages] = useState<Record<string, string>>({});
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", date: "", collegeId: "", forAll: true, customMessage: "" });

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const pendingHolidays = holidays.filter(h => h.status === "Proposed");
    const approvedHolidays = holidays.filter(h => h.status === "Approved");
    const getCollegeName = (id?: string) => id ? (colleges.find(c => c.id === id)?.shortName || id) : null;

    const handleApprove = (id: string) => {
        approveHoliday(id, approveMessages[id] || undefined);
        setApproveMessages(prev => { const next = { ...prev }; delete next[id]; return next; });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        proposeHoliday({
            name: createForm.name,
            date: createForm.date,
            collegeId: createForm.forAll ? undefined : (createForm.collegeId || undefined),
            forAll: createForm.forAll || undefined,
            customMessage: createForm.customMessage || undefined,
        });
        // Auto-approve since HR is creating it
        setTimeout(() => {
            const latest = holidays[holidays.length]; // will be handled by the next render
        }, 100);
        setCreateForm({ name: "", date: "", collegeId: "", forAll: true, customMessage: "" });
        setShowCreate(false);
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header className="flex justify-between items-end">
                <div><h1 className="text-xl font-bold text-white tracking-tight">Holiday Approval</h1><p className="text-xs text-zinc-400 mt-1">Review, approve, and create holidays with custom announcements.</p></div>
                <button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><Plus size={14} /> Create Holiday</button>
            </header>

            {pendingHolidays.length > 0 && (
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50"><h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><Clock size={14} /> Pending Approval ({pendingHolidays.length})</h3></div>
                    <div className="divide-y divide-zinc-800/50">
                        {pendingHolidays.map(h => (
                            <div key={h.id} className="p-5 space-y-3 hover:bg-zinc-800/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Calendar size={18} className="text-amber-400" /></div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-bold text-white">{h.name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[10px] text-zinc-500">{h.date} · by {h.proposedByName}</span>
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
                                            {h.proofUrl && <a href={h.proofUrl} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline">Proof ↗</a>}
                                        </div>
                                    </div>
                                </div>
                                {/* Custom message input */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <input type="text" placeholder="Custom announcement message (optional)..." value={approveMessages[h.id] || ""}
                                            onChange={e => setApproveMessages(prev => ({ ...prev, [h.id]: e.target.value }))}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-[10px] text-white placeholder:text-zinc-600" />
                                    </div>
                                    <button onClick={() => handleApprove(h.id)} className="px-4 py-2 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 whitespace-nowrap flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Approve & Announce
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50"><h3 className="text-sm font-semibold text-green-400 flex items-center gap-2"><CheckCircle2 size={14} /> Approved Holidays ({approvedHolidays.length})</h3></div>
                <div className="divide-y divide-zinc-800/50">
                    {approvedHolidays.length === 0 ? <div className="p-8 text-center text-xs text-zinc-500 italic">No approved holidays.</div> :
                        approvedHolidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(h => (
                            <div key={h.id} className="p-4 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors">
                                <Calendar size={14} className="text-green-400" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white">{h.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-zinc-500">{h.date}</span>
                                        {h.collegeId && <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20"><Building2 size={8} className="inline" /> {getCollegeName(h.collegeId)}</span>}
                                        {h.forAll && <span className="text-[8px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20"><Globe size={8} className="inline" /> All</span>}
                                        {h.customMessage && <span className="text-[9px] text-zinc-600 italic truncate max-w-[250px]">"{h.customMessage}"</span>}
                                    </div>
                                </div>
                                <CheckCircle2 size={14} className="text-green-500" />
                            </div>
                        ))}
                </div>
            </div>

            {/* Create Holiday Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative z-10 space-y-5 shadow-2xl">
                            <h2 className="text-base font-bold text-white flex items-center gap-2"><Calendar size={16} className="text-primary" /> Create Holiday</h2>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Holiday Name</label>
                                    <input type="text" required placeholder="e.g. Diwali, Staff Day" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</label>
                                    <input type="date" required value={createForm.date} onChange={e => setCreateForm({ ...createForm, date: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Applies To</label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={createForm.forAll} onChange={e => setCreateForm({ ...createForm, forAll: e.target.checked, collegeId: "" })} className="rounded border-zinc-700 bg-zinc-800 text-primary" />
                                        <span className="text-xs text-zinc-300">All Colleges</span>
                                    </label>
                                    {!createForm.forAll && (
                                        <select value={createForm.collegeId} onChange={e => setCreateForm({ ...createForm, collegeId: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white">
                                            <option value="">Select College</option>
                                            {colleges.map(c => <option key={c.id} value={c.id}>{c.shortName} — {c.city}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Announcement Message</label>
                                    <textarea placeholder="Custom announcement message..." value={createForm.customMessage} onChange={e => setCreateForm({ ...createForm, customMessage: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white resize-none h-20" />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-zinc-400 border border-zinc-700 rounded-lg">Cancel</button>
                                    <button type="submit" className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg">Create & Approve</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
