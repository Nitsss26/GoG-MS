"use client";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, Search, ShieldCheck, Ticket, AlertCircle, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ManagerAttendanceOverridePage() {
    const { user, employees, attendanceRecords, tickets, resolveTicket, getReportees, giveCredit } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [creditModalEmp, setCreditModalEmp] = useState<string | null>(null);
    const [creditReason, setCreditReason] = useState("");

    if (!user || !["HOI", "AD", "HR", "FOUNDER"].includes(user.role)) return null;

    const todayDate = new Date().toISOString().split("T")[0];
    const reportees = getReportees(user.id) || [];

    const mappedEmployees = useMemo(() => {
        return reportees.map(emp => {
            const todayRecord = (attendanceRecords || []).find(r => r.employeeId === emp.id && r.date === todayDate);
            const status = todayRecord ? todayRecord.status : "Absent";

            // Check for open tickets related to attendance for this employee
            const activeTickets = (tickets || []).filter(t =>
                t.status !== "Resolved" &&
                (t.targetCategory === "Attendance Override Request" || t.targetCategory === "Attendance Appeal") &&
                (t.targetEmployeeId === emp.id || t.raisedBy === emp.id)
            );

            const creditsUsed = emp.markPresentUsed || 0;
            const creditsRemaining = Math.max(0, 3 - creditsUsed);

            return {
                ...emp,
                todayStatus: status,
                activeTickets,
                creditsUsed,
                creditsRemaining
            };
        }).filter(emp => {
            const nameMatch = (emp.name || "").toLowerCase().includes(searchQuery.toLowerCase());
            const idMatch = (emp.id || "").toLowerCase().includes(searchQuery.toLowerCase());
            return nameMatch || idMatch;
        });
    }, [reportees, attendanceRecords, tickets, searchQuery, todayDate]);

    const handleGiveCredit = (e: React.FormEvent) => {
        e.preventDefault();
        if (creditModalEmp && creditReason) {
            giveCredit(creditModalEmp, creditReason);
            setCreditModalEmp(null);
            setCreditReason("");
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <ShieldCheck size={20} className="text-indigo-400" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Manager Attendance Override</h1>
                    </div>
                    <p className="text-xs text-zinc-400">Directly manage attendance for your reportees and process override requests.</p>
                </div>
            </header>

            <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-3 shadow-lg">
                <Search size={16} className="text-zinc-500 ml-2" />
                <input
                    type="text"
                    placeholder="Search reportees..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-zinc-600 font-medium"
                />
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-zinc-800/30 border-b border-zinc-800">
                            <tr className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                <th className="px-6 py-4 rounded-tl-2xl">Employee</th>
                                <th className="px-6 py-4">Status Today</th>
                                <th className="px-6 py-4">Credits Remaining</th>
                                <th className="px-6 py-4">Active Requests</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {mappedEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-primary font-bold shadow-inner border border-white/5">
                                                {(emp.name || "?")[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{emp.name}</p>
                                                <p className="text-[9px] text-zinc-500 font-bold tracking-wider">{emp.id} &middot; {emp.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-black uppercase tracking-widest",
                                            emp.todayStatus === "Present" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                emp.todayStatus === "Absent" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        )}>
                                            {emp.todayStatus === "Present" ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                                            {emp.todayStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-sm font-black", emp.creditsRemaining === 0 ? "text-red-500" : "text-primary")}>
                                                {emp.creditsRemaining}
                                            </span>
                                            <span className="text-zinc-600 font-bold">/ 3</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {emp.activeTickets.length > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                                                    <Ticket size={12} /> {emp.activeTickets.length} Request(s)
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest opacity-50">No Requests</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {["HR", "FOUNDER"].includes(user.role) && (
                                                <button
                                                    onClick={() => setCreditModalEmp(emp.id)}
                                                    className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-[10px] font-bold transition-colors"
                                                >
                                                    Allot Credit
                                                </button>
                                            )}

                                            <button
                                                disabled={emp.activeTickets.length === 0}
                                                // Resolve the first active ticket, which automatically triggers markAttendanceOverride and credit usage in AuthContext
                                                onClick={() => resolveTicket(emp.activeTickets[0].id, `Attendance Overridden by ${user.role}: ${user.name}`)}
                                                className="px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center gap-1.5"
                                            >
                                                <RefreshCw size={12} /> Approve Override
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Credit Modal (Admin only) */}
            {creditModalEmp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setCreditModalEmp(null)} />
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md p-6 relative z-10 rounded-3xl shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <ShieldCheck size={16} className="text-indigo-400" /> Manually Allot Credit
                            </h2>
                            <button onClick={() => setCreditModalEmp(null)} className="text-zinc-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-[10px] text-indigo-200 leading-relaxed">
                            Restoring a credit will increase their available overrides by 1. This action will be logged and Founders will be automatically CC'd.
                        </div>
                        <form onSubmit={handleGiveCredit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reason / Justification</label>
                                <textarea
                                    required
                                    rows={3}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 resize-none transition-all"
                                    placeholder="e.g. Approved due to genuine technical app issue. Verified with proof."
                                    value={creditReason}
                                    onChange={e => setCreditReason(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="w-full bg-indigo-500 text-white hover:bg-indigo-600 rounded-xl py-2.5 text-xs font-bold transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-500/20">
                                Confirm & Allot Credit
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
