"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, Trash2, Save, Loader2, CheckCircle2, AlertTriangle, Building2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HR → Work Location → "Location Assignment".
 * Sets the employee's ORIGINAL LOCATION (base campus = Employee.location) through the existing
 * PUT /api/hr/assign (HR / Founder only, the location id is validated against the Locations database).
 * The daily Weekly Schedule / WFH is a different thing and is not touched here.
 *
 * mode="hoi" (HOI → Work Location → Location Assignment): the same screen for an HOI, limited to the people under
 * them in the reporting hierarchy. Reads and saves through /api/hoi/location-assignment, which checks that scope
 * on the server. HOI clock-in locations stay HR-only.
 */
type Emp = { id: string; name: string; designation?: string; role: string; location?: string; reportsTo?: string[] | string; attendanceLocations?: string[]; attendanceLocationLog?: { at?: string; byName?: string; from?: string[]; to?: string[] }[] };

export default function LocationAssignmentTab({ mode = "hr" }: { mode?: "hr" | "hoi" }) {
    const { employees, hrAssignEmployee } = useAuth();
    const isHoi = mode === "hoi";
    // HOI mode: own reportees + locations + HOI names, all from the server (scope checked there)
    const [hoiData, setHoiData] = useState<{ employees: Emp[]; hois: { id: string; name: string }[] } | null>(null);
    const [q, setQ] = useState("");
    const [desig, setDesig] = useState("All");
    const [locFilter, setLocFilter] = useState("All");
    const [choice, setChoice] = useState("");
    const [removing, setRemoving] = useState<Emp | null>(null);
    // HOI only: authorised clock-in / clock-out locations (separate from Original Location)
    const [attSel, setAttSel] = useState<string[]>([]);
    const [attQ, setAttQ] = useState("");
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 4000); };

    // Always read straight from the Locations database (same source as the HR Locations page) — never seed/dummy data
    const [locations, setLocations] = useState<any[]>([]);
    const [locState, setLocState] = useState<"loading" | "ok" | "error">("loading");
    useEffect(() => {
        let alive = true;
        if (isHoi) {
            fetch("/api/hoi/location-assignment", { cache: "no-store" })
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(d => {
                    if (!alive) return;
                    setHoiData({ employees: Array.isArray(d.employees) ? d.employees : [], hois: Array.isArray(d.hois) ? d.hois : [] });
                    setLocations(Array.isArray(d.locations) ? d.locations.filter((l: any) => l?.id && l.active !== false && !l.isDeleted) : []);
                    setLocState("ok");
                })
                .catch(() => { if (alive) setLocState("error"); });
            return () => { alive = false; };
        }
        fetch("/api/locations", { cache: "no-store" })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => { if (alive) { setLocations(Array.isArray(d) ? d.filter((l: any) => l?.id && l.active !== false && !l.isDeleted) : []); setLocState("ok"); } })
            .catch(() => { if (alive) setLocState("error"); });
        return () => { alive = false; };
    }, [isHoi]);
    // An employee's location may be stored as the location id, name or short name (older records)
    const locOf = (v?: string) => (v ? locations.find(l => [l.id, l.name, l.shortName].includes(v)) : undefined);
    const all: Emp[] = isHoi ? (hoiData?.employees || []) : ((employees || []) as any);
    const hoiList: { id: string; name: string }[] = isHoi ? (hoiData?.hois || []) : all.filter(x => x.role === "HOI");
    const hoiName = (e: Emp) => {
        const ids = Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : [];
        return hoiList.filter(x => ids.includes(x.id)).map(x => x.name).join(", ");
    };
    // Save the Original Location: HR → existing /api/hr/assign; HOI → /api/hoi/location-assignment (own reportees only)
    const assignLocation = async (employeeId: string, location: string): Promise<{ success: boolean; msg?: string }> => {
        if (!isHoi) return hrAssignEmployee(employeeId, { location });
        try {
            const res = await fetch("/api/hoi/location-assignment", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, location }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok || !d.success) return { success: false, msg: d.error || "Could not save the location." };
            setHoiData(cur => cur ? { ...cur, employees: cur.employees.map(e => e.id === employeeId ? { ...e, location: d.employee?.location ?? location } : e) } : cur);
            return { success: true };
        } catch { return { success: false, msg: "Could not save the location." }; }
    };
    const designations = useMemo(() => Array.from(new Set(all.map(e => e.designation || "").filter(Boolean))).sort(), [all]);
    const term = q.trim().toLowerCase();
    const rows = all
        .filter(e => !term || `${e.name} ${e.id}`.toLowerCase().includes(term))
        .filter(e => desig === "All" || (e.designation || "") === desig)
        .filter(e => {
            if (locFilter === "All") return true;
            const l = locOf(e.location);
            return locFilter === "NONE" ? !e.location : l?.id === locFilter;
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const assignedCount = all.filter(e => !!e.location).length;

    // Assign-HOI style: pick an employee on the left, edit on the right (the record is always read fresh from the list)
    const [selId, setSelId] = useState<string>("");
    const editing = all.find(e => e.id === selId) || null;
    const pick = (e: Emp) => { setSelId(e.id); setChoice(locOf(e.location)?.id || ""); setAttSel(e.attendanceLocations || []); setAttQ(""); };
    const selected = locations.find(l => l.id === choice);

    const save = async () => {
        if (!editing) return;
        if (!choice || !selected) { flash(false, "Select a location first."); return; }
        setBusy(true);
        const r = await assignLocation(editing.id, choice);
        setBusy(false);
        if (r.success) flash(true, `${editing.name}: Original Location set to ${selected.name}.`);
        else flash(false, r.msg || "Could not save the location.");
    };
    const saveAttendance = async () => {
        if (!editing) return;
        setBusy(true);
        const r = await hrAssignEmployee(editing.id, { attendanceLocations: attSel });
        setBusy(false);
        if (r.success) flash(true, `${editing.name}: ${attSel.length} clock-in / clock-out location(s) saved.`);
        else flash(false, r.msg || "Could not save the attendance locations.");
    };
    const remove = async () => {
        if (!removing) return;
        setBusy(true);
        const r = await assignLocation(removing.id, "");
        setBusy(false);
        if (r.success) { flash(true, `${removing.name}: Original Location removed.`); setRemoving(null); setChoice(""); }
        else flash(false, r.msg || "Could not remove the location.");
    };

    const sel = "bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none";
    const rowBox = "grid grid-cols-4 gap-2 items-center bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/50";
    const rowLabel = "text-[11px] font-bold text-zinc-300";

    return (
        <div className="space-y-4" data-testid="loc-assign">
            {toast && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`} data-testid="loc-toast">
                    {toast.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {toast.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Left: employee list (same look as Assign HOI) */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="p-3 border-b border-zinc-800/50 space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Employee</p>
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or ID..." data-testid="loc-search"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <select value={desig} onChange={e => setDesig(e.target.value)} className={sel} data-testid="loc-filter-desig">
                                <option value="All">Designation: All</option>
                                {designations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className={sel} data-testid="loc-filter-loc">
                                <option value="All">Location: All</option>
                                <option value="NONE">Not Assigned</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <p className="text-[9px] text-zinc-600">{assignedCount} of {all.length} {isHoi ? "people under you" : "employees"} have an Original Location.</p>
                    </div>
                    <div className="divide-y divide-zinc-800/50 max-h-[520px] overflow-y-auto custom-scrollbar">
                        {rows.map(e => {
                            const l = locOf(e.location);
                            return (
                                <button key={e.id} onClick={() => pick(e)} data-testid="loc-row" data-id={e.id}
                                    className={cn("w-full p-3 flex items-center gap-2 text-left transition-colors", selId === e.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-zinc-800/30")}>
                                    <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">{(e.name || "?")[0]}</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold text-white truncate">{e.name || "Unknown"}</p>
                                        <p className="text-[9px] text-zinc-500 truncate" data-testid="loc-current">{e.location ? `Location: ${l?.name || e.location}` : "Location: Not Assigned"}</p>
                                    </div>
                                    {e.role === "HOI" && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300 shrink-0">HOI</span>}
                                </button>
                            );
                        })}
                        {isHoi && !hoiData && locState === "loading" && <div className="p-6 flex justify-center"><Loader2 size={16} className="animate-spin text-zinc-500" /></div>}
                        {!rows.length && (!isHoi || hoiData || locState === "error") && <div className="p-6 text-center text-xs text-zinc-500 italic">{isHoi && !all.length ? (locState === "error" ? "Could not load your team. Please refresh." : "Nobody reports to you yet.") : "No employees match the filters."}</div>}
                    </div>
                </div>

                {/* Right: assign panel */}
                <div className="md:col-span-2 bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4" data-testid="loc-panel">
                    {!editing ? <div className="text-center text-xs text-zinc-500 italic py-12">Select an employee to assign an Original Location.</div> : (
                        <>
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Building2 size={15} className="text-primary" /> Assign Location</h3>
                                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", editing.location ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20")} data-testid="loc-status">{editing.location ? "Location Assigned" : "Not Assigned"}</span>
                            </div>
                            <div className="space-y-2">
                                <div className={rowBox}><span className={rowLabel}>Employee</span><span className="col-span-3 text-[11px] text-white">{editing.name} <span className="text-zinc-500">· {editing.id} · {editing.designation || editing.role}</span></span></div>
                                <div className={rowBox}><span className={rowLabel}>Assigned HOI</span><span className="col-span-3 text-[11px] text-white">{hoiName(editing) || "Not Assigned"}</span></div>
                                <div className={rowBox}><span className={rowLabel}>Current Location</span><span className="col-span-3 text-[11px] text-white" data-testid="loc-panel-current">{editing.location ? (locOf(editing.location)?.name || editing.location) : "Not Assigned"}</span></div>
                                <div className={rowBox}>
                                    <span className={rowLabel}>Original Location</span>
                                    <select value={choice} onChange={e => setChoice(e.target.value)} data-testid="loc-select"
                                        className="col-span-3 bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[10px] text-white">
                                        <option value="">Select Location…</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.shortName && l.shortName !== l.name ? ` (${l.shortName})` : ""}</option>)}
                                    </select>
                                </div>
                                {locState === "error" && <p className="text-[10px] text-red-300">Could not load locations. Please refresh.</p>}
                                {locState === "ok" && !locations.length && <p className="text-[10px] text-amber-300">No locations yet — add them on the Locations page first.</p>}
                                {selected && (
                                    <div className={rowBox} data-testid="loc-details">
                                        <span className={rowLabel}>Location Details</span>
                                        <span className="col-span-3 text-[10px] text-zinc-300">{[selected.address, selected.city, selected.state].filter(Boolean).join(", ") || "—"} <span className="text-zinc-500 font-mono flex items-center gap-1 mt-0.5"><Navigation size={10} /> {selected.lat ?? "—"}, {selected.lng ?? "—"}</span></span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[9px] text-zinc-600 italic">💡 The employee&apos;s base campus. The daily Weekly Schedule / WFH does not change it.</p>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={save} disabled={busy || !choice} data-testid="loc-save"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50">
                                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editing.location ? "Update Location" : "Save Location"}
                                </button>
                                {editing.location && (
                                    <button onClick={() => setRemoving(editing)} data-testid="loc-remove"
                                        className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1.5"><Trash2 size={13} /> Remove Location</button>
                                )}
                            </div>

                            {/* HOI / OM: allowed clock-in / clock-out locations */}
                            {!isHoi && (editing.role === "HOI" || editing.role === "OM") && (
                                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 space-y-2" data-testid="loc-att-section">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5"><Navigation size={12} /> Allowed Clock-In / Clock-Out Locations ({attSel.length} selected)</p>
                                        <button onClick={saveAttendance} disabled={busy} data-testid="loc-att-save"
                                            className="bg-sky-500 hover:bg-sky-400 text-zinc-950 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50">{busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save Locations</button>
                                    </div>
                                    <div className="relative">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input value={attQ} onChange={ev => setAttQ(ev.target.value)} placeholder="Search locations…" data-testid="loc-att-search"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white outline-none" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto custom-scrollbar" data-testid="loc-att-list">
                                        {locations.filter(l => !attQ.trim() || `${l.name} ${l.shortName || ""} ${l.city || ""}`.toLowerCase().includes(attQ.trim().toLowerCase())).map(l => (
                                            <label key={l.id} className="flex items-center gap-2 text-[10px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-2 py-1.5 cursor-pointer">
                                                <input type="checkbox" className="accent-sky-500" checked={attSel.includes(l.id)} data-testid="loc-att-option" data-id={l.id}
                                                    onChange={ev => setAttSel(cur => ev.target.checked ? [...cur, l.id] : cur.filter(x => x !== l.id))} />
                                                <span className="truncate flex-1">{l.name}</span><span className="text-[9px] text-zinc-500">{l.city || ""}</span>
                                            </label>
                                        ))}
                                        {!locations.length && <p className="px-2 py-3 text-[11px] text-zinc-500">No locations yet — add them on the Locations page first.</p>}
                                    </div>
                                    <p className="text-[9px] text-zinc-500 italic">The {editing.role === "OM" ? "OM" : "HOI"} can clock in and clock out inside the geofence of any selected location, and clock in again at another selected location during the same day (one attendance day). This does not change the Original Location, HOI mappings or which colleges the HOI manages.</p>
                                    {!!editing.attendanceLocationLog?.length && (
                                        <div className="pt-1 border-t border-sky-500/10 space-y-0.5" data-testid="loc-att-history">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Assignment history</p>
                                            {editing.attendanceLocationLog.slice(-5).reverse().map((h, i) => (
                                                <p key={i} className="text-[9px] text-zinc-400">
                                                    {h.at ? new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—"} · {h.byName || "HR"}: {(h.from || []).length} → {(h.to || []).map(id => locations.find(l => l.id === id)?.name || id).join(", ") || "none"}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Remove */}
            {removing && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setRemoving(null)}>
                    <div className="w-full max-w-sm bg-zinc-900 border border-red-500/30 rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()} data-testid="loc-remove-modal">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /> Remove Original Location</h3>
                        <p className="text-xs text-zinc-300">Are you sure you want to remove the Original Location assigned to this employee?</p>
                        <p className="text-[11px] text-zinc-500">{removing.name} ({removing.id}) · {locOf(removing.location)?.name || removing.location}. The location itself, the employee, the HOI and past records are not changed.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setRemoving(null)} disabled={busy} className="flex-1 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold">Cancel</button>
                            <button onClick={remove} disabled={busy} data-testid="loc-remove-yes" className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}