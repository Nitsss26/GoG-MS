"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { 
    Lock, ShieldCheck, AlertCircle, CheckCircle2, 
    Loader2, KeyRound, Eye, EyeOff, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function ChangePasswordPage() {
    const { user, changePassword } = useAuth();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    if (!user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setStatus({ type: 'error', msg: "New passwords do not match" });
            return;
        }

        if (newPassword.length < 8) {
            setStatus({ type: 'error', msg: "Password must be at least 8 characters/digits long" });
            return;
        }

        setLoading(true);
        setStatus(null);
        
        try {
            const result = await changePassword(currentPassword, newPassword);
            if (result.success) {
                setStatus({ type: 'success', msg: result.msg });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                setStatus({ type: 'error', msg: result.msg });
            }
        } catch (err: any) {
            setStatus({ type: 'error', msg: "An unexpected error occurred" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] p-4 lg:p-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm space-y-4">
                <Link href="/profile" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em] group ml-2 mb-2">
                    <ChevronLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                    Portal Settings
                </Link>

                <div className="bg-[#0d0f12]/60 backdrop-blur-2xl border border-white/[0.05] rounded-[2.5rem] p-6 lg:p-10 shadow-3xl relative overflow-hidden group/card hover:border-white/[0.1] transition-all duration-500">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-20 group-hover/card:bg-primary/20 transition-all duration-700" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-16 -mb-16 blur-3xl opacity-20 group-hover/card:bg-blue-500/20 transition-all duration-700" />

                    <div className="relative z-10 space-y-8">
                        <div className="text-center space-y-3">
                            <div className="w-14 h-14 bg-zinc-900/80 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/[0.05] shadow-2xl group-hover/card:border-primary/30 transition-all duration-500">
                                <KeyRound size={24} className="text-primary group-hover/card:scale-110 transition-transform duration-500" />
                            </div>
                            <h1 className="text-xl font-black text-white tracking-tight uppercase">Update Passkey</h1>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">Update your security credentials for unified system access.</p>
                        </div>

                        <AnimatePresence mode="wait">
                            {status && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={cn(
                                        "p-4 rounded-2xl border flex items-center gap-3 shadow-lg",
                                        status.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                                    )}
                                >
                                    {status.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">{status.msg}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-2">Current Security Key</label>
                                <div className="relative group/input">
                                    <input
                                        type={showCurrent ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        className="w-full bg-zinc-950/50 border border-white/[0.05] rounded-2xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-primary/40 focus:bg-zinc-950 transition-all placeholder:text-zinc-800"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent(!showCurrent)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-primary transition-colors p-1"
                                    >
                                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-2">New Security Key (8+ Chars)</label>
                                <div className="relative group/input">
                                    <input
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        className="w-full bg-zinc-950/50 border border-white/[0.05] rounded-2xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-primary/40 focus:bg-zinc-950 transition-all placeholder:text-zinc-800"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(!showNew)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-primary transition-colors p-1"
                                    >
                                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-2">Confirm New Key</label>
                                <div className="relative group/input">
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full bg-zinc-950/50 border border-white/[0.05] rounded-2xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-primary/40 focus:bg-zinc-950 transition-all placeholder:text-zinc-800"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-primary transition-colors p-1"
                                    >
                                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-primary text-black font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl hover:bg-white hover:scale-[1.02] transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3 group mt-10 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {loading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <>
                                        Authorize Change
                                        <ShieldCheck size={16} className="text-black/60 group-hover:scale-110 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="pt-6 border-t border-white/[0.03]">
                            <p className="text-[8px] text-zinc-600 text-center font-bold uppercase tracking-widest leading-loose">
                                <Lock size={10} className="inline mr-1 text-primary/40 shrink-0" />
                                Credentials updated here will be required for your next institutional sign-in.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
