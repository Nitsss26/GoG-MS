"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Bell, CheckCheck, RefreshCw, Mail, ExternalLink } from "lucide-react";

/** The logged-in user's academic notifications (unlock requests, verifications, reverts, reminders). */
export default function NotificationsPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/notifications");
            const d = await res.json();
            setItems(d.notifications || []);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { if (user) load(); }, [user]);

    const markRead = async (id?: string) => {
        await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
        setItems(list => list.map(n => (!id || n.id === id) ? { ...n, read: true } : n));
    };

    if (!user) return null;
    const shown = filter === "unread" ? items.filter(n => !n.read) : items;
    const unread = items.filter(n => !n.read).length;

    return (
        <div className="max-w-3xl mx-auto pt-8 pb-16 px-4 sm:px-6 space-y-5 w-full [contain:inline-size]">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Bell size={22} className="text-amber-400" /></div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Notifications</h1>
                        <p className="text-xs text-zinc-400">{unread} unread</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
                    {unread > 0 && <button onClick={() => markRead()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold"><CheckCheck size={14} /> Mark all read</button>}
                </div>
            </div>
            <div className="flex gap-2">
                {(["all", "unread"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${filter === f ? "bg-amber-500 text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>{f}</button>
                ))}
            </div>
            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : shown.length === 0 ? (
                <div className="text-center py-16 text-sm text-zinc-500 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">No notifications.</div>
            ) : (
                <div className="space-y-2" data-testid="notification-list">
                    {shown.map(n => (
                        <div key={n.id} className={`p-4 rounded-2xl border ${n.read ? "border-zinc-800 bg-zinc-900/30" : "border-amber-500/30 bg-amber-500/5"}`} data-testid="notification">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white [overflow-wrap:anywhere]">{n.title}</p>
                                    <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{n.message}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-2 flex-wrap">
                                        {new Date(n.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                                        {n.actorName && <span>· by {n.actorName}</span>}
                                        {n.emailStatus === "SENT" && <span className="flex items-center gap-1 text-emerald-500"><Mail size={10} /> emailed</span>}
                                        {n.emailStatus === "FAILED" && <span className="flex items-center gap-1 text-red-400"><Mail size={10} /> email failed</span>}
                                    </p>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
                                    {n.link && <Link href={n.link} onClick={() => !n.read && markRead(n.id)} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:underline">Open <ExternalLink size={11} /></Link>}
                                    {!n.read && <button onClick={() => markRead(n.id)} className="text-[11px] text-zinc-400 hover:text-white">Mark read</button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
