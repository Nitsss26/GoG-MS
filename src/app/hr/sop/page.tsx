"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileText, Save, Eye, Bold, Heading, List, Minus, Bell, ArrowLeft, Type, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// Minimal markdown preview renderer
function renderPreview(md: string) {
    const lines = md.split("\n");
    const elements: React.ReactNode[] = [];

    const fmt = (text: string) => {
        const parts: React.ReactNode[] = [];
        const rx = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let last = 0; let m; let idx = 0;
        while ((m = rx.exec(text)) !== null) {
            if (m.index > last) parts.push(text.slice(last, m.index));
            if (m[2]) parts.push(<strong key={idx} className="font-bold text-white">{m[2]}</strong>);
            else if (m[3]) parts.push(<em key={idx} className="italic text-zinc-300">{m[3]}</em>);
            else if (m[4]) parts.push(<code key={idx} className="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 text-[9px]">{m[4]}</code>);
            last = m.index + m[0].length; idx++;
        }
        if (last < text.length) parts.push(text.slice(last));
        return parts.length > 0 ? parts : [text];
    };

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) { elements.push(<div key={`br-${i}`} className="h-1.5" />); continue; }
        if (t === "---") { elements.push(<hr key={`hr-${i}`} className="border-zinc-700/50 my-3" />); continue; }
        if (t.startsWith("> ")) { elements.push(<div key={`bq-${i}`} className="border-l-2 border-amber-500/50 pl-3 py-1 bg-amber-500/5 rounded-r-lg my-1"><p className="text-[10px] text-amber-300/80">{fmt(t.slice(2))}</p></div>); continue; }
        if (t.startsWith("# ")) { elements.push(<h1 key={`h1-${i}`} className="text-lg font-black text-white mt-4 mb-2">{fmt(t.slice(2))}</h1>); continue; }
        if (t.startsWith("## ")) { elements.push(<h2 key={`h2-${i}`} className="text-sm font-bold text-white mt-3 mb-1.5 border-b border-zinc-800/50 pb-1">{fmt(t.slice(3))}</h2>); continue; }
        if (t.startsWith("### ")) { elements.push(<h3 key={`h3-${i}`} className="text-xs font-bold text-zinc-200 mt-2 mb-1">{fmt(t.slice(4))}</h3>); continue; }
        if (t.startsWith("- ")) { elements.push(<div key={`li-${i}`} className="flex gap-1.5 ml-3"><span className="text-primary text-[10px] mt-0.5">•</span><p className="text-[10px] text-zinc-400">{fmt(t.slice(2))}</p></div>); continue; }
        const ol = t.match(/^(\d+)\.\s/);
        if (ol) { elements.push(<p key={`ol-${i}`} className="text-[10px] text-zinc-400 ml-3">{fmt(t)}</p>); continue; }
        elements.push(<p key={`p-${i}`} className="text-[10px] text-zinc-400">{fmt(t)}</p>);
    }
    return elements;
}

export default function SOPEditorPage() {
    const { user, masterSopContent, updateMasterSop } = useAuth();
    const [content, setContent] = useState(masterSopContent);
    const [changelog, setChangelog] = useState("");
    const [showNotifyPopup, setShowNotifyPopup] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const handleContentChange = (val: string) => {
        setContent(val);
        setHasChanges(val !== masterSopContent);
    };

    const handleSave = () => {
        if (!hasChanges) return;
        updateMasterSop(content, changelog || undefined);
        setShowNotifyPopup(true);
        setHasChanges(false);
        setChangelog("");
    };

    const insertAt = (prefix: string, suffix: string = "") => {
        setContent(prev => prev + prefix + suffix);
        setHasChanges(true);
    };

    return (
        <div className="p-4 space-y-4 max-w-[1600px] mx-auto w-full h-[calc(100vh-2rem)] flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <Link href="/sop" className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft size={16} /></Link>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight">SOP Document Editor</h1>
                        <p className="text-[10px] text-zinc-500">Edit the full Standard Operating Procedure document with live preview</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 animate-pulse">Unsaved Changes</span>}
                    <Link href="/sop" className="text-[10px] font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-colors">
                        <Eye size={12} /> Preview Page
                    </Link>
                    <button onClick={handleSave} disabled={!hasChanges}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                        <Save size={13} /> Save & Notify All
                    </button>
                </div>
            </header>

            {/* Changelog input */}
            <div className="shrink-0 flex items-center gap-3">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest shrink-0">Change Summary</label>
                <input type="text" placeholder="e.g. Updated attendance policy, added WFH section..." value={changelog} onChange={e => setChangelog(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none transition-colors" />
            </div>

            {/* Split Pane: Editor + Preview */}
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                {/* Left: Markdown Editor */}
                <div className="flex flex-col bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center gap-0.5 p-1.5 border-b border-zinc-800/50 bg-zinc-950/50">
                        <button onClick={() => insertAt("\n## ")} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Heading 2"><Heading size={13} /></button>
                        <button onClick={() => insertAt("\n### ")} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Heading 3"><Type size={13} /></button>
                        <button onClick={() => insertAt("**", "**")} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Bold"><Bold size={13} /></button>
                        <button onClick={() => insertAt("\n- ")} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Bullet List"><List size={13} /></button>
                        <button onClick={() => insertAt("\n---\n")} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Divider"><Minus size={13} /></button>
                        <button onClick={() => insertAt("\n> ")} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors" title="Blockquote"><Quote size={13} /></button>
                        <div className="flex-1" />
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mr-2">Markdown Editor</span>
                    </div>
                    {/* Textarea */}
                    <textarea
                        value={content}
                        onChange={e => handleContentChange(e.target.value)}
                        className="flex-1 bg-transparent p-4 text-[11px] text-zinc-300 leading-relaxed resize-none outline-none font-mono custom-scrollbar"
                        spellCheck={false}
                    />
                    <div className="border-t border-zinc-800/50 px-3 py-1.5 flex justify-between">
                        <span className="text-[8px] text-zinc-600">{content.split("\n").length} lines</span>
                        <span className="text-[8px] text-zinc-600">{content.length} chars</span>
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div className="flex flex-col bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 p-2 border-b border-zinc-800/50 bg-zinc-950/50">
                        <Eye size={13} className="text-primary" />
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Live Preview</span>
                        <div className="flex-1" />
                        <span className="text-[8px] text-emerald-500 font-bold">Auto-updating</span>
                    </div>
                    <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                        {content.trim() ? renderPreview(content) : (
                            <p className="text-[10px] text-zinc-600 italic">Start typing to see live preview...</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Notify All Popup */}
            <AnimatePresence>
                {showNotifyPopup && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowNotifyPopup(false)} />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative z-10 shadow-2xl space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto"><Bell size={20} className="text-emerald-400" /></div>
                            <div className="text-center">
                                <h2 className="text-sm font-bold text-white">SOP Updated & Published!</h2>
                                <p className="text-xs text-zinc-400 mt-1">The full SOP document has been saved successfully.</p>
                            </div>
                            <p className="text-[10px] text-zinc-500 text-center">All employees have been notified of the SOP changes. The updated document is now visible across all portals.</p>
                            <button onClick={() => setShowNotifyPopup(false)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold py-2.5 rounded-xl transition-colors">Done</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
