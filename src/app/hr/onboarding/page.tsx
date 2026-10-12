"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    Users, Plus, CheckCircle, Clock, AlertCircle, Search, ChevronRight, Check, X, Upload, ExternalLink,
    Mail, ShieldCheck, CreditCard, UserX, UserPlus, User as UserIcon, Lock, Eye, EyeOff, Building2, Building, Award, MapPin,
    ChevronDown, Loader2, LogIn, LogOut, FileText, ListChecks, History, Activity, Pencil, Save, BadgeCheck, XCircle, Fingerprint,
    GraduationCap, Landmark, MessageSquare, KeyRound, Send, Briefcase, CalendarDays, UserCheck, FileWarning, Hash,
} from "lucide-react";
import RemoveEmployeeDialog from "@/components/RemoveEmployeeDialog";
import ExportMenu from "@/components/ExportMenu";
import PostOnboardingDashboard from "@/components/onboarding/PostOnboardingDashboard";
import { fetchReport, tablePdf, tableExcel, employeePdf, employeeExcel, fileNames } from "@/lib/report-export";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { Employee, Role } from "@/context/AuthContext";

/** Onboarding status groups (same rules as the server's export, src/lib/employee-report.ts) */
type Group = "VERIFICATION" | "FORM" | "APPROVED" | "REMOVED";
const groupOf = (e: any): Group => e.isRemoved ? "REMOVED" : (e.onboardingStatus === "Approved" || (e.isOnboarded && !e.onboardingStatus)) ? "APPROVED" : e.onboardingStatus === "Verification Pending" ? "VERIFICATION" : "FORM";
const GROUP_BADGE: Record<Group, { label: string; cls: string }> = {
    VERIFICATION: { label: "Verification Pending", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
    FORM: { label: "Form Pending", cls: "bg-zinc-800 text-zinc-300 border-zinc-700" },
    APPROVED: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
    REMOVED: { label: "Removed", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
};
const TABS: { key: "ALL" | Group; label: string }[] = [
    { key: "ALL", label: "All" }, { key: "VERIFICATION", label: "Awaiting Verification" }, { key: "FORM", label: "Form Pending" },
    { key: "APPROVED", label: "Approved" }, { key: "REMOVED", label: "Removed" },
];
const ROLE_NAME: Record<string, string> = {
    FOUNDER: "Founder", HR: "HR", AD: "AD", TL: "Tech Lead", HOI: "HOI", OM: "Operation Manager", FACULTY: "Professor", PROFESSOR: "Professor",
    MARKETING_TEAM: "Marketing", TECH_TEAM: "Tech Team", CURRICULUM_HEAD: "Curriculum Head", CURRICULUM_LEAD: "Curriculum Lead", HR_EXECUTIVE: "HR Executive",
};
const AVATAR = ["bg-sky-500/80", "bg-violet-500/80", "bg-teal-500/80", "bg-pink-500/75", "bg-amber-500/80", "bg-emerald-500/80", "bg-orange-500/80", "bg-indigo-500/80", "bg-rose-500/75"];
const tone = (k: string) => AVATAR[[...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
const initials = (n: string) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const fmtDate = (v?: any, withTime = false) => {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return withTime ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
};
/** Date the record was created (from the MongoDB id) */
const createdOn = (e: any) => { const h = String(e?._id || "").slice(0, 8); return /^[0-9a-f]{8}$/i.test(h) ? new Date(parseInt(h, 16) * 1000).toISOString() : ""; };

const CHECKLIST: { key: string; label: string; hint: string; icon: any; tone: string; mandatory?: boolean }[] = [
    { key: "aadharCheck", label: "Aadhar Verification", hint: "Verify government ID and details.", icon: Fingerprint, tone: "text-sky-300 bg-sky-500/10 border-sky-500/30", mandatory: true },
    { key: "qualificationCheck", label: "Qualification Audit", hint: "Verify academic qualification documents.", icon: GraduationCap, tone: "text-violet-300 bg-violet-500/10 border-violet-500/30", mandatory: true },
    { key: "bankDetailsCheck", label: "Bank Details Review", hint: "Verify bank account information.", icon: Landmark, tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
    { key: "slackOnboarded", label: "Added to Slack Workspace", hint: "Confirm employee has been added to Slack.", icon: MessageSquare, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
    { key: "slackChannelsAdded", label: "Slack Channels & WA Groups", hint: "Added to team channels and WhatsApp groups.", icon: Users, tone: "text-teal-300 bg-teal-500/10 border-teal-500/30" },
    { key: "accessRoleSetup", label: "Access & Role Setup", hint: "System access and role configuration.", icon: KeyRound, tone: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30" },
    { key: "welcomeMailSent", label: "Welcome Mail Sent", hint: "Send onboarding confirmation email.", icon: Send, tone: "text-rose-300 bg-rose-500/10 border-rose-500/30" },
    { key: "hrMeetingCompleted", label: "1:1 / SOP Meeting with HR", hint: "Attach the meeting screenshot.", icon: UserCheck, tone: "text-pink-300 bg-pink-500/10 border-pink-500/30", mandatory: true },
    { key: "managerMeetingCompleted", label: "Meeting with Manager", hint: "Introduction with the reporting manager.", icon: Briefcase, tone: "text-orange-300 bg-orange-500/10 border-orange-500/30" },
    { key: "adMeetingCompleted", label: "Meeting with AD", hint: "Introduction with the Associate Director.", icon: Building2, tone: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" },
];
const DOCS: { key: string; label: string; type: string; check?: string }[] = [
    { key: "upload_your_resume", label: "Resume", type: "Professional" },
    { key: "aadhar_card", label: "Aadhar Card", type: "Identity", check: "aadharCheck" },
    { key: "pan_card", label: "PAN Card", type: "Identity", check: "aadharCheck" },
    { key: "passport_size_photo", label: "Passport Size Photo", type: "Identity" },
    { key: "ten_marksheet", label: "10th Marksheet", type: "Education", check: "qualificationCheck" },
    { key: "twelve_marksheet", label: "12th Marksheet", type: "Education", check: "qualificationCheck" },
    { key: "upload_your_bachelor_s_passing_certificate", label: "Bachelor's Passing Certificate", type: "Education", check: "qualificationCheck" },
    { key: "bachelor_marksheet_all", label: "Bachelor's Marksheets", type: "Education", check: "qualificationCheck" },
    { key: "upload_your_master_s_passing_certificate", label: "Master's Passing Certificate", type: "Education", check: "qualificationCheck" },
    { key: "master_marksheet_all", label: "Master's Marksheets", type: "Education", check: "qualificationCheck" },
    { key: "bank_passbook_cancelled_cheque", label: "Bank Passbook / Cancelled Cheque", type: "Banking", check: "bankDetailsCheck" },
    { key: "experience_letter", label: "Experience Letter", type: "Experience" },
];
/** Editable submitted-form fields (HR can correct them) */
const FORM_FIELDS: { key: string; label: string; type?: string }[] = [
    { key: "phone_no_", label: "Mobile" }, { key: "date_of_birth", label: "Date of Birth", type: "date" }, { key: "blood_group", label: "Blood Group" },
    { key: "father_name_or_mother_name", label: "Father / Mother Name" }, { key: "parents_phone_no_", label: "Parent's Phone" },
    { key: "permanent_address", label: "Permanent Address" }, { key: "which_college_are_you_from_", label: "College" },
    { key: "bachelor_s_qualification", label: "Qualification" }, { key: "master_s_qualification", label: "Master's" },
    { key: "current_designation_at_gog", label: "Designation at GOG" }, { key: "linkedin_id", label: "LinkedIn" }, { key: "t_shirt_size", label: "T-Shirt Size" },
];
const BANK_FIELDS: { key: string; label: string }[] = [
    { key: "account_holder_name", label: "Account Name" }, { key: "bank_account_number", label: "Account Number" },
    { key: "ifsc_code", label: "IFSC Code" }, { key: "bankName", label: "Bank Name" }, { key: "upi_id", label: "UPI ID" }, { key: "panNumber", label: "PAN Number" },
];

export default function OnboardingHRPage() {
    const { user, employees, addEmployee, updateOnboarding } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [view, setView] = useState<"hub" | "checklist">("hub"); // Onboarding Hub | Post-Onboarding Checklist
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [employeeToRemove, setEmployeeToRemove] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [tab, setTab] = useState<"ALL" | Group>("ALL");
    const [detailTab, setDetailTab] = useState<"details" | "checklist" | "documents" | "timeline" | "activity">("details");
    const [removed, setRemoved] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [newLocation, setNewLocation] = useState("");
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const [editing, setEditing] = useState<"form" | "bank" | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [remarks, setRemarks] = useState("");
    const [saving, setSaving] = useState<string | null>(null);
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
    // Employees removed from the portal (not part of the normal employee list)
    const loadRemoved = () => fetch("/api/hr/reports/onboarding?removed=1", { cache: "no-store" }).then(r => r.ok ? r.json() : { employees: [] })
        .then(d => setRemoved(Array.isArray(d.employees) ? d.employees : [])).catch(() => { });
    useEffect(() => { loadRemoved(); }, [employees.length]);
    useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4500); return () => clearTimeout(t); }, [notice]);

    // HOIs for "Appoint HOI" — the selected location's HOIs first
    const locMatch = (loc: any, value?: string) => !!value && !!loc && [loc.id, loc.name, loc.shortName].includes(value);
    const hoiOptions = employees.filter(e => e.role === "HOI").map(h => {
        const loc = locations.find(l => locMatch(l, (h as any).location));
        const sel = locations.find(l => l.name === newLocation);
        return { id: h.id, name: h.name, campus: loc?.name || (h as any).location || "", sameCampus: !!sel && !!loc && loc.id === sel.id };
    }).sort((a, b) => Number(b.sameCampus) - Number(a.sameCampus) || a.name.localeCompare(b.name));

    const campusName = (v?: string) => (v ? locations.find(l => locMatch(l, v))?.name || v : "");
    const nameOf = (id: string) => employees.find(e => e.id === id)?.name || id;

    // Everyone except the Founder goes through onboarding; removed employees come from the server separately
    const people: any[] = useMemo(() => [...employees.filter(e => e.role !== "FOUNDER" && !(e as any).isRemoved), ...removed], [employees, removed]);
    const counts = useMemo(() => {
        const c: Record<string, number> = { ALL: people.length, VERIFICATION: 0, FORM: 0, APPROVED: 0, REMOVED: 0 };
        people.forEach(p => { c[groupOf(p)]++; });
        return c;
    }, [people]);
    const q = searchTerm.trim().toLowerCase();
    const listed = people
        .filter(p => tab === "ALL" || groupOf(p) === tab)
        .filter(p => !q || `${p.name} ${p.id} ${p.email || ""} ${p.designation || ""}`.toLowerCase().includes(q))
        .sort((a, b) => {
            const order: Record<Group, number> = { VERIFICATION: 0, FORM: 1, APPROVED: 2, REMOVED: 3 };
            return order[groupOf(a)] - order[groupOf(b)] || String(a.name).localeCompare(String(b.name));
        });
    const selected: any = selectedId ? people.find(p => p.id === selectedId) || null : null;
    useEffect(() => { setRemarks(selected?.onboardingRemarks || ""); setEditing(null); }, [selectedId, selected?.onboardingRemarks]);

    const [emailValue, setEmailValue] = useState("");
    const sameEmailRecords = emailValue.trim() ? employees.filter(x => (x.email || "").toLowerCase() === emailValue.trim().toLowerCase()) : [];

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
            const created = await addEmployee({ ...newEmp, id });
            if (!created.success) throw new Error(created.msg || "Could not create the employee.");

            // Make sure the employee exists before saving the schedule
            const list = await fetch("/api/employees").then(r => r.ok ? r.json() : []).catch(() => []);
            if (!Array.isArray(list) || !list.some((x: any) => x.id === id)) throw new Error("Could not create the employee.");

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
            setEmailValue("");
            setNewLocation("");
            setShowPassword(false);
            setClockIn("09:30"); setClockOut("18:30"); setWorkDays([...WORK_DAYS]);
        } catch (err: any) {
            setCreateError(err?.message || "Could not create the employee.");
        } finally {
            setCreating(false);
        }
    };

    const save = async (key: string, emp: any, data: any, okText: string) => {
        setSaving(key);
        try { await updateOnboarding(emp.id, data); setNotice({ ok: true, text: okText }); return true; }
        catch (e: any) { setNotice({ ok: false, text: e?.message || "Could not save." }); return false; }
        finally { setSaving(null); }
    };
    const handleChecklistUpdate = async (emp: any, field: string, value: boolean | string) => {
        const updatedChecklist = {
            ...(emp.onboardingChecklist || {
                aadharCheck: false, qualificationCheck: false, bankDetailsCheck: false,
                slackOnboarded: false, slackChannelsAdded: false, waGroupsAdded: false,
                hrMeetingCompleted: false, managerMeetingCompleted: false, adMeetingCompleted: false
            }),
            [field]: value
        };
        await save(`ck-${field}`, emp, { onboardingChecklist: updatedChecklist }, "Checklist updated.");
    };
    const uploadMeetingShot = async (emp: any, file: File) => {
        setSaving("ck-hrMeetingScreenshot");
        try {
            const up = await uploadToCloudinary(file);
            await handleChecklistUpdate(emp, "hrMeetingScreenshot", up.secure_url);
        } catch (e: any) { setNotice({ ok: false, text: `Upload failed: ${e?.message || "try again"}` }); setSaving(null); }
    };

    const handleFinalApprove = async (emp: any) => {
        // Mandatory items before approval (same rule as before)
        const checklist = emp.onboardingChecklist;
        if (!checklist?.aadharCheck || !checklist?.qualificationCheck || !checklist?.hrMeetingCompleted) {
            setNotice({ ok: false, text: "Please complete mandatory checks (Aadhar, Qualification, HR Meeting) before approval." });
            return;
        }
        await save("approve", emp, {
            isOnboarded: true,
            onboardingStatus: "Approved",
            status: "Active",
            onboardingApprovedAt: new Date().toISOString()
        }, `${emp.name} approved.`);
    };

    const handleExportCSV = async () => {
        const response = await fetch('/api/hr/export-employees');
        if (!response.ok) throw new Error("Error exporting CSV data from server");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Full_Onboarding_Details.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    const listReport = (filtered: boolean) => fetchReport("/api/hr/reports/onboarding", { method: "POST", body: JSON.stringify(filtered ? { ids: listed.map(p => p.id) } : {}) });
    const employeeReport = async (id: string) => fetchReport(`/api/hr/reports/onboarding?employeeId=${encodeURIComponent(id)}`);

    if (user && !["HR", "FOUNDER"].includes(user.role)) {
        return <div className="p-10 text-center text-zinc-500 text-sm">The Onboarding Hub is available to HR and the Founder.</div>;
    }

    const tabLabel = TABS.find(t => t.key === tab)?.label || "All";
    const doneCount = (e: any) => CHECKLIST.filter(c => e?.onboardingChecklist?.[c.key]).length;
    const g: Group | null = selected ? groupOf(selected) : null;
    const card = "rounded-2xl border border-zinc-800 bg-zinc-900/60";

    return (
        <div className="px-4 sm:px-6 py-6 space-y-5 max-w-[1500px] mx-auto w-full [contain:inline-size]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Onboarding Hub</h1>
                    <p className="text-sm text-zinc-400 mt-0.5">Manage new joinees and verification pipeline</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <ExportMenu label="Export" testid="onb-export" items={[
                        { heading: `All records (${counts.ALL - counts.REMOVED})` },
                        { label: "Download as PDF", kind: "pdf", testid: "onb-all-pdf", run: async () => tablePdf(await listReport(false), fileNames.onboardingList("pdf")) },
                        { label: "Download as Excel (.xlsx)", kind: "xlsx", testid: "onb-all-xlsx", run: async () => tableExcel(await listReport(false), "Onboarding List", fileNames.onboardingList("xlsx")) },
                        "divider",
                        { heading: `Current list: ${tabLabel}${q ? " + search" : ""} (${listed.length})` },
                        { label: "Download as PDF", kind: "pdf", testid: "onb-flt-pdf", run: async () => tablePdf(await listReport(true), fileNames.onboardingList("pdf")) },
                        { label: "Download as Excel (.xlsx)", kind: "xlsx", testid: "onb-flt-xlsx", run: async () => tableExcel(await listReport(true), "Onboarding List", fileNames.onboardingList("xlsx")) },
                        "divider",
                        { label: "Export CSV", hint: "Full onboarding details (existing CSV)", kind: "csv", testid: "onb-csv", run: handleExportCSV },
                    ]} />
                    <button onClick={() => setShowCreateModal(true)} data-testid="open-create-employee"
                        className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 whitespace-nowrap">
                        <Plus size={16} /> Create New Employee
                    </button>
                </div>
            </div>

            <div className="flex gap-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit" data-testid="onb-view-tabs">
                <button onClick={() => setView("hub")} data-testid="onb-view-hub" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === "hub" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white"}`}>Onboarding Hub</button>
                <button onClick={() => setView("checklist")} data-testid="onb-view-checklist" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === "checklist" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white"}`}>Post-Onboarding Checklist</button>
            </div>

            {view === "checklist" ? <PostOnboardingDashboard /> : (<>
            {/* Stats (also filters) */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="onb-stats">
                {([
                    ["ALL", "Total Onboardings", counts.ALL, Users, "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", "border-emerald-500/30 bg-emerald-500/[0.04]"],
                    ["VERIFICATION", "Awaiting Verification", counts.VERIFICATION, Clock, "text-amber-300 bg-amber-500/10 border-amber-500/30", "border-amber-500/40 bg-amber-500/[0.06]"],
                    ["APPROVED", "Approved Joinees", counts.APPROVED, BadgeCheck, "text-sky-300 bg-sky-500/10 border-sky-500/30", "border-sky-500/30 bg-sky-500/[0.04]"],
                    ["REMOVED", "Rejected / Removed", counts.REMOVED, XCircle, "text-red-300 bg-red-500/10 border-red-500/30", "border-red-500/30 bg-red-500/[0.05]"],
                    ["FORM", "Form Pending", counts.FORM, FileText, "text-zinc-300 bg-zinc-800 border-zinc-700", "border-zinc-700 bg-zinc-800/30"],
                ] as [typeof tab, string, number, any, string, string][]).map(([k, label, n, Icon, iconTone, activeTone]) => (
                    <button key={k} onClick={() => setTab(k)} data-testid={`onb-stat-${k}`}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${tab === k ? activeTone : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"}`}>
                        <span className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center ${iconTone}`}><Icon size={18} /></span>
                        <span className="min-w-0"><span className="block text-2xl font-black text-white tabular-nums leading-none">{n}</span><span className="block text-[11px] text-zinc-400 mt-1 leading-tight">{label}</span></span>
                    </button>
                ))}
            </div>

            {notice && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold border ${notice.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`} data-testid="onb-notice">
                    {notice.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {notice.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,19.5rem)_minmax(0,1fr)] gap-5 items-start">
                {/* ── List ── */}
                <div className={`${card} overflow-hidden lg:sticky lg:top-4`}>
                    <div className="p-3 space-y-3 border-b border-zinc-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                            <input type="text" placeholder="Search by name, email or Employee ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} data-testid="onb-search"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40" />
                        </div>
                        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] -mx-1 px-1" data-testid="onb-tabs">
                            {TABS.map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)} data-testid={`onb-tab-${t.key}`}
                                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${tab === t.key ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "text-zinc-400 hover:text-white border border-transparent"}`}>
                                    {t.label} ({counts[t.key]})
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="max-h-[38rem] overflow-y-auto divide-y divide-zinc-800/60" data-testid="onb-list">
                        {listed.map(p => {
                            const pg = groupOf(p); const on = selectedId === p.id;
                            return (
                                <button key={`${p.id}-${pg}`} onClick={() => { setSelectedId(p.id); setDetailTab("details"); }} data-testid="onb-row"
                                    className={`w-full px-3 py-3 flex items-center gap-3 text-left transition-all border-l-2 ${on ? "bg-emerald-500/[0.07] border-emerald-500" : "border-transparent hover:bg-zinc-800/40"}`}>
                                    {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                        : <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-xs font-black text-white ${tone(p.id)}`}>{initials(p.name)}</span>}
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                                        <span className="block text-[11px] text-zinc-500 truncate">{p.id} <span className="text-zinc-700">|</span> {ROLE_NAME[p.role] || p.role}</span>
                                        <span className={`inline-block mt-1 px-1.5 py-px rounded-md border text-[9px] font-black uppercase tracking-wider ${GROUP_BADGE[pg].cls}`} data-testid="onb-row-status">{GROUP_BADGE[pg].label}</span>
                                    </span>
                                    <ChevronRight size={14} className="shrink-0 text-zinc-600" />
                                </button>
                            );
                        })}
                        {listed.length === 0 && <div className="p-10 text-center text-zinc-500 text-sm">No onboarding records{q ? ` for “${searchTerm}”` : " in this list"}.</div>}
                    </div>
                </div>

                {/* ── Details ── */}
                {selected ? (
                    <div className={`${card} overflow-hidden min-w-0 @container`} data-testid="onb-detail">
                        {/* Profile bar */}
                        <div className="p-4 sm:p-5 flex flex-col @[50rem]:flex-row @[50rem]:items-center gap-4 border-b border-zinc-800">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                {selected.photoUrl ? <img src={selected.photoUrl} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
                                    : <span className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center text-xl font-black text-white ${tone(selected.id)}`}>{initials(selected.name)}</span>}
                                <div className="min-w-0">
                                    <h2 className="text-xl sm:text-2xl font-black text-white truncate" data-testid="onb-name">{selected.name}</h2>
                                    <p className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2">
                                        <span className="font-mono">{selected.id}</span><span className="text-zinc-700">|</span><span>{ROLE_NAME[selected.role] || selected.role}</span>
                                        {selected.email && <><span className="text-zinc-700">|</span><span className="truncate">{selected.email}</span></>}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                        {selected.dept && <span className="flex items-center gap-1"><Building2 size={11} /> {selected.dept}</span>}
                                        {selected.designation && <span className="flex items-center gap-1"><Briefcase size={11} /> {selected.designation}</span>}
                                        {selected.location && <span className="flex items-center gap-1"><MapPin size={11} /> {campusName(selected.location) || selected.campus}</span>}
                                        {!selected.location && selected.campus && <span className="flex items-center gap-1"><MapPin size={11} /> {selected.campus}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {selected.email && <a href={`mailto:${selected.email}`} title="Email" className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 flex items-center justify-center"><Mail size={15} /></a>}
                                <ExportMenu label="Download" testid="onb-emp-export" items={[
                                    { heading: "Complete employee details" },
                                    { label: "Download Complete PDF", kind: "pdf", testid: "onb-emp-pdf", run: async () => { const d = await employeeReport(selected.id); await employeePdf(d.report, d, fileNames.onboarding(selected.id, "pdf")); } },
                                    { label: "Download Complete Excel", kind: "xlsx", testid: "onb-emp-xlsx", run: async () => { const d = await employeeReport(selected.id); await employeeExcel(d.report, d, fileNames.onboarding(selected.id, "xlsx")); } },
                                ]} />
                                {g !== "REMOVED" && (
                                    <button onClick={() => setEmployeeToRemove(selected)} data-testid="onb-remove"
                                        className="h-9 px-3.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"><UserX size={14} /> Remove from Portal</button>
                                )}
                                {g === "APPROVED" ? (
                                    <span className="h-9 px-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-1.5"><BadgeCheck size={14} /> Approved</span>
                                ) : g === "REMOVED" ? (
                                    <span className="h-9 px-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs font-bold flex items-center gap-1.5"><XCircle size={14} /> Removed</span>
                                ) : (
                                    <button onClick={() => handleFinalApprove(selected)} disabled={saving === "approve"} data-testid="onb-approve"
                                        className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 disabled:opacity-60 whitespace-nowrap">
                                        {saving === "approve" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve Joinee
                                    </button>
                                )}
                            </div>
                        </div>

                        {g === "REMOVED" ? (
                            <div className="p-6 space-y-3" data-testid="onb-removed-detail">
                                <p className="text-sm text-zinc-300">This employee was removed from the portal{selected.removedByName ? ` by ${selected.removedByName}` : ""}{selected.removedAt ? ` on ${fmtDate(selected.removedAt, true)}` : ""}.</p>
                                <p className="text-xs text-zinc-500">The onboarding record and exit checklist are kept for history. Use Download to get the complete onboarding report.</p>
                            </div>
                        ) : (
                            <>
                                {/* Detail tabs */}
                                <div className="px-3 sm:px-5 border-b border-zinc-800 flex gap-1 overflow-x-auto [scrollbar-width:none]" data-testid="onb-detail-tabs">
                                    {([["details", "Details", UserIcon], ["checklist", "Verification Checklist", ListChecks], ["documents", "Documents", FileText], ["timeline", "Timeline", History], ["activity", "Activity Log", Activity]] as [typeof detailTab, string, any][]).map(([k, label, Icon]) => (
                                        <button key={k} onClick={() => setDetailTab(k)} data-testid={`onb-dtab-${k}`}
                                            className={`shrink-0 flex items-center gap-1.5 px-3 py-3 text-xs font-bold border-b-2 -mb-px transition-all whitespace-nowrap ${detailTab === k ? "border-emerald-500 text-emerald-300" : "border-transparent text-zinc-400 hover:text-white"}`}>
                                            <Icon size={14} /> {label}{k === "checklist" ? ` (${doneCount(selected)}/${CHECKLIST.length})` : ""}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-4 sm:p-5">
                                    {detailTab === "details" && (
                                        <div className="grid grid-cols-1 @[36rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4">
                                            <div className="space-y-4 min-w-0">
                                                <EditableCard title="Submitted Form Details" icon={<FileText size={14} className="text-emerald-400" />} testid="onb-form-card"
                                                    editing={editing === "form"} saving={saving === "form"}
                                                    onEdit={() => { setDraft(Object.fromEntries(FORM_FIELDS.map(f => [f.key, String(selected[f.key] || "")]))); setEditing("form"); }}
                                                    onCancel={() => setEditing(null)}
                                                    onSave={async () => { if (await save("form", selected, draft, "Form details saved.")) setEditing(null); }}>
                                                    {editing === "form" ? FORM_FIELDS.map(f => <EditRow key={f.key} label={f.label} type={f.type} value={draft[f.key] || ""} onChange={v => setDraft(d => ({ ...d, [f.key]: v }))} />)
                                                        : <>
                                                            {FORM_FIELDS.map(f => <InfoRow key={f.key} label={f.label} value={selected[f.key]} />)}
                                                            <InfoRow label="Joining Date" value={selected.joiningDate ? fmtDate(selected.joiningDate) : ""} />
                                                            <InfoRow label="Reporting To" value={(Array.isArray(selected.reportsTo) ? selected.reportsTo : selected.reportsTo ? [selected.reportsTo] : []).map(nameOf).join(", ")} />
                                                        </>}
                                                </EditableCard>
                                                <EditableCard title="Banking Details" icon={<CreditCard size={14} className="text-emerald-400" />} testid="onb-bank-card"
                                                    editing={editing === "bank"} saving={saving === "bank"}
                                                    onEdit={() => { setDraft(Object.fromEntries(BANK_FIELDS.map(f => [f.key, String(selected[f.key] || "")]))); setEditing("bank"); }}
                                                    onCancel={() => setEditing(null)}
                                                    onSave={async () => { if (await save("bank", selected, draft, "Banking details saved.")) setEditing(null); }}>
                                                    {editing === "bank" ? BANK_FIELDS.map(f => <EditRow key={f.key} label={f.label} value={draft[f.key] || ""} onChange={v => setDraft(d => ({ ...d, [f.key]: v }))} />)
                                                        : BANK_FIELDS.map(f => <InfoRow key={f.key} label={f.label} value={selected[f.key]} />)}
                                                </EditableCard>
                                            </div>
                                            <div className="space-y-4 min-w-0">
                                                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                                                    <div className="flex items-start gap-2.5 mb-3">
                                                        <ShieldCheck size={16} className="text-emerald-400 mt-0.5" />
                                                        <div><p className="text-sm font-bold text-white">HR Verification Checklist</p><p className="text-[11px] text-zinc-500">Complete all checks before approving the joinee. <span className="text-red-400">*</span> mandatory</p></div>
                                                        <span className="ml-auto text-[11px] font-bold text-zinc-400 tabular-nums">{doneCount(selected)}/{CHECKLIST.length}</span>
                                                    </div>
                                                    <div className="space-y-2" data-testid="onb-checklist">
                                                        {CHECKLIST.map(c => <CheckRow key={c.key} c={c} emp={selected} busy={saving === `ck-${c.key}`} onToggle={v => handleChecklistUpdate(selected, c.key, v)} onOpen={() => setDetailTab("checklist")} />)}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-2">
                                                    <p className="text-sm font-bold text-white flex items-center gap-2"><FileText size={14} className="text-zinc-400" /> Additional Remarks <span className="text-[11px] font-normal text-zinc-500">(Optional)</span></p>
                                                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Enter any remarks or notes about the verification..." data-testid="onb-remarks"
                                                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none resize-none focus:border-emerald-500/40" />
                                                    {remarks !== (selected.onboardingRemarks || "") && (
                                                        <div className="flex justify-end">
                                                            <button onClick={() => save("remarks", selected, { onboardingRemarks: remarks }, "Remarks saved.")} disabled={saving === "remarks"} data-testid="onb-remarks-save"
                                                                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-60">
                                                                {saving === "remarks" ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Remarks
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {detailTab === "checklist" && (
                                        <div className="space-y-3" data-testid="onb-checklist-full">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(doneCount(selected) / CHECKLIST.length) * 100}%` }} /></div>
                                                <span className="text-xs font-bold text-zinc-300 tabular-nums">{doneCount(selected)} / {CHECKLIST.length} verified</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500">Items marked <span className="text-red-400 font-bold">*</span> are mandatory before the joinee can be approved.</p>
                                            {CHECKLIST.map(c => {
                                                const m = selected.onboardingChecklistMeta?.[c.key];
                                                return (
                                                    <div key={c.key} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-2">
                                                        <CheckRow c={c} emp={selected} busy={saving === `ck-${c.key}`} onToggle={v => handleChecklistUpdate(selected, c.key, v)} bare />
                                                        <p className="text-[10px] text-zinc-500 pl-9">{m?.at ? `${m.done ? "Verified" : "Marked pending"} by ${m.byName || "—"} · ${fmtDate(m.at, true)}` : "No changes recorded yet."}</p>
                                                        {c.key === "hrMeetingCompleted" && selected.onboardingChecklist?.hrMeetingCompleted && (
                                                            <div className="pl-9 flex flex-wrap items-center gap-2">
                                                                {selected.onboardingChecklist?.hrMeetingScreenshot && /^https?:/.test(selected.onboardingChecklist.hrMeetingScreenshot) && (
                                                                    <a href={selected.onboardingChecklist.hrMeetingScreenshot} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold"><Check size={12} /> Screenshot attached <ExternalLink size={11} /></a>
                                                                )}
                                                                <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-700 text-zinc-300 text-[11px] font-bold cursor-pointer hover:border-emerald-500/50">
                                                                    {saving === "ck-hrMeetingScreenshot" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {selected.onboardingChecklist?.hrMeetingScreenshot ? "Replace screenshot" : "Attach meeting screenshot"}
                                                                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadMeetingShot(selected, f); e.target.value = ""; }} />
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {detailTab === "documents" && (
                                        <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-2.5" data-testid="onb-documents">
                                            {DOCS.map(d => {
                                                const url = selected[d.key];
                                                const verified = d.check ? !!selected.onboardingChecklist?.[d.check] : null;
                                                return (
                                                    <div key={d.key} className={`flex items-center gap-3 p-3 rounded-xl border ${url ? "border-zinc-800 bg-zinc-950/40" : "border-zinc-800/60 bg-zinc-950/20 opacity-70"}`}>
                                                        <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border ${url ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>{url ? <FileText size={15} /> : <FileWarning size={15} />}</span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-white truncate">{d.label}</p>
                                                            <p className="text-[10px] text-zinc-500">{d.type} · {url ? "Uploaded" : "Not uploaded"}{url && verified !== null ? ` · ${verified ? "Verified" : "Verification pending"}` : ""}</p>
                                                        </div>
                                                        {url && <a href={url} target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-bold text-zinc-200"><Eye size={12} /> View</a>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {detailTab === "timeline" && (
                                        <ol className="relative pl-6 space-y-5 before:absolute before:left-[9px] before:top-1 before:bottom-1 before:w-px before:bg-zinc-800" data-testid="onb-timeline">
                                            {([
                                                ["Added to the portal", createdOn(selected), true, `Account created${selected.joiningDate ? ` · joining date ${fmtDate(selected.joiningDate)}` : ""}`],
                                                ["Onboarding form submitted", selected.onboardingSubmittedAt, !!selected.onboardingSubmittedAt || g === "VERIFICATION" || g === "APPROVED", g === "FORM" ? "Waiting for the employee to fill the onboarding form" : ""],
                                                ["HR verification", (selected.onboardingActivity || []).filter((a: any) => /verified|pending|attached/.test(a.action)).slice(-1)[0]?.at, doneCount(selected) > 0, `${doneCount(selected)} of ${CHECKLIST.length} checklist items verified`],
                                                ["Approved as joinee", selected.onboardingApprovedAt, g === "APPROVED", g === "APPROVED" ? (selected.onboardingApprovedByName ? `Approved by ${selected.onboardingApprovedByName}` : "Approved") : "Not approved yet"],
                                            ] as [string, any, boolean, string][]).map(([title, at, done, note], i) => (
                                                <li key={i} className="relative">
                                                    <span className={`absolute -left-6 top-0.5 w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center ${done ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "bg-zinc-900 border-zinc-700"}`}>{done && <Check size={11} strokeWidth={3} />}</span>
                                                    <p className={`text-sm font-bold ${done ? "text-white" : "text-zinc-500"}`}>{title}</p>
                                                    <p className="text-[11px] text-zinc-500">{at ? fmtDate(at, true) : done ? "" : "Pending"}{note ? `${at ? " · " : ""}${note}` : ""}</p>
                                                </li>
                                            ))}
                                        </ol>
                                    )}

                                    {detailTab === "activity" && (
                                        <div className="space-y-2" data-testid="onb-activity">
                                            {[...(selected.onboardingActivity || [])].reverse().map((a: any, i: number) => (
                                                <div key={i} className="flex gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/40">
                                                    <span className="w-8 h-8 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"><Activity size={13} /></span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-white">{a.action}</p>
                                                        <p className="text-[10px] text-zinc-500">{a.byName || "—"}{a.role ? ` (${ROLE_NAME[a.role] || a.role})` : ""} · {fmtDate(a.at, true)}</p>
                                                        {a.note && <p className="text-[11px] text-zinc-400 mt-1 [overflow-wrap:anywhere]">{a.note}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                            {!(selected.onboardingActivity || []).length && <p className="py-10 text-center text-xs text-zinc-500">No onboarding activity recorded yet. Changes made from now on appear here.</p>}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="h-full min-h-[24rem] flex flex-col items-center justify-center text-center p-12 bg-zinc-900/40 border border-zinc-800 border-dashed rounded-2xl">
                        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><Users className="text-zinc-500" size={30} /></div>
                        <h3 className="text-xl font-bold text-white">Select a Profile</h3>
                        <p className="text-zinc-500 mt-2 max-w-xs text-sm">Select an employee from the list to review their onboarding details, checklist and documents.</p>
                    </div>
                )}
            </div>

            </>)}

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
                                    <input name="email" type="email" required placeholder="example@geeksofgurukul.com" autoComplete="off" className={fieldInput} data-testid="emp-email"
                                        onChange={e => setEmailValue(e.target.value)} />
                                </FormField>
                                {sameEmailRecords.length > 0 && (
                                    <p className="sm:col-span-2 -mt-1 text-[10px] leading-snug text-sky-300 bg-sky-500/5 border border-sky-500/20 rounded-lg px-2.5 py-1.5" data-testid="email-linked-note">
                                        Already onboarded as {sameEmailRecords.map(e => `${e.role} (${e.id})`).join(", ")}. A different designation will be linked to the same login — the existing password stays.
                                    </p>
                                )}
                                <FormField label="Role" required icon={<Users size={17} className="text-sky-400" />} select>
                                    <select name="role" required defaultValue="PROFESSOR" data-testid="emp-role" className={`${fieldInput} appearance-none pr-10 cursor-pointer`}>
                                        <option value="PROFESSOR">Professor / Faculty</option>
                                        <option value="OM">OM</option>
                                        <option value="CURRICULUM_LEAD">Curriculum Lead (CL)</option>
                                        <option value="CURRICULUM_HEAD">Curriculum Head (CH)</option>
                                        <option value="MARKETING_TEAM">Marketing Team</option>
                                        <option value="TECH_TEAM">Tech Team</option>
                                        <option value="TL">Tech Lead (TL)</option>
                                        <option value="HOI">HOI</option>
                                        <option value="AD">AD</option>
                                        {/* HR Executive cannot create a full HR account (enforced on the server too) */}
                                        {!(user as any)?.hrExecutive && <option value="HR">HR</option>}
                                        <option value="HR_EXECUTIVE">HR Executive</option>
                                        {/* Only a Founder can onboard another Founder (enforced on the server too) */}
                                        {user?.role === "FOUNDER" && <option value="FOUNDER">Founder</option>}
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
            {/* Remove from Portal (exit checklist first) */}
            {employeeToRemove && (
                <RemoveEmployeeDialog
                    employee={employeeToRemove}
                    onClose={() => setEmployeeToRemove(null)}
                    onRemoved={() => { loadRemoved(); }}
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

function InfoRow({ label, value }: { label: string; value?: any }) {
    const v = value === undefined || value === null || String(value).trim() === "" ? "N/A" : String(value);
    return (
        <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
            <span className="text-[11px] text-zinc-500">{label}</span>
            <span className={`text-xs font-medium [overflow-wrap:anywhere] ${v === "N/A" ? "text-zinc-600" : "text-zinc-200"}`}>{v}</span>
        </div>
    );
}
function EditRow({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <label className="grid grid-cols-[8.5rem_1fr] items-center gap-3 py-1">
            <span className="text-[11px] text-zinc-500">{label}</span>
            <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-emerald-500/50 [color-scheme:dark]" />
        </label>
    );
}
function EditableCard({ title, icon, editing, saving, onEdit, onCancel, onSave, children, testid }: {
    title: string; icon: React.ReactNode; editing: boolean; saving: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; children: React.ReactNode; testid?: string;
}) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4" data-testid={testid}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-white flex items-center gap-2">{icon} {title}</p>
                {editing ? (
                    <div className="flex gap-1.5">
                        <button onClick={onCancel} disabled={saving} className="h-7 px-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-[11px] font-bold">Cancel</button>
                        <button onClick={onSave} disabled={saving} data-testid={testid ? `${testid}-save` : undefined} className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1">{saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save</button>
                    </div>
                ) : (
                    <button onClick={onEdit} data-testid={testid ? `${testid}-edit` : undefined} className="h-7 px-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-[11px] font-bold flex items-center gap-1"><Pencil size={11} /> Edit</button>
                )}
            </div>
            <div>{children}</div>
        </div>
    );
}
function CheckRow({ c, emp, busy, onToggle, onOpen, bare }: { c: { key: string; label: string; hint: string; icon: any; tone: string; mandatory?: boolean }; emp: any; busy: boolean; onToggle: (v: boolean) => void; onOpen?: () => void; bare?: boolean }) {
    const done = !!emp?.onboardingChecklist?.[c.key];
    const Icon = c.icon;
    return (
        <div className={`flex items-center gap-2.5 ${bare ? "" : `px-2.5 py-2 rounded-xl border ${done ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-zinc-800 bg-zinc-900/40"}`}`} data-testid={`ck-${c.key}`}>
            <button onClick={() => onToggle(!done)} disabled={busy} aria-label={`${c.label}: ${done ? "verified" : "pending"}`} data-testid={`ck-toggle-${c.key}`}
                className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${done ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "border-zinc-600 hover:border-emerald-500/60"}`}>
                {busy ? <Loader2 size={11} className="animate-spin text-zinc-300" /> : done && <Check size={12} strokeWidth={3.5} />}
            </button>
            <span className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center ${c.tone}`}><Icon size={14} /></span>
            <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-white leading-snug">{c.label}{c.mandatory && <span className="ml-0.5 text-red-400" title="Mandatory before approval">*</span>}</span>
                <span className="block text-[10px] text-zinc-500 leading-snug truncate">{c.hint}</span>
            </span>
            <span className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${done ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"}`}>{done ? "Verified" : "Pending"}</span>
            {onOpen && <button onClick={onOpen} className="shrink-0 -mr-1 text-zinc-600 hover:text-zinc-300" aria-label="Open checklist"><ChevronRight size={14} /></button>}
        </div>
    );
}