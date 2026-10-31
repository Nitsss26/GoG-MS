"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    Wallet, CalendarDays, Briefcase, CheckCircle2, CalendarCheck, CalendarX, Ban, AlertTriangle, Shirt, Flag,
    ChevronDown, RefreshCw, TicketPlus, X, Upload, Loader2, Info, MessageSquare, Clock,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { exportEmployeeMonth } from "@/lib/salary-export";
import { Download, FileSpreadsheet } from "lucide-react";

/**
 * My Salary & Payable Days — the logged-in employee's own payable days, leaves, penalties and correction tickets.
 * Read-only figures from the existing OMS records (attendance, leave, holidays, attendance violations, dress code).
 */
const CATEGORIES = [
    "Payable Days Incorrect", "Paid Leave Not Counted", "Unpaid Leave Incorrect", "Attendance Incorrect",
    "Dress Code Fine Incorrect", "Clock-In / Clock-Out Penalty", "Flag-Related Issue", "Other Salary-Related Issue",
];
const STATUS_STYLE: Record<string, string> = {
    "Open": "bg-sky-500/10 text-sky-300 border-sky-500/30",
    "Under Review": "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    "Additional Information Required": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Approved": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    "Rejected": "bg-red-500/10 text-red-300 border-red-500/30",
    "Resolved": "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
};
const PAY_STYLE: Record<string, string> = {
    "Payable": "text-emerald-300", "Non-Payable": "text-red-300", "Partly Payable": "text-amber-300", "Upcoming": "text-zinc-500", "Not Employed": "text-zinc-600",
};
const PEN_STYLE: Record<string, string> = {
    "Deducted": "bg-red-500/10 text-red-300 border-red-500/30",
    "Pending HR Verification": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Awaiting Explanation": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Warning": "bg-zinc-800 text-zinc-300 border-zinc-700",
    "Waived": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    "Resolved": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    "Explanation Rejected": "bg-red-500/10 text-red-300 border-red-500/30",
    "Removed": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};
