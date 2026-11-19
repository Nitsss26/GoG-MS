"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { KeySquare, Search, Shirt, Loader2, CheckCircle2, AlertTriangle, X, Eye, Ban, CalendarClock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OM → Give Access (OM Given Access). The OM lets a Professor of their college(s) or their HOI use Full Attire for
 * some days. Only Full Attire, never anything else of the OM role; the employee's own role does not change.
 * Everything (who can be chosen, dates, overlap, revoke) is checked again on the server.
 */
type Person = { id: string; name: string; role: string; roleLabel: string; designation: string; college: string };
type Grant = {
    id: string; grantedToEmployeeId: string; grantedToName: string; grantedToRole: string; grantedByName: string; startDate: string; endDate: string;
    reason?: string; createdAt: string; revokedAt?: string; revokedByName?: string; revokeKind?: string; status: "scheduled" | "active" | "expired" | "revoked"; days: number;
};
const DURATIONS = [{ k: "1", l: "Today Only", n: 1 }, { k: "2", l: "2 Days", n: 2 }, { k: "3", l: "3 Days", n: 3 }, { k: "custom", l: "Custom Date Range", n: 0 }];
const TABS = [{ k: "active", l: "Active Access" }, { k: "scheduled", l: "Scheduled Access" }, { k: "expired", l: "Expired Access" }, { k: "all", l: "Access History" }] as const;
const ST: Record<Grant["status"], string> = {
    active: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", scheduled: "text-sky-300 bg-sky-500/10 border-sky-500/25",
    expired: "text-zinc-400 bg-zinc-800/60 border-zinc-700", revoked: "text-red-300 bg-red-500/10 border-red-500/25",
};
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
const day = (ymd: string, long = false) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...(long ? { weekday: "short", day: "2-digit", month: "short", year: "numeric" } : { day: "2-digit", month: "short" }) }) : "—");
const range = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);
const stLabel = (g: Grant) => (g.status === "revoked" ? (g.revokeKind === "cancelled" ? "Cancelled" : "Revoked") : g.status[0].toUpperCase() + g.status.slice(1));
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—");

