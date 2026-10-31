"use client";

import { useState } from "react";
import { Lock, Unlock, Send, History, X, AlertTriangle, Check, CheckCheck, RefreshCw, MessageSquare, RotateCcw, Eye, FileEdit } from "lucide-react";
import { PLAN_STATUS_LABEL, PLAN_STATUS_STYLE, getPlanStatus, roleShort, planApproval, APPROVAL_STYLE } from "@/lib/academic-status";

/**
 * Sprint plan status, history and the lock / unlock actions.
 * mode "professor": status + history (Finalize & Lock / Unlock / Save & Re-Lock are in the page's action bar)
 * mode "reviewer":  Lock / Unlock / Reject unlock request — shown only when the server says plan.canManage
 */
export function PlanStatusBadge({ plan, className = "" }: { plan: any; className?: string }) {
    const st = getPlanStatus(plan);
    return (
        <span data-testid="plan-status" className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${PLAN_STATUS_STYLE[st] || ""} ${className}`}>
            {["LOCKED", "LOCKED_AGAIN", "UNLOCK_REQUESTED"].includes(st) ? <Lock size={10} /> : st === "UNLOCKED_FOR_REVISION" ? <Unlock size={10} /> : null}
            {PLAN_STATUS_LABEL[st] || st}
        </span>
    );
}

/** "CL/CH Approved" / "HOI Approved" / "AD Approved" — from the stored approval (who locked the plan, as which role) */
export function PlanApprovalBadge({ plan, className = "" }: { plan: any; className?: string }) {
    const a = planApproval(plan);
    if (!a) return null;
    return (
        <span data-testid="plan-approval" title={`${a.label} by ${a.byName || ""}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${APPROVAL_STYLE[a.type] || APPROVAL_STYLE.APPROVED} ${className}`}>
            <Check size={10} /> {a.label}
        </span>
    );
}

const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** HOI "Mark as Read" acknowledgements for the plan's current version */
export function planReads(plan: any) {
    const v = plan?.version || 1;
    return (plan?.hoiReads || []).filter((r: any) => (r.version || 1) === v);
}

/** Latest "Updated & Re-Locked" entry (what the professor changed after unlocking) */
export function latestRelock(plan: any) {
    const h = (plan?.history || []).filter((x: any) => x.action === "Updated & Re-Locked");
    const last = h[h.length - 1];
    if (!last) return null;
    const changes = String(last.note || "").split("\n").map(t => t.trim()).filter(Boolean).filter(t => t !== "No classes changed");
    return { ...last, changes };
}

const CHANGE_STYLE = (t: string) => t.startsWith("Added") ? { tag: "Added", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" }
    : t.startsWith("Removed") ? { tag: "Removed", cls: "bg-red-500/10 text-red-300 border-red-500/20" }
        : { tag: "Changed", cls: "bg-amber-500/10 text-amber-300 border-amber-500/20" };

export function RelockChanges({ plan, compact = false }: { plan: any; compact?: boolean }) {
    const r = latestRelock(plan);
    if (!r || getPlanStatus(plan) !== "LOCKED_AGAIN") return null;
    const strip = (t: string) => t.replace(/^(Added|Removed|Changed)\s*/, "");
    const body = (
        <div className="mt-2 space-y-1.5">
            {r.changes.length === 0 ? <p className="text-[11px] text-zinc-400">No classes were changed after unlocking.</p> : r.changes.map((c: string, i: number) => {
                const s = CHANGE_STYLE(c);
                return (
                    <div key={i} className="flex items-start gap-2" data-testid="relock-change">
                        <span className={`shrink-0 mt-px px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${s.cls}`}>{s.tag}</span>
                        <span className="text-[11px] text-zinc-200 [overflow-wrap:anywhere]">{strip(c)}</span>
                    </div>
                );
            })}
        </div>
    );
    return (
        <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20" data-testid="relock-card">
            <p className="text-[10px] font-black text-sky-300 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                <FileEdit size={11} /> Updated &amp; Re-Locked · Version {plan.version || 1}
                <span className="normal-case tracking-normal font-semibold text-zinc-400">by {r.byName}{r.at ? ` · ${fmt(r.at)}` : ""}</span>
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{r.changes.length} change{r.changes.length === 1 ? "" : "s"} since the plan was unlocked</p>
            {compact && r.changes.length > 2 ? (
                <details className="group">
                    <summary className="text-[10px] text-sky-300 cursor-pointer mt-1 font-bold">Show changes</summary>
                    {body}
                </details>
            ) : body}
        </div>
    );
}

export function PlanHistoryModal({ plan, onClose }: { plan: any; onClose: () => void }) {
    const history = [...(plan.history || [])].reverse();
    const requests = [...(plan.changeRequests || [])].reverse();
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2"><History size={16} className="text-indigo-400" /> Sprint Plan History</h3>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{plan.facultyName} · {plan.weekStartDate} to {plan.weekEndDate} · Version {plan.version || 1}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-5 overflow-y-auto space-y-6">
                    <div>
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Timeline</h4>
                        {history.length === 0 ? <p className="text-xs text-zinc-500">No history recorded yet (plan saved before history tracking).</p> : (
                            <ol className="space-y-3">
                                {history.map((h: any, i: number) => (
                                    <li key={i} className="flex gap-3">
                                        <span className="mt-1 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs text-white font-bold">{h.action} {h.toStatus && <span className="text-zinc-500 font-medium">→ {PLAN_STATUS_LABEL[h.toStatus] || h.toStatus}</span>}</p>
                                            <p className="text-[11px] text-zinc-400">{h.byName} {h.role ? `(${roleShort(h.role)})` : ""} · {fmt(h.at)}</p>
                                            {h.note && <p className="text-[11px] text-zinc-300 mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{h.note}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                    {requests.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Unlock Requests</h4>
                            <div className="space-y-2">
                                {requests.map((c: any, i: number) => (
                                    <div key={i} className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] text-zinc-400">{c.requestedByName || "Professor"} · {fmt(c.requestedAtISO) || c.requestedAt}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.status === "Approved" ? "bg-emerald-500/10 text-emerald-400" : c.status === "Rejected" ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"}`}>{c.status === "Approved" ? "Unlocked" : c.status}</span>
                                        </div>
                                        <p className="text-xs text-white mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="text-zinc-500">Reason:</span> {c.reason}</p>
                                        {c.comment && <p className="text-xs text-zinc-300 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="text-zinc-500">Details:</span> {c.comment}</p>}
                                        {c.processedByName && <p className="text-[11px] text-zinc-400 mt-1">{c.status === "Approved" ? "Unlocked" : "Rejected"} by {c.processedByName} ({roleShort(c.processedByRole)}) · {fmt(c.processedAt)}{c.decisionNote ? ` — ${c.decisionNote}` : ""}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(plan.revisions || []).length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Submitted Versions (kept for reference)</h4>
                            <div className="space-y-2">
                                {[...plan.revisions].reverse().map((r: any, i: number) => (
                                    <details key={i} className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
                                        <summary className="text-xs text-white cursor-pointer">Version {r.version} · {PLAN_STATUS_LABEL[r.status] || r.status} · {r.savedByName} · {fmt(r.savedAt)} · {(r.entries || []).length} class(es)</summary>
                                        <div className="mt-2 space-y-1">
                                            {(r.entries || []).map((e: any, j: number) => (
                                                <p key={j} className="text-[11px] text-zinc-400">{e.day} {e.date} · {e.timeStart}–{e.timeStop} · {e.subjectName} · {e.topics} {e.section ? `· Sec ${e.section}` : ""}</p>
                                            ))}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SprintPlanWorkflowPanel({ plan, mode, onChanged, compact = false }: {
    plan: any; mode: "professor" | "reviewer"; onChanged: (plan: any, message: string) => void; compact?: boolean;
}) {
    const st = getPlanStatus(plan);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState<null | "request_unlock" | "unlock" | "reject_unlock" | "return" | "history">(null);
    const [reason, setReason] = useState("");
    const [comment, setComment] = useState("");

    const pending = (plan.changeRequests || []).filter((c: any) => c.status === "Pending").slice(-1)[0];

    const act = async (action: string, extra: any = {}) => {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/sprint-plan/action", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan._id, action, ...extra }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Action failed");
            setDialog(null); setReason(""); setComment("");
            onChanged({ ...data.plan, status: data.plan?.status || plan.status, canManage: plan.canManage, canMarkRead: action === "mark_read" ? false : plan.canMarkRead }, data.message);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const btn = compact
        ? "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
        : "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50";

    return (
        <div className={compact ? "space-y-2" : "space-y-3"} data-testid="plan-workflow">
            <div className="flex flex-wrap items-center gap-2">
                <PlanStatusBadge plan={plan} />
                <PlanApprovalBadge plan={plan} />
                {planApproval(plan) && (
                    <span className={`text-[10px] text-zinc-500 ${compact ? "basis-full order-last" : ""}`} data-testid="plan-approved-by">Approved by {planApproval(plan)!.byName} {planApproval(plan)!.byRole ? `(${roleShort(planApproval(plan)!.byRole)})` : ""}{planApproval(plan)!.at ? ` · ${fmt(planApproval(plan)!.at)}` : ""}</span>
                )}
                {st === "UNLOCKED_FOR_REVISION" && plan.unlockedByName && <span className={`text-[10px] text-zinc-500 ${compact ? "basis-full order-last" : ""}`}>Unlocked by {plan.unlockedByName} ({roleShort(plan.unlockedByRole)})</span>}
                <button onClick={() => setDialog("history")} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700`}>
                    <History size={12} /> History
                </button>

                {/* HOI acknowledgement — no approval, the plan stays as it is */}
                {["LOCKED", "LOCKED_AGAIN"].includes(st) && planReads(plan).length > 0 && (
                    <span data-testid="plan-read" className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-300 border-teal-500/20 ${compact ? "" : ""}`}
                        title={planReads(plan).map((r: any) => `${r.byName} · ${fmt(r.at)}`).join("\n")}>
                        <CheckCheck size={11} /> Read by HOI
                    </span>
                )}
                {mode === "professor" && ["LOCKED", "LOCKED_AGAIN"].includes(st) && planReads(plan).length === 0 && (
                    <span data-testid="plan-unread" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-400 border-zinc-700">
                        <Eye size={11} /> Not yet read by HOI
                    </span>
                )}
                {mode === "reviewer" && plan.canMarkRead && (
                    <button disabled={busy} onClick={() => act("mark_read")} data-testid="mark-read" className={`${btn} bg-teal-600 hover:bg-teal-500 text-white`}>
                        <CheckCheck size={12} /> Mark as Read
                    </button>
                )}
                {["LOCKED", "LOCKED_AGAIN"].includes(st) && planReads(plan).length > 0 && (
                    <span className={`text-[10px] text-zinc-500 ${compact ? "basis-full order-last" : ""}`} data-testid="plan-read-by">
                        Read by {planReads(plan).map((r: any) => `${r.byName}${r.at ? ` · ${fmt(r.at)}` : ""}`).join(", ")}
                    </span>
                )}

                {/* Professors unlock their own plan straight away (button in the page's action bar: "Unlock Sprint Plan") */}

                {mode === "reviewer" && plan.canManage && (
                    <>
                        {/* No Lock / Return here — professors finalize & lock their own plan; HOI uses "Mark as Read" */}
                        {["LOCKED", "LOCKED_AGAIN", "UNLOCK_REQUESTED"].includes(st) && (
                            <button disabled={busy} onClick={() => setDialog("unlock")} className={`${btn} bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20`}>
                                <Unlock size={12} /> {compact ? "Unlock" : "Unlock for Revision"}
                            </button>
                        )}
                        {st === "UNLOCK_REQUESTED" && (
                            <button disabled={busy} onClick={() => setDialog("reject_unlock")} className={`${btn} bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20`}>
                                <X size={12} /> {compact ? "Reject" : "Reject Request"}
                            </button>
                        )}
                    </>
                )}
            </div>

            {mode === "reviewer" && <RelockChanges plan={plan} compact={compact} />}

            {st === "UNLOCK_REQUESTED" && pending && (
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={11} /> Unlock requested {pending.requestedAtISO ? `· ${fmt(pending.requestedAtISO)}` : ""}</p>
                    <p className="text-xs text-white mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="text-zinc-500">Reason:</span> {pending.reason}</p>
                    {pending.comment && <p className="text-xs text-zinc-300 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="text-zinc-500">Details:</span> {pending.comment}</p>}
                    {mode === "professor" && <p className="text-[11px] text-zinc-500 mt-1">You can unlock the plan yourself with "Unlock Sprint Plan".</p>}
                </div>
            )}
            {st === "UNLOCKED_FOR_REVISION" && plan.returnNote && (plan.returnedAt || "") >= (plan.submittedAt || "") && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20" data-testid="return-note">
                    <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5"><RotateCcw size={11} /> Returned for correction {plan.returnedAt ? `· ${fmt(plan.returnedAt)}` : ""}{plan.unlockedByName ? ` · ${plan.unlockedByName}` : ""}</p>
                    <p className="text-xs text-white mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{plan.returnNote}</p>
                    {mode === "professor" && <p className="text-[11px] text-zinc-500 mt-1">Correct the plan and submit it again for locking.</p>}
                </div>
            )}
            {error && !dialog && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}

            {dialog === "history" && <PlanHistoryModal plan={plan} onClose={() => setDialog(null)} />}

            {(dialog === "request_unlock" || dialog === "unlock" || dialog === "reject_unlock" || dialog === "return") && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={() => !busy && setDialog(null)}>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            {dialog === "request_unlock" ? <><Send size={18} className="text-orange-400" /> Request Unlock</>
                                : dialog === "unlock" ? <><Unlock size={18} className="text-purple-300" /> Unlock for Revision</>
                                    : dialog === "return" ? <><RotateCcw size={18} className="text-amber-300" /> Return for Correction</>
                                        : <><X size={18} className="text-red-400" /> Reject Unlock Request</>}
                        </h3>
                        <p className="text-xs text-zinc-400 mb-4">
                            {dialog === "request_unlock"
                                ? "Your plan stays locked. HOI, CL, CH and AD of your college get an email and can unlock it for you."
                                : dialog === "unlock" ? `${plan.facultyName} will be notified and can edit the plan, then re-submit it for locking.`
                                    : dialog === "return" ? `The plan is not locked. ${plan.facultyName} is notified with your note, corrects the plan and re-submits it.`
                                        : "The plan stays locked and the professor is informed."}
                        </p>
                        {dialog === "request_unlock" ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Reason for change *</label>
                                    <textarea value={reason} onChange={e => setReason(e.target.value)} data-testid="unlock-reason"
                                        placeholder="e.g. Extra lab session added by the college on Thursday"
                                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none resize-none h-20" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Comment / details (optional)</label>
                                    <textarea value={comment} onChange={e => setComment(e.target.value)}
                                        placeholder="Which classes change and how"
                                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none resize-none h-16" />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{dialog === "unlock" ? "Note to the professor (optional)" : dialog === "return" ? "What should be corrected? *" : "Reason *"}</label>
                                <textarea value={comment} onChange={e => setComment(e.target.value)} data-testid="decision-note"
                                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none h-20" />
                            </div>
                        )}
                        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
                        <div className="flex gap-2 mt-4">
                            <button disabled={busy || (dialog === "request_unlock" && reason.trim().length < 5) || (dialog === "reject_unlock" && comment.trim().length < 3) || (dialog === "return" && comment.trim().length < 5)}
                                onClick={() => dialog === "request_unlock" ? act("request_unlock", { reason, comment }) : act(dialog, { note: comment })}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                                {busy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                {dialog === "request_unlock" ? "Send Request" : dialog === "unlock" ? "Unlock" : dialog === "return" ? "Return to Professor" : "Reject"}
                            </button>
                            <button onClick={() => setDialog(null)} disabled={busy} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}