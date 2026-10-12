"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, RefreshCw, ChevronDown, ChevronUp, Flag, AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { ClassRecordDetails, ClassRecordActions, ClassStatusBadge } from "@/components/academic/ClassRecordDetails";
import { VERIFICATION_ROLES, CLASS_STATUS_LABEL, FINAL_VERIFIER_ROLES, FINAL_PENDING_CLASS_STATUSES } from "@/lib/academic-status";

/**
 * Class Verification — Professor → OM → final verification by any ONE of CL / CH / HOI.
 * Every list comes from /api/academic/class-records, which applies the college scope on the server.
 */
const todayIST = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => { const d = todayIST(); d.setDate(d.getDate() - n); return ymd(d); };

export default function ClassVerificationPage() {
    const { user } = useAuth();
    const role = user?.role || "";
    // CL, CH and HOI share one queue: any ONE of them can do the final verification
    const queue = role === "OM" ? { keys: ["PENDING_OM"], label: "OM Verification" }
        : FINAL_VERIFIER_ROLES.includes(role) ? { keys: FINAL_PENDING_CLASS_STATUSES, label: "Final Verification" } : null;

    const [tab, setTab] = useState<"QUEUE" | "ALL">(queue ? "QUEUE" : "ALL");
    const [from, setFrom] = useState(daysAgo(13));
    // up to the end of next week, so classes of submitted plans for the coming week are listed too
    const [to, setTo] = useState(() => { const d = todayIST(); const dow = d.getDay(); d.setDate(d.getDate() + (dow === 0 ? 7 : 14 - dow)); return ymd(d); });
    const [college, setCollege] = useState("All");
    const [facultyId, setFacultyId] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [records, setRecords] = useState<any[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [colleges, setColleges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [open, setOpen] = useState<string | null>(null);
    const [deepRecord, setDeepRecord] = useState<any | null>(null);

    const latestRequest = useRef(0);
    const load = async () => {
        const requestNo = ++latestRequest.current;
        setLoading(true); setError("");
        try {
            // The queue looks back 90 days so nothing waiting is missed; "All Classes" uses the chosen dates
            const q = new URLSearchParams({
                from: tab === "QUEUE" ? daysAgo(90) : from, to: tab === "QUEUE" ? ymd(todayIST()) : to,
                college, facultyId, planned: tab === "ALL" ? "1" : "0",
            });
            const res = await fetch(`/api/academic/class-records?${q}`);
            const data = await res.json();
            if (requestNo !== latestRequest.current) return;
            if (!res.ok) throw new Error(data.error || "Could not load class records");
            setRecords(data.records || []);
            setProfessors(data.professors || []);
            setColleges(data.colleges || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            if (requestNo === latestRequest.current) setLoading(false);
        }
    };

    useEffect(() => { if (user) load(); }, [user, tab, from, to, college, facultyId]);

    // Deep link from a notification: ?record=<id>
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("record");
        if (!id || !user) return;
        fetch(`/api/academic/class-records?record=${id}`).then(r => r.json()).then(d => {
            if (d.records?.[0]) { setDeepRecord(d.records[0]); setOpen(d.records[0]._id); }
            else if (d.error) setError(d.error);
        }).catch(() => { });
    }, [user]);

    const visible = useMemo(() => {
        let list = records;
        if (tab === "QUEUE" && queue) list = list.filter(r => queue.keys.includes(r.pipelineStatus));
        if (tab === "ALL" && statusFilter !== "All") {
            list = statusFilter === "DELAYED"
                ? list.filter(r => r.classEnded && (r.pipelineStatus === "PENDING_PROFESSOR" || r.notesMissing))
                : list.filter(r => r.pipelineStatus === statusFilter);
        }
        if (deepRecord && !list.some(r => r._id === deepRecord._id)) list = [deepRecord, ...list];
        return list;
    }, [records, tab, statusFilter, queue, deepRecord]);

    const refreshAfterAction = async (msg: string) => {
        setMessage(msg);
        setDeepRecord(null);
        await load();
        setTimeout(() => setMessage(""), 4000);
    };

    if (!user) return null;
    if (!VERIFICATION_ROLES.includes(role)) {
        return <div className="flex items-center justify-center h-[80vh] text-zinc-400">Class verification is available for OM, CL, CH, HOI and AD.</div>;
    }

    const queueCount = queue ? records.filter(r => queue.keys.includes(r.pipelineStatus)).length : 0;

    return (
        <div className="max-w-6xl mx-auto pt-8 pb-16 px-4 sm:px-6 space-y-6 w-full [contain:inline-size]">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><ShieldCheck size={22} className="text-emerald-400" /></div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Class Verification</h1>
                        <p className="text-xs text-zinc-400">Professor → OM → Final (CL / CH / HOI) · {colleges.length === 1 ? colleges[0].name : "your colleges"}</p>
                    </div>
                </div>
                <button onClick={load} className="self-start md:self-auto p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" title="Refresh">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {queue && (
                    <button onClick={() => setTab("QUEUE")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${tab === "QUEUE" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
                        {queue.label} {tab === "QUEUE" && !loading ? `(${queueCount})` : ""}
                    </button>
                )}
                <button onClick={() => setTab("ALL")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${tab === "ALL" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
                    All Classes
                </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
                <Filter size={14} className="text-zinc-500 mb-2" />
                {tab === "ALL" && (
                    <>
                        <div><p className="text-[9px] text-zinc-500 font-bold uppercase">From</p><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" /></div>
                        <div><p className="text-[9px] text-zinc-500 font-bold uppercase">To</p><input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" /></div>
                    </>
                )}
                {colleges.length > 1 && (
                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">College</p>
                        <select value={college} onChange={e => { setCollege(e.target.value); setFacultyId("All"); }} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white">
                            <option value="All">All</option>
                            {colleges.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select></div>
                )}
                <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Professor</p>
                    <select value={facultyId} onChange={e => setFacultyId(e.target.value)} data-testid="filter-professor" className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white">
                        <option value="All">All</option>
                        {professors.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select></div>
                {tab === "ALL" && (
                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Status</p>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white">
                            <option value="All">All</option>
                            <option value="DELAYED">Notes / record delayed</option>
                            {["PENDING_PROFESSOR", "PENDING_OM", "OM_REVERTED", "PENDING_CL_CH", "CL_CH_REVERTED", "PENDING_HOI", "COMPLETED"].map(s => <option key={s} value={s}>{CLASS_STATUS_LABEL[s]}</option>)}
                        </select></div>
                )}
            </div>

            {message && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold" data-testid="page-message"><CheckCircle2 size={14} /> {message}</div>}
            {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"><AlertTriangle size={14} /> {error}</div>}

            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : visible.length === 0 ? (
                <div className="text-center py-16 text-sm text-zinc-500 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
                    {tab === "QUEUE" ? "Nothing is waiting for you." : "No classes in this range."}
                </div>
            ) : (
                <div className="space-y-3" data-testid="record-list">
                    {visible.map(r => {
                        const isOpen = open === r._id;
                        const openFlags = (r.delayFlags || []).filter((f: any) => f.status === "OPEN").length;
                        return (
                            <div key={r._id} className={`min-w-0 rounded-2xl border ${isOpen ? "border-emerald-500/30 bg-zinc-900/70" : "border-zinc-800 bg-zinc-900/40"}`} data-testid="record-row">
                                <button onClick={() => setOpen(isOpen ? null : r._id)} className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{r.facultyName} · {r.courseName}</p>
                                        <p className="text-[11px] text-zinc-400 truncate">{r.date?.split("-").reverse().join("-")} · {r.timeStart}{r.timeStop ? `–${r.timeStop}` : ""} · {[r.className || r.stream, r.section ? `Sec ${r.section}` : ""].filter(Boolean).join(" / ")}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {r.notesMissing && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Notes missing</span>}
                                        {openFlags > 0 && <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1"><Flag size={10} /> {openFlags}</span>}
                                        {r.virtual && r.classEnded && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">No record yet</span>}
                                        <ClassStatusBadge status={r.pipelineStatus} />
                                        {isOpen ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="px-4 pb-5 space-y-5 border-t border-zinc-800 pt-4">
                                        {r.virtual
                                            ? <p className="text-xs text-zinc-400">The professor has not submitted the class record for this class yet{r.classEnded ? "" : " (the class has not ended)"}.</p>
                                            : <ClassRecordDetails record={r} />}
                                        <ClassRecordActions key={`${r._id}-${r.pipelineStatus}-${(r.pipelineHistory || []).length}`} record={r} role={role} userId={user.id} onDone={refreshAfterAction} />
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