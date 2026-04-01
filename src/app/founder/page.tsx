"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
    Crown, Users, Ticket, Calendar, AlertTriangle, Clock, Activity,
    Shield, ChevronRight, Bell, CheckCircle, XCircle, Eye, Shirt
} from "lucide-react";

export default function FounderConsolePage() {
    const {
        user, employees, leaves, tickets, holidays, pipRecords,
        misbehaviourReports, activityLogs, reimbursements, attendanceRecords, notifications,
        additionalResponsibilities, approveAdditionalResponsibility
    } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== "FOUNDER") {
            router.push("/");
        }
    }, [user, router]);

    if (!user || user.role !== "FOUNDER") {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0a0a0b]">
                <p className="text-zinc-500 text-sm">Access denied. Founders only.</p>
            </div>
        );
    }

    const pendingLeaves = leaves.filter(l => l.status === "Pending").length;
    const openTickets = tickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
    const pendingHolidays = holidays.filter(h => h.status === "Proposed").length;
    const activePIP = pipRecords.filter(p => p.status === "Active").length;
    const pendingReimb = reimbursements.filter(r => r.status === "Pending").length;
    const pendingResp = additionalResponsibilities.filter(r => r.status === "Pending").length;
    const totalEmployees = employees.length;
    const recentLogs = activityLogs.slice(0, 15);

    const stats = [
        { label: "Total Employees", value: totalEmployees, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
        { label: "Pending Leaves", value: pendingLeaves, icon: Calendar, color: "text-blue-400", bg: "bg-blue-500/10" },
        { label: "Open Tickets", value: openTickets, icon: Ticket, color: "text-red-400", bg: "bg-red-500/10" },
        { label: "Pending Holidays", value: pendingHolidays, icon: Calendar, color: "text-purple-400", bg: "bg-purple-500/10" },
        { label: "Active PIP", value: activePIP, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
        { label: "Pending Reimb.", value: pendingReimb, icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
        { label: "Pending Resp.", value: pendingResp, icon: Shield, color: "text-primary", bg: "bg-primary/10" },
    ];

    const roleBreakdown = [
        { role: "FOUNDER", count: employees.filter(e => e.role === "FOUNDER").length, color: "bg-amber-500" },
        { role: "HR", count: employees.filter(e => e.role === "HR").length, color: "bg-emerald-500" },
        { role: "AD", count: employees.filter(e => e.role === "AD").length, color: "bg-purple-500" },
        { role: "TL", count: employees.filter(e => e.role === "TL").length, color: "bg-blue-500" },
        { role: "HOI", count: employees.filter(e => e.role === "HOI").length, color: "bg-orange-500" },
        { role: "OM", count: employees.filter(e => e.role === "OM").length, color: "bg-cyan-500" },
        { role: "FACULTY", count: employees.filter(e => e.role === "FACULTY").length, color: "bg-pink-500" },
    ];

    const quickLinks = [
        { label: "Manage Leave Approvals", path: "/manager/leave-approval", icon: Calendar },
        { label: "View Workforce", path: "/employees", icon: Users },
        { label: "Holiday Approvals", path: "/hr/holiday-approval", icon: Calendar },
        { label: "Attendance Override", path: "/hr/attendance-override", icon: Clock },
        { label: "SOP Management", path: "/hr/sop", icon: Shield },
        { label: "Dress Code Verification", path: "/hr/dress-code", icon: Shirt },
        { label: "Report Misbehaviour", path: "/manager/misbehaviour", icon: AlertTriangle },
        { label: "Reimbursement Mgmt", path: "/hr/reimbursements", icon: Clock },
        { label: "Schedule Approval", path: "/hr/schedule-approval", icon: Clock },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-[#0a0a0b] p-6 custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Crown size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Founder Console</h1>
                            <p className="text-xs text-zinc-500 mt-0.5">Welcome, {user.name} · {user.id}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Shield size={14} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Superadmin Access</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {stats.map((stat) => (
                    <div key={stat.label} className={`${stat.bg} border border-white/5 rounded-2xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon size={14} className={stat.color} />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</span>
                        </div>
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Role Breakdown */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Users size={14} className="text-primary" /> Role Distribution
                    </h3>
                    <div className="space-y-3">
                        {roleBreakdown.map((r) => (
                            <div key={r.role} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${r.color}`} />
                                    <span className="text-xs text-zinc-300 font-medium">{r.role}</span>
                                </div>
                                <span className="text-xs font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">{r.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Activity size={14} className="text-primary" /> Quick Actions
                    </h3>
                    <div className="space-y-1.5">
                        {quickLinks.map((link) => (
                            <button
                                key={link.label}
                                onClick={() => router.push(link.path)}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-zinc-800/60 transition-all group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <link.icon size={13} className="text-zinc-500 group-hover:text-primary" />
                                    <span className="text-xs text-zinc-300 group-hover:text-white font-medium">{link.label}</span>
                                </div>
                                <ChevronRight size={12} className="text-zinc-600 group-hover:text-primary" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Activity Logs */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Bell size={14} className="text-primary" /> Activity Logs
                    </h3>
                    {recentLogs.length === 0 ? (
                        <div className="text-center py-8">
                            <Eye size={24} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-xs text-zinc-500">No activity yet. Actions across portals will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {recentLogs.map((log) => (
                                <div key={log.id} className="bg-zinc-800/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        {log.type === "leave" ? <Calendar size={10} className="text-amber-400" /> :
                                            log.type === "ticket" ? <Ticket size={10} className="text-red-400" /> :
                                                log.type === "flag" ? <AlertTriangle size={10} className="text-orange-400" /> :
                                                    <Bell size={10} className="text-blue-400" />}
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">{log.type}</span>
                                        <span className="text-[9px] text-zinc-600 ml-auto">{new Date(log.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-300">{log.message}</p>
                                    <p className="text-[9px] text-zinc-500 mt-0.5">From: {log.fromName} → To: {log.toName}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Additional Responsibility Hub */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Shield size={14} className="text-primary" /> Responsibility Hub
                        {pendingResp > 0 && <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full ml-auto animate-pulse">{pendingResp} PENDING</span>}
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                        {additionalResponsibilities.filter(r => r.status === "Pending").length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-6">
                                <CheckCircle size={32} className="mb-2 text-zinc-600" />
                                <p className="text-[11px] text-zinc-500 font-medium">All additional responsibilities have been processed.</p>
                            </div>
                        ) : (
                            additionalResponsibilities.filter(r => r.status === "Pending").map((resp) => (
                                <div key={resp.id} className="bg-zinc-800/30 border border-white/5 rounded-xl p-4 space-y-3 hover:border-primary/20 transition-all">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-white uppercase tracking-tight line-clamp-2">{resp.description}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">{resp.points} Points</span>
                                                <span className="text-[8px] text-zinc-500 font-bold uppercase">To: {resp.employeeName}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => approveAdditionalResponsibility(resp.id, "Approved")}
                                                className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-lg"
                                            >
                                                <CheckCircle size={14} />
                                            </button>
                                            <button 
                                                onClick={() => approveAdditionalResponsibility(resp.id, "Rejected")}
                                                className="w-7 h-7 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <span className="text-[8px] text-zinc-500 font-black uppercase">Assigned By: {resp.addedBy}</span>
                                        <span className="text-[8px] text-zinc-600 italic">{resp.date}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <button 
                        onClick={() => router.push("/leaderboard")}
                        className="mt-4 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                    >
                        View Performance Leaderboard
                    </button>
                </div>
            </div>

            {/* Employee Directory Quick View */}
            <div className="mt-6 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Users size={14} className="text-primary" /> Full Employee Directory
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-800/50">
                                <th className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-3 pr-4">Emp ID</th>
                                <th className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-3 pr-4">Name</th>
                                <th className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-3 pr-4">Role</th>
                                <th className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-3 pr-4">Designation</th>
                                <th className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-3 pr-4">Dept</th>
                                <th className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.filter(emp => !["CEO", "CTO", "COO"].includes(emp.designation || "") && emp.role !== "FOUNDER").map((emp) => (
                                <tr key={emp.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                                    <td className="py-2.5 pr-4 text-xs font-mono text-primary font-bold">{emp.id}</td>
                                    <td className="py-2.5 pr-4 text-xs text-white font-medium">{emp.name}</td>
                                    <td className="py-2.5 pr-4">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{emp.role}</span>
                                    </td>
                                    <td className="py-2.5 pr-4 text-xs text-zinc-400">{emp.designation}</td>
                                    <td className="py-2.5 pr-4 text-xs text-zinc-400">{emp.dept}</td>
                                    <td className="py-2.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${emp.status === "Active" ? "bg-emerald-500/20 text-emerald-400" :
                                            emp.status === "On Leave" ? "bg-amber-500/20 text-amber-400" :
                                                "bg-red-500/20 text-red-400"
                                            }`}>{emp.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
