"use client";

import { useMemo, useState } from "react";
import {
    KeyRound, X, Search, Loader2, AlertTriangle, Building2, ShieldCheck, ClipboardCheck, BookOpen, Code2, UserCog,
    GraduationCap, Briefcase, Infinity as InfinityIcon,
} from "lucide-react";

/**
 * Give Access to ONE employee: 1) pick the team / role (hub)  2) pick the members whose access they get  3) review → give.
 * Saved with POST /api/access/grants { action: "grant", recipientIds: [recipient] } — the server validates everything again.
 */
type Emp = { id: string; name: string; email?: string; role: string; category: string; designation: string; dept: string; campus: string; extraAccess: string[] };
type Cat = { category: string; count: number; hubLabel: string | null; items: { label: string; path: string }[]; note: string; delegable: boolean; allowed: boolean };
type Mode = "SELECTED" | "ALL" | "ALL_DYNAMIC";

const CAT_LABEL: Record<string, string> = {
    FOUNDER: "Founder", HR: "HR", AD: "AD", HOI: "HOI", PROFESSOR: "Professor", OM: "OM", CURRICULUM_LEAD: "CL", CURRICULUM_HEAD: "CH",
    TL: "Tech Lead", TECH_TEAM: "Tech Team", MARKETING_TEAM: "Marketing",
};
const label = (c: string) => CAT_LABEL[c] || c.replace(/_/g, " ");
const ICON: Record<string, any> = {
    HOI: Building2, AD: ShieldCheck, OM: ClipboardCheck, CURRICULUM_LEAD: BookOpen, CURRICULUM_HEAD: BookOpen, TL: Code2,
    HR: UserCog, PROFESSOR: GraduationCap,
};
const TONE: Record<string, string> = {
    HOI: "text-emerald-300 bg-emerald-500/10", AD: "text-sky-300 bg-sky-500/10", OM: "text-orange-300 bg-orange-500/10",
    CURRICULUM_LEAD: "text-pink-300 bg-pink-500/10", CURRICULUM_HEAD: "text-fuchsia-300 bg-fuchsia-500/10", TL: "text-indigo-300 bg-indigo-500/10",
    HR: "text-rose-300 bg-rose-500/10", PROFESSOR: "text-violet-300 bg-violet-500/10",
};
const ROLE_CHIP: Record<string, string> = {
    FOUNDER: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", HR: "bg-rose-500/15 text-rose-300 border-rose-500/30", AD: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    HOI: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", OM: "bg-orange-500/15 text-orange-300 border-orange-500/30", TL: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    PROFESSOR: "bg-violet-500/15 text-violet-300 border-violet-500/30", CURRICULUM_LEAD: "bg-pink-500/15 text-pink-300 border-pink-500/30", CURRICULUM_HEAD: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};
