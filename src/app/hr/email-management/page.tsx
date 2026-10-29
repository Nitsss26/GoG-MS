"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Mail, Shirt, Clock, UserX, LogOut, History, Search, Loader2, AlertTriangle, CheckCircle2, XCircle, Eye, ChevronDown, ChevronLeft, ChevronRight, X, FileText, RefreshCw, Inbox, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import SendEmailButton from "@/components/email-management/SendEmailButton";

/**
 * HR → Email Management (HR, HR Executive, Founder — same access).
 * Dress Code Rejection, Late Clock-In, No Clock-In and No Clock-Out emails are sent from here only, by hand.
 */
type Tab = "dress_code" | "late_clock_in" | "no_clock_in" | "no_clock_out" | "history";
const TABS: { id: Tab; label: string; icon: any; card?: string }[] = [
    { id: "dress_code", label: "Dress Code", icon: Shirt, card: "dress_code" },
    { id: "late_clock_in", label: "Late Clock-In", icon: Clock, card: "late_clock_in" },
    { id: "no_clock_in", label: "No Clock-In", icon: UserX, card: "no_clock_in" },
    { id: "no_clock_out", label: "No Clock-Out", icon: LogOut, card: "no_clock_out" },
    { id: "history", label: "Email History", icon: History },
];
const TAB_HINT: Record<Tab, string> = {
    dress_code: "Rejected dress code submissions. The rejection email (with the reasons, remarks and photo) is sent only when you click Send Email.",
    late_clock_in: "A warning can be sent only after the late clock-in justification is rejected. The level (First / Second / Third…) is worked out when you send, from this month's late clock-ins that still count.",
    no_clock_in: "Employees scheduled to work with no clock-in (today after the 11:59 AM cutoff). Leave, holidays and weekly offs are left out.",
    no_clock_out: "Missing final clock-out of the day. Multi-location visits are not counted — only the last clock-out.",
    history: "Every email sent from Email Management — who sent it, when, and whether it was delivered.",
};
const STATUS_OPTIONS: Record<string, [string, string][]> = {
    default: [["", "All statuses"], ["not_sent", "Not Sent"], ["sending", "Sending"], ["sent", "Sent"], ["failed", "Failed"], ["not_required", "Not Required"]],
    late_clock_in: [["", "All statuses"], ["not_sent", "Not Sent"], ["sending", "Sending"], ["sent", "Sent"], ["failed", "Failed"], ["not_required", "Not Required"], ["pending_review", "Pending Justification Review"], ["awaiting_justification", "Awaiting Justification"]],
    history: [["", "All statuses"], ["sent", "Sent"], ["failed", "Failed"]],
};
const CATEGORY_OPTIONS: [string, string][] = [["", "All categories"], ["dress_code", "Dress Code Rejection"], ["late_clock_in", "Late Clock-In"], ["no_clock_in", "No Clock-In"], ["no_clock_out", "No Clock-Out"]];
const PAGE_SIZE = 20;

const TZ = "Asia/Kolkata";
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const shortDate = (ymd?: string) => (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : ymd || "—");
const tsDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }) : "—");
const tsTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: TZ }) : "—");
const t12 = (t?: string) => {
    if (!t) return "—";
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h)) return t;
    return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const STATUS_STYLE: Record<string, string> = {
    not_sent: "text-zinc-300 bg-zinc-800/80 border-zinc-700",
    sending: "text-sky-300 bg-sky-500/10 border-sky-500/30",
    sent: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    failed: "text-red-300 bg-red-500/10 border-red-500/30",
    not_required: "text-zinc-500 bg-zinc-900 border-zinc-800",
    pending_review: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    awaiting_justification: "text-amber-300/80 bg-amber-500/5 border-amber-500/20",
};
const DOT: Record<string, string> = { not_sent: "bg-zinc-400", sending: "bg-sky-400", sent: "bg-emerald-400", failed: "bg-red-400", not_required: "bg-zinc-600", pending_review: "bg-amber-400", awaiting_justification: "bg-amber-400/70" };
const JUST_LABEL: Record<string, [string, string]> = {
    approved: ["Approved", "text-emerald-300"], rejected: ["Rejected", "text-red-300"], pending: ["Pending", "text-amber-300"], not_submitted: ["Not submitted", "text-zinc-500"],
};

