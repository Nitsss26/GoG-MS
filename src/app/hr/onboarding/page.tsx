"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
    Users, Plus, CheckCircle, Clock, AlertCircle, Search, 
    Filter, ChevronRight, Check, X, Upload, ExternalLink,
    Mail, Briefcase, Calendar, ShieldCheck, Info, CreditCard,
    Download, UserX, UserPlus, User as UserIcon, Lock, Eye, EyeOff, Building2, Building, Award, MapPin, ChevronDown, Loader2, LogIn, LogOut
} from "lucide-react";
import RemoveEmployeeDialog from "@/components/RemoveEmployeeDialog";
import type { Employee, Role } from "@/context/AuthContext";

export default function OnboardingHRPage() {
    const { employees, addEmployee, updateOnboarding } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [employeeToRemove, setEmployeeToRemove] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [locations, setLocations] = useState<any[]>([]);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [newLocation, setNewLocation] = useState("");
    // Initial working hours (saved as the weekly work schedule)
    const [clockIn, setClockIn] = useState("09:30");
    const [clockOut, setClockOut] = useState("18:30");
    const [workDays, setWorkDays] = useState<string[]>([...WORK_DAYS]);

    useEffect(() => {
        fetch("/api/locations")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setLocations(data);
            })
            .catch(console.error);
    }, []);

    // HOIs for "Appoint HOI" — the selected location's HOIs first
    const locMatch = (loc: any, value?: string) => !!value && !!loc && [loc.id, loc.name, loc.shortName].includes(value);
    const hoiOptions = employees.filter(e => e.role === "HOI").map(h => {
        const loc = locations.find(l => locMatch(l, (h as any).location));
        const sel = locations.find(l => l.name === newLocation);
        return { id: h.id, name: h.name, campus: loc?.name || (h as any).location || "", sameCampus: !!sel && !!loc && loc.id === sel.id };
    }).sort((a, b) => Number(b.sameCampus) - Number(a.sameCampus) || a.name.localeCompare(b.name));

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
            location: formData.get("location") as string,
            reportsTo: (formData.getAll("reportsTo") as string[]).filter(Boolean),
        };

        setCreateError("");
        if (!newEmp.password || newEmp.password.length < 8) { setCreateError("Password must be at least 8 characters."); return; }
        if (!clockIn || !clockOut || clockOut <= clockIn) { setCreateError("Clock-out time must be after clock-in time."); return; }
        if (!workDays.length) { setCreateError("Select at least one working day."); return; }
        setCreating(true);
        try {
            // A fresh id, so the work schedule can be saved for the new employee right away
            let id = "";
            do { id = `EMP${Math.floor(100 + Math.random() * 900)}`; } while (employees.some(x => x.id === id));
            await addEmployee({ ...newEmp, id });

            // Make sure the employee exists before saving the schedule
            const list = await fetch("/api/employees").then(r => r.ok ? r.json() : []).catch(() => []);
            if (!Array.isArray(list) || !list.some((x: any) => x.id === id)) throw new Error("Could not create the employee. Check the email is not already used.");

            // Initial clock-in / clock-out time = the employee's weekly work schedule (same as Work Location screen)
            const scheduleLocation = newEmp.location || "";
            if (scheduleLocation) {
                const results = await Promise.all(workDays.map(day => fetch("/api/schedule/set", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employeeId: id, employeeName: newEmp.name, date: day, location: scheduleLocation, clockInTime: clockIn, clockOutTime: clockOut }),
                }).then(r => r.ok).catch(() => false)));
                if (results.some(ok => !ok)) { setCreateError("Employee created, but the timings could not be saved for every day — set them in Work Location."); return; }
            }
            setShowCreateModal(false);
            setNewLocation("");
            setShowPassword(false);
            setClockIn("09:30"); setClockOut("18:30"); setWorkDays([...WORK_DAYS]);
        } catch (err: any) {
            setCreateError(err?.message || "Could not create the employee.");
        } finally {
            setCreating(false);
        }
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

    const handleExportCSV = async () => {
        try {
            const response = await fetch('/api/hr/export-employees');
            if (!response.ok) throw new Error("Failed to export data");
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Full_Onboarding_Details.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            alert("Error exporting CSV data from server");
            console.error(error);
        }
    };

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Onboarding Hub</h1>
                    <p className="text-zinc-500 mt-1">Manage new joinees and verification pipeline</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all border border-zinc-700/50"
                    >
                        <Download size={18} /> Export CSV
                    </button>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} /> Create New Employee
                    </button>
                </div>
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
                                    <button onClick={() => setEmployeeToRemove(selectedEmployee)} title="Remove from Portal"
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap">
                                        <UserX size={16} /> Remove from Portal
                                    </button>
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
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => !creating && setShowCreateModal(false)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-[34rem] shadow-2xl my-auto" onClick={e => e.stopPropagation()} data-testid="create-employee-modal">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/25 to-violet-500/10 border border-indigo-500/30 flex items-center justify-center">
                                <UserPlus size={17} className="text-indigo-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-base font-black text-white tracking-tight leading-tight">Create New Employee</h2>
                                <p className="text-[11px] text-zinc-400">Add a new employee to the system with basic details and access credentials.</p>
                            </div>
                            <button type="button" onClick={() => setShowCreateModal(false)} disabled={creating} aria-label="Close"
                                className="shrink-0 p-1 rounded-md border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"><X size={14} /></button>
                        </div>

                        <form onSubmit={handleCreateEmployee}>
                            <div className="px-4 py-3.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                                <FormField label="Full Name" required icon={<UserIcon size={17} className="text-sky-400" />}>
                                    <input name="name" required placeholder="Enter full name" autoComplete="off" className={fieldInput} data-testid="emp-name" />
                                </FormField>
                                <FormField label="Corporate Email" required icon={<Mail size={17} className="text-indigo-300" />}>
                                    <input name="email" type="email" required placeholder="example@geeksofgurukul.com" autoComplete="off" className={fieldInput} data-testid="emp-email" />
                                </FormField>
                                <FormField label="Role" required icon={<Users size={17} className="text-sky-400" />} select>
                                    <select name="role" required defaultValue="PROFESSOR" className={`${fieldInput} appearance-none pr-10 cursor-pointer`}>
                                        <option value="PROFESSOR">Professor</option>
                                        <option value="OM">OM</option>
                                        <option value="MARKETING_TEAM">Marketing Team</option>
                                        <option value="TECH_TEAM">Tech Team</option>
                                        <option value="TL">Tech Lead (TL)</option>
                                        <option value="HOI">HOI</option>
                                        <option value="AD">AD</option>
                                        <option value="HR">HR</option>
                                        <option value="FACULTY">Faculty</option>
                                    </select>
                                </FormField>
                                <FormField label="Password" required icon={<Lock size={17} className="text-amber-400" />}>
                                    <input name="password" required minLength={8} title="At least 8 characters" type={showPassword ? "text" : "password"} placeholder="GoG@2026" autoComplete="new-password" className={`${fieldInput} pr-9`} data-testid="emp-password" />
                                    <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                </FormField>
                                <FormField label="Department" required icon={<Building2 size={17} className="text-violet-400" />}>
                                    <input name="dept" required placeholder="IIT / NIT / Management" className={fieldInput} />
                                </FormField>
                                <FormField label="Designation" required icon={<Award size={17} className="text-fuchsia-400" />}>
                                    <input name="designation" required placeholder="e.g. Senior Professor" className={fieldInput} />
                                </FormField>
                                <FormField label="Work Location" optional icon={<MapPin size={17} className="text-emerald-400" />} select>
                                    <select name="location" value={newLocation} onChange={e => setNewLocation(e.target.value)} className={`${fieldInput} appearance-none pr-10 cursor-pointer`}>
                                        <option value="">Select Location...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Appoint HOI" optional icon={<Building size={17} className="text-amber-400" />} select>
                                    <select name="reportsTo" defaultValue="" className={`${fieldInput} appearance-none pr-10 cursor-pointer`} data-testid="emp-hoi">
                                        <option value="">Select HOI...</option>
                                        {hoiOptions.map(h => (
                                            <option key={h.id} value={h.id}>{h.name} ({h.id}){h.campus ? ` · ${h.campus}` : ""}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Clock-In Time" required icon={<LogIn size={17} className="text-emerald-400" />}>
                                    <input type="time" required value={clockIn} onChange={e => setClockIn(e.target.value)} className={`${fieldInput} [color-scheme:dark]`} data-testid="emp-clock-in" />
                                </FormField>
                                <FormField label="Clock-Out Time" required icon={<LogOut size={17} className="text-rose-400" />}>
                                    <input type="time" required value={clockOut} onChange={e => setClockOut(e.target.value)} className={`${fieldInput} [color-scheme:dark]`} data-testid="emp-clock-out" />
                                </FormField>
                                <div className="sm:col-span-2 space-y-1">
                                    <label className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-[0.12em]">Working Days <span className="text-red-500">*</span></label>
                                    <div className="flex flex-wrap gap-1" data-testid="emp-days">
                                        {WORK_DAYS.concat("Sun").map(d => {
                                            const on = workDays.includes(d);
                                            return (
                                                <button type="button" key={d} onClick={() => setWorkDays(w => on ? w.filter(x => x !== d) : [...w, d])}
                                                    className={`flex-1 min-w-[2.75rem] py-1.5 rounded-md border text-[10px] font-black transition-all ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-zinc-950/80 border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>{d}</button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] text-zinc-500">
                                        {newLocation ? `Weekly schedule at ${newLocation}: ${clockIn} – ${clockOut}` : "Select a Work Location to save these timings."}
                                    </p>
                                </div>
                            </div>

                            {createError && (
                                <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"><AlertCircle size={14} /> {createError}</div>
                            )}

                            {/* Footer */}
                            <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} disabled={creating}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold transition-all disabled:opacity-50">
                                    <X size={14} /> Cancel
                                </button>
                                <button type="submit" disabled={creating} data-testid="emp-submit"
                                    className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.99] disabled:opacity-60">
                                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {creating ? "Creating…" : "Create Employee"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Remove from Portal (confirmation first) */}
            {employeeToRemove && (
                <RemoveEmployeeDialog
                    employee={employeeToRemove}
                    onClose={() => setEmployeeToRemove(null)}
                    onRemoved={(emp) => { if (selectedEmployee?.id === emp.id) setSelectedEmployee(null); }}
                />
            )}
        </div>
    );
}

const WORK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fieldInput = "w-full bg-zinc-950/80 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15 transition-all";

function FormField({ label, required, optional, icon, select, hint, children }: { label: string; required?: boolean; optional?: boolean; icon: React.ReactNode; select?: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1 min-w-0">
            <label className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-[0.12em]">
                {label}
                {required && <span className="text-red-500">*</span>}
                {optional && <span className="px-1.5 py-px rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold normal-case tracking-normal">Optional</span>}
            </label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none [&>svg]:w-[14px] [&>svg]:h-[14px]">{icon}</span>
                {children}
                {select && <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />}
            </div>
            {hint && <p className="text-[9px] text-zinc-500">{hint}</p>}
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