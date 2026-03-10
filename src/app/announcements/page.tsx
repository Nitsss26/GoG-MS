// "use client";

// import { useState, useEffect, useRef } from "react";
// import { useAuth, Notice } from "@/context/AuthContext";
// import { uploadToCloudinary } from "@/lib/cloudinary";
// import {
//     Megaphone, Plus, Calendar, User, Send, Image as ImageIcon, FileText,
//     Heart, AlertCircle, PartyPopper, Search, Edit3, X, CheckCheck, Cake,
//     UserPlus, Upload, Eye, Trash2, Loader2, ChevronRight, Share2, MoreVertical
// } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import { cn } from "@/lib/utils";
// import Link from "next/link";

// export default function AnnouncementsPage() {
//     const { user, notices, employees, addAnnouncement, editNotice, markAnnouncementRead } = useAuth();
//     const [showModal, setShowModal] = useState(false);
//     const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
//     const [filter, setFilter] = useState("All");
//     const [form, setForm] = useState({ title: "", content: "", category: "General" as any });
//     const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
//     const [uploading, setUploading] = useState(false);
//     const [viewNotice, setViewNotice] = useState<Notice | null>(null);

//     // Birthday / Joinee poster modals
//     const [showBirthdayModal, setShowBirthdayModal] = useState(false);
//     const [showJoineeModal, setShowJoineeModal] = useState(false);
//     const [bdayForm, setBdayForm] = useState({ message: "" });
//     const [bdayUrls, setBdayUrls] = useState<string[]>([]);
//     const [bdayUploading, setBdayUploading] = useState(false);
//     const [joineeForm, setJoineeForm] = useState({ names: "", message: "" });
//     const [joineeUrls, setJoineeUrls] = useState<string[]>([]);
//     const [joineeUploading, setJoineeUploading] = useState(false);

//     const fileRef = useRef<HTMLInputElement>(null);
//     const bdayFileRef = useRef<HTMLInputElement>(null);
//     const joineeFileRef = useRef<HTMLInputElement>(null);

//     if (!user) return null;

//     const isHROrFounder = user.role === "HR" || user.role === "FOUNDER";
//     const categories = ["All", "General", "Policy", "Event", "Urgent", "Update", "HR", "Achievement", "Training", "Birthday", "Welcome"];
//     const filteredNotices = notices.filter(n => filter === "All" || n.category === filter);

//     useEffect(() => {
//         if (!user) return;
//         notices.forEach(n => { if (!(n.readBy || []).includes(user.id)) markAnnouncementRead(n.id); });
//     }, [notices.length]);

//     // Generic file upload handler
//     const handleFileUpload = async (files: FileList | null, setUrls: React.Dispatch<React.SetStateAction<string[]>>, setLoading: React.Dispatch<React.SetStateAction<boolean>>) => {
//         if (!files || files.length === 0) return;
//         setLoading(true);
//         try {
//             for (const file of Array.from(files)) {
//                 const result = await uploadToCloudinary(file);
//                 setUrls(prev => [...prev, result.secure_url]);
//             }
//         } catch (err) { console.error("Upload failed:", err); }
//         setLoading(false);
//     };

//     const handleSubmit = (e: React.FormEvent) => {
//         e.preventDefault();
//         if (editingNotice) {
//             editNotice(editingNotice.id, { title: form.title, content: form.content, category: form.category });
//         } else {
//             addAnnouncement({ ...form, imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined } as any);
//         }
//         setForm({ title: "", content: "", category: "General" });
//         setUploadedUrls([]);
//         setEditingNotice(null);
//         setShowModal(false);
//     };

//     const handleBirthdaySubmit = (e: React.FormEvent) => {
//         e.preventDefault();
//         addAnnouncement({
//             title: "🎂 Birthday Celebration!",
//             content: bdayForm.message,
//             category: "Birthday",
//             imageUrls: bdayUrls.length > 0 ? bdayUrls : undefined
//         } as any);
//         setBdayForm({ message: "" });
//         setBdayUrls([]);
//         setShowBirthdayModal(false);
//     };

//     const handleJoineeSubmit = (e: React.FormEvent) => {
//         e.preventDefault();
//         addAnnouncement({
//             title: `🎉 Welcome New Joinee${joineeForm.names.includes(",") ? "s" : ""}: ${joineeForm.names}`,
//             content: joineeForm.message,
//             category: "Welcome",
//             imageUrls: joineeUrls.length > 0 ? joineeUrls : undefined
//         } as any);
//         setJoineeForm({ names: "", message: "" });
//         setJoineeUrls([]);
//         setShowJoineeModal(false);
//     };

