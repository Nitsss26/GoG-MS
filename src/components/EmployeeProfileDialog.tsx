"use client";

import { useState } from "react";
import {
    X, Mail, Phone, MapPin, Briefcase, Building2, Calendar, User as UserIcon, Users, ShieldCheck,
    Copy, Check, ExternalLink, FileText, Landmark, GraduationCap, Link2, Award, AlertTriangle,
} from "lucide-react";
import type { Employee } from "@/context/AuthContext";

/** Shows a value only partly: "XXXX XXXX 1234" */
const mask = (v?: string) => {
    const s = String(v || "").replace(/\s+/g, "");
    if (!s) return "";
    return s.length <= 4 ? s : `${"•".repeat(Math.min(8, s.length - 4))}${s.slice(-4)}`;
};
const fmtDate = (v?: string) => {
    if (!v) return "";
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function CopyBtn({ text }: { text: string }) {
    const [done, setDone] = useState(false);
    return (
        <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => { }); }}
            title="Copy" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">{done ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}</button>
    );
}

/** Email of one employee (mail icon in Workforce) */
export function EmployeeMailDialog({ emp, onClose }: { emp: Employee; onClose: () => void }) {
    const e: any = emp;
    const phone = e.phone || e.phone_no_;
    return (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl" onClick={ev => ev.stopPropagation()} data-testid="mail-dialog">
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center"><Mail size={18} className="text-indigo-300" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white truncate">{emp.name}</p>
                        <p className="text-[11px] text-zinc-500">{emp.designation || emp.role} · {emp.id}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Email</p>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                            <Mail size={14} className="text-indigo-300 shrink-0" />
                            <span className="flex-1 min-w-0 text-sm text-white [overflow-wrap:anywhere]" data-testid="mail-address">{emp.email || "—"}</span>
                            {emp.email && <CopyBtn text={emp.email} />}
                        </div>
                    </div>
                    {phone && (
                        <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Phone</p>
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <Phone size={14} className="text-emerald-300 shrink-0" />
                                <span className="flex-1 text-sm text-white">{phone}</span>
                                <CopyBtn text={phone} />
                            </div>
                        </div>
                    )}
                </div>
                {emp.email && (
                    <div className="px-5 pb-5">
                        <a href={`mailto:${emp.email}`} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black">
                            <ExternalLink size={14} /> Write Email
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Full profile of one employee (page icon in Workforce). Sensitive details only for HR / Founder, masked. */
export default function EmployeeProfileDialog({ emp, employees, locName, viewerRole, onClose }: {
    emp: Employee; employees: Employee[]; locName: (v?: string) => string; viewerRole: string; onClose: () => void;
}) {
    const e: any = emp;
    const isHR = ["HR", "FOUNDER"].includes(viewerRole);
    const managers = (Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : [])
        .map((id: string) => employees.find(x => x.id === id)).filter(Boolean) as Employee[];
    const reportees = employees.filter(x => {
        const r: any = (x as any).reportsTo;
        return Array.isArray(r) ? r.includes(emp.id) : r === emp.id;
    });
    const docs: [string, string | undefined][] = [
        ["Resume", e.resumeUrl || e.upload_your_resume], ["Bachelor's Certificate", e.bachelorCertUrl || e.upload_your_bachelor_s_passing_certificate],
        ["Master's Certificate", e.masterCertUrl || e.upload_your_master_s_passing_certificate], ["Bachelor's Marksheet", e.bachelorMarksheetUrl],
        ["Master's Marksheet", e.masterMarksheetUrl], ["10th Marksheet", e.marksheet10Url], ["12th Marksheet", e.marksheet12Url],
        ["Aadhaar Card", e.aadharCardUrl], ["PAN Card", e.panCardUrl], ["Passport Photo", e.passportPhotoUrl],
        ["Bank Passbook", e.bankPassbookUrl], ["Experience Letter", e.expLetterUrl],
    ];
    const docsPresent = docs.filter(([, u]) => !!u);

    const Item = ({ icon: Icon, label, value }: { icon: any; label: string; value?: any }) => (
        <div className="flex items-start gap-2.5 min-w-0">
            <Icon size={14} className="text-zinc-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
                <p className="text-xs text-zinc-200 [overflow-wrap:anywhere]">{value || value === 0 ? value : "—"}</p>
            </div>
        </div>
    );
    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section className="space-y-3">
            <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.15em]">{title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">{children}</div>
        </section>
    );

    const statusTone = emp.status === "Active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : emp.status === "Resigned" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20";

    return (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl my-auto" onClick={ev => ev.stopPropagation()} data-testid="profile-dialog">
                {/* Header */}
                <div className="relative px-5 sm:px-6 py-5 border-b border-zinc-800 bg-gradient-to-r from-indigo-950/40 to-transparent rounded-t-2xl">
                    <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"><X size={16} /></button>
                    <div className="flex items-center gap-4 pr-10">
                        {e.passportPhotoUrl || e.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.passportPhotoUrl || e.photoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-zinc-700" />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl font-black text-emerald-400">{emp.name?.[0] || "?"}</div>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-white truncate">{emp.name}</h2>
                            <p className="text-xs text-zinc-400">{emp.designation || "—"}{emp.dept ? ` · ${emp.dept}` : ""}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 font-mono">{emp.id}</span>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-300">{emp.role}</span>
                                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${statusTone}`}>{emp.status || "—"}</span>
                                {emp.onboardingStatus && <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-400">Onboarding: {emp.onboardingStatus}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 sm:p-6 space-y-6 max-h-[68vh] overflow-y-auto">
                    <Section title="Contact">
                        <Item icon={Mail} label="Email" value={emp.email} />
                        <Item icon={Phone} label="Phone" value={e.phone || e.phone_no_} />
                        <Item icon={MapPin} label="Address" value={e.address || e.permanent_address} />
                        <Item icon={Link2} label="LinkedIn" value={e.linkedinId || e.linkedin_id} />
                    </Section>

                    <Section title="Work">
                        <Item icon={Building2} label="Location / Campus" value={locName(emp.location)} />
                        <Item icon={Briefcase} label="Department" value={emp.dept} />
                        <Item icon={Award} label="Designation" value={emp.designation} />
                        <Item icon={Calendar} label="Joining Date" value={fmtDate(emp.joiningDate)} />
                        <Item icon={Users} label="Reports To" value={managers.length ? managers.map(m => `${m.name} (${m.role})`).join(", ") : ""} />
                        <Item icon={Users} label="Direct Reportees" value={reportees.length ? `${reportees.length} — ${reportees.slice(0, 4).map(r => r.name).join(", ")}${reportees.length > 4 ? "…" : ""}` : ""} />
                        <Item icon={ShieldCheck} label="Chances Remaining" value={emp.chancesRemaining} />
                        {e.fines?.total ? <Item icon={AlertTriangle} label="Fines" value={`₹${e.fines.total} (${e.fines.records?.length || 0} record${(e.fines.records?.length || 0) === 1 ? "" : "s"})`} /> : null}
                    </Section>

                    <Section title="Personal">
                        <Item icon={Calendar} label="Date of Birth" value={fmtDate(e.dateOfBirth)} />
                        <Item icon={UserIcon} label="Gender" value={e.gender} />
                        <Item icon={UserIcon} label="Blood Group" value={e.bloodGroup} />
                        <Item icon={UserIcon} label="Father / Mother" value={e.fatherMotherName || e.father_name_or_mother_name} />
                        <Item icon={Phone} label="Parents' Phone" value={e.parentsPhone || e.parents_phone_no_} />
                    </Section>

                    <Section title="Education">
                        <Item icon={GraduationCap} label="Bachelor's" value={e.bachelorQual || e["bachelor_s_qualification____ex___b_tech__cse____iit_guwahati_"]} />
                        <Item icon={GraduationCap} label="Master's" value={e.masterQual || e["master_s_qualification____ex___m_tech__cse____iit_guwahati_"]} />
                        <Item icon={Building2} label="College" value={e.collegeName} />
                    </Section>

                    {isHR && (
                        <Section title="Payroll & Identity (HR only)">
                            <Item icon={Landmark} label="Salary" value={emp.salary ? `₹${Number(emp.salary).toLocaleString("en-IN")}` : ""} />
                            <Item icon={Landmark} label="Bank" value={e.bankName || e.bankAccountName} />
                            <Item icon={Landmark} label="Account Number" value={mask(e.bankAccountNumber || e.accountNumber)} />
                            <Item icon={Landmark} label="IFSC" value={e.ifscCode} />
                            <Item icon={Landmark} label="UPI" value={e.upiId} />
                            <Item icon={FileText} label="PAN" value={mask(e.panNumber)} />
                            <Item icon={FileText} label="Aadhaar" value={mask(e.aadhaarNumber)} />
                        </Section>
                    )}

                    {isHR && (
                        <section className="space-y-3">
                            <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.15em]">Documents</h3>
                            {docsPresent.length ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {docsPresent.map(([label, url]) => (
                                        <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-indigo-500/40 text-xs text-zinc-200">
                                            <FileText size={13} className="text-indigo-300 shrink-0" /> <span className="flex-1 truncate">{label}</span> <ExternalLink size={12} className="text-zinc-500" />
                                        </a>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-zinc-500">No documents uploaded yet.</p>}
                        </section>
                    )}
                </div>

                <div className="px-5 sm:px-6 py-4 border-t border-zinc-800 flex flex-wrap justify-end gap-2">
                    {emp.email && <a href={`mailto:${emp.email}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-black text-zinc-200"><Mail size={14} /> Email</a>}
                    <button onClick={onClose} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black">Close</button>
                </div>
            </div>
        </div>
    );
}
