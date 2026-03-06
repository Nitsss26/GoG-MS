"use client";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileText, Download, Eye, Bell, ArrowLeft, X, BookOpen, List, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// Simple markdown-to-JSX renderer
function renderMarkdown(md: string) {
    const lines = md.split("\n");
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];
    let inOrderedList = false;
    let orderedItems: React.ReactNode[] = [];
    let listKey = 0;

    const flushList = () => {
        if (inList && listItems.length > 0) {
            elements.push(<ul key={`ul-${listKey++}`} className="space-y-1 ml-4">{listItems}</ul>);
            listItems = []; inList = false;
        }
        if (inOrderedList && orderedItems.length > 0) {
            elements.push(<ol key={`ol-${listKey++}`} className="space-y-1 ml-4 list-decimal list-inside">{orderedItems}</ol>);
            orderedItems = []; inOrderedList = false;
        }
    };

    const fmt = (text: string) => {
        const parts: React.ReactNode[] = [];
        const rx = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let last = 0; let m; let idx = 0;
        while ((m = rx.exec(text)) !== null) {
            if (m.index > last) parts.push(text.slice(last, m.index));
            if (m[2]) parts.push(<strong key={idx} className="font-bold italic text-white">{m[2]}</strong>);
            else if (m[3]) parts.push(<strong key={idx} className="font-bold text-white">{m[3]}</strong>);
            else if (m[4]) parts.push(<em key={idx} className="italic text-zinc-300">{m[4]}</em>);
            else if (m[5]) parts.push(<code key={idx} className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400 text-[10px]">{m[5]}</code>);
            last = m.index + m[0].length; idx++;
        }
        if (last < text.length) parts.push(text.slice(last));
        return parts.length > 0 ? parts : [text];
    };

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) { flushList(); elements.push(<div key={`br-${i}`} className="h-2" />); continue; }
        if (t === "---") { flushList(); elements.push(<hr key={`hr-${i}`} className="border-zinc-700/50 my-4" />); continue; }
        if (t.startsWith("> ")) { flushList(); elements.push(<div key={`bq-${i}`} className="border-l-2 border-amber-500/50 pl-4 py-2 bg-amber-500/5 rounded-r-lg my-2"><p className="text-[11px] text-amber-300/80 leading-relaxed">{fmt(t.slice(2))}</p></div>); continue; }
        if (t.startsWith("# ")) { flushList(); elements.push(<h1 key={`h1-${i}`} id={`section-${i}`} className="text-xl font-black text-white mt-6 mb-3 tracking-tight">{fmt(t.slice(2))}</h1>); continue; }
        if (t.startsWith("## ")) { flushList(); elements.push(<h2 key={`h2-${i}`} id={`section-${i}`} className="text-base font-bold text-white mt-5 mb-2 border-b border-zinc-800/50 pb-2">{fmt(t.slice(3))}</h2>); continue; }
        if (t.startsWith("### ")) { flushList(); elements.push(<h3 key={`h3-${i}`} id={`section-${i}`} className="text-sm font-bold text-zinc-200 mt-4 mb-1.5">{fmt(t.slice(4))}</h3>); continue; }
        if (t.startsWith("- ")) { if (!inList) { flushList(); inList = true; } listItems.push(<li key={`li-${i}`} className="text-[11px] text-zinc-400 leading-relaxed flex gap-2"><span className="text-primary mt-0.5 shrink-0">&bull;</span><span>{fmt(t.slice(2))}</span></li>); continue; }
        const ol = t.match(/^(\d+)\.\s/);
        if (ol) { if (!inOrderedList) { flushList(); inOrderedList = true; } orderedItems.push(<li key={`oli-${i}`} className="text-[11px] text-zinc-400 leading-relaxed">{fmt(t.slice(ol[0].length))}</li>); continue; }
        flushList();
        elements.push(<p key={`p-${i}`} className="text-[11px] text-zinc-400 leading-relaxed">{fmt(t)}</p>);
    }
    flushList();
    return elements;
}

function extractTOC(md: string) {
    const lines = md.split("\n");
    const toc: { level: number; text: string; anchor: string }[] = [];
    lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith("## ")) toc.push({ level: 2, text: t.slice(3).replace(/\*\*/g, ""), anchor: `section-${i}` });
        else if (t.startsWith("### ")) toc.push({ level: 3, text: t.slice(4).replace(/\*\*/g, ""), anchor: `section-${i}` });
    });
    return toc;
}

// Type import
import type { SOPNotification } from "@/context/AuthContext";

