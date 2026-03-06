"use client";
import { useState } from "react";
import { useAuth, MarkAsPresentRequest } from "@/context/AuthContext";
import { CheckCircle, XCircle, Search, Clock, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AttendanceOverridePage() {
    const { user, markAsPresentRequests, employees, resolveMarkAsPresentRequest } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");

    if (!user || user.role !== "HR") return null;

    const relevantRequests = markAsPresentRequests
        .filter(r => statusFilter === "All" || r.status === statusFilter)
        .filter(r => r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || r.employeeId.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Clock size={20} className="text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Attendance Overrides</h1>
                    </div>
                    <p className="text-xs text-zinc-400">Review "Mark As Present" requests from employees who couldn't clock in normally.</p>
                </div>

                <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-lg">
                    {["All", "Pending", "Approved", "Rejected"].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter as any)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                statusFilter === filter ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800/50 p-3 rounded-2xl w-full max-w-md backdrop-blur-sm">
                <Search size={16} className="text-zinc-500 ml-2" />
                <input
                    type="text"
                    placeholder="Search by name or ID..."
                    title="Search query"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-zinc-600 font-medium"
                />
            </div>

            <div className="space-y-4">
                {relevantRequests.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-zinc-900/30 border border-zinc-800/30 rounded-2xl border-dashed">
                        <CheckCircle size={32} className="text-zinc-700" />
                        <p className="text-sm font-bold text-zinc-500">No {statusFilter.toLowerCase()} override requests found.</p>
                    </div>
                ) : (
                    relevantRequests.map(req => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        const creditsUsed = emp?.markPresentUsed || 0;
                        const dateFormatted = new Date(req.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

                        return (
                            <div key={req.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row">
                                <div className="p-5 md:w-1/3 border-b md:border-b-0 md:border-r border-zinc-800/50 bg-zinc-800/20 flex flex-col justify-between space-y-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner border border-primary/20 shrink-0">
                                                {emp?.name?.[0] || "?"}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white">{emp?.name}</p>
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{emp?.id} &middot; {emp?.designation}</p>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "inline-block px-2.5 py-1 rounded border text-[9px] font-black uppercase tracking-widest",
                                            req.status === "Pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                req.status === "Approved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                    "bg-red-500/10 text-red-500 border-red-500/20"
                                        )}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                                        <p className="text-[10px] text-zinc-500 font-medium">Monthly Override Credits Used</p>
                                        <div className="flex items-end gap-1 mt-1">
                                            <span className={cn("text-lg font-black", creditsUsed >= 3 ? "text-red-400" : "text-white")}>{creditsUsed}</span>
                                            <span className="text-zinc-500 text-xs font-bold mb-1">/ 3</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Target Date</p>
                                            <p className="text-sm font-bold text-blue-400">{dateFormatted}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Applied At</p>
                                            <p className="text-[10px] text-zinc-400">{new Date(req.appliedAt).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Reason / Justification</p>
                                        <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50 text-sm text-zinc-300 leading-relaxed">
                                            {req.reason}
                                        </div>
                                    </div>

                                    {req.proofUrls && req.proofUrls.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Attached Proofs</p>
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                                {req.proofUrls.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative group">
                                                        <div className="w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                                                            {url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                                <img src={url} alt={`proof ${i}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                            ) : (
                                                                <FileText size={20} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                                                            )}
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                                            <span className="text-[8px] font-bold text-white uppercase tracking-widest">View</span>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {req.status === "Pending" && (
                                        <div className="flex gap-3 pt-2 mt-auto">
                                            <button
                                                onClick={() => resolveMarkAsPresentRequest(req.id, "Rejected")}
                                                className="flex-1 py-3 bg-zinc-800 hover:bg-red-500/10 border border-zinc-700 hover:border-red-500/30 text-zinc-400 hover:text-red-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn"
                                            >
                                                <XCircle size={16} className="group-hover/btn:scale-110 transition-transform" /> Reject Request
                                            </button>
                                            <button
                                                onClick={() => resolveMarkAsPresentRequest(req.id, "Approved")}
                                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 group/btn"
                                            >
                                                <CheckCircle2 size={16} className="group-hover/btn:scale-110 transition-transform" /> Grant Mark Present
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
