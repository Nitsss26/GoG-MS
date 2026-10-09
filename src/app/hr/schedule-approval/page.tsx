"use client";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { MapPin, CheckCircle2, XCircle, Clock, User, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HRScheduleApprovalPage() {
    const { user, workSchedules, approveWorkSchedule, employees } = useAuth();
    const [viewing, setViewing] = useState<any | null>(null);
    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const pending = workSchedules.filter(s => !s.approvedByHR);
    const approved = workSchedules.filter(s => s.approvedByHR);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    // Day-wise schedule of one employee (used in the unread list and in the "View" popup)
    const scheduleTable = (s: any) => (
        <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr className="text-zinc-500 uppercase tracking-widest">
            <th className="py-1 px-2 text-left">Day</th><th className="py-1 px-2 text-left">Location</th><th className="py-1 px-2 text-left">Clock In</th><th className="py-1 px-2 text-left">Clock Out</th>
        </tr></thead><tbody className="divide-y divide-zinc-800/30">
                {[...days, ...Object.keys(s.dayWise || {}).filter((k: string) => !days.includes(k)).sort()].map((d: string) => {
                    const entry = s.dayWise?.[d];
                    return (
                        <tr key={d} className="text-zinc-300"><td className="py-1.5 px-2 font-bold text-white">{d}</td><td className="py-1.5 px-2 flex items-center gap-1"><MapPin size={10} className="text-blue-400" /> {entry?.location || "—"}</td><td className="py-1.5 px-2">{entry?.clockInTime || "—"}</td><td className="py-1.5 px-2">{entry?.clockOutTime || "—"}</td></tr>
                    );
                })}
            </tbody></table></div>
    );
    const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header><h1 className="text-xl font-bold text-white tracking-tight">Work Schedule Changes</h1><p className="text-xs text-zinc-400 mt-1">Work schedule changes made by managers. They are already in effect — review each change and mark it as read. No approval is needed.</p></header>

            {pending.length > 0 && (
                <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50"><h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><Clock size={14} /> Unread Changes ({pending.length})</h3></div>
                    <div className="divide-y divide-zinc-800/50">
                        {pending.map(s => {
                            const emp = employees.find(e => e.id === s.employeeId);
                            return (
                                <div key={s.employeeId} className="p-5 space-y-3 hover:bg-zinc-800/20 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-white text-xs font-bold">{emp?.name?.[0] || "?"}</div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white">{emp?.name || s.employeeId}</h4>
                                                <p className="text-[9px] text-zinc-500">{emp?.designation} · {emp?.dept} · <span className="text-amber-400 font-bold">{emp?.managerLevel || emp?.designation}</span></p>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 text-right">Changed by {s.assignedByName || s.assignedBy || "—"}{s.changedAt ? <><br />{fmt(s.changedAt)}</> : null}</p>
                                    </div>

                                    {/* Day-wise schedule table */}
                                    {scheduleTable(s)}

                                    {s.reason && <p className="text-[10px] text-zinc-400 bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50">Reason: {s.reason}</p>}

                                    <button onClick={() => approveWorkSchedule(s.employeeId)} className="px-5 py-2 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-all">Mark as Read</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50"><h3 className="text-sm font-semibold text-green-400 flex items-center gap-2"><CheckCircle2 size={14} /> Read by HR ({approved.length})</h3></div>
                {approved.length === 0 ? <div className="p-8 text-center text-xs text-zinc-500 italic">No schedules marked as read yet.</div> :
                    <div className="divide-y divide-zinc-800/50">
                        {approved.map(s => {
                            const emp = employees.find(e => e.id === s.employeeId);
                            return (
                                <div key={s.employeeId} className="p-4 flex items-center gap-3 hover:bg-zinc-800/20">
                                    <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-white text-[10px] font-bold">{emp?.name?.[0] || "?"}</div>
                                    <div className="flex-1"><p className="text-[11px] font-bold text-white">{emp?.name || s.employeeId}</p><p className="text-[9px] text-zinc-500">{emp?.designation} · Changed by {s.assignedByName || s.assignedBy || "—"}{s.hrReadByName ? ` · Read by ${s.hrReadByName}${s.hrReadAt ? ` on ${fmt(s.hrReadAt)}` : ""}` : ""}</p></div>
                                    <button onClick={() => setViewing(s)} data-testid="view-schedule" className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg transition-all"><Eye size={12} /> View</button>
                                    <CheckCircle2 size={14} className="text-green-500" />
                                </div>
                            );
                        })}
                    </div>}
            </div>

            {/* Schedule of an employee whose change HR has already read — viewable any time */}
            {viewing && (() => {
                const emp = employees.find(e => e.id === viewing.employeeId);
                return (
                    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewing(null)}>
                        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} data-testid="schedule-modal">
                            <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-white text-xs font-bold">{emp?.name?.[0] || "?"}</div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">{emp?.name || viewing.employeeId}</h3>
                                        <p className="text-[10px] text-zinc-500">{emp?.designation}{emp?.dept ? ` · ${emp.dept}` : ""}</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewing(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"><X size={16} /></button>
                            </div>
                            <div className="p-5 space-y-3">
                                {scheduleTable(viewing)}
                                {viewing.reason && <p className="text-[10px] text-zinc-400 bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50">Reason: {viewing.reason}</p>}
                                <div className="text-[10px] text-zinc-500 space-y-0.5 pt-1 border-t border-zinc-800">
                                    <p>Changed by <span className="text-zinc-300">{viewing.assignedByName || viewing.assignedBy || "—"}</span>{viewing.changedAt ? ` · ${fmt(viewing.changedAt)}` : ""}</p>
                                    {viewing.hrReadByName && <p className="flex items-center gap-1 text-green-400"><CheckCircle2 size={11} /> Read by {viewing.hrReadByName}{viewing.hrReadAt ? ` on ${fmt(viewing.hrReadAt)}` : ""}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}