export default function OmGiveAccessPage() {
    const { user } = useAuth();
    const [data, setData] = useState<{ today: string; eligible: Person[]; grants: Grant[]; maxDays: number } | null>(null);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [pick, setPick] = useState<Person | null>(null);
    const [dur, setDur] = useState("1");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [reason, setReason] = useState("");
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("active");
    const [view, setView] = useState<Grant | null>(null);
    const [revoke, setRevoke] = useState<Grant | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/temp-access", { cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not load");
            setData(d); setError("");
            setStart(s => s || d.today); setEnd(e => e || d.today);
        } catch (e: any) { setError(e.message); }
    }, []);
    useEffect(() => { if (user?.role === "OM") load(); }, [user?.role, load]);

    const today = data?.today || "";
    const preset = DURATIONS.find(x => x.k === dur)!;
    // presets fill the end date from the start date; Custom lets both be chosen
    useEffect(() => { if (preset.n && start) setEnd(addDays(start, preset.n - 1)); }, [dur, start]); // eslint-disable-line react-hooks/exhaustive-deps
    const days = start && end ? nDays(start, end) : 0;
    const dateErr = !start || !end ? "Choose the dates." : start < today ? "The start date cannot be in the past." : end < start ? "The end date must be on or after the start date." : days > (data?.maxDays || 31) ? `At most ${data?.maxDays || 31} days at a time.` : "";
    const shownPeople = (data?.eligible || []).filter(p => !q.trim() || `${p.name} ${p.id} ${p.roleLabel} ${p.college}`.toLowerCase().includes(q.trim().toLowerCase()));
    const list = useMemo(() => (data?.grants || []).filter(g => tab === "all" || g.status === tab), [data, tab]);
    const count = (k: string) => (data?.grants || []).filter(g => k === "all" || g.status === k).length;

    if (!user) return null;
    if (user.role !== "OM") return <div className="p-8 text-center text-sm text-zinc-500" data-testid="ga-denied">Give Access is for Operations Managers.</div>;

    const give = async () => {
        if (!pick) return;
        setBusy(true); setMsg(null);
        try {
            const r = await fetch("/api/temp-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: pick.id, startDate: start, endDate: end, ...(reason.trim() ? { reason: reason.trim() } : {}) }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not give access");
            setMsg({ ok: true, text: `${pick.name} has Full Attire access ${start === end ? `on ${day(start, true)}` : `from ${day(start, true)} to ${day(end, true)}`}.` });
            setConfirm(false); setPick(null); setReason(""); setDur("1"); setStart(today); setEnd(today);
            setTab(start <= today ? "active" : "scheduled");
            await load();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); setConfirm(false); }
        finally { setBusy(false); }
    };
    const doRevoke = async (g: Grant) => {
        setBusy(true); setMsg(null);
        try {
            const r = await fetch("/api/temp-access", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: g.id, action: "revoke" }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not revoke");
            setMsg({ ok: true, text: g.status === "scheduled" ? `Scheduled access of ${g.grantedToName} cancelled.` : `Access of ${g.grantedToName} revoked — it stops working now.` });
            setRevoke(null); await load();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); setRevoke(null); }
        finally { setBusy(false); }
    };
    const resetForm = () => { setPick(null); setQ(""); setDur("1"); setStart(today); setEnd(today); setReason(""); setMsg(null); };
    const field = "w-full h-10 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white outline-none focus:border-primary [color-scheme:dark]";

    return (
        <div className="p-3 sm:p-6 space-y-5 max-w-5xl mx-auto w-full [contain:inline-size]" data-testid="om-give-access">
            <header className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2"><KeySquare size={20} className="text-primary" /> Give Access</h1>
                <p className="text-xs text-zinc-400">Let a Professor of your college or your HOI use <b className="text-zinc-200">Full Attire</b> for a few days — for example when you are on leave. Nothing else of your role is given, and their own role does not change.</p>
            </header>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-xs">{error}</p>}
            {msg && <p className={cn("rounded-xl border px-4 py-3 text-xs flex items-start gap-2", msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200")} data-testid="ga-msg">{msg.ok ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}<span className="min-w-0 [overflow-wrap:anywhere]">{msg.text}</span></p>}
            {!data && !error && <p className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}

            {data && (<>
                {/* Give New Access */}
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5 space-y-4" data-testid="ga-form">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Give New Access</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2 min-w-0">
                            <p className="text-xs font-bold text-zinc-300">Select Employee</p>
                            {pick ? (
                                <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5" data-testid="ga-picked">
                                    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white truncate">{pick.name}</p><p className="text-[11px] text-zinc-400 truncate">{pick.id} · {pick.roleLabel} · {pick.college || "—"}</p></div>
                                    <button type="button" onClick={() => setPick(null)} className="text-zinc-400 hover:text-white" aria-label="Change employee" data-testid="ga-unpick"><X size={15} /></button>
                                </div>
                            ) : (<>
                                <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, ID or college" data-testid="ga-search" className={cn(field, "pl-9")} /></div>
                                <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800/70" data-testid="ga-people">
                                    {!shownPeople.length && <p className="p-3 text-xs text-zinc-500">{data.eligible.length ? "No match." : "No Professor or HOI in your college scope."}</p>}
                                    {shownPeople.map(p => (
                                        <button key={p.id} type="button" onClick={() => setPick(p)} data-testid="ga-person" data-id={p.id} className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/60 flex items-center gap-3">
                                            <div className="min-w-0 flex-1"><p className="text-sm text-white truncate">{p.name}</p><p className="text-[11px] text-zinc-500 truncate">{p.id} · {p.college || "—"}</p></div>
                                            <span className={cn("shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold", p.role === "HOI" ? "border-purple-500/30 text-purple-300" : "border-pink-500/30 text-pink-300")}>{p.roleLabel}</span>
                                        </button>
                                    ))}
                                </div>
                            </>)}
                        </div>
                        <div className="space-y-3 min-w-0">
                            <div>
                                <p className="text-xs font-bold text-zinc-300 mb-1">Access Type</p>
                                <p className="h-10 px-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-200 flex items-center gap-2" data-testid="ga-type"><Shirt size={14} className="text-primary" /> Full Attire</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-zinc-300 mb-1">Access Duration</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="radiogroup">
                                    {DURATIONS.map(d => (
                                        <button key={d.k} type="button" role="radio" aria-checked={dur === d.k} onClick={() => setDur(d.k)} data-testid={`ga-dur-${d.k}`}
                                            className={cn("h-9 px-2 rounded-lg border text-[11px] font-bold", dur === d.k ? "border-primary/50 bg-primary/15 text-primary" : "border-zinc-800 text-zinc-400 hover:text-white")}>{d.l}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="text-[11px] text-zinc-400">Start Date
                                    <input type="date" value={start} min={today} onChange={e => setStart(e.target.value)} data-testid="ga-start" className={cn(field, "mt-1")} /></label>
                                <label className="text-[11px] text-zinc-400">End Date
                                    <input type="date" value={end} min={start || today} disabled={dur !== "custom"} onChange={e => setEnd(e.target.value)} data-testid="ga-end" className={cn(field, "mt-1 disabled:opacity-60")} /></label>
                            </div>
                            <p className={cn("text-[11px] flex items-center gap-1.5", dateErr ? "text-amber-300" : "text-zinc-300")} data-testid="ga-validity">
                                <CalendarClock size={13} className="shrink-0" />
                                {dateErr || <>Valid {start === end ? `on ${day(start, true)}` : <>from <b>{day(start, true)}</b> to <b>{day(end, true)}</b></>} ({days} day{days > 1 ? "s" : ""}), ending at midnight.</>}
                            </p>
                            <label className="block text-[11px] text-zinc-400">Reason (optional)
                                <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={300} rows={2} data-testid="ga-reason" className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-white outline-none focus:border-primary" /></label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300" data-testid="ga-cancel">Cancel</button>
                        <button type="button" onClick={() => setConfirm(true)} disabled={!pick || !!dateErr || busy} data-testid="ga-give"
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5"><KeySquare size={13} /> Give Access</button>
                    </div>
                </section>

                {/* grants */}
                <section className="space-y-3">
                    <div className="flex flex-wrap gap-1.5" role="tablist">
                        {TABS.map(t => (
                            <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)} data-testid={`ga-tab-${t.k}`}
                                className={cn("px-3 py-1.5 rounded-full border text-[11px] font-bold", tab === t.k ? "border-primary/40 bg-primary/15 text-primary" : "border-zinc-800 text-zinc-400 hover:text-white")}>{t.l} <span className="opacity-70">{count(t.k)}</span></button>
                        ))}
                    </div>
                    {!list.length ? <p className="text-sm text-zinc-500 py-6 text-center" data-testid="ga-empty">Nothing here.</p> : (<>
                        <div className="hidden md:block rounded-2xl border border-zinc-800 overflow-hidden" data-testid="ga-table">
                            <table className="w-full text-xs">
                                <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="text-left px-4 py-2.5">Employee</th><th className="text-left px-3 py-2.5">Role</th><th className="text-left px-3 py-2.5">Duration</th><th className="text-left px-3 py-2.5">Status</th><th className="text-right px-4 py-2.5">Actions</th></tr></thead>
                                <tbody className="divide-y divide-zinc-800/70">
                                    {list.map(g => (
                                        <tr key={g.id} data-testid="ga-row" data-id={g.id} data-status={g.status}>
                                            <td className="px-4 py-2.5"><p className="text-white font-medium">{g.grantedToName}</p><p className="text-[10px] text-zinc-500">{g.grantedToEmployeeId}</p></td>
                                            <td className="px-3 py-2.5 text-zinc-300">{g.grantedToRole === "HOI" ? "HOI" : "Professor"}</td>
                                            <td className="px-3 py-2.5 text-zinc-300">{range(g.startDate, g.endDate)} <span className="text-zinc-500">({g.days}d)</span></td>
                                            <td className="px-3 py-2.5"><span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", ST[g.status])} data-testid="ga-status">{stLabel(g)}</span></td>
                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                <button type="button" onClick={() => setView(g)} className="px-2 py-1 rounded-md border border-zinc-700 text-[11px] text-zinc-300 inline-flex items-center gap-1" data-testid="ga-view"><Eye size={12} /> View</button>
                                                {(g.status === "active" || g.status === "scheduled") && <button type="button" onClick={() => setRevoke(g)} className="ml-1.5 px-2 py-1 rounded-md border border-red-500/30 text-[11px] text-red-300 inline-flex items-center gap-1" data-testid="ga-revoke"><Ban size={12} /> {g.status === "scheduled" ? "Cancel" : "Revoke"}</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="md:hidden space-y-2" data-testid="ga-cards">
                            {list.map(g => (
                                <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2" data-testid="ga-card" data-status={g.status}>
                                    <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm text-white font-medium [overflow-wrap:anywhere]">{g.grantedToName}</p><p className="text-[10px] text-zinc-500">{g.grantedToEmployeeId} · {g.grantedToRole === "HOI" ? "HOI" : "Professor"}</p></div>
                                        <span className={cn("shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold", ST[g.status])}>{stLabel(g)}</span></div>
                                    <p className="text-xs text-zinc-300">{range(g.startDate, g.endDate)} ({g.days}d)</p>
                                    <div className="flex gap-1.5">
                                        <button type="button" onClick={() => setView(g)} className="px-2.5 py-1.5 rounded-md border border-zinc-700 text-[11px] text-zinc-300 inline-flex items-center gap-1"><Eye size={12} /> View</button>
                                        {(g.status === "active" || g.status === "scheduled") && <button type="button" onClick={() => setRevoke(g)} className="px-2.5 py-1.5 rounded-md border border-red-500/30 text-[11px] text-red-300 inline-flex items-center gap-1" data-testid="ga-revoke-m"><Ban size={12} /> {g.status === "scheduled" ? "Cancel" : "Revoke"}</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>)}
                </section>
            </>)}

            {/* confirm give */}
            {confirm && pick && (
                <Modal onClose={() => !busy && setConfirm(false)} title="Give Full Attire access?" testId="ga-confirm">
                    <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-xs">
                        <dt className="text-zinc-500">Employee</dt><dd className="text-white font-bold [overflow-wrap:anywhere]">{pick.name} <span className="font-normal text-zinc-500">({pick.id})</span></dd>
                        <dt className="text-zinc-500">Role</dt><dd className="text-zinc-200">{pick.roleLabel}</dd>
                        <dt className="text-zinc-500">Access</dt><dd className="text-zinc-200">Full Attire</dd>
                        <dt className="text-zinc-500">Valid</dt><dd className="text-zinc-200" data-testid="ga-confirm-dates">{start === end ? day(start, true) : `${day(start, true)} – ${day(end, true)}`} ({days} day{days > 1 ? "s" : ""})</dd>
                        {reason.trim() && <><dt className="text-zinc-500">Reason</dt><dd className="text-zinc-300 [overflow-wrap:anywhere]">{reason.trim()}</dd></>}
                    </dl>
                    <p className="text-[11px] text-zinc-500">{pick.name.split(" ")[0]} will see “OM Given Access → Full Attire” in the sidebar for these days and can submit Full Attire photos to HR like you. It stops automatically after {day(end, true)}.</p>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300">Back</button>
                        <button type="button" onClick={give} disabled={busy} data-testid="ga-confirm-ok" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirm</button>
                    </div>
                </Modal>
            )}
            {revoke && (
                <Modal onClose={() => !busy && setRevoke(null)} title={revoke.status === "scheduled" ? "Cancel this scheduled access?" : "Revoke this access?"} testId="ga-revoke-confirm">
                    <p className="text-xs text-zinc-300">{revoke.grantedToName} · Full Attire · {range(revoke.startDate, revoke.endDate)}</p>
                    <p className="text-[11px] text-zinc-500">{revoke.status === "scheduled" ? "It will not start." : "It stops working immediately."} Photos already submitted stay with HR. Access from another OM is not affected.</p>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setRevoke(null)} disabled={busy} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300">Back</button>
                        <button type="button" onClick={() => doRevoke(revoke)} disabled={busy} data-testid="ga-revoke-ok" className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-bold inline-flex items-center gap-1.5">{busy && <Loader2 size={13} className="animate-spin" />}{revoke.status === "scheduled" ? "Cancel Access" : "Revoke Access"}</button>
                    </div>
                </Modal>
            )}
            {view && (
                <Modal onClose={() => setView(null)} title="Access details" testId="ga-details">
                    <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-xs">
                        <dt className="text-zinc-500">Employee</dt><dd className="text-white [overflow-wrap:anywhere]">{view.grantedToName} ({view.grantedToEmployeeId})</dd>
                        <dt className="text-zinc-500">Role</dt><dd className="text-zinc-200">{view.grantedToRole === "HOI" ? "HOI" : "Professor"}</dd>
                        <dt className="text-zinc-500">Access</dt><dd className="text-zinc-200">Full Attire</dd>
                        <dt className="text-zinc-500">Dates</dt><dd className="text-zinc-200">{day(view.startDate, true)} – {day(view.endDate, true)} ({view.days} day{view.days > 1 ? "s" : ""})</dd>
                        <dt className="text-zinc-500">Status</dt><dd><span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", ST[view.status])}>{stLabel(view)}</span></dd>
                        <dt className="text-zinc-500">Given by</dt><dd className="text-zinc-200">{view.grantedByName} · {dt(view.createdAt)}</dd>
                        {view.reason && <><dt className="text-zinc-500">Reason</dt><dd className="text-zinc-300 [overflow-wrap:anywhere]">{view.reason}</dd></>}
                        {view.revokedAt && <><dt className="text-zinc-500">{view.revokeKind === "cancelled" ? "Cancelled" : "Revoked"}</dt><dd className="text-zinc-200">{view.revokedByName} · {dt(view.revokedAt)}</dd></>}
                        <dt className="text-zinc-500">Grant ID</dt><dd className="text-zinc-400 font-mono [overflow-wrap:anywhere]">{view.id}</dd>
                    </dl>
                </Modal>
            )}
        </div>
    );
}

function Modal({ title, children, onClose, testId }: { title: string; children: React.ReactNode; onClose: () => void; testId: string }) {
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" data-testid={testId}>
                <div className="flex items-start justify-between gap-3"><h2 className="text-base font-bold text-white">{title}</h2><button type="button" onClick={onClose} className="text-zinc-500 hover:text-white" aria-label="Close"><X size={16} /></button></div>
                {children}
            </div>
        </div>
    );
}