"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, MapPin, Pencil, Trash2, X, Save, Loader2, CheckCircle2, AlertTriangle, Building2, Navigation } from "lucide-react";

/**
 * HR → Work Location → "Location Assignment".
 * Sets the employee's ORIGINAL LOCATION (base campus = Employee.location) through the existing
 * PUT /api/hr/assign (HR / Founder only, the location id is validated against the Locations database).
 * The daily Weekly Schedule / WFH is a different thing and is not touched here.
 */
type Emp = { id: string; name: string; designation?: string; role: string; location?: string; reportsTo?: string[] | string; attendanceLocations?: string[] };

export default function LocationAssignmentTab() {
    const { employees, hrAssignEmployee } = useAuth();
    const [q, setQ] = useState("");
    const [desig, setDesig] = useState("All");
    const [locFilter, setLocFilter] = useState("All");
    const [editing, setEditing] = useState<Emp | null>(null);
    const [choice, setChoice] = useState("");
    const [removing, setRemoving] = useState<Emp | null>(null);
    // HOI only: authorised clock-in / clock-out locations (separate from Original Location)
    const [attEmp, setAttEmp] = useState<Emp | null>(null);
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
        fetch("/api/locations", { cache: "no-store" })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => { if (alive) { setLocations(Array.isArray(d) ? d.filter((l: any) => l?.id && l.active !== false && !l.isDeleted) : []); setLocState("ok"); } })
            .catch(() => { if (alive) setLocState("error"); });
        return () => { alive = false; };
    }, []);
    // An employee's location may be stored as the location id, name or short name (older records)
    const locOf = (v?: string) => (v ? locations.find(l => [l.id, l.name, l.shortName].includes(v)) : undefined);
    const all: Emp[] = (employees || []) as any;
    const hoiName = (e: Emp) => {
        const ids = Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : [];
        return all.filter(x => x.role === "HOI" && ids.includes(x.id)).map(x => x.name).join(", ");
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

    const openEdit = (e: Emp) => { setEditing(e); setChoice(locOf(e.location)?.id || ""); };
    const selected = locations.find(l => l.id === choice);

    const save = async () => {
        if (!editing) return;
        if (!choice || !selected) { flash(false, "Select a location first."); return; }
        setBusy(true);
        const r = await hrAssignEmployee(editing.id, { location: choice });
        setBusy(false);
        if (r.success) { flash(true, `${editing.name}: Original Location set to ${selected.name}.`); setEditing(null); }
        else flash(false, r.msg || "Could not save the location.");
    };
    const openAttendance = (e: Emp) => { setAttEmp(e); setAttSel(e.attendanceLocations || []); setAttQ(""); };
    const saveAttendance = async () => {
        if (!attEmp) return;
        setBusy(true);
        const r = await hrAssignEmployee(attEmp.id, { attendanceLocations: attSel });
        setBusy(false);
        if (r.success) { flash(true, `${attEmp.name}: ${attSel.length} clock-in / clock-out location(s) saved.`); setAttEmp(null); }
        else flash(false, r.msg || "Could not save the attendance locations.");
    };
    const remove = async () => {
        if (!removing) return;
        setBusy(true);
        const r = await hrAssignEmployee(removing.id, { location: "" });
        setBusy(false);
        if (r.success) { flash(true, `${removing.name}: Original Location removed.`); setRemoving(null); }
        else flash(false, r.msg || "Could not remove the location.");
    };

    const sel = "bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none";

    return (
        <div className="space-y-4" data-testid="loc-assign">
            {toast && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`} data-testid="loc-toast">
                    {toast.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {toast.text}
                </div>
            )}

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Building2 size={15} className="text-primary" /> Original Location (Base Campus)</h3>
                        <p className="text-[10px] text-zinc-500 mt-0.5">The employee&apos;s base campus. Daily Weekly Schedule / WFH does not change it. {assignedCount} of {all.length} employees assigned.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[12rem]">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee name or ID..." data-testid="loc-search"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white focus:outline-none" />
                    </div>
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

                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full min-w-[760px] text-xs">
                        <thead>
                            <tr className="text-[9px] text-zinc-500 uppercase tracking-widest text-left bg-zinc-950/60">
                                <th className="py-2.5 px-3">Employee Name</th><th className="py-2.5 px-3">Employee ID</th><th className="py-2.5 px-3">Designation</th>
                                <th className="py-2.5 px-3">Assigned HOI</th><th className="py-2.5 px-3">Original Location</th><th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {rows.map(e => {
                                const l = locOf(e.location);
                                const has = !!e.location;
                                return (
                                    <tr key={e.id} data-testid="loc-row">
                                        <td className="py-2.5 px-3 font-bold text-white">{e.name}</td>
                                        <td className="py-2.5 px-3 font-mono text-zinc-400">{e.id}</td>
                                        <td className="py-2.5 px-3 text-zinc-300">{e.designation || "—"}</td>
                                        <td className="py-2.5 px-3 text-zinc-300">{hoiName(e) || <span className="text-zinc-600">—</span>}</td>
                                        <td className="py-2.5 px-3" data-testid="loc-current">{has ? <span className="flex items-center gap-1.5 text-zinc-200"><MapPin size={11} className="text-primary shrink-0" /> {l?.name || e.location}</span> : <span className="text-zinc-500">Not Assigned</span>}</td>
                                        <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${has ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{has ? "Assigned" : "Not Assigned"}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                            <button onClick={() => openEdit(e)} data-testid="loc-edit"
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold"><Pencil size={11} /> {has ? "Edit Location" : "Assign Location"}</button>
                                            {e.role === "HOI" && (
                                                <button onClick={() => openAttendance(e)} data-testid="loc-att"
                                                    className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[10px] font-bold"><Navigation size={11} /> Clock-In Locations ({(e.attendanceLocations || []).length})</button>
                                            )}
                                            {has && (
                                                <button onClick={() => setRemoving(e)} data-testid="loc-remove"
                                                    className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold"><Trash2 size={11} /> Remove</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!rows.length && <tr><td colSpan={7} className="py-10 text-center text-zinc-500">No employees match the filters.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assign / edit */}
            {editing && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setEditing(null)}>
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} data-testid="loc-modal">
                        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><MapPin size={15} className="text-primary" /> {editing.location ? "Edit" : "Assign"} Original Location</h3>
                            <button onClick={() => setEditing(null)} disabled={busy} className="text-zinc-500 hover:text-white"><X size={17} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-xs">
                                <span className="text-zinc-500">Employee</span><span className="text-white font-bold">{editing.name}</span>
                                <span className="text-zinc-500">Employee ID</span><span className="text-zinc-300 font-mono">{editing.id}</span>
                                <span className="text-zinc-500">Designation</span><span className="text-zinc-300">{editing.designation || "—"}</span>
                                <span className="text-zinc-500">Assigned HOI</span><span className="text-zinc-300">{hoiName(editing) || "—"}</span>
                                <span className="text-zinc-500">Current</span><span className="text-zinc-300">{editing.location ? (locOf(editing.location)?.name || editing.location) : "Not Assigned"}</span>
                            </div>
                            <label className="block space-y-1">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Original Location <span className="text-red-400">*</span></span>
                                <select value={choice} onChange={e => setChoice(e.target.value)} data-testid="loc-select"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50">
                                    <option value="">Select Location…</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.shortName && l.shortName !== l.name ? ` (${l.shortName})` : ""}</option>)}
                                </select>
                                {locState === "error" && <span className="block text-[10px] text-red-300">Could not load locations. Please refresh.</span>}
                                {locState === "ok" && !locations.length && <span className="block text-[10px] text-amber-300">No locations yet — add them on the Locations page first.</span>}
                            </label>
                            {selected && (
                                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 grid grid-cols-[6rem_1fr] gap-y-1.5 text-[11px]" data-testid="loc-details">
                                    <span className="text-zinc-500">Location Name</span><span className="text-white font-bold">{selected.name}</span>
                                    <span className="text-zinc-500">Address</span><span className="text-zinc-300">{[selected.address, selected.city, selected.state].filter(Boolean).join(", ") || "—"}</span>
                                    <span className="text-zinc-500">Latitude</span><span className="text-zinc-300 font-mono flex items-center gap-1"><Navigation size={10} /> {selected.lat ?? "—"}</span>
                                    <span className="text-zinc-500">Longitude</span><span className="text-zinc-300 font-mono">{selected.lng ?? "—"}</span>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3.5 border-t border-zinc-800 flex justify-end gap-2">
                            <button onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-800">Cancel</button>
                            <button onClick={save} disabled={busy || !choice} data-testid="loc-save"
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Location
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HOI: allowed clock-in / clock-out locations */}
            {attEmp && (
                <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setAttEmp(null)}>
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl" onClick={ev => ev.stopPropagation()} data-testid="loc-att-modal">
                        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Navigation size={15} className="text-sky-300" /> Allowed Clock-In/Clock-Out Locations</h3>
                            <button onClick={() => setAttEmp(null)} disabled={busy} className="text-zinc-500 hover:text-white"><X size={17} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
                                <span className="text-zinc-500">Employee</span><span className="text-white font-bold">{attEmp.name} <span className="text-zinc-500 font-mono font-normal">({attEmp.id})</span></span>
                                <span className="text-zinc-500">Role</span><span className="text-zinc-300">HOI</span>
                                <span className="text-zinc-500">Original Location</span><span className="text-zinc-300">{attEmp.location ? (locOf(attEmp.location)?.name || attEmp.location) : "Not Assigned"} <span className="text-zinc-600">(unchanged)</span></span>
                            </div>
                            <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input value={attQ} onChange={ev => setAttQ(ev.target.value)} placeholder="Search locations…" data-testid="loc-att-search"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-2 py-2 text-[11px] text-white outline-none" />
                            </div>
                            <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800/70" data-testid="loc-att-list">
                                {locations.filter(l => !attQ.trim() || `${l.name} ${l.shortName || ""} ${l.city || ""}`.toLowerCase().includes(attQ.trim().toLowerCase())).map(l => (
                                    <label key={l.id} className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.03] cursor-pointer">
                                        <input type="checkbox" className="accent-emerald-500" checked={attSel.includes(l.id)} data-testid="loc-att-option" data-id={l.id}
                                            onChange={ev => setAttSel(sel => ev.target.checked ? [...sel, l.id] : sel.filter(x => x !== l.id))} />
                                        <span className="flex-1">{l.name}</span><span className="text-[10px] text-zinc-500">{l.city || ""}</span>
                                    </label>
                                ))}
                                {!locations.length && <p className="px-3 py-4 text-[11px] text-zinc-500">No locations yet — add them on the Locations page first.</p>}
                            </div>
                            <p className="text-[10px] text-zinc-500">{attSel.length} selected. The HOI can clock in and clock out inside the geofence of any selected location. This does not change the Original Location, HOI mappings or which colleges the HOI manages.</p>
                        </div>
                        <div className="px-5 py-3.5 border-t border-zinc-800 flex justify-end gap-2">
                            <button onClick={() => setAttEmp(null)} disabled={busy} className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-800">Cancel</button>
                            <button onClick={saveAttendance} disabled={busy} data-testid="loc-att-save"
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Locations
                            </button>
                        </div>
                    </div>
                </div>
            )}

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