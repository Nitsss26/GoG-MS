"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Activity, Database, Server, RefreshCw, CheckCircle2, XCircle, Mail, Cloud, Link2, AlertTriangle } from "lucide-react";

/** Tech Support → System Status (live data from /api/tech-lead/status) */
export default function SystemStatusPage() {
    const { user } = useAuth();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true); setError("");
        try {
            const res = await fetch("/api/tech-lead/status");
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "Could not load the status");
            setData(d);
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    };
    useEffect(() => { if (user && ["TL", "FOUNDER"].includes(user.role)) load(); }, [user]);

    if (!user) return null;
    if (!["TL", "FOUNDER"].includes(user.role)) return <div className="p-8 text-center text-zinc-500">Access Denied. Tech Lead / Founder only.</div>;

    const Flag = ({ ok, label, icon: Icon }: { ok: boolean; label: string; icon: any }) => (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="flex items-center gap-2 text-xs text-zinc-300"><Icon size={14} className="text-zinc-500" /> {label}</span>
            {ok ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><CheckCircle2 size={13} /> Configured</span>
                : <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400"><XCircle size={13} /> Not configured</span>}
        </div>
    );
    const counts: [string, number][] = data ? [
        ["Employees", data.counts.employees], ["Active employees", data.counts.activeEmployees], ["Leave requests", data.counts.leaves],
        ["Pending leave", data.counts.pendingLeaves], ["Sprint plans", data.counts.sprintPlans], ["Class records", data.counts.classRecords],
        ["Unread notifications", data.counts.unreadNotifications],
    ] : [];

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Activity size={24} className="text-primary" /> System Status</h1>
                    <p className="text-xs text-zinc-500 mt-1">Live health of the portal{data ? ` · checked ${new Date(data.checkedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}</p>
                </div>
                <button onClick={load} className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" title="Refresh"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
            </div>
            {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"><AlertTriangle size={14} /> {error}</div>}
            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Database size={12} /> Database</p>
                            <p className={`text-lg font-bold mt-2 ${data.database.connected ? "text-emerald-400" : "text-red-400"}`}>{data.database.connected ? "Connected" : "Disconnected"}</p>
                            <p className="text-[11px] text-zinc-500">Round trip {data.database.roundTripMs} ms</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Server size={12} /> Server</p>
                            <p className="text-lg font-bold text-white mt-2">Up {Math.floor(data.server.uptimeSeconds / 3600)}h {Math.floor((data.server.uptimeSeconds % 3600) / 60)}m</p>
                            <p className="text-[11px] text-zinc-500">Node {data.server.node} · {data.server.timezone}</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} /> API</p>
                            <p className="text-lg font-bold text-white mt-2">{data.responseMs} ms</p>
                            <p className="text-[11px] text-zinc-500">Status request time</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {counts.map(([label, n]) => (
                            <div key={label} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                                <p className="text-xl font-bold text-white tabular-nums">{n}</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Flag ok={data.integrations.email} label="Email (SMTP)" icon={Mail} />
                        <Flag ok={data.integrations.cloudinary} label="File uploads (Cloudinary)" icon={Cloud} />
                        <Flag ok={data.integrations.appUrl} label="App URL for email links" icon={Link2} />
                    </div>
                    {data.recentJobs?.length > 0 && (
                        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Recent scheduled jobs</p>
                            <ul className="space-y-1.5">{data.recentJobs.map((j: any, i: number) => (
                                <li key={i} className="flex justify-between gap-3 text-xs"><span className="text-zinc-300 font-mono truncate">{j.key}</span><span className="text-zinc-500 shrink-0">{j.at ? new Date(j.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</span></li>
                            ))}</ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
