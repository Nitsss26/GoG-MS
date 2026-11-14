"use client";
import { useEffect } from "react";

/** About every 60 s while an OMS tab is visible and online (HR → Workforce → OMS Status / Last Seen) */
export const HEARTBEAT_MS = 60 * 1000;

/**
 * Sends the presence heartbeat of the logged-in employee. The server identifies the employee from the session cookie,
 * stamps its own time and throttles writes, so several open tabs never mark anyone offline or flood the database.
 * Hidden tabs and offline browsers send nothing; closed tabs simply stop — the server turns them Offline after its window.
 */
export function usePresenceHeartbeat(userId?: string) {
    useEffect(() => {
        if (!userId || typeof window === "undefined") return;
        // celebration previews open OMS pages inside a frame — those are not a real visit
        try { if (window.self !== window.top) return; } catch { return; }
        let stopped = false;
        const beat = () => {
            if (stopped || document.visibilityState !== "visible" || navigator.onLine === false) return;
            fetch("/api/presence", { method: "POST", cache: "no-store", keepalive: true }).catch(() => { });
        };
        beat();
        const t = window.setInterval(beat, HEARTBEAT_MS);
        const onVisible = () => { if (document.visibilityState === "visible") beat(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", beat);
        return () => { stopped = true; window.clearInterval(t); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", beat); };
    }, [userId]);
}
