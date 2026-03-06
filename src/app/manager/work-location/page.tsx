"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Save, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkLocationPage() {
    const { user, getReportees, workSchedules, assignWorkSchedule, colleges } = useAuth();
    const [selectedEmp, setSelectedEmp] = useState("");
    const [schedule, setSchedule] = useState<Record<string, { location: string; clockInTime: string; clockOutTime: string }>>(
        DAYS.reduce((acc, d) => ({ ...acc, [d]: { location: colleges[0]?.id || "", clockInTime: "09:00", clockOutTime: "18:00" } }), {})
    );
    if (!user || !["FOUNDER", "AD", "HOI", "HR"].includes(user.role)) return null;
    const reportees = getReportees(user.id);

    const handleSelect = (id: string) => {
        setSelectedEmp(id);
        const existing = workSchedules.find(s => s.employeeId === id);
        if (existing) setSchedule(existing.dayWise as any);
        else setSchedule(DAYS.reduce((acc, d) => ({ ...acc, [d]: { location: colleges[0]?.id || "", clockInTime: "09:00", clockOutTime: "18:00" } }), {}));
    };

    const handleSave = () => {
        if (!selectedEmp) return;
        const emp = reportees.find(r => r.id === selectedEmp);
        assignWorkSchedule({ employeeId: selectedEmp, employeeName: emp?.name, dayWise: schedule });
    };

    const existingSchedule = selectedEmp ? workSchedules.find(s => s.employeeId === selectedEmp) : null;

    // Resolve location display name
    const getLocationLabel = (locId: string) => {
        if (locId === "WFH") return "🏠 WFH";
        const c = colleges.find(x => x.id === locId);
        return c ? c.shortName : locId;
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header><h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><MapPin size={20} className="text-blue-400" /> Work Location Assignment</h1>
                <p className="text-xs text-zinc-400 mt-1">Assign daily work location and clock times for employees. Locations auto-map to college geo-coordinates for attendance tracking.</p></header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-zinc-800/50"><p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Reportee</p></div>
                    <div className="divide-y divide-zinc-800/50">
                        {reportees.map(r => (
                            <button key={r.id} onClick={() => handleSelect(r.id)}
                                className={cn("w-full p-3 flex items-center gap-2 text-left transition-colors", selectedEmp === r.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-zinc-800/30")}>
                                <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">{r.name[0]}</div>
                                <div><p className="text-[11px] font-bold text-white">{r.name}</p><p className="text-[9px] text-zinc-500">{r.designation}</p></div>
                            </button>
                        ))}
                        {reportees.length === 0 && <div className="p-6 text-center text-xs text-zinc-500 italic">No reportees.</div>}
                    </div>
                </div>

                <div className="md:col-span-2 bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                    {!selectedEmp ? <div className="text-center text-xs text-zinc-500 italic py-12">Select a reportee to assign work schedule.</div> : (
                        <>
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white">Weekly Schedule</h3>
                                {existingSchedule && <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", existingSchedule.approvedByHR ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20")}>{existingSchedule.approvedByHR ? "HR Approved" : "Pending HR"}</span>}
                            </div>
                            <div className="space-y-2">
                                {DAYS.map(day => (
                                    <div key={day} className="grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50">
                                        <span className="text-[11px] font-bold text-zinc-300">{day}</span>
                                        <select value={schedule[day]?.location || ""} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], location: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white">
                                            {colleges.map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                                            <option value="WFH">🏠 Work From Home</option>
                                        </select>
                                        <input type="time" value={schedule[day]?.clockInTime} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], clockInTime: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white" />
                                        <input type="time" value={schedule[day]?.clockOutTime} onChange={e => setSchedule({ ...schedule, [day]: { ...schedule[day], clockOutTime: e.target.value } })} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-zinc-600 italic">💡 Setting WFH bypasses location check & dress code requirement for that day.</p>
                            <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"><Save size={14} /> Save Schedule</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
