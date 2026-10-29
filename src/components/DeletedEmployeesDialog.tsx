"use client";

import { useEffect, useState } from "react";
import { X, Loader2, UserX, Search, Clock, ChevronLeft, AlertTriangle, Mail, Phone, Briefcase, Building2, MapPin, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Workforce → Deleted Employees: employees removed from the portal. Their full details stay for 2 months after
 * the removal, then the employee and all their records are deleted from the database automatically.
 */
const dt = (s?: string) => {
    if (!s) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("-");
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};
const HIDE = new Set(["_id", "password", "removalSnapshot", "isRemoved", "monthlyScores", "fines", "onboardingChecklist", "postOnboardingChecklist", "linkedEmployeeIds", "attendanceLocationLog"]);
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
const show = (v: any): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) return v.length ? v.map(x => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—";
    if (typeof v === "object") return JSON.stringify(v);
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dt(v);
    return String(v);
};

function Countdown({ days, at }: { days: number | null; at: string | null }) {
    if (days === null) return <span className="text-[10px] text-zinc-500">Not scheduled</span>;
    return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap", days <= 7 ? "text-red-300 border-red-500/30 bg-red-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10")} title={`Deleted automatically on ${dt(at || "")}`}>{days} day{days === 1 ? "" : "s"} left · {dt(at || "")}</span>;
}

