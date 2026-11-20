"use client";

import { dmy as toDmy } from "@/lib/date-display";
import { IndianRupee, Plus } from "lucide-react";

/**
 * Monetary Penalties (₹) — a separate list from payable days (they never change payable days).
 * Today: Location Mismatch justifications rejected with "Monetary Penalty".
 */
const dmy = (d?: string) => (d ? toDmy(d) : "—");
const inr = (v: number) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** `onAdd` (HR Salary Management only) shows an "Add Penalty" button in the header */
export default function MonetaryPenalties({ list, total, monthLabel, testid = "monetary-penalties", onAdd }: { list?: any[]; total?: number; monthLabel?: string; testid?: string; onAdd?: () => void }) {
    const rows = list || [];
    return (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40" data-testid={testid}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-zinc-800/70">
                <p className="flex items-center gap-2 text-sm font-bold text-white"><IndianRupee size={16} className="text-red-300" /> Monetary Penalties</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="text-xs text-zinc-400">Total: <b className="text-red-300 tabular-nums" data-testid={`${testid}-total`}>{inr(total || 0)}</b> <span className="text-zinc-500">· not counted in payable days</span></p>
                    {onAdd && <button type="button" onClick={onAdd} data-testid={`${testid}-add`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 text-[10px] font-black uppercase"><Plus size={12} /> Add Penalty</button>}
                </div>
            </div>
            <div className="p-4 sm:p-5">
                {rows.length === 0 ? <p className="text-xs text-zinc-500 text-center py-2">No monetary penalties{monthLabel ? ` in ${monthLabel}` : ""}.</p> : (
                    <ul className="divide-y divide-zinc-800/70">
                        {rows.map(p => (
                            <li key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-xs" data-testid={`${testid}-row`}>
                                <span className="sm:w-24 shrink-0 font-semibold text-white" data-testid={p.wholeMonth ? `${testid}-whole-month` : undefined}>{p.wholeMonth ? "Whole month" : dmy(p.date)}</span>
                                <span className="flex-1 min-w-0 text-zinc-300 [overflow-wrap:anywhere]">{p.source}{p.detail ? <span className="text-zinc-500"> · {p.detail}</span> : null}<span className="block text-[11px] text-zinc-400">Reason: {p.reason || "—"}{p.reviewedByName ? ` · by ${p.reviewedByName}${p.reviewedByRole ? ` (${p.reviewedByRole})` : ""}` : ""}</span></span>
                                <span className="shrink-0 font-black text-red-300 tabular-nums">{inr(p.amount)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}