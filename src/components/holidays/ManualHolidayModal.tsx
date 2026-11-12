"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CalendarPlus, X, Loader2, Search, Building2, Globe, Users, CheckCircle2, AlertTriangle, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PlanRow = { target: string; label: string; date: string; status: "NEW" | "ALREADY"; existingName: string };
const dmy = (ymd: string) => (ymd ? ymd.split("-").reverse().join("-") : "");
const INACTIVE = /inactive|terminated|resigned|exited|relieved|left|removed|separated/i;

/**
 * HR / HR Executive / Founder: assign a holiday without any e-mail or announcement.
 * All colleges, selected colleges, or particular employees · From – To · days that already have a holiday show "Already assigned".
 */
export default function ManualHolidayModal({ onClose }: { onClose: () => void }) {
    const { colleges, employees, reloadHolidaysAndNotices } = useAuth();
    const [form, setForm] = useState({ name: "", date: "", endDate: "", reason: "" });
    const [scope, setScope] = useState<"ALL" | "COLLEGES" | "EMPLOYEES">("COLLEGES");
    const [colSel, setColSel] = useState<string[]>([]);
    const [empSel, setEmpSel] = useState<string[]>([]);
    const [q, setQ] = useState("");
    const [plan, setPlan] = useState<PlanRow[] | null>(null);
    const [checking, setChecking] = useState(false);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState("");

    const activeEmps = useMemo(() => (employees || []).filter((e: any) => !e.isRemoved && !INACTIVE.test(String(e.status || "")) && e.role !== "FOUNDER")
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))), [employees]);
    const colName = (id?: string) => colleges.find(c => c.id === id || c.name === id || c.shortName === id)?.name || id || "—";
    const term = q.trim().toLowerCase();
    const colList = colleges.filter(c => !term || `${c.name} ${c.shortName || ""}`.toLowerCase().includes(term));
    const empList = activeEmps.filter((e: any) => !term || `${e.name} ${e.id} ${e.role} ${colName(e.location)}`.toLowerCase().includes(term)).slice(0, 200);
    const to = form.endDate || form.date;
    const days = form.date && to >= form.date ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${form.date}T00:00:00Z`)) / 86400000) + 1 : 0;

    const problem = () => {
        if (form.name.trim().length < 2) return "Enter the holiday name.";
        if (!form.date) return "Select the From date.";
        if (form.endDate && form.endDate < form.date) return 'The "To" date cannot be before the "From" date.';
        if (days > 31) return "A holiday can cover at most 31 days.";
        if (scope === "COLLEGES" && !colSel.length) return "Select at least one college.";
        if (scope === "EMPLOYEES" && !empSel.length) return "Select at least one employee.";
        return "";
    };
    const payload = () => ({ name: form.name.trim(), date: form.date, endDate: form.endDate && form.endDate !== form.date ? form.endDate : "", scope, collegeIds: scope === "COLLEGES" ? colSel : [], employeeIds: scope === "EMPLOYEES" ? empSel : [], reason: form.reason.trim() });

    // Live check: which college / person already has a holiday on these dates
    const key = JSON.stringify(payload());
    useEffect(() => {
        setPlan(null);
        if (problem()) return;
        let live = true; setChecking(true);
        const t = setTimeout(async () => {
            try {
                const r = await fetch("/api/holidays/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(), preview: true }) });
                const d = await r.json().catch(() => ({}));
                if (!live) return;
                if (!r.ok) { setErr(d.error || "Could not check the dates."); setPlan(null); } else { setErr(""); setPlan(d.plan || []); }
            } finally { if (live) setChecking(false); }
        }, 350);
        return () => { live = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const groups = useMemo(() => {
        const m = new Map<string, { label: string; fresh: PlanRow[]; already: PlanRow[] }>();
        (plan || []).forEach(p => { const g = m.get(p.target) || { label: p.label, fresh: [], already: [] }; (p.status === "NEW" ? g.fresh : g.already).push(p); m.set(p.target, g); });
        return Array.from(m.entries());
    }, [plan]);
    const newCount = (plan || []).filter(p => p.status === "NEW").length;
    const alreadyCount = (plan || []).length - newCount;

    const assign = async () => {
        const p = problem(); if (p) { setErr(p); return; }
        setBusy(true); setErr("");
        try {
            const r = await fetch("/api/holidays/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { setErr(d.error || "Could not assign the holiday."); if (d.plan) setPlan(d.plan); return; }
            await reloadHolidaysAndNotices();
            setDone(d.message || "Holiday assigned.");
        } finally { setBusy(false); }
    };

    const field = "w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-primary/50";
    const label = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5";
    const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" data-testid="manual-hol-modal">
            <div className="absolute inset-0 bg-black/80" onClick={() => !busy && onClose()} />
            <div className="relative w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl">
                <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2"><CalendarPlus size={16} className="text-primary" /> Manually Assign Holiday</h2>
                    <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400" aria-label="Close"><X size={16} /></button>
                </div>
                {done ? (
                    <div className="p-6 text-center space-y-3" data-testid="manual-hol-done">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto"><CheckCircle2 size={22} /></div>
                        <p className="text-sm font-bold text-white">{done}</p>
                        <p className="text-[11px] text-zinc-500">It now shows as a holiday in attendance, payable days / salary and calendars.</p>
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-white">Close</button>
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 space-y-4">
                        <p className="flex items-start gap-2 text-[11px] text-sky-200 bg-sky-500/5 border border-sky-500/20 rounded-lg px-3 py-2"><BellOff size={13} className="shrink-0 mt-0.5" /> No e-mail and no announcement is sent. The holiday is only added to the calendar.</p>
                        <div><label className={label} htmlFor="mh-name">Holiday Name *</label><input id="mh-name" data-testid="mh-name" maxLength={200} placeholder="e.g. Diwali" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={field} /></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={label} htmlFor="mh-from">From Date *</label><input id="mh-from" type="date" data-testid="mh-from" value={form.date} onChange={e => setForm({ ...form, date: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? "" : form.endDate })} className={cn(field, "[color-scheme:dark]")} /></div>
                            <div><label className={label} htmlFor="mh-to">To Date <span className="normal-case tracking-normal font-normal">(optional)</span></label><input id="mh-to" type="date" data-testid="mh-to" min={form.date || undefined} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={cn(field, "[color-scheme:dark]")} /></div>
                            {days > 0 && <p className="sm:col-span-2 text-[11px] text-zinc-400 -mt-1" data-testid="mh-days">{days === 1 ? "1 day" : `${days} days (${dmy(form.date)} to ${dmy(to)})`}</p>}
                        </div>
                        <div>
                            <label className={label}>Assign To *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup">
                                {([["ALL", "All colleges", Globe], ["COLLEGES", "Select college(s)", Building2], ["EMPLOYEES", "Particular employee(s)", Users]] as const).map(([k, l, Icon]) => (
                                    <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => { setScope(k); setQ(""); }} data-testid={`mh-scope-${k}`}
                                        className={cn("flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left", scope === k ? "border-primary/50 bg-primary/10 text-white" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}><Icon size={14} className="shrink-0" /> {l}</button>
                                ))}
                            </div>
                        </div>
                        {scope !== "ALL" && (
                            <div className="space-y-2">
                                <div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={q} onChange={e => setQ(e.target.value)} data-testid="mh-search" placeholder={scope === "COLLEGES" ? "Search colleges" : "Search by name, employee ID, role or college"} className={cn(field, "pl-8")} /></div>
                                {scope === "COLLEGES" ? (
                                    <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/60 p-1" data-testid="mh-college-list">
                                        <label className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-700/50 text-xs font-bold text-primary cursor-pointer"><input type="checkbox" checked={colleges.length > 0 && colSel.length === colleges.length} onChange={() => setColSel(colSel.length === colleges.length ? [] : colleges.map(c => c.id))} /> Select all colleges</label>
                                        {colList.map(c => <label key={c.id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-700/50 text-xs text-zinc-200 cursor-pointer"><input type="checkbox" checked={colSel.includes(c.id)} onChange={() => toggle(colSel, setColSel, c.id)} data-testid={`mh-col-${c.id}`} /> <span className="[overflow-wrap:anywhere]">{c.name}</span></label>)}
                                    </div>
                                ) : (
                                    <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/60 p-1" data-testid="mh-emp-list">
                                        {empList.length === 0 && <p className="px-2 py-3 text-xs text-zinc-500">No employee found.</p>}
                                        {empList.map((e: any) => (
                                            <label key={e.id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-700/50 text-xs text-zinc-200 cursor-pointer">
                                                <input type="checkbox" checked={empSel.includes(e.id)} onChange={() => toggle(empSel, setEmpSel, e.id)} data-testid={`mh-emp-${e.id}`} />
                                                <span className="min-w-0"><span className="font-semibold text-white">{e.name}</span> <span className="text-zinc-500 font-mono text-[10px]">{e.id}</span><span className="block text-[10px] text-zinc-500 [overflow-wrap:anywhere]">{String(e.role || "").replace(/_/g, " ")} · {colName(e.location)}</span></span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {(scope === "COLLEGES" ? colSel.length : empSel.length) > 0 && <p className="text-[11px] text-zinc-400" data-testid="mh-selected">{scope === "COLLEGES" ? `${colSel.length} college${colSel.length === 1 ? "" : "s"} selected — every professor / OM / employee of ${colSel.length === 1 ? "it" : "them"} gets the holiday` : `${empSel.length} employee${empSel.length === 1 ? "" : "s"} selected — the holiday is only for ${empSel.length === 1 ? "this person" : "these people"}`}</p>}
                            </div>
                        )}
                        <div><label className={label} htmlFor="mh-reason">Reason / Note <span className="normal-case tracking-normal font-normal">(optional)</span></label><input id="mh-reason" data-testid="mh-reason" maxLength={500} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className={field} placeholder="e.g. Re-adding the Diwali holiday" /></div>

                        {/* Check result */}
                        {checking && <p className="flex items-center gap-2 text-[11px] text-zinc-400"><Loader2 size={13} className="animate-spin" /> Checking the dates…</p>}
                        {plan && !checking && (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 space-y-2" data-testid="mh-plan">
                                <p className="text-[11px] font-bold text-zinc-300">{newCount} day{newCount === 1 ? "" : "s"} will be added{alreadyCount ? ` · ${alreadyCount} already assigned (skipped)` : ""}</p>
                                <div className="max-h-56 overflow-y-auto space-y-2">
                                    {groups.map(([k, g]) => (
                                        <div key={k} className="text-[11px]" data-testid="mh-plan-row">
                                            <p className="font-semibold text-white [overflow-wrap:anywhere]">{g.label}</p>
                                            {g.fresh.length > 0 && <p className="text-emerald-300">New: {g.fresh.map(p => dmy(p.date)).join(", ")}</p>}
                                            {g.already.length > 0 && <p className="text-amber-300" data-testid="mh-already"><AlertTriangle size={11} className="inline -mt-0.5 mr-1" />Already assigned: {g.already.map(p => `${dmy(p.date)}${p.existingName ? ` (${p.existingName})` : ""}`).join(", ")}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {err && <p className="text-[11px] text-red-400" role="alert" data-testid="mh-error">{err}</p>}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Cancel</button>
                            <button onClick={assign} disabled={busy || checking || !plan || newCount === 0} data-testid="mh-assign"
                                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />} {plan && newCount === 0 ? "Already assigned" : "Assign Holiday"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}