"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, ClipboardCheck, Save, RefreshCw, AlertTriangle, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECKLIST_ITEMS, SLACK_STATUSES, GOOGLE_STATUSES, SLACK_DONE, GOOGLE_DONE, itemState, summarize, statusLabel } from "@/lib/post-onboarding";

/**
 * Post-onboarding checklist (five mandatory activities).
 *   mode "employee": read-only (the employee can never tick / untick) — refreshes every 30 s and on focus
 *   mode "hr":       HR edits locally and saves with "Save Checklist" (each change is verified and audited on the server)
 * Renders nothing when the employee has no checklist (onboarding form not submitted).
 */
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const STATUS_STYLE: Record<string, string> = {
    "Not Started": "bg-zinc-800 text-zinc-300 border-zinc-700",
    "In Progress": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Completed": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export default function PostOnboardingChecklist({ employeeId, mode, onSaved, compact = false }: { employeeId: string; mode: "employee" | "hr"; onSaved?: () => void; compact?: boolean }) {
    const [data, setData] = useState<any | null>(null);
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [busy, setBusy] = useState(false);
    const [checking, setChecking] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/onboarding/checklist?employeeId=${encodeURIComponent(employeeId)}`, { cache: "no-store" });
            const d = await r.json();
            if (r.ok) setData(d);
        } catch { /* keep the last state */ }
    }, [employeeId]);
    useEffect(() => {
        load();
        if (mode !== "employee") return;
        const t = setInterval(load, 30000);
        const f = () => load();
        window.addEventListener("focus", f);
        return () => { clearInterval(t); window.removeEventListener("focus", f); };
    }, [load, mode]);

    if (!data?.checklist) return null;
    const c = data.checklist;
    const sum = summarize(c);
    const val = (key: string) => (key in draft ? draft[key] : (c[key]?.status ?? c[key]?.completed));
    const dirty = Object.keys(draft).some(k => draft[k] !== (c[k]?.status ?? c[k]?.completed));

    const save = async () => {
        setBusy(true); setMsg(null);
        try {
            for (const it of CHECKLIST_ITEMS) {
                if (!(it.key in draft)) continue;
                const body: any = { employeeId, item: it.key };
                if (it.kind === "call") body.completed = !!draft[it.key]; else body.status = draft[it.key];
                const r = await fetch("/api/onboarding/checklist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || "Could not save.");
                setData(d);
            }
            setDraft({}); setMsg({ ok: true, text: "Checklist saved." }); onSaved?.();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); load(); } finally { setBusy(false); }
    };
    const checkIntegration = async (item: string) => {
        setChecking(item); setMsg(null);
        try {
            const r = await fetch("/api/onboarding/checklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, item }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Check failed.");
            await load();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setChecking(null); }
    };
    const integrationText = (i: any, kind: string) => {
        if (!i) return "Not checked yet";
        if (!i.configured) return `${kind === "slack" ? "Slack" : "Google Workspace"} integration is not configured — verified by HR`;
        if (i.error) return `Integration error: ${i.error}`;
        if (kind === "slack") return i.found ? (i.deleted ? "Slack account deactivated" : `Member of the Slack workspace${i.slackUserId ? ` (${i.slackUserId})` : ""}`) : "Not a member of the Slack workspace yet";
        return !i.exists ? "No Google Workspace account found" : i.suspended ? "Account suspended" : i.firstLoginDone ? "Account active — first sign-in done" : "Account Created – Activation Pending";
    };

    return (
        <div className={cn("rounded-2xl border border-zinc-800 bg-zinc-900/70", compact ? "p-4" : "p-5")} data-testid="post-onboarding">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardCheck size={15} className="text-emerald-400" /> Post-Onboarding Checklist</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{data.employee.name} · {data.employee.id}{mode === "hr" ? ` · Onboarding form: Submitted${data.employee.onboardingSubmittedAt ? ` (${fmt(data.employee.onboardingSubmittedAt)})` : ""}` : ""}</p>
                </div>
                <div className="text-right">
                    <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide", STATUS_STYLE[sum.status])} data-testid="poc-status">{sum.status === "Not Started" ? "Pending" : sum.status}</span>
                    <p className="text-[11px] text-zinc-300 font-bold mt-1" data-testid="poc-progress">Progress: {sum.completed}/5 Completed</p>
                </div>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-3"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(sum.completed / 5) * 100}%` }} /></div>
            {sum.completed === 5 && (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-bold px-3 py-2 flex items-center gap-2" data-testid="poc-all-done">
                    <PartyPopper size={14} /> All Mandatory Post-Onboarding Activities Completed
                </div>
            )}

            <ul className="mt-3 space-y-2">
                {CHECKLIST_ITEMS.map(it => {
                    const st = c[it.key] || {};
                    const done = !!st.completed;
                    return (
                        <li key={it.key} className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5" data-testid={`poc-item-${it.key}`}>
                            <div className="flex flex-wrap items-center gap-2">
                                {mode === "hr" && it.kind === "call" ? (
                                    <input type="checkbox" checked={!!val(it.key)} onChange={e => setDraft(d => ({ ...d, [it.key]: e.target.checked }))} className="accent-emerald-500 w-4 h-4" data-testid={`poc-check-${it.key}`} />
                                ) : done ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> : <Circle size={16} className="text-zinc-600 shrink-0" />}
                                <span className={cn("text-xs font-bold flex-1 min-w-[12rem]", done ? "text-white" : "text-zinc-300")}>{it.label}</span>
                                {mode === "hr" && it.kind !== "call" ? (
                                    <select value={val(it.key) || (it.kind === "slack" ? "NOT_INVITED" : "NOT_CREATED")} onChange={e => setDraft(d => ({ ...d, [it.key]: e.target.value }))} data-testid={`poc-select-${it.key}`}
                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-white outline-none">
                                        {(it.kind === "slack" ? SLACK_STATUSES : GOOGLE_STATUSES).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                ) : (
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-800 text-zinc-400")} data-testid={`poc-state-${it.key}`}>{itemState(c, it.key)}</span>
                                )}
                            </div>
                            {(done || (mode === "hr" && it.kind !== "call")) && (
                                <div className="mt-1.5 pl-6 text-[10px] text-zinc-500 space-y-0.5">
                                    {done && <p>{it.kind === "call" ? "Completed" : "Verified"} by {st.completedByName || st.verifiedByName || "HR"} · {fmt(st.completedAt || st.verifiedAt)}</p>}
                                    {mode === "hr" && it.kind === "google" && <p>Official email: <span className="text-zinc-300">{st.officialEmail || data.employee.officialEmail}</span> · Account: {statusLabel(GOOGLE_STATUSES, st.status)} · Activation: {st.status === GOOGLE_DONE ? "Verified" : "Not verified"}</p>}
                                    {mode === "hr" && it.kind === "slack" && <p>Invitation: {st.invitationStatus || "NOT_INVITED"} · Membership: {st.status === SLACK_DONE ? "Verified" : st.membershipStatus || "NOT_VERIFIED"}</p>}
                                    {mode === "hr" && it.kind !== "call" && (
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span data-testid={`poc-integration-${it.key}`}>Integration: {integrationText(st.integration, it.kind)}{st.integration?.checkedAt ? ` · checked ${fmt(st.integration.checkedAt)}` : ""}</span>
                                            <button type="button" onClick={() => checkIntegration(it.key)} disabled={checking === it.key} data-testid={`poc-check-integration-${it.key}`}
                                                className="text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50">{checking === it.key ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Check status</button>
                                        </p>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {mode === "hr" && (
                <>
                    {msg && <p className={cn("mt-3 text-[11px] flex items-center gap-1.5", msg.ok ? "text-emerald-400" : "text-red-400")} data-testid="poc-msg">{msg.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {msg.text}</p>}
                    <div className="mt-3 flex justify-end">
                        <button onClick={save} disabled={busy || !dirty} data-testid="poc-save"
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40">
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Checklist
                        </button>
                    </div>
                    {(c.history || []).length > 0 && (
                        <details className="mt-3 text-[10px] text-zinc-400" data-testid="poc-history">
                            <summary className="cursor-pointer font-bold uppercase tracking-widest text-zinc-500 text-[9px]">Audit history ({c.history.length})</summary>
                            <div className="mt-1.5 space-y-1">
                                {[...c.history].reverse().map((h: any, i: number) => (
                                    <div key={i} className="rounded border border-zinc-800 bg-zinc-950/50 px-2 py-1">{h.label}: {h.from} → <b className="text-zinc-200">{h.to}</b> · {h.byName} · {fmt(h.at)}{h.remarks ? ` — ${h.remarks}` : ""}</div>
                                ))}
                            </div>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}
