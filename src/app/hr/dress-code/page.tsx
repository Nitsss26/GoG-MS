"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Shirt, CheckCircle, XCircle, Search, Filter, AlertTriangle, User as UserIcon, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DressCodeVerificationPage() {
    const { user, attendanceRecords, employees, resolveDressCodeCheck } = useAuth();
    const today = new Date().toISOString().split("T")[0];
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");
    const [dateFilter, setDateFilter] = useState(today);

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;

    // Saved timestamps of the record, shown in the application time zone (never "now")
    const TZ = "Asia/Kolkata";
    const fmtDate = (ymd?: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
    const fmtTime = (hms?: string) => {
        if (!hms) return "—";
        const [h, m] = hms.split(":").map(Number);
        if (isNaN(h)) return hms;
        return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    };
    const fmtTs = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: TZ, day: "2-digit", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—");

    // Filter records that have images submitted
    const relevantRecords = attendanceRecords
        .filter(r => r.dressCodeImageUrl)
        .filter(r => {
            if (statusFilter === "Pending") return r.dressCodeStatus === "Pending"; // Show ALL pending across any date
            const statusMatch = statusFilter === "All" || r.dressCodeStatus === statusFilter;
            const dateMatch = r.date === dateFilter;
            return statusMatch && dateMatch;
        })
        .filter(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            if (!emp) return false;
            return emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.id.toLowerCase().includes(searchQuery.toLowerCase());
        });

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Shirt size={20} className="text-purple-400" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            {statusFilter === "Pending" ? "Pending Dress Code Verification" : `Dress Code Verification: ${dateFilter}`}
                        </h1>
                    </div>
                    <p className="text-xs text-zinc-400">
                        {statusFilter === "Pending" 
                            ? "Reviewing all pending clock-in photos across all dates." 
                            : `Reviewing ${statusFilter.toLowerCase()} photos for ${dateFilter === today ? "today" : dateFilter}.`}
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-lg h-fit">
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

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-lg flex items-center gap-2 px-3">
                        <Calendar size={14} className="text-zinc-500" />
                        <input 
                            type="date" 
                            title="Filter submissions by date"
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                if (statusFilter === "Pending") setStatusFilter("All"); // Switch to All if user specifically picks a date
                            }}
                            className="bg-transparent border-none outline-none text-xs font-black text-white py-1.5 focus:ring-0"
                        />
                    </div>
                </div>
            </header>

            <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800/50 p-3 rounded-2xl w-full max-w-md backdrop-blur-sm">
                <Search size={16} className="text-zinc-500 ml-2" />
                <input
                    type="text"
                    placeholder="Search employee by name or ID..."
                    title="Search query for matching names or IDs to filter results."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-zinc-600 font-medium"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relevantRecords.length === 0 ? (
                    <div className="col-span-full p-12 text-center flex flex-col items-center justify-center space-y-3 bg-zinc-900/30 border border-zinc-800/30 rounded-2xl border-dashed">
                        <CheckCircle size={32} className="text-zinc-700" />
                        <p className="text-sm font-bold text-zinc-500">No {statusFilter.toLowerCase()} dress code submissions found for today.</p>
                    </div>
                ) : (
                    relevantRecords.map(record => {
                        const emp = employees.find(e => e.id === record.employeeId);
                        const isActivePIP = record.flags.performance; // Just using as example indicator if they are troubled
                        const defaults = emp?.dressCodeDefaults || 0;

                        return (
                            <div key={record.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group shadow-xl">
                                <div className="p-4 border-b border-zinc-800/50 flex justify-between items-start bg-zinc-800/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white text-sm font-bold shadow-inner overflow-hidden shrink-0">
                                            {emp?.photoUrl ? <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-zinc-500" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white group-hover:text-primary transition-colors">{emp?.name}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{emp?.id} &middot; {emp?.designation}</p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "px-2 py-1 rounded border text-[9px] font-black uppercase tracking-widest",
                                        record.dressCodeStatus === "Pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                            record.dressCodeStatus === "Approved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                "bg-red-500/10 text-red-500 border-red-500/20"
                                    )}>
                                        {record.dressCodeStatus}
                                    </div>
                                </div>

                                <div className="relative aspect-[3/4] bg-black">
                                    {record.dressCodeImageUrl ? (
                                        <img src={record.dressCodeImageUrl} alt="Dress Code Submission" className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-bold">No Image Provided</div>
                                    )}

                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                                        <span className="text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10">Clocked In: {record.clockIn}</span>
                                        {defaults > 0 && (
                                            <span className="text-[10px] font-black text-red-400 bg-red-500/20 px-2 py-1 rounded backdrop-blur-sm border border-red-500/20 flex items-center gap-1">
                                                <AlertTriangle size={10} /> {defaults} Defaults
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Dress code details — saved record timestamps */}
                                <div className="p-4 border-t border-zinc-800 grid grid-cols-[6.5rem_1fr] gap-y-1 text-[11px]" data-testid="dress-details">
                                    <span className="text-zinc-500">Employee</span><span className="text-zinc-200 font-bold truncate">{emp?.name} <span className="text-zinc-500 font-mono font-normal">({emp?.id})</span></span>
                                    <span className="text-zinc-500">Date</span><span className="text-zinc-200" data-testid="dress-date">{fmtDate(record.date)}</span>
                                    <span className="text-zinc-500">Time</span><span className="text-zinc-200" data-testid="dress-time">{fmtTime(record.clockIn)}</span>
                                    <span className="text-zinc-500">Status</span><span className="text-zinc-200">{record.dressCodeStatus}</span>
                                    <span className="text-zinc-500">Recorded By</span><span className="text-zinc-200">{emp?.name || record.employeeId}</span>
                                    <span className="text-zinc-500">Created At</span><span className="text-zinc-300" data-testid="dress-created">{((record as any).dressCodeSubmittedAt || (record as any).createdAt) ? fmtTs((record as any).dressCodeSubmittedAt || (record as any).createdAt) : `${fmtDate(record.date)}, ${fmtTime(record.clockIn)}`}</span>
                                    {(record as any).dressCodeReviewedAt && <>
                                        <span className="text-zinc-500">Reviewed By</span><span className="text-zinc-300" data-testid="dress-reviewed">{(record as any).dressCodeReviewedByName || "—"} · {fmtTs((record as any).dressCodeReviewedAt)}</span>
                                    </>}
                                    <span className="text-zinc-500">Last Updated</span><span className="text-zinc-300" data-testid="dress-updated">{((record as any).dressCodeReviewedAt || (record as any).updatedAt) ? fmtTs((record as any).dressCodeReviewedAt || (record as any).updatedAt) : `${fmtDate(record.date)}, ${fmtTime(record.clockIn)}`}</span>
                                </div>

                                {record.dressCodeStatus === "Pending" && (
                                    <div className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800">
                                        <button
                                            onClick={() => resolveDressCodeCheck(record.id || (record as any)._id, "Rejected")}
                                            className="p-3 flex items-center justify-center gap-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors font-bold text-xs group/btn"
                                        >
                                            <XCircle size={16} className="group-hover/btn:scale-110 transition-transform" /> Reject
                                        </button>
                                        <button
                                            onClick={() => resolveDressCodeCheck(record.id || (record as any)._id, "Approved")}
                                            className="p-3 flex items-center justify-center gap-2 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 transition-colors font-bold text-xs group/btn"
                                        >
                                            <CheckCircle size={16} className="group-hover/btn:scale-110 transition-transform" /> Approve
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}