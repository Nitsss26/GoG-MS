"use client";

import { useState } from "react";
import {
    CheckCircle2, RotateCcw, Users, FileText, Link2, Image as ImageIcon, ClipboardList, Clock, Flag,
    History, ShieldCheck, Send, AlertTriangle, RefreshCw, ExternalLink,
} from "lucide-react";
import { CLASS_STATUS_LABEL, CLASS_STATUS_STYLE, roleShort, PROFESSOR_ROLES, CL_CH_ROLES, FINAL_PENDING_CLASS_STATUSES, finalVerificationText } from "@/lib/academic-status";

const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const dmy = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("-") : s || "");

export function ClassStatusBadge({ status }: { status?: string }) {
    const st = status || "PENDING_PROFESSOR";
    return (
        <span data-testid="class-status" className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${CLASS_STATUS_STYLE[st] || ""}`}>
            {CLASS_STATUS_LABEL[st] || st}
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
            <div className="text-xs text-zinc-200 mt-0.5 [overflow-wrap:anywhere]">{children || <span className="text-zinc-600">—</span>}</div>
        </div>
    );
}

function Stage({ title, v }: { title: string; v?: any }) {
    const s = v?.status || "PENDING";
    const color = s === "VERIFIED" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : s === "REVERTED" ? "text-red-400 border-red-500/20 bg-red-500/5" : "text-zinc-400 border-zinc-700 bg-zinc-800/30";
    return (
        <div className={`p-3 rounded-xl border ${color}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">{title}: {s === "VERIFIED" ? "Verified" : s === "REVERTED" ? "Reverted" : "Pending"}</p>
            {v?.byName && <p className="text-[11px] text-zinc-400 mt-0.5">{v.byName} ({roleShort(v.role)}) · {fmt(v.at)}</p>}
            {v?.comment && <p className="text-[11px] text-zinc-300 mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{v.comment}</p>}
            {v?.revertTo && s === "REVERTED" && <p className="text-[10px] text-zinc-500 mt-0.5">Sent back to: {v.revertTo === "OM" ? "OM" : "Professor"}</p>}
        </div>
    );
}

/** The single final-verification step (any ONE of CL / CH / HOI); falls back to the older CL/CH and HOI fields */
function finalStage(record: any) {
    const f = record.finalVerification;
    if (f?.status && f.status !== "PENDING") return f;
    if (record.hoiVerification?.status === "VERIFIED") return record.hoiVerification;
    if (record.hoiVerification?.status === "REVERTED") return record.hoiVerification;
    if (record.clChVerification?.status === "REVERTED") return record.clChVerification;
    return { status: "PENDING" };
}

/** Complete class record: details, notes, assignment, verification stages, flags and history */
export function ClassRecordDetails({ record }: { record: any }) {
    const notesLink = record.lectureNotes?.notesUrl;
    const snapshots: string[] = (record.snapshotUrls?.length ? record.snapshotUrls : (record.classPhotoUrl ? [record.classPhotoUrl] : [])) || [];
    const history = [...(record.pipelineHistory || [])].reverse();
    const flags = [...(record.delayFlags || [])].reverse();
    return (
        <div className="space-y-5" data-testid="class-record-details">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Professor">{record.facultyName}</Field>
                <Field label="College">{record.collegeName || record.college}</Field>
                <Field label="Subject">{record.courseName}{record.subjectCode ? ` (${record.subjectCode})` : ""}</Field>
                <Field label="Topic">{record.topicsCovered}</Field>
                <Field label="Class">{record.className}</Field>
                <Field label="Section">{record.section}</Field>
                <Field label="Branch">{record.stream}</Field>
                <Field label="Year / Semester">{[record.year, record.semester].filter(Boolean).join(" / ")}</Field>
                <Field label="Date">{dmy(record.date)}</Field>
                <Field label="Scheduled">{record.timeStart}{record.timeStop ? ` – ${record.timeStop}` : ""}</Field>
                <Field label="Lecture Type / Unit">{[record.lectureType, record.unitNumber ? `Unit ${record.unitNumber}` : ""].filter(Boolean).join(" · ")}</Field>
                <Field label="Submitted">{record.submittedAt ? `${fmt(record.submittedAt)}${record.submissionCount > 1 ? ` (submission ${record.submissionCount})` : ""}` : "Not yet"}</Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50 space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12} /> Attendance</p>
                    <p className="text-sm font-black text-white">{record.totalStudents ? `${record.numberOfAttendees ?? 0} present out of ${record.totalStudents}` : "Not entered"}</p>
                    {record.reasonForLessAttendance && <p className="text-[11px] text-zinc-400">Low attendance reason: {record.reasonForLessAttendance}</p>}
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1.5"><Clock size={11} /> Entry / Exit (OM): {record.actualInTime || "—"} / {record.actualOutTime || "—"}
                        {record.omTimesUpdatedByName && <span className="text-zinc-500">· {record.omTimesUpdatedByName}, {fmt(record.omTimesUpdatedAt)}</span>}</p>
                    {record.isLate && <p className="text-[11px] text-amber-400">Late{record.remarksWhyLate ? `: ${record.remarksWhyLate}` : ""}</p>}
                </div>
                <div className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50 space-y-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><FileText size={12} /> Notes</p>
                    {notesLink ? (
                        <a href={notesLink} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-300 hover:underline flex items-center gap-1 break-all"><Link2 size={12} className="shrink-0" /> {notesLink}</a>
                    ) : record.notesMissing ? (
                        <div className="space-y-1">
                            <p className="text-xs text-amber-400 font-bold">Unable to submit notes</p>
                            <p className="text-xs text-zinc-200 whitespace-pre-wrap [overflow-wrap:anywhere]">Reason: {record.notesMissingReason}</p>
                            <p className="text-[11px] text-zinc-400">Reason status: <span className="font-bold">{record.notesReasonStatus === "VERIFIED" ? "Verified by OM" : record.notesReasonStatus === "REVERTED" ? "Reverted by OM" : "Waiting for OM"}</span>
                                {record.notesReasonReviewedByName ? ` · ${record.notesReasonReviewedByName}, ${fmt(record.notesReasonReviewedAt)}` : ""}</p>
                            {record.notesReasonComment && <p className="text-[11px] text-zinc-400">OM comment: {record.notesReasonComment}</p>}
                        </div>
                    ) : <p className="text-xs text-zinc-500">No notes yet</p>}
                    {record.lectureNotes?.notesContent && <p className="text-[11px] text-zinc-400 whitespace-pre-wrap [overflow-wrap:anywhere]">{record.lectureNotes.notesContent}</p>}
                    <p className="text-[11px] text-zinc-400">Submitted to Groups: <span className={record.submittedToGroup ? "text-emerald-400 font-bold" : "text-zinc-500"}>{record.submittedToGroup ? "Yes" : "No"}</span>
                        {record.submittedToGroupByName && record.submittedToGroup ? ` · ${record.submittedToGroupByName}, ${fmt(record.submittedToGroupAt)}` : ""}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50 space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><ClipboardList size={12} /> Assignment</p>
                    {record.assignment?.hasAssignment ? (
                        <>
                            <p className="text-xs text-white">{record.assignment.title}</p>
                            {record.assignment.assignmentUrl && <a href={record.assignment.assignmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-300 hover:underline flex items-center gap-1 break-all"><ExternalLink size={11} className="shrink-0" /> {record.assignment.assignmentUrl}</a>}
                            <p className="text-[11px] text-zinc-500">{record.assignment.addedLater ? "Added later" : "Added with the record"}{record.assignment.addedAt ? ` · ${fmt(record.assignment.addedAt)}` : ""}{record.assignment.deadline ? ` · Due ${dmy(record.assignment.deadline)}` : ""}</p>
                        </>
                    ) : <p className="text-xs text-zinc-500">No assignment yet</p>}
                </div>
                <div className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50 space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><ImageIcon size={12} /> Class Snapshots</p>
                    {snapshots.length ? (
                        <div className="flex flex-wrap gap-2">
                            {snapshots.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-300 hover:underline">Snapshot {i + 1}</a>)}
                        </div>
                    ) : <p className="text-xs text-zinc-500">None</p>}
                    {record.recordingUrl && <a href={record.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-300 hover:underline block">Recording</a>}
                </div>
            </div>

            <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ShieldCheck size={12} /> Verification</p>
                {finalVerificationText(record) && (
                    <div className="mb-2 px-3 py-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-2" data-testid="final-verification-line">
                        <ShieldCheck size={14} className="shrink-0" /> {finalVerificationText(record)}
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Stage title="OM" v={record.omVerification} />
                    <Stage title="Final (CL / CH / HOI)" v={finalStage(record)} />
                </div>
                {/* Older records: CL/CH verified first and HOI completed — keep showing the CL/CH step */}
                {record.clChVerification?.status === "VERIFIED" && record.hoiVerification?.status === "VERIFIED" && (
                    <p className="text-[11px] text-zinc-500 mt-1.5">Earlier step: verified by {record.clChVerification.byName} ({roleShort(record.clChVerification.role)}) · {fmt(record.clChVerification.at)}</p>
                )}
            </div>

            {flags.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Flag size={12} /> Notes-pending comments</p>
                    <div className="space-y-2">
                        {flags.map((f: any) => (
                            <div key={f.flagId} className={`p-3 rounded-xl border ${f.status === "OPEN" ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-700/50 bg-zinc-800/20"}`} data-testid="delay-flag">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-zinc-400">{f.byName} ({roleShort(f.role)}) · {fmt(f.at)}</span>
                                    <span className={`text-[10px] font-bold ${f.status === "OPEN" ? "text-amber-400" : "text-emerald-400"}`}>{f.status === "OPEN" ? "Open" : "Resolved"}</span>
                                </div>
                                <p className="text-xs text-white mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{f.comment}</p>
                                {f.status === "RESOLVED" && <p className="text-[11px] text-zinc-500 mt-1">Resolved by {f.resolvedByName} · {fmt(f.resolvedAt)}{f.resolutionNote ? ` — ${f.resolutionNote}` : ""}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {history.length > 0 && (
                <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3" open={history.length <= 6}>
                    <summary className="text-[10px] font-black text-zinc-500 uppercase tracking-widest cursor-pointer flex items-center gap-1.5"><History size={12} /> Audit trail ({history.length})</summary>
                    <ol className="mt-3 space-y-2">
                        {history.map((h: any, i: number) => (
                            <li key={i} className="flex gap-2.5">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-white">{h.action} {h.toStatus && h.toStatus !== h.fromStatus && <span className="text-zinc-500">→ {CLASS_STATUS_LABEL[h.toStatus] || h.toStatus}</span>}</p>
                                    <p className="text-[11px] text-zinc-500">{h.byName} ({roleShort(h.role)}) · {fmt(h.at)}</p>
                                    {h.comment && <p className="text-[11px] text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.comment}</p>}
                                </div>
                            </li>
                        ))}
                    </ol>
                </details>
            )}
        </div>
    );
}

/**
 * Action buttons for the logged-in role. All rules are enforced again on the server.
 * record may be "virtual" (a planned class without a record yet): only entry/exit times, a notes-pending
 * comment or an assignment can be added to it.
 */
export function ClassRecordActions({ record, role, userId, onDone }: { record: any; role: string; userId: string; onDone: (message: string) => void }) {
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [times, setTimes] = useState({ actualInTime: record.actualInTime || "", actualOutTime: record.actualOutTime || "", isLate: !!record.isLate, remarksWhyLate: record.remarksWhyLate || "" });
    const [asg, setAsg] = useState({ title: "", assignmentUrl: "" });
    const [notesUrl, setNotesUrl] = useState("");
    const st = record.pipelineStatus || "PENDING_PROFESSOR";
    const isOM = role === "OM", isClCh = CL_CH_ROLES.includes(role), isHOI = role === "HOI";
    const isOwner = PROFESSOR_ROLES.includes(role) && record.facultyId === userId;

    const call = async (action: string, extra: any = {}) => {
        setBusy(action); setError("");
        try {
            const body: any = { action, comment, ...extra };
            if (record.virtual) body.classRef = { facultyId: record.facultyId, date: record.date, lectureNumber: record.lectureNumber, sprintEntryId: record.sprintEntryId };
            else body.reportId = record._id;
            const res = await fetch("/api/academic/class-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Action failed");
            setComment("");
            onDone(data.message);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const btn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40";
    const needsComment = (st === "PENDING_OM" && isOM) || ((isHOI || isClCh) && st !== "COMPLETED");
    const openFlags = (record.delayFlags || []).filter((f: any) => f.status === "OPEN");
    const reasonPending = record.notesMissing && record.notesReasonStatus === "PENDING";

    return (
        <div className="space-y-3" data-testid="class-actions">
            {needsComment && !record.virtual && (
                <textarea value={comment} onChange={e => setComment(e.target.value)} data-testid="action-comment"
                    placeholder="Comment (required to revert or to add a notes-pending comment)"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 resize-none h-16" />
            )}

            {/* OM */}
            {isOM && st === "PENDING_OM" && (
                <div className="flex flex-wrap gap-2">
                    {reasonPending && <button disabled={!!busy} onClick={() => call("om_verify_reason")} className={`${btn} bg-teal-600 hover:bg-teal-500 text-white`}><CheckCircle2 size={12} /> Verify Reason</button>}
                    <button disabled={!!busy || reasonPending} title={reasonPending ? "Verify the missing-notes reason first" : ""} onClick={() => call("om_verify")} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><CheckCircle2 size={12} /> Verify Class Record</button>
                    <button disabled={!!busy || comment.trim().length < 5} onClick={() => call("om_revert")} className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20`}><RotateCcw size={12} /> {reasonPending ? "Revert Reason" : "Revert to Professor"}</button>
                </div>
            )}
            {isOM && !record.virtual && st !== "PENDING_PROFESSOR" && (
                <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer w-fit">
                    <input type="checkbox" checked={!!record.submittedToGroup} disabled={!!busy} data-testid="submitted-to-groups"
                        onChange={e => call("submitted_to_group", { value: e.target.checked })} className="w-4 h-4" />
                    Submitted to Groups
                </label>
            )}
            {isOM && st !== "COMPLETED" && (
                <div className="flex flex-wrap items-end gap-2">
                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Entry</p><input type="time" value={times.actualInTime} onChange={e => { const v = e.target.value; setTimes(t => ({ ...t, actualInTime: v, isLate: t.isLate || (!!v && !!record.timeStart && v > record.timeStart) })); }} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" /></div>
                    <div><p className="text-[9px] text-zinc-500 font-bold uppercase">Exit</p><input type="time" value={times.actualOutTime} onChange={e => setTimes(t => ({ ...t, actualOutTime: e.target.value }))} className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" /></div>
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-300 font-bold cursor-pointer pb-2">
                        <input type="checkbox" checked={times.isLate} onChange={e => setTimes(t => ({ ...t, isLate: e.target.checked }))} className="w-3.5 h-3.5" /> Class Late
                    </label>
                    {times.isLate && (
                        <div className="flex-1 min-w-[12rem]"><p className="text-[9px] text-zinc-500 font-bold uppercase">Why late</p><input value={times.remarksWhyLate} onChange={e => setTimes(t => ({ ...t, remarksWhyLate: e.target.value }))} placeholder="Remarks why late..." className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" /></div>
                    )}
                    <button disabled={!!busy || (!times.actualInTime && !times.actualOutTime)} onClick={() => call("om_times", times)} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700`}><Clock size={12} /> Save Entry / Exit</button>
                </div>
            )}

            {/* Final verification — any ONE of CL / CH / HOI (whoever acts first completes it) */}
            {(isClCh || isHOI) && FINAL_PENDING_CLASS_STATUSES.includes(st) && (
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <button disabled={!!busy} onClick={() => call("final_verify")} data-testid="final-verify" className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><ShieldCheck size={12} /> Final Verify (Complete)</button>
                        <button disabled={!!busy || comment.trim().length < 5} onClick={() => call("final_revert", { revertTo: "PROFESSOR" })} className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20`}><RotateCcw size={12} /> Revert to Professor</button>
                        <button disabled={!!busy || comment.trim().length < 5} onClick={() => call("final_revert", { revertTo: "OM" })} className={`${btn} bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20`}><RotateCcw size={12} /> Revert to OM</button>
                    </div>
                    <p className="text-[10px] text-zinc-500">Any one of CL, CH or HOI can do the final verification. Once done, it is no longer pending for the others.</p>
                </div>
            )}

            {/* HOI / CL / CH: notes-pending comment (Module 20) */}
            {(isHOI || isClCh) && st !== "COMPLETED" && record.classEnded !== false && (st === "PENDING_PROFESSOR" || record.notesMissing || st === "OM_REVERTED" || st === "CL_CH_REVERTED") && (
                <div className="space-y-2">
                    {record.virtual && (
                        <textarea value={comment} onChange={e => setComment(e.target.value)} data-testid="flag-comment"
                            placeholder="e.g. Notes for this class are still pending."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none resize-none h-14" />
                    )}
                    <button disabled={!!busy || comment.trim().length < 5} onClick={() => call("flag_delay")} className={`${btn} bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20`}><Flag size={12} /> Add Notes-Pending Comment</button>
                </div>
            )}

            {/* Resolve open flags: professor, HOI, CL, CH */}
            {(isOwner || isHOI || isClCh) && openFlags.map((f: any) => (
                <button key={f.flagId} disabled={!!busy} onClick={() => call("resolve_flag", { flagId: f.flagId })} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700`}>
                    <CheckCircle2 size={12} /> Mark comment resolved ({f.byName})
                </button>
            ))}

            {/* Professor: add assignment later, upload notes later */}
            {isOwner && record.classEnded !== false && (
                <div className="space-y-2 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest">{record.assignment?.hasAssignment ? "Update Assignment" : "Add Assignment"}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input value={asg.title} onChange={e => setAsg(a => ({ ...a, title: e.target.value }))} placeholder="Title (optional)" className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" />
                        <input value={asg.assignmentUrl} onChange={e => setAsg(a => ({ ...a, assignmentUrl: e.target.value }))} placeholder="Assignment link (https://...)" data-testid="assignment-url" className="flex-[2] px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" />
                        <button disabled={!!busy || !asg.assignmentUrl} onClick={() => call("add_assignment", asg)} className={`${btn} bg-purple-600 hover:bg-purple-500 text-white justify-center`}><Send size={12} /> Save</button>
                    </div>
                </div>
            )}
            {isOwner && !record.virtual && record.notesMissing && st !== "PENDING_PROFESSOR" && (
                <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl border border-teal-500/20 bg-teal-500/5">
                    <input value={notesUrl} onChange={e => setNotesUrl(e.target.value)} placeholder="Notes link (https://...)" className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" />
                    <button disabled={!!busy || !notesUrl} onClick={() => call("upload_notes", { notesUrl })} className={`${btn} bg-teal-600 hover:bg-teal-500 text-white justify-center`}><FileText size={12} /> Add Notes</button>
                </div>
            )}

            {busy && <p className="text-[11px] text-zinc-400 flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Saving...</p>}
            {error && <p className="text-xs text-red-400 flex items-center gap-1.5" data-testid="action-error"><AlertTriangle size={12} /> {error}</p>}
        </div>
    );
}
