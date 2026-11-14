"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Save, Search, Briefcase, Building2, Navigation, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import LocationAssignmentTab from "@/components/hr/LocationAssignmentTab";
import AssignManagerTab from "@/components/hr/AssignManagerTab";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Roles that appear in an HOI's employee/faculty list
const HOI_ASSIGNABLE_ROLES = ["FACULTY", "PROFESSOR", "OM", "MARKETING_TEAM", "TECH_TEAM", "PLACEMENT_INTERN_HEAD"];

// HR version of the manager "Work Location Assignment" screen (src/app/manager/work-location).
// Same UI and same save logic; the only difference is that HR can pick any employee.
// The second tab, "Assign Manager" (former "Assign HOI"), assigns any employee's manager by name (AssignManagerTab);
// picking an HOI keeps using the existing HOI mapping, so HOI assignments work as before.
/** Designation shown under the name: designation → designation from the onboarding form → role (never "No Designation" when the role is known) */
const ROLE_TITLE: Record<string, string> = {
    FOUNDER: "Founder", HR: "HR", HR_EXECUTIVE: "HR Executive", AD: "AD", TL: "Tech Lead", HOI: "HOI", OM: "Operations Manager", FACULTY: "Professor", PROFESSOR: "Professor",
    MARKETING_TEAM: "Marketing Team", TECH_TEAM: "Tech Team", PLACEMENT_INTERN_HEAD: "Placement & Intern Head", TECH_INTERN: "Tech Intern", CURRICULUM_HEAD: "Curriculum Head", CURRICULUM_LEAD: "Curriculum Lead",
};
/**
 * HOI only — one weekday (repeats every week): several allowed clock-in colleges (from the HOI's assigned clock-in
 * locations) and / or Automatic Location Fetch (Field Visit / Meeting), or Work From Home. Any selected college = normal
 * clock-in that day; outside the colleges with Auto Fetch → clock-in at the GPS location with a reason. Saved with the schedule.
 */
