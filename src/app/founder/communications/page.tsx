"use client";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Clock, Ticket, AlertCircle, FileText, ChevronRight, Activity, Filter, RefreshCw, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type TimelineItem = {
    id: string;
    type: "TICKET" | "LEAVE" | "ATTENDANCE_OVERRIDE" | "MISBEHAVIOUR";
    date: Date;
    title: string;
    description: string;
    status: string;
    employeeName: string;
    employeeId: string;
    actionReason?: string;
};

export default function FounderCommunicationsLog() {
    const { user, tickets, leaves, markAsPresentRequests, misbehaviourReports, employees } = useAuth();
    const [filterType, setFilterType] = useState<"ALL" | "TICKET" | "LEAVE" | "ATTENDANCE_OVERRIDE" | "MISBEHAVIOUR">("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    if (!user || user.role !== "FOUNDER") return null;

    const timeline: TimelineItem[] = useMemo(() => {
        const items: TimelineItem[] = [];

        // 1. Tickets
        tickets.forEach(t => {
            const emp = employees.find(e => e.id === t.raisedBy);
            items.push({
                id: `T-${t.id}-raise`,
                type: "TICKET",
                date: new Date(t.createdAt),
                title: `Ticket Raised: ${t.subject}`,
                description: `Category: ${t.targetCategory} | Routing rules dictate HR/RM review.`,
                status: t.status,
                employeeName: emp?.name || "Unknown",
                employeeId: t.raisedBy
            });

            if (t.resolvedAt) {
                items.push({
                    id: `T-${t.id}-resolve`,
                    type: "TICKET",
                    date: new Date(t.resolvedAt),
                    title: `Ticket Resolved: ${t.subject}`,
                    description: `Resolution Notes: ${t.resolutionNotes || "No notes"}`,
                    status: "Resolved",
                    employeeName: emp?.name || "Unknown",
                    employeeId: t.raisedBy,
                    actionReason: t.resolutionNotes
                });
            }
        });

        // 2. Leaves
        leaves.forEach(l => {
            items.push({
                id: `L-${l.id}`,
                type: "LEAVE",
                date: new Date(l.appliedAt || new Date().toISOString()),
                title: `${l.type} Leave Request (${l.leaveType})`,
                description: `From ${l.startDate} to ${l.endDate}. Reason: ${l.reason || "N/A"}. Requested by ${l.employeeName}`,
                status: l.status,
                employeeName: l.employeeName,
                employeeId: l.employeeId
            });
        });

        // 3. Mark As Present / Overrides
        markAsPresentRequests.forEach(m => {
            items.push({
                id: `M-${m.id}`,
                type: "ATTENDANCE_OVERRIDE",
                date: new Date(m.appliedAt || new Date().toISOString()),
                title: `Attendance Override Request`,
                description: `Date: ${m.date}. Reason: ${m.reason || "N/A"}`,
                status: m.status,
                employeeName: m.employeeName,
                employeeId: m.employeeId
            });
        });

        // 4. Misbehaviour / PIP (using MisbehaviourReports conceptually as major issues)
        misbehaviourReports.forEach(m => {
            items.push({
                id: `MB-${m.id}`,
                type: "MISBEHAVIOUR",
                date: new Date(m.date), // Or createdAt if available
                title: `Misbehaviour Reported: ${m.type}`,
                description: m.description,
                status: "Reported",
                employeeName: m.employeeName,
                employeeId: m.employeeId
            });
        });

        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [tickets, leaves, markAsPresentRequests, misbehaviourReports, employees]);

    const filteredTimeline = timeline.filter(item => {
        if (filterType !== "ALL" && item.type !== filterType) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return item.title.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.employeeName.toLowerCase().includes(query) ||
                item.employeeId.toLowerCase().includes(query);
        }
        return true;
    });

    const getTypeColor = (type: TimelineItem["type"]) => {
        switch (type) {
            case "TICKET": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "LEAVE": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
            case "ATTENDANCE_OVERRIDE": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "MISBEHAVIOUR": return "bg-red-500/10 text-red-400 border-red-500/20";
            default: return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    const getTypeIcon = (type: TimelineItem["type"]) => {
        switch (type) {
            case "TICKET": return <Ticket size={16} className="text-blue-400" />;
            case "LEAVE": return <FileText size={16} className="text-purple-400" />;
            case "ATTENDANCE_OVERRIDE": return <Clock size={16} className="text-emerald-400" />;
            case "MISBEHAVIOUR": return <AlertCircle size={16} className="text-red-400" />;
            default: return <Activity size={16} className="text-zinc-400" />;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 min-h-screen">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl shadow-inner shadow-amber-500/10">
                            <Activity size={24} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 tracking-tight">Communications Log</h1>
                            <p className="text-xs text-amber-500/50 uppercase tracking-[0.2em] font-bold mt-1">Founders Universal Activity Sentinel</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-xl">
                    <Filter size={14} className="text-zinc-500 ml-2" />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="bg-transparent border-none outline-none text-[10px] text-zinc-300 font-bold uppercase tracking-widest px-2 cursor-pointer"
                    >
                        <option value="ALL">All Communications</option>
                        <option value="TICKET">Tickets</option>
                        <option value="LEAVE">Leaves</option>
                        <option value="ATTENDANCE_OVERRIDE">Attendance Overrides</option>
                        <option value="MISBEHAVIOUR">Misbehaviour</option>
                    </select>
                </div>
            </header>

            <div className="flex bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-2 max-w-xl shadow-inner backdrop-blur-sm relative z-10">
                <input
                    type="text"
                    placeholder="Search by Employee, Content, or Type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs px-4 py-2 text-white placeholder:text-zinc-600 font-medium"
                />
            </div>

            <main className="relative z-10">
                <div className="absolute top-0 bottom-0 left-8 md:left-[10.5rem] w-px bg-gradient-to-b from-amber-500/50 via-zinc-800 to-transparent z-0"></div>

                <div className="space-y-8 relative z-10">
                    <AnimatePresence>
                        {filteredTimeline.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex flex-col md:flex-row gap-4 md:gap-8 relative group"
                            >
                                {/* Timestamp Connector */}
                                <div className="hidden md:flex flex-col items-end pt-5 w-32 shrink-0">
                                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">
                                        {item.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </div>
                                    <div className="text-[9px] font-medium text-zinc-600 text-right mt-1">
                                        {item.date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>

                                {/* Node */}
                                <div className="absolute left-[1.6rem] md:left-[10.45rem] top-6 w-3 h-3 rounded-full bg-[#0a0a0b] border-2 border-amber-500/50 group-hover:border-amber-400 group-hover:scale-150 transition-all z-20 shadow-[0_0_10px_rgba(251,191,36,0.3)]"></div>

                                {/* Content Card */}
                                <div className="flex-1 ml-16 md:ml-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg group-hover:border-zinc-700 transition-colors">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg border shadow-inner", getTypeColor(item.type))}>
                                                {getTypeIcon(item.type)}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white line-clamp-1">{item.title}</h3>
                                                <div className="flex items-center mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 gap-1.5">
                                                    <span>{item.employeeName}</span>
                                                    <span>&middot;</span>
                                                    <span>{item.employeeId}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                                                item.status === "Resolved" || item.status === "Approved" ? "bg-emerald-500/10 text-emerald-400" :
                                                    item.status === "Pending" ? "bg-amber-500/10 text-amber-400" :
                                                        item.status === "Rejected" ? "bg-red-500/10 text-red-400" :
                                                            "bg-zinc-800 text-zinc-400"
                                            )}>
                                                {item.status}
                                            </span>
                                            <span className={cn("px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest", getTypeColor(item.type))}>
                                                {item.type}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
                                        {item.description}
                                    </p>

                                    {item.actionReason && (
                                        <div className="mt-4 pt-3 border-t border-zinc-800/50">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Attached Notes / Reason</p>
                                            <p className="text-xs text-amber-500/80 italic border-l-2 border-amber-500/30 pl-3 py-1 bg-amber-500/5 rounded-r">
                                                {item.actionReason}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {filteredTimeline.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-zinc-800/30 rounded-2xl border-dashed">
                                <Layers size={48} className="text-zinc-800 mb-4" />
                                <h3 className="text-sm font-bold text-zinc-500">No logs found.</h3>
                                <p className="text-xs text-zinc-600 mt-1">Try adjusting your filters or search query.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
