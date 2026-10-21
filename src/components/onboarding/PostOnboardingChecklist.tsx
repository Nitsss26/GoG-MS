"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Loader2, ClipboardCheck, Save, RefreshCw, AlertTriangle, PartyPopper, CalendarDays, User, Users, UserCog, FileText, IdCard, Award, CircleCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECKLIST_ITEMS, CHECKLIST_TOTAL, SLACK_STATUSES, GOOGLE_STATUSES, ID_CARD_STATUSES, SLACK_DONE, GOOGLE_DONE, itemState, summarize, statusLabel } from "@/lib/post-onboarding";

/**
 * Post-onboarding checklist (six mandatory activities).
 *   mode "employee": read-only (the employee can never tick / untick) — refreshes every 30 s and on focus
 *   mode "hr":       HR edits locally and saves with "Save Checklist" (each change is verified and audited on the server)
 * Renders nothing when the employee has no checklist (onboarding form not submitted).
 * hideWhenComplete: used on the dashboard — the card disappears once every activity is done.
 * collapsible: used on My Profile — only the summary is shown; the six activities open from a dropdown.
 * variant "strip": used on the dashboard — one compact row of the six activities (details live on My Profile).
 */
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

/* Small brand marks for the Slack / Google rows (plain shapes, no external images) */
const SlackMark = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <rect x="9" y="2" width="3.4" height="9" rx="1.7" fill="#36C5F0" /><rect x="2" y="9" width="9" height="3.4" rx="1.7" fill="#36C5F0" />
        <rect x="13" y="2" width="9" height="3.4" rx="1.7" transform="rotate(90 17.5 7)" fill="#2EB67D" /><rect x="13" y="9" width="9" height="3.4" rx="1.7" fill="#2EB67D" />
        <rect x="11.6" y="13" width="3.4" height="9" rx="1.7" fill="#ECB22E" /><rect x="13" y="11.6" width="9" height="3.4" rx="1.7" fill="#ECB22E" />
        <rect x="2" y="13" width="9" height="3.4" rx="1.7" transform="rotate(90 6.5 14.7)" fill="#E01E5A" /><rect x="2" y="15.6" width="9" height="3.4" rx="1.7" fill="#E01E5A" />
    </svg>
);
const GoogleMark = () => (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.6c0-1.6-.2-3.2-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
        <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
);

/* Look of each activity (icon tile + short description) */
const ITEM_UI: Record<string, { icon: ReactNode; tile: string; desc: string }> = {
    hohCall: { icon: <Users size={18} className="text-white" />, tile: "bg-blue-600/80 border-blue-400/40", desc: "Introductory call with the Head of Institution to understand role, goals and expectations." },
    adCall: { icon: <UserCog size={18} className="text-white" />, tile: "bg-purple-600/80 border-purple-400/40", desc: "Introductory call with the Associate Director to understand academic structure and responsibilities." },
    hrSopWalkthrough: { icon: <FileText size={18} className="text-white" />, tile: "bg-amber-500/85 border-amber-300/40", desc: "Detailed walkthrough of company SOPs, policies and processes with the HR Manager." },
    slackWorkspace: { icon: <SlackMark />, tile: "bg-zinc-800 border-zinc-700", desc: "Added to the company Slack workspace and membership verified." },
    googleWorkspace: { icon: <GoogleMark />, tile: "bg-zinc-800 border-zinc-700", desc: "Official Google Workspace account created, activated and verified." },
    idCard: { icon: <IdCard size={18} className="text-white" />, tile: "bg-teal-600/80 border-teal-400/40", desc: "Employee ID card issued to the employee." },
};

/* Two-line short titles for the dashboard strip */
const STRIP_TITLES: Record<string, [string, string]> = {
    hohCall: ["One-on-One Call", "with HOI"],
    adCall: ["One-on-One Call", "with AD"],
    hrSopWalkthrough: ["SOP Walkthrough", "Call with HR"],
    slackWorkspace: ["Slack Workspace", "Joined & Verified"],
    googleWorkspace: ["Google Workspace", "Credentials Active"],
    idCard: ["ID Card", "Given"],
};

