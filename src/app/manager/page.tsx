"use client";
import { useAuth } from "@/context/AuthContext";
import { Users, AlertTriangle, Clock, Star, Calendar, ChevronRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ManagerHub() {
    const { user, getReportees, leaves, attendanceRecords, pipRecords, misbehaviourReports, ratings } = useAuth();
    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) return null;
    const reportees = getReportees(user.id);
    const reporteeIds = reportees.map(r => r.id);
    const pendingLeaves = leaves.filter(l => reporteeIds.includes(l.employeeId) && l.status === "Pending");
    const flaggedAttendance = attendanceRecords.filter(r => reporteeIds.includes(r.employeeId) && Object.values(r.flags).some(Boolean));
    const activePIPs = pipRecords.filter(p => reporteeIds.includes(p.employeeId) && p.status === "Active");
    const recentReports = misbehaviourReports.filter(m => m.reportedBy === user.id);

    const quickLinks = [
        { label: "Leave Approval", desc: `${pendingLeaves.length} pending`, icon: Calendar, path: "/manager/leave-approval", color: "text-amber-400" },
        { label: "Report Misbehaviour", desc: `${recentReports.length} reports`, icon: AlertTriangle, path: "/manager/misbehaviour", color: "text-red-400" },
        { label: "Rate Reportees", desc: "15-day cycle", icon: Star, path: "/manager/ratings", color: "text-yellow-400" },
        { label: "Holidays", desc: "Propose dates", icon: Calendar, path: "/manager/holidays", color: "text-blue-400" },
    ];

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><Briefcase size={20} className="text-amber-400" /> Manager Hub</h1>
                <p className="text-xs text-zinc-400 mt-1">Manage your team of {reportees.length} reportees.</p>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Reportees</p><p className="text-xl font-bold text-white mt-1">{reportees.length}</p></div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Pending Leaves</p><p className="text-xl font-bold text-amber-400 mt-1">{pendingLeaves.length}</p></div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Flags</p><p className="text-xl font-bold text-red-400 mt-1">{flaggedAttendance.length}</p></div>
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Active PIPs</p><p className="text-xl font-bold text-orange-400 mt-1">{activePIPs.length}</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickLinks.map(q => (
                    <Link key={q.path} href={q.path} className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-700 transition-all group">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800", q.color)}><q.icon size={18} /></div>
                        <div className="flex-1"><p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{q.label}</p><p className="text-[10px] text-zinc-500">{q.desc}</p></div>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-primary" />
                    </Link>
                ))}
            </div>

            {/* Reportees List */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50"><h3 className="text-sm font-semibold text-white">Your Reportees</h3></div>
                <div className="divide-y divide-zinc-800/50">
                    {reportees.map(r => (
                        <div key={r.id} className="p-4 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-white">{r.name[0]}</div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-white">{r.name}</p>
                                <p className="text-[10px] text-zinc-500">{r.designation} · {r.dept}</p>
                            </div>
                            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full",
                                pipRecords.find(p => p.employeeId === r.id && p.status === "Active") ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-green-400 bg-green-500/10 border border-green-500/20"
                            )}>{pipRecords.find(p => p.employeeId === r.id && p.status === "Active") ? "PIP" : "Active"}</span>
                        </div>
                    ))}
                    {reportees.length === 0 && <div className="p-8 text-center text-xs text-zinc-500 italic">No direct reportees found for your role.</div>}
                </div>
            </div>
        </div>
    );
}
