"use client";

import { useState } from "react";
import {
    CheckCircle2, RotateCcw, Users, FileText, Link2, Image as ImageIcon, ClipboardList, Clock, Flag,
    History, ShieldCheck, Send, AlertTriangle, RefreshCw, ExternalLink,
    Building2, BookOpen, Cpu, GraduationCap, Monitor, CalendarDays, Calendar, CalendarCheck, Info, Check,
    Eye, LogIn, LogOut, MoreHorizontal,
} from "lucide-react";
import { CLASS_STATUS_LABEL, CLASS_STATUS_STYLE, roleShort, PROFESSOR_ROLES, CL_CH_ROLES, FINAL_PENDING_CLASS_STATUSES, finalVerificationText, OM_TIME_GRACE_MINUTES, LATE_ENTRY_REASONS, EARLY_EXIT_REASONS, NOTES_GROUP_TYPES, notesGroupLabel } from "@/lib/academic-status";

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

/** Icon tile used in the details grid and card headers */
const TONES: Record<string, string> = {
    violet: "bg-violet-500/15 border-violet-500/30 text-violet-300",
    emerald: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    teal: "bg-teal-500/15 border-teal-500/30 text-teal-300",
    amber: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    sky: "bg-sky-500/15 border-sky-500/30 text-sky-300",
    rose: "bg-rose-500/15 border-rose-500/30 text-rose-300",
    blue: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    zinc: "bg-zinc-800 border-zinc-700 text-zinc-300",
};
function IconTile({ tone, children, size = "md" }: { tone: string; children: React.ReactNode; size?: "md" | "lg" }) {
    return <span className={`shrink-0 rounded-xl border flex items-center justify-center ${size === "lg" ? "w-10 h-10" : "w-9 h-9"} ${TONES[tone] || TONES.zinc}`}>{children}</span>;
}

function Field({ label, icon, tone, children }: { label: string; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 flex items-center gap-3 px-4 py-3.5">
            <IconTile tone={tone}>{icon}</IconTile>
            <div className="min-w-0">
                <p className="text-[11px] text-zinc-400">{label}</p>
                <div className="text-[13px] font-semibold text-white leading-snug [overflow-wrap:anywhere]">{children || <span className="text-zinc-600">—</span>}</div>
            </div>
        </div>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`relative overflow-hidden rounded-2xl border border-emerald-500/10 bg-gradient-to-b from-[#0d1714] to-[#0a100e] p-4 sm:p-5 min-w-0 ${className}`}>{children}</div>;
}

function CardHead({ icon, title, tone, right }: { icon: React.ReactNode; title: string; tone: string; right?: React.ReactNode }) {
    return (
        <div className="relative flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3 min-w-0">
                <IconTile tone={tone}>{icon}</IconTile>
                <h3 className="text-[15px] font-bold text-white truncate">{title}</h3>
            </div>
            {right}
        </div>
    );
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${tone}`}>{children}</span>;
}

function AttendanceRing({ present, total }: { present: number; total: number }) {
    const r = 40, c = 2 * Math.PI * r;
    const pct = total ? Math.min(100, (present / total) * 100) : 0;
    return (
        <div className="relative w-[104px] h-[104px] shrink-0">
            <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90">
                <circle cx="52" cy="52" r={r} fill="none" strokeWidth="8" className="stroke-zinc-800" />
                <circle cx="52" cy="52" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-2xl font-black text-white">{total ? present : "—"}</span>
                {total ? <span className="text-xs text-zinc-400 mt-1">/ {total}</span> : null}
            </div>
        </div>
    );
}

/** Professor entry / exit time marked by the OM — time always stays on one line */
function TimeTile({ kind, value }: { kind: "Entry" | "Exit"; value?: string }) {
    const isIn = kind === "Entry";
    const t = to12h(value);
    return (
        <div className="min-w-0 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5" data-testid={`time-${kind.toLowerCase()}`}>
            <IconTile tone={isIn ? "emerald" : "rose"}>{isIn ? <LogIn size={15} /> : <LogOut size={15} />}</IconTile>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-400 truncate" title={`Professor ${kind}`}>Professor {kind}</p>
                {t ? <p className="text-[15px] font-bold text-white whitespace-nowrap tabular-nums leading-tight">{t}</p>
                    : <p className="text-[13px] font-semibold text-zinc-500 leading-tight whitespace-nowrap">Not marked</p>}
            </div>
        </div>
    );
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 text-[13px] text-zinc-200">
            <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center ${ok ? "bg-emerald-500 text-zinc-950" : "border-2 border-zinc-600"}`}>{ok && <Check size={13} strokeWidth={3.5} />}</span>
            <span>{children}</span>
        </div>
    );
}

