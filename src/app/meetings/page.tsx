"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Plus, X, CheckCircle2, Clock, User, Calendar, MessageSquare, ChevronRight, Link as LinkIcon, Users, Image as ImageIcon, Loader2, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MeetingsPage() {
    const { user, meetings, addMeetingRequest, updateMeetingStatus, employees } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Scheduling Form State
    const [formData, setFormData] = useState({
        targetName: "All Faculty",
        purpose: "",
        date: "",
        time: "",
        googleLink: "",
        agenda: "",
        selectedAttendees: [] as string[]
    });

    // Completion Form State
    const [momData, setMomData] = useState({
        screenshotUrls: [] as string[],
        attendees: [] as { id: string; name: string; status: 'Present' | 'Absent (Genuine)' | 'Absent (Non-Genuine)'; reason?: string }[]
    });

    const [searchTerm, setSearchTerm] = useState("");

    const canSchedule = ["FOUNDER", "HR", "AD", "HOI", "OM", "TL"].includes(user?.role || "");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedAttendees = employees
            .filter(e => formData.selectedAttendees.includes(e.id))
            .map(e => ({ id: e.id, name: e.name }));

        addMeetingRequest({
            targetName: formData.targetName,
            purpose: formData.purpose,
            date: formData.date,
            time: formData.time,
            googleLink: formData.googleLink,
            agenda: formData.agenda,
            attendees: selectedAttendees
        });
        setShowModal(false);
        setFormData({ targetName: "All Faculty", purpose: "", date: "", time: "", googleLink: "", agenda: "", selectedAttendees: [] });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const results = await Promise.all(Array.from(files).map(f => uploadToCloudinary(f)));
            const urls = results.map(r => r.secure_url);
            setMomData(prev => ({ ...prev, screenshotUrls: [...prev.screenshotUrls, ...urls] }));
        } catch (err) {
            alert("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleCompleteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (momData.screenshotUrls.length === 0) {
            alert("A screenshot of the meeting is mandatory.");
            return;
        }
        if (showCompleteModal) {
            updateMeetingStatus(showCompleteModal, "Completed", momData);
            setShowCompleteModal(null);
            setMomData({ screenshotUrls: [], attendees: [] });
        }
    };

    const filteredMeetings = user?.role === "HR" || user?.role === "FOUNDER"
        ? meetings
        : meetings.filter(m =>
            m.employeeId === user?.id ||
            m.attendees?.some(a => a.id === user?.id) ||
            user?.role && ["AD", "HOI", "OM"].includes(user.role) // Managers can see meetings in their chain usually
        );

    const selectableEmployees = employees.filter(e => e.id !== user?.id);
    const searchedEmployees = selectableEmployees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.dept.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Institutional Syncs</h1>
                    <p className="text-xs text-muted">Management of departmental meetings and strategic sync requests.</p>
                </div>
                {canSchedule && (
                    <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 h-9 px-4">
                        <Plus size={14} /> Initiate Sync
                    </button>
                )}
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Global Syncs</p>
                    <p className="text-lg font-bold text-white">{filteredMeetings.length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Pending Requests</p>
                    <p className="text-lg font-bold text-amber-500">{filteredMeetings.filter(m => m.status === "Pending").length}</p>
                </div>
                <div className="card p-4 space-y-1">
                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Active Schedule</p>
                    <p className="text-lg font-bold text-primary">{filteredMeetings.filter(m => m.status === "Scheduled").length}</p>
                </div>
            </div>

            {/* Meeting List */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center bg-surface-light/50">
                    <h3 className="text-sm font-semibold text-white">Sync Registry</h3>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted uppercase tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Scheduled</span>
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted uppercase tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest bg-surface-light/30">
                                <th className="px-5 py-4">Originator</th>
                                <th className="px-5 py-4">Sync Purpose & Agenda</th>
                                <th className="px-5 py-4">Timeline & Link</th>
                                <th className="px-5 py-4">Attendees</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredMeetings.length === 0 ? (
                                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">No institutional syncs found in the active registry.</td></tr>
                            ) : (
                                filteredMeetings.map(m => (
                                    <tr key={m.id} className="hover:bg-surface-light transition-colors group">
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-[10px] font-bold shadow-sm">{m.employeeName[0]}</div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white">{m.employeeName}</span>
                                                    <span className="text-[9px] text-muted">{m.targetName}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="space-y-1">
                                                <p className="font-bold text-zinc-300">{m.purpose}</p>
                                                {m.agenda && <p className="text-[10px] text-muted line-clamp-2 italic">{m.agenda}</p>}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">{m.date}</span>
                                                    <span className="text-[10px] text-muted">{m.time} IST</span>
                                                </div>
                                                {m.googleLink && (
                                                    <a href={m.googleLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] text-primary hover:underline font-bold">
                                                        <Video size={12} /> Join Session
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex -space-x-2">
                                                {m.attendees?.slice(0, 3).map((a, i) => (
                                                    <div key={a.id} className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-surface flex items-center justify-center text-[8px] font-bold text-white" title={a.name}>
                                                        {a.name[0]}
                                                    </div>
                                                ))}
                                                {(m.attendees?.length || 0) > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-surface flex items-center justify-center text-[8px] font-bold text-zinc-400">
                                                        +{(m.attendees?.length || 0) - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <span className={cn("badge",
                                                m.status === "Scheduled" ? "badge-green shadow-[0_0_10px_rgba(34,197,94,0.1)]" :
                                                    m.status === "Pending" ? "badge-amber shadow-[0_0_10px_rgba(245,158,11,0.1)]" :
                                                        m.status === "Completed" ? "badge-zinc" : "badge-amber"
                                            )}>{m.status}</span>
                                        </td>
                                        <td className="px-5 py-4 align-top text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {m.status === "Pending" && (user?.role === "HR" || user?.role === "FOUNDER") ? (
                                                    <>
                                                        <button onClick={() => updateMeetingStatus(m.id, "Scheduled")} className="h-7 w-7 flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary hover:text-white transition-all">
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                        <button onClick={() => updateMeetingStatus(m.id, "Completed")} className="h-7 w-7 flex items-center justify-center bg-zinc-800 text-muted border border-border rounded hover:bg-zinc-700 transition-all">
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                ) : m.status === "Scheduled" && (m.employeeId === user?.id || user?.role === "HR") ? (
                                                    <button
                                                        onClick={() => {
                                                            setMomData({
                                                                screenshotUrls: [],
                                                                attendees: m.attendees?.map(a => ({ id: a.id, name: a.name, status: 'Present' })) || []
                                                            });
                                                            setShowCompleteModal(m.id);
                                                        }}
                                                        className="btn-outline h-8 px-3 text-[10px] font-bold border-green-500/20 text-green-500 hover:bg-green-500/10 flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle2 size={12} /> Log MOM
                                                    </button>
                                                ) : m.status === "Completed" ? (
                                                    <div className="flex items-center gap-2">
                                                        {m.screenshotUrls && m.screenshotUrls.length > 0 && (
                                                            <div className="flex -space-x-1">
                                                                {m.screenshotUrls.map((url, i) => (
                                                                    <div key={i} className="w-5 h-5 rounded border border-border overflow-hidden bg-zinc-800">
                                                                        <img src={url} alt="attendees" className="w-full h-full object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <button className="text-muted hover:text-white transition-colors"><ChevronRight size={14} /></button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Request Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-2xl p-6 relative z-10 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center text-white">
                                <h2 className="text-base font-bold">Initiate Institutional Sync</h2>
                                <button onClick={() => setShowModal(false)} className="text-muted hover:text-white"><X size={18} /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Meeting Target</label>
                                        <input className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="e.g. All Faculty, Engineering Node..." value={formData.targetName} onChange={e => setFormData({ ...formData, targetName: e.target.value })} required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Sync Purpose</label>
                                        <input required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="Brief purpose..." value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Detailed Agenda</label>
                                        <textarea required rows={4} className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white resize-none" placeholder="Detail the agenda for this sync session..." value={formData.agenda} onChange={e => setFormData({ ...formData, agenda: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Date</label>
                                            <input type="date" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Time (IST)</label>
                                            <input type="time" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Google Meeting Link</label>
                                        <div className="relative">
                                            <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                            <input type="url" required className="w-full bg-surface-light border border-border rounded-lg p-3 pl-9 text-xs text-white" placeholder="https://meet.google.com/..." value={formData.googleLink} onChange={e => setFormData({ ...formData, googleLink: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 flex flex-col h-full">
                                    <div className="space-y-1 flex-1 flex flex-col">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest flex justify-between">
                                            Select Attendees
                                            <span className="text-primary">{formData.selectedAttendees.length} selected</span>
                                        </label>
                                        <div className="relative mb-2">
                                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                            <input type="text" className="w-full bg-surface-light border border-border rounded-lg py-2 pl-9 pr-3 text-[11px] text-white outline-none focus:border-primary/50 transition-colors" placeholder="Search by name, role, dept..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                        </div>
                                        <div className="flex-1 bg-surface-light border border-border rounded-lg overflow-y-auto custom-scrollbar p-2 space-y-1 min-h-[200px]">
                                            {searchedEmployees.map(e => (
                                                <label key={e.id} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border border-transparent",
                                                    formData.selectedAttendees.includes(e.id) ? "bg-primary/10 border-primary/20" : "hover:bg-zinc-800"
                                                )}>
                                                    <input type="checkbox" className="hidden" checked={formData.selectedAttendees.includes(e.id)} onChange={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            selectedAttendees: prev.selectedAttendees.includes(e.id)
                                                                ? prev.selectedAttendees.filter(id => id !== e.id)
                                                                : [...prev.selectedAttendees, e.id]
                                                        }));
                                                    }} />
                                                    <div className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                                                        formData.selectedAttendees.includes(e.id) ? "bg-primary border-primary" : "border-muted"
                                                    )}>
                                                        {formData.selectedAttendees.includes(e.id) && <CheckCircle2 size={10} className="text-white" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[11px] font-bold text-white leading-none">{e.name}</p>
                                                        <p className="text-[9px] text-muted-foreground mt-1">{e.role} Â· {e.dept}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <button type="submit" className="btn-primary w-full py-3 h-12">Execute Institutional Sync</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Complete Meeting Modal */}
            <AnimatePresence>
                {showCompleteModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCompleteModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-3xl p-6 relative z-10 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar border-primary/20 shadow-2xl shadow-primary/5">
                            <div className="flex justify-between items-center text-white border-b border-border pb-4">
                                <div>
                                    <h2 className="text-base font-bold text-primary flex items-center gap-2"><CheckCircle2 size={18} /> Finalize Session & Upload MOM</h2>
                                    <p className="text-[10px] text-muted mt-0.5">Categorize attendees and provide mandatory session proof.</p>
                                </div>
                                <button onClick={() => setShowCompleteModal(null)} className="text-muted hover:text-white"><X size={18} /></button>
                            </div>

                            <form onSubmit={handleCompleteSubmit} className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Users size={12} className="text-primary" /> Attendee Categorization
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {momData.attendees.map((a, i) => (
                                            <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-4 p-3 bg-surface-light/50 border border-border rounded-xl">
                                                <div className="flex items-center gap-3 min-w-[150px]">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-border flex items-center justify-center text-white text-[10px] font-bold">{a.name[0]}</div>
                                                    <span className="text-[11px] font-bold text-white">{a.name}</span>
                                                </div>
                                                <div className="flex-1 grid grid-cols-3 gap-2">
                                                    {(['Present', 'Absent (Genuine)', 'Absent (Non-Genuine)'] as const).map(status => (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            onClick={() => {
                                                                const next = [...momData.attendees];
                                                                next[i].status = status;
                                                                setMomData({ ...momData, attendees: next });
                                                            }}
                                                            className={cn("px-2 py-2 rounded-lg text-[9px] font-bold transition-all border",
                                                                a.status === status
                                                                    ? status === 'Present' ? "bg-green-500/20 border-green-500/40 text-green-400" :
                                                                        status === 'Absent (Genuine)' ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-red-500/20 border-red-500/40 text-red-400"
                                                                    : "bg-zinc-800 border-border text-muted hover:text-zinc-300"
                                                            )}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                                {a.status !== 'Present' && (
                                                    <input
                                                        className="flex-1 bg-zinc-900/50 border border-border rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-primary/30"
                                                        placeholder="Add reason..."
                                                        value={a.reason || ""}
                                                        onChange={e => {
                                                            const next = [...momData.attendees];
                                                            next[i].reason = e.target.value;
                                                            setMomData({ ...momData, attendees: next });
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                                        <ImageIcon size={12} className="text-primary" /> Session Screenshots (Mandatory)
                                    </label>
                                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                                        {momData.screenshotUrls.map((url, i) => (
                                            <div key={i} className="aspect-square rounded-xl border border-border bg-zinc-800 relative group overflow-hidden">
                                                <img src={url} alt="proof" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setMomData(prev => ({ ...prev, screenshotUrls: prev.screenshotUrls.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-black/60 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X size={10} className="text-white" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-muted hover:text-primary">
                                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <>
                                                <Plus size={16} />
                                                <span className="text-[8px] font-bold uppercase tracking-wider">Add Photo</span>
                                            </>}
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                    </div>
                                    <p className="text-[9px] text-zinc-500 italic">Please upload screenshots with all attendees' cameras visible as per SOP guidelines.</p>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-border">
                                    <button type="button" onClick={() => setShowCompleteModal(null)} className="flex-1 h-12 rounded-xl border border-border text-xs font-bold text-white hover:bg-zinc-800 transition-colors">Cancel</button>
                                    <button type="submit" disabled={isUploading} className="flex-[2] h-12 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : "Finalize Session Records"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
