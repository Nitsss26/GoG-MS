"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, Plus, UserX, Zap, Users, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function MisbehaviourPage() {
    const { user, getReportees, reportMisbehaviour, misbehaviourReports, deductChance, employees, pipRecords } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ employeeId: "", type: "Behavioral" as "Behavioral" | "Performance" | "Meeting Absent", description: "" });
    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) return null;
    const reportees = getReportees(user.id);
    const myReports = misbehaviourReports.filter(m => m.reportedBy === user.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        reportMisbehaviour(form.employeeId, form.type, form.description, [], []);
        setForm({ employeeId: "", type: "Behavioral", description: "" });
        setShowForm(false);
    };

    const handleDeductChance = (empId: string, reason: string) => {
        if (confirm("This will deduct 1 chance from the employee. If they hit 0, they will be put in PIP. Are you sure?")) {
            deductChance(empId, reason);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header className="flex justify-between items-end">
                <div><h1 className="text-xl font-bold text-white tracking-tight">Misbehaviour Reports</h1><p className="text-xs text-zinc-400 mt-1">Report behavioral, performance, or meeting-related issues.</p></div>
                <button onClick={() => setShowForm(true)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all"><Plus size={14} /> New Report</button>
            </header>

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50"><h3 className="text-sm font-semibold text-white">Report History</h3></div>
                <div className="divide-y divide-zinc-800/50">
                    {myReports.length === 0 ? <div className="p-12 text-center text-xs text-zinc-500 italic">No misbehaviour reports filed.</div> :
                        myReports.map(r => {
                            const empPIP = pipRecords.find(p => p.employeeId === r.employeeId && p.status === "Active");
                            const emp = employees.find(e => e.id === r.employeeId);
                            const chancesRemaining = emp?.chancesRemaining ?? 3;

                            return (
                                <div key={r.id} className="p-5 space-y-3 hover:bg-zinc-800/20 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3 text-white">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs uppercase">
                                                {r.employeeName[0]}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold">{r.employeeName}</h4>
                                                <p className="text-[10px] text-zinc-500">{r.type} Issue · {r.date}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 capitalize")}>
                                                Reported by {r.reportedByName}
                                            </span>
                                            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border",
                                                r.type === "Behavioral" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                                                    r.type === "Performance" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                                                        "text-zinc-400 bg-zinc-800 border-zinc-700"
                                            )}>{r.type}</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-zinc-300 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">{r.description}</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <p className="text-[9px] text-zinc-500 italic flex items-center gap-1.5">
                                                Chances Remaining:
                                                <span className={cn("font-bold", chancesRemaining <= 1 ? "text-red-400" : "text-emerald-400")}>
                                                    {chancesRemaining}/3
                                                </span>
                                            </p>
                                            {empPIP && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1 transition-pulse"><ShieldAlert size={10} /> Active PIP Candidate</span>}
                                        </div>

                                        {!empPIP && chancesRemaining > 0 && (user.role === "HR" || user.role === "FOUNDER") && (
                                            <button onClick={() => handleDeductChance(r.employeeId, r.description)} className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg hover:bg-orange-500/20 transition-all flex items-center gap-1.5">
                                                <Zap size={10} className="fill-orange-400" /> Deduct -1 Chance
                                            </button>
                                        )}
                                    </div>
                                    {/* Propagation Chain */}
                                    {r.propagationChain && r.propagationChain.length > 0 && (
                                        <div className="flex items-center gap-1 pt-1 opacity-60">
                                            <span className="text-[9px] text-zinc-500 mr-1">Escalation:</span>
                                            {r.propagationChain.map((p, idx) => (
                                                <span key={p.level} className="flex items-center gap-1">
                                                    <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border",
                                                        p.notified ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-zinc-500 bg-zinc-800 border-zinc-700"
                                                    )}>{p.level}: {p.name} {p.notified ? "✓" : "—"}</span>
                                                    {idx < r.propagationChain!.length - 1 && <span className="text-zinc-600 text-[8px]">→</span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative z-10 space-y-5 shadow-2xl">
                            <h2 className="text-base font-bold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /> Report Misbehaviour</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Employee</label>
                                    <select required value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white">
                                        <option value="">Select reportee...</option>
                                        {reportees.map(r => <option key={r.id} value={r.id}>{r.name} — {r.designation}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Issue Type</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(["Behavioral", "Performance", "Meeting Absent"] as const).map(t => (
                                            <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                                                className={cn("p-2 rounded-lg text-[10px] font-bold border transition-all text-center",
                                                    form.type === t ? "border-primary bg-primary/10 text-primary" : "border-zinc-700 text-zinc-500 hover:text-white")}>
                                                {t === "Behavioral" ? "🔴" : t === "Performance" ? "🔵" : "⚫"} {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                                    <textarea required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white resize-none" placeholder="Describe the issue in detail..." />
                                </div>
                                <p className="text-[9px] text-zinc-500 italic">A notification will be sent to the employee and all authorities in CC.</p>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-zinc-400 border border-zinc-700 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-4 py-2 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/30">Submit Report</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
