"use client";

import { useState } from "react";
import { ClipboardList, X, Upload, Loader2, Link2, AlertTriangle } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";

/**
 * Add (or update) the assignment of a class — any time after the class day has started,
 * also after the class record was submitted. Saved through the class-record workflow ("add_assignment").
 */
export default function AddAssignmentDialog({ lecture, facultyId, onClose, onSaved }: {
    lecture: any; // a lecture row from /api/faculty/lectures
    facultyId: string;
    onClose: () => void;
    onSaved: (message: string) => void;
}) {
    const prev = lecture?.report?.assignment || {};
    const [title, setTitle] = useState<string>(prev.title || "");
    const [url, setUrl] = useState<string>(prev.assignmentUrl || "");
    const [description, setDescription] = useState<string>(prev.description || "");
    const [deadline, setDeadline] = useState<string>(prev.deadline || "");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");

    const save = async () => {
        setError(""); setBusy(true);
        try {
            let assignmentUrl = url.trim();
            if (file) {
                const up = await uploadToCloudinary(file, p => setProgress(p));
                assignmentUrl = up.secure_url;
            }
            if (!/^https?:\/\//i.test(assignmentUrl)) throw new Error("Upload a file or paste the assignment link (https://…).");
            const body: any = { action: "add_assignment", title: title.trim(), assignmentUrl, description: description.trim(), deadline };
            if (lecture.report?._id) body.reportId = lecture.report._id;
            else body.classRef = { facultyId, date: lecture.date, lectureNumber: lecture.lectureNumber, sprintEntryId: lecture.sprintEntryId };
            const res = await fetch("/api/academic/class-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Could not save the assignment");
            onSaved(d.message || "Assignment saved.");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const input = "w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-purple-500/50 [color-scheme:dark]";
    return (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} data-testid="assignment-dialog">
                <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center"><ClipboardList size={18} className="text-purple-300" /></div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black text-white">{prev.hasAssignment ? "Update Assignment" : "Add Assignment"}</h2>
                            <p className="text-[11px] text-zinc-400 truncate">{lecture.courseName} · {lecture.date} · {lecture.timeStart}–{lecture.timeStop}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Title</p>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`Assignment — ${lecture.courseName || ""}`} className={input} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Assignment link</p>
                        <div className="relative">
                            <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://forms.google.com/…" className={`${input} pl-8`} data-testid="assignment-link" disabled={!!file} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest"><span className="h-px flex-1 bg-zinc-800" />or<span className="h-px flex-1 bg-zinc-800" /></div>
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-purple-500/40 cursor-pointer">
                        <Upload size={14} className="text-purple-300 shrink-0" />
                        <span className="text-xs text-zinc-300 truncate">{file ? file.name : "Upload assignment file (PDF / DOC / image)"}</span>
                        {file && <button type="button" onClick={e => { e.preventDefault(); setFile(null); }} className="ml-auto text-zinc-500 hover:text-white"><X size={14} /></button>}
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Deadline (optional)</p>
                            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={input} />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Description (optional)</p>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What students have to do…" className={`${input} resize-none`} />
                    </div>
                    {busy && file && <p className="text-[11px] text-zinc-400">Uploading… {Math.round(progress)}%</p>}
                    {error && <p className="text-xs text-red-400 flex items-center gap-1.5" data-testid="assignment-error"><AlertTriangle size={12} /> {error}</p>}
                </div>
                <div className="px-5 pb-5 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-black">Cancel</button>
                    <button onClick={save} disabled={busy || (!url.trim() && !file)} data-testid="assignment-save"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black disabled:opacity-40">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />} Save Assignment
                    </button>
                </div>
            </div>
        </div>
    );
}