function StepNode({ name, v, pendingTitle, doneTitle, revertedTitle }: { name: string; v?: any; pendingTitle: string; doneTitle: string; revertedTitle: string }) {
    const s = v?.status || "PENDING";
    const circle = s === "VERIFIED" ? "bg-emerald-500 text-zinc-950 border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.55)]"
        : s === "REVERTED" ? "bg-red-500/15 text-red-400 border-red-500/50"
            : "bg-amber-500/15 text-amber-300 border-amber-400/70";
    return (
        <div className="flex items-start gap-3 min-w-0" data-testid={`stage-${name}`}>
            <span className={`w-10 h-10 shrink-0 rounded-full border-2 flex items-center justify-center ${circle}`}>
                {s === "VERIFIED" ? <Check size={18} strokeWidth={3} /> : s === "REVERTED" ? <RotateCcw size={16} /> : <MoreHorizontal size={18} />}
            </span>
            <div className="min-w-0">
                <p className={`text-[13px] font-bold ${s === "VERIFIED" ? "text-white" : s === "REVERTED" ? "text-red-400" : "text-amber-300"}`}>{s === "VERIFIED" ? doneTitle : s === "REVERTED" ? revertedTitle : pendingTitle}</p>
                {v?.byName && <p className="text-[11px] text-zinc-400 mt-0.5">{v.byName} ({roleShort(v.role)})</p>}
                {v?.at && <p className="text-[11px] text-zinc-500">{fmtLong(v.at)}</p>}
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

const DOT_COLORS = ["bg-emerald-400", "bg-violet-400", "bg-amber-400", "bg-sky-400", "bg-fuchsia-400"];
const AUDIT_PREVIEW = 3; // shown on small screens before "View All"; on wide screens the card is cut to the height of Verification Status

/** Complete class record: details, notes, assignment, verification stages, flags and history */
export function ClassRecordDetails({ record }: { record: any }) {
    const [showAllSnaps, setShowAllSnaps] = useState(false);
    const [showAllAudit, setShowAllAudit] = useState(false);
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
    const subLine = [record.stream, record.unitNumber ? `Unit ${record.unitNumber}` : "", record.lectureType].filter(Boolean);
    // Collage: one large photo + up to 4 small; with more than 5, the last tile shows "+N More"
    const collage = !showAllSnaps && snapshots.length > 1;
    const snapsShown = showAllSnaps ? snapshots : snapshots.length > 5 ? snapshots.slice(0, 4) : snapshots.slice(0, 5);
    const extraSnaps = snapshots.length > 5 ? snapshots.length - 4 : 0;
    const audit = history;

    return (
        <div className="@container space-y-4" data-testid="class-record-details">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/70 via-[#0b1713] to-[#0a100e] p-4 sm:p-5">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_45%_120%_at_90%_50%,rgba(16,185,129,0.18),transparent_70%)]" aria-hidden />
                <BookOpen aria-hidden size={120} strokeWidth={1} className="absolute -right-4 -bottom-8 text-emerald-500/10 hidden @xl:block" />
                <div className="relative flex items-center gap-4 min-w-0">
                    <span className="w-12 h-12 @md:w-14 @md:h-14 shrink-0 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center justify-center shadow-[0_0_24px_-6px_rgba(16,185,129,0.7)]"><BookOpen size={26} /></span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-lg sm:text-xl font-black text-white leading-tight [overflow-wrap:anywhere]">{record.courseName || "Class"}{record.subjectCode ? ` (${record.subjectCode})` : ""}</h2>
                            <span className="max-w-full [&_[data-testid=class-status]]:whitespace-normal"><ClassStatusBadge status={record.pipelineStatus} /></span>
                        </div>
                        {subLine.length > 0 && (
                            <p className="mt-1.5 text-sm text-emerald-300/90 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                                {subLine.map((s, i) => <span key={i} className="inline-flex items-center gap-2.5">{i > 0 && <span className="w-px h-3.5 bg-emerald-500/30" />}{s}</span>)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="rounded-2xl border border-emerald-500/10 bg-[#0b1210] overflow-hidden">
                <div className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-4 divide-white/[0.05] [&>*]:border-white/[0.05] [&>*]:border-b @3xl:[&>*:nth-last-child(-n+4)]:border-b-0">
                    <Field label="Professor" tone="violet" icon={<Users size={16} />}>{record.facultyName}</Field>
                    <Field label="College" tone="emerald" icon={<Building2 size={16} />}>{record.collegeName || record.college}</Field>
                    <Field label="Subject" tone="teal" icon={<BookOpen size={16} />}>{record.courseName}{record.subjectCode ? ` (${record.subjectCode})` : ""}</Field>
                    <Field label="Topic" tone="amber" icon={<Cpu size={16} />}>{record.topicsCovered}</Field>
                    <Field label="Class" tone="emerald" icon={<GraduationCap size={16} />}>{record.className}</Field>
                    <Field label="Section" tone="emerald" icon={<FileText size={16} />}>{record.section}</Field>
                    <Field label="Branch" tone="sky" icon={<Monitor size={16} />}>{record.stream}</Field>
                    <Field label="Year / Semester" tone="emerald" icon={<CalendarDays size={16} />}>{[record.year, record.semester].filter(Boolean).join(" / ")}</Field>
                    <Field label="Date" tone="rose" icon={<Calendar size={16} />}>{dmy(record.date)}{weekday(record.date) ? ` (${weekday(record.date)})` : ""}</Field>
                    <Field label="Scheduled Time" tone="amber" icon={<Clock size={16} />}>{to12h(record.timeStart)}{record.timeStop ? ` – ${to12h(record.timeStop)}` : ""}</Field>
                    <Field label="Lecture Type / Unit" tone="blue" icon={<BookOpen size={16} />}>{[record.lectureType, record.unitNumber ? `Unit ${record.unitNumber}` : ""].filter(Boolean).join(" · ")}</Field>
                    <Field label="Submitted At" tone="emerald" icon={<CalendarCheck size={16} />}>{record.submittedAt ? `${fmtLong(record.submittedAt)}${record.submissionCount > 1 ? ` (submission ${record.submissionCount})` : ""}` : "Not yet"}</Field>
                </div>
            </div>

            {/* Attendance / Notes / Snapshots */}
            <div className="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-[1fr_1fr_1.15fr] gap-4">
                <Card>
                    <CardHead icon={<Users size={16} />} title="Attendance" tone="emerald" />
                    <div className="flex items-center gap-4">
                        <AttendanceRing present={present} total={total} />
                        <div className="min-w-0">
                            <p className="text-base font-bold text-white leading-snug">{total ? <>{present} present <span className="whitespace-nowrap">out of {total}</span></> : "Not entered"}</p>
                            {pct && <p className="text-[13px] text-zinc-400 mt-0.5">{pct}% Attendance</p>}
                        </div>
                    </div>
                    {/* side by side only when the card itself is wide enough */}
                    <div className="@container mt-4">
                        <div className="grid grid-cols-1 @[20rem]:grid-cols-2 gap-2">
                            <TimeTile kind="Entry" value={record.actualInTime} />
                            <TimeTile kind="Exit" value={record.actualOutTime} />
                        </div>
                    </div>
                    <div className="mt-3 space-y-1">
                        {record.reasonForLessAttendance && <p className="text-[11px] text-zinc-400">Low attendance reason: {record.reasonForLessAttendance}</p>}
                        {(record.omCheck?.actualStart || record.omCheck?.actualEnd) && (
                            <p className="text-[11px] text-zinc-300" data-testid="om-actual">Actual class: <span className="font-bold tabular-nums">{to12h(record.omCheck.actualStart) || "—"} – {to12h(record.omCheck.actualEnd) || "—"}</span></p>
                        )}
                        {record.profClockIn && <p className="text-[11px] text-zinc-400">Professor clock-in / out: <span className="tabular-nums">{to12h(record.profClockIn)} – {to12h(record.profClockOut) || "—"}</span></p>}
                        {record.isLate && <p className="text-[11px] text-amber-400" data-testid="om-delay-info">{record.omCheck?.delayMinutes ? `Late entry ${record.omCheck.delayMinutes} min` : "Late"}{record.remarksWhyLate ? `: ${record.remarksWhyLate}` : ""}</p>}
                        {record.omCheck?.isEarlyExit && <p className="text-[11px] text-amber-400" data-testid="om-early-info">Early exit {record.omCheck.earlyExitMinutes} min{record.omCheck.earlyExitReason ? `: ${record.omCheck.earlyExitReason}` : ""}</p>}
                        {record.omCheck?.remarks && <p className="text-[11px] text-zinc-300">OM remarks: {record.omCheck.remarks}</p>}
                        {record.omTimesUpdatedByName && <p className="text-[11px] text-zinc-500">Marked by: {record.omTimesUpdatedByName} · {fmtLong(record.omTimesUpdatedAt)}</p>}
                    </div>
                </Card>

                <Card>
                    <CardHead icon={<FileText size={16} />} title="Notes" tone="violet"
                        right={notesLink
                            ? <Pill tone="bg-emerald-500/10 border-emerald-500/40 text-emerald-300"><CheckCircle2 size={13} /> Submitted</Pill>
                            : record.notesMissing
                                ? <Pill tone="bg-amber-500/10 border-amber-500/40 text-amber-300">Missing</Pill>
                                : <Pill tone="bg-zinc-800 border-zinc-700 text-zinc-400">Pending</Pill>} />
                    <div className="space-y-2.5">
                        {notesLink ? (
                            <a href={notesLink} target="_blank" rel="noopener noreferrer"
                                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5 text-[12px] font-semibold text-emerald-300 hover:border-emerald-500/40 break-all">
                                <Link2 size={18} className="shrink-0 mt-0.5 text-zinc-300" /> {notesLink}
                            </a>
                        ) : record.notesMissing ? (
                            <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2.5">
                                <p className="text-xs text-amber-300 font-bold">Unable to submit notes</p>
                                <p className="text-xs text-zinc-200 whitespace-pre-wrap [overflow-wrap:anywhere]">Reason: {record.notesMissingReason}</p>
                                <p className="text-[11px] text-zinc-400">Reason status: <span className="font-bold">{record.notesReasonStatus === "VERIFIED" ? "Verified by OM" : record.notesReasonStatus === "REVERTED" ? "Reverted by OM" : "Waiting for OM"}</span>
                                    {record.notesReasonReviewedByName ? ` · ${record.notesReasonReviewedByName}, ${fmt(record.notesReasonReviewedAt)}` : ""}</p>
                                {record.notesReasonComment && <p className="text-[11px] text-zinc-400">OM comment: {record.notesReasonComment}</p>}
                            </div>
                        ) : <p className="text-xs text-zinc-500">No notes yet</p>}
                        {record.lectureNotes?.notesContent && <p className="text-[12px] text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{record.lectureNotes.notesContent}</p>}
                        <p className="text-[12px] text-zinc-400">Submitted to Groups: <span className={record.submittedToGroup ? "text-emerald-400 font-semibold" : "text-zinc-300"}>{record.submittedToGroup ? `Yes${record.submittedToGroupType ? ` — ${notesGroupLabel(record.submittedToGroupType)}` : ""}` : "No"}</span></p>
                        {record.submittedToGroupByName && record.submittedToGroup && <p className="text-[11px] text-zinc-500">{record.submittedToGroupByName} · {fmtLong(record.submittedToGroupAt)}</p>}
                    </div>
                    {notesLink && (
                        <a href={notesLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[13px] font-semibold text-white">
                            <Eye size={16} /> View Notes <ExternalLink size={13} className="text-zinc-400" />
                        </a>
                    )}
                </Card>

                <Card className="@2xl:col-span-2 @4xl:col-span-1">
                    <CardHead icon={<ImageIcon size={16} />} title="Class Snapshots" tone="emerald"
                        right={snapshots.length > 0 ? <Pill tone="bg-zinc-800/80 border-zinc-700 text-zinc-300">{snapshots.length} {snapshots.length === 1 ? "image" : "images"}</Pill> : undefined} />
                    {snapshots.length ? (
                        <div className={`grid gap-2 ${snapshots.length === 1 ? "grid-cols-1" : collage ? "grid-cols-[1.6fr_1fr_1fr] grid-rows-2" : "grid-cols-3"}`}>
                            {snapsShown.map((u, i) => (
                                <a key={i} href={u} target="_blank" rel="noopener noreferrer" title={`Snapshot ${i + 1}`}
                                    className={`block rounded-xl overflow-hidden border border-white/10 bg-black/40 hover:border-emerald-500/40 ${i === 0 && collage ? "row-span-2 min-h-[8rem]" : "aspect-[4/3]"}`}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={u} alt={`Snapshot ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                </a>
                            ))}
                            {!showAllSnaps && extraSnaps > 0 && (
                                <button type="button" onClick={() => setShowAllSnaps(true)} className="aspect-[4/3] rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] flex flex-col items-center justify-center text-white">
                                    <span className="text-lg font-black">+{extraSnaps}</span><span className="text-[11px] text-zinc-400">More</span>
                                </button>
                            )}
                        </div>
                    ) : <p className="text-xs text-zinc-500">No snapshots</p>}
                    {showAllSnaps && <button type="button" onClick={() => setShowAllSnaps(false)} className="mt-3 text-xs font-semibold text-emerald-300 hover:underline">Show fewer</button>}
                    {record.recordingUrl && <a href={record.recordingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-sky-300 hover:underline"><ExternalLink size={12} /> Recording</a>}
                </Card>
            </div>

            {/* Assignment / Checklist */}
            <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4">
                <Card>
                    <ClipboardList aria-hidden size={110} strokeWidth={1} className="absolute -right-3 -bottom-6 text-amber-500/[0.07]" />
                    <CardHead icon={<ClipboardList size={16} />} title="Assignment" tone="amber"
                        right={hasAssignment
                            ? <Pill tone="bg-emerald-500/10 border-emerald-500/40 text-emerald-300"><CheckCircle2 size={13} /> Submitted</Pill>
                            : <Pill tone="bg-amber-500/10 border-amber-500/40 text-amber-300"><AlertTriangle size={13} /> Not Submitted</Pill>} />
                    {hasAssignment ? (
                        <div className="relative space-y-1.5">
                            <p className="text-[13px] font-semibold text-white">{record.assignment.title}</p>
                            {record.assignment.assignmentUrl && <a href={record.assignment.assignmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-300 hover:underline flex items-center gap-1.5 break-all"><ExternalLink size={12} className="shrink-0" /> {record.assignment.assignmentUrl}</a>}
                            <p className="text-[11px] text-zinc-500">{record.assignment.addedLater ? "Added later" : "Added with the record"}{record.assignment.addedAt ? ` · ${fmt(record.assignment.addedAt)}` : ""}{record.assignment.deadline ? ` · Due ${dmy(record.assignment.deadline)}` : ""}</p>
                            {record.assignment.addedLater && (record.pipelineStatus === "COMPLETED" || record.assignment.verificationStatus !== "Pending") && (
                                <p className="text-[11px] text-zinc-400" data-testid="assignment-verification">Verification: <span className={record.assignment.verificationStatus === "Approved" ? "text-emerald-300" : record.assignment.verificationStatus === "Needs Revision" ? "text-red-300" : "text-amber-300"}>{record.assignment.verificationStatus === "Approved" ? "Verified" : record.assignment.verificationStatus || "Pending"}</span>
                                    {record.assignment.verifiedByName && record.assignment.verificationStatus !== "Pending" ? ` · ${record.assignment.verifiedByName}${record.assignment.verifiedAt ? `, ${fmt(record.assignment.verifiedAt)}` : ""}` : ""}
                                    {record.assignment.leadRemarks && record.assignment.verificationStatus === "Needs Revision" ? ` — ${record.assignment.leadRemarks}` : ""}</p>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <p className="text-[13px] text-zinc-200">No assignment yet</p>
                            <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/30 p-3 max-w-md">
                                <IconTile tone="blue"><Info size={15} /></IconTile>
                                <p className="text-[12px] text-zinc-300 leading-relaxed">If assignment is not uploaded by Saturday 10:00 AM, automatic mail will be sent to the professor.</p>
                            </div>
                        </div>
                    )}
                </Card>

                <Card>
                    <ClipboardList aria-hidden size={110} strokeWidth={1} className="absolute -right-3 -bottom-6 text-emerald-500/[0.08]" />
                    <CardHead icon={<ShieldCheck size={16} />} title="Verification Checklist" tone="emerald" />
                    <div className="relative grid grid-cols-1 @md:grid-cols-2 @md:grid-flow-col @md:grid-rows-3 gap-x-8 gap-y-3.5" data-testid="verification-checklist">
                        <CheckItem ok={total > 0}>Attendance marked</CheckItem>
                        <CheckItem ok={!!record.actualInTime}>Entry time marked <span className="text-emerald-400">(OM)</span></CheckItem>
                        <CheckItem ok={!!record.actualOutTime}>Exit time marked <span className="text-emerald-400">(OM)</span></CheckItem>
                        <CheckItem ok={!!notesLink}>Notes submitted</CheckItem>
                        <CheckItem ok={hasAssignment}>Assignment submitted</CheckItem>
                        <CheckItem ok={!!record.submittedToGroup}>Notes shared to group</CheckItem>
                    </div>
                </Card>
            </div>

            {/* Verification status / Audit trail */}
            <div className="grid grid-cols-1 @3xl:grid-cols-[1.25fr_1fr] gap-4">
                <Card>
                    <CardHead icon={<ShieldCheck size={16} />} title="Verification Status" tone="blue" />
                    {finalVerificationText(record) && (
                        <div className="mb-4 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[13px] font-semibold flex items-center gap-2" data-testid="final-verification-line">
                            <ShieldCheck size={16} className="shrink-0" /> {finalVerificationText(record)}
                        </div>
                    )}
                    <div className="flex flex-col @lg:flex-row @lg:items-start gap-4">
                        <StepNode name="OM" v={record.omVerification} pendingTitle="OM Verification" doneTitle="OM Verified" revertedTitle="OM Reverted" />
                        <div className="hidden @lg:block h-px flex-1 min-w-6 bg-gradient-to-r from-emerald-500/50 to-zinc-700 mt-5" />
                        {showClChStep && (
                            <>
                                <StepNode name="CL-CH" v={clCh} pendingTitle="CL/CH Verification" doneTitle="CL/CH Verified" revertedTitle="CL/CH Reverted" />
                                <div className="hidden @lg:block h-px flex-1 min-w-6 bg-zinc-700 mt-5" />
                            </>
                        )}
                        <StepNode name="Final" v={fin}
                            pendingTitle={showClChStep ? "HOI Final Verification" : "Final Verification (CL / CH / HOI)"}
                            doneTitle="Final Verified" revertedTitle="Final Reverted" />
                    </div>
                </Card>

                {/* Collapsed: same height as the Verification Status card (wide screens) / first entries (small screens). View All shows every entry. */}
                <div className={`relative ${showAllAudit ? "" : "@3xl:min-h-[15rem]"}`} data-testid="audit-card">
                    <Card className={showAllAudit ? "" : "@3xl:absolute @3xl:inset-0 flex flex-col"}>
                        <History aria-hidden size={110} strokeWidth={1} className="absolute -right-3 -bottom-6 text-emerald-500/[0.07]" />
                        <CardHead icon={<History size={16} />} title={`Audit Trail (${history.length})`} tone="blue"
                            right={history.length > 2 ? (
                                <button type="button" onClick={() => setShowAllAudit(v => !v)} data-testid="audit-toggle"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[12px] font-semibold text-white whitespace-nowrap">
                                    {showAllAudit ? "Show Less" : `View All (${history.length})`}
                                </button>
                            ) : undefined} />
                        {history.length === 0 && <p className="relative text-[12px] text-zinc-500" data-testid="audit-empty">No history recorded for this class yet. Steps appear here once the professor submits and OM / CL / CH / HOI act on it.</p>}
                        {history.length > 0 && <div className={`relative ${showAllAudit ? "" : "flex-1 min-h-0 overflow-hidden"}`}>
                        <ol className="relative space-y-3.5 pl-1">
                            <span className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10" aria-hidden />
                            {audit.map((h: any, i: number) => (
                                <li key={i} className={`relative flex gap-3 ${!showAllAudit && i >= AUDIT_PREVIEW ? "@max-3xl:hidden" : ""}`}>
                                    <span className={`relative z-10 mt-1 w-3.5 h-3.5 rounded-full shrink-0 ring-4 ring-[#0b1210] ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-white">{h.action} {h.toStatus && h.toStatus !== h.fromStatus && <span className="text-zinc-400 font-normal">→ {CLASS_STATUS_LABEL[h.toStatus] || h.toStatus}</span>}</p>
                                        <p className="text-[11px] text-zinc-400">by {h.byName} ({roleShort(h.role)}) · {fmtLong(h.at)}</p>
                                        {h.comment && <p className="text-[11px] text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.comment}</p>}
                                    </div>
                                </li>
                            ))}
                        </ol>
                        {!showAllAudit && history.length > 2 && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0a100e] to-transparent" aria-hidden />}
                        </div>}
                    </Card>
                </div>
            </div>

            {flags.length > 0 && (
                <Card>
                    <CardHead icon={<Flag size={16} />} title={`Notes-pending comments (${flags.length})`} tone="amber" />
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
                </Card>
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
    const oc = record.omCheck || {};
    const [times, setTimes] = useState({
        actualInTime: oc.entryTime || record.actualInTime || "", actualOutTime: oc.exitTime || record.actualOutTime || "", omRemarks: oc.remarks || "",
    });
    // Late-entry / early-exit reason: one of the listed reasons, or "Other" with a typed reason
    const splitReason = (saved: string, list: string[]) => !saved ? { sel: "", other: "" } : list.includes(saved) ? { sel: saved, other: "" } : { sel: "Other", other: saved.replace(/^Other\s*[—:-]\s*/, "") };
    const [late, setLate] = useState(() => splitReason(oc.delayReason || record.remarksWhyLate || "", LATE_ENTRY_REASONS));
    const [early, setEarly] = useState(() => splitReason(oc.earlyExitReason || "", EARLY_EXIT_REASONS));
    const reasonText = (r: { sel: string; other: string }) => (r.sel === "Other" ? r.other.trim() : r.sel);
    const toMin = (t?: string) => (t && /^\d{1,2}:\d{2}/.test(t) ? Number(t.slice(0, t.indexOf(":"))) * 60 + Number(t.slice(t.indexOf(":") + 1, t.indexOf(":") + 3)) : null);
    const schedIn = toMin(record.timeStart), schedOut = toMin(record.timeStop);
    const entryMin = toMin(times.actualInTime), exitMin = toMin(times.actualOutTime);
    const lateBy = schedIn !== null && entryMin !== null ? entryMin - schedIn : null;    // negative = came early
    const earlyBy = schedOut !== null && exitMin !== null ? schedOut - exitMin : null;   // negative = stayed longer
    const isLateEntry = lateBy !== null && lateBy > OM_TIME_GRACE_MINUTES;
    const isEarlyExit = earlyBy !== null && earlyBy > OM_TIME_GRACE_MINUTES;
    const exitBeforeEntry = entryMin !== null && exitMin !== null && exitMin <= entryMin;
    const lateReasonOk = !isLateEntry || reasonText(late).length >= 3;
    const earlyReasonOk = !isEarlyExit || reasonText(early).length >= 3;
    const timesPayload = { ...times, delayReason: isLateEntry ? reasonText(late) : "", earlyExitReason: isEarlyExit ? reasonText(early) : "" };
    const timesBlock = !times.actualInTime || !times.actualOutTime ? "Enter the professor's entry and exit time"
        : exitBeforeEntry ? "Exit time must be after entry time"
        : !lateReasonOk ? "Select the reason for the late entry" : !earlyReasonOk ? "Select the reason for the early exit" : "";
    // Notes Submitted to Groups (OM): saved right away, without reloading the record (typed times stay)
    const [groups, setGroups] = useState({ done: !!record.submittedToGroup, type: String(record.submittedToGroupType || "") });
    const [groupBusy, setGroupBusy] = useState(false);
    const [groupMsg, setGroupMsg] = useState("");
    const saveGroups = async (done: boolean, type: string) => {
        const before = groups;
        setGroups({ done, type }); setGroupBusy(true); setGroupMsg(""); setError("");
        try {
            const res = await fetch("/api/academic/class-records", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportId: record._id, action: "submitted_to_group", value: done, groupType: type }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save");
            setGroupMsg(done ? `Saved — ${notesGroupLabel(type)}` : "Unmarked");
        } catch (e: any) { setGroups(before); setError(e.message); }
        finally { setGroupBusy(false); }
    };
    const groupsRequired = !record.notesMissing;
    const groupsBlock = groupsRequired && (!groups.done || !groups.type) ? "Tick \"Notes Submitted to Groups\" and choose the group first" : "";
    const [asg, setAsg] = useState({ title: "", assignmentUrl: "" });
    const [notesUrl, setNotesUrl] = useState("");
    const st = record.pipelineStatus || "PENDING_PROFESSOR";
    const isOM = role === "OM", isClCh = CL_CH_ROLES.includes(role);
    // AD: organisation-wide academic authority — same final-stage actions as HOI
    const isHOI = role === "HOI" || role === "AD";
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
    const needsComment = (isHOI || isClCh) && st !== "COMPLETED"; // the OM writes remarks in the OM verification box
    const openFlags = (record.delayFlags || []).filter((f: any) => f.status === "OPEN");
    const reasonPending = record.notesMissing && record.notesReasonStatus === "PENDING";

    return (
        <div className="space-y-3" data-testid="class-actions">
            {needsComment && !record.virtual && (
                <textarea value={comment} onChange={e => setComment(e.target.value)} data-testid="action-comment"
                    placeholder="Comment (required to revert or to add a notes-pending comment)"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 resize-none h-16" />
            )}

            {/* OM: entry / exit verification, then Revert to Professor or Verify & Forward */}
            {isOM && st !== "COMPLETED" && !record.virtual && st !== "PENDING_PROFESSOR" && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3" data-testid="om-times">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-7 h-7 shrink-0 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center justify-center"><Clock size={14} /></span>
                        OM Verification — Entry / Exit
                    </p>
                    {/* Scheduled vs professor's own times (read-only) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]" data-testid="om-compare">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Scheduled</p><p className="text-zinc-200 font-bold tabular-nums">{to12h(record.timeStart) || "—"} – {to12h(record.timeStop) || "—"}</p></div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Professor clock-in / out</p><p className="text-zinc-200 font-bold tabular-nums">{record.profClockIn ? `${to12h(record.profClockIn)} – ${to12h(record.profClockOut) || "—"}` : "No attendance"}</p></div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Professor reported class time</p><p className="text-zinc-200 font-bold tabular-nums">{record.classStartTime ? `${to12h(record.classStartTime)} – ${to12h(record.classEndTime) || "—"}` : "—"}</p></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {([["actualInTime", "Professor Entry", LogIn, "text-emerald-400"], ["actualOutTime", "Professor Exit", LogOut, "text-red-400"]] as ["actualInTime" | "actualOutTime", string, any, string][]).map(([k, label, Icon, tone]) => (
                            <label key={k} className="block min-w-0">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1"><Icon size={11} className={tone} /> {label} <span className="text-red-400">*</span></span>
                                <input type="time" value={times[k]} onChange={e => setTimes(t => ({ ...t, [k]: e.target.value }))} data-testid={`om-${k}`}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white tabular-nums [color-scheme:dark] outline-none focus:border-emerald-500/50" />
                            </label>
                        ))}
                    </div>

                    {/* Entry status against the scheduled start */}
                    <TimeCheck testId="om-delay"
                        tone={schedIn === null || lateBy === null ? "muted" : isLateEntry ? "warn" : "ok"}
                        text={schedIn === null ? "No scheduled start time — late entry cannot be checked"
                            : lateBy === null ? `Enter the professor's entry time (scheduled ${to12h(record.timeStart)})`
                            : isLateEntry ? `Late entry by ${fmtMins(lateBy)} (scheduled ${to12h(record.timeStart)}) — reason required`
                            : lateBy > 0 ? `On time — ${lateBy} min after ${to12h(record.timeStart)} (within ${OM_TIME_GRACE_MINUTES} min grace)`
                            : lateBy < 0 ? `On time — entered ${fmtMins(-lateBy)} before ${to12h(record.timeStart)}${-lateBy >= 120 ? " (check AM / PM)" : ""}`
                            : `On time — entered at ${to12h(record.timeStart)}`} />
                    {isLateEntry && <ReasonPicker label="Why was the professor late?" testId="om-delay-reason" options={LATE_ENTRY_REASONS} value={late} onChange={setLate} />}

                    {/* Exit status against the scheduled end */}
                    <TimeCheck testId="om-early"
                        tone={schedOut === null || earlyBy === null ? "muted" : exitBeforeEntry ? "error" : isEarlyExit ? "warn" : "ok"}
                        text={schedOut === null ? "No scheduled end time — early exit cannot be checked"
                            : earlyBy === null ? `Enter the professor's exit time (scheduled ${to12h(record.timeStop)})`
                            : exitBeforeEntry ? "Exit time must be after the entry time"
                            : isEarlyExit ? `Early exit by ${fmtMins(earlyBy)} (scheduled end ${to12h(record.timeStop)}) — reason required`
                            : earlyBy > 0 ? `Full class — left ${earlyBy} min before ${to12h(record.timeStop)} (within ${OM_TIME_GRACE_MINUTES} min grace)`
                            : earlyBy < 0 ? `Full class — left ${fmtMins(-earlyBy)} after ${to12h(record.timeStop)}${-earlyBy >= 120 ? " (check AM / PM)" : ""}`
                            : `Full class — left at ${to12h(record.timeStop)}`} />
                    {isEarlyExit && !exitBeforeEntry && <ReasonPicker label="Why did the professor leave early?" testId="om-early-reason" options={EARLY_EXIT_REASONS} value={early} onChange={setEarly} />}

                    {/* Notes Submitted to Groups — required before Verify & Forward */}
                    <div className={`rounded-xl border p-3 space-y-2.5 ${groups.done && groups.type ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-sky-500/25 bg-sky-500/[0.04]"}`} data-testid="groups-card">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white flex items-center gap-2"><Send size={13} className="text-sky-400" /> Notes Submitted to Groups {groupsRequired && <span className="text-red-400">*</span>}</p>
                            {groupBusy ? <span className="text-[10px] text-zinc-400">Saving…</span> : groupMsg ? <span className="text-[10px] text-emerald-400">{groupMsg}</span> : null}
                        </div>
                        {!groupsRequired && <p className="text-[11px] text-zinc-400">Notes were not submitted (reason given), so this is optional for this class.</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                            <select value={groups.type} disabled={groupBusy} data-testid="groups-type"
                                onChange={e => { const t = e.target.value; if (groups.done && t) saveGroups(true, t); else setGroups(g => ({ ...g, type: t })); }}
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-sky-500/50 [color-scheme:dark]">
                                <option value="">Select group…</option>
                                {NOTES_GROUP_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                            <label className={`flex items-center gap-2 text-xs font-medium ${groups.type ? "text-zinc-200 cursor-pointer" : "text-zinc-500 cursor-not-allowed"}`}>
                                <input type="checkbox" checked={groups.done} disabled={groupBusy || (!groups.type && !groups.done)} data-testid="submitted-to-groups"
                                    onChange={e => saveGroups(e.target.checked, e.target.checked ? groups.type : "")} className="w-4 h-4 accent-emerald-500" />
                                Lecture notes have been submitted to the group
                            </label>
                        </div>
                        {!groups.type && !groups.done && <p className="text-[10px] text-zinc-500">Choose the group first, then tick the box.</p>}
                    </div>

                    <textarea value={times.omRemarks} onChange={e => setTimes(t => ({ ...t, omRemarks: e.target.value }))} placeholder="Verification remarks (required to revert)" data-testid="om-remarks"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 resize-none h-16" />
                    {st === "PENDING_OM" && !reasonPending && (timesBlock || groupsBlock) && (
                        <p className="text-[11px] text-amber-300 text-right" data-testid="forward-block">To verify &amp; forward: {timesBlock || groupsBlock}</p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                        {st !== "PENDING_OM" && (
                            <button disabled={!!busy || !!timesBlock} title={timesBlock} onClick={() => call("om_times", timesPayload)} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700`}><Clock size={12} /> Save Entry / Exit</button>
                        )}
                        {st === "PENDING_OM" && (
                            <>
                                {reasonPending && <button disabled={!!busy} onClick={() => call("om_verify_reason")} className={`${btn} bg-teal-600 hover:bg-teal-500 text-white`}><CheckCircle2 size={12} /> Verify Reason</button>}
                                <button disabled={!!busy || times.omRemarks.trim().length < 5} title="Write remarks (at least 5 characters) to revert"
                                    onClick={() => call("om_revert", { comment: times.omRemarks })} data-testid="om-revert"
                                    className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20`}><RotateCcw size={12} /> {reasonPending ? "Revert Reason" : "Revert to Professor"}</button>
                                <button disabled={!!busy || groupBusy || reasonPending || !!timesBlock || !!groupsBlock}
                                    title={reasonPending ? "Verify the missing-notes reason first" : timesBlock || groupsBlock}
                                    onClick={() => call("om_verify", { ...timesPayload, comment: times.omRemarks })} data-testid="om-verify-forward"
                                    className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><Send size={12} /> Verify &amp; Forward</button>
                            </>
                        )}
                    </div>
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
                    <p className="text-[10px] text-zinc-500">Any one of CL, CH, HOI or AD can do the final verification. Once done, it is no longer pending for the others.</p>
                </div>
            )}

            {/* HOI: assignment added after the class record was completed */}
            {role === "HOI" && st === "COMPLETED" && !record.virtual && record.assignment?.hasAssignment && record.assignment?.verificationStatus === "Pending" && (
                <div className="space-y-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5" data-testid="hoi-assignment-review">
                    <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest">Assignment added later — verify</p>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} data-testid="assignment-comment"
                        placeholder="Comment (required for Needs Revision)"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-amber-500/50 resize-none h-14" />
                    <div className="flex flex-wrap gap-2">
                        <button disabled={!!busy} onClick={() => call("hoi_assignment_verify")} data-testid="hoi-assignment-verify" className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><CheckCircle2 size={12} /> Verify Assignment</button>
                        <button disabled={!!busy || comment.trim().length < 5} title="Write a comment (at least 5 characters)" onClick={() => call("hoi_assignment_revert")} data-testid="hoi-assignment-revert" className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20`}><RotateCcw size={12} /> Needs Revision</button>
                    </div>
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

// ── OM entry / exit helpers ──
const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

function TimeCheck({ tone, text, testId }: { tone: "ok" | "warn" | "error" | "muted"; text: string; testId?: string }) {
    const cls = tone === "ok" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
        : tone === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300"
        : "border-zinc-800 bg-zinc-950/50 text-zinc-400";
    return <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold border ${cls}`} data-testid={testId}><Clock size={13} className="shrink-0" /> <span>{text}</span></div>;
}

function ReasonPicker({ label, options, value, onChange, testId }: { label: string; options: string[]; value: { sel: string; other: string }; onChange: (v: { sel: string; other: string }) => void; testId?: string }) {
    return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-300">{label} <span className="text-red-400">*</span></label>
            <select value={value.sel} onChange={e => onChange({ sel: e.target.value, other: e.target.value === "Other" ? value.other : "" })} data-testid={testId}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-amber-500/50 [color-scheme:dark]">
                <option value="">Select a reason…</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="Other">Other (type the reason)</option>
            </select>
            {value.sel === "Other" && (
                <input value={value.other} onChange={e => onChange({ sel: "Other", other: e.target.value })} placeholder="Type the reason" autoFocus data-testid={testId ? `${testId}-other` : undefined}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
            )}
        </div>
    );
}