export default function PostOnboardingChecklist({ employeeId, mode, onSaved, compact = false, hideWhenComplete = false, collapsible = false, variant = "full" }: { employeeId: string; mode: "employee" | "hr"; onSaved?: () => void; compact?: boolean; hideWhenComplete?: boolean; collapsible?: boolean; variant?: "full" | "strip" }) {
    const [data, setData] = useState<any | null>(null);
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [busy, setBusy] = useState(false);
    const [checking, setChecking] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [showItems, setShowItems] = useState(!collapsible);

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
    const allDone = sum.completed === CHECKLIST_TOTAL;
    if (hideWhenComplete && allDone) return null; // dashboard card disappears once everything is done
    const pct = Math.round((sum.completed / CHECKLIST_TOTAL) * 100);
    const saved = (key: string) => (key === "idCardReason" ? (c.idCard?.reason || "") : key === "idCard" ? (c.idCard?.status || "NOT_UPDATED") : (c[key]?.status ?? c[key]?.completed));
    const val = (key: string) => (key in draft ? draft[key] : saved(key));
    const dirty = Object.keys(draft).some(k => draft[k] !== saved(k));

    const save = async () => {
        setBusy(true); setMsg(null);
        try {
            for (const it of CHECKLIST_ITEMS) {
                const touched = it.key in draft || (it.kind === "idcard" && "idCardReason" in draft);
                if (!touched) continue;
                const body: any = { employeeId, item: it.key };
                if (it.kind === "call") body.completed = !!draft[it.key];
                else if (it.kind === "idcard") { body.status = val("idCard"); body.reason = val("idCardReason"); }
                else body.status = draft[it.key];
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

    const statusPill = allDone
        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
        : sum.completed === 0 ? "border-zinc-600 bg-zinc-800 text-zinc-300" : "border-amber-400/40 bg-amber-500/10 text-amber-300";

    // ── Dashboard strip: six small cards in a row (read-only); full details are on My Profile ──
    if (variant === "strip") {
        return (
            <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-zinc-950 p-4 sm:p-5" data-testid="post-onboarding" data-variant="strip">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"><ClipboardCheck size={19} className="text-emerald-300" /></div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-black text-white">Post-Onboarding Checklist</h3>
                            <p className="text-[11px] text-zinc-400">Complete the following activities to finish your onboarding process.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-400 font-bold" data-testid="poc-progress">{sum.completed}/{CHECKLIST_TOTAL} Completed</span>
                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider", statusPill)} data-testid="poc-status">
                            {allDone ? <CircleCheck size={13} /> : <Clock size={13} />}{sum.status === "Not Started" ? "Pending" : sum.status}
                        </span>
                    </div>
                </div>
                <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
                    {CHECKLIST_ITEMS.map((it, idx) => {
                        const st = c[it.key] || {};
                        const done = !!st.completed;
                        const ui = ITEM_UI[it.key];
                        const [l1, l2] = STRIP_TITLES[it.key] || [it.label, ""];
                        return (
                            <li key={it.key} data-testid={`poc-item-${it.key}`}
                                className={cn("relative rounded-xl border p-3 flex flex-col gap-2 min-w-0", done ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-zinc-800 bg-zinc-900/60")}>
                                <div className="flex items-center gap-2">
                                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0", done ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-zinc-700 text-zinc-400")}>{done ? <Check size={11} strokeWidth={3} /> : idx + 1}</span>
                                    <span className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4", ui.tile)}>{ui.icon}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[12px] font-bold text-white leading-tight">{l1}</p>
                                    <p className="text-[11px] text-zinc-400 leading-tight">{l2}</p>
                                </div>
                                <span className={cn("self-start inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border", done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : st.status === "NO" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-zinc-700 bg-zinc-800 text-zinc-400")} data-testid={`poc-state-${it.key}`}>
                                    {done ? <CircleCheck size={11} /> : <Clock size={11} />}{itemState(c, it.key)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
                <div className="mt-3 flex justify-end">
                    <Link href="/profile" className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200" data-testid="poc-view-details">View details in My Profile <ChevronRight size={13} /></Link>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 shadow-[0_0_40px_-20px_rgba(16,185,129,0.45)]", compact ? "p-4" : "p-5 sm:p-6")} data-testid="post-onboarding">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-[0_0_18px_-6px_rgba(16,185,129,0.7)]">
                        <ClipboardCheck size={22} className="text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-white tracking-tight">Post-Onboarding Checklist</h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Employee: <span className="text-zinc-200 font-semibold">{data.employee.name}</span>
                            <span className="mx-2 text-zinc-600">|</span>Employee ID: <span className="text-zinc-200 font-semibold">{data.employee.id}</span>
                            {mode === "hr" && data.employee.onboardingSubmittedAt ? <><span className="mx-2 text-zinc-600">|</span>Form submitted: {fmt(data.employee.onboardingSubmittedAt)}</> : null}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{allDone ? "All mandatory post-onboarding activities are complete." : "Complete all mandatory post-onboarding activities to get started."}</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider", statusPill)} data-testid="poc-status">
                        {allDone ? <CircleCheck size={13} /> : <Clock size={13} />}{sum.status === "Not Started" ? "Pending" : sum.status}
                    </span>
                    <p className="text-[11px] text-zinc-200 font-bold mt-1.5" data-testid="poc-progress">Progress: {sum.completed}/{CHECKLIST_TOTAL} Completed</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 mt-4">
                <div className="h-2 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-black text-zinc-300 w-10 text-right">{pct}%</span>
            </div>

            {/* Completion banner */}
            {allDone && (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-center gap-3" data-testid="poc-all-done">
                    <PartyPopper size={22} className="text-amber-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-emerald-300">All Mandatory Post-Onboarding Activities Completed!</p>
                        <p className="text-[11px] text-zinc-300">Great job! You have successfully completed all post-onboarding requirements.</p>
                    </div>
                    <Award size={30} className="text-emerald-300 shrink-0 hidden sm:block" />
                </div>
            )}

            {/* Activities (in a dropdown on My Profile) */}
            {collapsible && (
                <button type="button" onClick={() => setShowItems(v => !v)} aria-expanded={showItems} data-testid="poc-toggle-items"
                    className="mt-4 w-full flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/70 px-4 py-2.5 text-[11px] font-bold text-zinc-300">
                    <span>{showItems ? "Hide activity details" : `View all ${CHECKLIST_TOTAL} activities`}</span>
                    <ChevronDown size={15} className={cn("transition-transform", showItems && "rotate-180")} />
                </button>
            )}
            {showItems && <ul className="mt-4 space-y-2.5">
                {CHECKLIST_ITEMS.map((it, idx) => {
                    const st = c[it.key] || {};
                    const done = !!st.completed;
                    const ui = ITEM_UI[it.key];
                    const doneWord = it.kind === "call" ? "Completed" : it.kind === "idcard" ? "Given" : "Verified";
                    const at = st.completedAt || st.verifiedAt || st.updatedAt;
                    const by = st.completedByName || st.verifiedByName || st.updatedByName;
                    return (
                        <li key={it.key} className={cn("rounded-xl border px-3 sm:px-4 py-3 transition-colors", done ? "border-emerald-500/15 bg-zinc-900/70" : "border-zinc-800 bg-zinc-950/60")} data-testid={`poc-item-${it.key}`}>
                            <div className="flex flex-wrap items-center gap-3">
                                {/* tick + number */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {mode === "hr" && it.kind === "call" ? (
                                        <input type="checkbox" checked={!!val(it.key)} onChange={e => setDraft(d => ({ ...d, [it.key]: e.target.checked }))} className="accent-emerald-500 w-5 h-5" data-testid={`poc-check-${it.key}`} />
                                    ) : (
                                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center border", done ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" : "border-zinc-700 text-zinc-600")}>{done && <Check size={13} strokeWidth={3} />}</span>
                                    )}
                                    <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border", done ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : "border-zinc-700 text-zinc-400")}>{idx + 1}</span>
                                </div>
                                {/* icon + title + description */}
                                <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0", ui.tile)}>{ui.icon}</div>
                                <div className="flex-1 min-w-[12rem]">
                                    <p className={cn("text-[13px] font-bold", done ? "text-white" : "text-zinc-200")}>{it.label}</p>
                                    <p className="text-[11px] text-zinc-400 leading-snug">{ui.desc}</p>
                                </div>
                                {/* completed on / by + status: wraps as one block under the title when the card is narrow */}
                                <div className="flex flex-wrap items-center gap-4 ml-auto">
                                <div className="flex items-center gap-5 shrink-0 text-[10px]">
                                    <div className="flex items-center gap-2 w-[9.5rem]">
                                        <CalendarDays size={15} className="text-zinc-500 shrink-0" />
                                        <div><p className="text-zinc-500">{doneWord} On</p><p className="text-zinc-200 font-semibold">{done ? fmt(at) : "—"}</p></div>
                                    </div>
                                    <div className="flex items-center gap-2 w-[8.5rem]">
                                        <User size={15} className="text-zinc-500 shrink-0" />
                                        <div className="min-w-0"><p className="text-zinc-500">{doneWord} By</p><p className="text-zinc-200 font-semibold truncate">{done ? (by || "HR") : "—"}</p></div>
                                    </div>
                                </div>
                                {/* status (or HR control) */}
                                <div className="shrink-0 border-l border-zinc-800 pl-4">
                                    {mode === "hr" && it.kind !== "call" ? (
                                        <select value={val(it.key) || (it.kind === "slack" ? "NOT_INVITED" : it.kind === "idcard" ? "NOT_UPDATED" : "NOT_CREATED")} onChange={e => setDraft(d => ({ ...d, [it.key]: e.target.value }))} data-testid={`poc-select-${it.key}`}
                                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none max-w-[13rem]">
                                            {(it.kind === "slack" ? SLACK_STATUSES : it.kind === "idcard" ? ID_CARD_STATUSES : GOOGLE_STATUSES).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    ) : (
                                        <span className={cn("inline-flex items-center gap-1.5 min-w-[6.5rem] justify-center text-[11px] font-black px-3 py-1.5 rounded-lg border", done ? "border-emerald-300/60 bg-emerald-300 text-emerald-950" : "border-zinc-700 bg-zinc-800 text-zinc-300")} data-testid={`poc-state-${it.key}`}>
                                            {done && it.kind !== "call" && <CircleCheck size={13} />}{itemState(c, it.key)}
                                        </span>
                                    )}
                                </div>
                                </div>
                            </div>

                            {/* ID card: reason when not given */}
                            {it.kind === "idcard" && mode === "hr" && val("idCard") === "NO" && (
                                <div className="mt-2 lg:pl-[6.5rem]">
                                    <input value={val("idCardReason") || ""} onChange={e => setDraft(d => ({ ...d, idCardReason: e.target.value }))} placeholder="Why was the ID card not given? (required)" data-testid="poc-idcard-reason"
                                        className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none" />
                                </div>
                            )}
                            {it.kind === "idcard" && !done && st.status === "NO" && !(mode === "hr" && "idCardReason" in draft) && (
                                <p className="mt-2 lg:pl-[6.5rem] text-[10px] text-amber-300" data-testid="poc-idcard-why">Not given — Reason: {st.reason}{st.updatedByName ? ` · by ${st.updatedByName} · ${fmt(st.updatedAt)}` : ""}</p>
                            )}
                            {/* HR: Slack / Google details + optional integration check */}
                            {mode === "hr" && (it.kind === "slack" || it.kind === "google") && (
                                <div className="mt-2 lg:pl-[6.5rem] text-[10px] text-zinc-500 space-y-0.5">
                                    {it.kind === "google" && <p>Official email: <span className="text-zinc-300">{st.officialEmail || data.employee.officialEmail}</span> · Account: {statusLabel(GOOGLE_STATUSES, st.status)} · Activation: {st.status === GOOGLE_DONE ? "Verified" : "Not verified"}</p>}
                                    {it.kind === "slack" && <p>Invitation: {st.invitationStatus || "NOT_INVITED"} · Membership: {st.status === SLACK_DONE ? "Verified" : st.membershipStatus || "NOT_VERIFIED"}</p>}
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span data-testid={`poc-integration-${it.key}`}>Integration: {integrationText(st.integration, it.kind)}{st.integration?.checkedAt ? ` · checked ${fmt(st.integration.checkedAt)}` : ""}</span>
                                        <button type="button" onClick={() => checkIntegration(it.key)} disabled={checking === it.key} data-testid={`poc-check-integration-${it.key}`}
                                            className="text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50">{checking === it.key ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Check status</button>
                                    </p>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>}

            {mode === "hr" && (
                <>
                    {msg && <p className={cn("mt-3 text-[11px] flex items-center gap-1.5", msg.ok ? "text-emerald-400" : "text-red-400")} data-testid="poc-msg">{msg.ok ? <CircleCheck size={12} /> : <AlertTriangle size={12} />} {msg.text}</p>}
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