//     const openEdit = (notice: Notice) => {
//         setEditingNotice(notice);
//         setForm({ title: notice.title, content: notice.content, category: notice.category });
//         setUploadedUrls(notice.imageUrls || []);
//         setShowModal(true);
//     };

//     const openNew = () => {
//         setEditingNotice(null);
//         setForm({ title: "", content: "", category: "General" });
//         setUploadedUrls([]);
//         setShowModal(true);
//     };

//     const catBadge = (cat: string) =>
//         cat === "Urgent" ? "text-red-300 bg-red-500/20 border-red-500/30" :
//             cat === "Policy" ? "text-blue-300 bg-blue-500/20 border-blue-500/30" :
//                 cat === "Event" ? "text-purple-300 bg-purple-500/20 border-purple-500/30" :
//                     cat === "Birthday" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
//                         cat === "Welcome" ? "text-sky-300 bg-sky-500/20 border-sky-500/30" :
//                             cat === "Update" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
//                                 cat === "HR" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
//                                     cat === "Achievement" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
//                                         cat === "Training" ? "text-cyan-300 bg-cyan-500/20 border-cyan-500/30" :
//                                             "text-zinc-300 bg-zinc-700/40 border-zinc-600/30";

//     const catIcon = (cat: string) =>
//         cat === "Event" ? <PartyPopper size={14} className="text-purple-400" /> :
//             cat === "Urgent" ? <AlertCircle size={14} className="text-red-400" /> :
//                 cat === "Birthday" ? <Cake size={14} className="text-pink-400" /> :
//                     cat === "Welcome" ? <UserPlus size={14} className="text-sky-400" /> :
//                         cat === "Policy" ? <FileText size={14} className="text-blue-400" /> :
//                             cat === "Update" ? <CheckCheck size={14} className="text-emerald-400" /> :
//                                 <Megaphone size={14} className="text-zinc-400" />;

//     // Reusable image upload section component
//     const ImageUploadSection = ({ urls, setUrls, uploading: isUploading, inputRef, color = "primary" }: {
//         urls: string[], setUrls: React.Dispatch<React.SetStateAction<string[]>>, uploading: boolean, inputRef: React.RefObject<HTMLInputElement | null>, color?: string
//     }) => (
//         <div className="space-y-2">
//             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Upload Images</label>
//             <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, setUrls, color === "pink" ? setBdayUploading : color === "sky" ? setJoineeUploading : setUploading)} />
//             <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}
//                 className={cn("w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 transition-all",
//                     isUploading ? "border-zinc-800 bg-zinc-900/50 cursor-wait" : "border-zinc-800 hover:border-primary/40 hover:bg-primary/5 bg-zinc-900/30 cursor-pointer"
//                 )}>
//                 {isUploading ? (
//                     <><Loader2 size={24} className="text-primary animate-spin" /><p className="text-[11px] text-primary font-bold">Uploading to Cloudinary...</p></>
//                 ) : (
//                     <><Upload size={24} className="text-zinc-500" /><div className="text-center"><p className="text-[11px] text-zinc-400 font-bold">Click to upload assets</p><p className="text-[9px] text-zinc-600 mt-0.5 whitespace-pre-wrap">Supports JPG, PNG, WEBP (Multiple allowed)</p></div></>
//                 )}
//             </button>
//             {urls.length > 0 && (
//                 <div className="flex flex-wrap gap-2.5 mt-2">
//                     {urls.map((url, i) => (
//                         <div key={i} className="relative group">
//                             <img src={url} alt="" className="w-16 h-16 object-cover rounded-xl border border-zinc-800" />
//                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
//                                 <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))}
//                                     className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform">
//                                     <X size={12} className="text-white" />
//                                 </button>
//                             </div>
//                         </div>
//                     ))}
//                 </div>
//             )}
//         </div>
//     );

//     return (
//         <div className="p-8 space-y-10 max-w-6xl mx-auto w-full min-h-screen">
//             <header className="flex justify-between items-end flex-wrap gap-4">
//                 <div className="space-y-1">
//                     <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">Strategic Communications</p>
//                     <h1 className="text-3xl font-black text-white tracking-tight">Communication Hub</h1>
//                     <p className="text-xs text-zinc-400/70 italic">Institutional Broadcast Node & Strategic Signaling</p>
//                 </div>
//                 {isHROrFounder && (
//                     <button onClick={openNew} className="btn-primary flex items-center gap-2.5 px-8 py-3.5 shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:scale-[1.02] transition-transform">
//                         <Plus size={18} /> <span className="uppercase tracking-widest font-black text-[10px]">New Broadcast</span>
//                     </button>
//                 )}
//             </header>

