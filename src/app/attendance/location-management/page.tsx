"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Loader2, Search, Trash2, Save, History, CalendarDays } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/**
 * HOI / OM Location Management — assigned colleges and date-wise (or weekday) scheduled locations.
 * HR / HR Executive / Founder: HOI and OM. AD: HOI only. Every change is in the audit log.
 * The scheduled location decides whether a clock-in needs a location justification.
 */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dmy = (d?: string) => (d && /^\d{4}/.test(d) ? d.split("-").reverse().join("-") : d || "—");
const dt = (v?: string) => (v ? new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");
const KIND: Record<string, string> = { assigned: "Assigned colleges changed", scheduled: "Scheduled location set", schedule_removed: "Scheduled location removed" };

export default function LocationManagementPage() {
    const { user } = useAuth();
    const allowed = ["HR", "FOUNDER", "AD"].includes(user?.role as string);
    const [list, setList] = useState<any | null>(null);
    const [error, setError] = useState(""); const [msg, setMsg] = useState("");
    const [q, setQ] = useState(""); const [roleF, setRoleF] = useState("");
    const [sel, setSel] = useState<string>("");
    const [detail, setDetail] = useState<any | null>(null);
    const [assigned, setAssigned] = useState<string[]>([]);
    const [sched, setSched] = useState({ kind: "date", date: "", weekday: "Mon", location: "" });
    const [busy, setBusy] = useState("");

    const loadList = useCallback(async () => {
        try {
            const r = await fetch("/api/attendance/location-management", { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load.");
            setList(d); setError("");
        } catch (e: any) { setError(e.message); }
    }, []);
    const loadDetail = useCallback(async (id: string) => {
        if (!id) { setDetail(null); return; }
        const r = await fetch(`/api/attendance/location-management?employeeId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) { setError(d.error || "Could not load."); return; }
        setDetail(d); setAssigned((d.employee.assigned || []).map((a: any) => a.id));
        setSched(s => ({ ...s, location: "" }));
    }, []);
    useEffect(() => { if (allowed) loadList(); }, [allowed, loadList]);
    useEffect(() => { setMsg(""); setError(""); loadDetail(sel); }, [sel, loadDetail]);

    const call = async (key: string, method: string, body?: any, url = "/api/attendance/location-management") => {
        setBusy(key); setError(""); setMsg("");
        try {
            const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { setError(d.error || "Could not save."); return false; }
            setMsg(d.message || "Saved."); await Promise.all([loadDetail(sel), loadList()]); return true;
        } finally { setBusy(""); }
    };
    const saveAssigned = () => { if (!assigned.length) { setError("Choose at least one college."); return; } call("assigned", "PUT", { employeeId: sel, attendanceLocations: assigned }); };
    const saveSched = () => {
        const date = sched.kind === "date" ? sched.date : sched.weekday;
        if (!date) { setError("Choose a date."); return; }
        if (!sched.location) { setError("Choose the scheduled location."); return; }
        call("sched", "POST", { employeeId: sel, date, location: sched.location });
    };
    const removeSched = (date: string) => call(`del-${date}`, "DELETE", undefined, `/api/attendance/location-management?employeeId=${encodeURIComponent(sel)}&date=${encodeURIComponent(date)}`);

    if (!user) return null;
    if (!allowed) return <div className="p-8 text-center text-zinc-500">Access Restricted: HR and AD only.</div>;
    const emps = (list?.employees || []).filter((e: any) => (!roleF || e.role === roleF) && (!q || `${e.name} ${e.id}`.toLowerCase().includes(q.toLowerCase())));
    const locs: any[] = list?.locations || [];
    const card = "bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4 sm:p-5";

    return (
        <div className="max-w-[1400px] mx-auto pt-5 pb-16 px-4 sm:px-6 space-y-4 w-full [contain:inline-size]" data-testid="loc-mgmt-page">
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2"><MapPin size={18} className="text-sky-400" /> Location Management</h1>
            <p className="text-[11px] text-zinc-500">{list?.canManageOm ? "HOI and OM" : "HOI"} assigned colleges and scheduled locations. Clocking in at another assigned college needs a justification; outside the assigned colleges the clock-in is blocked.</p>
            {error && <p className="text-[11px] text-red-400" role="alert" data-testid="lm-error">{error}</p>}
            {msg && <p className="text-[11px] text-emerald-400" role="status" data-testid="lm-msg">{msg}</p>}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                <div className={cn(card, "space-y-3 min-w-0")}>
                    <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white outline-none" /></div>
                        {list?.canManageOm && <select value={roleF} onChange={e => setRoleF(e.target.value)} aria-label="Role" className="px-2 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white"><option value="">All</option><option value="HOI">HOI</option><option value="OM">OM</option></select>}
                    </div>
                    {!list ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div> : (
                        <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto" data-testid="lm-list">
                            {emps.map((e: any) => (
                                <li key={e.id}><button onClick={() => setSel(e.id)} data-testid="lm-emp" className={cn("w-full text-left p-2.5 rounded-lg border text-xs", sel === e.id ? "border-sky-500/50 bg-sky-500/10" : "border-zinc-800 hover:border-zinc-700")}>
                                    <p className="font-bold text-white truncate">{e.name} <span className="text-zinc-500 font-normal">· {e.id} · {e.role}</span></p>
                                    <p className="text-[10px] text-zinc-400 [overflow-wrap:anywhere]">Assigned: {e.assigned.map((a: any) => a.name).join(", ") || "—"}</p>
                                    <p className="text-[10px] text-sky-300">Today: {e.todayScheduledName || "—"}</p>
                                </button></li>
                            ))}
                            {emps.length === 0 && <li className="text-xs text-zinc-500 text-center py-6">No employees.</li>}
                        </ul>
                    )}
                </div>
                <div className="space-y-4 min-w-0">
                    {!sel ? <div className={cn(card, "text-xs text-zinc-500 text-center py-12")}>Select an employee.</div> : !detail ? <div className={cn(card, "py-12 flex justify-center")}><Loader2 className="animate-spin text-zinc-500" /></div> : (<>
                        <div className={cn(card, "space-y-3")} data-testid="lm-assigned">
                            <h2 className="text-sm font-bold text-white">{detail.employee.name} <span className="text-zinc-500 font-normal">· {detail.employee.role}</span></h2>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Assigned Colleges</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
                                {locs.map(l => (
                                    <label key={l.id} className={cn("flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer min-w-0", assigned.includes(l.id) ? "border-sky-500/40 bg-sky-500/10 text-white" : "border-zinc-800 text-zinc-400")}>
                                        <input type="checkbox" checked={assigned.includes(l.id)} onChange={() => setAssigned(a => a.includes(l.id) ? a.filter(x => x !== l.id) : [...a, l.id])} data-testid={`lm-loc-${l.id}`} /><span className="truncate">{l.name}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={saveAssigned} disabled={!!busy} data-testid="lm-save-assigned" className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">{busy === "assigned" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Assigned Colleges</button>
                        </div>
                        <div className={cn(card, "space-y-3")} data-testid="lm-schedule">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><CalendarDays size={13} /> Scheduled Location</p>
                            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
                                <select value={sched.kind} onChange={e => setSched({ ...sched, kind: e.target.value })} aria-label="Schedule type" className="px-2 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white"><option value="date">Specific date</option><option value="weekday">Every weekday</option></select>
                                {sched.kind === "date"
                                    ? <input type="date" min={list?.today} value={sched.date} onChange={e => setSched({ ...sched, date: e.target.value })} data-testid="lm-date" className="px-2 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white [color-scheme:dark] min-w-0" />
                                    : <select value={sched.weekday} onChange={e => setSched({ ...sched, weekday: e.target.value })} aria-label="Weekday" className="px-2 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white">{WEEKDAYS.map(w => <option key={w}>{w}</option>)}</select>}
                                <select value={sched.location} onChange={e => setSched({ ...sched, location: e.target.value })} data-testid="lm-sched-loc" aria-label="Location" className="px-2 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs text-white min-w-0">
                                    <option value="">Choose location</option>{(detail.employee.assigned || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <button onClick={saveSched} disabled={!!busy} data-testid="lm-save-sched" className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50">{busy === "sched" ? "Saving…" : "Save"}</button>
                            </div>
                            {(detail.schedules || []).length === 0 ? <p className="text-xs text-zinc-500">No schedule entries — the Original Location is used.</p> : (
                                <ul className="divide-y divide-zinc-800/70" data-testid="lm-sched-list">
                                    {detail.schedules.map((s: any) => (
                                        <li key={s.date} className="flex items-center gap-3 py-2 text-xs">
                                            <span className="w-24 shrink-0 text-zinc-300 font-bold">{WEEKDAYS.includes(s.date) ? `Every ${s.date}` : dmy(s.date)}</span>
                                            <span className="flex-1 min-w-0 text-sky-300 [overflow-wrap:anywhere]">{s.locationName}<span className="text-zinc-500"> · {s.clockInTime}–{s.clockOutTime}</span></span>
                                            <button onClick={() => removeSched(s.date)} disabled={!!busy} aria-label="Remove" className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 disabled:opacity-50"><Trash2 size={13} /></button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className={cn(card, "space-y-2")} data-testid="lm-audit">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><History size={13} /> Audit Log</p>
                            {(detail.audit || []).length === 0 ? <p className="text-xs text-zinc-500">No changes yet.</p> : (
                                <ul className="space-y-1.5 max-h-72 overflow-y-auto text-[11px]">
                                    {detail.audit.map((a: any) => (
                                        <li key={a.id} className="text-zinc-400 [overflow-wrap:anywhere]"><span className="text-zinc-500">{dt(a.at)}</span> · <b className="text-zinc-200">{KIND[a.kind] || a.kind}</b>{a.date ? ` (${WEEKDAYS.includes(a.date) ? `every ${a.date}` : dmy(a.date)})` : ""}: {a.fromName || "—"} → {a.toName || "—"} · {a.byName}{a.byRole ? ` (${a.byRole})` : ""}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>)}
                </div>
            </div>
        </div>
    );
}