export default function DeletedEmployeesDialog({ onClose }: { onClose: () => void }) {
    const [list, setList] = useState<any[] | null>(null);
    const [keepDays, setKeepDays] = useState(60);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState<any>(null);
    const [loadingOne, setLoadingOne] = useState("");

    useEffect(() => {
        fetch("/api/hr/deleted-employees", { cache: "no-store" }).then(async r => {
            const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load deleted employees.");
            setList(d.employees || []); setKeepDays(d.keepDays || 60);
        }).catch(e => { setError(e.message); setList([]); });
    }, []);

    const openOne = async (id: string) => {
        setLoadingOne(id); setError("");
        try {
            const r = await fetch(`/api/hr/deleted-employees?id=${encodeURIComponent(id)}`, { cache: "no-store" });
            const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load the details.");
            setOpen(d);
        } catch (e: any) { setError(e.message); } finally { setLoadingOne(""); }
    };

    const shown = (list || []).filter(e => !q || `${e.name} ${e.id} ${e.email}`.toLowerCase().includes(q.toLowerCase()));
    const emp = open?.employee;
    return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" data-testid="deleted-employees">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3 shrink-0">
                    {open && <button onClick={() => setOpen(null)} className="text-zinc-400 hover:text-white" aria-label="Back"><ChevronLeft size={18} /></button>}
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><UserX size={18} className="text-red-400" /> {open ? emp?.name : "Deleted Employees"}</h2>
                    <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>
                <p className="px-5 pt-3 text-[11px] text-zinc-400 flex items-center gap-1.5"><Clock size={12} className="text-amber-400" /> Removed employees are kept here for {keepDays} days after removal. After that, the employee and all their records are deleted from the database automatically.</p>
                {error && <p className="px-5 pt-2 text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</p>}

                {!open ? (
                    <div className="p-5 space-y-3 overflow-y-auto">
                        <div className="relative max-w-sm">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, ID or email" className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-zinc-600" />
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-zinc-800">
                            <table className="w-full text-xs min-w-[900px]">
                                <thead><tr className="bg-zinc-800/40 text-[9px] text-zinc-400 uppercase tracking-widest text-left">
                                    {["Employee", "Role", "Removed On", "Last Working Day", "Reason", "Removed By", "Auto Delete", ""].map(h => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}
                                </tr></thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                    {list === null && <tr><td colSpan={8} className="py-8 text-center"><Loader2 size={16} className="animate-spin text-zinc-500 inline" /></td></tr>}
                                    {list !== null && !shown.length && <tr><td colSpan={8} className="py-8 text-center text-zinc-500">No deleted employees.</td></tr>}
                                    {shown.map(e => (
                                        <tr key={e.id} className="hover:bg-zinc-800/20" data-testid="deleted-row" data-id={e.id}>
                                            <td className="px-3 py-2.5"><p className="font-bold text-white">{e.name}</p><p className="text-[10px] text-zinc-500 font-mono">{e.id} · {e.email}</p></td>
                                            <td className="px-3 py-2.5 text-zinc-300">{e.designation || e.role}</td>
                                            <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{dt(e.removedAt)}</td>
                                            <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{dt(e.lastWorkingDay)}</td>
                                            <td className="px-3 py-2.5 text-zinc-300">{e.leavingReason || "—"}</td>
                                            <td className="px-3 py-2.5 text-zinc-400">{e.removedByName || "—"}</td>
                                            <td className="px-3 py-2.5"><Countdown days={e.daysLeft} at={e.autoDeleteAt} /></td>
                                            <td className="px-3 py-2.5 text-right"><button onClick={() => openOne(e.id)} data-testid="deleted-view" className="text-[10px] font-bold text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 hover:border-zinc-500">{loadingOne === e.id ? <Loader2 size={11} className="animate-spin inline" /> : "View details"}</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="deleted-details">
                        <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-white">{emp.name} <span className="text-[11px] font-mono text-zinc-500">{emp.id}</span></p><Countdown days={open.daysLeft} at={open.autoDeleteAt} /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-zinc-300">
                                <p className="flex items-center gap-1.5"><Mail size={11} className="text-zinc-500" /> {emp.email || "—"}</p>
                                <p className="flex items-center gap-1.5"><Phone size={11} className="text-zinc-500" /> {emp.phone || "—"}</p>
                                <p className="flex items-center gap-1.5"><Briefcase size={11} className="text-zinc-500" /> {emp.designation || "—"} ({emp.removalSnapshot?.role || emp.role})</p>
                                <p className="flex items-center gap-1.5"><Building2 size={11} className="text-zinc-500" /> {emp.dept || "—"}</p>
                                <p className="flex items-center gap-1.5"><MapPin size={11} className="text-zinc-500" /> {open.lastLocation || "—"}</p>
                                <p className="flex items-center gap-1.5"><CalendarDays size={11} className="text-zinc-500" /> Joined {dt(emp.joiningDate)}</p>
                            </div>
                            <p className="text-[11px] text-zinc-400">Reporting to (at removal): {open.lastManagers?.length ? open.lastManagers.join(", ") : "—"}</p>
                            <p className="text-[11px] text-zinc-400">Removed on {dt(emp.removedAt)} by {emp.removedByName || "—"} · Status {emp.status}</p>
                            <div className="grid grid-cols-5 gap-2 pt-1">
                                {Object.entries(open.records || {}).map(([k, v]) => <div key={k} className="rounded-lg border border-zinc-800 p-2 text-center"><p className="text-sm font-bold text-white">{String(v)}</p><p className="text-[9px] uppercase tracking-wider text-zinc-500">{label(k)}</p></div>)}
                            </div>
                        </section>
                        <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-1.5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Exit checklist</p>
                            {open.exit ? ([
                                ["Last working day", dt(open.exit.lastWorkingDay)], ["Reason", open.exit.leavingReason === "Other" ? open.exit.leavingReasonOther : open.exit.leavingReason],
                                ["Offer / experience letter sent", open.exit.documentsSent], ["Salary settled", open.exit.salarySettled], ["Assets returned", open.exit.assetsReturned],
                                ["Reimbursements cleared", open.exit.reimbursementsCleared], ["Remarks", open.exit.remarks], ["Completed by", `${open.exit.completedByName || "—"} · ${dt(open.exit.completedAt)}`],
                            ] as [string, any][]).map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-[11px]"><span className="text-zinc-500">{k}</span><span className="text-zinc-200 text-right">{v === "YES" ? "Yes" : v === "NO" ? "No" : v || "—"}</span></div>)
                                : <p className="text-[11px] text-zinc-500">No exit checklist found.</p>}
                        </section>
                        <section className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">All details</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                {Object.entries(emp).filter(([k, v]) => !HIDE.has(k) && v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-3 text-[11px] border-b border-zinc-800/50 py-1"><span className="text-zinc-500 shrink-0">{label(k)}</span><span className="text-zinc-200 text-right break-all">{show(v)}</span></div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}