"use client";

import { useState } from "react";
import {
    CheckCircle2, RotateCcw, Users, FileText, Link2, Image as ImageIcon, ClipboardList, Clock, Flag,
    History, ShieldCheck, Send, AlertTriangle, RefreshCw, ExternalLink,
    Building2, BookOpen, Cpu, GraduationCap, Monitor, CalendarDays, Calendar, CalendarCheck, Info, Check,
    Eye, LogIn, LogOut, MoreHorizontal,
} from "lucide-react";
import { CLASS_STATUS_LABEL, CLASS_STATUS_STYLE, roleShort, PROFESSOR_ROLES, CL_CH_ROLES, FINAL_PENDING_CLASS_STATUSES, finalVerificationText } from "@/lib/academic-status";

const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
/** Display only: "02 Oct 2026 · 01:40 PM" */
const fmtLong = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const date = d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
    return `${date} · ${time}`;
};
const dmy = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("-") : s || "");
/** Display only: "13:05" -> "01:05 PM" */
export const to12h = (t?: string) => {
    if (!t || !/^\d{1,2}:\d{2}/.test(t)) return t || "";
    const [h, m] = t.split(":");
    const hh = parseInt(h, 10);
    return `${String(hh % 12 || 12).padStart(2, "0")}:${m.slice(0, 2)} ${hh >= 12 ? "PM" : "AM"}`;
};
const weekday = (s?: string) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    return new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
};

