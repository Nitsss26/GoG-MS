"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Save, Search, Briefcase, Building2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import LocationAssignmentTab from "@/components/hr/LocationAssignmentTab";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Roles that appear in an HOI's employee/faculty list
const HOI_ASSIGNABLE_ROLES = ["FACULTY", "PROFESSOR", "OM", "MARKETING_TEAM", "TECH_TEAM"];

// HR version of the manager "Work Location Assignment" screen (src/app/manager/work-location).
// Same UI and same save logic; the only difference is that HR can pick any employee.
// The second tab, "Assign HOI", lets HR put an employee under an HOI.
/** Designation shown under the name: designation → designation from the onboarding form → role (never "No Designation" when the role is known) */
const ROLE_TITLE: Record<string, string> = {
    FOUNDER: "Founder", HR: "HR", HR_EXECUTIVE: "HR Executive", AD: "AD", TL: "Tech Lead", HOI: "HOI", OM: "Operations Manager", FACULTY: "Professor", PROFESSOR: "Professor",
    MARKETING_TEAM: "Marketing Team", TECH_TEAM: "Tech Team", CURRICULUM_HEAD: "Curriculum Head", CURRICULUM_LEAD: "Curriculum Lead",
};
const designationOf = (e: any) => String(e?.designation || e?.current_designation_at_gog || "").trim() || ROLE_TITLE[e?.role] || e?.role || "No Designation";

