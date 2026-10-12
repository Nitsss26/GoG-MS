"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    Video, FileText, CheckCircle2, AlertTriangle, Clock, ExternalLink, Check, RefreshCw, Search, Filter,
    Building2, Users, BookOpen, ChevronDown, ChevronUp, ShieldCheck, RotateCcw, Hourglass, Layers, Eye, ClipboardList,
} from "lucide-react";
import { ClassRecordDetails, ClassRecordActions, ClassStatusBadge, to12h } from "@/components/academic/ClassRecordDetails";
import { VERIFICATION_ROLES, CL_CH_ROLES, CLASS_STATUS_LABEL, finalVerificationText } from "@/lib/academic-status";

/**
 * Campus Lecture Quality & Verification Hub.
 * Every class of every professor in the viewer's scope (Founder / AD: all colleges), from the sprint plan through
 * Professor → OM → final verification. Data: /api/academic/class-records (scoped on the server).
 * CL / CH also review notes and assignments here (/api/curriculum/lectures); Founder / AD see everything read-only.
 */
const todayIST = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => { const d = todayIST(); d.setDate(d.getDate() - n); return ymd(d); };
const endOfWeek = () => { const d = todayIST(); d.setDate(d.getDate() + (d.getDay() === 0 ? 0 : 6 - d.getDay())); return ymd(d); };
const dmy = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("-") : s || "");
const wd = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }) : "");

/** Stage groups shown as tiles; each one is also a filter */
const STAGES: { key: string; label: string; statuses: string[]; icon: any; tone: string }[] = [
    { key: "ALL", label: "All Classes", statuses: [], icon: Layers, tone: "text-white border-zinc-700" },
    { key: "PROF", label: "Awaiting Professor", statuses: ["PENDING_PROFESSOR"], icon: Hourglass, tone: "text-zinc-300 border-zinc-600" },
    { key: "OM", label: "Pending OM", statuses: ["SUBMITTED", "PENDING_OM"], icon: Clock, tone: "text-sky-300 border-sky-500/40" },
    { key: "FINAL", label: "Pending Final", statuses: ["PENDING_CL_CH", "PENDING_HOI", "OM_VERIFIED", "CL_CH_VERIFIED"], icon: ShieldCheck, tone: "text-indigo-300 border-indigo-500/40" },
    { key: "DONE", label: "Good to Go", statuses: ["COMPLETED"], icon: CheckCircle2, tone: "text-emerald-300 border-emerald-500/40" },
    { key: "REV", label: "Reverted", statuses: ["OM_REVERTED", "CL_CH_REVERTED"], icon: RotateCcw, tone: "text-red-300 border-red-500/40" },
];
const stageOf = (st: string) => STAGES.find(s => s.key !== "ALL" && s.statuses.includes(st))?.key || "PROF";