function StatusBadge({ status, label }: { status: string; label: string }) {
    return (
        <span data-testid="row-status" data-status={status} className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap", STATUS_STYLE[status] || STATUS_STYLE.not_sent)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", DOT[status] || DOT.not_sent)} />{label}
        </span>
    );
}

export default function EmailManagementPage() {
    const { user } = useAuth();
    const allowed = !!user && (user.role === "HR" || user.role === "FOUNDER");
    const [tab, setTab] = useState<Tab>("dress_code");
    const [from, setFrom] = useState(() => addDays(istToday(), -6));
    const [to, setTo] = useState(istToday);
    const [q, setQ] = useState("");
    const [qLive, setQLive] = useState("");
    const [dept, setDept] = useState("");
    const [location, setLocation] = useState("");
    const [status, setStatus] = useState("");
    const [category, setCategory] = useState("");
    const [ov, setOv] = useState<any>(null);
    // rows are kept with the tab they belong to: right after a tab switch the previous tab's rows (e.g. History rows,
    // which have no "details") must never be drawn with the new tab's columns
    const [loaded, setLoaded] = useState<{ tab: Tab; rows: any[] } | null>(null);
    const rows: any[] | null = loaded && loaded.tab === tab ? loaded.rows : null;
    const setRows = (fn: any[] | null | ((p: any[] | null) => any[]), forTab: Tab = tab) =>
        setLoaded(prev => {
            const cur = prev && prev.tab === forTab ? prev.rows : null;
            const next = typeof fn === "function" ? fn(cur) : fn;
            return next === null ? null : { tab: forTab, rows: (next || []).map((r: any) => ({ ...r, details: r.details || {} })) };
        });
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const [open, setOpen] = useState<string>("");
    const [copy, setCopy] = useState<any>(null);
    const [copyLoading, setCopyLoading] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => { const t = setTimeout(() => setQ(qLive), 300); return () => clearTimeout(t); }, [qLive]);
    useEffect(() => { setStatus(""); setOpen(""); }, [tab]);
    useEffect(() => { if (!notice?.ok) return; const t = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(t); }, [notice]);

    const params = useMemo(() => {
        const p = new URLSearchParams({ from, to });
        if (q) p.set("q", q); if (dept) p.set("dept", dept); if (location) p.set("location", location); if (status) p.set("status", status);
        if (tab === "history" && category) p.set("category", category);
        return p.toString();
    }, [from, to, q, dept, location, status, category, tab]);
    useEffect(() => { setPage(1); setOpen(""); }, [params]);

    const loadOverview = useCallback(() => {
        fetch(`/api/hr/email-management?tab=overview&from=${from}&to=${to}`, { cache: "no-store" })
            .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setOv(d); }).catch(() => {});
    }, [from, to]);

    useEffect(() => { if (allowed) loadOverview(); }, [allowed, loadOverview, reload]);
    useEffect(() => {
        if (!allowed) return;
        let cancelled = false;
        setRows(null); setError("");
        fetch(`/api/hr/email-management?tab=${tab}&${params}`, { cache: "no-store" })
            .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load."); if (!cancelled) { setRows(d.rows || [], tab); setTotal(d.total ?? (d.rows || []).length); } })
            .catch(e => { if (!cancelled) { setError(e.message); setRows([], tab); } });
        return () => { cancelled = true; };
    }, [allowed, tab, params, reload]); // eslint-disable-line react-hooks/exhaustive-deps

    const onSent = (key: string) => (r: { ok: boolean; message?: string; error?: string; row?: any }) => {
        setNotice({ ok: r.ok, text: r.ok ? r.message || "Email sent." : r.error || "Email could not be sent." });
        if (r.row && tab !== "history") setRows(p => (p || []).map(x => (x.key === key ? r.row : x)));
        loadOverview();
    };
    const viewCopy = async (key: string) => {
        setCopyLoading(key);
        try {
            const r = await fetch(`/api/hr/email-management?tab=copy&key=${encodeURIComponent(key)}`, { cache: "no-store" });
            const d = await r.json(); if (!r.ok) throw new Error(d.error);
            setCopy(d);
        } catch (e: any) { setNotice({ ok: false, text: e.message || "Could not open the email." }); } finally { setCopyLoading(""); }
    };

    if (!user) return null;
    if (!allowed) return <div className="p-8 text-center text-sm text-zinc-500">Only HR and HR Executive can open Email Management.</div>;

    const cards: [string, number | undefined, any, string, Tab][] = [
        ["Pending Dress Code", ov?.cards?.dress_code, Shirt, "text-purple-300 bg-purple-500/10", "dress_code"],
        ["Pending Late Clock-In", ov?.cards?.late_clock_in, Clock, "text-yellow-300 bg-yellow-500/10", "late_clock_in"],
        ["Pending No Clock-In", ov?.cards?.no_clock_in, UserX, "text-red-300 bg-red-500/10", "no_clock_in"],
        ["Pending No Clock-Out", ov?.cards?.no_clock_out, LogOut, "text-teal-300 bg-teal-500/10", "no_clock_out"],
        ["Total Sent Today", ov?.cards?.sentToday, CheckCircle2, "text-emerald-300 bg-emerald-500/10", "history"],
        ["Failed Emails", ov?.cards?.failed, XCircle, "text-red-400 bg-red-500/10", "history"],
    ];
    const statusOpts = tab === "history" ? STATUS_OPTIONS.history : tab === "late_clock_in" ? STATUS_OPTIONS.late_clock_in : STATUS_OPTIONS.default;
    const sel = "h-9 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-600";
    const th = "px-3 py-2.5 font-semibold text-left";
    const td = "px-3 py-3 align-middle";

    const pageCount = Math.max(1, Math.ceil((rows?.length || 0) / PAGE_SIZE));
    const curPage = Math.min(page, pageCount);
    const pageRows = (rows || []).slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

    const empCell = (r: any, sub?: string) => (
        <td className={cn(td, "max-w-0")}>
            <p className="font-semibold text-white truncate" title={r.employeeName}>{r.employeeName}</p>
            <p className="text-[10px] text-zinc-500 truncate" title={`${r.employeeId} · ${r.email || "no email"}`}>{sub ?? `${r.employeeId} · ${r.email || "no email"}`}</p>
        </td>
    );
    const actionCell = (r: any) => (
        <td className={cn(td, "text-right")}>
            <div className="flex items-center justify-end gap-1.5">
                {(r.canSend || r.status === "sending" || (r.status === "sent" && !r.sentByRole?.startsWith("Auto"))) && (
                    <SendEmailButton key={`${r.key}:${r.status}:${r.attemptCount}`} small category={r.category} relatedRecordId={r.relatedRecordId} status={r.status}
                        label={r.category === "late_clock_in" ? "Send Warning" : "Send Email"} onDone={onSent(r.key)} />
                )}
                <button onClick={() => setOpen(open === r.key ? "" : r.key)} data-testid="row-view" title="Details" aria-label="Details"
                    className={cn("w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg border transition-colors", open === r.key ? "border-zinc-500 bg-zinc-800 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white")}>
                    <ChevronDown size={13} className={cn("transition-transform", open === r.key && "rotate-180")} />
                </button>
            </div>
        </td>
    );
    const Field = ({ k, children }: { k: string; children: any }) => (
        <div className="flex gap-2 text-[11px]"><span className="text-zinc-500 w-24 shrink-0">{k}</span><span className="text-zinc-200 min-w-0 break-words">{children}</span></div>
    );
    const link = "text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1";
    const detailsRow = (r: any, cols: number) => open === r.key && (
        <tr className="bg-zinc-950/70"><td colSpan={cols} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="row-details">
                <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Employee</p>
                    <Field k="Name">{r.employeeName} <span className="text-zinc-500">({r.employeeId})</span></Field>
                    <Field k="Role">{r.designation || r.role || "—"}</Field>
                    <Field k="Department">{r.dept || "—"}</Field>
                    <Field k="Email">{r.email || "No email address"}</Field>
                    <Field k="Location">{r.locationName || "—"}</Field>
                </div>
                <div className="space-y-1.5">
                    {r.category === "dress_code" && <>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Dress Code</p>
                        <Field k="Reason">{r.details.reasonText || "—"}</Field>
                        <Field k="Remarks">{r.details.remarks || "—"}</Field>
                        <Field k="Rejected by">{r.details.reviewedBy || "—"}{r.details.reviewedByRole ? ` (${r.details.reviewedByRole})` : ""}{r.details.reviewedAt ? ` · ${tsDate(r.details.reviewedAt)} ${tsTime(r.details.reviewedAt)}` : ""}</Field>
                        <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
                            {r.details.imageUrl && <a href={r.details.imageUrl} target="_blank" rel="noreferrer" className={link}><ImageIcon size={11} /> View clock-in photo</a>}
                            {r.details.photoUrl && <a href={r.details.photoUrl} target="_blank" rel="noreferrer" className={link}><ImageIcon size={11} /> Rejection photo (sent with the email)</a>}
                        </div>
                    </>}
                    {r.category === "late_clock_in" && <>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Justification</p>
                        <Field k="Status"><span className={JUST_LABEL[r.details.justificationStatus]?.[1]}>{JUST_LABEL[r.details.justificationStatus]?.[0] || r.details.justificationStatus || "—"}</span></Field>
                        <Field k="Reason"><span className="whitespace-pre-wrap">{r.details.justificationReason || "—"}</span></Field>
                        {r.details.hrDecisionBy && <Field k="HR decision">{r.details.hrDecisionBy} ({r.details.hrDecisionRole}) · {tsDate(r.details.hrDecisionAt)}{r.details.rejectionReason ? ` — ${r.details.rejectionReason}` : ""}</Field>}
                        {r.details.supportingDocument && <a href={r.details.supportingDocument} target="_blank" rel="noreferrer" className={cn(link, "text-[11px] pt-1")}><FileText size={11} /> Supporting document</a>}
                    </>}
                    {r.category === "no_clock_in" && <>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Attendance</p>
                        <Field k="Status">{r.details.attendanceStatus || "—"}</Field>
                        <Field k="Scheduled">{t12(r.details.scheduled)} at {r.details.scheduledLocation || "—"}</Field>
                    </>}
                    {r.category === "no_clock_out" && <>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Attendance</p>
                        <Field k="Clock-in">{t12(r.details.clockIn)}</Field>
                        <Field k="Expected out">{t12(r.details.expectedOut)}</Field>
                        <Field k="Status">{r.details.attendanceStatus || "—"}{r.details.clockOut ? ` (${t12(r.details.clockOut)})` : ""}</Field>
                        {r.details.locationVisits > 0 && <Field k="Visits">{r.details.locationVisits} location visit(s) — only the final clock-out is checked</Field>}
                        {r.details.explanation && <Field k="Explanation">{r.details.explanation}</Field>}
                    </>}
                </div>
                <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Email</p>
                    <Field k="Status">{r.statusLabel}{r.warningLabel && r.warningLabel !== "—" ? ` · ${r.warningLabel}` : ""}</Field>
                    {r.sentBy && <Field k="Sent by">{r.sentBy}{r.sentByRole ? ` (${r.sentByRole})` : ""}{r.sentAt ? ` · ${tsDate(r.sentAt)} ${tsTime(r.sentAt)}` : ""}</Field>}
                    {r.lastError && <Field k="Error"><span className="text-red-300">{r.lastError}</span></Field>}
                    <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
                        {r.hasSentCopy && <button onClick={() => viewCopy(r.key)} className={link} data-testid="view-sent">{copyLoading === r.key ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />} View sent email</button>}
                        {r.attemptCount > 0 && <button onClick={() => { setTab("history"); setQLive(r.employeeId); }} className="text-zinc-400 hover:text-white inline-flex items-center gap-1"><History size={11} /> Email history</button>}
                    </div>
                </div>
            </div>
        </td></tr>
    );

    // Column layout per tab (widths keep the table inside the page — no sideways scrolling)
    const cols: Record<Tab, { h: string; w?: string; cls?: string }[]> = {
        dress_code: [{ h: "Employee" }, { h: "Date", w: "w-[110px]" }, { h: "Rejection Reason", w: "w-[24%]" }, { h: "Rejected By", w: "w-[140px]", cls: "hidden xl:table-cell" }, { h: "Email Status", w: "w-[120px]" }, { h: "", w: "w-[150px]" }],
        late_clock_in: [{ h: "Employee" }, { h: "Date", w: "w-[110px]" }, { h: "Clock-In", w: "w-[130px]" }, { h: "Justification", w: "w-[110px]" }, { h: "Warning", w: "w-[150px]", cls: "hidden lg:table-cell" }, { h: "Email Status", w: "w-[170px]" }, { h: "", w: "w-[160px]" }],
        no_clock_in: [{ h: "Employee" }, { h: "Department", w: "w-[150px]", cls: "hidden lg:table-cell" }, { h: "Date", w: "w-[110px]" }, { h: "Scheduled", w: "w-[100px]" }, { h: "Email Status", w: "w-[120px]" }, { h: "", w: "w-[150px]" }],
        no_clock_out: [{ h: "Employee" }, { h: "Date", w: "w-[110px]" }, { h: "Clock-In", w: "w-[95px]" }, { h: "Expected Out", w: "w-[110px]", cls: "hidden lg:table-cell" }, { h: "Status", w: "w-[150px]", cls: "hidden xl:table-cell" }, { h: "Email Status", w: "w-[120px]" }, { h: "", w: "w-[150px]" }],
        history: [{ h: "Employee" }, { h: "Category", w: "w-[170px]" }, { h: "Subject", w: "w-[26%]", cls: "hidden xl:table-cell" }, { h: "Related Date", w: "w-[110px]", cls: "hidden lg:table-cell" }, { h: "Sent By", w: "w-[150px]" }, { h: "Sent At", w: "w-[120px]" }, { h: "Status", w: "w-[100px]" }, { h: "", w: "w-[120px]" }],
    };
    const colCls = (i: number) => cols[tab][i]?.cls || "";
    const nCols = cols[tab].length;
    const count = (t: Tab) => { const c = TABS.find(x => x.id === t)?.card; return c ? ov?.cards?.[c] : undefined; };

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto w-full" data-testid="email-management">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Mail size={18} className="text-emerald-400" /></div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Email Management</h1>
                        <p className="text-xs text-zinc-500">Review and send dress code, late clock-in, no clock-in and no clock-out emails.</p>
                    </div>
                </div>
                <button onClick={() => setReload(x => x + 1)} className="self-start sm:self-auto h-9 text-xs font-semibold text-zinc-300 border border-zinc-800 bg-zinc-900 rounded-lg px-3 hover:border-zinc-600 flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="em-cards">
                {cards.map(([label, n, Icon, color, target]) => (
                    <button key={label} onClick={() => setTab(target)} data-testid={`em-card-${label.replace(/\s+/g, "-").toLowerCase()}`}
                        className={cn("text-left rounded-xl border bg-zinc-900/60 p-3.5 transition-colors", tab === target && target !== "history" ? "border-zinc-600" : "border-zinc-800 hover:border-zinc-700")}>
                        <div className="flex items-center justify-between">
                            <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}><Icon size={14} /></span>
                            <p className="text-xl font-bold text-white tabular-nums" data-testid="em-card-value">{n === undefined ? "—" : n}</p>
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mt-2 leading-tight">{label}</p>
                    </button>
                ))}
            </div>

            {notice && (
                <div data-testid="em-notice" className={cn("rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2", notice.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200")}>
                    {notice.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {notice.text}
                    <button onClick={() => setNotice(null)} className="ml-auto opacity-70 hover:opacity-100" aria-label="Close"><X size={13} /></button>
                </div>
            )}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                {/* tabs */}
                <div className="flex gap-1 px-2 border-b border-zinc-800 overflow-x-auto">
                    {TABS.map(t => {
                        const c = count(t.id);
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`em-tab-${t.id}`}
                                className={cn("relative px-3 py-3 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors", tab === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-300")}>
                                <t.icon size={13} /> {t.label}
                                {!!c && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-800 text-[10px] text-zinc-300 inline-flex items-center justify-center tabular-nums">{c}</span>}
                                {tab === t.id && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-emerald-400" />}
                            </button>
                        );
                    })}
                </div>

                {/* filters */}
                <div className="p-3 border-b border-zinc-800 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={qLive} onChange={e => setQLive(e.target.value)} placeholder="Search name, ID or email" data-testid="em-search" className={cn(sel, "w-full pl-8")} />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} className={sel} data-testid="em-from" aria-label="From date" />
                        <span className="text-zinc-600 text-xs">to</span>
                        <input type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} className={sel} data-testid="em-to" aria-label="To date" />
                    </div>
                    <select value={dept} onChange={e => setDept(e.target.value)} className={sel} data-testid="em-dept" aria-label="Department">
                        <option value="">All departments</option>
                        {(ov?.departments || []).map((d: string) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={location} onChange={e => setLocation(e.target.value)} className={sel} data-testid="em-location" aria-label="Location">
                        <option value="">All locations</option>
                        {(ov?.locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {tab === "history" && <select value={category} onChange={e => setCategory(e.target.value)} className={sel} data-testid="em-category" aria-label="Category">
                        {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>}
                    <select value={status} onChange={e => setStatus(e.target.value)} className={sel} data-testid="em-status" aria-label="Email status">
                        {statusOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                <p className="px-4 pt-3 text-[11px] text-zinc-500">{TAB_HINT[tab]}</p>
                {error && <p className="px-4 pt-2 text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</p>}
                {rows && total > rows.length && <p className="px-4 pt-2 text-[11px] text-amber-300">Only the first {rows.length} of {total} records are loaded — narrow the date range or filters to see the rest.</p>}

                {/* table */}
                <div className="mt-3" data-testid={`em-table-${tab}`}>
                    <table className="w-full table-fixed text-xs">
                        <thead><tr className="bg-zinc-900 border-y border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                            {cols[tab].map((c, i) => <th key={i} className={cn(th, c.w, c.cls, i === nCols - 1 && "text-right")}>{c.h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {rows === null && <tr><td colSpan={nCols} className="py-14 text-center"><Loader2 size={18} className="animate-spin text-zinc-500 inline" /></td></tr>}
                            {rows !== null && !rows.length && <tr><td colSpan={nCols} className="py-14 text-center" data-testid="em-empty"><Inbox size={22} className="mx-auto text-zinc-700 mb-2" /><p className="text-xs text-zinc-500">Nothing to show for these filters.</p></td></tr>}

                            {tab === "dress_code" && pageRows.map(r => (
                                <Fragment key={r.key}>
                                    <tr className="hover:bg-zinc-800/20" data-testid="em-row" data-key={r.key} data-employee={r.employeeId}>
                                        {empCell(r)}
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{shortDate(r.date)}</td>
                                        <td className={cn(td, "text-zinc-200")} data-testid="row-reason"><p className="truncate" title={r.details.reasonText}>{r.details.reasonText || <span className="text-zinc-500">—</span>}</p>{r.details.remarks && <p className="text-[10px] text-zinc-500 truncate" title={r.details.remarks}>{r.details.remarks}</p>}</td>
                                        <td className={cn(td, "text-zinc-400 truncate", colCls(3))}>{r.details.reviewedBy || "—"}</td>
                                        <td className={td}><StatusBadge status={r.status} label={r.statusLabel} /></td>
                                        {actionCell(r)}
                                    </tr>
                                    {detailsRow(r, nCols)}
                                </Fragment>
                            ))}

                            {tab === "late_clock_in" && pageRows.map(r => (
                                <Fragment key={r.key}>
                                    <tr className="hover:bg-zinc-800/20" data-testid="em-row" data-key={r.key} data-employee={r.employeeId}>
                                        {empCell(r)}
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{shortDate(r.date)}</td>
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{t12(r.details.clockIn)}<p className="text-[10px] text-zinc-500">{r.details.lateText ? `${r.details.lateText} late` : ""}</p></td>
                                        <td className={td} data-testid="row-justification"><span className={JUST_LABEL[r.details.justificationStatus]?.[1]}>{JUST_LABEL[r.details.justificationStatus]?.[0] || "—"}</span></td>
                                        <td className={cn(td, "text-zinc-200 truncate", colCls(4))} data-testid="row-warning">{r.warningLabel || "—"}</td>
                                        <td className={td}><StatusBadge status={r.status} label={r.status === "pending_review" ? "On Hold" : r.statusLabel} /></td>
                                        {actionCell(r)}
                                    </tr>
                                    {detailsRow(r, nCols)}
                                </Fragment>
                            ))}

                            {tab === "no_clock_in" && pageRows.map(r => (
                                <Fragment key={r.key}>
                                    <tr className="hover:bg-zinc-800/20" data-testid="em-row" data-key={r.key} data-employee={r.employeeId}>
                                        {empCell(r)}
                                        <td className={cn(td, "text-zinc-300 truncate", colCls(1))}>{r.dept || r.designation || "—"}</td>
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{shortDate(r.date)}</td>
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{t12(r.details.scheduled)}</td>
                                        <td className={td}><StatusBadge status={r.status} label={r.statusLabel} /></td>
                                        {actionCell(r)}
                                    </tr>
                                    {detailsRow(r, nCols)}
                                </Fragment>
                            ))}

                            {tab === "no_clock_out" && pageRows.map(r => (
                                <Fragment key={r.key}>
                                    <tr className="hover:bg-zinc-800/20" data-testid="em-row" data-key={r.key} data-employee={r.employeeId}>
                                        {empCell(r)}
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{shortDate(r.date)}</td>
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap")}>{t12(r.details.clockIn)}</td>
                                        <td className={cn(td, "text-zinc-300 whitespace-nowrap", colCls(3))}>{t12(r.details.expectedOut)}</td>
                                        <td className={cn(td, "truncate", r.status === "not_required" ? "text-zinc-500" : "text-teal-300", colCls(4))}>{r.details.attendanceStatus}</td>
                                        <td className={td}><StatusBadge status={r.status} label={r.statusLabel} /></td>
                                        {actionCell(r)}
                                    </tr>
                                    {detailsRow(r, nCols)}
                                </Fragment>
                            ))}

                            {tab === "history" && pageRows.map((r, i) => (
                                <tr key={`${r.key}:${r.at}:${i}`} className="hover:bg-zinc-800/20" data-testid="em-history-row" data-key={r.key}>
                                    {empCell(r, r.email || "—")}
                                    <td className={cn(td, "text-zinc-200 truncate")} data-testid="history-category">{r.categoryLabel}</td>
                                    <td className={cn(td, "text-zinc-400", colCls(2))}><p className="truncate" title={r.subject}>{r.subject}</p></td>
                                    <td className={cn(td, "text-zinc-300 whitespace-nowrap", colCls(3))}>{shortDate(r.relatedDate)}</td>
                                    <td className={cn(td, "max-w-0")}><p className="text-zinc-200 truncate">{r.triggeredBy || "—"}</p><p className="text-[10px] text-zinc-500" data-testid="history-role">{r.senderRole || "—"}</p></td>
                                    <td className={cn(td, "whitespace-nowrap")}><p className="text-zinc-300">{tsDate(r.at)}</p><p className="text-[10px] text-zinc-500">{tsTime(r.at)}</p></td>
                                    <td className={td}><span title={r.error || undefined}><StatusBadge status={r.status} label={r.statusLabel} /></span></td>
                                    <td className={cn(td, "text-right")}>
                                        <div className="flex items-center justify-end gap-1.5">
                                            {r.hasSentCopy && <button onClick={() => viewCopy(r.key)} className="h-7 text-[10px] font-semibold text-zinc-300 border border-zinc-800 rounded-lg px-2 hover:border-zinc-600 inline-flex items-center gap-1" data-testid="history-view">{copyLoading === r.key ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />} View</button>}
                                            {r.canRetry && <SendEmailButton small category={r.category} relatedRecordId={r.relatedRecordId} status="failed" onDone={res => { onSent(r.key)(res); setReload(x => x + 1); }} />}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* pagination */}
                {rows && rows.length > 0 && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800" data-testid="em-pagination">
                        <p className="text-[11px] text-zinc-500">Showing <span className="text-zinc-300">{(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, rows.length)}</span> of <span className="text-zinc-300">{rows.length}</span></p>
                        {pageCount > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => { setPage(curPage - 1); setOpen(""); }} disabled={curPage <= 1} data-testid="em-prev" className="h-8 px-2.5 rounded-lg border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-40 inline-flex items-center gap-1"><ChevronLeft size={13} /> Prev</button>
                                <span className="text-[11px] text-zinc-400 tabular-nums px-1" data-testid="em-page">Page {curPage} of {pageCount}</span>
                                <button onClick={() => { setPage(curPage + 1); setOpen(""); }} disabled={curPage >= pageCount} data-testid="em-next" className="h-8 px-2.5 rounded-lg border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-40 inline-flex items-center gap-1">Next <ChevronRight size={13} /></button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {copy && (
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="sent-copy">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="px-5 py-3 border-b border-zinc-800 flex items-start gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white">{copy.subject}</p>
                                <p className="text-[11px] text-zinc-400">To {copy.email} · {tsDate(copy.sentAt)} {tsTime(copy.sentAt)} · by {copy.by} ({copy.role})</p>
                            </div>
                            <button onClick={() => setCopy(null)} className="ml-auto text-zinc-500 hover:text-white" aria-label="Close"><X size={18} /></button>
                        </div>
                        <iframe title="Sent email" sandbox="" srcDoc={copy.html} className="flex-1 min-h-[360px] bg-white rounded-b-2xl" />
                    </div>
                </div>
            )}
        </div>
    );
}