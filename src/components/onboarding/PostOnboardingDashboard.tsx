"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECKLIST_ITEMS, CHECKLIST_TOTAL, itemState } from "@/lib/post-onboarding";
import PostOnboardingChecklist from "@/components/onboarding/PostOnboardingChecklist";

/** HR → Employee Onboarding → Post-Onboarding Checklist: every employee who submitted the onboarding form */
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—");
const STATUS_STYLE: Record<string, string> = {
    "Not Started": "bg-zinc-800 text-zinc-300 border-zinc-700",
    "In Progress": "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "Completed": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export default function PostOnboardingDashboard() {
    const [rows, setRows] = useState<any[] | null>(null);
    const [filter, setFilter] = useState<"All" | "Pending" | "In Progress" | "Completed">("All");
    const [q, setQ] = useState("");
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/onboarding/checklist", { cache: "no-store" });
            const d = await r.json();
            setRows(Array.isArray(d.rows) ? d.rows : []);
        } catch { setRows([]); }
    }, []);
    useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

    const list = (rows || []).filter(r => {
        const s = r.summary?.status;
        const okF = filter === "All" || (filter === "Pending" ? s === "Not Started" : s === filter);
        return okF && (!q.trim() || `${r.employee.name} ${r.employee.id}`.toLowerCase().includes(q.trim().toLowerCase()));
    });
    const th = "py-2.5 px-3 text-left text-[9px] font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap";

    return (
        <div className="space-y-4" data-testid="poc-dashboard">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1" data-testid="poc-filters">
                    {(["All", "Pending", "In Progress", "Completed"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} data-testid={`poc-filter-${f.replace(" ", "")}`}
                            className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold", filter === f ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}>{f}</button>
                    ))}
                </div>
                <div className="relative flex-1 min-w-[12rem]">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee name or ID…" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white outline-none" data-testid="poc-search" />
                </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40">
                <table className="w-full min-w-[1100px] text-xs">
                    <thead className="bg-zinc-950/70"><tr>
                        <th className={th}>Employee</th><th className={th}>Designation</th><th className={th}>Form Submitted</th>
                        {CHECKLIST_ITEMS.map(i => <th key={i.key} className={th}>{i.short}</th>)}
                        <th className={th}>Progress</th><th className={cn(th, "text-right")}>Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {list.map(r => (
                            <tr key={r.employee.id} data-testid="poc-row" data-id={r.employee.id}>
                                <td className="py-2.5 px-3"><p className="font-bold text-white">{r.employee.name}</p><p className="text-[10px] text-zinc-500 font-mono">{r.employee.id}</p></td>
                                <td className="py-2.5 px-3 text-zinc-300">{r.employee.designation || "—"}</td>
                                <td className="py-2.5 px-3 text-zinc-400">{fmt(r.employee.onboardingSubmittedAt)}</td>
                                {CHECKLIST_ITEMS.map(i => {
                                    const st = itemState(r.checklist, i.key);
                                    const done = !!r.checklist?.[i.key]?.completed;
                                    return <td key={i.key} className="py-2.5 px-3"><span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap", done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-800 text-zinc-400")} data-testid={`poc-cell-${i.key}`}>{done ? (i.kind === "call" ? "Done" : i.kind === "idcard" ? "Given" : "Verified") : st}</span></td>;
                                })}
                                <td className="py-2.5 px-3"><span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-black", STATUS_STYLE[r.summary.status])} data-testid="poc-row-progress">{r.summary.completed}/{CHECKLIST_TOTAL}</span></td>
                                <td className="py-2.5 px-3 text-right"><button onClick={() => setOpen(r.employee.id)} data-testid="poc-manage" className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold whitespace-nowrap">Manage Checklist</button></td>
                            </tr>
                        ))}
                        {rows === null && <tr><td colSpan={11} className="py-10 text-center"><Loader2 className="animate-spin text-primary inline" size={16} /></td></tr>}
                        {rows !== null && !list.length && <tr><td colSpan={11} className="py-10 text-center text-zinc-500">No employees in this list.</td></tr>}
                    </tbody>
                </table>
            </div>
            {open && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(null)}>
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()} data-testid="poc-modal">
                        <button onClick={() => setOpen(null)} className="absolute right-3 top-3 z-10 text-zinc-500 hover:text-white"><X size={17} /></button>
                        <PostOnboardingChecklist employeeId={open} mode="hr" onSaved={load} />
                    </div>
                </div>
            )}
        </div>
    );
}