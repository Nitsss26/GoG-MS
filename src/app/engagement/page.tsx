// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth, AchievementCertificate } from "@/context/AuthContext";
import { Award, Image as ImageIcon, Plus, Search, User, Download, FileText, CheckCircle2, X, MessageSquare, Mail, Link as LinkIcon, Shield, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function EngagementPage() {
    const { user, employees, certificates, generateCertificate } = useAuth();
    const [activeTab, setActiveTab] = useState("Certificates");
    const [showCertModal, setShowCertModal] = useState(false);
    const [certForm, setCertForm] = useState({ employeeId: "", type: "Excellence" as any, reason: "" });
    const [selectedCert, setSelectedCert] = useState<any | null>(null);

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const handleCertSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const emp = employees.find(e => e.id === certForm.employeeId);
        if (emp) {
            generateCertificate({ ...certForm, employeeName: emp.name });
            setShowCertModal(false);
            setCertForm({ employeeId: "", type: "Excellence", reason: "" });
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Institutional Engagement</h1>
                    <p className="text-xs text-muted">Acknowledge performance and broadcast institutional joiner nodes.</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === "Certificates" ? (
                        <button onClick={() => setShowCertModal(true)} className="btn-primary flex items-center gap-1.5 h-9 px-4">
                            <Plus size={14} /> Award Appreciation
                        </button>
                    ) : (
                        <button className="btn-primary flex items-center gap-1.5 h-9 px-4">
                            <Plus size={14} /> New Joiner Poster
                        </button>
                    )}
                </div>
            </header>

            <div className="flex items-center gap-2">
                {["Certificates", "Joining Posters", "Connectors"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all border", activeTab === tab ? "bg-primary/10 text-primary border-primary/20" : "text-muted hover:text-white bg-surface-light border-border")}>
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === "Certificates" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {certificates.length === 0 ? (
                        <div className="col-span-full card p-12 text-center text-muted space-y-3">
                            <Award size={32} className="mx-auto text-zinc-800" />
                            <p className="text-sm">No appreciation nodes have been issued yet.</p>
                        </div>
                    ) : (
                        certificates.map(cert => (
                            <div key={cert.id} className="card p-5 space-y-4 hover:border-primary/30 transition-all group relative overflow-hidden">
                                <Award className="absolute -right-2 -top-2 text-primary/5 w-24 h-24" />
                                <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Award size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">{cert.employeeName}</h3>
                                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{cert.type}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground italic">&quot;{cert.reason}&quot;</p>
                                    <div className="pt-4 w-full flex justify-between items-center text-[9px] text-muted uppercase font-bold tracking-widest border-t border-border mt-2">
                                        <span>{cert.date}</span>
                                        <button onClick={() => setSelectedCert(cert)} className="text-primary hover:underline">View Preview</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : activeTab === "Joining Posters" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Mock Joining Posters */}
                    {employees.slice(0, 3).map(emp => (
                        <div key={emp.id} className="card aspect-square relative group overflow-hidden bg-gradient-to-br from-primary/20 via-surface to-surface flex flex-col items-center justify-center p-8 space-y-4 border-primary/10">
                            <div className="w-24 h-24 rounded-full border-2 border-primary overflow-hidden bg-surface-light p-1">
                                <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                                    {emp.name[0]}
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">Welcome to Geeks of Gurukul</p>
                                <h3 className="text-lg font-bold text-white leading-tight">{emp.name}</h3>
                                <p className="text-xs text-muted font-medium">{emp.designation}</p>
                                <p className="text-[10px] text-muted-foreground">{emp.dept} · {emp.location}</p>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs">
                                <Download size={14} /> Export Poster
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Connectors Registry */}
                    {[
                        { name: "Slack Node", desc: "Automate birthday wishes and announcements to #general", icon: <MessageSquare size={24} />, status: "Disconnected", color: "text-[#4A154B]" },
                        { name: "Gmail Dispatch", desc: "Sync salary slips and official notices to employee inboxes", icon: <Mail size={24} />, status: "Active", color: "text-[#EA4335]" },
                        { name: "Directory Sync", desc: "Propagate workforce nodes to internal LDAP/AD", icon: <Shield size={24} />, status: "Legacy", color: "text-primary" },
                        { name: "Custom Webhook", desc: "Strategic external signaling via POST requests", icon: <LinkIcon size={24} />, status: "Developer Only", color: "text-zinc-500" }
                    ].map(conn => (
                        <div key={conn.name} className="card p-6 flex items-start gap-4 hover:border-primary/20 transition-all group">
                            <div className={cn("p-4 rounded-2xl bg-zinc-950 border border-zinc-900 group-hover:border-zinc-800 transition-colors", conn.color)}>
                                {conn.icon}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">{conn.name}</h3>
                                    <span className={cn("text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                                        conn.status === "Active" ? "bg-primary/10 text-primary" : "bg-zinc-900 text-zinc-500"
                                    )}>{conn.status}</span>
                                </div>
                                <p className="text-xs text-zinc-400 font-medium leading-relaxed">{conn.desc}</p>
                                <div className="pt-4 flex gap-3">
                                    <button className="btn-outline py-1.5 px-4 text-[10px] flex items-center gap-1.5">
                                        <Settings size={12} /> Configure
                                    </button>
                                    <button className={cn("py-1.5 px-4 rounded-lg text-[10px] font-bold transition-all border",
                                        conn.status === "Active" ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                                    )}>
                                        {conn.status === "Active" ? "Reconnect" : "Initialize"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )
            }

            {/* Certificate Modal */}
            <AnimatePresence>
                {showCertModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCertModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-md p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-base font-bold text-white">Award Appreciation</h2>
                                <button onClick={() => setShowCertModal(false)}><X size={18} className="text-muted hover:text-white" /></button>
                            </div>
                            <form onSubmit={handleCertSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Select Employee</label>
                                    <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={certForm.employeeId} onChange={e => setCertForm({ ...certForm, employeeId: e.target.value })} required>
                                        <option value="">Select Target Node...</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Achievement Type</label>
                                    <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={certForm.type} onChange={e => setCertForm({ ...certForm, type: e.target.value as any })}>
                                        <option>Excellence</option><option>Appreciation</option><option>Long Service</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Reason / Citation</label>
                                    <textarea required rows={4} className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white resize-none" placeholder="Provide a detailed citation for the achievement..." value={certForm.reason} onChange={e => setCertForm({ ...certForm, reason: e.target.value })} />
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">This award will be archived in the employee's institutional record and a digital certificate will be generated.</p>
                                </div>
                                <button type="submit" className="btn-primary w-full py-3">Issue Institutional Recognition</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Cert Preview Modal */}
            <AnimatePresence>
                {selectedCert && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCert(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card w-full max-w-2xl bg-[#0a0a0a] border-primary/30 p-12 relative z-10 overflow-hidden flex flex-col items-center text-center space-y-8">
                            <div className="absolute inset-0 border-[20px] border-primary/5 pointer-events-none" />
                            <Award size={64} className="text-primary" />
                            <div className="space-y-2">
                                <h1 className="text-[10px] font-bold text-primary uppercase tracking-[0.5em]">Certificate of {selectedCert.type}</h1>
                                <p className="text-[9px] text-muted italic">PROUDLY PRESENTED TO</p>
                            </div>
                            <h2 className="text-4xl font-serif text-white">{selectedCert.employeeName}</h2>
                            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                                This institutional node acknowledges the outstanding contribution and commitment. {selectedCert.reason}
                            </p>
                            <div className="w-full flex justify-between items-end pt-12 border-b border-white flex-1 pb-4 px-12">
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-white">HR DIRECTOR</p>
                                    <p className="text-[8px] text-muted">Geeks of Gurukul</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-white uppercase">{selectedCert.date}</p>
                                    <p className="text-[8px] text-muted">DATE OF ISSUE</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCert(null)} className="absolute top-4 right-4 text-muted hover:text-white"><X size={20} /></button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