//             {/* Filter Chips */}
//             <div className="flex gap-2 p-1.5 bg-zinc-950/50 backdrop-blur-md border border-zinc-800/50 rounded-2xl w-fit flex-wrap">
//                 {categories.map(cat => (
//                     <button key={cat} onClick={() => setFilter(cat)}
//                         className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
//                             filter === cat ? "bg-zinc-800 text-primary shadow-lg ring-1 ring-zinc-700" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
//                         )}>{cat}</button>
//                 ))}
//             </div>

//             {/* Feed */}
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                 <AnimatePresence mode="popLayout">
//                     {filteredNotices.map((notice) => (
//                         <motion.div key={notice.id} layout
//                             initial={{ opacity: 0, scale: 0.95 }}
//                             animate={{ opacity: 1, scale: 1 }}
//                             exit={{ opacity: 0, scale: 0.95 }}
//                             className="group relative flex flex-col bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/40 rounded-3xl overflow-hidden hover:border-primary/30 transition-all hover:shadow-[0_0_40px_rgba(16,185,129,0.03)] cursor-default">

//                             {/* Visual Accent */}
//                             <div className={cn("absolute top-0 right-0 w-32 h-32 blur-3xl opacity-[0.03] transition-opacity group-hover:opacity-[0.07]", 
//                                 notice.category === "Urgent" ? "bg-red-500" : 
//                                 notice.category === "Birthday" ? "bg-pink-500" :
//                                 notice.category === "Welcome" ? "bg-sky-500" : "bg-primary"
//                             )} />

//                             <div className="p-6 space-y-4 relative z-10">
//                                 <div className="flex justify-between items-start">
//                                     <div className="flex items-center gap-2.5">
//                                         <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border transition-colors",
//                                             notice.category === "Urgent" ? "bg-red-500/10 border-red-500/20" :
//                                             notice.category === "Birthday" ? "bg-pink-500/10 border-pink-500/20" :
//                                             notice.category === "Welcome" ? "bg-sky-500/10 border-sky-500/20" :
//                                             "bg-zinc-800/50 border-zinc-700/50"
//                                         )}>
//                                             {catIcon(notice.category)}
//                                         </div>
//                                         <div className="flex flex-col gap-0.5">
//                                             <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider", catBadge(notice.category))}>
//                                                 {notice.category}
//                                             </span>
//                                             {notice.isEdited && <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">Modified</span>}
//                                         </div>
//                                     </div>
//                                     <div className="text-right">
//                                         <p className="text-[9px] font-black text-zinc-600 font-mono uppercase">{notice.createdAt}</p>
//                                         {isHROrFounder && (
//                                             <button onClick={() => openEdit(notice)} className="p-1.5 mt-1 rounded-lg hover:bg-zinc-800 text-zinc-700 hover:text-primary transition-colors">
//                                                 <Edit3 size={12} />
//                                             </button>
//                                         )}
//                                     </div>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <h3 className="text-md font-black text-white group-hover:text-primary transition-colors leading-snug">{notice.title}</h3>
//                                     <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 font-medium">{notice.content}</p>
//                                 </div>

//                                 {notice.imageUrls && notice.imageUrls.length > 0 && (
//                                     <div className="flex gap-2 pt-1">
//                                         {notice.imageUrls.slice(0, 3).map((url, i) => (
//                                             <div key={i} className="relative w-16 h-12 rounded-xl border border-zinc-800/50 overflow-hidden shrink-0">
//                                                 <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
//                                             </div>
//                                         ))}
//                                         {notice.imageUrls.length > 3 && (
//                                             <div className="h-12 flex items-center px-2 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
//                                                 <span className="text-[8px] font-black text-zinc-500">+{notice.imageUrls.length - 3}</span>
//                                             </div>
//                                         )}
//                                     </div>
//                                 )}

//                                 <div className="pt-4 border-t border-zinc-800/50 flex justify-between items-center group/footer">
//                                     <div className="flex items-center gap-2.5">
//                                         <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-400 group-hover/footer:border-primary/50 group-hover/footer:text-primary transition-colors">
//                                             {notice.createdBy[0]}
//                                         </div>
//                                         <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{notice.createdBy}</span>
//                                     </div>
//                                     <button onClick={() => setViewNotice(notice)} className="text-[10px] text-primary font-black flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-primary/10 bg-primary/5 border border-primary/20 transition-all uppercase tracking-widest">
//                                         Explore <ChevronRight size={10} />
//                                     </button>
//                                 </div>
//                             </div>
//                         </motion.div>
//                     ))}
//                 </AnimatePresence>
//             </div>