export default function HRWorkLocationPage() {
    const { user, employees, workSchedules, assignWorkSchedule, approveWorkSchedule, colleges, getExpectedTiming, hrAssignEmployee } = useAuth();
    const [tab, setTab] = useState<"location" | "hoi" | "assignment">("location");
    const [selectedHoi, setSelectedHoi] = useState("");
    const [isSavingHoi, setIsSavingHoi] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    // HOI only: authorised clock-in locations (any of them is accepted at clock-in / clock-out)
    const [attSel, setAttSel] = useState<string[]>([]);
    const [isSavingAtt, setIsSavingAtt] = useState(false);
    const [schedule, setSchedule] = useState<Record<string, { location: string; clockInTime: string; clockOutTime: string }>>(
        DAYS.reduce((acc, d) => ({ ...acc, [d]: { location: (colleges && colleges[0]?.id) || "", clockInTime: "09:00", clockOutTime: "18:00" } }), {})
    );
    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) return null;
    // HR can assign to anyone
    const reportees = employees || [];
    const hois = reportees.filter(e => e.role === "HOI");
    const getAssignedHOI = (id: string) => {
        const emp = reportees.find(r => r.id === id);
        const ids = emp ? (Array.isArray(emp.reportsTo) ? emp.reportsTo : (emp.reportsTo ? [emp.reportsTo] : [])) : [];
        return hois.find(h => ids.includes(h.id));
    };
    const term = searchTerm.toLowerCase();
    const visibleEmployees = reportees.filter(r =>
        // An HOI can only be assigned to the roles an HOI manages
        (tab === "location" || HOI_ASSIGNABLE_ROLES.includes(r.role)) && (
            (r.name || "").toLowerCase().includes(term) ||
            (r.id || "").toLowerCase().includes(term) ||
            (r.designation || "").toLowerCase().includes(term)
        )
    );

    const handleSelect = (id: string) => {
        setSelectedEmp(id);
        setSelectedHoi(getAssignedHOI(id)?.id || "");
        setAttSel(((reportees.find(r => r.id === id) as any)?.attendanceLocations as string[]) || []);
        const existing = (workSchedules || []).find(s => s.employeeId === id);
        if (existing) {
            setSchedule(existing.dayWise as any);
        } else {
            // Pre-fill from predefined timing and location for each day
            const defaultSchedule = DAYS.reduce((acc, day) => {
                // Find a date for this day of the week to get the expected timing
                const today = new Date();
                const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
                const diff = dayIndex - today.getDay();
                const targetDay = new Date(today);
                targetDay.setDate(today.getDate() + (diff < 0 ? diff + 7 : diff));
                
                const expected = getExpectedTiming(id, targetDay);
                
                return {
                    ...acc,
                    [day]: {
                        location: expected.location === "Office" ? ((colleges && colleges[0]?.id) || "") : expected.location,
                        clockInTime: expected.in,
                        clockOutTime: expected.out
                    }
                };
            }, {});
            setSchedule(defaultSchedule as any);
        }
    };

    const handleSave = async () => {
        if (!selectedEmp) return;
        const emp = reportees.find(r => r.id === selectedEmp);
        await assignWorkSchedule({ employeeId: selectedEmp, employeeName: emp?.name, dayWise: schedule });
        // A schedule set by HR needs no separate HR approval
        await approveWorkSchedule(selectedEmp);
        alert("Schedule saved successfully to both backend and local state!");
    };

    const handleSaveHoi = async () => {
        if (!selectedEmp) return;
        setIsSavingHoi(true);
        const result = await hrAssignEmployee(selectedEmp, { hoiId: selectedHoi });
        setIsSavingHoi(false);
        alert(result.success ? "HOI assignment saved successfully!" : (result.msg || "Could not save HOI assignment."));
    };

    const handleSaveAtt = async () => {
        if (!selectedEmp) return;
        setIsSavingAtt(true);
        const result = await hrAssignEmployee(selectedEmp, { attendanceLocations: attSel } as any);
        setIsSavingAtt(false);
        alert(result.success ? "Clock-in locations saved successfully!" : (result.msg || "Could not save clock-in locations."));
    };

    const selectedEmployee = reportees.find(r => r.id === selectedEmp);
    const currentHoi = selectedEmp ? getAssignedHOI(selectedEmp) : undefined;
    const canAssignHoi = !!selectedEmployee && HOI_ASSIGNABLE_ROLES.includes(selectedEmployee.role);

    const existingSchedule = selectedEmp ? (workSchedules || []).find(s => s.employeeId === selectedEmp) : null;

    // Resolve location display name
    const getLocationLabel = (locId: string) => {
        if (locId === "WFH") return "🏠 WFH";
        const c = (colleges || []).find(x => x.id === locId);
        return c ? c.shortName : locId;
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header><h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><MapPin size={20} className="text-blue-400" /> Work Location Assignment</h1>
                <p className="text-xs text-zinc-400 mt-1">Assign daily work location and clock times for employees. Locations auto-map to college geo-coordinates for attendance tracking.</p></header>

            <div className="flex gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit">
                <button onClick={() => setTab("location")} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", tab === "location" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><MapPin size={12} /> Work Location</button>
                <button onClick={() => setTab("hoi")} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", tab === "hoi" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><Briefcase size={12} /> Assign HOI</button>
                <button onClick={() => setTab("assignment")} data-testid="tab-location-assignment" className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", tab === "assignment" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><Building2 size={12} /> Location Assignment</button>
            </div>

            {tab === "assignment" && <LocationAssignmentTab />}

            {tab !== "assignment" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-zinc-800/50"><p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Employee</p>
                        <div className="relative mt-2">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input type="text" placeholder="Search name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none" />
                        </div></div>
                    <div className="divide-y divide-zinc-800/50 max-h-[520px] overflow-y-auto custom-scrollbar">
                        {visibleEmployees.map(r => (
                            <button key={r.id} onClick={() => handleSelect(r.id)}
                                className={cn("w-full p-3 flex items-center gap-2 text-left transition-colors", selectedEmp === r.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-zinc-800/30")}>
                                <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">{(r.name || "?")[0]}</div>
                                <div className="min-w-0"><p className="text-[11px] font-bold text-white truncate">{r.name || "Unknown"}</p><p className="text-[9px] text-zinc-500 truncate">{tab === "hoi" ? `HOI: ${getAssignedHOI(r.id)?.name || "Not Assigned"}` : designationOf(r)}</p></div>
                            </button>
                        ))}
                        {visibleEmployees.length === 0 && <div className="p-6 text-center text-xs text-zinc-500 italic">No employees found.</div>}
                    </div>
                </div>

                {tab === "hoi" && (
                    <div className="md:col-span-2 bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                        {!canAssignHoi ? <div className="text-center text-xs text-zinc-500 italic py-12">Select an employee to assign an HOI.</div> : (
                            <>
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white">Assign HOI</h3>
                                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", currentHoi ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20")}>{currentHoi ? "HOI Assigned" : "No HOI"}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">Employee</span>
                                        <span className="col-span-3 text-[11px] text-white">{selectedEmployee?.name} <span className="text-zinc-500">· {selectedEmployee?.id} · {selectedEmployee?.designation || selectedEmployee?.role}</span></span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">Location</span>
                                        <span className="col-span-3 text-[11px] text-white">{selectedEmployee?.location ? getLocationLabel(selectedEmployee.location) : "Not Assigned"}</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">Current HOI</span>
                                        <span className="col-span-3 text-[11px] text-white">{currentHoi ? `${currentHoi.name} (${currentHoi.id})` : "Not Assigned"}</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">Assign HOI</span>
                                        <select value={selectedHoi} onChange={e => setSelectedHoi(e.target.value)} className="col-span-3 bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white">
                                            <option value="">No HOI</option>
                                            {hois.map(h => <option key={h.id} value={h.id}>{h.name} ({h.id}){h.location ? ` — ${getLocationLabel(h.location)}` : ""}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-[9px] text-zinc-600 italic">💡 The employee will appear in the selected HOI&apos;s employee list. Any previous HOI is replaced.</p>
                                <button onClick={handleSaveHoi} disabled={isSavingHoi} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"><Save size={14} /> {isSavingHoi ? "Saving..." : "Save HOI"}</button>
                            </>
                        )}
                    </div>
                )}

                {tab === "location" && <div className="md:col-span-2 bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                    {!selectedEmp ? <div className="text-center text-xs text-zinc-500 italic py-12">Select an employee to assign work schedule.</div> : (
                        <>
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white">Weekly Schedule</h3>
                                {existingSchedule && <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", existingSchedule.approvedByHR ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20")}>{existingSchedule.approvedByHR ? "Read by HR" : "Unread by HR"}</span>}
                            </div>
                            {existingSchedule && (existingSchedule.assignedByName || existingSchedule.hrReadByName) && (
                                <p className="text-[9px] text-zinc-500">
                                    {existingSchedule.assignedByName ? `Last changed by ${existingSchedule.assignedByName}${existingSchedule.changedAt ? ` on ${new Date(existingSchedule.changedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}` : ""}
                                    {existingSchedule.approvedByHR && existingSchedule.hrReadByName ? ` · Read by ${existingSchedule.hrReadByName} (HR)${existingSchedule.hrReadAt ? ` on ${new Date(existingSchedule.hrReadAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}` : ""}
                                </p>
                            )}
                            {(selectedEmployee?.role === "HOI" || selectedEmployee?.role === "OM") && (
                                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 space-y-2" data-testid="wl-hoi-att">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5"><Navigation size={12} /> {selectedEmployee?.role === "OM" ? "OM" : "HOI"} Clock-In Locations ({attSel.length} selected)</p>
                                        <button onClick={handleSaveAtt} disabled={isSavingAtt} data-testid="wl-hoi-att-save" className="bg-sky-500 hover:bg-sky-400 text-zinc-950 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"><Save size={11} /> {isSavingAtt ? "Saving..." : "Save Locations"}</button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                        {(colleges || []).map(c => (
                                            <label key={c.id} className="flex items-center gap-2 text-[10px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-2 py-1.5 cursor-pointer">
                                                <input type="checkbox" className="accent-sky-500" checked={attSel.includes(c.id)} data-testid="wl-hoi-att-option" data-id={c.id}
                                                    onChange={e => setAttSel(prev => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id))} />
                                                <span className="truncate">{c.shortName || c.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-zinc-500 italic">The {selectedEmployee?.role === "OM" ? "OM" : "HOI"} can clock in / clock out at any ticked college (geofence checked), and clock in again at another ticked college on the same day. Original Location is not changed. None ticked = existing behaviour.</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                {DAYS.map(day => (
                                    <div key={day} className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">{day}</span>
                                        <select value={schedule?.[day]?.location || ""} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], location: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white">
                                            {(colleges || []).map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                                            <option value="WFH">🏠 Work From Home</option>
                                        </select>
                                        <input type="time" value={schedule?.[day]?.clockInTime || "09:00"} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], clockInTime: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white" />
                                        <input type="time" value={schedule?.[day]?.clockOutTime || "18:00"} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], clockOutTime: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-zinc-600 italic">💡 Setting WFH bypasses location check & dress code requirement for that day.</p>
                            <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"><Save size={14} /> Save Schedule</button>
                        </>
                    )}
                </div>}
            </div>}
        </div>
    );
}