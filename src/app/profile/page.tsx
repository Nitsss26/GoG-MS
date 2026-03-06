"use client";

import { useState, useRef } from "react";
import { useAuth, Employee } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
    User, Camera, Mail, Phone, MapPin, Building, Briefcase,
    Calendar as CalendarIcon, Shield, Loader2, CheckCircle2,
    AlertCircle, CreditCard, FileText, Linkedin, Link, GraduationCap,
    Landmark, Fingerprint, Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilePage() {
    const { user, updateProfile } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!user) return null;
    const emp = user as Employee;

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setStatus(null);
        try {
            const result = await uploadToCloudinary(file);
            updateProfile({ photoUrl: result.secure_url });
            setStatus({ type: 'success', msg: "Profile photo updated successfully!" });
        } catch (err: any) {
            setStatus({ type: 'error', msg: err.message || "Failed to upload photo" });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto w-full">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Institutional Profile</h1>
                    <p className="text-xs lg:text-sm text-zinc-400 font-medium">Verified professional records and identity portal.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">System Verified</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

                {/* Left Column: Quick Profile & Stats */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Primary Identity Card */}
                    <div className="bg-[#0d0f12]/40 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-8 flex flex-col items-center text-center shadow-xl">
                        <div className="relative group mb-6">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#10b981]/20 to-[#10b981]/5 border-2 border-[#10b981]/30 overflow-hidden flex items-center justify-center text-[#10b981] text-5xl font-black shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)]"
                            >
                                {user.photoUrl ? (
                                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    user.name[0]
                                )}
                            </motion.div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="absolute -bottom-2 -right-2 p-3 bg-[#10b981] text-black rounded-2xl shadow-2xl hover:bg-[#12d393] transition-all disabled:opacity-50 active:scale-90"
                            >
                                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoUpload}
                            />
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-white tracking-tight">{user.name}</h2>
                            <p className="text-[11px] text-[#10b981] font-black uppercase tracking-[0.2em]">{emp.designation}</p>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full mt-2">
                                <Shield size={10} className="text-zinc-500" />
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">ID: {emp.id}</p>
                            </div>
                        </div>

                        <AnimatePresence>
                            {status && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className={cn(
                                        "text-[10px] font-bold py-2 px-4 rounded-xl flex items-center gap-2 mt-4",
                                        status.type === 'success' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                                    )}
                                >
                                    {status.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                    {status.msg}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="w-full grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/[0.05]">
                            <div className="p-3 bg-white/[0.02] rounded-2xl border border-white/[0.03]">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Status</p>
                                <p className="text-[12px] text-emerald-500 font-black uppercase tracking-wider">{emp.status}</p>
                            </div>
                            <div className="p-3 bg-white/[0.02] rounded-2xl border border-white/[0.03]">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Access</p>
                                <p className="text-[12px] text-white font-black uppercase tracking-wider">{user.role}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Metrics */}
                    <div className="bg-[#0d0f12]/40 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-6">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            Performance Metrics
                        </h3>
                        <div className="space-y-3">
                            <MetricRow label="Attendance Credits" value={`${emp.chancesRemaining}/3`} color="emerald" />
                            <MetricRow label="Mark Present Used" value={emp.markPresentUsed || 0} color="amber" />
                            <MetricRow label="Dress Code Flags" value={emp.dressCodeDefaults || 0} color="red" />
                        </div>
                    </div>
                </div>

                {/* Right Column: Detailed Info Sections */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Section: Professional */}
                    <Section title="Professional Credentials" icon={<Briefcase size={16} />}>
                        <InfoRow icon={<Mail size={14} />} label="Institution Email" value={user.email} />
                        <InfoRow icon={<Phone size={14} />} label="Professional Contact" value={emp.phone || "—"} />
                        <InfoRow icon={<Building size={14} />} label="Department" value={emp.dept} />
                        <InfoRow icon={<GraduationCap size={14} />} label="Corporate Node" value={emp.location} />
                        <InfoRow icon={<Shield size={14} />} label="Designation" value={emp.designation} />
                        <InfoRow icon={<CalendarIcon size={14} />} label="Onboarding Date" value={emp.joiningDate} />
                    </Section>

                    {/* Section: Bank Details */}
                    <Section title="Remuneration & Banking" icon={<Landmark size={16} />}>
                        <InfoRow icon={<CreditCard size={14} />} label="Account Name" value={emp.bankAccountName || "—"} />
                        <InfoRow icon={<Fingerprint size={14} />} label="Account Number" value={emp.bankAccountNumber || "—"} />
                        <InfoRow icon={<Building size={14} />} label="Bank IFSC Code" value={emp.ifscCode || "—"} />
                        <InfoRow icon={<Wallet size={14} />} label="Institutional UPI" value={emp.upiId || "—"} />
                    </Section>

                    {/* Section: Academic */}
                    <Section title="Academic Qualifications" icon={<GraduationCap size={16} />}>
                        <InfoRow icon={<FileText size={14} />} label="Bachelor Degree" value={emp.bachelorQual || "—"} />
                        <InfoRow icon={<FileText size={14} />} label="Master Degree" value={emp.masterQual || "—"} />
                        <InfoRow icon={<FileText size={14} />} label="Institution" value={emp.collegeName || "—"} />
                        <InfoRow icon={<Linkedin size={14} />} label="LinkedIn Identity" value={emp.linkedinId ? <a href={emp.linkedinId} target="_blank" className="text-emerald-500 hover:underline">View Profile</a> : "—"} />
                    </Section>

                    {/* Section: Persona/Family */}
                    <Section title="Personal & Family" icon={<User size={16} />}>
                        <InfoRow icon={<User size={14} />} label="Father/Mother Name" value={emp.fatherMotherName || "—"} />
                        <InfoRow icon={<Phone size={14} />} label="Parents Contact" value={emp.parentsPhone || "—"} />
                        <InfoRow icon={<Shield size={14} />} label="Blood Group" value={emp.bloodGroup || "—"} />
                        <InfoRow icon={<User size={14} />} label="Gender Identity" value={emp.gender || "—"} />
                    </Section>

                    {/* Full Width Section: Documents */}
                    <div className="md:col-span-2 bg-[#0d0f12]/40 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-6 lg:p-8">
                        <div className="flex items-center gap-3 border-b border-white/[0.05] pb-4 mb-6">
                            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500"><FileText size={18} /></div>
                            <h3 className="text-base font-bold text-white uppercase tracking-wider">Institutional Document Vault</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
                            <DocLink label="Resume/CV" url={emp.resumeUrl} />
                            <DocLink label="Degree (Bach)" url={emp.bachelorCertUrl} />
                            <DocLink label="Degree (Mast)" url={emp.masterCertUrl} />
                            <DocLink label="Aadhar Card" url={emp.aadharCardUrl} />
                            <DocLink label="PAN Card" url={emp.panCardUrl} />
                            <DocLink label="ID Card" url={emp.passportPhotoUrl} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="bg-[#0d0f12]/40 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-6">
            <div className="flex items-center gap-3 border-b border-white/[0.05] pb-3 mb-5">
                <div className="text-[#10b981]">{icon}</div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.15em]">{title}</h3>
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-4">
            <div className="mt-1 text-zinc-500">{icon}</div>
            <div className="space-y-0.5">
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{label}</p>
                <div className="text-[12px] text-zinc-200 font-semibold">{value}</div>
            </div>
        </div>
    );
}

function MetricRow({ label, value, color }: { label: string, value: string | number, color: 'emerald' | 'amber' | 'red' }) {
    const colors = {
        emerald: 'text-emerald-500',
        amber: 'text-amber-500',
        red: 'text-red-500'
    };
    return (
        <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/[0.03]">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{label}</span>
            <span className={cn("text-[12px] font-black", colors[color])}>{value}</span>
        </div>
    );
}

function DocLink({ label, url }: { label: string, url?: string }) {
    return (
        <div className={cn(
            "group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all",
            url ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer" : "border-white/[0.03] bg-white/[0.01] opacity-40 cursor-not-allowed"
        )}>
            <div className={cn("mb-2 transition-transform group-hover:scale-110", url ? "text-emerald-500" : "text-zinc-600")}>
                <Link size={20} />
            </div>
            <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">{label}</p>
            {url && (
                <a href={url} target="_blank" className="absolute inset-0 opacity-0 bg-black/50 flex items-center justify-center rounded-2xl group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Open Link</span>
                </a>
            )}
        </div>
    );
}
