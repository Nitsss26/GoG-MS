"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, RefreshCw, Flag, AlertTriangle, CheckCircle2, Filter, Eye } from "lucide-react";
import { ClassRecordDetails, ClassRecordActions } from "@/components/academic/ClassRecordDetails";
import LectureTable, { LectureDrawer, RowButton, toLectureRow } from "@/components/academic/LectureTable";
import { VERIFICATION_ROLES, CLASS_STATUS_LABEL, FINAL_VERIFIER_ROLES, FINAL_PENDING_CLASS_STATUSES } from "@/lib/academic-status";

/**
 * Class Verification — Professor → OM → final verification by any ONE of CL / CH / HOI.
 * Every list comes from /api/academic/class-records, which applies the college scope on the server.
 */
const todayIST = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => { const d = todayIST(); d.setDate(d.getDate() - n); return ymd(d); };

/** Submitted and waiting for OM or for the final verification (CL / CH / HOI) */
const PENDING_VERIFICATION = ["PENDING_OM", "PENDING_CL_CH", "PENDING_HOI"];
/** Records the OM has already verified (forwarded to CL / CH / HOI, or completed) */
const OM_DONE = ["OM_VERIFIED", "PENDING_CL_CH", "CL_CH_VERIFIED", "PENDING_HOI", "COMPLETED"];
/** Completed class whose assignment was added later and waits for the final verifier (CL / CH / HOI / AD) */
const assignmentPending = (r: any) => r.pipelineStatus === "COMPLETED" && r.assignment?.hasAssignment && r.assignment?.addedLater && r.assignment?.verificationStatus === "Pending";

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
    // All Classes: quick buttons — All / Pending Verification (with OM or CL / CH / HOI) / Verified (completed)
    const [quick, setQuick] = useState<"ALL" | "PENDING" | "VERIFIED">("ALL");
    // Quick buttons by role: OM → verified = OM has verified it, pending = waiting for OM;
    // CL / CH / HOI / AD → verified = final verification done, pending = waiting for any verification (as before)
    const isVerifiedForMe = (r: any) => role === "OM" ? OM_DONE.includes(r.pipelineStatus) : r.pipelineStatus === "COMPLETED";
    const isPendingForMe = (r: any) => role === "OM" ? r.pipelineStatus === "PENDING_OM" : PENDING_VERIFICATION.includes(r.pipelineStatus);
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

    // Deep link from "Professors Under My HOI": ?facultyId=<id> → all classes of that professor
    useEffect(() => {
        const f = new URLSearchParams(window.location.search).get("facultyId");
        if (f) { setFacultyId(f); setTab("ALL"); }
    }, []);

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
        if (tab === "QUEUE" && queue) list = list.filter(r => queue.keys.includes(r.pipelineStatus) || (FINAL_VERIFIER_ROLES.includes(role) && assignmentPending(r)));
        if (tab === "ALL" && quick !== "ALL") list = list.filter(r => (quick === "VERIFIED" ? isVerifiedForMe(r) : isPendingForMe(r)));
        if (tab === "ALL" && statusFilter !== "All") {
            list = statusFilter === "DELAYED"
                ? list.filter(r => r.classEnded && (r.pipelineStatus === "PENDING_PROFESSOR" || r.notesMissing))
                : list.filter(r => r.pipelineStatus === statusFilter);
        }
        if (deepRecord && !list.some(r => r._id === deepRecord._id)) list = [deepRecord, ...list];
        return list;
    }, [records, tab, statusFilter, quick, queue, deepRecord]);

    // Table rows (same records, nothing changed) + the record open in the drawer
    const rows = useMemo(() => visible.map(r => toLectureRow(r, "record")), [visible]);
    const openRow = open ? rows.find(r => r.key === open) || null : null;
    const inMyQueue = (r: any) => !!queue && (queue.keys.includes(r.pipelineStatus) || (FINAL_VERIFIER_ROLES.includes(role) && assignmentPending(r)));

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

    const queueCount = queue ? records.filter(r => queue.keys.includes(r.pipelineStatus) || (FINAL_VERIFIER_ROLES.includes(role) && assignmentPending(r))).length : 0;
    const quickCounts = {
        ALL: records.length,
        PENDING: records.filter(isPendingForMe).length,
        VERIFIED: records.filter(isVerifiedForMe).length,
    };

    return (
        <div className="max-w-[1600px] mx-auto pt-6 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]">
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
                {/* All / Pending Verification / Verified — next to the tabs */}

                <div className="flex flex-wrap gap-1 p-1 w-fit max-w-full rounded-xl border border-zinc-800 bg-zinc-900/60" role="tablist" data-testid="quick-filter">
                    {([["ALL", "All", "text-zinc-200", "bg-zinc-700/70"], ["PENDING", "Pending Verification", "text-amber-300", "bg-amber-500/15 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)]"], ["VERIFIED", "Verified", "text-emerald-300", "bg-emerald-500/15 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]"]] as const).map(([k, label, txt, on]) => (
                        <button key={k} role="tab" aria-selected={tab === "ALL" && quick === k} onClick={() => { setQuick(k); setTab("ALL"); }} data-testid={`quick-${k}`}
                            className={`h-9 px-3.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${tab === "ALL" && quick === k ? `${on} ${txt}` : "text-zinc-400 hover:text-white"}`}>
                            {label}
                            {!loading && tab === "ALL" && <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${quick === k ? "bg-black/30" : "bg-zinc-800"}`}>{quickCounts[k]}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {message && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold" data-testid="page-message"><CheckCircle2 size={14} /> {message}</div>}
            {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"><AlertTriangle size={14} /> {error}</div>}

            <LectureTable viewKey="verification"
                /* Date / College / Professor / Status — left of the search */
                toolbarStart={<>
                <Filter size={14} className="text-zinc-500 mb-2 shrink-0" />
                {tab === "ALL" && (
                    <>
                        <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">From</p><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white max-w-[140px] [color-scheme:dark]" /></div>
                        <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">To</p><input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white max-w-[140px] [color-scheme:dark]" /></div>
                    </>
                )}
                {colleges.length > 1 && (
                    <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">College</p>
                        <select value={college} onChange={e => { setCollege(e.target.value); setFacultyId("All"); }} className="h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white max-w-[140px] [color-scheme:dark]">
                            <option value="All">All</option>
                            {colleges.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select></div>
                )}
                <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Professor</p>
                    <select value={facultyId} onChange={e => setFacultyId(e.target.value)} data-testid="filter-professor" className="h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white max-w-[140px] [color-scheme:dark]">
                        <option value="All">All</option>
                        {professors.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select></div>
                {tab === "ALL" && (
                    <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Status</p>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white max-w-[140px] [color-scheme:dark]">
                            <option value="All">All</option>
                            <option value="DELAYED">Notes / record delayed</option>
                            {["PENDING_PROFESSOR", "PENDING_OM", "OM_REVERTED", "PENDING_CL_CH", "CL_CH_REVERTED", "PENDING_HOI", "COMPLETED"].map(s => <option key={s} value={s}>{CLASS_STATUS_LABEL[s]}</option>)}
                        </select></div>
                )}
                </>}
                rows={rows}
                loading={loading}
                showProfessor
                showQuick={false}
                variant="report"
                showPlanDetails
                activeKey={open}
                resetKey={`${tab}|${quick}|${statusFilter}|${from}|${to}|${college}|${facultyId}`}
                onOpen={(r) => setOpen(r.key)}
                emptyText={tab === "QUEUE" ? "Nothing is waiting for you." : quick === "PENDING" ? "No classes pending verification in this range." : quick === "VERIFIED" ? "No verified classes in this range." : "No classes in this range."}
                renderActions={(row) => {
                    const r = row.raw;
                    const openFlags = (r.delayFlags || []).filter((x: any) => x.status === "OPEN").length;
                    const mine = inMyQueue(r);
                    return (
                        <>
                            {openFlags > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400" title={`${openFlags} open delay flag(s)`}><Flag size={10} /> {openFlags}</span>}
                            {FINAL_VERIFIER_ROLES.includes(role) && assignmentPending(r) && <span className="text-[10px] font-bold text-amber-400" title="Assignment added later — waiting for CL / CH / HOI / AD" data-testid="assignment-pending-badge">Asg.</span>}
                            <RowButton tone={mine ? "primary" : "default"} icon={mine ? ShieldCheck : Eye} onClick={() => setOpen(row.key)} testId={mine ? "row-verify" : "row-view"}>{mine ? "Verify" : "View"}</RowButton>
                        </>
                    );
                }}
            />

            {/* Details drawer — the same record details and verification actions as before */}
            <LectureDrawer row={openRow} onClose={() => setOpen(null)}>
                {openRow && (() => {
                    const r = openRow.raw;
                    return (
                        <div className="space-y-5">
                            <div className="flex flex-wrap gap-1.5">
                                {r.notesMissing && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Notes missing</span>}
                                {FINAL_VERIFIER_ROLES.includes(role) && assignmentPending(r) && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Assignment to verify</span>}
                                {r.virtual && r.classEnded && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">No record yet</span>}
                            </div>
                            {r.virtual
                                ? <p className="text-xs text-zinc-400">The professor has not submitted the class record for this class yet{r.classEnded ? "" : " (the class has not ended)"}.</p>
                                : <ClassRecordDetails record={r} plain hideOverview />}
                            <ClassRecordActions key={`${r._id}-${r.pipelineStatus}-${(r.pipelineHistory || []).length}`} record={r} role={role} userId={user.id} onDone={refreshAfterAction} />
                        </div>
                    );
                })()}
            </LectureDrawer>
        </div>
    );
}