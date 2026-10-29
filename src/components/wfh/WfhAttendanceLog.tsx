"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Loader2, Search, X, ExternalLink, MapPin, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WFH_STATUS_STYLE, WFH_TYPE_LABEL } from "@/lib/wfh-policy";

/**
 * HR → Attendance → Work From Home Attendance Log.
 * Data: GET /api/wfh/attendance (HR / Founder: everyone; a reporting manager: own hierarchy — decided on the server).
 * Approve / Reject use the existing PUT /api/wfh (the server checks who may decide).
 */
const fmtDate = (ymd: string) => (ymd ? ymd.split("-").reverse().join("-") : "—");
const PAGE_SIZE = 10;
/** Same roles and names as the login page's role dropdown */
const ROLE_OPTIONS: [string, string][] = [
    ["FOUNDER", "Founder"], ["HR", "Human Resources (HR)"], ["HR_EXECUTIVE", "HR Executive"], ["AD", "Associate Director (AD)"],
    ["TL", "Tech Lead (TL)"], ["HOI", "Head of Institute (HOI)"], ["OM", "Operations Manager / Growth Manager"], ["MARKETING_TEAM", "Marketing Team"],
    ["TECH_TEAM", "Tech Team"], ["CURRICULUM_HEAD", "Curriculum Head"], ["CURRICULUM_LEAD", "Curriculum Lead"], ["PROFESSOR", "Academic Faculty / Professor"],
];
const ROLE_LABEL: Record<string, string> = { ...Object.fromEntries(ROLE_OPTIONS), FACULTY: "Academic Faculty / Professor" };
/** FACULTY is listed under "Academic Faculty / Professor" */
const roleKey = (role?: string) => (role === "FACULTY" ? "PROFESSOR" : role || "");
const STATUS_STYLE: Record<string, string> = { ...WFH_STATUS_STYLE, "Scheduled WFH": "bg-sky-500/10 text-sky-300 border-sky-500/20", Unknown: "bg-zinc-800 text-zinc-400 border-zinc-700" };

