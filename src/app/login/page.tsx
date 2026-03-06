"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, LogIn, ChevronDown, Lock, Key, LayoutDashboard, ShieldCheck, Zap } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const ROLE_OPTIONS = [
    { key: "FOUNDER", label: "Founder" },
    { key: "HR", label: "Human Resources (HR)" },
    { key: "AD", label: "Associate Director (AD)" },
    { key: "TL", label: "Tech Lead (TL)" },
    { key: "HOI", label: "Head of Institute (HOI)" },
    { key: "OM", label: "Operations Manager (OM)" },
    { key: "PROFESSOR", label: "Academic Faculty / Professor" },
];

export default function LoginPage() {
    const { login } = useAuth();
    const [selectedRole, setSelectedRole] = useState("FOUNDER");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Mouse Parallax for subtle depth
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springX = useSpring(mouseX, { stiffness: 40, damping: 25 });
    const springY = useSpring(mouseY, { stiffness: 40, damping: 25 });

    // Consistent transforms
    const cardRotateX = useTransform(springY, [-500, 500], [2, -2]);
    const cardRotateY = useTransform(springX, [-500, 500], [-2, 2]);
    const bgX = useTransform(springX, (v) => v * 0.015);
    const bgY = useTransform(springY, (v) => v * 0.015);
    const bgScale = useTransform(springX, [-500, 500], [1.07, 1.11]);

    useEffect(() => {
        setMounted(true);
        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;
            mouseX.set(clientX - innerWidth / 2);
            mouseY.set(clientY - innerHeight / 2);
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseX, mouseY]);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError("");
        if (!email || !password) {
            setError("Please enter institutional email and passkey.");
            return;
        }

        setIsLoading(true);
        try {
            const result = login(email, password, selectedRole);
            if (!result.success) {
                setError(result.msg || "Authentication failed.");
            }
        } catch (err) {
            setError("An unexpected error occurred during institutional sign-in.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen w-screen bg-black flex items-start lg:items-center justify-center relative overflow-x-hidden select-none font-sans py-8 lg:py-0">

            {/* HIGH-DEFINITION CRYSTAL 3D BACKGROUND */}
            <motion.div
                style={{ x: bgX, y: bgY, scale: bgScale }}
                className="fixed inset-0 z-0 pointer-events-none"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('/3D.png')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black/80 lg:bg-gradient-to-r lg:from-black/70 lg:via-transparent lg:to-black/70" />
            </motion.div>

            {/* MAIN CONTENT HUB */}
            <motion.div
                className="relative z-10 w-full max-w-[1400px] flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-20 px-6 lg:px-10 scale-100 lg:scale-[0.85] origin-top lg:origin-center mt-4 lg:mt-0"
            >

                {/* Left Branding - Compact & Professional */}
                <div className="w-full lg:w-1/2 space-y-4 lg:space-y-6 text-center lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <img
                            src="https://i.postimg.cc/4NdhCzDD/logo-(2).png"
                            alt="Geeks of Gurukul"
                            className="h-8 lg:h-11 mx-auto lg:mx-0 object-contain brightness-150 drop-shadow-lg"
                        />
                    </motion.div>

                    <div className="space-y-3 lg:space-y-4">
                        <motion.h1
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-3xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] lg:leading-[1.05]"
                        >
                            Organization <br className="hidden lg:block" />
                            <span className="text-[#10b981] drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">Management</span> System.
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-zinc-300 text-xs lg:text-lg font-medium max-w-sm lg:max-w-md mx-auto lg:mx-0 leading-relaxed drop-shadow-sm"
                        >
                            The unified SaaS ecosystem for Internal Operations, Academics, and HR Management.
                        </motion.p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex flex-wrap justify-center lg:justify-start gap-3 lg:gap-4"
                    >
                        <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-black/50 border border-white/10 rounded-xl backdrop-blur-md">
                            <ShieldCheck size={14} className="text-[#10b981]" />
                            <span className="text-[9px] lg:text-[10px] font-bold text-white uppercase tracking-widest">Secure Auth</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-black/50 border border-white/10 rounded-xl backdrop-blur-md">
                            <Zap size={14} className="text-[#10b981]" />
                            <span className="text-[9px] lg:text-[10px] font-bold text-white uppercase tracking-widest">Elite Speed</span>
                        </div>
                    </motion.div>
                </div>

                {/* Right Portal Card - Refined Charcoal Glassmorphism */}
                <motion.div
                    style={{
                        rotateX: cardRotateX,
                        rotateY: cardRotateY,
                        transformStyle: "preserve-3d"
                    }}
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="w-full max-w-[420px] lg:max-w-[440px]"
                >
                    <div className="relative bg-[#0d0f12]/40 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] lg:rounded-[2.5rem] p-7 lg:p-12 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">

                        <div className="mb-6 lg:mb-8">
                            <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Portal Sign-in</h2>
                            <p className="text-[10px] lg:text-xs text-zinc-400 mt-1 lg:mt-2 font-medium">Institutional credentials required.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4 lg:space-y-6">
                            {/* Access Tier */}
                            <div className="space-y-2">
                                <label className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 opacity-80">Institutional Access Tier</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#10b981]">
                                        <LayoutDashboard size={16} />
                                    </div>
                                    <select
                                        className="w-full bg-[#1c1f26]/40 border border-white/10 rounded-xl lg:rounded-2xl py-3.5 lg:py-4 pl-11 lg:pl-12 pr-10 text-[13px] lg:text-[14px] text-white font-semibold focus:border-[#10b981]/50 outline-none transition-all appearance-none cursor-pointer"
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                    >
                                        {ROLE_OPTIONS.map(opt => (
                                            <option key={opt.key} value={opt.key} className="bg-[#1c1f26]">{opt.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                                </div>
                            </div>

                            {/* Institutional Email */}
                            <div className="space-y-2">
                                <label className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 opacity-80">Institutional Email</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#10b981]">
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="institutional@gog.com"
                                        className="w-full bg-[#1c1f26]/40 border border-white/10 rounded-xl lg:rounded-2xl py-3.5 lg:py-4 pl-11 lg:pl-12 pr-4 text-[13px] lg:text-[14px] text-white font-semibold focus:border-[#10b981]/50 outline-none transition-all"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Security Passkey */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest opacity-80">Security Passkey</label>
                                    <button type="button" className="text-[9px] font-bold text-[#10b981] hover:text-[#34d399] uppercase tracking-widest transition-colors">Recovery</button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#10b981]">
                                        <Key size={16} />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="Institutional Passcode"
                                        className="w-full bg-[#1c1f26]/40 border border-white/10 rounded-xl lg:rounded-2xl py-3.5 lg:py-4 pl-11 lg:pl-12 pr-4 text-[13px] lg:text-[14px] text-white font-semibold focus:border-[#10b981]/50 outline-none transition-all"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-[10px] font-bold text-center"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full group relative overflow-hidden bg-[#10b981] hover:bg-[#12d393] text-black font-black text-[11px] lg:text-[12px] uppercase tracking-[0.2em] lg:tracking-[0.25em] py-4 rounded-xl lg:rounded-2xl transition-all shadow-[0_15px_30px_-5px_rgba(16,185,129,0.3)] active:scale-95 mt-2 lg:mt-4 disabled:opacity-50"
                                style={{ padding: "16px" }}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isLoading ? "Authenticating..." : "Enter Console"} <LogIn size={16} />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            </button>
                        </form>

                        <div className="mt-8 lg:mt-10 pt-6 lg:pt-8 border-t border-white/[0.06] text-center">
                            <p className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] lg:tracking-[0.25em]">
                                &copy; {new Date().getFullYear()} Geeks of Gurukul <br />
                                <span className="opacity-80 font-medium">Enterprise Management Suite</span>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
