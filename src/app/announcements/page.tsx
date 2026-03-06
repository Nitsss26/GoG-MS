"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, Notice } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
    Megaphone, Plus, Calendar, User, Send, Image as ImageIcon, FileText,
    Heart, AlertCircle, PartyPopper, Search, Edit3, X, CheckCheck, Cake,
    UserPlus, Upload, Eye, Trash2, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AnnouncementsPage() {
    const { user, notices, employees, addAnnouncement, editNotice, markAnnouncementRead } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
    const [filter, setFilter] = useState("All");
    const [form, setForm] = useState({ title: "", content: "", category: "General" as any });
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [viewNotice, setViewNotice] = useState<Notice | null>(null);

    // Birthday / Joinee poster modals
    const [showBirthdayModal, setShowBirthdayModal] = useState(false);
    const [showJoineeModal, setShowJoineeModal] = useState(false);
    const [bdayForm, setBdayForm] = useState({ message: "" });
    const [bdayUrls, setBdayUrls] = useState<string[]>([]);
    const [bdayUploading, setBdayUploading] = useState(false);
    const [joineeForm, setJoineeForm] = useState({ names: "", message: "" });
    const [joineeUrls, setJoineeUrls] = useState<string[]>([]);
    const [joineeUploading, setJoineeUploading] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);
    const bdayFileRef = useRef<HTMLInputElement>(null);
    const joineeFileRef = useRef<HTMLInputElement>(null);

    if (!user) return null;

    const isHROrFounder = user.role === "HR" || user.role === "FOUNDER";
    const categories = ["All", "General", "Policy", "Event", "Urgent", "Update", "HR", "Achievement", "Training", "Birthday", "Welcome"];
    const filteredNotices = notices.filter(n => filter === "All" || n.category === filter);

    useEffect(() => {
        if (!user) return;
        notices.forEach(n => { if (!(n.readBy || []).includes(user.id)) markAnnouncementRead(n.id); });
    }, [notices.length]);

    // Generic file upload handler
    const handleFileUpload = async (files: FileList | null, setUrls: React.Dispatch<React.SetStateAction<string[]>>, setLoading: React.Dispatch<React.SetStateAction<boolean>>) => {
        if (!files || files.length === 0) return;
        setLoading(true);
        try {
            for (const file of Array.from(files)) {
                const result = await uploadToCloudinary(file);
                setUrls(prev => [...prev, result.secure_url]);
            }
        } catch (err) { console.error("Upload failed:", err); }
        setLoading(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingNotice) {
            editNotice(editingNotice.id, { title: form.title, content: form.content, category: form.category });
        } else {
            addAnnouncement({ ...form, imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined } as any);
        }
        setForm({ title: "", content: "", category: "General" });
        setUploadedUrls([]);
        setEditingNotice(null);
        setShowModal(false);
    };

    const handleBirthdaySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addAnnouncement({
            title: "🎂 Birthday Celebration!",
            content: bdayForm.message,
            category: "Birthday",
            imageUrls: bdayUrls.length > 0 ? bdayUrls : undefined
        } as any);
        setBdayForm({ message: "" });
        setBdayUrls([]);
        setShowBirthdayModal(false);
    };

    const handleJoineeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addAnnouncement({
            title: `🎉 Welcome New Joinee${joineeForm.names.includes(",") ? "s" : ""}: ${joineeForm.names}`,
            content: joineeForm.message,
            category: "Welcome",
            imageUrls: joineeUrls.length > 0 ? joineeUrls : undefined
        } as any);
        setJoineeForm({ names: "", message: "" });
        setJoineeUrls([]);
        setShowJoineeModal(false);
    };

    const openEdit = (notice: Notice) => {
        setEditingNotice(notice);
        setForm({ title: notice.title, content: notice.content, category: notice.category });
        setUploadedUrls(notice.imageUrls || []);
        setShowModal(true);
    };

    const openNew = () => {
        setEditingNotice(null);
        setForm({ title: "", content: "", category: "General" });
        setUploadedUrls([]);
        setShowModal(true);
    };

    const catColor = (cat: string) =>
        cat === "Urgent" ? "bg-red-500" : cat === "Policy" ? "bg-amber-500" :
            cat === "Event" ? "bg-purple-500" : cat === "Birthday" ? "bg-pink-500" :
                cat === "Welcome" ? "bg-sky-500" : cat === "Achievement" ? "bg-amber-500" :
                    cat === "Training" ? "bg-cyan-500" : cat === "HR" ? "bg-pink-500" :
                        cat === "Update" ? "bg-emerald-500" : "bg-primary";

    const catBadge = (cat: string) =>
        cat === "Urgent" ? "text-red-300 bg-red-500/20 border-red-500/30" :
            cat === "Policy" ? "text-blue-300 bg-blue-500/20 border-blue-500/30" :
                cat === "Event" ? "text-purple-300 bg-purple-500/20 border-purple-500/30" :
                    cat === "Birthday" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                        cat === "Welcome" ? "text-sky-300 bg-sky-500/20 border-sky-500/30" :
                            cat === "Update" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                                cat === "HR" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                                    cat === "Achievement" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                                        cat === "Training" ? "text-cyan-300 bg-cyan-500/20 border-cyan-500/30" :
                                            "text-zinc-300 bg-zinc-700/40 border-zinc-600/30";

    // Reusable image upload section component
    const ImageUploadSection = ({ urls, setUrls, uploading: isUploading, inputRef, color = "primary" }: {
        urls: string[], setUrls: React.Dispatch<React.SetStateAction<string[]>>, uploading: boolean, inputRef: React.RefObject<HTMLInputElement | null>, color?: string
    }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Upload Images</label>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, setUrls, color === "pink" ? setBdayUploading : color === "sky" ? setJoineeUploading : setUploading)} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}
                className={cn("w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition-colors",
                    isUploading ? "border-zinc-700 bg-zinc-900/50 cursor-wait" : "border-zinc-700 hover:border-primary/50 bg-zinc-900/30 cursor-pointer"
                )}>
                {isUploading ? (
                    <><Loader2 size={18} className="text-primary animate-spin" /><p className="text-[10px] text-primary font-bold">Uploading to Cloudinary...</p></>
                ) : (
                    <><Upload size={18} className="text-zinc-500" /><p className="text-[10px] text-zinc-500">Click to upload images (JPG, PNG, WEBP)</p><p className="text-[8px] text-zinc-600">Multiple files supported</p></>
                )}
            </button>
            {urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {urls.map((url, i) => (
                        <div key={i} className="relative group">
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-zinc-800" />
                            <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={8} className="text-white" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto">
            <header className="flex justify-between items-end flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Communication Hub</h1>
                    <p className="text-sm text-zinc-400 mt-1 italic">Institutional Broadcast Node &amp; Strategic Signaling</p>
                </div>
                {isHROrFounder && (
                    <button onClick={openNew} className="btn-primary flex items-center gap-2 px-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <Plus size={16} /> New Broadcast
                    </button>
                )}
            </header>

            {/* Filter Chips */}
            <div className="flex gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl w-fit flex-wrap">
                {categories.map(cat => (
                    <button key={cat} onClick={() => setFilter(cat)}
                        className={cn("px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all",
                            filter === cat ? "bg-zinc-800 text-primary shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                        )}>{cat}</button>
                ))}
            </div>

            {/* Feed */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredNotices.map((notice) => (
                        <motion.div key={notice.id} layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="card group hover:border-primary/30 transition-all p-0 flex flex-col relative">
                            <div className={cn("h-2 w-full rounded-t-3xl shadow-[0_0_12px_rgba(0,0,0,0.3)]", catColor(notice.category))} />

                            <div className="p-5 space-y-3 flex-1 flex flex-col">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                                            notice.category === "Urgent" ? "bg-red-500/10 text-red-500" :
                                                notice.category === "Birthday" ? "bg-pink-500/10 text-pink-500" :
                                                    notice.category === "Welcome" ? "bg-sky-500/10 text-sky-500" :
                                                        "bg-zinc-900 text-zinc-400"
                                        )}>
                                            {notice.category === "Event" ? <PartyPopper size={14} /> :
                                                notice.category === "Urgent" ? <AlertCircle size={14} /> :
                                                    notice.category === "Birthday" ? <Cake size={14} /> :
                                                        notice.category === "Welcome" ? <UserPlus size={14} /> :
                                                            <FileText size={14} />}
                                        </div>
                                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase", catBadge(notice.category))}>{notice.category}</span>
                                        {notice.isEdited && <span className="text-[7px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">edited</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-bold text-zinc-600 font-mono">{notice.createdAt}</span>
                                        {isHROrFounder && (
                                            <button onClick={() => openEdit(notice)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-primary transition-colors" title="Edit">
                                                <Edit3 size={11} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5 flex-1">
                                    <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors leading-tight">{notice.title}</h3>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">{notice.content}</p>
                                </div>

                                {notice.imageUrls && notice.imageUrls.length > 0 && (
                                    <div className="flex gap-1.5">
                                        {notice.imageUrls.slice(0, 3).map((url, i) => (
                                            <img key={i} src={url} alt="" className="w-16 h-12 object-cover rounded-lg border border-zinc-800" />
                                        ))}
                                        {notice.imageUrls.length > 3 && <span className="text-[9px] text-zinc-500 self-center">+{notice.imageUrls.length - 3} more</span>}
                                    </div>
                                )}

                                <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400">{notice.createdBy[0]}</div>
                                        <span className="text-[10px] font-bold text-zinc-500">{notice.createdBy}</span>
                                    </div>
                                    <button onClick={() => setViewNotice(notice)} className="text-[9px] text-primary font-bold hover:underline flex items-center gap-1"><Eye size={10} /> View</button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Birthday + Joinee Poster Section */}
            {isHROrFounder && (
                <div className="mt-8 space-y-6 pt-8 border-t border-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/10 rounded-xl text-pink-500"><Megaphone size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Poster & Announcement Studio</h2>
                            <p className="text-sm text-zinc-400 italic">Create birthday posters, welcome new joinees, and visual announcements.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div onClick={() => setShowBirthdayModal(true)} className="card bg-zinc-950 border-zinc-800 border-dashed border-2 p-8 text-center space-y-3 hover:border-pink-500/50 transition-all cursor-pointer group">
                            <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mx-auto text-pink-500/50 group-hover:text-pink-500 transition-colors"><Cake size={28} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white">Birthday Poster</h4>
                                <p className="text-[11px] text-zinc-500 mt-1">Upload birthday poster(s) from your laptop and write a birthday wishing message. Auto-tagged as Birthday.</p>
                            </div>
                        </div>
                        <div onClick={() => setShowJoineeModal(true)} className="card bg-zinc-950 border-zinc-800 border-dashed border-2 p-8 text-center space-y-3 hover:border-sky-500/50 transition-all cursor-pointer group">
                            <div className="w-14 h-14 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto text-sky-500/50 group-hover:text-sky-500 transition-colors"><UserPlus size={28} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white">New Joinee Announcement</h4>
                                <p className="text-[11px] text-zinc-500 mt-1">Upload new joinee poster(s) with welcome message. Multiple joinees supported. Auto-tagged as Welcome.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Full Announcement Modal */}
            <AnimatePresence>
                {viewNotice && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewNotice(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto">
                            <div className={cn("h-1.5 w-full sticky top-0", catColor(viewNotice.category))} />
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase", catBadge(viewNotice.category))}>{viewNotice.category}</span>
                                        {viewNotice.isEdited && <span className="text-[7px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">edited {viewNotice.editedAt}</span>}
                                    </div>
                                    <button onClick={() => setViewNotice(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={16} /></button>
                                </div>
                                <h2 className="text-lg font-bold text-white leading-tight">{viewNotice.title}</h2>
                                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{viewNotice.content}</p>
                                {viewNotice.imageUrls && viewNotice.imageUrls.length > 0 && (
                                    <div className="space-y-2">
                                        {viewNotice.imageUrls.map((url, i) => (
                                            <img key={i} src={url} alt={`Poster ${i + 1}`} className="w-full rounded-xl border border-zinc-800 object-contain max-h-80" />
                                        ))}
                                    </div>
                                )}
                                <div className="pt-3 border-t border-zinc-800 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">{viewNotice.createdBy[0]}</div>
                                    <span className="text-[10px] font-bold text-zinc-500">{viewNotice.createdBy}</span>
                                    <span className="text-[9px] text-zinc-600 ml-auto">{viewNotice.createdAt}</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Compose / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowModal(false); setEditingNotice(null); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-xl p-8 relative z-10 space-y-6 shadow-2xl overflow-hidden border-zinc-800 max-h-[85vh] overflow-y-auto">
                            <div className={cn("absolute top-0 left-0 w-full h-1", editingNotice ? "bg-amber-500" : "bg-primary")} />
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">{editingNotice ? "Edit Announcement" : "New Broadcast"}</h2>
                                    <p className="text-xs text-zinc-500 mt-1">{editingNotice ? "Update the announcement details" : "Create a new announcement for all employees"}</p>
                                </div>
                                <button onClick={() => { setShowModal(false); setEditingNotice(null); }} className="p-2 hover:bg-zinc-900 rounded-xl transition-colors"><X size={16} className="text-zinc-500" /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })}>
                                        {["General", "Policy", "Event", "Urgent", "Update", "HR", "Achievement", "Training", "Birthday", "Welcome"].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Title</label>
                                    <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-primary/50 font-bold placeholder:font-normal" placeholder="Announcement title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Content</label>
                                    <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none focus:border-primary/50 leading-relaxed" placeholder="Announcement content..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                                </div>
                                <ImageUploadSection urls={uploadedUrls} setUrls={setUploadedUrls} uploading={uploading} inputRef={fileRef} />
                                <button type="submit" disabled={uploading} className={cn("w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors",
                                    editingNotice ? "bg-amber-500 hover:bg-amber-600 text-black" : "btn-primary"
                                )}>
                                    {editingNotice ? <><Edit3 size={14} /> UPDATE ANNOUNCEMENT</> : <><Megaphone size={16} /> BROADCAST TO ALL</>}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Birthday Poster Modal */}
            <AnimatePresence>
                {showBirthdayModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBirthdayModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-xl p-8 relative z-10 space-y-6 shadow-2xl overflow-hidden border-zinc-800 max-h-[85vh] overflow-y-auto">
                            <div className="absolute top-0 left-0 w-full h-1 bg-pink-500" />
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-pink-500/10 rounded-xl text-pink-500"><Cake size={20} /></div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Birthday Poster</h2>
                                        <p className="text-[11px] text-zinc-500">Upload poster(s) from your laptop and write a birthday message</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowBirthdayModal(false)} className="p-2 hover:bg-zinc-900 rounded-xl"><X size={16} className="text-zinc-500" /></button>
                            </div>
                            <form onSubmit={handleBirthdaySubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Birthday Wishing Message</label>
                                    <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none leading-relaxed" placeholder="Write a heartfelt birthday message..." value={bdayForm.message} onChange={e => setBdayForm({ ...bdayForm, message: e.target.value })} />
                                </div>
                                <ImageUploadSection urls={bdayUrls} setUrls={setBdayUrls} uploading={bdayUploading} inputRef={bdayFileRef} color="pink" />
                                <button type="submit" disabled={bdayUploading} className="w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50">
                                    <Cake size={14} /> PUBLISH BIRTHDAY POSTER
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* New Joinee Modal */}
            <AnimatePresence>
                {showJoineeModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJoineeModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-xl p-8 relative z-10 space-y-6 shadow-2xl overflow-hidden border-zinc-800 max-h-[85vh] overflow-y-auto">
                            <div className="absolute top-0 left-0 w-full h-1 bg-sky-500" />
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-500/10 rounded-xl text-sky-500"><UserPlus size={20} /></div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">New Joinee Announcement</h2>
                                        <p className="text-[11px] text-zinc-500">Upload poster(s) and welcome message for new joinees</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowJoineeModal(false)} className="p-2 hover:bg-zinc-900 rounded-xl"><X size={16} className="text-zinc-500" /></button>
                            </div>
                            <form onSubmit={handleJoineeSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Joinee Name(s) — comma-separated for multiple</label>
                                    <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white font-bold placeholder:font-normal" placeholder="Arjun Sharma, Priya Gupta" value={joineeForm.names} onChange={e => setJoineeForm({ ...joineeForm, names: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Welcome Message</label>
                                    <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none leading-relaxed" placeholder="Write a warm welcome message..." value={joineeForm.message} onChange={e => setJoineeForm({ ...joineeForm, message: e.target.value })} />
                                </div>
                                <ImageUploadSection urls={joineeUrls} setUrls={setJoineeUrls} uploading={joineeUploading} inputRef={joineeFileRef} color="sky" />
                                <button type="submit" disabled={joineeUploading} className="w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] disabled:opacity-50">
                                    <UserPlus size={14} /> PUBLISH WELCOME POSTER
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