export default function WfhAttendanceLog() {
    const [rows, setRows] = useState<any[] | null>(null);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [date, setDate] = useState("");
    const [role, setRole] = useState("All");
    const [status, setStatus] = useState("All");
    const [open, setOpen] = useState<any | null>(null);
    const [busy, setBusy] = useState("");
    const [msg, setMsg] = useState("");
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/wfh/attendance", { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load the Work From Home attendance log.");
            setRows(d.records || []); setError("");
        } catch (e: any) { setError(e.message); setRows([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => (rows || []).filter(r =>
        (!q || `${r.employeeName} ${r.employeeId}`.toLowerCase().includes(q.toLowerCase())) &&
        (!date || r.date === date) && (role === "All" || roleKey(r.role) === role) &&
        (status === "All" || (status === "Review" ? r.reviewRequired : r.approvalStatus === status))
    ), [rows, q, date, role, status]);
    // 10 rows per page; a filter change goes back to page 1
    useEffect(() => { setPage(1); }, [q, date, role, status]);
    const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const curPage = Math.min(page, pageCount);
    const pageRows = shown.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

    const decide = async (appId: string, action: "approve" | "reject") => {
        let remarks = "";
        if (action === "reject") {
            remarks = window.prompt("Reason for rejecting this Work From Home application:") || "";
            if (remarks.trim().length < 3) return;
        }
        setBusy(appId + action); setMsg("");
        try {
            const r = await fetch("/api/wfh", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: appId, action, remarks }) });
            const d = await r.json();
            setMsg(r.ok ? (d.message || "Saved.") : (d.error || "Could not save."));
            if (r.ok) { setOpen(null); await load(); }
        } finally { setBusy(""); }
    };

    const field = "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 [color-scheme:dark]";
    return (
        <div className="space-y-4" data-testid="wfh-att-log">
            <div className="flex flex-wrap items-end gap-2" data-testid="wfh-att-filters">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Employee name or ID" className={cn(field, "w-full pl-8")} data-testid="wfh-att-search" />
                </div>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} data-testid="wfh-att-date" />
                <select value={role} onChange={e => setRole(e.target.value)} className={field} data-testid="wfh-att-role">
                    <option value="All">All roles</option>{ROLE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} className={field} data-testid="wfh-att-status">
                    <option value="All">All approval states</option><option value="Pending">Pending</option><option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option><option value="Cancelled">Cancelled</option><option value="Review">Needs HR review</option><option value="Scheduled WFH">Scheduled WFH</option>
                </select>
                {(q || date || role !== "All" || status !== "All") && <button onClick={() => { setQ(""); setDate(""); setRole("All"); setStatus("All"); }} className="text-[11px] text-zinc-400 hover:text-white px-2 py-2">Clear</button>}
            </div>
            {msg && <p className="text-[11px] text-zinc-300" data-testid="wfh-att-msg">{msg}</p>}
            {error && <p className="text-[11px] text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</p>}

            {/* fixed layout: fits the page width (no sideways scrolling); details in View */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full table-fixed text-xs">
                    <thead><tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider text-left">
                        <th className="px-3 py-2.5 font-semibold">Employee</th>
                        <th className="px-3 py-2.5 font-semibold w-[105px]">Date</th>
                        <th className="px-3 py-2.5 font-semibold w-[130px]">In / Out</th>
                        <th className="px-3 py-2.5 font-semibold w-[150px]">Approval</th>
                        <th className="px-3 py-2.5 font-semibold w-[22%] hidden md:table-cell">Attendance &amp; Location</th>
                        <th className="px-3 py-2.5 font-semibold w-[150px] text-right">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/70">
                        {rows === null && <tr><td colSpan={6} className="py-10 text-center"><Loader2 size={16} className="animate-spin text-zinc-500 inline" /></td></tr>}
                        {rows !== null && !shown.length && <tr><td colSpan={6} className="py-10 text-center text-zinc-500">No Work From Home attendance found.</td></tr>}
                        {pageRows.map(r => (
                            <tr key={`${r.employeeId}-${r.date}`} data-testid="wfh-att-row" data-emp={r.employeeId} data-date={r.date} className="hover:bg-zinc-800/20">
                                <td className="px-3 py-3 max-w-0">
                                    <button onClick={() => setQ(r.employeeId)} title="Show this employee's Work From Home history" className="text-left block w-full">
                                        <p className="font-semibold text-white hover:text-emerald-300 truncate">{r.employeeName}</p>
                                        <p className="text-[10px] text-zinc-500 truncate"><span className="font-mono">{r.employeeId}</span> · <span data-testid="wfh-att-rolecell">{ROLE_LABEL[r.role] || r.role || "—"}</span></p>
                                    </button>
                                </td>
                                <td className="px-3 py-3 text-zinc-200 whitespace-nowrap">{fmtDate(r.date)}</td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <p><span className="text-green-400">{r.clockIn || "—"}</span><span className="text-zinc-600 mx-1">→</span><span className="text-orange-400">{r.clockOut || "—"}</span></p>
                                    <p className="text-[10px] text-zinc-500">{r.totalHours != null ? `${r.totalHours} h total` : "In progress"}</p>
                                </td>
                                <td className="px-3 py-3">
                                    <span className={cn("px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap", STATUS_STYLE[r.approvalStatus] || STATUS_STYLE.Unknown)} data-testid="wfh-att-approval">{r.approvalStatus}</span>
                                    {r.wfhApplicationId && <p className="text-[9px] text-zinc-500 font-mono mt-1 truncate" title={r.wfhApplicationId}>{r.wfhApplicationId}</p>}
                                    {r.reviewRequired && <p className="text-[9px] text-amber-400 font-bold mt-1" data-testid="wfh-att-review">Needs HR review</p>}
                                </td>
                                <td className="px-3 py-3 hidden md:table-cell max-w-0">
                                    <p className="text-zinc-300 truncate">{r.approvalStatus === "Pending" ? <span className="text-amber-300">Provisional</span> : r.attendanceStatus}</p>
                                    <p className="text-[10px] text-zinc-500 truncate" title={r.workLocation}>{r.workLocation || "—"}</p>
                                    {r.locationCaptured && <span className="text-[9px] text-emerald-400 flex items-center gap-0.5"><MapPin size={9} /> Location captured</span>}
                                </td>
                                <td className="px-3 py-3 text-right">
                                    <div className="inline-flex flex-wrap justify-end gap-1">
                                        {r.application && <button onClick={() => setOpen(r)} className="text-[10px] font-semibold text-zinc-200 border border-zinc-700 rounded-lg px-2 py-1 hover:border-zinc-500" data-testid="wfh-att-view">View</button>}
                                        {r.application?.status === "Pending" && <>
                                            <button disabled={!!busy} onClick={() => decide(r.application.id, "approve")} className="text-[10px] font-semibold text-emerald-300 border border-emerald-500/30 rounded-lg px-2 py-1 disabled:opacity-50" data-testid="wfh-att-approve">Approve</button>
                                            <button disabled={!!busy} onClick={() => decide(r.application.id, "reject")} className="text-[10px] font-semibold text-red-300 border border-red-500/30 rounded-lg px-2 py-1 disabled:opacity-50" data-testid="wfh-att-reject">Reject</button>
                                        </>}
                                        {!r.application && <span className="text-zinc-600">—</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {shown.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-2" data-testid="wfh-att-pager">
                    <p className="text-[11px] text-zinc-500">Showing {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, shown.length)} of {shown.length}</p>
                    <div className="flex items-center gap-1">
                        <button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} data-testid="wfh-att-prev" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:border-zinc-600 disabled:opacity-40"><ChevronLeft size={13} /> Previous</button>
                        <span className="px-2 text-[11px] text-zinc-400 tabular-nums" data-testid="wfh-att-page">Page {curPage} of {pageCount}</span>
                        <button disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)} data-testid="wfh-att-next" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:border-zinc-600 disabled:opacity-40">Next <ChevronRight size={13} /></button>
                    </div>
                </div>
            )}

            {open?.application && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="wfh-att-detail">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(null)} />
                    <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Home size={14} className="text-emerald-400" /> {open.application.id}</h3>
                            <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                        </div>
                        {([
                            ["Employee", `${open.employeeName} (${open.employeeId})`],
                            ["Dates", `${fmtDate(open.application.startDate)} – ${fmtDate(open.application.endDate)}`],
                            ["Type", WFH_TYPE_LABEL[open.application.wfhType] || open.application.wfhType],
                            ["Work location", open.application.workLocation || "—"],
                            ["Reason", open.application.reason],
                            ["Status", open.application.status + (open.application.approverName ? ` by ${open.application.approverName}` : "")],
                            ["Remarks", open.application.decisionRemarks || "—"],
                        ] as [string, string][]).map(([k, v]) => <div key={k} className="grid grid-cols-[7rem_1fr] gap-2"><span className="text-zinc-500">{k}</span><span className="text-zinc-200 break-words">{v}</span></div>)}
                        {open.application.documentUrl && <a href={open.application.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline"><ExternalLink size={12} /> Supporting document</a>}
                        {open.application.status === "Pending" && (
                            <div className="flex gap-2 pt-2 border-t border-zinc-800">
                                <button disabled={!!busy} onClick={() => decide(open.application.id, "approve")} className="flex-1 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold disabled:opacity-50">Approve</button>
                                <button disabled={!!busy} onClick={() => decide(open.application.id, "reject")} className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-300 font-bold disabled:opacity-50">Reject</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}