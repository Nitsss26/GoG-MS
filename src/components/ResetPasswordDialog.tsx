"use client";

import { useState } from "react";
import { KeyRound, X, Copy, Check, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { Employee } from "@/context/AuthContext";

/**
 * HR → Workforce → Reset Password.
 * Option A: generate a strong temporary password (shown once).
 * Option B: HR types a temporary password (+ confirm).
 * The server stores only a hash; the old password stops working at once.
 */
export default function ResetPasswordDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
    const [tab, setTab] = useState<"generate" | "manual">("generate");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<{ password?: string; resetAt: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async () => {
        setError("");
        if (tab === "manual") {
            if (newPassword.length < 8) return setError("Password must be at least 8 characters.");
            if (newPassword !== confirmPassword) return setError("Passwords do not match.");
        }
        setBusy(true);
        try {
            const res = await fetch("/api/hr/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tab === "generate"
                    ? { employeeId: employee.id, mode: "generate" }
                    : { employeeId: employee.id, mode: "manual", newPassword, confirmPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not reset the password.");
            setResult({ password: tab === "generate" ? data.temporaryPassword : undefined, resetAt: data.resetAt });
            // Clear the typed password from memory as soon as it is saved
            setNewPassword("");
            setConfirmPassword("");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        if (!result?.password) return;
        try {
            await navigator.clipboard.writeText(result.password);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard not available */ }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <KeyRound size={20} className="text-amber-400" /> Reset Password
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-sm text-white font-bold break-words">{employee.name}</p>
                        <p className="text-xs text-zinc-500 break-all">{employee.id} • {employee.role} • {employee.email}</p>
                    </div>

                    {result ? (
                        <div className="space-y-4" data-testid="reset-result">
                            <p className="text-sm text-green-400 font-bold">Password reset successfully.</p>
                            {result.password ? (
                                <>
                                    <p className="text-xs text-zinc-400">Give this temporary password to the employee securely. It is shown only once and is not stored anywhere in readable form.</p>
                                    <div className="flex items-center gap-2 bg-zinc-950 border border-amber-500/30 rounded-xl px-4 py-3">
                                        <code className="flex-1 text-base font-mono font-bold text-amber-300 tracking-wider break-all" data-testid="temp-password">{result.password}</code>
                                        <button onClick={copy} title="Copy" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
                                            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-zinc-400">The password you entered is now the employee&apos;s login password.</p>
                            )}
                            <p className="text-xs text-zinc-500">The previous password no longer works. The employee can log in with {employee.email} and the new password, and should change it from Change Password after logging in.</p>
                            <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-700 transition-all">Close</button>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-xl">
                                <button onClick={() => { setTab("generate"); setError(""); }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tab === "generate" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-white"}`}>
                                    Generate Password
                                </button>
                                <button onClick={() => { setTab("manual"); setError(""); }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tab === "manual" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-white"}`}>
                                    Set Password
                                </button>
                            </div>

                            {tab === "generate" ? (
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    A strong temporary password (12 characters with letters, numbers and a symbol) will be created and shown to you once.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <input type={show ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                            placeholder="New password" autoComplete="new-password" name="hr-new-password"
                                            className="w-full px-4 py-3 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white outline-none focus:border-amber-500/50" />
                                        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                                            {show ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <input type={show ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm password" autoComplete="new-password" name="hr-confirm-password"
                                        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white outline-none focus:border-amber-500/50" />
                                    <p className="text-[11px] text-zinc-500">At least 8 characters, with at least one letter and one number, no spaces.</p>
                                </div>
                            )}

                            {error && <p className="text-xs text-red-400">{error}</p>}

                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl border border-zinc-700 transition-all text-sm">Cancel</button>
                                <button onClick={submit} disabled={busy}
                                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                    {busy && <RefreshCw size={14} className="animate-spin" />}
                                    {tab === "generate" ? "Generate Temporary Password" : "Save Password"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