const dmy = (ymd?: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function Section({ title, icon: Icon, children, open: defOpen = true, right, testid }: { title: string; icon: any; children: React.ReactNode; open?: boolean; right?: React.ReactNode; testid?: string }) {
    const [open, setOpen] = useState(defOpen);
    return (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40" data-testid={testid}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-zinc-800/70">
                <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm font-bold text-white">
                    <Icon size={16} className="text-primary" /> {title}
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {right}
            </div>
            {open && <div className="p-3 sm:p-4">{children}</div>}
        </section>
    );
}

export default function MyPayableDaysPage() {
    const { user } = useAuth();
    // null until the ?month= link parameter has been read ("" = current month)
    const [month, setMonth] = useState<string | null>(null);
    const latest = useRef(0);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [onlyIssues, setOnlyIssues] = useState(false);
    const [dl, setDl] = useState("");
    // clicking the Dress Code / Attendance Penalty card shows the days that penalty was given
    const [penKind, setPenKind] = useState<"" | "DRESS" | "ATTENDANCE">("");
    const showPenalties = (k: "DRESS" | "ATTENDANCE") => {
        setPenKind(k);
        setTimeout(() => document.querySelector('[data-testid="pd-penalties"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    const [tickets, setTickets] = useState<any[]>([]);
    const [openTicket, setOpenTicket] = useState<string>("");
    const [form, setForm] = useState<any>(null);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        try {
            const q = new URLSearchParams(window.location.search);
            const m = q.get("month"); setMonth(m && /^\d{4}-\d{2}$/.test(m) ? m : "");
            const t = q.get("ticket"); if (t) setOpenTicket(t);
        } catch { setMonth(""); }
    }, []);

    const load = useCallback(async () => {
        if (month === null) return;
        const req = ++latest.current;
        setLoading(true); setError("");
        try {
            const res = await fetch(`/api/my-payable-days${month ? `?month=${month}` : ""}`, { cache: "no-store" });
            const d = await res.json();
            if (req !== latest.current) return;          // a newer month was picked meanwhile
            if (!res.ok) throw new Error(d.error || "Could not load");
            setData(d);
            if (!month) setMonth(d.month);
        } catch (e: any) { if (req === latest.current) setError(e.message); } finally { if (req === latest.current) setLoading(false); }
    }, [month]);
    const loadTickets = useCallback(async () => {
        const res = await fetch("/api/my-payable-days/tickets", { cache: "no-store" });
        const d = await res.json().catch(() => ({}));
        if (res.ok) setTickets(d.tickets || []);
    }, []);
    useEffect(() => { if (user) load(); }, [user, load]);
    useEffect(() => { if (user) loadTickets(); }, [user, loadTickets]);
    useEffect(() => {
        if (openTicket) setTimeout(() => document.getElementById(`ticket-${openTicket}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    }, [openTicket, tickets.length]);

    const c = data?.calc;
    const days = useMemo(() => (c?.days || []).filter((d: any) => !onlyIssues || ["Non-Payable", "Partly Payable"].includes(d.payableStatus) || d.penalties.length || d.correction), [c, onlyIssues]);
    const counted = (c?.penalties || []).filter((p: any) => p.status !== "Removed");
    const dressPen = counted.filter((p: any) => p.type === "DRESS_CODE");
    const attPen = counted.filter((p: any) => p.type !== "DRESS_CODE");
    const sumDays = (l: any[]) => l.reduce((x: number, p: any) => x + (p.deductedDays || 0), 0);
    const shownPen = penKind === "DRESS" ? dressPen : penKind === "ATTENDANCE" ? attPen : counted;
    const removed = (c?.penalties || []).filter((p: any) => p.status === "Removed");

    const raise = (category = "Payable Days Incorrect") => setForm({
        category, month: data?.month || month || "",
        currentValue: category === "Payable Days Incorrect" && c ? `${n(c.payableDays)} days` : "",
        expectedValue: "", reason: "", evidenceUrls: [] as string[], affectedDates: [] as string[], busy: false, uploading: false, error: "",
    });

    if (!user) return null;
    const cards = c ? [
        { label: "Total Days", value: c.totalDays, sub: data.monthLabel, icon: CalendarDays, tone: "sky" },
        { label: "Working Days", value: c.workingDays, sub: "Excl. Sundays & holidays", icon: Briefcase, tone: "zinc" },
        { label: "Payable Days", value: n(c.payableDays), sub: c.provisional ? `Provisional · as of ${dmy(c.asOf)}` : "For the month", icon: CheckCircle2, tone: "emerald", big: true },
        { label: "Paid Leaves", value: n(c.paidLeaves), sub: `${c.paidLeaveEntitlement} paid leave / month`, icon: CalendarCheck, tone: "emerald" },
        { label: "Unpaid Leaves", value: n(c.unpaidLeaves), sub: "Approved leave beyond paid", icon: CalendarX, tone: "amber" },
        { label: "Non-Payable Days", value: n(c.nonPayableDays ?? c.lopDays), sub: c.correctedDays || c.hrDeductedDays ? `HR: +${n(c.correctedDays || 0)} payable / −${n(c.hrDeductedDays || 0)} non-payable` : "Leave without pay / absent / penalties", icon: Ban, tone: "red" },
        { label: "Penalty Deductions", value: `${n(c.penaltyDays)} day${c.penaltyDays === 1 ? "" : "s"}`, sub: c.pendingPenalties ? `${c.pendingPenalties} pending HR verification` : "Counted in payable days", icon: AlertTriangle, tone: "red" },
        { label: "Dress Code Penalty", value: dressPen.length, sub: `${sumDays(dressPen) ? `${n(sumDays(dressPen))} day deduction · ` : ""}${dressPen.length ? "Click to see the days" : "None this month"}`, icon: Shirt, tone: "amber", click: "DRESS" as const },
        { label: "Attendance Penalty", value: attPen.length, sub: `${sumDays(attPen) ? `${n(sumDays(attPen))} day deduction · ` : ""}${attPen.length ? "Late / early / missing clock-out — click to see the days" : "None this month"}`, icon: Flag, tone: "red", click: "ATTENDANCE" as const },
    ] : [];
    const TONE: Record<string, string> = {
        sky: "border-sky-500/25 bg-sky-500/[0.06] text-sky-300", zinc: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
        emerald: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300", amber: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
        red: "border-red-500/25 bg-red-500/[0.06] text-red-300",
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto w-full [contain:inline-size]" data-testid="my-payable-days">
            {/* Header */}
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/50 via-zinc-900 to-zinc-900 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><Wallet size={24} className="text-emerald-300" /></div>
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">My Salary &amp; Payable Days</h1>
                        <p className="text-xs text-zinc-400 mt-1 [overflow-wrap:anywhere]">
                            {data?.employee ? <>{data.employee.name} · {data.employee.id}{data.employee.designation ? ` · ${data.employee.designation}` : ""}{data.employee.locationName ? ` · ${data.employee.locationName}` : ""}</> : "Your payable days, leaves and penalties"}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={month || ""} onChange={e => setMonth(e.target.value)} data-testid="pd-month"
                        className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white">
                        {(data?.months || [{ value: month || "", label: month || "" }]).map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <button onClick={() => load()} title="Refresh" className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
                    <button onClick={async () => { setDl("pdf"); try { await exportEmployeeMonth("pdf", { employee: data.employee, monthLabel: data.monthLabel, month: data.month, calc: c }); } catch (e: any) { setMsg({ type: "error", text: e?.message || "Could not create the PDF" }); } finally { setDl(""); } }} disabled={!c || !!dl} data-testid="dl-pdf"
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] font-black uppercase hover:text-white disabled:opacity-50">{dl === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF</button>
                    <button onClick={async () => { setDl("xlsx"); try { await exportEmployeeMonth("xlsx", { employee: data.employee, monthLabel: data.monthLabel, month: data.month, calc: c }); } catch (e: any) { setMsg({ type: "error", text: e?.message || "Could not create the Excel file" }); } finally { setDl(""); } }} disabled={!c || !!dl} data-testid="dl-xlsx"
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase hover:bg-emerald-500 disabled:opacity-50">{dl === "xlsx" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel</button>
                    <button onClick={() => raise()} disabled={!c} data-testid="raise-ticket"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-black uppercase tracking-wider hover:bg-zinc-200 disabled:opacity-50">
                        <TicketPlus size={15} /> Raise Correction Ticket
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs ${msg.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                    {msg.type === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-auto opacity-70 hover:opacity-100"><X size={13} /></button>
                </div>
            )}
            {error && <div className="rounded-xl px-4 py-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}

            {loading && !c ? (
                <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : c && (
                <>
                    {c.provisional && (
                        <p className="flex items-start gap-2 text-[11px] text-amber-200/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                            <Info size={13} className="shrink-0 mt-0.5" /> {data.monthLabel} is still running: days after today are counted as payable until they happen. These figures are provisional, not the final payroll.
                        </p>
                    )}
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="pd-cards">
                        {cards.map((k: any) => {
                            const body = (<>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><k.icon size={13} /> {k.label}</div>
                                <p className="text-2xl font-black text-white mt-2 tabular-nums" data-testid="pd-card-value">{k.value}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5 [overflow-wrap:anywhere]">{k.sub}</p>
                            </>);
                            const cls = `rounded-2xl border p-4 text-left ${TONE[k.tone]} ${k.big ? "ring-1 ring-emerald-500/30" : ""}`;
                            const tid = `pd-card-${k.label.replace(/\W+/g, "-").toLowerCase()}`;
                            return k.click ? (
                                <button key={k.label} type="button" onClick={() => showPenalties(k.click)} aria-pressed={penKind === k.click} data-testid={tid}
                                    className={`${cls} cursor-pointer transition hover:brightness-125 ${penKind === k.click ? "ring-2 ring-white/25" : ""}`}>{body}</button>
                            ) : <div key={k.label} className={cls} data-testid={tid}>{body}</div>;
                        })}
                    </div>

                    {/* Breakdown */}
                    <Section title="Payable Days Breakdown" icon={CalendarDays} testid="pd-breakdown"
                        right={<div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer"><input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} className="accent-emerald-500" /> Only non-payable / penalty days</label>
                            <span className="text-[10px] text-zinc-600 hidden sm:inline">Calculated {dt(data.calculatedAt)}</span>
                        </div>}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[720px]">
                                <thead><tr className="text-[10px] uppercase tracking-widest text-zinc-500 text-left">
                                    <th className="py-2 px-2">Date</th><th className="py-2 px-2">Attendance</th><th className="py-2 px-2">Leave</th><th className="py-2 px-2">Payable</th><th className="py-2 px-2">Why</th>
                                </tr></thead>
                                <tbody className="divide-y divide-zinc-800/70">
                                    {days.map((d: any) => (
                                        <tr key={d.date} className="align-top" data-testid="pd-day">
                                            <td className="py-2 px-2 whitespace-nowrap text-zinc-300"><span className="font-semibold text-white">{dmy(d.date)}</span> <span className="text-zinc-500">{d.weekday}</span></td>
                                            <td className="py-2 px-2 text-zinc-300">{d.attendance}</td>
                                            <td className="py-2 px-2 text-zinc-300">{d.leave || "—"}</td>
                                            <td className={`py-2 px-2 font-bold whitespace-nowrap ${PAY_STYLE[d.payableStatus]}`}>{d.payableStatus}{d.payableStatus === "Partly Payable" ? ` (${n(d.payable)})` : ""}{d.correction && <span className="block text-[10px] font-semibold text-zinc-500">Was: {d.basePayableStatus}</span>}</td>
                                            <td className="py-2 px-2 text-zinc-400 [overflow-wrap:anywhere]">
                                                {d.correction ? (
                                                    <span className={d.correction.direction === "TO_NON_PAYABLE" ? "text-red-200" : "text-violet-200"} data-testid="pd-correction">{d.correction.direction === "TO_NON_PAYABLE" ? "Marked non-payable" : "Marked payable"} by {d.correction.correctedByRole || "HR"} ({d.correction.correctedByName}) · {dt(d.correction.correctedAt)}<span className="block text-zinc-400">Reason: {d.correction.correctionReason}</span><span className="block text-zinc-500">Original attendance: {d.attendance}{d.leave ? ` · ${d.leave}` : ""} — {d.baseReason}</span></span>
                                                ) : d.reason}
                                                {d.penalties.length > 0 && <span className="block text-[10px] text-amber-300/90 mt-0.5">Flags: {d.penalties.join(" · ")}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {days.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-zinc-500">Nothing to show.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Penalties */}
                    <Section title="My Penalties & Fines" icon={AlertTriangle} testid="pd-penalties"
                        right={<span className="text-[10px] text-zinc-500">1st, 2nd, Final warning → 4th Half-Day → 5th+ Full-Day</span>}>
                        <div className="flex flex-wrap gap-1.5 mb-3" role="tablist">
                            {([["", "All", counted.length], ["DRESS", "Dress Code Penalty", dressPen.length], ["ATTENDANCE", "Attendance Penalty", attPen.length]] as const).map(([k, l, cnt]) => (
                                <button key={l} type="button" onClick={() => setPenKind(k)} aria-pressed={penKind === k} data-testid={`pd-pen-${k || "ALL"}`}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${penKind === k ? "bg-primary text-white border-primary" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"}`}>{l} <span className="opacity-70">{cnt}</span></button>
                            ))}
                        </div>
                        {shownPen.length === 0 ? <p className="text-xs text-zinc-500 py-4 text-center">No {penKind === "DRESS" ? "dress code penalties" : penKind === "ATTENDANCE" ? "attendance penalties" : "penalties or flags"} in {data.monthLabel}.</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs min-w-[680px]">
                                    <thead><tr className="text-[10px] uppercase tracking-widest text-zinc-500 text-left">
                                        <th className="py-2 px-2">Date</th><th className="py-2 px-2">Type</th><th className="py-2 px-2">Level</th><th className="py-2 px-2">Deduction</th><th className="py-2 px-2">Status</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-zinc-800/70">
                                        {shownPen.map((p: any) => (
                                            <tr key={p.flagId} data-testid="pd-penalty">
                                                <td className="py-2 px-2 whitespace-nowrap text-white font-semibold">{dmy(p.date)}</td>
                                                <td className="py-2 px-2 text-zinc-300">{p.typeLabel}{p.instance ? <span className="text-zinc-500"> · #{p.instance}</span> : null}{p.detail && <span className="block text-[10px] text-zinc-500 [overflow-wrap:anywhere]">{p.detail}</span>}</td>
                                                <td className="py-2 px-2 text-zinc-300">{p.levelLabel || "—"}</td>
                                                <td className="py-2 px-2 text-zinc-300">{p.deduction}{p.deductedDays ? <span className="block text-[10px] text-red-300">−{n(p.deductedDays)} payable day</span> : null}</td>
                                                <td className="py-2 px-2"><span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md border ${PEN_STYLE[p.status] || PEN_STYLE.Warning}`}>{p.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {removed.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-zinc-800" data-testid="pd-removed">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Removed flags (not counted)</p>
                                <div className="space-y-1.5">
                                    {removed.map((p: any) => (
                                        <div key={p.flagId} className="text-xs text-zinc-400 flex flex-wrap gap-x-3">
                                            <span className="text-zinc-200 font-semibold">{dmy(p.date)} · {p.typeLabel}</span>
                                            <span>Removed by {p.removal?.removedByName} · {dt(p.removal?.removedAt)}</span>
                                            {p.removal?.removalReason && <span className="text-zinc-500 [overflow-wrap:anywhere]">“{p.removal.removalReason}”</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-3">Late Clock-In / Early Clock-Out / Missing Clock-Out deductions count after HR marks them “Approved for Payroll”. Dress-code deductions follow the same ladder on the month&apos;s rejected dress-code photos.</p>
                    </Section>
                </>
            )}

            {/* Tickets */}
            <Section title={`My Correction Tickets (${tickets.length})`} icon={MessageSquare} testid="pd-tickets"
                right={<button onClick={() => raise()} disabled={!c} className="text-[11px] font-bold text-primary hover:underline disabled:opacity-50">+ Raise ticket</button>}>
                {tickets.length === 0 ? <p className="text-xs text-zinc-500 py-4 text-center">You have not raised any correction ticket.</p> : (
                    <div className="space-y-2">
                        {tickets.map(t => <TicketRow key={t.id} t={t} open={openTicket === t.id} onToggle={() => setOpenTicket(openTicket === t.id ? "" : t.id)} onChanged={(m) => { setMsg({ type: "success", text: m }); loadTickets(); }} />)}
                    </div>
                )}
            </Section>

            {form && (
                <TicketForm form={form} setForm={setForm} employee={data?.employee} months={data?.months || []}
                    onDone={(m, id) => { setForm(null); setMsg({ type: "success", text: m }); setOpenTicket(id); loadTickets(); }} />
            )}
        </div>
    );
}

function TicketRow({ t, open, onToggle, onChanged }: { t: any; open: boolean; onToggle: () => void; onChanged: (m: string) => void }) {
    const [reply, setReply] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const send = async () => {
        setBusy(true); setErr("");
        try {
            const res = await fetch(`/api/my-payable-days/tickets/${encodeURIComponent(t.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: reply }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Could not send");
            setReply(""); onChanged(d.message);
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };
    return (
        <div id={`ticket-${t.id}`} className={`rounded-xl border ${open ? "border-primary/40 bg-zinc-900/70" : "border-zinc-800 bg-zinc-900/40"}`} data-testid="pd-ticket">
            <button onClick={onToggle} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left">
                <span className="font-mono text-xs font-bold text-white">{t.id}</span>
                <span className="text-xs text-zinc-300">{t.category}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${STATUS_STYLE[t.status] || ""}`} data-testid="pd-ticket-status">{t.status}</span>
                <span className="text-[10px] text-zinc-500 ml-auto">{dt(t.createdAt)}</span>
            </button>
            {open && (
                <div className="px-3 pb-3 space-y-3 text-xs">
                    <div className="grid sm:grid-cols-3 gap-2 text-zinc-300">
                        <p><span className="text-zinc-500">Month:</span> {t.month}</p>
                        <p><span className="text-zinc-500">Shown:</span> {t.currentValue || "—"}</p>
                        <p><span className="text-zinc-500">Expected:</span> {t.expectedValue || "—"}</p>
                    </div>
                    {t.affectedDates?.length > 0 && <p className="text-zinc-300"><span className="text-zinc-500">Dates:</span> {t.affectedDates.map((d: string) => dmy(d)).join(", ")}</p>}
                    <p className="text-zinc-300 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="text-zinc-500">Reason:</span> {t.reason}</p>
                    {t.evidenceUrls?.length > 0 && <div className="flex flex-wrap gap-2">{t.evidenceUrls.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-primary underline">Attachment {i + 1}</a>)}</div>}
                    {t.hrResponse && <p className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 px-3 py-2 text-indigo-100 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="text-indigo-300 font-bold">HR response:</span> {t.hrResponse}</p>}
                    {t.resolvedAt && <p className="text-zinc-400"><span className="text-zinc-500">Closed:</span> {dt(t.resolvedAt)} by {t.resolvedByName}{t.resolutionNote ? ` — ${t.resolutionNote}` : ""}</p>}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">History</p>
                        <ol className="space-y-1.5 border-l border-zinc-800 pl-3">
                            {(t.history || []).map((h: any, i: number) => (
                                <li key={i} className="text-zinc-400"><Clock size={10} className="inline -mt-0.5 mr-1" />{dt(h.at)} · <span className="text-zinc-200">{h.action}</span> · {h.byName}{h.role ? ` (${h.role})` : ""}{h.note ? <span className="block text-zinc-500 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.note}</span> : null}</li>
                            ))}
                        </ol>
                    </div>
                    {t.status === "Additional Information Required" && (
                        <div className="space-y-2">
                            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="Your reply to HR…" data-testid="pd-reply"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white" />
                            {err && <p className="text-red-400">{err}</p>}
                            <button onClick={send} disabled={busy || reply.trim().length < 3} data-testid="pd-reply-send" className="px-4 py-2 rounded-lg bg-primary text-white text-[11px] font-black uppercase disabled:opacity-50">{busy ? "Sending…" : "Send Reply"}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TicketForm({ form, setForm, employee, months, onDone }: { form: any; setForm: (f: any) => void; employee: any; months: any[]; onDone: (m: string, id: string) => void }) {
    const upd = (k: string, v: any) => setForm({ ...form, [k]: v });
    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        setForm({ ...form, uploading: true, error: "" });
        try {
            const urls: string[] = [];
            for (const f of Array.from(files).slice(0, 5 - form.evidenceUrls.length)) {
                if (!/^image\/(jpe?g|png|webp)$|^application\/pdf$/.test(f.type)) throw new Error("Upload JPG, PNG, WEBP or PDF files.");
                if (f.size > 5 * 1024 * 1024) throw new Error("Each file must be under 5 MB.");
                urls.push((await uploadToCloudinary(f)).secure_url);
            }
            setForm({ ...form, uploading: false, evidenceUrls: [...form.evidenceUrls, ...urls] });
        } catch (e: any) { setForm({ ...form, uploading: false, error: e.message || "Upload failed" }); }
    };
    const submit = async () => {
        setForm({ ...form, busy: true, error: "" });
        try {
            const res = await fetch("/api/my-payable-days/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: form.category, month: form.month, currentValue: form.currentValue, expectedValue: form.expectedValue, reason: form.reason, evidenceUrls: form.evidenceUrls, affectedDates: form.affectedDates }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Could not submit");
            onDone(d.message, d.ticket?.id);
        } catch (e: any) { setForm({ ...form, busy: false, error: e.message }); }
    };
    const field = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white";
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => !form.busy && setForm(null)}>
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4" onClick={e => e.stopPropagation()} data-testid="ticket-form">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-white flex items-center gap-2"><TicketPlus size={18} className="text-primary" /> Raise Correction Ticket</h2>
                    <button onClick={() => setForm(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] rounded-xl bg-zinc-950/60 border border-zinc-800 p-3 text-zinc-300">
                    <p><span className="text-zinc-500">Name:</span> {employee?.name}</p>
                    <p><span className="text-zinc-500">ID:</span> {employee?.id}</p>
                    <p><span className="text-zinc-500">Department:</span> {employee?.dept || "—"}</p>
                    <p><span className="text-zinc-500">Designation:</span> {employee?.designation || "—"}</p>
                    <p><span className="text-zinc-500">College:</span> {employee?.locationName || "—"}</p>
                    <p className="[overflow-wrap:anywhere]"><span className="text-zinc-500">Email:</span> {employee?.email || "—"}</p>
                </div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Issue Category
                    <select value={form.category} onChange={e => upd("category", e.target.value)} className={`${field} mt-1`} data-testid="tf-category">
                        {CATEGORIES.map(x => <option key={x}>{x}</option>)}
                    </select>
                </label>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Month / Year
                    <select value={form.month} onChange={e => setForm({ ...form, month: e.target.value, affectedDates: [] })} className={`${field} mt-1`} data-testid="tf-month">
                        {months.map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Currently Displayed
                        <input value={form.currentValue} onChange={e => upd("currentValue", e.target.value)} className={`${field} mt-1`} placeholder="e.g. 27 days" data-testid="tf-current" />
                    </label>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Expected Correct Value
                        <input value={form.expectedValue} onChange={e => upd("expectedValue", e.target.value)} className={`${field} mt-1`} placeholder="e.g. 29 days" data-testid="tf-expected" />
                    </label>
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Affected Date(s)</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <input type="date" data-testid="tf-date" min={`${form.month}-01`} max={`${form.month}-31`} className={`${field} w-auto [color-scheme:dark]`}
                            onChange={e => { const v = e.target.value; if (v && v.startsWith(form.month) && !form.affectedDates.includes(v)) upd("affectedDates", [...form.affectedDates, v].sort()); e.target.value = ""; }} />
                        {form.affectedDates.map((d: string) => <span key={d} className="text-[11px] bg-zinc-800 rounded-md px-2 py-1 text-zinc-200">{d.split("-").reverse().join("-")} <button onClick={() => upd("affectedDates", form.affectedDates.filter((x: string) => x !== d))} className="text-red-400 ml-1">×</button></span>)}
                    </div>
                </div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Reason for Correction *
                    <textarea value={form.reason} onChange={e => upd("reason", e.target.value)} rows={4} className={`${field} mt-1 normal-case tracking-normal font-normal`} placeholder="e.g. I was present on 12 and 13 October but both dates show as non-payable." data-testid="tf-reason" />
                </label>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Supporting Evidence (optional)</p>
                    <label className="flex items-center justify-center gap-2 border border-dashed border-zinc-700 rounded-lg py-3 text-xs text-zinc-400 cursor-pointer hover:border-primary">
                        {form.uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {form.uploading ? "Uploading…" : "Upload image / PDF (max 5)"}
                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={e => upload(e.target.files)} disabled={form.uploading || form.evidenceUrls.length >= 5} />
                    </label>
                    {form.evidenceUrls.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{form.evidenceUrls.map((u: string, i: number) => (
                        <span key={i} className="text-[11px] bg-zinc-800 rounded-md px-2 py-1 text-zinc-300">File {i + 1} <button onClick={() => upd("evidenceUrls", form.evidenceUrls.filter((_: any, j: number) => j !== i))} className="text-red-400 ml-1">×</button></span>
                    ))}</div>}
                </div>
                {form.error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> {form.error}</p>}
                <p className="text-[10px] text-zinc-500">Submitting a ticket does not change your attendance, leave or payable days. HR reviews it and applies any correction through the normal process.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
                    <button onClick={submit} disabled={form.busy || form.uploading || form.reason.trim().length < 10} data-testid="tf-submit"
                        className="px-5 py-2 rounded-lg bg-primary text-white text-xs font-black uppercase tracking-wider disabled:opacity-50">{form.busy ? "Submitting…" : "Submit Ticket"}</button>
                </div>
            </div>
        </div>
    );
}