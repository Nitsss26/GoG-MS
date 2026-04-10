"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
    X, Upload, CheckCircle, AlertCircle, FileText, CreditCard, User, 
    Briefcase, Linkedin, Phone, MapPin, Building, Calendar, Info
} from "lucide-react";

export default function OnboardingModal() {
    const { user, updateOnboarding } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // If user is already onboarded or not logged in, or form is already submitted/pending verification, don't show
    if (!user || user.isOnboarded || user.onboardingStatus === "Verification Pending" || user.onboardingStatus === "Approved") return null;

    const [form, setForm] = useState({
        full_name: user.name || "",
        phone_no_: "",
        father_name_or_mother_name: "",
        parents_phone_no_: "",
        permanent_address: "",
        bachelor_s_qualification: "",
        master_s_qualification: "",
        you_are_from_: "Other College",
        current_designation_at_gog: "",
        upload_your_resume: "",
        upload_your_bachelor_s_passing_certificate: "",
        upload_your_master_s_passing_certificate: "",
        linkedin_id: "",
        bank_account_number: "",
        ifsc_code: "",
        account_holder_name: "",
        upi_id: "",
        ten_marksheet: "",
        twelve_marksheet: "",
        aadhar_card: "",
        pan_card: "",
        passport_size_photo: "",
        bank_passbook_cancelled_cheque: "",
        experience_letter: "",
        which_college_are_you_from_: "",
        date_of_birth: "",
        blood_group: "",
        t_shirt_size: "M",
        bachelor_marksheet_all: "",
        master_marksheet_all: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Implementation of file upload (using existing Cloudinary pattern if available)
        // For now, setting a placeholder URL to simulate upload
        setForm({ ...form, [fieldName]: `https://res.cloudinary.com/simulated-upload/${file.name}` });
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await updateOnboarding(user.id, {
                ...form,
                onboardingStatus: "Verification Pending",
                onboardingSubmittedAt: new Date().toISOString()
            });
            setSubmitted(true);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle size={40} className="text-emerald-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">Form Submitted!</h2>
                        <p className="text-zinc-400">Your onboarding details have been sent to HR for verification. Please wait for approval to access all portal features.</p>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-sm text-zinc-300">
                        Estimated verification time: <span className="text-white font-semibold">24-48 Hours</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#0f0f11] border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl my-8">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-[#0f0f11] rounded-t-2xl z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Briefcase className="text-primary" size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white leading-none">Welcome to Geeks of Gurukul</h1>
                            <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1.5">
                                Complete your onboarding to unlock your portal <Info size={12} />
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={`h-1 w-8 rounded-full transition-all ${step >= s ? "bg-primary" : "bg-zinc-800"}`} />
                        ))}
                    </div>
                </div>

                <div className="p-8">
                    {/* Step 1: Personal Details */}
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
                                <User className="text-primary" size={18} />
                                <h2 className="text-lg font-semibold text-white">Personal Details</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Full Name" name="full_name" value={form.full_name} onChange={handleChange} placeholder="As per documents" />
                                <InputField label="Personal Phone No" name="phone_no_" value={form.phone_no_} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                                <InputField label="Father/Mother Name" name="father_name_or_mother_name" value={form.father_name_or_mother_name} onChange={handleChange} />
                                <InputField label="Parents Phone No" name="parents_phone_no_" value={form.parents_phone_no_} onChange={handleChange} />
                                <div className="md:col-span-2">
                                    <InputField label="Permanent Address" name="permanent_address" value={form.permanent_address} onChange={handleChange} />
                                </div>
                                <InputField label="Date of Birth" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" />
                                <InputField label="Blood Group" name="blood_group" value={form.blood_group} onChange={handleChange} placeholder="O+, AB-, etc" />
                                <SelectField label="T-Shirt Size" name="t_shirt_size" value={form.t_shirt_size} onChange={handleChange} options={["S", "M", "L", "XL", "XXL"]} />
                                <UploadField label="Passport Size Photo" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "passport_size_photo")} value={form.passport_size_photo} />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Professional Details */}
                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
                                <FileText className="text-primary" size={18} />
                                <h2 className="text-lg font-semibold text-white">Professional & Education</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Bachelor's Qualification" name="bachelor_s_qualification" value={form.bachelor_s_qualification} onChange={handleChange} placeholder="e.g. B.Tech (CSE)" />
                                <InputField label="Master's Qualification" name="master_s_qualification" value={form.master_s_qualification} onChange={handleChange} placeholder="e.g. M.Tech (CSE) or NA" />
                                <SelectField label="University Tier" name="you_are_from_" value={form.you_are_from_} onChange={handleChange} options={["IIT", "NIT", "Other College"]} />
                                <InputField label="College Name" name="which_college_are_you_from_" value={form.which_college_are_you_from_} onChange={handleChange} />
                                <InputField label="Current Designation at GoG" name="current_designation_at_gog" value={form.current_designation_at_gog} onChange={handleChange} />
                                <InputField label="LinkedIn Profile URL" name="linkedin_id" value={form.linkedin_id} onChange={handleChange} />
                                
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                    <UploadField label="Resume / CV" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "upload_your_resume")} value={form.upload_your_resume} />
                                    <UploadField label="Bachelor's Marksheet (All-in-one)" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "bachelor_marksheet_all")} value={form.bachelor_marksheet_all} />
                                    <UploadField label="Bachelor's Passing Cert" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "upload_your_bachelor_s_passing_certificate")} value={form.upload_your_bachelor_s_passing_certificate} />
                                    <UploadField label="10th Marksheet" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "ten_marksheet")} value={form.ten_marksheet} />
                                    <UploadField label="12th Marksheet" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "twelve_marksheet")} value={form.twelve_marksheet} />
                                    <UploadField label="Experience Letter (If Any)" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "experience_letter")} value={form.experience_letter} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Banking & Identity */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
                                <CreditCard className="text-primary" size={18} />
                                <h2 className="text-lg font-semibold text-white">Banking & Identity</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Account Holder Name" name="account_holder_name" value={form.account_holder_name} onChange={handleChange} />
                                <InputField label="Bank Account Number" name="bank_account_number" value={form.bank_account_number} onChange={handleChange} />
                                <InputField label="IFSC Code" name="ifsc_code" value={form.ifsc_code} onChange={handleChange} />
                                <InputField label="UPI ID" name="upi_id" value={form.upi_id} onChange={handleChange} />
                                
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50 mt-4">
                                    <UploadField label="Aadhar Card" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "aadhar_card")} value={form.aadhar_card} />
                                    <UploadField label="PAN Card" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "pan_card")} value={form.pan_card} />
                                    <UploadField label="Bank Passbook / Cheque" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "bank_passbook_cancelled_cheque")} value={form.bank_passbook_cancelled_cheque} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Footer Controls */}
                <div className="p-6 border-t border-zinc-800 flex items-center justify-between">
                    <button 
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1}
                        className="px-6 py-2.5 text-sm font-semibold text-zinc-400 hover:text-white disabled:opacity-0 transition-all"
                    >
                        Back
                    </button>
                    
                    {step < 3 ? (
                        <button 
                            onClick={() => setStep(s => s + 1)}
                            className="bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all"
                        >
                            Continue
                        </button>
                    ) : (
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? "Submitting..." : "Submit Registration"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function InputField({ label, ...props }: any) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
            <input 
                {...props}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
        </div>
    );
}

function SelectField({ label, options, ...props }: any) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
            <select 
                {...props}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            >
                {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );
}

function UploadField({ label, value, onChange }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">{label}</label>
            <label className={`
                flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all
                ${value ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 hover:border-primary/50 hover:bg-primary/5"}
            `}>
                <input type="file" className="hidden" onChange={onChange} />
                {value ? (
                    <div className="flex flex-col items-center gap-2">
                        <CheckCircle size={20} className="text-emerald-500" />
                        <span className="text-[10px] text-emerald-500 font-semibold truncate max-w-[150px]">Uploaded Successfully</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Upload size={18} className="text-zinc-600" />
                        <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">Click to Upload</span>
                    </div>
                )}
            </label>
        </div>
    );
}
