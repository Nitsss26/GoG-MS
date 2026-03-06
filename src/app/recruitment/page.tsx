// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth, JobPosting } from "@/context/AuthContext";
import { Briefcase, Plus, Search, Filter, MapPin, Calendar, X, FileText, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function RecruitmentPage() {
    const { user, jobPostings, addJobPosting, closeJobPosting } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("Active");
    const [formData, setFormData] = useState({
        title: "",
        dept: "Engineering",
        type: "Full-time" as any,
        location: "Bhopal Hub",
        description: ""
    });

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const filteredJobs = jobPostings.filter(job => {
        const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.dept.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = job.status === activeTab;
        return matchesSearch && matchesTab;
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addJobPosting(formData);
        setShowModal(false);
        setFormData({ title: "", dept: "Engineering", type: "Full-time", location: "Bhopal Hub", description: "" });
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Talent Acquisition</h1>
                    <p className="text-xs text-muted">Manage institutional JDs and active market postings.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 h-9 px-4">
                    <Plus size={14} /> New Vacancy
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Active Postings</p>
                    <p className="text-lg font-bold text-white">{jobPostings.filter(j => j.status === "Active").length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Total JDs</p>
                    <p className="text-lg font-bold text-white">{jobPostings.length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Hiring Nodes</p>
                    <p className="text-lg font-bold text-primary">{new Set(jobPostings.map(j => j.location)).size}</p>
                </div>
                <div className="card p-4 space-y-1 text-center bg-primary/5 border-primary/20">
                    <p className="text-[10px] text-primary font-bold">GoG Career Portal</p>
                    <p className="text-[9px] text-muted">External sync is active</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                    {["Active", "Closed"].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all border", activeTab === tab ? "bg-primary/10 text-primary border-primary/20" : "text-muted hover:text-white bg-surface-light border-border")}>
                            {tab} Postings
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input type="text" placeholder="Filter positions..." className="w-full bg-surface border border-border rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-primary/30" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredJobs.length === 0 ? (
                    <div className="col-span-2 card p-12 text-center space-y-3">
                        <Briefcase size={32} className="mx-auto text-zinc-800" />
                        <p className="text-sm text-muted">No vacancies found matching your parameters.</p>
                    </div>
                ) : (
                    filteredJobs.map(job => (
                        <div key={job.id} className="card p-5 space-y-4 hover:border-primary/30 transition-all group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{job.title}</h3>
                                    <p className="text-[10px] text-muted mt-0.5">{job.dept} · {job.type}</p>
                                </div>
                                <span className={cn("badge", job.status === "Active" ? "badge-green" : "badge-zinc")}>{job.status}</span>
                            </div>

                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {job.description}
                            </p>

                            <div className="flex items-center gap-4 text-[10px] text-muted font-medium pt-2 border-t border-border/50">
                                <span className="flex items-center gap-1.5"><MapPin size={12} className="text-primary" /> {job.location}</span>
                                <span className="flex items-center gap-1.5"><Calendar size={12} /> {job.postedAt}</span>
                                <span className="flex items-center gap-1.5 ml-auto text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    Manage JD <ChevronRight size={12} />
                                </span>
                            </div>

                            {job.status === "Active" && (
                                <button onClick={() => closeJobPosting(job.id)} className="w-full py-2 bg-zinc-800/50 hover:bg-zinc-800 text-[10px] font-bold text-muted-foreground hover:text-white rounded-lg transition-all border border-transparent hover:border-border">
                                    Deactivate Posting
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Post Vacancy Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-lg p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-base font-bold text-white">Issue Institutional Vacancy</h2>
                                <button onClick={() => setShowModal(false)}><X size={18} className="text-muted hover:text-white" /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Position Title</label>
                                        <input type="text" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="e.g. Senior Frontend Engineer" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Department</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.dept} onChange={e => setFormData({ ...formData, dept: e.target.value })}>
                                            <option>Engineering</option><option>Product</option><option>HR</option><option>Marketing</option><option>Design</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Contract Type</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                            <option>Full-time</option><option>Part-time</option><option>Contract</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Deployment Node</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}>
                                            <option>Bhopal Hub</option><option>Indore Cluster</option><option>Hyderabad Node</option><option>Pune Cluster</option><option>Delhi Sector</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Job Description (JD)</label>
                                    <textarea required rows={5} className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white resize-none" placeholder="Detail the core responsibilities and technical requirements..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">This JD will be indexed in the internal repository and synchronized with the GoG public career portal.</p>
                                </div>
                                <button type="submit" className="btn-primary w-full py-3">Publish Professional Posting</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
