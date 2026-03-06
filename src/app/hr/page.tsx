"use client";
import { useAuth } from "@/context/AuthContext";
import { UserCog, Calendar, ClipboardList, FileText, Receipt, ChevronRight, Users, Shield, MapPin, AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function HRHub() {
    const { user, holidays, tickets, reimbursements, employees, workSchedules, pipRecords, attendanceRecords } = useAuth();
    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    const pendingHolidays = holidays.filter(h => h.status === "Proposed").length;
    const openTickets = tickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
    const pendingReimbursements = reimbursements.filter(r => r.status === "Pending").length;
    const pendingSchedules = workSchedules.filter(s => !s.approvedByHR).length;
    const activePIPs = pipRecords.filter(p => p.status === "Active").length;
    const totalEmployees = employees.length;

    const stats = [
        { label: "Total Staff", value: totalEmployees, color: "text-white" },
        { label: "Active PIPs", value: activePIPs, color: "text-red-400" },
        { label: "Open Tickets", value: openTickets, color: "text-amber-400" },
        { label: "Pending Actions", value: pendingHolidays + pendingReimbursements + pendingSchedules, color: "text-blue-400" },
    ];

    const quickLinks = [
        { label: "Holiday Approval", desc: `${pendingHolidays} pending`, icon: Calendar, path: "/hr/holiday-approval", color: "text-blue-400" },
        { label: "Attendance Override", desc: "Review overrides", icon: ClipboardList, path: "/hr/attendance-override", color: "text-green-400" },
        { label: "SOP Management", desc: "Update policies", icon: FileText, path: "/hr/sop", color: "text-purple-400" },
        { label: "Reimbursements", desc: `${pendingReimbursements} pending`, icon: Receipt, path: "/hr/reimbursements", color: "text-amber-400" },
        { label: "Schedule Approval", desc: `${pendingSchedules} pending`, icon: MapPin, path: "/hr/schedule-approval", color: "text-teal-400" },
        { label: "Workforce", desc: `${totalEmployees} employees`, icon: Users, path: "/employees", color: "text-cyan-400" },
        { label: "PIP Management", desc: "Manage active PIPs", icon: ShieldAlert, path: "/hr/pip", color: "text-red-400" },
        { label: "Report Misbehaviour", desc: "Report issues", icon: AlertTriangle, path: "/manager/misbehaviour", color: "text-orange-400" },
    ];

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header><h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><Shield size={20} className="text-emerald-400" /> HR Administration Hub</h1><p className="text-xs text-zinc-400 mt-1">Central command for all HR operations.</p></header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(s => (
                    <div key={s.label} className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{s.label}</p><p className={cn("text-xl font-bold mt-1", s.color)}>{s.value}</p></div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickLinks.map(q => (
                    <Link key={q.path} href={q.path} className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-700 transition-all group">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800", q.color)}><q.icon size={18} /></div>
                        <div className="flex-1"><p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{q.label}</p><p className="text-[10px] text-zinc-500">{q.desc}</p></div>
                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-primary" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