//             {/* Birthday + Joinee Poster Section */}
//             {isHROrFounder && (
//                 <div className="mt-16 space-y-10 pt-10 border-t border-zinc-900/80">
//                     <div className="flex items-center gap-4">
//                         <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/5"><Megaphone size={28} /></div>
//                         <div>
//                             <h2 className="text-2xl font-black text-white tracking-tight">Studio Ops</h2>
//                             <p className="text-xs text-zinc-500 font-medium">Visual Signaling & Identity Projection Laboratory</p>
//                         </div>
//                     </div>
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
//                         <motion.div whileHover={{ y: -5 }} onClick={() => setShowBirthdayModal(true)} 
//                             className="bg-zinc-900/30 border-zinc-800/80 border-dashed border-2 p-10 rounded-[2.5rem] text-center space-y-5 hover:border-pink-500/40 hover:bg-pink-500/[0.02] transition-all cursor-pointer group relative overflow-hidden">
//                             <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl -mr-16 -mt-16" />
//                             <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/20 rounded-2xl flex items-center justify-center mx-auto text-pink-500/40 group-hover:text-pink-500 group-hover:scale-110 transition-all duration-500">
//                                 <Cake size={32} strokeWidth={1.5} />
//                             </div>
//                             <div className="space-y-2">
//                                 <h4 className="text-md font-black text-white uppercase tracking-widest">Birthday Protocol</h4>
//                                 <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto">Upload commemorative visuals and transmit celebratory signals across the institutional node.</p>
//                             </div>
//                             <div className="pt-2">
//                                 <span className="text-[9px] font-black text-pink-400 bg-pink-500/10 px-4 py-1.5 rounded-full border border-pink-500/20 uppercase tracking-widest">Launch Studio</span>
//                             </div>
//                         </motion.div>

//                         <motion.div whileHover={{ y: -5 }} onClick={() => setShowJoineeModal(true)} 
//                             className="bg-zinc-900/30 border-zinc-800/80 border-dashed border-2 p-10 rounded-[2.5rem] text-center space-y-5 hover:border-sky-500/40 hover:bg-sky-500/[0.02] transition-all cursor-pointer group relative overflow-hidden">
//                             <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-3xl -mr-16 -mt-16" />
//                             <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center mx-auto text-sky-500/40 group-hover:text-sky-500 group-hover:scale-110 transition-all duration-500">
//                                 <UserPlus size={32} strokeWidth={1.5} />
//                             </div>
//                             <div className="space-y-2">
//                                 <h4 className="text-md font-black text-white uppercase tracking-widest">Onboarding Relay</h4>
//                                 <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto">Initialize new identity protocols. Broadcast welcome sequences for verified personnel.</p>
//                             </div>
//                             <div className="pt-2">
//                                 <span className="text-[9px] font-black text-sky-400 bg-sky-500/10 px-4 py-1.5 rounded-full border border-sky-500/20 uppercase tracking-widest">Open Terminal</span>
//                             </div>
//                         </motion.div>
//                     </div>
//                 </div>
//             )}

