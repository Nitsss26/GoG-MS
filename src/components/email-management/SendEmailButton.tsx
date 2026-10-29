"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Send Email → Sending… → Sent / Retry Email. One click = one request (the button is locked while sending);
 * the server also makes sure the same email is sent only once.
 */
export default function SendEmailButton({ category, relatedRecordId, status, label = "Send Email", onDone, small }: {
    category: string; relatedRecordId: string; status: string; label?: string; small?: boolean;
    onDone?: (r: { ok: boolean; message?: string; error?: string; row?: any }) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [local, setLocal] = useState<string>("");
    const shown = busy ? "sending" : local || status;

    const send = async () => {
        if (busy || shown === "sent" || shown === "sending") return;
        setBusy(true);
        try {
            const r = await fetch("/api/hr/email-management/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, relatedRecordId }) });
            const d = await r.json().catch(() => ({}));
            const st = d.row?.status || (r.ok ? "sent" : "failed");
            setLocal(st);
            onDone?.({ ok: r.ok, message: d.message, error: d.error, row: d.row });
        } catch {
            setLocal("failed");
            onDone?.({ ok: false, error: "Could not reach GOG OMS. Please try again." });
        } finally { setBusy(false); }
    };

    const base = cn("inline-flex items-center gap-1.5 rounded-lg font-bold border whitespace-nowrap", small ? "text-[10px] px-2 py-1" : "text-[11px] px-3 py-1.5");
    if (shown === "sent") return <span className={cn(base, "text-emerald-300 border-emerald-500/30 bg-emerald-500/10")} data-testid="email-sent"><CheckCircle2 size={11} /> Sent</span>;
    if (shown === "sending") return <span className={cn(base, "text-sky-300 border-sky-500/30 bg-sky-500/10")} data-testid="email-sending"><Loader2 size={11} className="animate-spin" /> Sending…</span>;
    if (shown !== "not_sent" && shown !== "failed") return null;
    const retry = shown === "failed";
    return (
        <button onClick={send} disabled={busy} data-testid={retry ? "email-retry" : "email-send"}
            className={cn(base, retry ? "text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20" : "text-white border-emerald-600 bg-emerald-600 hover:bg-emerald-500", "disabled:opacity-50")}>
            {retry ? <RotateCcw size={11} /> : <Send size={11} />} {retry ? "Retry Email" : label}
        </button>
    );
}