"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, Employee } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
    User, Camera, Mail, Phone, MapPin, Building, Briefcase,
    Calendar as CalendarIcon, Shield, Loader2, CheckCircle2,
    AlertCircle, CreditCard, FileText, ExternalLink, Link, GraduationCap,
    Landmark, Fingerprint, Wallet, Pencil, Save, X, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PostOnboardingChecklist from "@/components/onboarding/PostOnboardingChecklist";
import { PROFILE_FIELDS, PROFILE_DOCS, readField, fieldByKey, validateField, cleanValue, toIsoDate } from "@/lib/profile-fields";
import { FieldInput, DocSlot } from "@/components/profile/ProfileWidgets";

type ProfileData = { values: Record<string, string>; documents: { key: string; label: string; uploaded: boolean; restricted: boolean }[]; editable: string[]; editableDocs: string[]; missing: string[]; profileStatus: string };

export default function ProfilePage() {
    const { user, updateProfile, attendanceRecords } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Edit Profile: the saved profile from the server, the draft while editing, and per-field errors
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [docDraft, setDocDraft] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const loadProfile = useCallback(async () => {
        try {
            const r = await fetch("/api/employees/profile", { cache: "no-store" });
            if (r.ok) setProfile(await r.json());
        } catch { /* the page still shows the session data */ }
    }, []);
    useEffect(() => { if (user?.id) loadProfile(); }, [user?.id, loadProfile]);

    if (!user) return null;
    const emp = user as Employee;

    // Helper to resolve fields between CamelCase (Portal) and SnakeCase (Database/MongoDB)
    const getVal = (portal?: any, db?: any) => {
        const val = portal || db;
        if (!val || val === "?" || val === "NA" || val === "N/A") return "—";
        return val;
    };
    // Saved value of a profile field (server copy first, so an edit shows at once and after refresh)
    const saved = (key: string) => {
        const f = fieldByKey(key)!;
        const v = profile ? profile.values[key] : readField(emp, f);
        return v || "";
    };
    const show = (key: string) => saved(key) || "—";
    const canEdit = (key: string) => !!profile?.editable.includes(key);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    /** A profile row: input while editing (when the employee may change it), value otherwise; locked fields show a lock */
    const field = (key: string, display?: React.ReactNode) => {
        const f = fieldByKey(key)!;
        if (editing && canEdit(key)) return <FieldInput field={f} value={draft[key] ?? ""} error={errors[key]} onChange={v => { setDraft(d => ({ ...d, [key]: v })); setErrors(e => ({ ...e, [key]: "" })); }} />;
        const v = display ?? show(key);
        return editing ? <span className="inline-flex items-center gap-1.5" data-testid={`locked-${key}`}>{v} <Lock size={10} className="text-zinc-600" aria-label="Managed by HR" /></span> : v;
    };
    const startEdit = () => {
        const d: Record<string, string> = {};
        PROFILE_FIELDS.forEach(f => { d[f.key] = f.type === "date" ? toIsoDate(saved(f.key)) : saved(f.key); });
        setDraft(d); setDocDraft({}); setErrors({}); setStatus(null); setEditing(true);
    };
    const cancelEdit = () => { setEditing(false); setDraft({}); setDocDraft({}); setErrors({}); };
    const saveEdit = async () => {
        if (!profile) return;
        const fields: Record<string, string> = {};
        const errs: Record<string, string> = {};
        profile.editable.forEach(key => {
            const f = fieldByKey(key)!;
            const v = cleanValue(f, draft[key]);
            const before = f.type === "date" ? toIsoDate(saved(key)) : saved(key);
            if (v === before) return;                       // unchanged fields are not sent
            const e = validateField(f, v, today);
            if (e) errs[key] = e; else fields[key] = v;
        });
        setErrors(errs);
        if (Object.keys(errs).length) { setStatus({ type: "error", msg: "Please correct the highlighted fields." }); return; }
        if (!Object.keys(fields).length && !Object.keys(docDraft).length) { setEditing(false); setStatus({ type: "success", msg: "No changes to save." }); return; }
        setSaving(true); setStatus(null);
        try {
            const r = await fetch("/api/employees/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: emp.id, fields, documents: docDraft }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Could not save your profile.");
            setProfile(j.profile); setEditing(false); setDocDraft({});
            setStatus({ type: "success", msg: "Profile updated successfully!" });
        } catch (e: any) {
            setStatus({ type: "error", msg: e.message || "Could not save your profile." });
        } finally { setSaving(false); }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setStatus(null);
        try {
            const result = await uploadToCloudinary(file);
            await updateProfile({ photoUrl: result.secure_url });
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
                <div className="flex flex-wrap items-center gap-3">
                    {!editing ? (
                        <button onClick={startEdit} disabled={!profile} data-testid="profile-edit" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#10b981] text-black text-xs font-black hover:bg-[#12d393] disabled:opacity-50"><Pencil size={14} /> Edit Profile</button>
                    ) : (<>
                        <button onClick={saveEdit} disabled={saving} data-testid="profile-save" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#10b981] text-black text-xs font-black hover:bg-[#12d393] disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes</button>
                        <button onClick={cancelEdit} disabled={saving} data-testid="profile-cancel" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-black hover:bg-zinc-800"><X size={14} /> Cancel</button>
                    </>)}
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">System Verified</span>
                    </div>
                </div>
            </header>

            {editing && (
                <p className="text-[11px] text-zinc-400 -mt-2" data-testid="profile-edit-hint">Editing your profile. Fields with a <Lock size={10} className="inline text-zinc-500" /> (Employee ID, role, college, designation, department, joining date) and the Performance Matrix are managed by HR.</p>
            )}
            {status && editing && <p className={cn("text-xs font-bold", status.type === "error" ? "text-red-400" : "text-emerald-400")} data-testid="profile-edit-status">{status.msg}</p>}

            {/* Post-onboarding checklist: full width under the heading, summary only — activities open from a dropdown */}
            <div className="empty:hidden" data-testid="profile-post-onboarding">
                <PostOnboardingChecklist employeeId={user.id} mode="employee" collapsible />
            </div>

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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                Performance Matrix
                            </h3>
                            <div className="flex gap-2">
                                <select 
                                    className="bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1 text-[9px] text-zinc-400 outline-none cursor-pointer"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    <option value="2026">2026</option>
                                    <option value="2025">2025</option>
                                </select>
                                <select 
                                    className="bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1 text-[9px] text-zinc-400 outline-none cursor-pointer"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                >
                                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {(() => {
                                const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
                                const filteredAttendance = attendanceRecords.filter(r => {
                                    if (r.employeeId !== emp.id) return false;
                                    const date = new Date(r.date);
                                    return date.getFullYear().toString() === selectedYear && date.getMonth() === monthIndex;
                                });

                                return (
                                    <>
                                        <MetricRow label="Attendance Credits" value={`${emp.chancesRemaining}/3`} color="emerald" />
                                        <MetricRow label="Mark Present Used" value={emp.markPresentUsed || 0} color="amber" />
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            <MetricRow label="Late" value={filteredAttendance.filter(r => r.flags?.late).length} color="red" />
                                            <MetricRow label="Dress Code" value={filteredAttendance.filter(r => r.flags?.dressCode).length} color="red" />
                                            <MetricRow label="Misconduct" value={filteredAttendance.filter(r => r.flags?.misconduct).length} color="red" />
                                            <MetricRow label="Meeting" value={filteredAttendance.filter(r => r.flags?.meetingAbsent).length} color="red" />
                                            <MetricRow label="Performance" value={filteredAttendance.filter(r => r.flags?.performance).length} color="red" />
                                            <MetricRow label="Location" value={filteredAttendance.filter(r => r.flags?.locationDiff).length} color="red" />
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Right Column: Detailed Info Sections */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Section: Professional */}
                    <Section title="Professional Credentials" icon={<Briefcase size={16} />}>
                        <InfoRow icon={<Mail size={14} />} label="Institution Email" value={field("email", user.email)} />
                        <InfoRow icon={<Phone size={14} />} label="Professional Contact" value={field("phone_no_")} />
                        <InfoRow icon={<Building size={14} />} label="Department" value={field("dept", emp.dept || "—")} />
                        <InfoRow icon={<GraduationCap size={14} />} label="Corporate Node" value={field("location", getVal(emp.location, emp.you_are_from_))} />
                        <InfoRow icon={<Shield size={14} />} label="Designation" value={field("designation", getVal(emp.designation, emp.current_designation_at_gog))} />
                        <InfoRow icon={<CalendarIcon size={14} />} label="Joining Date" value={field("joiningDate", saved("joiningDate") || "Not added yet")} />
                        <InfoRow icon={<Briefcase size={14} />} label="Tenure Start" value={emp.designationDate || "—"} />
                    </Section>

                    {/* Section: Bank Details */}
                    <Section title="Remuneration & Banking" icon={<Landmark size={16} />}>
                        <InfoRow icon={<CreditCard size={14} />} label="Account Name" value={field("account_holder_name")} />
                        <InfoRow icon={<Fingerprint size={14} />} label="Account Number" value={field("bank_account_number")} />
                        <InfoRow icon={<Building size={14} />} label="Bank IFSC Code" value={field("ifsc_code")} />
                        <InfoRow icon={<Wallet size={14} />} label="Institutional UPI" value={field("upi_id")} />
                        {(editing || saved("bankName")) && <InfoRow icon={<Landmark size={14} />} label="Bank Name" value={field("bankName")} />}
                        {(editing || saved("panNumber")) && <InfoRow icon={<FileText size={14} />} label="PAN Number" value={field("panNumber")} />}
                        {(editing || saved("aadhaarNumber")) && <InfoRow icon={<FileText size={14} />} label="Aadhaar Number" value={field("aadhaarNumber")} />}
                    </Section>

                    {/* Section: Academic */}
                    <Section title="Academic Qualifications" icon={<GraduationCap size={16} />}>
                        <InfoRow icon={<FileText size={14} />} label="Bachelor Degree" value={field("bachelor_s_qualification")} />
                        <InfoRow icon={<FileText size={14} />} label="Master Degree" value={field("master_s_qualification")} />
                        <InfoRow icon={<FileText size={14} />} label="Institution" value={field("which_college_are_you_from_")} />
                        {(editing || saved("you_are_from_")) && <InfoRow icon={<GraduationCap size={14} />} label="University Tier" value={field("you_are_from_")} />}
                        <InfoRow icon={<ExternalLink size={14} />} label="LinkedIn Identity" value={editing ? field("linkedin_id") : saved("linkedin_id") ? <a href={saved("linkedin_id")} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">View Profile</a> : "—"} />
                    </Section>

                    {/* Section: Persona/Family */}
                    <Section title="Personal & Family" icon={<User size={16} />}>
                        {(editing || saved("full_name")) && <InfoRow icon={<User size={14} />} label="Full Name" value={field("full_name")} />}
                        <InfoRow icon={<User size={14} />} label="Father/Mother Name" value={field("father_name_or_mother_name")} />
                        <InfoRow icon={<Phone size={14} />} label="Parents Contact" value={field("parents_phone_no_")} />
                        <InfoRow icon={<Shield size={14} />} label="Blood Group" value={field("blood_group")} />
                        <InfoRow icon={<User size={14} />} label="Date of Birth" value={field("date_of_birth")} />
                        {(editing || saved("gender")) && <InfoRow icon={<User size={14} />} label="Gender" value={field("gender")} />}
                        {(editing || saved("permanent_address")) && <InfoRow icon={<MapPin size={14} />} label="Permanent Address" value={field("permanent_address")} />}
                        {(editing || saved("t_shirt_size")) && <InfoRow icon={<User size={14} />} label="T-Shirt Size" value={field("t_shirt_size")} />}
                    </Section>

                    {/* Full Width Section: Institutional Document Vault */}
                    <div className="md:col-span-2 bg-[#0d0f12]/40 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-6 lg:p-8">
                        <div className="flex items-center gap-3 border-b border-white/[0.05] pb-4 mb-6">
                            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500"><FileText size={18} /></div>
                            <h3 className="text-base font-bold text-white uppercase tracking-wider">Institutional Document Vault</h3>
                        </div>
                        {editing && <p className="text-[11px] text-zinc-400 mb-4">Upload missing documents or replace existing ones (PDF, JPG, PNG — max 10 MB). Changes are saved with <b>Save Changes</b>.</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 text-center" data-testid="profile-vault">
                            {PROFILE_DOCS.map(d => {
                                const st = profile?.documents.find(x => x.key === d.key);
                                return <DocSlot key={d.key} employeeId={emp.id} docKey={d.key} label={d.label} uploaded={st ? st.uploaded : !!readField(emp, d)}
                                    editable={editing && !!profile?.editableDocs.includes(d.key)} pending={docDraft[d.key]}
                                    onUploaded={url => setDocDraft(x => ({ ...x, [d.key]: url }))} />;
                            })}
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