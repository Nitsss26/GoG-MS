"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
    Users, Plus, CheckCircle, Clock, AlertCircle, Search, 
    Filter, ChevronRight, Check, X, Upload, ExternalLink,
    Mail, Briefcase, Calendar, ShieldCheck, Info, CreditCard
} from "lucide-react";
import type { Employee, Role } from "@/context/AuthContext";

export default function OnboardingHRPage() {
    const { employees, addEmployee, updateOnboarding } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Filter onboarding employees (those not fully onboarded)
    const onboardingEmployees = employees.filter(emp => 
        !emp.isOnboarded || emp.onboardingStatus !== "Approved"
    ).filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newEmp = {
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            role: formData.get("role") as Role,
            password: formData.get("password") as string || "GoG@2026",
            dept: formData.get("dept") as string,
            designation: formData.get("designation") as string,
        };

        await addEmployee(newEmp);
        setShowCreateModal(false);
    };

    const handleChecklistUpdate = async (empId: string, field: string, value: boolean | string) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const updatedChecklist = {
            ...(emp.onboardingChecklist || {
                aadharCheck: false, qualificationCheck: false, bankDetailsCheck: false,
                slackOnboarded: false, slackChannelsAdded: false, waGroupsAdded: false,
                hrMeetingCompleted: false, managerMeetingCompleted: false, adMeetingCompleted: false
            }),
            [field]: value
        };

        await updateOnboarding(empId, { onboardingChecklist: updatedChecklist });
    };

    const handleFinalApprove = async (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        // Check if all mandatory items are done (simplified for now)
        const checklist = emp.onboardingChecklist;
        if (!checklist?.aadharCheck || !checklist?.qualificationCheck || !checklist?.hrMeetingCompleted) {
            alert("Please complete mandatory checks (Aadhar, Qualification, HR Meeting) before approval.");
            return;
        }

        await updateOnboarding(empId, { 
            isOnboarded: true, 
            onboardingStatus: "Approved",
            status: "Active",
            onboardingApprovedAt: new Date().toISOString()
        });
        setSelectedEmployee(null);
    };

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Onboarding Hub</h1>
                    <p className="text-zinc-500 mt-1">Manage new joinees and verification pipeline</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus size={18} /> Create New Employee
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List Section */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search names or IDs..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 bg-zinc-800/30 border-b border-zinc-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Awaiting Verification</span>
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">{onboardingEmployees.length}</span>
                        </div>
                        <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {onboardingEmployees.map(emp => (
                                <button 
                                    key={emp.id}
                                    onClick={() => setSelectedEmployee(emp)}
                                    className={`w-full p-4 flex items-center gap-4 hover:bg-zinc-800/30 transition-all text-left ${selectedEmployee?.id === emp.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                        <span className="text-sm font-bold text-zinc-300">{emp.name[0]?.toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-white truncate">{emp.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-zinc-500 font-medium">{emp.id}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                emp.onboardingStatus === "Verification Pending" ? "bg-amber-500/10 text-amber-500" : "bg-zinc-800 text-zinc-500"
                                            }`}>
                                                {emp.onboardingStatus || "Form Pending"}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-zinc-600" />
                                </button>
                            ))}
                            {onboardingEmployees.length === 0 && (
                                <div className="p-8 text-center text-zinc-500 italic text-sm">
                                    No pending onboarding cases
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details & Checklist Section */}
                <div className="lg:col-span-2">
                    {selectedEmployee ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Profile Bar */}
                            <div className="p-6 bg-zinc-800/30 border-b border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                        {selectedEmployee.photoUrl ? (
                                            <img src={selectedEmployee.photoUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                                        ) : (
                                            <span className="text-2xl font-bold text-primary">{selectedEmployee.name[0]}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{selectedEmployee.name}</h2>
                                        <p className="text-sm text-zinc-400">{selectedEmployee.designation} • {selectedEmployee.role}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={`mailto:${selectedEmployee.email}`} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 transition-all">
                                        <Mail size={18} />
                                    </a>
                                    <button onClick={() => handleFinalApprove(selectedEmployee.id)} 
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                                        <CheckCircle size={16} /> Approve Joinee
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                                {/* Submission Details */}
                                <div className="space-y-8">
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Info size={16} className="text-primary" />
                                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Submitted Form Details</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <InfoRow label="Mobile" value={selectedEmployee.phone_no_ || "N/A"} />
                                            <InfoRow label="Father Name" value={selectedEmployee.father_name_or_mother_name || "N/A"} />
                                            <InfoRow label="College" value={selectedEmployee.which_college_are_you_from_ || "N/A"} />
                                            <InfoRow label="Qualification" value={selectedEmployee.bachelor_s_qualification || "N/A"} />
                                            <div className="pt-2 flex flex-wrap gap-2">
                                                {selectedEmployee.upload_your_resume && <DocLink label="Resume" url={selectedEmployee.upload_your_resume} />}
                                                {selectedEmployee.aadhar_card && <DocLink label="Aadhar" url={selectedEmployee.aadhar_card} />}
                                                {selectedEmployee.pan_card && <DocLink label="PAN" url={selectedEmployee.pan_card} />}
                                                {selectedEmployee.ten_marksheet && <DocLink label="10th" url={selectedEmployee.ten_marksheet} />}
                                                {selectedEmployee.twelve_marksheet && <DocLink label="12th" url={selectedEmployee.twelve_marksheet} />}
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <CreditCard size={16} className="text-primary" />
                                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Banking Details</h3>
                                        </div>
                                        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                                            <InfoRow label="Acc Name" value={selectedEmployee.account_holder_name || "N/A"} />
                                            <InfoRow label="Acc No" value={selectedEmployee.bank_account_number || "N/A"} />
                                            <InfoRow label="IFSC" value={selectedEmployee.ifsc_code || "N/A"} />
                                            <InfoRow label="UPI" value={selectedEmployee.upi_id || "N/A"} />
                                        </div>
                                    </section>
                                </div>

                                {/* HR Checklist */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/50">
                                        <ShieldCheck size={18} className="text-primary" />
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">HR Verification Checklist</h3>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <CheckItem 
                                            label="Aadhar Verification" 
                                            checked={selectedEmployee.onboardingChecklist?.aadharCheck} 
                                            onChange={(v) => handleChecklistUpdate(selectedEmployee.id, "aadharCheck", v)} 
                                        />
                                        <CheckItem 
                                            label="Qualification Audit" 
                                            checked={selectedEmployee.onboardingChecklist?.qualificationCheck} 
                                            onChange={(v) => handleChecklistUpdate(selectedEmployee.id, "qualificationCheck", v)} 
                                        />
                                        <CheckItem 
                                            label="Bank Details Review" 
                                            checked={selectedEmployee.onboardingChecklist?.bankDetailsCheck} 
                                            onChange={(v) => handleChecklistUpdate(selectedEmployee.id, "bankDetailsCheck", v)} 
                                        />
                                        <div className="h-px bg-zinc-800 my-4" />
                                        <CheckItem 
                                            label="Added to Slack Workspace" 
                                            checked={selectedEmployee.onboardingChecklist?.slackOnboarded} 
                                            onChange={(v) => handleChecklistUpdate(selectedEmployee.id, "slackOnboarded", v)} 
                                        />
                                        <CheckItem 
                                            label="Slack Channels & WA Groups" 
                                            checked={selectedEmployee.onboardingChecklist?.slackChannelsAdded} 
                                            onChange={(v) => handleChecklistUpdate(selectedEmployee.id, "slackChannelsAdded", v)} 
                                        />
                                        <div className="h-px bg-zinc-800 my-4" />
                                        <div className="space-y-3">
                                            <CheckItem 
                                                label="1:1 / SOP Meeting with HR" 
                                                checked={selectedEmployee.onboardingChecklist?.hrMeetingCompleted} 
                                                onChange={(v) => handleChecklistUpdate(selectedEmployee.id, "hrMeetingCompleted", v)} 
                                            />
                                            {selectedEmployee.onboardingChecklist?.hrMeetingCompleted && (
                                                <div className="pl-8">
                                                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                                                        <input type="file" className="hidden" onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleChecklistUpdate(selectedEmployee.id, "hrMeetingScreenshot", `/uploads/${file.name}`);
                                                        }} />
                                                        {selectedEmployee.onboardingChecklist?.hrMeetingScreenshot ? (
                                                            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold">
                                                                <Check size={14} /> SCREENSHOT ATTACHED
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold">
                                                                <Upload size={14} /> ATTACH MEETING SS
                                                            </div>
                                                        )}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                <Users className="text-zinc-500" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Select a Profile</h3>
                            <p className="text-zinc-500 mt-2 max-w-xs">Select an employee from the sidebar to review their onboarding status and checklist</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Employee Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Create New Employee</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
                            <CreationInput label="Full Name" name="name" required />
                            <CreationInput label="Corporate Email" name="email" type="email" placeholder="example@geeksofgurukul.com" required />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Role</label>
                                    <select name="role" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50">
                                        <option value="PROFESSOR">Professor</option>
                                        <option value="OM">OM</option>
                                        <option value="HOI">HOI</option>
                                        <option value="AD">AD</option>
                                        <option value="HR">HR</option>
                                    </select>
                                </div>
                                <CreationInput label="Password" name="password" placeholder="GoG@2026" />
                            </div>
                            <CreationInput label="Department" name="dept" placeholder="IIT / NIT / Management" />
                            <CreationInput label="Designation" name="designation" placeholder="e.g. Senior Professor" />
                            
                            <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all mt-6">
                                Create Account & Trigger Onboarding
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function CreationInput({ label, ...props }: any) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
            <input 
                {...props}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">{label}</span>
            <span className="text-sm text-zinc-300 font-medium">{value}</span>
        </div>
    );
}

function DocLink({ label, url }: { label: string, url: string }) {
    return (
        <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold text-zinc-300 border border-zinc-700 transition-all">
            <ExternalLink size={12} className="text-primary" /> {label}
        </a>
    );
}

function CheckItem({ label, checked, onChange }: { label: string, checked?: boolean, onChange: (v: boolean) => void }) {
    return (
        <button 
            onClick={() => onChange(!checked)}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                checked ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-500" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
        >
            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                checked ? "bg-emerald-500 text-white" : "border-2 border-zinc-800 bg-zinc-950"
            }`}>
                {checked && <Check size={14} strokeWidth={4} />}
            </div>
        </button>
    );
}