const AVATAR = ["bg-violet-500/80", "bg-teal-500/80", "bg-sky-500/80", "bg-pink-400/80", "bg-amber-500/80", "bg-emerald-500/80", "bg-orange-400/85", "bg-indigo-400/85"];
const tone = (k: string) => AVATAR[[...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
const initials = (n: string) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
function Avatar({ e, size = "w-8 h-8 text-[10px]" }: { e: { id: string; name: string }; size?: string }) {
    return <span className={`${size} shrink-0 rounded-full flex items-center justify-center font-black text-white ${tone(e.id)}`}>{initials(e.name)}</span>;
}
const Step = ({ n, title, hint }: { n: number; title: string; hint: string }) => (
    <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-black flex items-center justify-center">{n}</span>
        <div><p className="text-sm font-bold text-white leading-tight">{title}</p><p className="text-[11px] text-zinc-500">{hint}</p></div>
    </div>
);

export default function GiveAccessModal({ recipient, employees, categories, grants, canDynamic, onClose, onDone }: {
    recipient: Emp; employees: Emp[]; categories: Cat[]; grants: any[]; canDynamic: boolean;
    onClose: () => void; onDone: (message: string) => void;
}) {
    const teams = useMemo(() => categories
        .map(c => ({ ...c, members: employees.filter(e => e.category === c.category && e.id !== recipient.id) }))
        .sort((a, b) => Number(b.delegable && b.allowed) - Number(a.delegable && a.allowed) || b.members.length - a.members.length),
        [categories, employees, recipient.id]);
    const firstUsable = teams.find(t => t.delegable && t.allowed && t.members.length);
    const [category, setCategory] = useState<string>(firstUsable?.category || "");
    const [picked, setPicked] = useState<string[]>([]);
    const [mode, setMode] = useState<Mode>("SELECTED");
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const team = teams.find(t => t.category === category);
    const existing = grants.find(g => g.recipientId === recipient.id && g.category === category && g.status === "ACTIVE");
    const already: string[] = existing ? (existing.scopeType === "ALL_DYNAMIC" ? (team?.members || []).map(m => m.id) : existing.sourceEmployeeIds || []) : [];
    const members = (team?.members || []).filter(m => !q || `${m.name} ${m.id} ${m.email || ""} ${m.campus}`.toLowerCase().includes(q.toLowerCase()));
    const selectable = (team?.members || []).filter(m => !already.includes(m.id));
    const chosen = mode === "SELECTED" ? picked : selectable.map(m => m.id);
    const nameOf = (id: string) => employees.find(e => e.id === id)?.name || id;
    const ownChips = [recipient.category, ...recipient.extraAccess.filter(c => c !== recipient.category).map(c => `${c}__hub`)];

    const choose = (c: string) => { setCategory(c); setPicked([]); setMode("SELECTED"); setQ(""); setError(""); };
    const toggle = (id: string) => { setMode("SELECTED"); setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); };

    const submit = async () => {
        if (!team) return;
        setBusy(true); setError("");
        try {
            const res = await fetch("/api/access/grants", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "grant", category: team.category, scopeType: mode, sourceIds: picked, recipientIds: [recipient.id] }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Could not give access.");
            onDone(`${recipient.name} now has ${team.hubLabel} access.`);
        } catch (e: any) { setError(e.message); }
        finally { setBusy(false); }
    };
    const canSubmit = !!team && team.delegable && team.allowed && (mode === "ALL_DYNAMIC" || chosen.length > 0);

    return (
        <div className="fixed inset-0 z-[115] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={() => !busy && onClose()}>
            <div className="w-full max-w-4xl max-h-[94vh] md:h-[94vh] md:max-h-[780px] lg:h-[85vh] lg:max-h-[710px] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} data-testid="give-access-modal">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"><KeyRound size={15} className="text-emerald-400" /></span>
                        Give Access
                    </h3>
                    <button onClick={onClose} disabled={busy} className="text-zinc-500 hover:text-white"><X size={19} /></button>
                </div>

                {/* Recipient */}
                <div className="px-5 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-3 shrink-0" data-testid="ga-recipient">
                    <Avatar e={recipient} size="w-11 h-11 text-sm" />
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{recipient.name} <span className="text-zinc-500 font-mono font-normal text-xs">{recipient.id}</span></p>
                        <p className="text-[11px] text-zinc-400 truncate">{recipient.email || recipient.designation || "—"}{recipient.campus ? ` · ${recipient.campus}` : ""}</p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mr-1">Current Roles</span>
                        {ownChips.map(c => {
                            const hub = c.endsWith("__hub"); const k = c.replace("__hub", "");
                            return <span key={c} className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${ROLE_CHIP[k] || "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>{label(k)}{hub ? " Hub" : ""}</span>;
                        })}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-[17rem_1fr] md:grid-rows-[minmax(0,1fr)]">
                    {/* 1. Team / role */}
                    <div className="p-4 md:border-r border-zinc-800 space-y-3 md:overflow-y-auto">
                        <Step n={1} title="Select Team / Role" hint="Choose the team whose access you want to give" />
                        <div className="space-y-1.5" data-testid="ga-teams">
                            {teams.map(t => {
                                const Icon = ICON[t.category] || Briefcase;
                                const usable = t.delegable && t.allowed;
                                const on = category === t.category;
                                return (
                                    <button key={t.category} disabled={!usable} onClick={() => choose(t.category)} data-testid={`ga-team-${t.category}`}
                                        title={usable ? t.items.map(i => i.label).join(" · ") : "This team has no hub that can be delegated"}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${on ? "border-emerald-500/60 bg-emerald-500/[0.08]" : usable ? "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700" : "border-zinc-800/60 opacity-40 cursor-not-allowed"}`}>
                                        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${TONE[t.category] || "text-zinc-300 bg-zinc-800"}`}><Icon size={15} /></span>
                                        <span className="flex-1 min-w-0">
                                            <span className={`block text-xs font-bold truncate ${on ? "text-emerald-300" : "text-white"}`}>{label(t.category)}</span>
                                            {!usable && <span className="block text-[9px] text-zinc-500">No hub</span>}
                                        </span>
                                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums">{t.members.length}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Members */}
                    <div className="p-4 flex flex-col gap-3 min-h-0 md:overflow-hidden">
                        <Step n={2} title="Select Team Members" hint={team ? `${recipient.name.split(" ")[0]} will see the ${team.hubLabel} for the members you pick` : "Pick a team first"} />
                        {team && (
                            <>
                                <div className="text-[11px] text-zinc-400 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                                    <span className="font-bold text-amber-300">{team.hubLabel}</span> opens: {team.items.map(i => i.label).join(" · ")}
                                    {existing && <span className="block mt-1 text-sky-300" data-testid="ga-existing">Already has this hub for {existing.scopeType === "ALL_DYNAMIC" ? `all ${label(team.category)}s (incl. future)` : `${already.length} member(s)`} — new members are added to it.</span>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${mode === "ALL" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 text-zinc-300"}`}>
                                        <input type="checkbox" checked={mode === "ALL"} onChange={e => { setMode(e.target.checked ? "ALL" : "SELECTED"); setPicked([]); }} className="w-4 h-4 accent-emerald-500" data-testid="ga-all" />
                                        Give All Access <span className="font-normal text-zinc-500">(all {team.members.length} {label(team.category)} members)</span>
                                    </label>
                                    {canDynamic && (
                                        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${mode === "ALL_DYNAMIC" ? "border-violet-500/60 bg-violet-500/10 text-violet-300" : "border-zinc-800 text-zinc-300"}`}>
                                            <input type="checkbox" checked={mode === "ALL_DYNAMIC"} onChange={e => { setMode(e.target.checked ? "ALL_DYNAMIC" : "SELECTED"); setPicked([]); }} className="w-4 h-4 accent-violet-500" data-testid="ga-future" />
                                            <InfinityIcon size={13} /> All + future members
                                        </label>
                                    )}
                                </div>
                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${label(team.category)} members…`} data-testid="ga-search"
                                        className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/40" />
                                </div>
                                <div className="flex-1 min-h-[10rem] md:min-h-[4rem] max-h-[40vh] md:max-h-none overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800/70" data-testid="ga-members">
                                    {members.map(m => {
                                        const has = already.includes(m.id);
                                        const on = has || mode !== "SELECTED" || picked.includes(m.id);
                                        return (
                                            <label key={m.id} className={`flex items-center gap-3 px-3 py-2 ${has ? "opacity-60" : "cursor-pointer hover:bg-zinc-800/40"} ${on && !has ? "bg-emerald-500/[0.05]" : ""}`} data-testid="ga-member">
                                                <input type="checkbox" checked={on} disabled={has || mode !== "SELECTED"} onChange={() => toggle(m.id)} className="w-4 h-4 accent-emerald-500" />
                                                <Avatar e={m} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-xs font-bold text-white truncate">{m.name}</span>
                                                    <span className="block text-[10px] text-zinc-500 truncate">{m.email || m.id} · {m.campus || "—"}</span>
                                                </span>
                                                {has && <span className="text-[9px] font-bold text-sky-300 border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 rounded">Already given</span>}
                                            </label>
                                        );
                                    })}
                                    {!members.length && <p className="py-8 text-center text-xs text-zinc-500">{team.members.length ? "No member matches your search." : `No other ${label(team.category)} employees yet.`}</p>}
                                </div>
                            </>
                        )}
                        {!team && <p className="text-xs text-zinc-500">No team with a hub is available.</p>}
                    </div>
                </div>

                {/* 3. Review */}
                <div className="px-5 py-3 border-t border-zinc-800 space-y-2.5 shrink-0" data-testid="ga-review">
                    <Step n={3} title="Review & Give Access"
                        hint={!team ? "" : mode === "ALL_DYNAMIC" ? `${recipient.name} gets the ${team.hubLabel} for all ${label(team.category)} members, including future ones`
                            : `You are giving ${recipient.name} access to ${chosen.length} ${label(team.category)} member(s)`} />
                    {mode === "SELECTED" && picked.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-14 overflow-y-auto">
                            {picked.map(id => (
                                <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md border border-zinc-700 bg-zinc-800 text-[11px] text-zinc-200">
                                    {nameOf(id)} <button onClick={() => toggle(id)} className="p-0.5 rounded hover:bg-zinc-700"><X size={11} /></button>
                                </span>
                            ))}
                        </div>
                    )}
                    {error && <p className="text-xs text-red-400 flex items-center gap-1.5" data-testid="ga-error"><AlertTriangle size={12} /> {error}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-800">Cancel</button>
                        <button onClick={submit} disabled={busy || !canSubmit} data-testid="ga-submit"
                            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-black disabled:opacity-40 flex items-center gap-2">
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Give Access
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}