export function ClassStatusBadge({ status }: { status?: string }) {
    const st = status || "PENDING_PROFESSOR";
    return (
        <span data-testid="class-status" className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${CLASS_STATUS_STYLE[st] || ""}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {CLASS_STATUS_LABEL[st] || st}
        </span>
    );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">{label} <Info size={9} className="text-zinc-600" /></p>
            <div className="flex items-center gap-2 mt-1.5 min-w-0">
                {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
                <div className="text-xs font-medium text-zinc-100 [overflow-wrap:anywhere] min-w-0">{children || <span className="text-zinc-600">—</span>}</div>
            </div>
        </div>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 min-w-0 ${className}`}>{children}</div>;
}

function CardHead({ icon, title, tone, right }: { icon: React.ReactNode; title: string; tone: string; right?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
                <span className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center ${tone}`}>{icon}</span>
                <h3 className="text-sm font-bold text-white truncate">{title}</h3>
            </div>
            {right}
        </div>
    );
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap ${tone}`}>{children}</span>;
}

function AttendanceRing({ present, total }: { present: number; total: number }) {
    const r = 34, c = 2 * Math.PI * r;
    const pct = total ? Math.min(100, (present / total) * 100) : 0;
    return (
        <div className="relative w-[88px] h-[88px] shrink-0">
            <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
                <circle cx="44" cy="44" r={r} fill="none" strokeWidth="7" className="stroke-zinc-800" />
                <circle cx="44" cy="44" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-emerald-400" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-xl font-black text-white">{total ? present : "—"}</span>
                {total ? <span className="text-[10px] text-zinc-400 mt-1">/ {total}</span> : null}
            </div>
        </div>
    );
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2.5 text-xs text-zinc-200">
            <span className={`w-4 h-4 shrink-0 rounded flex items-center justify-center ${ok ? "bg-emerald-500 text-zinc-950" : "border border-zinc-600"}`}>{ok && <Check size={11} strokeWidth={3.5} />}</span>
            <span>{children}</span>
        </div>
    );
}

function StepNode({ title, name, v, pendingTitle, doneTitle, revertedTitle }: { title?: string; name: string; v?: any; pendingTitle: string; doneTitle: string; revertedTitle: string }) {
    const s = v?.status || "PENDING";
    const circle = s === "VERIFIED" ? "bg-emerald-500 text-zinc-950 border-emerald-400"
        : s === "REVERTED" ? "bg-red-500/15 text-red-400 border-red-500/50"
            : "bg-amber-500/10 text-amber-400 border-amber-500/50";
    return (
        <div className="flex items-start gap-2.5 min-w-0" data-testid={`stage-${name}`}>
            <span className={`w-8 h-8 shrink-0 rounded-full border flex items-center justify-center ${circle}`}>
                {s === "VERIFIED" ? <Check size={16} strokeWidth={3} /> : s === "REVERTED" ? <RotateCcw size={14} /> : <MoreHorizontal size={16} />}
            </span>
            <div className="min-w-0">
                <p className={`text-xs font-bold ${s === "VERIFIED" ? "text-white" : s === "REVERTED" ? "text-red-400" : "text-amber-400"}`}>{s === "VERIFIED" ? doneTitle : s === "REVERTED" ? revertedTitle : pendingTitle}</p>
                {v?.byName && <p className="text-[11px] text-zinc-400 mt-0.5">{v.byName} ({roleShort(v.role)})</p>}
                {v?.at && <p className="text-[10px] text-zinc-500">{fmtLong(v.at)}</p>}
                {!v?.byName && s === "PENDING" && <p className="text-[11px] text-zinc-500 mt-0.5">Pending</p>}
                {v?.comment && <p className="text-[11px] text-zinc-300 mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{v.comment}</p>}
                {v?.revertTo && s === "REVERTED" && <p className="text-[10px] text-zinc-500 mt-0.5">Sent back to: {v.revertTo === "OM" ? "OM" : "Professor"}</p>}
            </div>
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

const DOT_COLORS = ["bg-emerald-400", "bg-indigo-400", "bg-amber-400", "bg-sky-400", "bg-violet-400"];

/** Complete class record: details, notes, assignment, verification stages, flags and history */
export function ClassRecordDetails({ record }: { record: any }) {
    const [showAllSnaps, setShowAllSnaps] = useState(false);
    const notesLink = record.lectureNotes?.notesUrl;
    const snapshots: string[] = (record.snapshotUrls?.length ? record.snapshotUrls : (record.classPhotoUrl ? [record.classPhotoUrl] : [])) || [];
    const history = [...(record.pipelineHistory || [])].reverse();
    const flags = [...(record.delayFlags || [])].reverse();

    const present = record.numberOfAttendees ?? 0;
    const total = record.totalStudents || 0;
    const pct = total ? ((present / total) * 100).toFixed(1) : "";
    const hasAssignment = !!record.assignment?.hasAssignment;
    const fin = finalStage(record);
    const clCh = record.clChVerification;
    const showClChStep = !!clCh?.status && clCh.status !== "PENDING"; // older records had a separate CL/CH step

    return (
        <div className="space-y-4" data-testid="class-record-details">
            {/* Details */}
            <Card className="p-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                    <Field label="Professor" icon={<Users size={14} />}>{record.facultyName}</Field>
                    <Field label="College" icon={<Building2 size={14} />}>{record.collegeName || record.college}</Field>
                    <Field label="Subject" icon={<BookOpen size={14} />}>{record.courseName}{record.subjectCode ? ` (${record.subjectCode})` : ""}</Field>
                    <Field label="Topic" icon={<Cpu size={14} />}>{record.topicsCovered}</Field>
                    <Field label="Class" icon={<GraduationCap size={14} />}>{record.className}</Field>
                    <Field label="Section" icon={<FileText size={14} />}>{record.section}</Field>
                    <Field label="Branch" icon={<Monitor size={14} />}>{record.stream}</Field>
                    <Field label="Year / Semester" icon={<CalendarDays size={14} />}>{[record.year, record.semester].filter(Boolean).join(" / ")}</Field>
                    <Field label="Date" icon={<Calendar size={14} />}>{dmy(record.date)}{weekday(record.date) ? ` (${weekday(record.date)})` : ""}</Field>
                    <Field label="Scheduled Time" icon={<Clock size={14} />}>{to12h(record.timeStart)}{record.timeStop ? ` – ${to12h(record.timeStop)}` : ""}</Field>
                    <Field label="Lecture Type / Unit" icon={<BookOpen size={14} />}>{[record.lectureType, record.unitNumber ? `Unit ${record.unitNumber}` : ""].filter(Boolean).join(" · ")}</Field>
                    <Field label="Submitted At" icon={<CalendarCheck size={14} />}>{record.submittedAt ? `${fmtLong(record.submittedAt)}${record.submissionCount > 1 ? ` (submission ${record.submissionCount})` : ""}` : "Not yet"}</Field>
                </div>
            </Card>

            {/* Attendance / Notes / Snapshots */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHead icon={<Users size={14} />} title="Attendance" tone="bg-emerald-500/10 border-emerald-500/30 text-emerald-400" />
                    <div className="flex items-center gap-4">
                        <AttendanceRing present={present} total={total} />
                        <div className="min-w-0">
                            <p className="text-sm font-black text-white">{total ? `${present} present out of ${total}` : "Not entered"}</p>
                            {pct && <p className="text-[11px] text-zinc-400 mt-0.5">{pct}% Attendance</p>}
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 flex items-center gap-2">
                                    <span className="w-6 h-6 shrink-0 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center"><LogIn size={12} /></span>
                                    <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold">Entry (OM)</p><p className="text-[11px] font-bold text-white">{to12h(record.actualInTime) || "—"}</p></div>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 flex items-center gap-2">
                                    <span className="w-6 h-6 shrink-0 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center"><LogOut size={12} /></span>
                                    <div className="min-w-0"><p className="text-[9px] text-zinc-500 font-bold">Exit (OM)</p><p className="text-[11px] font-bold text-white">{to12h(record.actualOutTime) || "—"}</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {record.reasonForLessAttendance && <p className="text-[11px] text-zinc-400 mt-3">Low attendance reason: {record.reasonForLessAttendance}</p>}
                    {record.isLate && <p className="text-[11px] text-amber-400 mt-1">Late{record.remarksWhyLate ? `: ${record.remarksWhyLate}` : ""}</p>}
                    {record.omTimesUpdatedByName && <p className="text-[10px] text-zinc-500 mt-3">Marked by: {record.omTimesUpdatedByName} · {fmtLong(record.omTimesUpdatedAt)}</p>}
                </Card>

                <Card>
                    <CardHead icon={<FileText size={14} />} title="Notes" tone="bg-blue-500/10 border-blue-500/30 text-blue-400"
                        right={notesLink
                            ? <Pill tone="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"><CheckCircle2 size={11} /> Submitted</Pill>
                            : record.notesMissing
                                ? <Pill tone="bg-amber-500/10 border-amber-500/30 text-amber-400">Missing</Pill>
                                : <Pill tone="bg-zinc-800 border-zinc-700 text-zinc-400">Pending</Pill>} />
                    <div className="space-y-2">
                        {notesLink ? (
                            <a href={notesLink} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-300 hover:underline flex items-start gap-1 break-all"><Link2 size={12} className="shrink-0 mt-0.5" /> {notesLink}</a>
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
                        <p className="text-[11px] text-zinc-400">Submitted to Groups: <span className={record.submittedToGroup ? "text-emerald-400 font-bold" : "text-zinc-500"}>{record.submittedToGroup ? "Yes" : "No"}</span></p>
                        {record.submittedToGroupByName && record.submittedToGroup && <p className="text-[10px] text-zinc-500">{record.submittedToGroupByName} · {fmtLong(record.submittedToGroupAt)}</p>}
                    </div>
                    {notesLink && (
                        <a href={notesLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-xs font-bold text-zinc-200">
                            <Eye size={13} /> View Notes <ExternalLink size={11} className="text-zinc-400" />
                        </a>
                    )}
                </Card>

                <Card>
                    <CardHead icon={<ImageIcon size={14} />} title="Class Snapshots" tone="bg-sky-500/10 border-sky-500/30 text-sky-400"
                        right={snapshots.length > 0 ? <Pill tone="bg-zinc-800 border-zinc-700 text-zinc-300">{snapshots.length} {snapshots.length === 1 ? "image" : "images"}</Pill> : undefined} />
                    {snapshots.length ? (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                {(showAllSnaps ? snapshots : snapshots.slice(0, 2)).map((u, i) => (
                                    <a key={i} href={u} target="_blank" rel="noopener noreferrer" title={`Snapshot ${i + 1}`} className="block aspect-[4/3] rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={u} alt={`Snapshot ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                    </a>
                                ))}
                            </div>
                            <button type="button" onClick={() => setShowAllSnaps(v => !v)} className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-xs font-bold text-zinc-200">
                                <Eye size={13} /> {showAllSnaps ? "Show Fewer" : "View All Snapshots"}
                            </button>
                        </>
                    ) : <p className="text-xs text-zinc-500">None</p>}
                    {record.recordingUrl && <a href={record.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-300 hover:underline block mt-2">Recording</a>}
                </Card>
            </div>

            {/* Assignment / Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
                <Card>
                    <CardHead icon={<ClipboardList size={14} />} title="Assignment" tone="bg-amber-500/10 border-amber-500/30 text-amber-400"
                        right={hasAssignment
                            ? <Pill tone="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"><CheckCircle2 size={11} /> Submitted</Pill>
                            : <Pill tone="bg-amber-500/10 border-amber-500/30 text-amber-400"><AlertTriangle size={11} /> Not Submitted</Pill>} />
                    {hasAssignment ? (
                        <div className="space-y-1">
                            <p className="text-xs text-white">{record.assignment.title}</p>
                            {record.assignment.assignmentUrl && <a href={record.assignment.assignmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-300 hover:underline flex items-center gap-1 break-all"><ExternalLink size={11} className="shrink-0" /> {record.assignment.assignmentUrl}</a>}
                            <p className="text-[11px] text-zinc-500">{record.assignment.addedLater ? "Added later" : "Added with the record"}{record.assignment.addedAt ? ` · ${fmt(record.assignment.addedAt)}` : ""}{record.assignment.deadline ? ` · Due ${dmy(record.assignment.deadline)}` : ""}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-zinc-300">No assignment yet</p>
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                                <Info size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-zinc-400">If assignment is not uploaded by Saturday 10:00 AM, automatic mail will be sent to the professor.</p>
                            </div>
                        </>
                    )}
                </Card>

                <Card>
                    <CardHead icon={<ShieldCheck size={14} />} title="Verification Checklist" tone="bg-emerald-500/10 border-emerald-500/30 text-emerald-400" />
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-col sm:grid-rows-3 gap-x-6 gap-y-3" data-testid="verification-checklist">
                        <CheckItem ok={total > 0}>Attendance marked</CheckItem>
                        <CheckItem ok={!!record.actualInTime}>Entry time marked <span className="text-emerald-400">(OM)</span></CheckItem>
                        <CheckItem ok={!!record.actualOutTime}>Exit time marked <span className="text-emerald-400">(OM)</span></CheckItem>
                        <CheckItem ok={!!notesLink}>Notes submitted</CheckItem>
                        <CheckItem ok={hasAssignment}>Assignment submitted</CheckItem>
                    </div>
                </Card>
            </div>

            {/* Verification status / Audit trail */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
                <Card>
                    <CardHead icon={<ShieldCheck size={14} />} title="Verification Status" tone="bg-emerald-500/10 border-emerald-500/30 text-emerald-400" />
                    {finalVerificationText(record) && (
                        <div className="mb-3 px-3 py-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-2" data-testid="final-verification-line">
                            <ShieldCheck size={14} className="shrink-0" /> {finalVerificationText(record)}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <StepNode name="OM" v={record.omVerification} pendingTitle="OM Verification" doneTitle="OM Verified" revertedTitle="OM Reverted" />
                        <div className="hidden sm:block h-px flex-1 min-w-4 bg-zinc-700 mt-4" />
                        {showClChStep && (
                            <>
                                <StepNode name="CL-CH" v={clCh} pendingTitle="CL/CH Verification" doneTitle="CL/CH Verified" revertedTitle="CL/CH Reverted" />
                                <div className="hidden sm:block h-px flex-1 min-w-4 bg-zinc-700 mt-4" />
                            </>
                        )}
                        <StepNode name="Final" v={fin}
                            pendingTitle={showClChStep ? "HOI Final Verification" : "Final Verification (CL / CH / HOI)"}
                            doneTitle="Final Verified" revertedTitle="Final Reverted" />
                    </div>
                </Card>

                {history.length > 0 ? (
                    <Card>
                        <details open={history.length <= 6}>
                            <summary className="cursor-pointer list-none flex items-center gap-2">
                                <span className="w-7 h-7 shrink-0 rounded-lg border bg-zinc-800 border-zinc-700 text-zinc-300 flex items-center justify-center"><History size={14} /></span>
                                <span className="text-sm font-bold text-white">Audit Trail ({history.length})</span>
                            </summary>
                            <ol className="mt-4 space-y-3">
                                {history.map((h: any, i: number) => (
                                    <li key={i} className="flex gap-2.5">
                                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-white">{h.action} {h.toStatus && h.toStatus !== h.fromStatus && <span className="text-zinc-500 font-normal">→ {CLASS_STATUS_LABEL[h.toStatus] || h.toStatus}</span>}</p>
                                            <p className="text-[11px] text-zinc-400">by {h.byName} ({roleShort(h.role)})</p>
                                            <p className="text-[10px] text-zinc-500">{fmtLong(h.at)}</p>
                                            {h.comment && <p className="text-[11px] text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.comment}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </details>
                    </Card>
                ) : null}
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