const AUTO = "AUTO_FETCH";
function HoiDayPicker({ day, value, options, onChange }: { day: string; value: { location: string; locations?: string[]; autoLocationFetch?: boolean }; options: { id: string; name: string }[]; onChange: (v: { location: string; locations?: string[]; autoLocationFetch?: boolean }) => void }) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const btn = useRef<HTMLButtonElement>(null);
    // the list is placed on screen (fixed), so it never runs off the right edge on a phone
    const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({ top: 0, left: 0, width: 224, maxHeight: 320 });
    const place = () => {
        const raw = btn.current?.getBoundingClientRect(); if (!raw) return;
        // desktop pages are zoomed (1.1 from 1024px): fixed positions inside are in zoomed units
        const z = (btn.current as any)?.currentCSSZoom || 1;
        const r = { top: raw.top / z, bottom: raw.bottom / z, left: raw.left / z };
        const vw = window.innerWidth / z, vh = window.innerHeight / z;
        const width = Math.min(224, vw - 16);
        const left = Math.max(8, Math.min(r.left, vw - width - 8));
        const below = vh - r.bottom - 12, above = r.top - 12;
        // opens below the button, or above it when there is not enough room underneath
        setPos(below >= 220 || below >= above ? { top: r.bottom + 4, left, width, maxHeight: Math.max(160, below) } : { bottom: vh - r.top + 4, left, width, maxHeight: Math.max(160, above) });
    };
    useEffect(() => {
        if (!open) return;
        const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        // follows the button when the page scrolls or the window changes size
        const onMove = (e: Event) => { if (box.current && e.target instanceof Node && box.current.contains(e.target)) return; place(); };
        document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
        window.addEventListener("resize", onMove); window.addEventListener("scroll", onMove, true);
        return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
    }, [open]);
    const wfh = value.location === "WFH";
    const ids = wfh ? [] : (value.locations ?? (value.location && value.location !== "FIELD_VISIT" ? [value.location] : []));
    const auto = !wfh && !!value.autoLocationFetch;
    const set = (nextIds: string[], nextAuto: boolean) => {
        if (!nextIds.length && !nextAuto) return; // at least one choice stays selected
        onChange({ location: nextIds[0] || "FIELD_VISIT", locations: nextIds, autoLocationFetch: nextAuto });
    };
    const name = (id: string) => options.find(o => o.id === id)?.name || id;
    const label = wfh ? "🏠 Work From Home" : [...ids.map(name), ...(auto ? ["Auto Fetch"] : [])].join(", ") || "Choose";
    return (
        <div className="relative min-w-0" ref={box} data-testid={`wl-multi-${day}`}>
            <button type="button" ref={btn} onClick={() => { if (!open) place(); setOpen(o => !o); }} aria-expanded={open} title={label} data-testid="wl-multi-toggle"
                className="w-full flex items-center justify-between gap-1 bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white text-left min-w-0">
                <span className="truncate" data-testid="wl-multi-label">{label}</span><ChevronDown size={11} className="shrink-0 text-zinc-400" />
            </button>
            {open && (
                <div className="fixed z-[80] overflow-y-auto overscroll-contain rounded-lg border border-zinc-700 bg-zinc-950 p-1.5 shadow-xl space-y-0.5" style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }} data-testid="wl-multi-list">
                    <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Every {day} · select one or more</p>
                    {options.map(o => (
                        <label key={o.id} className="flex items-center gap-2 px-2 min-h-[36px] rounded-md hover:bg-white/5 text-[11px] text-zinc-200 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-sky-500" checked={ids.includes(o.id)} data-testid={`wl-multi-opt-${o.id}`}
                                onChange={() => set(ids.includes(o.id) ? ids.filter(x => x !== o.id) : [...ids, o.id], auto)} />
                            <span className="truncate">{o.name}</span>
                        </label>
                    ))}
                    <label className="flex items-start gap-2 px-2 py-2 rounded-md hover:bg-white/5 text-[11px] text-amber-200 cursor-pointer border-t border-zinc-800 mt-1">
                        <input type="checkbox" className="w-4 h-4 mt-0.5 accent-amber-500" checked={auto} data-testid={`wl-multi-opt-${AUTO}`} onChange={() => set(ids, !auto)} />
                        <span><b>Automatic Location Fetch</b><span className="block text-[9px] text-zinc-500">Field Visit / Meeting — outside the colleges, clock-in at the GPS location with a reason.</span></span>
                    </label>
                    <label className="flex items-center gap-2 px-2 min-h-[36px] rounded-md hover:bg-white/5 text-[11px] text-zinc-200 cursor-pointer border-t border-zinc-800">
                        <input type="checkbox" className="w-4 h-4" checked={wfh} data-testid="wl-multi-opt-WFH" onChange={() => (wfh ? onChange({ location: options[0]?.id || "", locations: options[0] ? [options[0].id] : [], autoLocationFetch: false }) : onChange({ location: "WFH" }))} />
                        <span>🏠 Work From Home</span>
                    </label>
                    {!wfh && ids.length + (auto ? 1 : 0) > 0 && (
                        <div className="flex flex-wrap gap-1 px-1.5 pt-1.5 border-t border-zinc-800" data-testid="wl-multi-chips">
                            {ids.map(id => <span key={id} className="inline-flex items-center gap-0.5 pl-1.5 pr-0.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-200 text-[9px] font-semibold">{name(id)}<button type="button" aria-label={`Remove ${name(id)}`} onClick={() => set(ids.filter(x => x !== id), auto)} className="p-0.5"><X size={9} /></button></span>)}
                            {auto && <span className="inline-flex items-center gap-0.5 pl-1.5 pr-0.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[9px] font-semibold">Auto Fetch<button type="button" aria-label="Remove Automatic Location Fetch" onClick={() => set(ids, false)} className="p-0.5"><X size={9} /></button></span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

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
    const [schedule, setSchedule] = useState<Record<string, { location: string; clockInTime: string; clockOutTime: string; locations?: string[]; autoLocationFetch?: boolean }>>(
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
        // HOI: a day with one college and no Auto Fetch is saved as the normal single location
        const dayWise = emp?.role === "HOI" ? Object.fromEntries(Object.entries(schedule).map(([d, v]: any) => [d, v.locations && (v.locations.length > 1 || v.autoLocationFetch) ? v : { location: v.location, clockInTime: v.clockInTime, clockOutTime: v.clockOutTime }])) : schedule;
        await assignWorkSchedule({ employeeId: selectedEmp, employeeName: emp?.name, dayWise } as any);
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
    // HOI: each weekday's dropdown takes several of the HOI's saved clock-in locations (+ Automatic Location Fetch)
    const savedAtt: string[] = ((selectedEmployee as any)?.attendanceLocations as string[]) || [];
    const hoiOptions = savedAtt.map(id => { const c = (colleges || []).find(x => x.id === id); return { id, name: c?.shortName || c?.name || id }; });
    const hoiMulti = selectedEmployee?.role === "HOI" && hoiOptions.length > 0;

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
                <button onClick={() => setTab("hoi")} data-testid="tab-assign-manager" className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", tab === "hoi" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><Briefcase size={12} /> Assign Manager</button>
                <button onClick={() => setTab("assignment")} data-testid="tab-location-assignment" className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", tab === "assignment" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><Building2 size={12} /> Location Assignment</button>
            </div>

            {tab === "assignment" && <LocationAssignmentTab />}

            {tab === "hoi" && <AssignManagerTab />}

            {/* "Assign Manager" (former Assign HOI) is the AssignManagerTab above; this grid is the Work Location tab */}
            {tab === "location" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <div className="min-w-0"><p className="text-[11px] font-bold text-white truncate">{r.name || "Unknown"}</p><p className="text-[9px] text-zinc-500 truncate">{designationOf(r)}</p></div>
                            </button>
                        ))}
                        {visibleEmployees.length === 0 && <div className="p-6 text-center text-xs text-zinc-500 italic">No employees found.</div>}
                    </div>
                </div>

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
                                    <p className="text-[9px] text-zinc-500 italic">{selectedEmployee?.role === "OM" ? "The OM clocks in and clocks out once a day, like everyone else. The clock-in is expected at the college scheduled for that day (Work Location schedule); clocking in at another ticked college needs a location justification, and outside the ticked colleges the clock-in is blocked. Original Location is not changed. None ticked = existing behaviour." : "The HOI clocks in and clocks out once a day, like everyone else. The clock-in is expected at the college scheduled for that day (Work Location schedule); clocking in at another ticked college needs a location justification, and outside the ticked colleges the clock-in is blocked. Original Location is not changed. None ticked = existing behaviour."}</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                {DAYS.map(day => (
                                    <div key={day} className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">{day}</span>
                                        {hoiMulti ? (
                                            <HoiDayPicker day={day} value={schedule?.[day] || { location: "" }} options={hoiOptions}
                                                onChange={v => setSchedule({ ...schedule, [day]: { clockInTime: schedule[day]?.clockInTime || "09:00", clockOutTime: schedule[day]?.clockOutTime || "18:00", ...v } })} />
                                        ) : (
                                        <select value={schedule?.[day]?.location || ""} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], location: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white">
                                            {(colleges || []).map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                                            <option value="WFH">🏠 Work From Home</option>
                                        </select>
                                        )}
                                        <input type="time" value={schedule?.[day]?.clockInTime || "09:00"} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], clockInTime: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white" />
                                        <input type="time" value={schedule?.[day]?.clockOutTime || "18:00"} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], clockOutTime: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white" />
                                    </div>
                                ))}
                            </div>
                            {hoiMulti && <p className="text-[9px] text-sky-300/80" data-testid="wl-multi-note">HOI: each day can have several of the saved clock-in locations and / or Automatic Location Fetch — it applies every week on that day. Any selected college = normal clock-in.</p>}
                            {selectedEmployee?.role === "HOI" && !hoiMulti && <p className="text-[9px] text-amber-300/80">Save the HOI Clock-In Locations above to choose several locations per day.</p>}
                            <p className="text-[9px] text-zinc-600 italic">💡 Setting WFH bypasses location check & dress code requirement for that day.</p>
                            <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"><Save size={14} /> Save Schedule</button>
                        </>
                    )}
                </div>}
            </div>}
        </div>
    );
}