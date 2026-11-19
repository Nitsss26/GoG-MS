"use client";

import { Eye, EyeOff, Ban, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessState } from "@/lib/role-modules";

/** Admin → Role Management: a role's sidebar items grouped by section, each Visible / Hidden / Blocked */
export type RoleItem = { path: string; label: string; section: string; locked: boolean; apis: string[]; exact?: boolean };

export const ACCESS_STATES: { k: AccessState; label: string; I: any; on: string }[] = [
    { k: "visible", label: "Visible", I: Eye, on: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    { k: "hidden", label: "Hidden", I: EyeOff, on: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    { k: "blocked", label: "Blocked", I: Ban, on: "bg-red-500/15 text-red-300 border-red-500/30" },
];
export const STATE_TEXT: Record<AccessState, string> = { visible: "Visible", hidden: "Hidden", blocked: "Blocked" };

export function RoleAccessList({ items, draft, onChange, readOnly }: {
    items: RoleItem[]; draft: Record<string, AccessState>; onChange: (path: string, s: AccessState) => void; readOnly?: boolean;
}) {
    const sections: { title: string; items: RoleItem[] }[] = [];
    items.forEach(i => { const s = sections.find(x => x.title === i.section); if (s) s.items.push(i); else sections.push({ title: i.section, items: [i] }); });
    return (
        <div className="space-y-4">
            {sections.map(s => (
                <div key={s.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden" data-testid="rm-section">
                    <p className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-800">{s.title}</p>
                    <div className="divide-y divide-zinc-800/70">
                        {s.items.map(i => {
                            const st = draft[i.path] || "visible";
                            const fixed = readOnly || i.locked;
                            return (
                                <div key={i.path} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4" data-testid="rm-item" data-path={i.path} data-state={st}>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white font-medium">{i.label}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono [overflow-wrap:anywhere]">{i.path}
                                            {!fixed && <span className={cn("ml-2 font-sans font-bold", i.apis.length ? "text-sky-300" : "text-zinc-500")} data-testid="rm-scope">{i.apis.length ? "Page + API" : "Page only"}</span>}
                                        </p>
                                    </div>
                                    {fixed ? (
                                        <span className="self-start sm:self-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-700 text-[10px] font-bold text-zinc-400"><Lock size={10} /> Always visible</span>
                                    ) : (
                                        <div className="flex rounded-lg border border-zinc-800 overflow-hidden self-start sm:self-auto shrink-0" role="radiogroup" aria-label={`${i.label} access`}>
                                            {ACCESS_STATES.map(o => (
                                                <button key={o.k} type="button" role="radio" aria-checked={st === o.k} data-testid={`rm-set-${o.k}`}
                                                    onClick={() => onChange(i.path, o.k)}
                                                    className={cn("px-2.5 py-1.5 text-[11px] font-bold inline-flex items-center gap-1 border-r last:border-r-0 border-zinc-800 transition",
                                                        st === o.k ? o.on : "text-zinc-500 hover:text-zinc-200")}>
                                                    <o.I size={12} /> {o.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}