//             {/* View Full Announcement Modal */}
//             <AnimatePresence>
//                 {viewNotice && (
//                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewNotice(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
//                         <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} 
//                             className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-2xl relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden max-h-[90vh] flex flex-col">
//                             <div className={cn("h-2 w-full shrink-0", 
//                                 viewNotice.category === "Urgent" ? "bg-red-500" : 
//                                 viewNotice.category === "Birthday" ? "bg-pink-500" :
//                                 viewNotice.category === "Welcome" ? "bg-sky-500" : "bg-primary"
//                             )} />
//                             <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
//                                 <div className="flex justify-between items-start">
//                                     <div className="flex flex-col gap-3">
//                                         <div className="flex items-center gap-2.5">
//                                             <span className={cn("text-[10px] font-black px-4 py-1.5 rounded-full border uppercase tracking-[0.15em]", catBadge(viewNotice.category))}>{viewNotice.category}</span>
//                                             {viewNotice.isEdited && <span className="text-[8px] font-black text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-700/50 uppercase tracking-widest">Modified at {viewNotice.editedAt}</span>}
//                                         </div>
//                                         <h2 className="text-3xl font-black text-white tracking-tight leading-tight">{viewNotice.title}</h2>
//                                     </div>
//                                     <button onClick={() => setViewNotice(null)} className="p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all ring-1 ring-zinc-700/50"><X size={20} /></button>
//                                 </div>
//                                 <div className="space-y-6">
//                                     <p className="text-[13px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-medium">{viewNotice.content}</p>
//                                     {viewNotice.imageUrls && viewNotice.imageUrls.length > 0 && (
//                                         <div className="space-y-4">
//                                             {viewNotice.imageUrls.map((url, i) => (
//                                                 <div key={i} className="group relative rounded-3xl overflow-hidden border border-zinc-800">
//                                                     <img src={url} alt={`Visual Asset ${i + 1}`} className="w-full h-auto object-contain max-h-[500px]" />
//                                                     <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
//                                                 </div>
//                                             ))}
//                                         </div>
//                                     )}
//                                 </div>
//                                 <div className="pt-8 border-t border-zinc-800/80 flex items-center justify-between">
//                                     <div className="flex items-center gap-4">
//                                         <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-black text-primary">
//                                             {viewNotice.createdBy[0]}
//                                         </div>
//                                         <div>
//                                             <p className="text-[11px] font-black text-white uppercase tracking-widest">{viewNotice.createdBy}</p>
//                                             <p className="text-[9px] text-zinc-500 font-bold mt-0.5">Verified Origin Protocol</p>
//                                         </div>
//                                     </div>
//                                     <div className="text-right">
//                                         <p className="text-[10px] font-black text-zinc-400 font-mono uppercase">{viewNotice.createdAt}</p>
//                                         <p className="text-[8px] text-zinc-600 font-bold mt-1 uppercase tracking-tighter">Temporal Timestamp</p>
//                                     </div>
//                                 </div>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>

//             {/* Compose / Edit Modal */}
//             <AnimatePresence>
//                 {showModal && (
//                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowModal(false); setEditingNotice(null); }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
//                         <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
//                             className="bg-zinc-900/50 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] w-full max-w-2xl relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
//                             <div className={cn("h-1.5 w-full shrink-0", editingNotice ? "bg-amber-500" : "bg-primary")} />
//                             <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
//                                 <div className="flex justify-between items-center">
//                                     <div className="space-y-1">
//                                         <h2 className="text-2xl font-black text-white tracking-tight leading-none italic uppercase">{editingNotice ? "Update Protocol" : "New Broadcast"}</h2>
//                                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{editingNotice ? "Patch existing information nodes" : "Establish new institutional signaling"}</p>
//                                     </div>
//                                     <button onClick={() => { setShowModal(false); setEditingNotice(null); }} className="p-3 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-2xl text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
//                                 </div>
//                                 <form onSubmit={handleSubmit} className="space-y-8">
//                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                                         <div className="space-y-2">
//                                             <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Classification</label>
//                                             <select className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 text-[11px] font-black tracking-widest text-white outline-none focus:ring-2 ring-primary/20 appearance-none transition-all" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })}>
//                                                 {["General", "Policy", "Event", "Urgent", "Update", "HR", "Achievement", "Training", "Birthday", "Welcome"].map(c => <option key={c} value={c} className="bg-zinc-900">{c.toUpperCase()}</option>)}
//                                             </select>
//                                         </div>
//                                         <div className="space-y-2">
//                                             <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Title Header</label>
//                                             <input type="text" required className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 text-[11px] font-black text-white placeholder:text-zinc-700 outline-none focus:ring-2 ring-primary/20 transition-all uppercase tracking-widest" placeholder="Announce intent..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
//                                         </div>
//                                     </div>
//                                     <div className="space-y-2">
//                                         <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Informational Content</label>
//                                         <textarea required rows={5} className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-3xl p-5 text-[12px] font-medium text-zinc-300 placeholder:text-zinc-700 outline-none focus:ring-2 ring-primary/20 transition-all leading-relaxed" placeholder="Sequence details..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
//                                     </div>
//                                     <ImageUploadSection urls={uploadedUrls} setUrls={setUploadedUrls} uploading={uploading} inputRef={fileRef} />
//                                     <button type="submit" disabled={uploading} className={cn("w-full py-5 rounded-[1.5rem] font-black text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-xl",
//                                         editingNotice ? "bg-amber-500 text-black shadow-amber-500/10 hover:shadow-amber-500/20" : "bg-primary text-black shadow-primary/10 hover:shadow-primary/20"
//                                     )}>
//                                         {editingNotice ? <><Edit3 size={16} /> Execute Update</> : <><Megaphone size={16} /> Finalize Broadcast</>}
//                                     </button>
//                                 </form>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>