export default function SOPViewerPage() {
    const { user, sopNotifications, masterSopContent, markSOPNotificationRead, markAllSOPNotificationsRead } = useAuth();
    const [activeTab, setActiveTab] = useState<"document" | "changes">("document");
    const [showTOC, setShowTOC] = useState(true);
    const [selectedNotif, setSelectedNotif] = useState<SOPNotification | null>(null);

    if (!user) return null;

    const toc = useMemo(() => extractTOC(masterSopContent), [masterSopContent]);
    const unreadNotifs = sopNotifications.filter(n => !n.readBy.includes(user.id));

    const handleDownloadPDF = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        const htmlContent = masterSopContent
            .replace(/^# (.+)$/gm, "<h1 style='font-size:24px;font-weight:bold;margin:20px 0 10px;border-bottom:2px solid #333;padding-bottom:8px;'>$1</h1>")
            .replace(/^## (.+)$/gm, "<h2 style='font-size:18px;font-weight:bold;margin:18px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px;'>$1</h2>")
            .replace(/^### (.+)$/gm, "<h3 style='font-size:14px;font-weight:bold;margin:14px 0 6px;'>$1</h3>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/^- (.+)$/gm, "<li style='margin:4px 0 4px 20px;font-size:13px;'>$1</li>")
            .replace(/^(\d+)\. (.+)$/gm, "<li style='margin:4px 0 4px 20px;font-size:13px;list-style-type:decimal;'>$2</li>")
            .replace(/^> (.+)$/gm, "<blockquote style='border-left:3px solid #ccc;padding:8px 12px;margin:10px 0;background:#f9f9f9;font-size:12px;color:#555;'>$1</blockquote>")
            .replace(/^---$/gm, "<hr style='margin:20px 0;border:none;border-top:1px solid #ddd;'>")
            .replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
        printWindow.document.write(`<!DOCTYPE html><html><head><title>GoG SOP Document</title>
            <style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#222;font-size:13px;line-height:1.7;}h1{color:#111;}h2{color:#222;}h3{color:#333;}strong{color:#000;}@media print{body{padding:20px;}@page{margin:1.5cm;}}</style>
        </head><body>${htmlContent}</body></html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const openNotifDetail = (notif: SOPNotification) => {
        setSelectedNotif(notif);
        // Mark as read when opened
        if (!notif.readBy.includes(user.id)) {
            markSOPNotificationRead(notif.id);
        }
    };

    return (
        <div className="p-6 space-y-5 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/" className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft size={16} /></Link>
                        <h1 className="text-xl font-bold text-white tracking-tight">Standard Operating Procedure</h1>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Geeks of Gurukul &middot; Effective from 1st April 2025</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleDownloadPDF} className="text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-colors">
                        <Download size={12} /> Download PDF
                    </button>
                    {(user.role === "HR" || user.role === "FOUNDER") && (
                        <Link href="/hr/sop" className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-xl border border-primary/20 flex items-center gap-1.5 transition-colors">
                            <FileText size={12} /> Edit Full SOP
                        </Link>
                    )}
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl w-fit border border-zinc-800/50">
                <button onClick={() => setActiveTab("document")} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", activeTab === "document" ? "bg-primary/20 text-primary" : "text-zinc-500 hover:text-zinc-300")}>
                    <BookOpen size={13} /> Full Document
                </button>
                <button onClick={() => setActiveTab("changes")} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative", activeTab === "changes" ? "bg-primary/20 text-primary" : "text-zinc-500 hover:text-zinc-300")}>
                    <Bell size={13} /> SOP Changes
                    {unreadNotifs.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{unreadNotifs.length}</span>}
                </button>
            </div>

            {activeTab === "document" ? (
                <div className="flex gap-5">
                    {showTOC && (
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-64 shrink-0 sticky top-6 self-start">
                            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5"><List size={13} /> Table of Contents</h3>
                                    <button onClick={() => setShowTOC(false)} className="text-zinc-600 hover:text-zinc-400"><X size={12} /></button>
                                </div>
                                <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {toc.map((item, i) => (
                                        <a key={i} href={`#${item.anchor}`} className={cn(
                                            "block text-[10px] py-1 px-2 rounded-lg hover:bg-zinc-800/50 transition-colors truncate",
                                            item.level === 2 ? "text-zinc-400 font-bold" : "text-zinc-500 pl-5"
                                        )}>{item.text}</a>
                                    ))}
                                </nav>
                            </div>
                        </motion.div>
                    )}
                    <div className="flex-1 min-w-0">
                        {!showTOC && (
                            <button onClick={() => setShowTOC(true)} className="mb-3 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1"><List size={12} /> Show Contents</button>
                        )}
                        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-6 lg:p-8">
                            {renderMarkdown(masterSopContent)}
                        </div>
                    </div>
                </div>
            ) : (
                /* Changes Tab */
                <div className="space-y-3">
                    {unreadNotifs.length > 0 && (
                        <div className="flex justify-end">
                            <button onClick={() => markAllSOPNotificationsRead()} className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1 transition-colors">
                                <CheckCheck size={12} /> Mark All as Read ({unreadNotifs.length})
                            </button>
                        </div>
                    )}

                    {sopNotifications.length > 0 ? (
                        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Bell size={14} className="text-amber-400" /> SOP Change History</h3>
                            <div className="space-y-1.5">
                                {sopNotifications.map(n => {
                                    const isRead = n.readBy.includes(user.id);
                                    return (
                                        <div key={n.id}
                                            className={cn("flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer",
                                                isRead ? "bg-zinc-800/20 hover:bg-zinc-800/30" : "bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10"
                                            )}
                                            onClick={() => openNotifDetail(n)}>
                                            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0",
                                                !isRead ? "bg-amber-400 animate-pulse" :
                                                    n.changeType === "new" ? "bg-emerald-500" : n.changeType === "updated" ? "bg-blue-500" : "bg-red-500"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className={cn("text-[11px] font-bold truncate", isRead ? "text-zinc-500" : "text-white")}>{n.title}</p>
                                                    <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded-full border uppercase shrink-0",
                                                        n.changeType === "new" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                                                            n.changeType === "updated" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                                                                "text-red-300 bg-red-500/20 border-red-500/30"
                                                    )}>{n.changeType}</span>
                                                </div>
                                                <p className="text-[9px] text-zinc-600 mt-0.5">
                                                    {n.changedBy} &middot; {n.changedAt}
                                                    {n.changelog && <span className="text-zinc-500"> &mdash; {n.changelog}</span>}
                                                </p>
                                            </div>
                                            {!isRead ? (
                                                <span className="text-[7px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">UNREAD</span>
                                            ) : (
                                                <span className="text-[7px] font-bold text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/30">READ</span>
                                            )}
                                            <Eye size={12} className="text-zinc-600 shrink-0" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-12 text-center">
                            <Bell size={32} className="text-zinc-700 mx-auto mb-3" />
                            <p className="text-sm text-zinc-500">No SOP changes yet</p>
                        </div>
                    )}
                </div>
            )}

            {/* Change Detail Modal */}
            <AnimatePresence>
                {selectedNotif && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedNotif(null)} />
                        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-3 h-3 rounded-full",
                                        selectedNotif.changeType === "new" ? "bg-emerald-500" :
                                            selectedNotif.changeType === "updated" ? "bg-amber-500" : "bg-red-500"
                                    )} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-bold text-white">{selectedNotif.title}</h2>
                                            <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded-full border uppercase",
                                                selectedNotif.changeType === "new" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                                                    selectedNotif.changeType === "updated" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                                                        "text-red-300 bg-red-500/20 border-red-500/30"
                                            )}>{selectedNotif.changeType}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">Changed by {selectedNotif.changedBy} on {selectedNotif.changedAt}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedNotif(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={16} /></button>
                            </div>

                            {/* Change Summary */}
                            {selectedNotif.changelog && (
                                <div className="px-5 pt-4">
                                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Change Summary</p>
                                        <p className="text-[11px] text-zinc-300">{selectedNotif.changelog}</p>
                                    </div>
                                </div>
                            )}

                            {/* Content: Old vs New for Updated, New Content for New */}
                            <div className="p-5 max-h-[55vh] overflow-y-auto custom-scrollbar">
                                {selectedNotif.changeType === "updated" ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Previous Version
                                            </p>
                                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap min-h-[150px]">
                                                {selectedNotif.previousContent || "Previous content not available for this change."}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Current Version
                                            </p>
                                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap min-h-[150px]">
                                                {selectedNotif.newContent || "Current content preview not available."}
                                            </div>
                                        </div>
                                    </div>
                                ) : selectedNotif.changeType === "new" ? (
                                    <div>
                                        <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Newly Added Content
                                        </p>
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap min-h-[150px]">
                                            {selectedNotif.newContent || "This is a newly added SOP section. View the full document for details."}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Deleted Content
                                        </p>
                                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap min-h-[150px]">
                                            {selectedNotif.previousContent || "This SOP section has been removed."}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-zinc-800 flex justify-between items-center">
                                <p className="text-[9px] text-emerald-400 flex items-center gap-1"><CheckCheck size={10} /> Marked as read</p>
                                <button onClick={() => setSelectedNotif(null)} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors">Close</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
