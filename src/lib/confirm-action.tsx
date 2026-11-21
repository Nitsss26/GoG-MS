"use client";

/**
 * Double verification before an Approve / Accept / Reject: a small "Do you want to …?" dialog.
 *   if (!(await confirmAction({ action: "approve", what: "Neha Jain's leave (19/11/2026 → 21/11/2026)" }))) return;
 * Resolves true only on "Yes"; Cancel, the backdrop and Escape resolve false. Works from any client code (no provider).
 */
import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";

type Opts = {
    /** approve | accept | reject | anything else ("remove", "revoke" …) */
    action: string;
    /** what is being decided, e.g. "Neha Jain's leave request" */
    what?: string;
    /** full custom question (replaces "Do you want to <action> <what>?") */
    message?: string;
    /** text of the Yes button (default "Yes, <Action>") */
    confirmLabel?: string;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isNegative = (a: string) => /reject|decline|deny|revoke|remove|cancel|delete/i.test(a);

function Dialog({ o, done }: { o: Opts; done: (v: boolean) => void }) {
    const yes = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        yes.current?.focus();
        const k = (e: KeyboardEvent) => { if (e.key === "Escape") done(false); };
        window.addEventListener("keydown", k);
        return () => window.removeEventListener("keydown", k);
    }, [done]);
    const neg = isNegative(o.action);
    const q = o.message || `Do you want to ${o.action.toLowerCase()}${o.what ? ` ${o.what}` : " this"}?`;
    return (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => done(false)} data-testid="confirm-action">
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-q" onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl">
                <h2 className="text-base font-black text-white">Please confirm</h2>
                <p id="confirm-action-q" className="text-sm text-zinc-300 [overflow-wrap:anywhere]" data-testid="confirm-action-text">{q}</p>
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => done(false)} data-testid="confirm-action-no" className="h-11 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white text-sm font-bold">No, Cancel</button>
                    <button type="button" ref={yes} onClick={() => done(true)} data-testid="confirm-action-yes"
                        className={`h-11 rounded-xl text-white text-sm font-black ${neg ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}>
                        {o.confirmLabel || `Yes, ${cap(o.action.toLowerCase())}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function confirmAction(o: Opts): Promise<boolean> {
    if (typeof document === "undefined") return Promise.resolve(false);
    return new Promise(resolve => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);
        let closed = false;
        const done = (v: boolean) => {
            if (closed) return; closed = true;
            resolve(v);
            setTimeout(() => { root.unmount(); host.remove(); }, 0);
        };
        root.render(<Dialog o={o} done={done} />);
    });
}