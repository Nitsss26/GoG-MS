"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Top-right notification bell (replaces the "Notifications" item in the sidebar).
 * Click → dropdown with the latest notifications; "View all" opens the existing /notifications page.
 * Uses the existing APIs only: GET /api/notifications(?unread=1) and PATCH /api/notifications ({ id } | { all: true }).
 */
const PREVIEW = 6;
const ago = (iso: string) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
};

export default function NotificationBell({ className = "" }: { className?: string }) {
    const { user } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<any[] | null>(null);
    const [busy, setBusy] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const btn = useRef<HTMLButtonElement>(null);
    // panel position: fixed to the viewport under the bell, always fully on screen (also on mobile)
    const [pos, setPos] = useState<{ top: number; right: number; width: number }>({ top: 64, right: 12, width: 384 });
    const place = useCallback(() => {
        const r = btn.current?.getBoundingClientRect(); if (!r) return;
        const vw = window.innerWidth;
        const width = Math.min(384, vw - 24);
        const right = Math.min(Math.max(12, vw - r.right), vw - width - 12);
        setPos({ top: r.bottom + 8, right, width });
    }, []);

    const loadCount = useCallback(() => fetch("/api/notifications?unread=1", { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) setUnread(d.unreadCount || 0); })
        .catch(() => { }), []);
    const loadList = useCallback(() => fetch("/api/notifications", { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) { setItems(Array.isArray(d.notifications) ? d.notifications : []); setUnread(d.unreadCount || 0); } })
        .catch(() => setItems([])), []);

    useEffect(() => {
        if (!user) return;
        loadList(); // pre-load so the dropdown opens instantly
    }, [user?.id, loadList]);
    useEffect(() => {
        if (!user) return;
        loadCount();
        const t = setInterval(loadCount, 60000);
        window.addEventListener("focus", loadCount);
        return () => { clearInterval(t); window.removeEventListener("focus", loadCount); };
    }, [user?.id, pathname, loadCount]);

    // close on route change, outside click and Escape
    useEffect(() => { setOpen(false); }, [pathname]);
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", place);
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", place); };
    }, [open]);

    const toggle = () => { const next = !open; if (next) { place(); loadList(); } setOpen(next); };
    const markRead = async (body: any) => {
        await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => { });
    };
    const openItem = async (n: any) => {
        if (!n.read) {
            setItems(list => (list || []).map(x => (x.id === n.id ? { ...x, read: true } : x)));
            setUnread(u => Math.max(0, u - 1));
            await markRead({ id: n.id });
        }
        setOpen(false);
        router.push(n.link || "/notifications");
    };
    const markAll = async () => {
        setBusy(true);
        await markRead({ all: true });
        setItems(list => (list || []).map(x => ({ ...x, read: true })));
        setUnread(0);
        setBusy(false);
    };

    if (!user) return null;
    // The bell shows only UNREAD notifications; read ones stay on the /notifications page ("View all")
    const unreadItems = (items || []).filter(n => !n.read);
    const preview = unreadItems.slice(0, PREVIEW);
    return (
        <div className={`relative ${className}`} ref={box}>
            <button type="button" ref={btn} onClick={toggle} aria-haspopup="true" aria-expanded={open} title="Notifications" data-testid="notif-bell"
                aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
                className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${open || pathname === "/notifications" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:border-zinc-600"}`}>
                <Bell size={18} />
                {unread > 0 && (
                    <span data-testid="notif-bell-count"
                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black flex items-center justify-center border-2 border-zinc-950">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div data-testid="notif-panel" role="menu"
                    className="fixed z-[95] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden"
                    style={{ top: pos.top, right: pos.right, width: pos.width }}>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                        <div>
                            <p className="text-sm font-bold text-white">Notifications</p>
                            <p className="text-[10px] text-zinc-500">{unread ? `${unread} unread` : "You're all caught up"}</p>
                        </div>
                        {unread > 0 && (
                            <button type="button" onClick={markAll} disabled={busy} data-testid="notif-mark-all"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">
                                {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={13} />} Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-[22rem] overflow-y-auto divide-y divide-zinc-900">
                        {items === null && <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-zinc-500" /></div>}
                        {items !== null && !preview.length && <p className="py-8 text-center text-xs text-zinc-500" data-testid="notif-empty">No new notifications. Read ones are in &ldquo;View all&rdquo;.</p>}
                        {preview.map(n => (
                            <button key={n.id} type="button" onClick={() => openItem(n)} data-testid="notif-item" data-unread={n.read ? "0" : "1"}
                                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-white/[0.03] transition-colors ${n.read ? "" : "bg-emerald-500/[0.04]"}`}>
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-emerald-400"}`} />
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-[12px] leading-snug [overflow-wrap:anywhere] ${n.read ? "text-zinc-300" : "text-white font-semibold"}`}>{n.title}</span>
                                    {n.message && <span className="block text-[11px] text-zinc-400 mt-0.5 line-clamp-2 [overflow-wrap:anywhere]">{n.message}</span>}
                                    <span className="block text-[10px] text-zinc-500 mt-1">{n.createdAt ? ago(n.createdAt) : ""}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <Link href="/notifications" onClick={() => setOpen(false)} data-testid="notif-view-all"
                        className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-zinc-800 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10">
                        View all notifications <ArrowRight size={13} />
                    </Link>
                </div>
            )}
        </div>
    );
}