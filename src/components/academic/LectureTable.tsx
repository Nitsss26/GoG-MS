"use client";

/**
 * Compact, Excel / Notion-style lecture table shared by:
 *   - Professor → My Lectures (/faculty/lectures)
 *   - OM / HOI / CL / CH / AD → Class Verification (/academic/verification)
 *
 * UI only. It never changes data: every status shown here is derived from the fields the
 * existing APIs already return (report / pipelineStatus / classEnded). Actions are passed in
 * by each page, so permissions stay exactly where they were.
 */

import { useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";
import {
    Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, SlidersHorizontal,
    X, CheckCircle2, AlertTriangle, Clock, RotateCcw, CalendarClock, BadgeCheck, FileText, ClipboardList, Users, BookOpen, Calendar, CalendarDays,
    Table2, KanbanSquare, Circle, ArrowRight, HelpCircle,
} from "lucide-react";
import { CLASS_STATUS_LABEL, roleShort } from "@/lib/academic-status";

// ───────────────────────────── layout helper ─────────────────────────────

/**
 * true when the window is at least `px` wide. Table vs. phone list is chosen with this (not only with CSS
 * breakpoint classes), so one of the two is always rendered even if a breakpoint style is missing.
 */
export function useMinWidth(px = 768) {
    const [ok, setOk] = useState(true); // same first render on server and client
    useEffect(() => {
        const m = window.matchMedia(`(min-width: ${px}px)`);
        const f = () => setOk(m.matches);
        f();
        m.addEventListener("change", f);
        return () => m.removeEventListener("change", f);
    }, [px]);
    return ok;
}

// ───────────────────────────── row model ─────────────────────────────

export type ReportState = "PENDING" | "SUBMITTED" | "VERIFIED" | "REVERTED" | "IN_PROGRESS" | "SCHEDULED";
export type VerifyStage = "PENDING_OM" | "PENDING_CL" | "PENDING_FINAL" | "COMPLETED";
/** One verification step: not submitted yet · waiting · done · sent back · (final only) waiting for the OM step */
export type StepState = "NA" | "PENDING" | "VERIFIED" | "REVERTED" | "WAITING_OM";
export type NotesState = "UPLOADED" | "MISSING" | "PENDING" | "NOT_YET";
export type AssignmentState = "UPLOADED" | "NONE";

export interface LectureRow {
    key: string;
    raw: any;
    lectureNumber?: number;
    date: string;
    timeStart?: string;
    timeStop?: string;
    facultyName?: string;
    college?: string;
    subject: string;
    subjectCode?: string;
    topic?: string;
    course?: string;
    semester?: string;
    year?: string;
    section?: string;
    type?: string;
    unit?: string;
    /** Sprint-plan fields shown as columns on Lecture Reports */
    stream?: string;
    className?: string;
    content?: string;
    day?: string;
    present?: number;
    total?: number;
    pipelineStatus?: string;
    recorded: boolean;
    report: ReportState;
    /** Verification stage of a submitted record (label + colour of the badge) */
    stage?: VerifyStage;
    /** Final verifier role (HOI / CL / CH / AD) of a completed record */
    verifiedBy?: string;
    /** Per-step verification state (Lecture Reports columns) */
    omState?: StepState;
    finalState?: StepState;
    omBy?: string;
    finalBy?: string;
    notes: NotesState;
    notesUrl?: string;
    assignment: AssignmentState;
    assignmentUrl?: string;
}

const REVERTED_STATUSES = ["OM_REVERTED", "CL_CH_REVERTED"];

/** Has the class started? (IST — same rule the page used for "In Progress") */
const hasStarted = (date?: string, time?: string) => {
    if (!date || !time) return false;
    const t = new Date(`${date}T${time.padStart(5, "0")}:00+05:30`).getTime();
    return !isNaN(t) && t <= Date.now();
};

/**
 * Builds a table row from either
 *  - a professor lecture (from /api/faculty/lectures, report nested in `report`), or
 *  - a class record (from /api/academic/class-records, report fields at the top level, `virtual` = no record yet).
 * `recorded` uses the same rule each page already used.
 */
export function toLectureRow(item: any, source: "lecture" | "record"): LectureRow {
    const rep: any = source === "lecture" ? item.report || null : item.virtual ? null : item;
    const ps: string = item.pipelineStatus || "PENDING_PROFESSOR";
    const recorded = source === "lecture"
        ? !!item.report && (item.status === "Completed" || (!!item.pipelineStatus && item.pipelineStatus !== "PENDING_PROFESSOR"))
        : !item.virtual && ps !== "PENDING_PROFESSOR";

    let report: ReportState;
    if (REVERTED_STATUSES.includes(ps)) report = "REVERTED";
    else if (recorded) report = ps === "COMPLETED" ? "VERIFIED" : "SUBMITTED";
    else if (item.classEnded) report = "PENDING";
    else if (hasStarted(item.date, item.timeStart)) report = "IN_PROGRESS";
    else report = "SCHEDULED";

    // Stage after submission: OM → CL / CH → (older records) HOI → completed
    const stage: VerifyStage | undefined = !recorded || report === "REVERTED" ? undefined
        : ps === "COMPLETED" ? "COMPLETED"
            : ["OM_VERIFIED", "PENDING_CL_CH"].includes(ps) ? "PENDING_CL"
                : ["CL_CH_VERIFIED", "PENDING_HOI"].includes(ps) ? "PENDING_FINAL" : "PENDING_OM";
    const fin = rep?.finalVerification?.status === "VERIFIED" ? rep.finalVerification : rep?.hoiVerification?.status === "VERIFIED" ? { ...rep.hoiVerification, role: rep.hoiVerification.role || "HOI" } : null;
    const verifiedBy = stage === "COMPLETED" ? (roleShort(fin?.role) || "HOI") : undefined;
    // Step columns: OM verification, then the final verification by any one of CL / CH / HOI
    const OM_DONE = ["OM_VERIFIED", "PENDING_CL_CH", "CL_CH_VERIFIED", "PENDING_HOI", "COMPLETED", "CL_CH_REVERTED"];
    const omState: StepState = !recorded && ps !== "OM_REVERTED" ? "NA" : ps === "OM_REVERTED" ? "REVERTED" : OM_DONE.includes(ps) ? "VERIFIED" : "PENDING";
    const finalState: StepState = !recorded && ps !== "OM_REVERTED" ? "NA" : ps === "COMPLETED" ? "VERIFIED" : ps === "CL_CH_REVERTED" ? "REVERTED"
        : ["OM_VERIFIED", "PENDING_CL_CH", "CL_CH_VERIFIED", "PENDING_HOI"].includes(ps) ? "PENDING" : "WAITING_OM";
    const omBy = rep?.omVerification?.byName ? `${rep.omVerification.byName}` : undefined;
    const finalBy = finalState === "VERIFIED" ? [roleShort(fin?.role) || "HOI", fin?.byName ? `(${fin.byName})` : ""].filter(Boolean).join(" ") : undefined;
    const notesUrl: string | undefined = rep?.lectureNotes?.notesUrl || undefined;
    // "Pending" only while the report itself is still due; a submitted record without notes (older format) shows "—"
    const notes: NotesState = notesUrl ? "UPLOADED" : rep?.notesMissing ? "MISSING" : (!recorded && item.classEnded) ? "PENDING" : "NOT_YET";
    const asg = rep?.assignment;
    const att = rep?.numberOfAttendees;

    return {
        key: String(item._id || `${item.date}#${item.lectureNumber}`),
        raw: item,
        lectureNumber: item.lectureNumber,
        date: item.date || "",
        timeStart: item.timeStart || item.classStartTime,
        timeStop: item.timeStop || item.classEndTime,
        facultyName: item.facultyName,
        college: item.college,
        subject: item.courseName || item.subjectName || "—",
        subjectCode: item.subjectCode,
        topic: item.topicsCovered,
        course: item.className || item.stream || "",
        semester: item.semester,
        year: item.year,
        section: item.section,
        type: item.lectureType || rep?.lectureType,
        unit: item.unitNumber || rep?.unitNumber,
        stream: item.stream || rep?.stream,
        className: item.className || rep?.className,
        content: item.content || "",
        day: item.day,
        present: recorded && typeof att === "number" ? att : undefined,
        total: rep?.totalStudents || item.defaultTotalStudents || undefined,
        pipelineStatus: ps,
        recorded,
        report,
        stage,
        verifiedBy,
        omState, finalState, omBy, finalBy,
        notes,
        notesUrl,
        assignment: asg?.hasAssignment ? "UPLOADED" : "NONE",
        assignmentUrl: asg?.assignmentUrl || undefined,
    };
}

// ───────────────────────────── badges ─────────────────────────────

const pill = "inline-flex items-center gap-1 h-[22px] px-2 rounded-md border text-[10.5px] font-bold whitespace-nowrap leading-none";

export const REPORT_META: Record<ReportState, { label: string; cls: string; icon: any }> = {
    SUBMITTED: { label: "Submitted", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", icon: CheckCircle2 },
    VERIFIED: { label: "Verified", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35", icon: BadgeCheck },
    PENDING: { label: "Report Pending", cls: "bg-orange-500/10 text-orange-300 border-orange-500/30", icon: AlertTriangle },
    REVERTED: { label: "Reverted", cls: "bg-red-500/10 text-red-300 border-red-500/30", icon: RotateCcw },
    IN_PROGRESS: { label: "In Progress", cls: "bg-teal-500/10 text-teal-300 border-teal-500/30", icon: Clock },
    SCHEDULED: { label: "Scheduled", cls: "bg-sky-500/10 text-sky-300 border-sky-500/25", icon: CalendarClock },
};

/** Submitted records: one colour per verification stage (blue → indigo → violet → green) */
export const STAGE_META: Record<VerifyStage, { label: (r: LectureRow) => string; cls: string; icon: any; hint: string }> = {
    PENDING_OM: { label: () => "Submitted", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", icon: CheckCircle2, hint: "Submitted · waiting for OM verification" },
    PENDING_CL: { label: () => "OM Done · CL/CH/HOI Pending", cls: "bg-indigo-500/10 text-indigo-300 border-indigo-500/35", icon: CheckCircle2, hint: "Verified by OM · final verification by CL / CH / HOI pending" },
    PENDING_FINAL: { label: () => "CL Verified · HOI Pending", cls: "bg-violet-500/10 text-violet-300 border-violet-500/35", icon: CheckCircle2, hint: "Verified by CL / CH · final verification pending" },
    COMPLETED: { label: r => `Verified by ${r.verifiedBy || "HOI"}`, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: BadgeCheck, hint: "Completed · final verification done" },
};

export function ReportBadge({ row }: { row: LectureRow }) {
    if (row.stage) {
        const sm = STAGE_META[row.stage];
        return (
            <span className={`inline-flex items-start gap-1 px-2 py-1 rounded-md border text-[10.5px] font-bold leading-[13px] max-w-full ${sm.cls}`} title={`${sm.hint}${CLASS_STATUS_LABEL[row.pipelineStatus || ""] ? ` (${CLASS_STATUS_LABEL[row.pipelineStatus || ""]})` : ""}`} data-testid="report-badge" data-state={row.report} data-stage={row.stage}>
                <sm.icon size={11} className="shrink-0 mt-px" />
                {/* "OM Verified · CL Pending" → two lines, so it never gets cut */}
                <span className="min-w-0">{sm.label(row).split(" · ").map((part, i) => <span key={i} className={i ? "block font-semibold opacity-80 text-[9.5px]" : "block whitespace-nowrap"}>{part}</span>)}</span>
            </span>
        );
    }
    const m = REPORT_META[row.report];
    // Keep the detailed verification stage visible on hover (and below the badge for "Submitted")
    const stage = row.recorded ? CLASS_STATUS_LABEL[row.pipelineStatus || ""] : "";
    return (
        <span className={`${pill} ${m.cls}`} title={stage || m.label} data-testid="report-badge" data-state={row.report}>
            <m.icon size={11} className="shrink-0" /> {m.label}
        </span>
    );
}

const STEP_META: Record<Exclude<StepState, "NA">, { label: string; cls: string; icon: any }> = {
    PENDING: { label: "Pending", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", icon: Clock },
    VERIFIED: { label: "Verified", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
    REVERTED: { label: "Reverted", cls: "bg-red-500/10 text-red-300 border-red-500/30", icon: RotateCcw },
    WAITING_OM: { label: "After OM", cls: "bg-zinc-800/80 text-zinc-400 border-zinc-700", icon: Clock },
};
/** OM / CL-CH-HOI step cell: Pending · Verified (by …) · Reverted */
export function StepBadge({ state, by, testId }: { state?: StepState; by?: string; testId?: string }) {
    if (!state || state === "NA") return <span className="text-zinc-600" data-testid={testId}>—</span>;
    const m = STEP_META[state];
    return (
        <span className="inline-flex flex-col items-start gap-0.5 min-w-0" data-testid={testId} data-state={state}>
            <span className={`${pill} ${m.cls}`} title={state === "WAITING_OM" ? "Starts after the OM verification" : m.label}><m.icon size={11} className="shrink-0" /> {m.label}</span>
            {by && state === "VERIFIED" && <span className="text-[10px] text-zinc-500 truncate max-w-full" title={by}>by {by}</span>}
        </span>
    );
}

export function NotesBadge({ row }: { row: LectureRow }) {
    if (row.notes === "UPLOADED") return <span className={`${pill} bg-emerald-500/10 text-emerald-300 border-emerald-500/25`} data-testid="notes-badge"><FileText size={11} /> Uploaded</span>;
    if (row.notes === "MISSING") return <span className={`${pill} bg-amber-500/10 text-amber-300 border-amber-500/30`} title={`Reason given: ${row.raw?.report?.notesMissingReason || row.raw?.notesMissingReason || ""}`} data-testid="notes-badge">Reason</span>;
    if (row.notes === "PENDING") return <span className={`${pill} bg-orange-500/10 text-orange-300 border-orange-500/25`} data-testid="notes-badge">Pending</span>;
    return <span className="text-[11px] text-zinc-600" data-testid="notes-badge">—</span>;
}

export function AssignmentBadge({ row }: { row: LectureRow }) {
    if (row.assignment === "UPLOADED") return <span className={`${pill} bg-violet-500/10 text-violet-300 border-violet-500/25`} data-testid="asg-badge"><ClipboardList size={11} /> Added</span>;
    return <span className="text-[11px] text-zinc-500" data-testid="asg-badge">Not added</span>;
}

const typeCls = (t?: string) => {
    const x = (t || "").toLowerCase();
    if (x.includes("practical") || x.includes("lab")) return "bg-violet-500/10 text-violet-300 border-violet-500/25";
    if (x.includes("tutorial")) return "bg-pink-500/10 text-pink-300 border-pink-500/25";
    if (x.includes("revision")) return "bg-amber-500/10 text-amber-300 border-amber-500/25";
    if (x.includes("test") || x.includes("assessment")) return "bg-red-500/10 text-red-300 border-red-500/25";
    return "bg-sky-500/10 text-sky-300 border-sky-500/25";
};

// ───────────────────────────── helpers ─────────────────────────────

export const fmtDate = (ymd?: string) => ymd ? new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDay = (ymd?: string) => ymd ? new Date(ymd + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }) : "";
const semLine = (r: LectureRow) => [r.semester ? (/^sem/i.test(r.semester) ? r.semester : `Sem ${r.semester}`) : "", r.year].filter(Boolean).join(" · ");

export type SortKey = "date" | "time" | "subject" | "report";
const REPORT_ORDER: Record<ReportState, number> = { REVERTED: 0, PENDING: 1, IN_PROGRESS: 2, SCHEDULED: 3, SUBMITTED: 4, VERIFIED: 5 };

type Quick = "ALL" | "PENDING" | "SUBMITTED" | "REVERTED" | "UPCOMING";
const QUICK: { k: Quick; label: string; test: (r: LectureRow) => boolean; on: string }[] = [
    { k: "ALL", label: "All", test: () => true, on: "bg-zinc-700/70 text-white" },
    { k: "PENDING", label: "Report Pending", test: r => r.report === "PENDING", on: "bg-orange-500/15 text-orange-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.35)]" },
    { k: "SUBMITTED", label: "Submitted", test: r => r.report === "SUBMITTED" || r.report === "VERIFIED", on: "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]" },
    { k: "REVERTED", label: "Reverted", test: r => r.report === "REVERTED", on: "bg-red-500/15 text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35)]" },
    { k: "UPCOMING", label: "Upcoming", test: r => r.report === "SCHEDULED" || r.report === "IN_PROGRESS", on: "bg-sky-500/15 text-sky-300 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.35)]" },
];

/** Scheduled minutes from "HH:MM" start / stop */
const durationMin = (r: LectureRow) => {
    const m = (t?: string) => { const x = /^(\d{1,2}):(\d{2})/.exec(t || ""); return x ? +x[1] * 60 + +x[2] : NaN; };
    const d = m(r.timeStop) - m(r.timeStart);
    return d > 0 ? d : 0;
};
/** Lecture Reports: the sprint-plan fields, one column each (scroll right) */
const PLAN_COLS: { k: string; label: string; w: string; wrap?: boolean; get: (r: LectureRow) => string | undefined }[] = [
    { k: "code", label: "Subject Code", w: "w-[110px]", get: r => r.subjectCode },
    { k: "topic", label: "Topic", w: "w-[240px]", wrap: true, get: r => r.topic },
    { k: "stream", label: "Branch / Stream", w: "w-[200px]", wrap: true, get: r => r.stream },
    { k: "year", label: "Year", w: "w-[96px]", get: r => r.year },
    { k: "semester", label: "Semester", w: "w-[120px]", get: r => r.semester },
    { k: "section", label: "Section", w: "w-[80px]", get: r => r.section },
    { k: "class", label: "Class", w: "w-[200px]", wrap: true, get: r => r.className },
    { k: "type", label: "Lecture Type", w: "w-[120px]", get: r => r.type },
    { k: "unit", label: "Unit", w: "w-[84px]", get: r => r.unit },
    { k: "content", label: "Content", w: "w-[260px]", wrap: true, get: r => r.content },
];
/** Sticky left columns of the Lecture Reports table */
const stickL0 = "sticky left-0 z-[2]";
const stickL1 = "sticky left-[110px] z-[2]";
/** 1 … 4 5 6 … 12 (0 = gap) */
const pageList = (cur: number, pages: number) => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const set = new Set([1, pages, cur - 1, cur, cur + 1].filter(n => n >= 1 && n <= pages));
    const list = Array.from(set).sort((a, b) => a - b);
    const out: number[] = [];
    list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push(0); out.push(n); });
    return out;
};
const QUICK_ICON: Record<Quick, any> = { ALL: CalendarDays, PENDING: Clock, SUBMITTED: CheckCircle2, REVERTED: RotateCcw, UPCOMING: CalendarClock };
const uniq = (vals: (string | undefined)[]) => Array.from(new Set(vals.filter((v): v is string => !!v && !!String(v).trim()))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// ───────────────────────────── steps tracker ─────────────────────────────

type DotState = "done" | "now" | "back" | "off";
/** The three steps of a lecture report, from the same fields as the badges: Report (professor) → OM → CL / CH / HOI */
export function stepsOf(r: LectureRow): { k: string; label: string; state: DotState; hint: string }[] {
    const prof: DotState = r.report === "REVERTED" ? "back" : r.recorded ? "done" : r.report === "PENDING" ? "now" : "off";
    const om: DotState = r.omState === "VERIFIED" ? "done" : r.omState === "PENDING" ? "now" : r.omState === "REVERTED" ? "back" : "off";
    const fin: DotState = r.finalState === "VERIFIED" ? "done" : r.finalState === "PENDING" ? "now" : r.finalState === "REVERTED" ? "back" : "off";
    return [
        { k: "report", label: "Report", state: prof, hint: prof === "done" ? "Report submitted" : prof === "now" ? "Report to be uploaded by the professor" : prof === "back" ? "Sent back — the professor fixes and re-submits" : "Class not finished yet" },
        { k: "om", label: "OM", state: om, hint: om === "done" ? `Verified by OM${r.omBy ? ` (${r.omBy})` : ""}` : om === "now" ? "Waiting for OM verification" : om === "back" ? "OM sent it back to the professor" : "After the report" },
        { k: "final", label: "CL/CH/HOI", state: fin, hint: fin === "done" ? `Final verification done${r.finalBy ? ` — ${r.finalBy}` : ""}` : fin === "now" ? "Waiting for CL / CH / HOI (any one)" : fin === "back" ? "Sent back to the professor" : "After OM" },
    ];
}
const DOT: Record<DotState, string> = {
    done: "bg-emerald-500 border-emerald-400 text-zinc-950", now: "bg-amber-400/15 border-amber-400 text-amber-300 animate-pulse",
    back: "bg-red-500/20 border-red-400 text-red-300", off: "bg-zinc-900 border-zinc-700 text-zinc-600",
};
const DOT_TEXT: Record<DotState, string> = { done: "text-emerald-300", now: "text-amber-300", back: "text-red-300", off: "text-zinc-600" };
/** Report ● → OM ● → CL/CH/HOI ●  (✓ done · ● waiting · ↺ sent back · ○ not yet) */
export function StepsTracker({ row, compact }: { row: LectureRow; compact?: boolean }) {
    const steps = stepsOf(row);
    return (
        <span className="inline-flex items-center gap-1" data-testid="steps" data-steps={steps.map(x => x.state).join(",")}>
            {steps.map((x, i) => (
                <span key={x.k} className="inline-flex items-center gap-1" title={`${x.label}: ${x.hint}`}>
                    {i > 0 && <span className={`h-px w-2.5 ${steps[i - 1].state === "done" ? "bg-emerald-500/70" : "bg-zinc-700"}`} />}
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${DOT[x.state]}`} data-step={x.k} data-state={x.state}>
                        {x.state === "done" ? <CheckCircle2 size={10} strokeWidth={3} /> : x.state === "back" ? <RotateCcw size={9} strokeWidth={3} /> : x.state === "now" ? <Circle size={6} fill="currentColor" /> : null}
                    </span>
                    {!compact && <span className={`text-[10px] font-bold whitespace-nowrap ${DOT_TEXT[x.state]}`}>{x.label}</span>}
                </span>
            ))}
        </span>
    );
}

/** One line that explains the flow (shown above the sheet / board) */
function HowItWorks() {
    const step = (n: number, text: string, cls: string) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${cls}`}>{n}</span>{text}</span>;
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-zinc-400" data-testid="how-it-works">
            <HelpCircle size={12} className="text-zinc-500 shrink-0" />
            <span className="font-bold text-zinc-300">How it works:</span>
            {step(1, "Professor uploads the report after class", "bg-amber-400/20 text-amber-300")}
            <ArrowRight size={11} className="text-zinc-600" />
            {step(2, "OM verifies", "bg-sky-500/20 text-sky-300")}
            <ArrowRight size={11} className="text-zinc-600" />
            {step(3, "CL / CH / HOI gives the final verification", "bg-violet-500/20 text-violet-300")}
            <span className="text-zinc-500">· Sent back (<RotateCcw size={10} className="inline text-red-300" />) → the professor fixes it and re-submits.</span>
        </div>
    );
}

/** Board lanes (Notion-style): every lecture is in exactly one lane */
const LANES: { k: string; label: string; hint: string; test: (r: LectureRow) => boolean; head: string }[] = [
    { k: "REVERTED", label: "Sent Back — Fix", hint: "Professor corrects and re-submits", test: r => r.report === "REVERTED", head: "border-red-500/40 text-red-300 bg-red-500/[0.06]" },
    { k: "PENDING", label: "Report Pending", hint: "Professor uploads the report", test: r => r.report === "PENDING", head: "border-orange-500/40 text-orange-300 bg-orange-500/[0.06]" },
    { k: "WITH_OM", label: "With OM", hint: "OM verifies", test: r => r.stage === "PENDING_OM", head: "border-sky-500/40 text-sky-300 bg-sky-500/[0.06]" },
    { k: "WITH_FINAL", label: "With CL / CH / HOI", hint: "Final verification", test: r => r.stage === "PENDING_CL" || r.stage === "PENDING_FINAL", head: "border-violet-500/40 text-violet-300 bg-violet-500/[0.06]" },
    { k: "DONE", label: "Verified", hint: "All steps done", test: r => r.stage === "COMPLETED", head: "border-emerald-500/40 text-emerald-300 bg-emerald-500/[0.06]" },
    { k: "UPCOMING", label: "Upcoming / In Class", hint: "Report after the class ends", test: r => r.report === "SCHEDULED" || r.report === "IN_PROGRESS", head: "border-zinc-700 text-zinc-300 bg-zinc-800/30" },
];
const LANE_LIMIT = 60;

// ───────────────────────────── table ─────────────────────────────

interface LectureTableProps {
    rows: LectureRow[];
    loading?: boolean;
    /** Professor column (manager views) */
    showProfessor?: boolean;
    /** All | Report Pending | Submitted | Reverted | Upcoming */
    showQuick?: boolean;
    renderActions: (row: LectureRow) => ReactNode;
    onOpen: (row: LectureRow) => void;
    activeKey?: string | null;
    emptyText?: string;
    /** Shown at the right of the toolbar (e.g. Refresh) */
    toolbarExtra?: ReactNode;
    /** Changing this resets the table to page 1 (e.g. a new date range) */
    resetKey?: string;
    /** Initial sort (default: date, oldest first) */
    defaultSort?: { key: SortKey; dir: 1 | -1 };
    /** Noun used in "Showing 1–10 of 48 …" */
    itemLabel?: string;
    /** "report" = Lecture Reports design (My Lectures / Lecture Reports); default = compact sheet (Verification) */
    variant?: "default" | "report";
    /** Report design only: one column per sprint-plan field (the table scrolls right) */
    showPlanDetails?: boolean;
    /** Sheet / Board switch; the choice is remembered per page (viewKey) */
    board?: boolean;
    viewKey?: string;
    /** Page controls inside the table toolbar: a row above the search line, and filters left of the search */
    toolbarTop?: ReactNode;
    toolbarStart?: ReactNode;
}

export default function LectureTable({ rows, loading, showProfessor, showQuick = true, renderActions, onOpen, activeKey, emptyText = "No lectures in this range.", toolbarExtra, resetKey, defaultSort, itemLabel = "Lecture", variant = "default", showPlanDetails = false, board = true, viewKey = "default", toolbarTop, toolbarStart }: LectureTableProps) {
    const [view, setView] = useState<"sheet" | "board">("sheet");
    useEffect(() => { try { if (localStorage.getItem(`oms.lectureTable.view.${viewKey}`) === "board") setView("board"); } catch { /* storage unavailable */ } }, [viewKey]);
    const changeView = (v: "sheet" | "board") => { setView(v); try { localStorage.setItem(`oms.lectureTable.view.${viewKey}`, v); } catch { /* ignore */ } };
    const isBoard = board && view === "board";
    const [search, setSearch] = useState("");
    const [quick, setQuick] = useState<Quick>("ALL");
    const [showFilters, setShowFilters] = useState(false);
    const [f, setF] = useState({ date: "", course: "", semester: "", section: "", type: "", report: "", notes: "", assignment: "" });
    const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(defaultSort || { key: "date", dir: 1 });
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);
    const isMd = useMinWidth(768);
    const isLg = useMinWidth(1280); // below this the table has too little room left to scroll with 3 frozen columns
    const profFrozen = !!showProfessor && isLg;

    // Remember the page size for this viewer (convenience only)
    useEffect(() => { try { const v = parseInt(localStorage.getItem("oms.lectureTable.pageSize") || ""); if ([10, 25, 50].includes(v)) setPageSize(v); } catch { /* storage unavailable */ } }, []);
    const changePageSize = (n: number) => { setPageSize(n); setPage(1); try { localStorage.setItem("oms.lectureTable.pageSize", String(n)); } catch { /* ignore */ } };

    useEffect(() => { setPage(1); }, [search, quick, f, sort, resetKey]);

    const options = useMemo(() => ({
        date: uniq(rows.map(r => r.date)),
        course: uniq(rows.map(r => r.course)),
        semester: uniq(rows.map(r => r.semester)),
        section: uniq(rows.map(r => r.section)),
        type: uniq(rows.map(r => r.type)),
    }), [rows]);

    const quickCounts = useMemo(() => Object.fromEntries(QUICK.map(q => [q.k, rows.filter(q.test).length])) as Record<Quick, number>, [rows]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const qt = QUICK.find(x => x.k === quick)!.test;
        const list = rows.filter(r => {
            if (!qt(r)) return false;
            if (q && ![r.subject, r.subjectCode, r.topic, r.facultyName, ...(variant === "report" ? [r.course, r.unit ? `unit ${r.unit}` : ""] : [])].some(v => String(v || "").toLowerCase().includes(q))) return false;
            if (f.date && r.date !== f.date) return false;
            if (f.course && r.course !== f.course) return false;
            if (f.semester && r.semester !== f.semester) return false;
            if (f.section && r.section !== f.section) return false;
            if (f.type && r.type !== f.type) return false;
            if (f.report && (f.report === "SUBMITTED" ? !["SUBMITTED", "VERIFIED"].includes(r.report) : r.report !== f.report)) return false;
            if (f.notes && r.notes !== f.notes) return false;
            if (f.assignment && r.assignment !== f.assignment) return false;
            return true;
        });
        const tm = (r: LectureRow) => (r.timeStart || "").padStart(5, "0");
        const cmp = (a: LectureRow, b: LectureRow) => {
            switch (sort.key) {
                case "time": return tm(a).localeCompare(tm(b)) || a.date.localeCompare(b.date);
                case "subject": return a.subject.localeCompare(b.subject) || (a.date + tm(a)).localeCompare(b.date + tm(b));
                case "report": return REPORT_ORDER[a.report] - REPORT_ORDER[b.report] || (a.date + tm(a)).localeCompare(b.date + tm(b));
                default: return (a.date + tm(a)).localeCompare(b.date + tm(b));
            }
        };
        return [...list].sort((a, b) => cmp(a, b) * sort.dir);
    }, [rows, search, quick, f, sort]);

    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const cur = Math.min(page, pages);
    const slice = filtered.slice((cur - 1) * pageSize, cur * pageSize);
    const fromN = filtered.length ? (cur - 1) * pageSize + 1 : 0;
    const toN = Math.min(cur * pageSize, filtered.length);
    const activeFilters = Object.values(f).filter(Boolean).length + (search ? 1 : 0);
    const clearAll = () => { setF({ date: "", course: "", semester: "", section: "", type: "", report: "", notes: "", assignment: "" }); setSearch(""); setQuick("ALL"); };

    const toggleSort = (key: SortKey) => setSort(s => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 });
    const sortTh = (k: SortKey, children: ReactNode, className = "") => {
        const on = sort.key === k;
        const Icon = on ? (sort.dir === 1 ? ChevronUp : ChevronDown) : ChevronsUpDown;
        return (
            <th key={k} className={`${th} ${className}`} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-white transition-colors ${on ? "text-emerald-300" : ""}`} data-testid={`sort-${k}`}>
                    {children}<Icon size={12} className={on ? "" : "opacity-40"} />
                </button>
            </th>
        );
    };

    const sel = "h-8 w-full px-2 bg-zinc-950/70 border border-zinc-800 rounded-lg text-[11px] font-semibold text-zinc-200 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]";
    const select = (label: string, k: keyof typeof f, opts: [string, string][]) => (
        <label key={k} className="min-w-0 space-y-1">
            <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
            <select value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} className={sel} data-testid={`filter-${k}`}>
                <option value="">All</option>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </label>
    );
    const same = (vals: string[]) => vals.map(v => [v, v] as [string, string]);

    return (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden" data-testid="lecture-table">
            {/* ── Toolbar ── */}
            <div className="p-3 border-b border-zinc-800/80 space-y-3">
                {toolbarTop && <div className="flex flex-wrap items-center gap-2" data-testid="toolbar-top">{toolbarTop}</div>}
                <div className={toolbarStart ? "flex flex-wrap items-end gap-2.5" : "flex flex-col lg:flex-row lg:items-center gap-2.5"}>
                    {toolbarStart && <div className="flex flex-wrap items-end gap-2 min-w-0" data-testid="toolbar-start">{toolbarStart}</div>}
                    {showQuick && variant === "report" && (
                        <div className="flex flex-wrap gap-1.5 w-fit max-w-full" role="tablist" data-testid="quick-filters">
                            {QUICK.map(q => {
                                const Icon = QUICK_ICON[q.k];
                                const on = quick === q.k;
                                return (
                                    <button key={q.k} role="tab" aria-selected={on} onClick={() => setQuick(q.k)} data-testid={`quick-${q.k}`}
                                        className={`h-8 px-2.5 rounded-lg border text-[11.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${on ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:text-white hover:border-zinc-700"}`}>
                                        <Icon size={13} className="shrink-0" /> <span>{q.label} <span className="tabular-nums text-zinc-400">({quickCounts[q.k]})</span></span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {showQuick && variant !== "report" && (
                        <div className="flex flex-wrap gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-950/40 w-fit max-w-full" role="tablist" data-testid="quick-filters">
                            {QUICK.map(q => (
                                <button key={q.k} role="tab" aria-selected={quick === q.k} onClick={() => setQuick(q.k)} data-testid={`quick-${q.k}`}
                                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${quick === q.k ? q.on : "text-zinc-400 hover:text-white"}`}>
                                    {q.label}
                                    <span className={`text-[10px] tabular-nums px-1.5 rounded ${quick === q.k ? "bg-black/30" : "bg-zinc-800"}`}>{quickCounts[q.k]}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className={`flex items-center gap-2 lg:ml-auto min-w-0 ${toolbarStart ? "ml-auto w-full sm:w-auto" : ""}`}>
                        <div className={`relative flex-1 min-w-0 ${toolbarStart ? "sm:w-52 sm:flex-none" : variant === "report" ? "lg:w-60" : "lg:w-72"}`}>
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={variant === "report" ? "Search by subject, topic or unit..." : showProfessor ? "Search professor, subject or topic" : "Search subject or topic"}
                                className="h-8 w-full pl-8 pr-7 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50" data-testid="table-search" />
                            {search && <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white" aria-label="Clear search"><X size={13} /></button>}
                        </div>
                        {board && (
                            <div className="shrink-0 flex p-0.5 rounded-lg border border-zinc-800 bg-zinc-950/40" role="tablist" aria-label="View" data-testid="view-toggle">
                                {([["sheet", "Sheet", Table2], ["board", "Board", KanbanSquare]] as const).map(([v, l, Icon]) => (
                                    <button key={v} role="tab" aria-selected={view === v} onClick={() => changeView(v)} data-testid={`view-${v}`} title={v === "sheet" ? "Sheet view (one row per lecture)" : "Board view (cards by status)"}
                                        className={`h-7 px-2 rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${view === v ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400 hover:text-white"}`}>
                                        <Icon size={13} /><span className={toolbarStart ? "sr-only" : "hidden sm:inline"}>{l}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={() => setShowFilters(v => !v)} data-testid="toggle-filters" aria-expanded={showFilters}
                            className={`shrink-0 h-8 px-3 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${showFilters || activeFilters ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:text-white"}`}>
                            <SlidersHorizontal size={13} /> Filters{activeFilters ? ` (${activeFilters})` : ""}
                        </button>
                        {toolbarExtra}
                    </div>
                </div>
                <HowItWorks />
                {showFilters && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 pt-1" data-testid="filter-panel">
                        {select("Date", "date", options.date.map(d => [d, `${fmtDay(d)}, ${fmtDate(d)}`]))}
                        {select("Course", "course", same(options.course))}
                        {select("Semester", "semester", same(options.semester))}
                        {select("Section", "section", same(options.section))}
                        {select("Type", "type", same(options.type))}
                        {select("Report", "report", [["PENDING", "Report Pending"], ["SUBMITTED", "Submitted / Verified"], ["REVERTED", "Reverted"], ["IN_PROGRESS", "In Progress"], ["SCHEDULED", "Scheduled"]])}
                        {select("Notes", "notes", [["UPLOADED", "Uploaded"], ["PENDING", "Pending"], ["MISSING", "Reason given"], ["NOT_YET", "Not due yet"]])}
                        {select("Assignment", "assignment", [["UPLOADED", "Added"], ["NONE", "Not added"]])}
                        {activeFilters > 0 && (
                            <button onClick={clearAll} className="col-span-2 sm:col-span-4 xl:col-span-8 justify-self-start text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-1" data-testid="clear-filters">
                                <X size={12} /> Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Body ── */}
            {loading ? (
                <div className="divide-y divide-zinc-800/60" aria-busy="true" data-testid="table-loading">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-11 px-4 flex items-center gap-4">
                            <div className="h-2.5 w-6 rounded bg-zinc-800 animate-pulse" />
                            <div className="h-2.5 w-24 rounded bg-zinc-800 animate-pulse" />
                            <div className="h-2.5 flex-1 max-w-xs rounded bg-zinc-800 animate-pulse" />
                            <div className="h-5 w-24 rounded-md bg-zinc-800 animate-pulse ml-auto" />
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-14 px-6 text-center" data-testid="table-empty">
                    <div className="w-12 h-12 rounded-full bg-zinc-800/60 flex items-center justify-center mx-auto mb-3"><BookOpen size={20} className="text-zinc-500" /></div>
                    <p className="text-sm font-bold text-white">{rows.length === 0 ? emptyText : "No lectures match these filters."}</p>
                    {rows.length > 0 && <button onClick={clearAll} className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300">Clear filters</button>}
                </div>
            ) : isBoard ? (
                /* Board (Notion-style): one lane per step; cards keep the same actions as the sheet rows */
                <div className="overflow-x-auto custom-scrollbar p-3" data-testid="board">
                    <div className="flex gap-3 items-start" style={{ width: "max-content", minWidth: "100%" }}>
                        {LANES.map(lane => {
                            const items = filtered.filter(lane.test);
                            return (
                                <section key={lane.k} className="w-[264px] sm:w-[280px] shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/40 flex flex-col max-h-[calc(100dvh-280px)] min-h-[160px]" data-testid="board-lane" data-lane={lane.k}>
                                    <header className={`shrink-0 px-3 py-2 rounded-t-xl border-b ${lane.head}`}>
                                        <p className="text-[11px] font-black uppercase tracking-wider flex items-center justify-between gap-2">{lane.label}<span className="tabular-nums text-[11px] px-1.5 rounded bg-black/30" data-testid="lane-count">{items.length}</span></p>
                                        <p className="text-[10px] font-semibold text-zinc-500 normal-case">{lane.hint}</p>
                                    </header>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                                        {items.slice(0, LANE_LIMIT).map(r => (
                                            <article key={r.key} data-testid="board-card" data-report={r.report} className={`rounded-lg border p-2.5 space-y-1.5 cursor-pointer transition-colors ${activeKey === r.key ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700"}`}
                                                onClick={() => onOpen(r)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") onOpen(r); }}>
                                                <p className="text-[10.5px] text-zinc-400 tabular-nums flex items-center justify-between gap-2"><span>{fmtDay(r.date)}, {fmtDate(r.date)}</span><span className="text-zinc-300 font-semibold">{r.timeStart}{r.timeStop ? `–${r.timeStop}` : ""}</span></p>
                                                <p className="text-[13px] font-bold text-white leading-snug [overflow-wrap:anywhere]">{r.subject}</p>
                                                {showProfessor && r.facultyName && <p className="text-[11px] font-semibold text-zinc-300 truncate">{r.facultyName}</p>}
                                                {r.topic && <p className="text-[11px] text-zinc-500 line-clamp-2">{r.topic}</p>}
                                                <div className="flex items-center justify-between gap-2 pt-0.5"><StepsTracker row={r} compact /><ReportBadge row={r} /></div>
                                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/80" onClick={e => e.stopPropagation()}>{renderActions(r)}</div>
                                            </article>
                                        ))}
                                        {items.length > LANE_LIMIT && <p className="text-[10.5px] text-zinc-500 text-center py-1">+{items.length - LANE_LIMIT} more — narrow the dates / filters or use Sheet view</p>}
                                        {!items.length && <p className="text-[10.5px] text-zinc-600 text-center py-4">Nothing here</p>}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                    {variant === "report" && showPlanDetails ? (
                    /* Lecture Reports: every sprint-plan field in its own column (scroll right).
                       Date + Subject stay on the left, only Actions stays on the right; Report Status scrolls. */
                    <div className="overflow-auto max-h-[calc(100dvh-240px)] min-h-[200px] custom-scrollbar" style={{ display: isMd ? "block" : "none" }} data-testid="table-scroll">
                        <table className="table-fixed border-separate border-spacing-0 text-left" style={{ width: "max-content", minWidth: "100%" }} data-testid="plan-table">
                            <thead>
                                <tr>
                                    {sortTh("date", "Date", "w-[110px] left-0 !z-30")}
                                    {sortTh("subject", "Subject", `w-[200px] left-[110px] !z-30 ${profFrozen ? "" : "shadow-[8px_0_12px_-8px_rgba(0,0,0,0.6)]"}`)}
                                    {/* manager views: Professor stays frozen with Date + Subject (≥ 1280px; smaller screens keep the room for scrolling) */}
                                    {showProfessor && <th className={`${th} w-[150px] ${profFrozen ? "left-[310px] !z-30 shadow-[8px_0_12px_-8px_rgba(0,0,0,0.6)]" : ""}`} data-col="professor-head">Professor</th>}
                                    {sortTh("report", "Report Status", "w-[164px]")}
                                    <th className={`${th} w-[196px]`} title="Report → OM → CL / CH / HOI">Steps</th>
                                    {sortTh("time", "Time", "w-[120px]")}
                                    {PLAN_COLS.map(c => <th key={c.k} className={`${th} ${c.w}`}>{c.label}</th>)}
                                    <th className={`${th} w-[112px]`}>Attendance</th>
                                    <th className={`${th} w-[110px]`}>Notes</th>
                                    <th className={`${th} w-[96px]`}>Assignment</th>
                                    <th className={`${th} w-[120px]`} title="OM verification">OM Verified</th>
                                    <th className={`${th} w-[150px]`} title="Final verification by any one of CL / CH / HOI">CL/CH/HOI Verified</th>
                                    <th className={`${th} ${pinTh} w-[150px] text-center`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slice.map(r => {
                                    const active = activeKey === r.key;
                                    const pct = typeof r.present === "number" && r.total ? Math.min(100, Math.round((r.present / r.total) * 100)) : null;
                                    const rowBg = active ? "bg-[#0c1a15]" : "bg-[#0d0d10] group-hover:bg-[#151518]";
                                    return (
                                        <tr key={r.key} onClick={() => onOpen(r)} data-testid="lecture-row" data-report={r.report} className="group cursor-pointer [&>td]:py-2.5">
                                            <td className={`${td} ${stickL0} ${rowBg}`}>
                                                <span className="block text-zinc-100 font-medium whitespace-nowrap">{fmtDay(r.date)}, {fmtDate(r.date).slice(0, 6)}</span>
                                                <span className="block text-[10.5px] text-zinc-500">{r.date.slice(0, 4)}</span>
                                            </td>
                                            <td className={`${td} ${stickL1} ${rowBg} ${profFrozen ? "" : "shadow-[8px_0_12px_-8px_rgba(0,0,0,0.6)]"}`}>
                                                <span className="font-semibold text-[12.5px] text-white leading-[17px] line-clamp-2 [overflow-wrap:anywhere]" title={r.subject}>{r.subject}</span>
                                            </td>
                                            {showProfessor && <td className={`${td} ${profFrozen ? `sticky left-[310px] z-[2] ${rowBg} shadow-[8px_0_12px_-8px_rgba(0,0,0,0.6)]` : ""}`} data-col="professor"><span className="block font-semibold text-zinc-200 [overflow-wrap:anywhere]">{r.facultyName || "—"}</span></td>}
                                            <td className={td} data-col="status"><ReportBadge row={r} /></td>
                                            <td className={td} data-col="steps"><StepsTracker row={r} /></td>
                                            <td className={`${td} whitespace-nowrap tabular-nums`}>
                                                <span className="block text-zinc-100 font-medium">{r.timeStart || "—"}{r.timeStop ? ` – ${r.timeStop}` : ""}</span>
                                                <span className="block text-[10.5px] text-zinc-500">{durationMin(r) ? `${durationMin(r)} min` : ""}</span>
                                            </td>
                                            {PLAN_COLS.map(c => {
                                                const v = c.get(r);
                                                return (
                                                    <td key={c.k} className={`${td} align-top`} data-col={c.k}>
                                                        {c.k === "unit" && v ? <span className="px-1.5 h-[18px] inline-flex items-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px]">Unit {v}</span>
                                                            : c.k === "type" && v ? <span className={`${pill} ${typeCls(v)}`}>{v}</span>
                                                                : <span className={`block text-zinc-200 whitespace-pre-wrap [overflow-wrap:anywhere] ${c.wrap ? "text-[11.5px] leading-[16px]" : ""}`}>{v || <span className="text-zinc-600">—</span>}</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className={td}>
                                                {pct !== null ? (
                                                    <div title={`${pct}% attendance`}>
                                                        <div className="flex items-center justify-between gap-1 leading-4">
                                                            <span className={`flex items-center gap-1 tabular-nums font-semibold ${pct < 50 ? "text-amber-300" : "text-zinc-100"}`}><Users size={12} className="text-zinc-500" />{r.present} / {r.total}</span>
                                                            <span className="text-[10.5px] text-zinc-400 tabular-nums">{pct}%</span>
                                                        </div>
                                                        <span className="block h-1.5 mt-1.5 w-full rounded-full bg-zinc-800 overflow-hidden"><span className={`block h-full rounded-full ${pct < 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></span>
                                                    </div>
                                                ) : <span className="text-zinc-600">—</span>}
                                            </td>
                                            <td className={td}><NotesBadge row={r} /></td>
                                            <td className={td}><AssignmentBadge row={r} /></td>
                                            <td className={td} data-col="om"><StepBadge state={r.omState} by={r.omBy} testId="om-step" /></td>
                                            <td className={td} data-col="final"><StepBadge state={r.finalState} by={r.finalBy} testId="final-step" /></td>
                                            <td className={`${td} ${pinTd} px-2 ${active ? "bg-[#0c1a15]" : ""}`} onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">{renderActions(r)}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    ) : variant === "report" ? (
                    /* Report design (My Lectures / Lecture Reports): sized by its box —
                         ≥ 1280px  all columns · 1000–1279 no # / Assignment column (assignment icon next to Notes)
                         < 1000    Section joins Course / Unit, compact attendance; Report Status + Actions pinned right */
                    <div className="@container overflow-auto max-h-[calc(100dvh-240px)] min-h-[200px] custom-scrollbar" style={{ display: isMd ? "block" : "none" }} data-testid="table-scroll">
                        <table className="w-full table-fixed min-w-[820px] border-separate border-spacing-0 text-left">
                            <thead>
                                <tr>
                                    <th className={`${th} ${wide} w-10 text-center`}>#</th>
                                    {showProfessor && <th className={`${th} ${wide} w-[120px]`}>Professor</th>}
                                    {sortTh("date", "Date", "w-[104px]")}
                                    {sortTh("time", "Time", "w-[118px]")}
                                    {sortTh("subject", "Subject", "")}
                                    <th className={`${th} w-[19%]`}>Course / Unit</th>
                                    <th className={`${th} ${wide} w-[52px] text-center`} title="Section">Sec.</th>
                                    <th className={`${th} w-[84px] @min-[1000px]:w-[108px]`}><span className="@min-[1000px]:hidden">Attend.</span><span className="hidden @min-[1000px]:inline">Attendance</span></th>
                                    {sortTh("report", "Report Status", `w-[136px] ${pinReportTh}`)}
                                    <th className={`${th} ${mid} w-[96px]`} title="Report → OM → CL / CH / HOI">Steps</th>
                                    <th className={`${th} w-[120px] @min-[1280px]:w-[104px]`}>Notes</th>
                                    <th className={`${th} ${wide} w-[96px]`}>Assignment</th>
                                    <th className={`${th} ${pinTh} w-[132px] text-center`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slice.map((r, i) => {
                                    const active = activeKey === r.key;
                                    const pct = typeof r.present === "number" && r.total ? Math.min(100, Math.round((r.present / r.total) * 100)) : null;
                                    return (
                                        <tr key={r.key} onClick={() => onOpen(r)} data-testid="lecture-row" data-report={r.report}
                                            className={`group cursor-pointer transition-colors ${active ? "bg-emerald-500/[0.07]" : "hover:bg-zinc-800/40"} [&>td]:py-2.5`}>
                                            <td className={`${td} ${wide} text-center text-zinc-400 font-semibold tabular-nums`}>{r.lectureNumber || (cur - 1) * pageSize + i + 1}</td>
                                            {showProfessor && <td className={`${td} ${wide}`}><span className="block truncate font-semibold text-zinc-200" title={r.facultyName}>{r.facultyName || "—"}</span></td>}
                                            <td className={td}>
                                                <div className="flex items-start gap-1.5 whitespace-nowrap">
                                                    <Calendar size={13} className="text-zinc-500 mt-0.5 shrink-0" />
                                                    <div className="leading-4"><span className="block text-zinc-100 font-medium">{fmtDay(r.date)}, {fmtDate(r.date).slice(0, 6)}</span><span className="block text-[10.5px] text-zinc-500">{r.date.slice(0, 4)}</span></div>
                                                </div>
                                            </td>
                                            <td className={td}>
                                                <div className="flex items-start gap-1.5 whitespace-nowrap">
                                                    <Clock size={13} className="text-zinc-500 mt-0.5 shrink-0" />
                                                    <div className="leading-4 tabular-nums"><span className="block text-zinc-100 font-medium whitespace-nowrap">{r.timeStart || "—"}{r.timeStop ? ` – ${r.timeStop}` : ""}</span><span className="block text-[10.5px] text-zinc-500">{durationMin(r) ? `${durationMin(r)} min` : ""}</span></div>
                                                </div>
                                            </td>
                                            <td className={td}>
                                                <span className="font-semibold text-[12.5px] text-white leading-[17px] line-clamp-2 [overflow-wrap:anywhere]" title={[r.subject, r.subjectCode].filter(Boolean).join(" · ")}>{r.subject}</span>
                                                {showProfessor && r.facultyName && <span className="block truncate text-[10.5px] text-zinc-400 @min-[1280px]:hidden">{r.facultyName}</span>}
                                            </td>
                                            <td className={td}>
                                                <span className="flex items-center gap-1.5 min-w-0" title={[r.unit ? `Unit ${r.unit}` : "", r.course, semLine(r), r.section ? `Sec ${r.section}` : ""].filter(Boolean).join(" · ")}>
                                                    {r.unit && <span className="shrink-0 px-1.5 h-[18px] inline-flex items-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px]">Unit {r.unit}</span>}
                                                    <span className="truncate text-[10.5px] text-zinc-500">{[r.course, r.semester ? (/^sem/i.test(r.semester) ? r.semester : `Sem ${r.semester}`) : ""].filter(Boolean).join(" · ")}{r.section && <span className="@min-[1280px]:hidden"> · Sec {r.section}</span>}</span>
                                                </span>
                                                <span className="block truncate text-[11px] text-zinc-300 mt-0.5" title={r.topic || ""}>{r.topic || "—"}</span>
                                            </td>
                                            <td className={`${td} ${wide} text-center text-zinc-200 font-semibold`}>{r.section || "—"}</td>
                                            <td className={td}>
                                                {pct !== null ? (
                                                    <div title={`${pct}% attendance`}>
                                                        <div className="flex items-center justify-between gap-1 leading-4">
                                                            <span className={`flex items-center gap-1 tabular-nums font-semibold ${pct < 50 ? "text-amber-300" : "text-zinc-100"}`}><Users size={12} className="text-zinc-500" />{r.present} / {r.total}</span>
                                                            <span className="hidden @min-[1000px]:inline text-[10.5px] text-zinc-400 tabular-nums">{pct}%</span>
                                                        </div>
                                                        <span className="block h-1.5 mt-1.5 w-full rounded-full bg-zinc-800 overflow-hidden"><span className={`block h-full rounded-full ${pct < 50 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></span>
                                                    </div>
                                                ) : <span className="text-zinc-600">—</span>}
                                            </td>
                                            <td className={`${td} ${pinReportTd} ${active ? "@max-[999px]:bg-[#0c1a15]" : ""}`}><ReportBadge row={r} /></td>
                                            <td className={`${td} ${mid}`}><StepsTracker row={r} compact /></td>
                                            <td className={td}>
                                                <span className="flex items-center gap-1">
                                                    <NotesBadge row={r} />
                                                    {r.assignment === "UPLOADED" && <span className="@min-[1280px]:hidden inline-flex items-center h-[22px] px-1 rounded-md border bg-violet-500/10 text-violet-300 border-violet-500/25" title="Assignment added"><ClipboardList size={11} /></span>}
                                                </span>
                                            </td>
                                            <td className={`${td} ${wide}`}><AssignmentBadge row={r} /></td>
                                            <td className={`${td} ${pinTd} px-2 ${active ? "bg-[#0c1a15]" : ""}`} onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">{renderActions(r)}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    ) : (<>
                    {/* Desktop / tablet: fixed-layout table sized by its container (the app zooms 1.1× on desktop):
                          ≥ 1280px  all columns
                          1000–1279 no #, Day, Type, Topic (topic / unit under the subject)
                          < 1000    Section joins Course, Assignment joins Notes, Professor under the subject;
                                    Report Status + Actions stay pinned on the right while the rest scrolls */}
                    <div className="@container overflow-auto max-h-[calc(100dvh-260px)] min-h-[200px] custom-scrollbar" style={{ display: isMd ? "block" : "none" }} data-testid="table-scroll">
                        <table className="w-full table-fixed min-w-[820px] border-separate border-spacing-0 text-left">
                            <thead>
                                <tr>
                                    <th className={`${th} ${wide} w-9 text-center`}>#</th>
                                    {showProfessor && <th className={`${th} ${wide} w-[120px]`}>Professor</th>}
                                    {sortTh("date", "Date", "w-[84px] @min-[1000px]:w-[90px] @min-[1280px]:w-[96px]")}
                                    <th className={`${th} ${wide} w-11`}>Day</th>
                                    {sortTh("time", "Time", "w-[80px] @min-[1000px]:w-[86px]")}
                                    {sortTh("subject", "Subject", "")}
                                    <th className={`${th} ${wide} w-[18%]`}>Topic</th>
                                    <th className={`${th} w-[96px] @min-[1000px]:w-[100px]`}>Course / Sem</th>
                                    <th className={`${th} ${mid} w-[48px]`} title="Section">Sec.</th>
                                    <th className={`${th} ${wide} w-[84px]`}>Type</th>
                                    <th className={`${th} w-[72px] @min-[1000px]:w-[94px]`}><span className="@min-[1000px]:hidden">Attend.</span><span className="hidden @min-[1000px]:inline">Attendance</span></th>
                                    {sortTh("report", "Report Status", `w-[118px] @min-[1000px]:w-[126px] ${pinReportTh}`)}
                                    <th className={`${th} ${mid} w-[96px]`} title="Report → OM → CL / CH / HOI">Steps</th>
                                    <th className={`${th} w-[104px] @min-[1000px]:w-[96px]`}><span className="@min-[1000px]:hidden">Notes / Asg.</span><span className="hidden @min-[1000px]:inline">Notes</span></th>
                                    <th className={`${th} ${mid} w-[92px]`}>Assignment</th>
                                    <th className={`${th} ${pinTh} w-[132px] text-right pr-3`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slice.map((r, i) => {
                                    const active = activeKey === r.key;
                                    return (
                                        <tr key={r.key} onClick={() => onOpen(r)} data-testid="lecture-row" data-report={r.report}
                                            className={`group h-10 cursor-pointer transition-colors ${active ? "bg-emerald-500/[0.07]" : "hover:bg-zinc-800/40"}`}>
                                            <td className={`${td} ${wide} text-center text-zinc-500 tabular-nums`}>{r.lectureNumber || (cur - 1) * pageSize + i + 1}</td>
                                            {showProfessor && <td className={`${td} ${wide}`}><span className="block truncate font-semibold text-zinc-200" title={r.facultyName}>{r.facultyName || "—"}</span></td>}
                                            <td className={`${td} whitespace-nowrap tabular-nums text-zinc-200`} title={`${fmtDay(r.date)}, ${fmtDate(r.date)}`}>
                                                <span className="@min-[1280px]:hidden"><span className="text-zinc-500">{fmtDay(r.date)}</span> {fmtDate(r.date).slice(0, 6)}</span>
                                                <span className="hidden @min-[1280px]:inline">{fmtDate(r.date)}</span>
                                            </td>
                                            <td className={`${td} ${wide} text-zinc-400`}>{fmtDay(r.date)}</td>
                                            <td className={`${td} whitespace-nowrap tabular-nums`}>
                                                <span className="block text-zinc-200 leading-4">{r.timeStart || "—"}{r.timeStop ? `–${r.timeStop}` : ""}</span>
                                                {durationMin(r) ? <span className="block text-[10px] leading-[13px] text-zinc-500">{durationMin(r)} min</span> : null}
                                            </td>
                                            <td className={td}>
                                                <span className="block truncate font-bold text-white leading-4" title={[r.subject, r.subjectCode, r.topic].filter(Boolean).join(" · ")}>{r.subject}</span>
                                                {/* Topic under the subject when the Topic column is hidden (laptop widths) */}
                                                {(r.unit || r.topic || (showProfessor && r.facultyName)) && (
                                                    <span className="flex items-center gap-1 min-w-0 text-[10.5px] leading-[14px] text-zinc-500" title={[showProfessor ? r.facultyName : "", r.unit ? `Unit ${r.unit}` : "", r.topic].filter(Boolean).join(" · ")}>
                                                        {/* Professor column is hidden below 1280px: name goes here */}
                                                        {showProfessor && r.facultyName && <span className="shrink-0 max-w-[55%] truncate font-semibold text-zinc-300 @min-[1280px]:hidden">{r.facultyName}</span>}
                                                        {r.unit && <span className="shrink-0 px-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-bold text-[9.5px] leading-[13px]">Unit {r.unit}</span>}
                                                        {r.topic && <span className="truncate @min-[1280px]:hidden">{r.topic}</span>}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`${td} ${wide}`}><span className="block truncate text-zinc-400" title={r.topic || ""}>{r.topic || "—"}</span></td>
                                            <td className={td}>
                                                <span className="block truncate text-zinc-200" title={[r.course, semLine(r)].filter(Boolean).join(" · ")}>
                                                    {r.course || "—"}{r.semester && <span className="text-zinc-500"> · {/^sem/i.test(r.semester) ? r.semester : `Sem ${r.semester}`}</span>}
                                                    {r.section && <span className="text-zinc-500 @min-[1000px]:hidden"> · {r.section}</span>}
                                                </span>
                                            </td>
                                            <td className={`${td} ${mid} text-zinc-300 truncate`}>{r.section || "—"}</td>
                                            <td className={`${td} ${wide}`}>{r.type ? <span className={`${pill} ${typeCls(r.type)} max-w-full`} title={r.type}><span className="truncate">{r.type}</span></span> : <span className="text-zinc-600">—</span>}</td>
                                            <td className={td}>
                                                {typeof r.present === "number" && r.total
                                                    ? <div title={`${Math.round((r.present / r.total) * 100)}% attendance`}>
                                                        <span className={`flex items-center gap-1 tabular-nums font-bold leading-4 ${r.present / r.total < 0.5 ? "text-amber-300" : "text-zinc-100"}`}><Users size={12} className="text-zinc-500" />{r.present}/{r.total}</span>
                                                        <span className="block h-1 mt-1 w-full max-w-[64px] rounded-full bg-zinc-800 overflow-hidden"><span className={`block h-full rounded-full ${r.present / r.total < 0.5 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (r.present / r.total) * 100)}%` }} /></span>
                                                    </div>
                                                    : <span className="text-zinc-600 text-[11px] whitespace-nowrap">Not marked</span>}
                                            </td>
                                            <td className={`${td} ${pinReportTd} ${active ? "@max-[999px]:bg-[#0c1a15]" : ""}`}><ReportBadge row={r} /></td>
                                            <td className={`${td} ${mid}`}><StepsTracker row={r} compact /></td>
                                            <td className={td}>
                                                <span className="flex items-center gap-1">
                                                    <NotesBadge row={r} />
                                                    {/* Assignment column is hidden below 1000px */}
                                                    {r.assignment === "UPLOADED" && <span className="@min-[1000px]:hidden inline-flex items-center h-[22px] px-1 rounded-md border bg-violet-500/10 text-violet-300 border-violet-500/25" title="Assignment added"><ClipboardList size={11} /></span>}
                                                </span>
                                            </td>
                                            <td className={`${td} ${mid}`}><AssignmentBadge row={r} /></td>
                                            <td className={`${td} ${pinTd} pr-3 ${active ? "bg-[#0c1a15]" : ""}`} onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">{renderActions(r)}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>)}

                    {/* Phone: one compact row per lecture, the important columns only */}
                    <ul className="divide-y divide-zinc-800/70" style={{ display: isMd ? "none" : "block" }} data-testid="lecture-list-mobile">
                        {slice.map(r => (
                            <li key={r.key} data-testid="lecture-row-mobile" className={activeKey === r.key ? "bg-emerald-500/[0.07]" : ""}>
                                <div role="button" tabIndex={0} onClick={() => onOpen(r)} onKeyDown={e => { if (e.key === "Enter") onOpen(r); }} className="px-3 py-2.5 space-y-1.5 active:bg-zinc-800/40">
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 tabular-nums">
                                        <span className="font-bold text-zinc-300">#{r.lectureNumber || "—"}</span>
                                        <span>{fmtDay(r.date)} {fmtDate(r.date)}</span>
                                        <span className="ml-auto whitespace-nowrap text-zinc-200 font-semibold">{r.timeStart}{r.timeStop ? `–${r.timeStop}` : ""}</span>
                                    </div>
                                    <p className="text-[13px] font-bold text-white truncate">{showProfessor && r.facultyName ? <span className="text-zinc-400 font-semibold">{r.facultyName} · </span> : null}{r.subject}</p>
                                    {r.topic && <p className="text-[11px] text-zinc-500 truncate">{r.topic}</p>}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <ReportBadge row={r} />
                                        <StepsTracker row={r} compact />
                                        {r.notes !== "NOT_YET" && <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">Notes <NotesBadge row={r} /></span>}
                                        {r.assignment === "UPLOADED" && <AssignmentBadge row={r} />}
                                    </div>
                                </div>
                                <div className="px-3 pb-2.5 flex flex-wrap items-center gap-1.5">{renderActions(r)}</div>
                            </li>
                        ))}
                    </ul>

                    {/* ── Pagination (sheet) ── */}
                    <div className="px-3 py-2.5 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <span data-testid="table-count">Showing <b className="text-zinc-200 tabular-nums">{fromN}–{toN}</b> of <b className="text-zinc-200 tabular-nums">{filtered.length}</b> {itemLabel}{filtered.length === 1 ? "" : "s"}{filtered.length !== rows.length ? <span className="text-zinc-500"> (filtered from {rows.length})</span> : null}</span>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5">{variant === "report" ? "Rows per page:" : "Items per page"}
                                <select value={pageSize} onChange={e => changePageSize(parseInt(e.target.value))} className="h-7 px-1.5 bg-zinc-950/70 border border-zinc-800 rounded-md text-[11px] text-zinc-200 [color-scheme:dark]" data-testid="page-size">
                                    {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </label>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur <= 1} className="h-7 w-7 rounded-md border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Previous page" data-testid="page-prev"><ChevronLeft size={14} /></button>
                            <span className="sr-only" data-testid="page-label">Page {cur} / {pages}</span>
                            {pageList(cur, pages).map((n, i) => n === 0
                                ? <span key={`gap${i}`} className="w-5 text-center text-zinc-600">…</span>
                                : <button key={n} onClick={() => setPage(n)} aria-current={n === cur ? "page" : undefined} data-testid={`page-${n}`}
                                    className={`h-7 min-w-7 px-1.5 rounded-md border text-[11px] font-bold tabular-nums transition-colors ${n === cur ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>{n}</button>)}
                            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={cur >= pages} className="h-7 w-7 rounded-md border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next page" data-testid="page-next"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const th = "sticky top-0 z-10 h-9 px-2.5 bg-zinc-900 border-b border-zinc-800 text-[10px] font-black uppercase tracking-wide text-zinc-500 whitespace-nowrap overflow-hidden text-ellipsis";
const td = "px-2.5 py-1 border-b border-zinc-800/60 text-xs align-middle overflow-hidden";
/** Shown only when the table has room (container ≥ 1280px) */
const wide = "hidden @min-[1280px]:table-cell";
/** Shown from 1000px; below that the value is folded into a neighbouring cell */
const mid = "hidden @min-[1000px]:table-cell";
/** Below 1000px the Report Status column is pinned too, just left of Actions (132px) */
const pinReportTh = "@max-[999px]:right-[132px] @max-[999px]:z-20";
const pinReportTd = "@max-[999px]:sticky @max-[999px]:right-[132px] @max-[999px]:z-[1] @max-[999px]:bg-[#0d0d10] @max-[999px]:group-hover:bg-[#151518]";
/** Actions column pinned on the right while the table scrolls sideways */
const pinTh = "right-0 z-20 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)]";
const pinTd = "sticky right-0 z-[1] bg-[#0d0d10] group-hover:bg-[#151518] shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)] overflow-visible";

// ───────────────────────────── row action button ─────────────────────────────

export function RowButton({ tone = "default", icon: Icon, children, title, onClick, disabled, testId }: {
    tone?: "primary" | "warn" | "default" | "ghost"; icon?: any; children?: ReactNode; title?: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; testId?: string;
}) {
    const cls = tone === "primary" ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40"
        : tone === "warn" ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 border-amber-400/50"
            : tone === "ghost" ? "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white border-transparent"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 border-zinc-700";
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={!children ? title : undefined} data-testid={testId}
            className={`h-7 ${children ? "px-2.5" : "w-7 justify-center"} inline-flex items-center gap-1 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
            {Icon && <Icon size={13} />}{children}
        </button>
    );
}

// ───────────────────────────── details drawer ─────────────────────────────

export function LectureDrawer({ row, onClose, children, actions }: { row: LectureRow | null; onClose: () => void; children?: ReactNode; actions?: ReactNode }) {
    useEffect(() => {
        if (!row) return;
        const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", k);
        return () => window.removeEventListener("keydown", k);
    }, [row, onClose]);
    if (!row) return null;
    return (
        <div className="fixed inset-0 z-[95] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="lecture-drawer-title" data-testid="lecture-drawer">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} />
            <aside className="relative h-full w-full sm:max-w-2xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <header className="shrink-0 px-5 py-4 border-b border-zinc-800 bg-zinc-900/70">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Lecture Details{row.lectureNumber ? ` · #${row.lectureNumber}` : ""}</p>
                            <h2 id="lecture-drawer-title" className="text-lg font-black text-white leading-snug mt-0.5 [overflow-wrap:anywhere]">{row.subject}{row.subjectCode ? <span className="text-zinc-500 font-bold"> ({row.subjectCode})</span> : null}</h2>
                            <p className="text-xs text-zinc-400 mt-0.5">{fmtDay(row.date)}, {fmtDate(row.date)} · {row.timeStart || "—"}{row.timeStop ? `–${row.timeStop}` : ""}{row.facultyName ? ` · ${row.facultyName}` : ""}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <ReportBadge row={row} />
                                {row.recorded && <span className="text-[10.5px] font-semibold text-zinc-400">{CLASS_STATUS_LABEL[row.pipelineStatus || ""]}</span>}
                            </div>
                        </div>
                        <button onClick={onClose} className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5" aria-label="Close" data-testid="drawer-close"><X size={18} /></button>
                    </div>
                    {actions && <div className="flex flex-wrap gap-1.5 mt-3" data-testid="drawer-actions">{actions}</div>}
                </header>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                    <section>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Lecture Information</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px rounded-xl overflow-hidden border border-zinc-800 bg-zinc-800" data-testid="drawer-info">
                            {([
                                ["Subject", row.subject], ["Topic", row.topic], ["Unit", row.unit],
                                ["Course", row.course || row.raw?.stream], ["Semester / Year", [row.semester, row.year].filter(Boolean).join(" / ")], ["Section", row.section],
                                ["College", row.college || row.raw?.college], ["Date", fmtDate(row.date)], ["Type", row.type],
                                ["Start Time", row.timeStart], ["End Time", row.timeStop], ["Attendance", typeof row.present === "number" ? `${row.present} / ${row.total ?? "—"}` : "Not marked"],
                                ...(row.subjectCode ? [["Subject Code", row.subjectCode]] : []), ...(row.className ? [["Class", row.className]] : []), ...(row.content ? [["Content", row.content]] : []),
                            ] as [string, any][]).map(([k, v]) => (
                                <div key={k} className="bg-zinc-900 px-3 py-2 min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{k}</p>
                                    <p className="text-xs text-zinc-200 mt-0.5 [overflow-wrap:anywhere]">{v || "—"}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                    {children}
                </div>
            </aside>
        </div>
    );
}