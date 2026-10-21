"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
    Upload, CheckCircle, AlertCircle, FileText, CreditCard, User, Briefcase, Phone, MapPin, Calendar, Info,
    Users, Droplet, Shirt, ImagePlus, ArrowLeft, ArrowRight, Check, GraduationCap, School, Link2,
    Landmark, Hash, Wallet, ClipboardCheck, ExternalLink, Send,
} from "lucide-react";

const emptyForm = (name = "") => ({
    full_name: name,
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

/* Layout of the onboarding form (plain CSS, so it renders the same on every Tailwind build) */
const LAYOUT_CSS = `
.onb-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 24px;padding:20px 24px}
.onb-title{flex:1 1 280px;min-width:0}
.onb-title h1,.onb-title p{white-space:normal}
.onb-stepper{display:grid;grid-template-columns:repeat(4,96px);flex:0 0 auto}
.onb-step{padding:0 2px}
.onb-step-line{position:absolute;top:13px;right:50%;width:100%;height:2px;background:#27272a}
.onb-step-line.is-done{background:rgba(16,185,129,.6)}
.onb-step-dot{position:relative;z-index:1;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid #3f3f46;background:#18181b;color:#71717a;transition:all .2s}
.onb-step-dot.is-done{background:#022c22;border-color:#10b981;color:#6ee7b7}
.onb-step-dot.is-active{background:#10b981;border-color:#6ee7b7;color:#09090b;box-shadow:0 0 12px -2px rgba(16,185,129,.8)}
.onb-step-label{margin-top:6px;font-size:9.5px;line-height:1.25;color:#71717a}
.onb-step-label.is-done{color:#d4d4d8}
.onb-step-label.is-active{color:#6ee7b7;font-weight:700}
.onb-p1grid{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
@media (min-width:768px){.onb-p1grid{grid-template-columns:minmax(0,1fr) 15rem}}
@media (max-width:640px){.onb-header{padding:16px}.onb-stepper{grid-template-columns:repeat(4,minmax(0,1fr));width:100%}}
`;

const STEPS = [
    { n: 1, label: "Personal Details" },
    { n: 2, label: "Education & Professional Details" },
    { n: 3, label: "Banking & Identity" },
    { n: 4, label: "Review & Submit" },
];
const LAST = STEPS.length;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DOCS: { key: string; label: string }[] = [
    { key: "passport_size_photo", label: "Passport Size Photo" }, { key: "upload_your_resume", label: "Resume / CV" },
    { key: "bachelor_marksheet_all", label: "Bachelor's Marksheet" }, { key: "upload_your_bachelor_s_passing_certificate", label: "Bachelor's Passing Cert" },
    { key: "ten_marksheet", label: "10th Marksheet" }, { key: "twelve_marksheet", label: "12th Marksheet" },
    { key: "experience_letter", label: "Experience Letter" }, { key: "aadhar_card", label: "Aadhar Card" },
    { key: "pan_card", label: "PAN Card" }, { key: "bank_passbook_cancelled_cheque", label: "Bank Passbook / Cheque" },
];

export default function OnboardingModal() {
    const { user, updateOnboarding } = useAuth();
    // All hooks run on every render, before any early return (Rules of Hooks)
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState(() => emptyForm(user?.name || ""));
    const [uploading, setUploading] = useState<string | null>(null);
    const [error, setError] = useState("");
    // Slack first: the form opens after the joinee clicks the Slack link HR provided
    const [slackJoined, setSlackJoined] = useState(false);
    const userId = user?.id || "";
    const slackLink = String((user as any)?.slackInviteLink || "").trim();
    const slackKey = `gog-slack-joined-${userId}`;

    // A different person logged in (or the user loaded after the first render): start a fresh form for them
    useEffect(() => {
        setForm(emptyForm(user?.name || ""));
        setStep(1);
        setSubmitted(false);
        setError("");
        let joined = false;
        try { joined = !!userId && window.sessionStorage.getItem(`gog-slack-joined-${userId}`) === "1"; } catch { /* storage unavailable */ }
        setSlackJoined(joined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);
    // The name can arrive after the id (async profile load) — fill it only while the field is still empty
    useEffect(() => {
        if (user?.name) setForm(f => (f.full_name ? f : { ...f, full_name: user.name }));
    }, [user?.name]);

    // If user is already onboarded or not logged in, or form is already submitted/pending verification, don't show
    // (the "submitted" confirmation is still shown once, right after this user submits)
    if (!user || (!submitted && (user.isOnboarded || user.onboardingStatus === "Verification Pending" || user.onboardingStatus === "Approved"))) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploading(fieldName);
        try {
            const up = await uploadToCloudinary(file);
            setForm(f => ({ ...f, [fieldName]: up.secure_url }));
        } catch (err: any) {
            setError(`Could not upload ${file.name}: ${err?.message || "upload failed"}. Please try again.`);
        } finally {
            setUploading(null);
            e.target.value = "";
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            await updateOnboarding(user.id, {
                ...form,
                onboardingStatus: "Verification Pending",
                onboardingSubmittedAt: new Date().toISOString()
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err?.message || "Could not submit the form. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const joinSlack = () => {
        try { window.sessionStorage.setItem(slackKey, "1"); } catch { /* storage unavailable */ }
        setSlackJoined(true);
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-start justify-center p-4 overflow-y-auto">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6 my-auto">
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
                    <button onClick={() => setSubmitted(false)} className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-bold transition-all">
                        Continue to Portal
                    </button>
                </div>
            </div>
        );
    }

    const header = (
        <div className="onb-header border-b border-zinc-800/80 bg-gradient-to-r from-emerald-950/40 to-transparent rounded-t-2xl" data-testid="onb-header">
            <div className="onb-title flex items-center gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_16px_-6px_rgba(16,185,129,0.6)]">
                    <Briefcase className="text-emerald-400" size={20} />
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-black text-white leading-tight">Welcome to Geeks of Gurukul</h1>
                    <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">Complete your onboarding to unlock your portal <Info size={12} className="shrink-0" /></p>
                </div>
            </div>
            {slackJoined || !slackLink ? (
                /* Stepper at the top right (moves under the title on narrow screens; never overlaps) */
                <div className="onb-stepper" data-testid="onb-stepper">
                    {STEPS.map((s, i) => {
                        const done = step > s.n, active = step === s.n;
                        return (
                            <div key={s.n} className="onb-step relative flex flex-col items-center text-center">
                                {i > 0 && <span className={`onb-step-line ${step >= s.n ? "is-done" : ""}`} />}
                                <span className={`onb-step-dot ${active ? "is-active" : done ? "is-done" : ""}`}>{done ? <Check size={13} strokeWidth={3} /> : s.n}</span>
                                <span className={`onb-step-label ${active ? "is-active" : done ? "is-done" : ""}`}>{s.label}</span>
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );

    // ── Step 0: join Slack first (only when HR provided a Slack link) ──
    if (slackLink && !slackJoined) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
                <style>{LAYOUT_CSS}</style>
                <div className="bg-zinc-950 border border-emerald-500/15 rounded-2xl w-full max-w-2xl shadow-2xl my-auto" data-testid="onb-slack-gate">
                    {header}
                    <div className="p-8 text-center space-y-5">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                            <Hash size={30} className="text-pink-400" />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Before you begin</p>
                            <h2 className="text-xl font-black text-white">First, join our Slack workspace</h2>
                            <p className="text-sm text-zinc-400">HR has shared the Geeks of Gurukul Slack invite with you. Join Slack first — your onboarding form opens right after.</p>
                        </div>
                        <a href={slackLink} target="_blank" rel="noopener noreferrer" data-testid="onb-slack-link"
                            className="block mx-auto max-w-md truncate text-xs text-sky-300 underline underline-offset-2 hover:text-sky-200 break-all">{slackLink}</a>
                        <a href={slackLink} target="_blank" rel="noopener noreferrer" onClick={joinSlack} data-testid="onb-slack-join"
                            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-8 py-3 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all">
                            <Hash size={16} /> Join Slack <ExternalLink size={14} />
                        </a>
                        <p className="text-[11px] text-zinc-500">The Slack invite opens in a new tab. Come back to this tab to fill in your onboarding form.</p>
                    </div>
                </div>
            </div>
        );
    }

    const section = (icon: React.ReactNode, title: string, subtitle: string) => (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-800/70">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">{icon}</div>
                <div>
                    <h2 className="text-lg font-black text-white leading-tight">{title}</h2>
                    <p className="text-xs text-zinc-400">{subtitle}</p>
                </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 whitespace-nowrap">Step {step} of {LAST}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-start justify-center p-2 sm:p-4 overflow-y-auto" data-testid="onb-overlay">
            <style>{LAYOUT_CSS}</style>
            <div className="bg-gradient-to-b from-[#0d1716] to-zinc-950 border border-emerald-500/20 rounded-2xl w-full max-w-5xl shadow-2xl shadow-emerald-950/40 my-auto shrink-0" data-testid="onb-modal">
                {header}

                {slackLink && (
                    <div className="mx-6 mt-5 rounded-xl border border-pink-500/20 bg-pink-500/[0.05] px-4 py-2.5 flex items-center gap-2 text-[11px] text-zinc-300">
                        <Hash size={13} className="text-pink-400 shrink-0" /> Slack workspace:
                        <a href={slackLink} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-2 truncate">{slackLink}</a>
                    </div>
                )}

                <div className="p-3 sm:p-6">
                    <div className="rounded-2xl border border-emerald-500/10 bg-zinc-950/50 p-4 sm:p-6">
                        {/* Step 1: Personal Details */}
                        {step === 1 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {section(<User size={20} />, "Personal Details", "Tell us about yourself")}
                                <div className="onb-p1grid">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                                        <InputField label="Full Name" icon={<User size={16} className="text-sky-400" />} name="full_name" value={form.full_name} onChange={handleChange} placeholder="As per documents" />
                                        <InputField label="Personal Phone No" icon={<Phone size={16} className="text-emerald-400" />} name="phone_no_" value={form.phone_no_} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                                        <InputField label="Father/Mother Name" icon={<Users size={16} className="text-violet-400" />} name="father_name_or_mother_name" value={form.father_name_or_mother_name} onChange={handleChange} placeholder="Enter father's or mother's name" />
                                        <InputField label="Parent's Phone No" icon={<Phone size={16} className="text-teal-400" />} name="parents_phone_no_" value={form.parents_phone_no_} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                                        <div className="md:col-span-2">
                                            <TextAreaField label="Permanent Address" icon={<MapPin size={16} className="text-rose-400" />} name="permanent_address" value={form.permanent_address} onChange={handleChange} placeholder="Enter your permanent address" />
                                        </div>
                                        <InputField label="Date of Birth" icon={<Calendar size={16} className="text-amber-400" />} name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" />
                                        <SelectField label="Blood Group" icon={<Droplet size={16} className="text-red-400" />} name="blood_group" value={form.blood_group} onChange={handleChange}
                                            options={[...(form.blood_group && !BLOOD_GROUPS.includes(form.blood_group) ? [form.blood_group] : []), ...BLOOD_GROUPS]} placeholder="Select blood group" />
                                        <SelectField label="T-Shirt Size" icon={<Shirt size={16} className="text-indigo-400" />} name="t_shirt_size" value={form.t_shirt_size} onChange={handleChange} options={["S", "M", "L", "XL", "XXL"]} />
                                    </div>
                                    <PhotoUpload value={form.passport_size_photo} busy={uploading === "passport_size_photo"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "passport_size_photo")} />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Education & Professional Details */}
                        {step === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                {section(<GraduationCap size={20} />, "Education & Professional Details", "Tell us about your education and professional background")}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                                    <InputField label="Bachelor's Degree" icon={<GraduationCap size={16} className="text-fuchsia-400" />} name="bachelor_s_qualification" value={form.bachelor_s_qualification} onChange={handleChange} placeholder="e.g. B.Tech (CSE)" />
                                    <InputField label="Master's Degree (If Applicable)" icon={<GraduationCap size={16} className="text-purple-400" />} name="master_s_qualification" value={form.master_s_qualification} onChange={handleChange} placeholder="e.g. M.Tech (CSE) or NA" />
                                    <SelectField label="University Tier" icon={<Landmark size={16} className="text-emerald-400" />} name="you_are_from_" value={form.you_are_from_} onChange={handleChange} options={["IIT", "NIT", "Other College"]} />
                                    <InputField label="College Name" icon={<School size={16} className="text-sky-400" />} name="which_college_are_you_from_" value={form.which_college_are_you_from_} onChange={handleChange} placeholder="Enter college name" />
                                    <InputField label="Current Designation at GoG" icon={<Briefcase size={16} className="text-teal-400" />} name="current_designation_at_gog" value={form.current_designation_at_gog} onChange={handleChange} placeholder="Enter your current designation" />
                                    <InputField label="LinkedIn Profile URL" icon={<Link2 size={16} className="text-blue-400" />} name="linkedin_id" value={form.linkedin_id} onChange={handleChange} placeholder="https://www.linkedin.com/in/your-profile" />
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                                    <UploadField label="Resume / CV" title="Upload Resume / CV" hint="PDF, DOC, DOCX" color="text-red-400" busy={uploading === "upload_your_resume"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "upload_your_resume")} value={form.upload_your_resume} />
                                    <UploadField label="Bachelor's Marksheet (All-in-one)" title="Upload Bachelor's Marksheet" hint="PDF, JPG, PNG" color="text-amber-400" busy={uploading === "bachelor_marksheet_all"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "bachelor_marksheet_all")} value={form.bachelor_marksheet_all} />
                                    <UploadField label="Bachelor's Passing Cert" title="Upload Bachelor's Passing Certificate" hint="PDF, JPG, PNG" color="text-sky-400" busy={uploading === "upload_your_bachelor_s_passing_certificate"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "upload_your_bachelor_s_passing_certificate")} value={form.upload_your_bachelor_s_passing_certificate} />
                                    <UploadField label="10th Marksheet" title="Upload 10th Marksheet" hint="PDF, JPG, PNG" color="text-pink-400" busy={uploading === "ten_marksheet"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "ten_marksheet")} value={form.ten_marksheet} />
                                    <UploadField label="12th Marksheet" title="Upload 12th Marksheet" hint="PDF, JPG, PNG" color="text-violet-400" busy={uploading === "twelve_marksheet"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "twelve_marksheet")} value={form.twelve_marksheet} />
                                    <UploadField label="Experience Letter (If Any)" title="Upload Experience Letter" hint="PDF, JPG, PNG" color="text-emerald-400" busy={uploading === "experience_letter"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "experience_letter")} value={form.experience_letter} />
                                </div>
                            </div>
                        )}

                        {/* Step 3: Banking & Identity */}
                        {step === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                {section(<CreditCard size={20} />, "Banking & Identity", "Your salary account and identity documents")}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                                    <InputField label="Account Holder Name" icon={<User size={16} className="text-sky-400" />} name="account_holder_name" value={form.account_holder_name} onChange={handleChange} placeholder="As per bank records" />
                                    <InputField label="Bank Account Number" icon={<Landmark size={16} className="text-emerald-400" />} name="bank_account_number" value={form.bank_account_number} onChange={handleChange} placeholder="Enter account number" />
                                    <InputField label="IFSC Code" icon={<Hash size={16} className="text-amber-400" />} name="ifsc_code" value={form.ifsc_code} onChange={handleChange} placeholder="e.g. SBIN0001234" />
                                    <InputField label="UPI ID" icon={<Wallet size={16} className="text-violet-400" />} name="upi_id" value={form.upi_id} onChange={handleChange} placeholder="name@bank" />
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                                    <UploadField label="Aadhar Card" title="Upload Aadhar Card" hint="PDF, JPG, PNG" color="text-orange-400" busy={uploading === "aadhar_card"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "aadhar_card")} value={form.aadhar_card} />
                                    <UploadField label="PAN Card" title="Upload PAN Card" hint="PDF, JPG, PNG" color="text-sky-400" busy={uploading === "pan_card"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "pan_card")} value={form.pan_card} />
                                    <UploadField label="Bank Passbook / Cheque" title="Upload Bank Passbook / Cancelled Cheque" hint="PDF, JPG, PNG" color="text-emerald-400" busy={uploading === "bank_passbook_cancelled_cheque"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpload(e, "bank_passbook_cancelled_cheque")} value={form.bank_passbook_cancelled_cheque} />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Review & Submit */}
                        {step === 4 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500" data-testid="onb-review">
                                {section(<ClipboardCheck size={20} />, "Review & Submit", "Check your details before submitting")}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <ReviewBox title="Personal" onEdit={() => setStep(1)} rows={[["Full Name", form.full_name], ["Phone", form.phone_no_], ["Father/Mother", form.father_name_or_mother_name], ["Parent's Phone", form.parents_phone_no_], ["Address", form.permanent_address], ["Date of Birth", form.date_of_birth], ["Blood Group", form.blood_group], ["T-Shirt Size", form.t_shirt_size]]} />
                                    <ReviewBox title="Education & Professional" onEdit={() => setStep(2)} rows={[["Bachelor's", form.bachelor_s_qualification], ["Master's", form.master_s_qualification], ["University Tier", form.you_are_from_], ["College", form.which_college_are_you_from_], ["Designation", form.current_designation_at_gog], ["LinkedIn", form.linkedin_id]]} />
                                    <ReviewBox title="Banking" onEdit={() => setStep(3)} rows={[["Account Holder", form.account_holder_name], ["Account No.", form.bank_account_number], ["IFSC", form.ifsc_code], ["UPI ID", form.upi_id]]} />
                                </div>
                                <p className="mt-6 mb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Documents</p>
                                <div className="flex flex-wrap gap-2">
                                    {DOCS.map(d => {
                                        const ok = !!(form as any)[d.key];
                                        return <span key={d.key} className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}>{ok ? <CheckCircle size={11} /> : <Upload size={11} />}{d.label}</span>;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {(error || uploading) && (
                    <p className={`px-8 pb-2 text-xs flex items-center gap-2 ${error ? "text-red-400" : "text-zinc-400"}`} data-testid="onboarding-status">
                        <AlertCircle size={13} /> {error || "Uploading document..."}
                    </p>
                )}
                {/* Footer Controls */}
                <div className="px-3 sm:px-6 pb-5 sm:pb-6 flex items-center justify-between gap-3">
                    <button
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1}
                        className="px-5 py-2.5 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-40 transition-all flex items-center gap-2"
                    >
                        <ArrowLeft size={15} /> Back
                    </button>

                    {step < LAST ? (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-8 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                        >
                            Continue <ArrowRight size={15} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !!uploading}
                            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-8 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Send size={15} /> {isSubmitting ? "Submitting..." : "Submit Registration"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const labelCls = "text-[10px] font-bold text-zinc-400 uppercase tracking-widest";
const fieldCls = "w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all [color-scheme:dark]";

function InputField({ label, icon, ...props }: any) {
    return (
        <div className="space-y-1.5">
            <label className={labelCls}>{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
                <input {...props} className={fieldCls} />
            </div>
        </div>
    );
}

function TextAreaField({ label, icon, ...props }: any) {
    return (
        <div className="space-y-1.5">
            <label className={labelCls}>{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-3 text-zinc-500">{icon}</span>
                <textarea rows={2} {...props} className={`${fieldCls} resize-y min-h-[4rem]`} />
            </div>
        </div>
    );
}

function SelectField({ label, icon, options, placeholder, ...props }: any) {
    return (
        <div className="space-y-1.5">
            <label className={labelCls}>{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">{icon}</span>
                <select {...props} className={`${fieldCls} cursor-pointer`}>
                    {placeholder && <option value="">{placeholder}</option>}
                    {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
        </div>
    );
}

function PhotoUpload({ value, busy, onChange }: any) {
    return (
        <div className="space-y-1.5">
            <label className={labelCls}>Passport Size Photo</label>
            <label className={`h-[calc(100%-1.4rem)] min-h-[15rem] flex flex-col items-center justify-center text-center gap-3 border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-all ${value ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-700 bg-zinc-900/40 hover:border-emerald-500/40"}`} data-testid="onb-photo">
                <input type="file" className="hidden" onChange={onChange} />
                {value ? (
                    <>
                        <img src={value} alt="Passport size photo" className="w-24 h-28 object-cover rounded-xl border border-emerald-500/40" />
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={13} /> Uploaded Successfully</span>
                        <span className="text-[10px] text-zinc-500">Click to change</span>
                    </>
                ) : (
                    <>
                        <span className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400"><ImagePlus size={24} /></span>
                        <span className="text-sm font-bold text-white">Upload Passport Size Photo</span>
                        <span className="text-[10px] text-zinc-500 leading-relaxed">JPG or PNG<br />Preferred size: 3.5 x 4.5 cm</span>
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200">{busy ? "Uploading…" : <><Upload size={13} /> Choose File</>}</span>
                    </>
                )}
            </label>
        </div>
    );
}

function UploadField({ label, title, hint, color = "text-zinc-400", value, onChange, busy }: any) {
    return (
        <div className="space-y-1.5 min-w-0">
            <label className={labelCls}>{label}</label>
            <label className={`flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 cursor-pointer transition-all ${value ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "border-zinc-700 bg-zinc-900/40 hover:border-emerald-500/40"}`}>
                <input type="file" className="hidden" onChange={onChange} />
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-900 border border-zinc-800 ${value ? "text-emerald-400" : color}`}>{value ? <CheckCircle size={18} /> : <FileText size={18} />}</span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-white leading-snug break-words">{value ? `${label} uploaded` : (title || label)}</span>
                    <span className={`block text-[10px] ${value ? "text-emerald-400" : "text-zinc-500"}`}>{busy ? "Uploading…" : value ? "Uploaded successfully" : (hint || "Click to upload")}</span>
                </span>
                <span className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-bold ${value ? "border-zinc-700 text-zinc-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                    <Upload size={13} /> {value ? "Change" : "Choose File"}
                </span>
            </label>
        </div>
    );
}

function ReviewBox({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">{title}</p>
                <button type="button" onClick={onEdit} className="text-[10px] font-bold text-zinc-400 hover:text-white">Edit</button>
            </div>
            <dl className="space-y-1.5">
                {rows.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 text-[11px]">
                        <dt className="text-zinc-500">{k}</dt><dd className="text-zinc-200 break-words">{v || "—"}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}