const notesState = (r: any): { label: string; tone: string } => {
    const v = String(r.lectureNotes?.verificationStatus || "").toLowerCase();
    const has = !!(r.lectureNotes?.notesUrl || r.lectureNotes?.notesContent);
    if (r.virtual || r.pipelineStatus === "PENDING_PROFESSOR") return { label: "Not submitted", tone: "text-zinc-500 border-zinc-700 bg-zinc-800/40" };
    if (!has || r.notesMissing) return { label: "Missing", tone: "text-red-300 border-red-500/30 bg-red-500/10" };
    if (v === "approved" || v === "verified") return { label: "Approved", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
    if (v === "needs revision" || v === "flagged" || v === "rejected") return { label: "Needs revision", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
    return { label: "Uploaded · review pending", tone: "text-sky-300 border-sky-500/30 bg-sky-500/10" };
};
const asgState = (r: any): { label: string; tone: string } | null => {
    if (!r.assignment?.hasAssignment) return null;
    const v = String(r.assignment?.verificationStatus || "").toLowerCase();
    if (v === "approved" || v === "verified") return { label: "Approved", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
    if (v === "needs revision" || v === "flagged" || v === "rejected") return { label: "Needs revision", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
    return { label: "Review pending", tone: "text-pink-300 border-pink-500/30 bg-pink-500/10" };
};

function Chip({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap ${tone}`}>
            <Icon size={11} /> <span className="text-zinc-400 font-semibold">{label}:</span> {value}
        </span>
    );
}

/** CL / CH: approve or send back the notes and the assignment of one class */
function QualityReview({ record, onDone }: { record: any; onDone: (msg: string) => void }) {
    const hasAsg = !!record.assignment?.hasAssignment;
    const [notes, setNotes] = useState<"VERIFIED" | "NEEDS_REVISION">(notesState(record).label === "Needs revision" ? "NEEDS_REVISION" : "VERIFIED");
    const [notesRemarks, setNotesRemarks] = useState(record.lectureNotes?.leadRemarks || "");
    const [asg, setAsg] = useState<"VERIFIED" | "NEEDS_REVISION">(asgState(record)?.label === "Needs revision" ? "NEEDS_REVISION" : "VERIFIED");
    const [asgRemarks, setAsgRemarks] = useState(record.assignment?.leadRemarks || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const post = async (body: any) => {
        const res = await fetch("/api/curriculum/lectures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: record._id, ...body }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not save the review.");
        return data;
    };
    const save = async () => {
        if (notes === "NEEDS_REVISION" && notesRemarks.trim().length < 5) return setError("Write what must change in the notes (at least 5 characters).");
        if (hasAsg && asg === "NEEDS_REVISION" && asgRemarks.trim().length < 5) return setError("Write what must change in the assignment (at least 5 characters).");
        setBusy(true); setError("");
        try {
            let msg = "";
            if (hasAsg) msg = (await post({ action: "verify_assignment", assignmentStatus: asg, assignmentRemarks: asgRemarks })).message;
            msg = (await post({ action: "verify_notes", notesStatus: notes, notesRemarks })).message || msg;
            onDone(msg || "Quality review saved.");
        } catch (e: any) { setError(e.message); }
        finally { setBusy(false); }
    };

    const Toggle = ({ value, set }: { value: string; set: (v: any) => void }) => (
        <div className="flex gap-1.5">
            {(["VERIFIED", "NEEDS_REVISION"] as const).map(v => (
                <button key={v} type="button" onClick={() => set(v)} className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${value === v
                    ? v === "VERIFIED" ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
                    {v === "VERIFIED" ? "Approve" : "Needs Revision"}
                </button>
            ))}
        </div>
    );

    return (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-3" data-testid="quality-review">
            <p className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList size={15} className="text-emerald-400" /> Quality Review (CL / CH)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5"><FileText size={13} className="text-teal-400" /> Lecture Notes</span>
                        <Toggle value={notes} set={setNotes} />
                    </div>
                    <textarea value={notesRemarks} onChange={e => setNotesRemarks(e.target.value)} rows={2} placeholder="Remarks on the notes (required for Needs Revision)"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none resize-none focus:border-emerald-500/40" data-testid="qr-notes-remarks" />
                </div>
                {hasAsg ? (
                    <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5"><BookOpen size={13} className="text-pink-400" /> Assignment</span>
                            <Toggle value={asg} set={setAsg} />
                        </div>
                        <textarea value={asgRemarks} onChange={e => setAsgRemarks(e.target.value)} rows={2} placeholder="Remarks on the assignment (required for Needs Revision)"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none resize-none focus:border-emerald-500/40" />
                    </div>
                ) : <p className="text-[11px] text-zinc-500 self-center">No assignment was given in this class.</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-zinc-500">When the notes (and the assignment, if any) are approved and OM has verified the class, the class becomes Good to Go automatically.</p>
                <button onClick={save} disabled={busy} data-testid="qr-save" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-50">
                    {busy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Save Review
                </button>
            </div>
            {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</p>}
        </div>
    );
}

export default function CurriculumLecturesPage() {
    const { user } = useAuth();
    const role = user?.role || "";
    const isClCh = CL_CH_ROLES.includes(role);

    const [from, setFrom] = useState(daysAgo(13));
    const [to, setTo] = useState(endOfWeek());
    const [college, setCollege] = useState("All");
    const [facultyId, setFacultyId] = useState("All");
    const [stage, setStage] = useState("ALL");
    const [onlyAssignment, setOnlyAssignment] = useState(false);
    const [search, setSearch] = useState("");
    const [records, setRecords] = useState<any[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [colleges, setColleges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [open, setOpen] = useState<string | null>(null);

    const latest = useRef(0);
    const load = async () => {
        const n = ++latest.current;
        setLoading(true); setError("");
        try {
            const q = new URLSearchParams({ from, to, college, facultyId, planned: "1" });
            const res = await fetch(`/api/academic/class-records?${q}`);
            const data = await res.json();
            if (n !== latest.current) return;
            if (!res.ok) throw new Error(data.error || "Could not load lectures");
            setRecords(data.records || []);
            setProfessors(data.professors || []);
            setColleges(data.colleges || []);
        } catch (e: any) { if (n === latest.current) setError(e.message); }
        finally { if (n === latest.current) setLoading(false); }
    };
    useEffect(() => { if (user && VERIFICATION_ROLES.includes(role)) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, from, to, college, facultyId]);

    const collegeName = (v?: string) => {
        if (!v) return "Campus not assigned";
        const c = colleges.find((c: any) => c.id === v || (c.keys || []).includes(v));
        return c?.name || v;
    };

    const counts = useMemo(() => {
        const m: Record<string, number> = { ALL: records.length };
        records.forEach(r => { const k = stageOf(r.pipelineStatus); m[k] = (m[k] || 0) + 1; });
        return m;
    }, [records]);

    const quality = useMemo(() => {
        const delivered = records.filter(r => !r.virtual && r.pipelineStatus !== "PENDING_PROFESSOR");
        const notes = delivered.filter(r => r.lectureNotes?.notesUrl || r.lectureNotes?.notesContent).length;
        const notesOk = delivered.filter(r => notesState(r).label === "Approved").length;
        const rec = delivered.filter(r => r.recordingUrl).length;
        const asg = delivered.filter(r => r.assignment?.hasAssignment).length;
        const late = delivered.filter(r => r.isLate).length;
        const att = delivered.filter(r => r.totalStudents > 0);
        const avg = att.length ? Math.round(att.reduce((a, r) => a + Math.min(1, (r.numberOfAttendees || 0) / r.totalStudents), 0) / att.length * 100) : null;
        const overdue = records.filter(r => r.classEnded && r.pipelineStatus === "PENDING_PROFESSOR").length;
        return { delivered: delivered.length, notes, notesOk, rec, asg, late, avg, overdue };
    }, [records]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return records
            .filter(r => stage === "ALL" || stageOf(r.pipelineStatus) === stage)
            .filter(r => !onlyAssignment || r.assignment?.hasAssignment)
            .filter(r => !q || `${r.facultyName} ${r.courseName || r.subjectName || ""} ${r.subjectCode || ""} ${r.topicsCovered || ""}`.toLowerCase().includes(q))
            .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.timeStart || "").localeCompare(b.timeStart || ""));
    }, [records, stage, onlyAssignment, search]);

    const afterAction = async (msg: string) => {
        setMessage(msg);
        await load();
        setTimeout(() => setMessage(""), 5000);
    };

    if (!user) return null;
    if (!VERIFICATION_ROLES.includes(role)) {
        return <div className="flex items-center justify-center h-[70vh] text-zinc-400 text-sm">The Lecture Quality Hub is available for Founder, AD, HOI, CL, CH and OM.</div>;
    }

    const sel = "px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-500/40 [color-scheme:dark]";

    return (
        <div className="max-w-7xl mx-auto pt-6 pb-14 px-4 sm:px-6 space-y-5 w-full [contain:inline-size]">
            {/* Header */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><Video size={22} className="text-emerald-400" /></div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight" data-testid="lqh-title">Campus Lecture Quality &amp; Verification Hub</h1>
                        <p className="text-xs text-zinc-400 mt-0.5">Inspect Recordings &bull; Validate Notes &amp; Assignments &bull; Track every class from Professor → OM → Good to Go</p>
                    </div>
                </div>
                <button onClick={load} className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold" title="Refresh">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
                <Filter size={14} className="text-zinc-500 mb-2.5 hidden sm:block" />
                <label className="block"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">From</span>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={sel} data-testid="lqh-from" /></label>
                <label className="block"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">To</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className={sel} data-testid="lqh-to" /></label>
                {colleges.length > 1 && (
                    <label className="block"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Campus</span>
                        <span className="relative block">
                            <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                            <select value={college} onChange={e => { setCollege(e.target.value); setFacultyId("All"); }} className={`${sel} pl-8`} data-testid="lqh-campus">
                                <option value="All">All Campuses</option>
                                {colleges.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </span>
                    </label>
                )}
                <label className="block"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Professor</span>
                    <select value={facultyId} onChange={e => setFacultyId(e.target.value)} className={`${sel} max-w-[14rem]`} data-testid="lqh-prof">
                        <option value="All">All Professors ({professors.length})</option>
                        {professors.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
                    </select>
                </label>
                <label className="block flex-1 min-w-[12rem]"><span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Search</span>
                    <span className="relative block">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Professor, subject or topic…" className={`${sel} w-full pl-8 font-medium`} />
                    </span>
                </label>
                <label className="flex items-center gap-2 h-[34px] px-3 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 font-bold cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={onlyAssignment} onChange={e => setOnlyAssignment(e.target.checked)} className="w-3.5 h-3.5 accent-pink-500" /> Has Assignment
                </label>
            </div>

            {/* Stage tiles (also filters) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="lqh-stages">
                {STAGES.map(s => {
                    const on = stage === s.key;
                    return (
                        <button key={s.key} onClick={() => setStage(s.key)} data-testid={`stage-${s.key}`}
                            className={`text-left p-3.5 rounded-2xl border transition-all ${on ? `bg-zinc-800/80 ${s.tone} shadow-lg` : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"}`}>
                            <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${on ? "" : "text-zinc-500"}`}><s.icon size={12} /> {s.label}</span>
                            <span className="block mt-1.5 text-2xl font-black text-white tabular-nums">{loading ? "–" : counts[s.key] || 0}</span>
                        </button>
                    );
                })}
            </div>

            {/* Quality summary */}
            {!loading && records.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[11px]" data-testid="lqh-quality">
                    <Chip icon={Users} label="Delivered" value={`${quality.delivered}`} tone="border-zinc-800 bg-zinc-900/60 text-white" />
                    <Chip icon={FileText} label="Notes uploaded" value={`${quality.notes}/${quality.delivered}`} tone="border-teal-500/20 bg-teal-500/5 text-teal-300" />
                    <Chip icon={CheckCircle2} label="Notes approved" value={`${quality.notesOk}`} tone="border-emerald-500/20 bg-emerald-500/5 text-emerald-300" />
                    <Chip icon={Video} label="Recordings" value={`${quality.rec}/${quality.delivered}`} tone="border-sky-500/20 bg-sky-500/5 text-sky-300" />
                    <Chip icon={BookOpen} label="Assignments" value={`${quality.asg}`} tone="border-pink-500/20 bg-pink-500/5 text-pink-300" />
                    {quality.avg !== null && <Chip icon={Users} label="Avg attendance" value={`${quality.avg}%`} tone="border-violet-500/20 bg-violet-500/5 text-violet-300" />}
                    {quality.late > 0 && <Chip icon={Clock} label="Late classes" value={`${quality.late}`} tone="border-amber-500/20 bg-amber-500/5 text-amber-300" />}
                    {quality.overdue > 0 && <Chip icon={AlertTriangle} label="Report overdue" value={`${quality.overdue}`} tone="border-red-500/20 bg-red-500/5 text-red-300" />}
                </div>
            )}

            {message && <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" data-testid="lqh-message"><Check size={15} /> {message}</div>}
            {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400"><AlertTriangle size={15} /> {error}</div>}

            {/* Lectures */}
            {loading ? (
                <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
            ) : visible.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-500" data-testid="lqh-empty">
                    <Video size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No classes found for the selected filters.</p>
                    <p className="text-xs mt-1">Classes appear here once a professor&apos;s sprint plan is submitted for these dates.</p>
                </div>
            ) : (
                <div className="space-y-3" data-testid="lqh-list">
                    {visible.map(r => {
                        const isOpen = open === r._id;
                        const st = r.pipelineStatus || "PENDING_PROFESSOR";
                        const done = st === "COMPLETED";
                        const reverted = st === "OM_REVERTED" || st === "CL_CH_REVERTED";
                        const ns = notesState(r);
                        const as = asgState(r);
                        const delivered = !r.virtual && st !== "PENDING_PROFESSOR";
                        const finalText = finalVerificationText(r);
                        return (
                            <div key={r._id} data-testid="lqh-card"
                                className={`rounded-2xl border transition-all ${done ? "bg-emerald-950/20 border-emerald-500/30" : reverted ? "bg-rose-950/20 border-rose-500/30" : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"}`}>
                                <button onClick={() => setOpen(isOpen ? null : r._id)} className="w-full text-left p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm sm:text-base font-black text-white">{r.facultyName}</span>
                                            <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{collegeName(r.college)}</span>
                                            <span className="text-xs text-zinc-400">{wd(r.date)} {dmy(r.date)}{r.timeStart ? ` · ${to12h(r.timeStart)}${r.timeStop ? ` – ${to12h(r.timeStop)}` : ""}` : ""}</span>
                                            <ClassStatusBadge status={st} />
                                            {done && <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">✓ Good to Go</span>}
                                        </div>
                                        <p className="text-sm font-semibold text-zinc-200 truncate">
                                            {r.courseName || r.subjectName || "—"}{r.subjectCode ? <span className="text-zinc-500 font-normal"> ({r.subjectCode})</span> : null}
                                            {r.topicsCovered ? <span className="text-zinc-400 font-normal"> &bull; {r.topicsCovered}</span> : null}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            <Chip icon={FileText} label="Notes" value={ns.label} tone={ns.tone} />
                                            {as && <Chip icon={BookOpen} label="Assignment" value={as.label} tone={as.tone} />}
                                            {delivered && <Chip icon={Video} label="Recording" value={r.recordingUrl ? "Yes" : "No"} tone={r.recordingUrl ? "text-sky-300 border-sky-500/30 bg-sky-500/10" : "text-zinc-500 border-zinc-700 bg-zinc-800/40"} />}
                                            {delivered && <Chip icon={Users} label="Students" value={`${r.numberOfAttendees ?? 0}${r.totalStudents ? `/${r.totalStudents}` : ""}`} tone="text-zinc-200 border-zinc-700 bg-zinc-800/40" />}
                                            {(r.actualInTime || r.actualOutTime) && <Chip icon={Clock} label="Entry/Exit" value={`${to12h(r.actualInTime) || "—"} – ${to12h(r.actualOutTime) || "—"}`} tone="text-zinc-200 border-zinc-700 bg-zinc-800/40" />}
                                            {r.isLate && <Chip icon={AlertTriangle} label="Late" value={r.remarksWhyLate || "Yes"} tone="text-amber-300 border-amber-500/30 bg-amber-500/10" />}
                                            {r.classEnded && st === "PENDING_PROFESSOR" && <Chip icon={AlertTriangle} label="Report" value="Overdue" tone="text-red-300 border-red-500/30 bg-red-500/10" />}
                                        </div>
                                        {finalText && <p className="text-[11px] text-emerald-400/90">{finalText}</p>}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                                        {r.recordingUrl && (
                                            <a href={r.recordingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-bold hover:bg-sky-500/20"><Video size={13} /> Recording <ExternalLink size={11} /></a>
                                        )}
                                        {r.lectureNotes?.notesUrl && (
                                            <a href={r.lectureNotes.notesUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px] font-bold hover:bg-teal-500/20"><FileText size={13} /> Notes <ExternalLink size={11} /></a>
                                        )}
                                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] font-bold" data-testid="lqh-toggle">
                                            <Eye size={13} /> {isOpen ? "Hide" : "Details"} {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </span>
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-zinc-800/80 pt-4" data-testid="lqh-details">
                                        {isClCh && !r.virtual && delivered && !done && <QualityReview record={r} onDone={afterAction} />}
                                        {r.virtual ? (
                                            <p className="text-xs text-zinc-400 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                                                Planned in the sprint plan · {CLASS_STATUS_LABEL[st]}. {r.classEnded ? "The class time is over and the professor has not submitted the class record yet." : "The class has not happened yet."}
                                            </p>
                                        ) : <ClassRecordDetails record={{ ...r, college: collegeName(r.college) }} />}
                                        <ClassRecordActions record={r} role={role} userId={user.id} onDone={afterAction} />
                                        {!isClCh && !["OM", "HOI"].includes(role) && (
                                            <p className="text-[10px] text-zinc-500">View only — verification is done by OM, CL, CH or HOI.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}