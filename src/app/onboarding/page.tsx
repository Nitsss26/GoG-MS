"use client";

import { useState } from "react";
import { useAuth, EducationRecord, ExperienceRecord } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    GraduationCap,
    Briefcase,
    ShieldCheck,
    Wallet,
    FileText,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Plus,
    Trash2,
    Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
    const { user, updateOnboarding } = useAuth();
    const [step, setStep] = useState(1);
    const router = useRouter();

    const [form, setForm] = useState({
        phone: "",
        address: "",
        dateOfBirth: "",
        gender: "",
        bloodGroup: "",
        maritalStatus: "",
        nationality: "Indian",
        emergencyContact: "",
        education: [] as EducationRecord[],
        experience: [] as ExperienceRecord[],
        panNumber: "",
        aadhaarNumber: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        bankBranch: ""
    });

    const [eduEntry, setEduEntry] = useState<EducationRecord>({ degree: "", institution: "", yearOfPassing: "", percentage: "" });
    const [expEntry, setExpEntry] = useState<ExperienceRecord>({ company: "", role: "", duration: "", lastSalary: 0 });

    const addEducation = () => {
        if (eduEntry.degree && eduEntry.institution) {
            setForm({ ...form, education: [...form.education, eduEntry] });
            setEduEntry({ degree: "", institution: "", yearOfPassing: "", percentage: "" });
        }
    };

    const addExperience = () => {
        if (expEntry.company && expEntry.role) {
            setForm({ ...form, experience: [...form.experience, expEntry] });
            setExpEntry({ company: "", role: "", duration: "", lastSalary: 0 });
        }
    };

    const handleComplete = () => {
        if (!user) return;
        updateOnboarding(user.id, form);
        router.push("/");
    };

    const steps = [
        { id: 1, label: "Personal Info", icon: <User size={14} /> },
        { id: 2, label: "Education", icon: <GraduationCap size={14} /> },
        { id: 3, label: "Experience", icon: <Briefcase size={14} /> },
        { id: 4, label: "KYC & IDs", icon: <ShieldCheck size={14} /> },
        { id: 5, label: "Banking", icon: <Wallet size={14} /> },
        { id: 6, label: "Review", icon: <FileText size={14} /> },
    ];

    const nextStep = () => setStep(s => Math.min(6, s + 1));
    const prevStep = () => setStep(s => Math.max(1, s - 1));

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl card flex flex-col md:flex-row overflow-hidden min-h-[600px] border-zinc-800 bg-[#09090b]">
                {/* Stepper Sidebar */}
                <div className="md:w-64 bg-zinc-950 border-r border-zinc-800 p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]">G</div>
                        <div>
                            <span className="text-sm font-bold text-white block">GoG Onboarding</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Institutional Node</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {steps.map((s) => (
                            <div key={s.id} className="relative flex items-center gap-4">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all z-10",
                                    step === s.id ? "bg-primary text-primary-foreground scale-110 shadow-[0_0_15px_rgba(16,185,129,0.2)]" :
                                        step > s.id ? "bg-primary/20 text-primary border border-primary/20" :
                                            "bg-zinc-900 border border-zinc-800 text-zinc-600"
                                )}>
                                    {step > s.id ? <CheckCircle2 size={14} /> : s.id}
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", step >= s.id ? "text-primary/70" : "text-zinc-600")}>Step 0{s.id}</span>
                                    <span className={cn("text-xs font-semibold", step >= s.id ? "text-zinc-100" : "text-zinc-500")}>{s.label}</span>
                                </div>
                                {s.id !== 6 && <div className={cn("absolute left-4 top-8 w-[1px] h-4 z-0", step > s.id ? "bg-primary/30" : "bg-zinc-800")} />}
                            </div>
                        ))}
                    </div>

                    <div className="pt-8 border-t border-zinc-900 mt-auto">
                        <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                                <Lock size={12} className="text-primary" /> ENCRYPTED SESSION
                            </div>
                            <p className="text-[9px] text-zinc-500 leading-relaxed">Your institutional record is protected by zero-trust encryption protocols.</p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-10 flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex-1 space-y-8"
                        >
                            {/* Step 1: Personal */}
                            {step === 1 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight text-primary">Personal Infrastructure</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Configure your primary institutional identity nodes.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Mobile Presence</label>
                                            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-primary/50 transition-all" placeholder="+91 00000 00000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Date of Birth</label>
                                            <input type="date" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-primary/50" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Gender Node</label>
                                            <select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                                <option value="">Select...</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Blood Registry</label>
                                            <select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" value={form.bloodGroup} onChange={e => setForm({ ...form, bloodGroup: e.target.value })}>
                                                <option value="">Select...</option>
                                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2 space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Residential Address</label>
                                            <textarea className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white h-20 resize-none" placeholder="Full permanent address..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Emergency Signal</label>
                                            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="Name & Relationship (Phone)" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Marital Status</label>
                                            <select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" value={form.maritalStatus} onChange={e => setForm({ ...form, maritalStatus: e.target.value })}>
                                                <option value="">Select...</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Separated">Separated</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Education */}
                            {step === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Academic Genesis</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Catalog your formal knowledge acquisition history.</p>
                                    </div>
                                    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Degree / Certification</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="e.g. B.Tech Computer Science" value={eduEntry.degree} onChange={e => setEduEntry({ ...eduEntry, degree: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Institution</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="University Name" value={eduEntry.institution} onChange={e => setEduEntry({ ...eduEntry, institution: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Passing Year</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="e.g. 2022" value={eduEntry.yearOfPassing} onChange={e => setEduEntry({ ...eduEntry, yearOfPassing: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Percentage / CGPA</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="e.g. 85% or 9.0" value={eduEntry.percentage} onChange={e => setEduEntry({ ...eduEntry, percentage: e.target.value })} />
                                            </div>
                                        </div>
                                        <button onClick={addEducation} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold border border-zinc-700 transition-colors flex items-center justify-center gap-2">
                                            <Plus size={14} className="text-primary" /> Append Record
                                        </button>
                                    </div>

                                    {form.education.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Aggregated Records</p>
                                            <div className="space-y-2">
                                                {form.education.map((edu, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl group">
                                                        <div>
                                                            <p className="text-xs font-bold text-white">{edu.degree}</p>
                                                            <p className="text-[10px] text-zinc-500">{edu.institution} · {edu.yearOfPassing}</p>
                                                        </div>
                                                        <button onClick={() => setForm({ ...form, education: form.education.filter((_, idx) => idx !== i) })} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Experience */}
                            {step === 3 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Professional Trajectory</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Map your previous institutional deployment nodes.</p>
                                    </div>
                                    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Organization</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="Last Company" value={expEntry.company} onChange={e => setExpEntry({ ...expEntry, company: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Institutional Role</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="Designation" value={expEntry.role} onChange={e => setExpEntry({ ...expEntry, role: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Tenure / Duration</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="e.g. 2 Years" value={expEntry.duration} onChange={e => setExpEntry({ ...expEntry, duration: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Last Realized Salary (INR)</label>
                                                <input type="number" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="Monthly amount" value={expEntry.lastSalary || ""} onChange={e => setExpEntry({ ...expEntry, lastSalary: parseInt(e.target.value) })} />
                                            </div>
                                        </div>
                                        <button onClick={addExperience} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold border border-zinc-700 transition-colors flex items-center justify-center gap-2">
                                            <Plus size={14} className="text-primary" /> Append History
                                        </button>
                                    </div>

                                    {form.experience.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Deployment History</p>
                                            <div className="space-y-2">
                                                {form.experience.map((exp, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl group">
                                                        <div>
                                                            <p className="text-xs font-bold text-white">{exp.company}</p>
                                                            <p className="text-[10px] text-zinc-500">{exp.role} · {exp.duration}</p>
                                                        </div>
                                                        <button onClick={() => setForm({ ...form, experience: form.experience.filter((_, idx) => idx !== i) })} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 4: KYC */}
                            {step === 4 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Government Integrity</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Verify your legal identity across Indian statutory networks.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">PAN Card Registry</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="10-digit PAN (ABCDE1234F)" value={form.panNumber} onChange={e => setForm({ ...form, panNumber: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Aadhaar Synchronization</label>
                                                <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="12-digit UID (0000 0000 0000)" value={form.aadhaarNumber} onChange={e => setForm({ ...form, aadhaarNumber: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Digital Evidence Upload</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {[
                                                    { label: "Passport Image", key: "passport" },
                                                    { label: "PAN Card Image", key: "pan" },
                                                    { label: "Passbook / Cancelled Cheque", key: "passbook" }
                                                ].map(doc => (
                                                    <div key={doc.key} className="p-3 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl flex items-center justify-between hover:bg-zinc-900 transition-colors group cursor-pointer">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                                                                <FileText size={16} />
                                                            </div>
                                                            <span className="text-[11px] font-medium text-zinc-300">{doc.label}</span>
                                                        </div>
                                                        <button className="text-[9px] font-bold text-primary uppercase bg-primary/10 px-3 py-1.5 rounded-md hover:bg-primary/20 transition-all italic">Upload</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-start gap-3">
                                        <ShieldCheck size={18} className="text-primary shrink-0" />
                                        <p className="text-[10px] text-zinc-400 leading-relaxed">By uploading these documents, you authorize Geeks of Gurukul to process your identity for statutory compliance and payroll purposes. All uploads are stored on private institutional servers.</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Banking */}
                            {step === 5 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Financial Dispatch Node</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Configure your salary disbursal coordinates.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Banking Entity</label>
                                            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="e.g. HDFC Bank, ICICI Bank" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Account Identifier</label>
                                            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="Bank Account Number" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Systemic IFSC Code</label>
                                            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="e.g. HDFC0001234" value={form.ifscCode} onChange={e => setForm({ ...form, ifscCode: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Institutional Branch</label>
                                            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-white" placeholder="Branch Name & City" value={form.bankBranch} onChange={e => setForm({ ...form, bankBranch: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-zinc-900 rounded-2xl flex items-center gap-4 border border-zinc-800">
                                        <div className="p-2 bg-zinc-800 rounded-lg"><Wallet size={20} className="text-primary" /></div>
                                        <div>
                                            <p className="text-xs font-bold text-white">Salary Credit Verification</p>
                                            <p className="text-[10px] text-zinc-500">Payments will be processed on the 1st of every month via NEFT/IMPS.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 6: Review */}
                            {step === 6 && (
                                <div className="space-y-8">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-4 border border-primary/20">
                                            <ShieldCheck size={32} />
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Genesis Finalization</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Verify your institutional record before final commit.</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl space-y-2">
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase">Primary Node</p>
                                            <p className="text-xs font-bold text-white">{user?.name}</p>
                                            <p className="text-[10px] text-zinc-400">{form.phone}</p>
                                        </div>
                                        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl space-y-2">
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase">KYC Metadata</p>
                                            <p className="text-xs font-bold text-white">PAN: {form.panNumber}</p>
                                            <p className="text-[10px] text-zinc-400">UID: {form.aadhaarNumber}</p>
                                        </div>
                                        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl space-y-2">
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase">Banking Hub</p>
                                            <p className="text-xs font-bold text-white text-primary">{form.bankName}</p>
                                            <p className="text-[10px] text-zinc-400">A/C: {form.accountNumber.slice(-4).padStart(10, '*')}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="card p-4 bg-zinc-950 border-zinc-800 space-y-2">
                                                <p className="text-[9px] font-bold text-primary uppercase flex items-center gap-1.5"><GraduationCap size={10} /> Academic History</p>
                                                <p className="text-xs font-bold text-white">{form.education.length} Records Compiled</p>
                                            </div>
                                            <div className="card p-4 bg-zinc-950 border-zinc-800 space-y-2">
                                                <p className="text-[9px] font-bold text-primary uppercase flex items-center gap-1.5"><Briefcase size={10} /> Employment Nodes</p>
                                                <p className="text-xs font-bold text-white">{form.experience.length} Institutional Deployments</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="confirm" className="rounded-md bg-zinc-900 border-zinc-800 text-primary focus:ring-primary h-4 w-4" />
                                            <label htmlFor="confirm" className="text-[11px] text-zinc-400 leading-relaxed cursor-pointer">
                                                I confirm that all provided information is accurate and matches my legal documentation. I acknowledge that falsification of institutional nodes is subject to policy review.
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between pt-8 border-t border-zinc-900 mt-auto">
                        <button
                            onClick={prevStep}
                            disabled={step === 1}
                            className={cn(
                                "flex items-center gap-2 text-xs font-bold transition-all px-4 py-2.5 rounded-xl border border-zinc-800",
                                step === 1 ? "opacity-0 invisible" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                            )}
                        >
                            <ArrowLeft size={16} /> Previous Phase
                        </button>

                        <div className="flex gap-3">
                            {step < 6 ? (
                                <button
                                    onClick={nextStep}
                                    className="btn-primary group px-8 py-2.5 flex items-center gap-2 text-xs h-11"
                                >
                                    Proceed to Step {step + 1}
                                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleComplete}
                                    className="btn-primary px-12 py-2.5 flex items-center gap-2 text-xs h-11 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse hover:animate-none"
                                >
                                    <CheckCircle2 size={16} /> Sync Institutional Profile
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