//             {/* Birthday Poster Modal */}
//             <AnimatePresence>
//                 {showBirthdayModal && (
//                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBirthdayModal(false)} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
//                         <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
//                             className="bg-zinc-900/50 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
//                             <div className="h-1.5 w-full bg-pink-500 shrink-0" />
//                             <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
//                                 <div className="flex justify-between items-center">
//                                     <div className="flex items-center gap-4">
//                                         <div className="p-3 bg-pink-500/10 rounded-2xl text-pink-500 ring-1 ring-pink-500/20"><Cake size={24} /></div>
//                                         <div>
//                                             <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Birthday Protocol</h2>
//                                             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Initialize celebratory visual transmission</p>
//                                         </div>
//                                     </div>
//                                     <button onClick={() => setShowBirthdayModal(false)} className="p-3 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-2xl text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
//                                 </div>
//                                 <form onSubmit={handleBirthdaySubmit} className="space-y-8 font-sans">
//                                     <div className="space-y-2">
//                                         <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Celebratory Message</label>
//                                         <textarea required rows={5} className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-3xl p-5 text-[12px] font-medium text-zinc-300 placeholder:text-zinc-700 outline-none focus:ring-2 ring-pink-500/20 transition-all leading-relaxed" placeholder="Heartfelt sequence..." value={bdayForm.message} onChange={e => setBdayForm({ ...bdayForm, message: e.target.value })} />
//                                     </div>
//                                     <ImageUploadSection urls={bdayUrls} setUrls={setBdayUrls} uploading={bdayUploading} inputRef={bdayFileRef} color="pink" />
//                                     <button type="submit" disabled={bdayUploading} className="w-full py-5 rounded-[1.5rem] font-black text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] bg-pink-500 text-white shadow-xl shadow-pink-500/10 hover:shadow-pink-500/20">
//                                         <Cake size={16} /> Transmit Visuals
//                                     </button>
//                                 </form>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>

//             {/* New Joinee Modal */}
//             <AnimatePresence>
//                 {showJoineeModal && (
//                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//                         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJoineeModal(false)} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
//                         <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
//                             className="bg-zinc-900/50 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
//                             <div className="h-1.5 w-full bg-sky-500 shrink-0" />
//                             <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
//                                 <div className="flex justify-between items-center">
//                                     <div className="flex items-center gap-4">
//                                         <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-500 ring-1 ring-sky-500/20"><UserPlus size={24} /></div>
//                                         <div>
//                                             <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Onboarding Relay</h2>
//                                             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Provisioning new personnel identity</p>
//                                         </div>
//                                     </div>
//                                     <button onClick={() => setShowJoineeModal(false)} className="p-3 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-2xl text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
//                                 </div>
//                                 <form onSubmit={handleJoineeSubmit} className="space-y-8">
//                                     <div className="space-y-2">
//                                         <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Entity Denomination(s) — comma-separated</label>
//                                         <input type="text" required className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 text-[11px] font-black text-white placeholder:text-zinc-700 outline-none focus:ring-2 ring-sky-500/20 transition-all uppercase tracking-widest font-mono" placeholder="IDENT_01, IDENT_02" value={joineeForm.names} onChange={e => setJoineeForm({ ...joineeForm, names: e.target.value })} />
//                                     </div>
//                                     <div className="space-y-2">
//                                         <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Welcome Sequence</label>
//                                         <textarea required rows={4} className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-3xl p-5 text-[12px] font-medium text-zinc-300 placeholder:text-zinc-700 outline-none focus:ring-2 ring-sky-500/20 transition-all leading-relaxed" placeholder="Establish warm rapport..." value={joineeForm.message} onChange={e => setJoineeForm({ ...joineeForm, message: e.target.value })} />
//                                     </div>
//                                     <ImageUploadSection urls={joineeUrls} setUrls={setJoineeUrls} uploading={joineeUploading} inputRef={joineeFileRef} color="sky" />
//                                     <button type="submit" disabled={joineeUploading} className="w-full py-5 rounded-[1.5rem] font-black text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] bg-sky-500 text-white shadow-xl shadow-sky-500/10 hover:shadow-sky-500/20">
//                                         <UserPlus size={16} /> Finalize Onboarding
//                                     </button>
//                                 </form>
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// }


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