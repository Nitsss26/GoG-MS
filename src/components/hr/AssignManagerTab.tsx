"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Save, Loader2, UserCheck, Users, History, ChevronDown, X, ArrowRight, Mail, AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HR → Work Location → Assign Manager (replaces Assign HOI — one page for every employee).
 * Pick an employee on the left, then their manager by name. Picking an HOI for a Professor / OM / Tech / Marketing
 * employee saves the existing HOI mapping (so every HOI workflow keeps working); anyone else is saved as the
 * reporting manager. Professors / OMs can only report to an HOI. Validated on the server (no self-assignment,
 * no circular reporting, no duplicate); existing HOI assignments show as the current manager.
 */
type Person = { id: string; name: string; email: string; role: string; roleLabel: string; designation: string; dept: string; location: string; manager?: any; hoiOnly?: boolean };

const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const dt = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const dmy = (ymd?: string) => ymd ? ymd.slice(0, 10).split("-").reverse().join("-") : "—";
const matches = (p: Person, q: string) => !q || [p.name, p.id, p.email, p.designation, p.roleLabel, p.dept].some(v => String(v || "").toLowerCase().includes(q));

export function EmployeeSearchSelect({ people, value, onChange, placeholder, exclude, testid }: {
    people: Person[]; value: string; onChange: (id: string) => void; placeholder: string; exclude?: string[]; testid?: string;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);
    const sel = people.find(p => p.id === value);
    const list = useMemo(() => people.filter(p => !(exclude || []).includes(p.id) && matches(p, q.trim().toLowerCase())).slice(0, 60), [people, q, exclude]);
    return (
        <div ref={box} className="relative" data-testid={testid}>
            <button type="button" onClick={() => setOpen(o => !o)} data-testid={testid ? `${testid}-btn` : undefined}
                className="w-full flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-left hover:border-zinc-600">
                <Search size={13} className="text-zinc-500 shrink-0" />
                {sel ? <span className="min-w-0 flex-1"><span className="text-xs font-bold text-white">{sel.name}</span> <span className="text-[10px] text-zinc-500">· {sel.id} · {sel.designation}</span></span>
                    : <span className="flex-1 text-xs text-zinc-500">{placeholder}</span>}
                <ChevronDown size={14} className="text-zinc-500 shrink-0" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-zinc-800">
                        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, employee ID, email or designation" data-testid={testid ? `${testid}-search` : undefined}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary" />
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-zinc-800/60">
                        {list.map(p => (
                            <button type="button" key={p.id} onClick={() => { onChange(p.id); setOpen(false); setQ(""); }} data-testid={testid ? `${testid}-option` : undefined} data-id={p.id}
                                className={cn("w-full px-3 py-2 text-left hover:bg-zinc-800/60", p.id === value && "bg-primary/10")}>
                                <p className="text-xs font-bold text-white">{p.name}</p>
                                <p className="text-[10px] text-zinc-500 [overflow-wrap:anywhere]">{p.id} · {p.designation}{p.roleLabel && p.roleLabel !== p.designation ? ` · ${p.roleLabel}` : ""}{p.dept ? ` · ${p.dept}` : ""}{p.email ? ` · ${p.email}` : ""}</p>
                            </button>
                        ))}
                        {!list.length && <p className="px-3 py-6 text-center text-xs text-zinc-500">No active employee matches.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

const Field = ({ label, value, testid }: { label: string; value: any; testid?: string }) => (
    <div className="rounded-lg bg-zinc-800/30 border border-zinc-800/60 px-3 py-2 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
        <p className="text-xs text-white mt-0.5 [overflow-wrap:anywhere]" data-testid={testid}>{value || "—"}</p>
    </div>
);

export default function AssignManagerTab() {
    const [view, setView] = useState<"assign" | "teams">("assign");
    const [data, setData] = useState<{ employees: Person[]; teams: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [empId, setEmpId] = useState("");
    const [mgrId, setMgrId] = useState("");
    const [effective, setEffective] = useState(today());
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [teamOf, setTeamOf] = useState<string>("");
    const [teamQ, setTeamQ] = useState("");
    const [listQ, setListQ] = useState("");

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const r = await fetch("/api/hr/manager-assignment", { cache: "no-store" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not load employees");
            setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const loadHistory = useCallback(async (id: string) => {
        if (!id) { setHistory([]); return; }
        const r = await fetch(`/api/hr/manager-assignment?history=${encodeURIComponent(id)}`, { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        setHistory(r.ok ? d.history || [] : []);
    }, []);
    useEffect(() => { loadHistory(empId); }, [empId, loadHistory]);

    const people = data?.employees || [];
    const emp = people.find(p => p.id === empId);
    const mgr = people.find(p => p.id === mgrId);
    // Professors / OMs report to an HOI only
    const managerOptions = useMemo(() => emp?.hoiOnly ? people.filter(p => p.role === "HOI") : people, [people, emp?.hoiOnly]);
    const listed = useMemo(() => people.filter(p => matches(p, listQ.trim().toLowerCase())), [people, listQ]);
    const current = emp?.manager || null;
    const isReassign = !!current;
    const unchanged = !!current && current.id === mgrId;

    const selectEmployee = (id: string) => { setEmpId(id); setMgrId(""); setReason(""); setEffective(today()); setNotice(null); };

    const save = async () => {
        if (!emp || !mgr) return;
        setSaving(true); setNotice(null);
        try {
            const r = await fetch("/api/hr/manager-assignment", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: emp.id, managerId: mgr.id }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not save the manager assignment");
            setNotice({ ok: true, text: d.message });
            setReason("");
            await load(); await loadHistory(emp.id);
        } catch (e: any) { setNotice({ ok: false, text: e.message }); } finally { setSaving(false); }
    };

    const teams = (data?.teams || []).filter((t: any) => !teamQ.trim() || matches(t.manager, teamQ.trim().toLowerCase()) || t.direct.some((p: Person) => matches(p, teamQ.trim().toLowerCase())));
    const openTeam = (data?.teams || []).find((t: any) => t.manager.id === teamOf);

    return (
        <div className="space-y-4" data-testid="assign-manager">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2"><UserCheck size={15} className="text-primary" /> Assign Manager</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Select an employee, then assign their manager by name — an HOI, a Tech Lead, a Tech Team member or anyone else. Existing HOI assignments show as the current manager.</p>
                </div>
                <div className="flex gap-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1">
                    <button onClick={() => setView("assign")} data-testid="am-tab-assign" className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5", view === "assign" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><UserCheck size={12} /> Assign Manager</button>
                    <button onClick={() => setView("teams")} data-testid="am-tab-teams" className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5", view === "teams" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><Users size={12} /> Manager-Wise Teams</button>
                </div>
            </div>
            {error && <div className="rounded-xl px-4 py-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}
            {loading && !data ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : view === "assign" ? (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                    {/* Left: employee list (same layout as the former Assign HOI page) */}
                    <div className="lg:row-span-2 bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden" data-testid="am-list">
                        <div className="p-3 border-b border-zinc-800/50"><p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Employee</p>
                            <div className="relative mt-2">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input type="text" placeholder="Search name, ID, email or designation..." value={listQ} onChange={e => setListQ(e.target.value)} data-testid="am-list-search" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none" />
                            </div></div>
                        <div className="divide-y divide-zinc-800/50 max-h-[560px] overflow-y-auto custom-scrollbar">
                            {listed.slice(0, 300).map(r => (
                                <button key={r.id} onClick={() => selectEmployee(r.id)} data-testid="am-list-row" data-id={r.id}
                                    className={cn("w-full p-3 flex items-center gap-2 text-left transition-colors", empId === r.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-zinc-800/30")}>
                                    <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{(r.name || "?")[0]}</div>
                                    <div className="min-w-0"><p className="text-[11px] font-bold text-white truncate">{r.name} <span className="font-normal text-zinc-500">· {r.roleLabel}</span></p><p className="text-[9px] text-zinc-500 truncate">Manager: {r.manager?.name || "Not Assigned"}</p></div>
                                </button>
                            ))}
                            {!listed.length && <div className="p-6 text-center text-xs text-zinc-500 italic">No employees found.</div>}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 p-4 space-y-3">
                        {!emp ? <p className="text-xs text-zinc-500 italic py-6 text-center">Select an employee to assign a manager.</p> : <>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Employee" value={`${emp.name} (${emp.id})`} />
                            <Field label="Role" value={emp.roleLabel} testid="am-emp-role" />
                            <Field label="Designation" value={emp.designation} />
                            <Field label="Department" value={emp.dept} />
                        </div>
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3" data-testid="am-current">
                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-300">Current Manager</p>
                            <p className="text-xs text-white mt-1 flex flex-wrap items-center gap-1.5">{emp.name} <ArrowRight size={12} className="text-zinc-500" /> {current ? <b>{current.name}</b> : <span className="text-zinc-500">Not Assigned</span>}{current?.source === "HOI" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">HOI</span>}</p>
                            {current && <p className="text-[10px] text-zinc-500 mt-0.5">{current.designation}{current.dept ? ` · ${current.dept}` : ""}{current.effectiveDate ? ` · since ${dmy(current.effectiveDate)}` : ""}{current.assignedByName ? ` · by ${current.assignedByName}` : ""}{!current.active ? " · manager no longer active" : ""}</p>}
                        </div>
                        </>}
                    </div>

                    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Assign Manager</p>
                        {!emp ? <p className="text-xs text-zinc-500 italic py-6 text-center">Select an employee first.</p> : <>
                            {emp.hoiOnly && <p className="text-[10px] text-amber-300">A {emp.roleLabel} reports to an HOI — only HOIs are listed.</p>}
                            <EmployeeSearchSelect people={managerOptions} value={mgrId} onChange={id => { setMgrId(id); setNotice(null); }} placeholder={emp.hoiOnly ? "Search HOI name or ID" : "Search manager name, ID, email or designation"} exclude={[emp.id]} testid="am-manager" />
                            {mgr && <div className="grid grid-cols-2 gap-2">
                                <Field label="Manager Employee ID" value={mgr.id} testid="am-mgr-id" />
                                <Field label="Manager Designation" value={mgr.designation} testid="am-mgr-desig" />
                                <Field label="Manager Department" value={mgr.dept} testid="am-mgr-dept" />
                                <Field label="Manager Corporate Email" value={mgr.email} testid="am-mgr-email" />
                            </div>}
                            {unchanged && !notice?.ok && <p className="text-[11px] text-amber-300 flex items-center gap-1.5"><AlertTriangle size={12} /> {mgr?.name} is already the reporting manager — nothing to change.</p>}
                            {notice && <p data-testid="am-notice" className={cn("text-[11px] rounded-lg px-3 py-2 flex items-start gap-1.5 border", notice.ok ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : "text-red-300 bg-red-500/10 border-red-500/20")}>{notice.ok ? <CheckCircle2 size={13} className="shrink-0 mt-px" /> : <AlertTriangle size={13} className="shrink-0 mt-px" />}{notice.text}</p>}
                            <button onClick={save} disabled={saving || !mgr || unchanged} data-testid="am-save"
                                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-40">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Manager Assignment
                            </button>
                            <p className="text-[10px] text-zinc-500 flex items-start gap-1.5"><Mail size={11} className="shrink-0 mt-px" /> After saving, an email goes to the employee and the manager (CC: {isReassign ? "previous manager, " : ""}HR, HR Executive, Technical Admin).</p>
                        </>}
                    </div>
                </div>
            ) : (
                <div className="space-y-3" data-testid="am-teams">
                    <div className="relative max-w-sm"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={teamQ} onChange={e => setTeamQ(e.target.value)} placeholder="Search manager or team member" data-testid="am-team-search" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white" /></div>
                    {!teams.length ? <p className="text-xs text-zinc-500 py-8 text-center">No reporting managers assigned yet.</p> : (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/70">
                            {teams.map((t: any) => (
                                <div key={t.manager.id} className="p-3 flex flex-wrap items-center gap-3 justify-between" data-testid="am-team-row">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white">{t.manager.name} <span className="text-[10px] font-normal text-zinc-500">{t.manager.id}</span></p>
                                        <p className="text-[10px] text-zinc-500">{t.manager.designation}{t.manager.dept ? ` · ${t.manager.dept}` : ""}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-zinc-300"><b className="text-white" data-testid="am-team-count">{t.direct.length}</b> direct{t.indirect.length ? <> · {t.indirect.length} indirect</> : null}</span>
                                        <button onClick={() => setTeamOf(t.manager.id)} data-testid="am-view-team" className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase flex items-center gap-1"><Eye size={12} /> View Team</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {openTeam && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setTeamOf("")}>
                    <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 space-y-3" onClick={e => e.stopPropagation()} data-testid="am-team-modal">
                        <div className="flex items-start justify-between gap-2">
                            <div><p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Manager</p><p className="text-base font-bold text-white">{openTeam.manager.name}</p><p className="text-[11px] text-zinc-500">{openTeam.manager.id} · {openTeam.manager.designation}{openTeam.manager.dept ? ` · ${openTeam.manager.dept}` : ""}</p></div>
                            <button onClick={() => setTeamOf("")} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Direct Reportees ({openTeam.direct.length})</p>
                        <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                            {openTeam.direct.map((p: Person) => (
                                <div key={p.id} className="px-3 py-2 text-xs" data-testid="am-team-member"><p className="font-bold text-white">{p.name} <span className="text-[10px] font-normal text-zinc-500">{p.id}</span></p><p className="text-[10px] text-zinc-500">{p.roleLabel} · {p.designation}{p.dept ? ` · ${p.dept}` : ""}</p></div>
                            ))}
                        </div>
                        {openTeam.indirect.length > 0 && <>
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Indirect Reportees ({openTeam.indirect.length})</p>
                            <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                                {openTeam.indirect.map((p: any) => (
                                    <div key={p.id} className="px-3 py-2 text-xs"><p className="font-bold text-white">{p.name} <span className="text-[10px] font-normal text-zinc-500">{p.id}</span></p><p className="text-[10px] text-zinc-500">{p.roleLabel} · via {people.find(x => x.id === p.via)?.name || p.via}</p></div>
                                ))}
                            </div>
                        </>}
                    </div>
                </div>
            )}
        </div>
    );
}