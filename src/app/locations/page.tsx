"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Building2, Users, Plus, Edit2, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export default function LocationsPage() {
    const { user, colleges, addCollege, updateCollege, employees } = useAuth();
    const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [mapSearchQuery, setMapSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "", shortName: "", lat: "", lng: "", radiusKm: "2",
        address: "", city: "", state: ""
    });

    const mapRef = useRef<any>(null);
    const isHR = user?.role === "HR" || user?.role === "FOUNDER";

    const filtered = colleges.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.shortName.toLowerCase().includes(search.toLowerCase()) ||
        c.city.toLowerCase().includes(search.toLowerCase())
    );

    const collegeEmployeeCount = employees.reduce((acc, emp) => {
        if (emp.location) acc[emp.location] = (acc[emp.location] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const selectedEmps = employees.filter(e => e.location === selectedCollege);

    const openEdit = (id: string) => {
        const c = colleges.find(x => x.id === id);
        if (c) {
            setForm({
                name: c.name, shortName: c.shortName, lat: c.lat.toString(),
                lng: c.lng.toString(), radiusKm: c.radiusKm.toString(),
                address: c.address, city: c.city, state: c.state
            });
            setEditingId(id);
            setShowAdd(true);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            name: form.name, shortName: form.shortName,
            lat: parseFloat(form.lat), lng: parseFloat(form.lng),
            radiusKm: parseFloat(form.radiusKm), address: form.address,
            city: form.city, state: form.state
        };
        if (editingId) updateCollege(editingId, data);
        else addCollege(data);
        setShowAdd(false);
        setEditingId(null);
    };

    const handleMapSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mapSearchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                if (mapRef.current) {
                    mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 13);
                }
            }
        } catch (err) { console.error("Search failed:", err); }
        setSearching(false);
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            <header className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2"><MapPin className="text-primary" /> Campus Locations</h1>
                    <p className="text-xs text-zinc-500">Geo-mapping of all SAGE & Partner institutions across India.</p>
                </div>
                <div className="flex items-center gap-3">
                    <form onSubmit={handleMapSearch} className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-primary transition-colors" size={14} />
                        <input
                            type="text"
                            placeholder="Search location (e.g. India Gate)..."
                            className="bg-zinc-950 border border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-xs text-white w-64 focus:border-primary transition-all outline-none"
                            value={mapSearchQuery}
                            onChange={(e) => setMapSearchQuery(e.target.value)}
                        />
                        {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={12} className="text-primary animate-spin" /></div>}
                    </form>
                    {isHR && (
                        <button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: "", shortName: "", lat: "", lng: "", radiusKm: "2", address: "", city: "", state: "" }); }} className="btn-primary py-1.5 px-4 text-xs flex items-center gap-2 rounded-full"><Plus size={14} /> Add Location</button>
                    )}
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Map Sidebar */}
                <div className="w-80 border-r border-zinc-800 bg-zinc-950/50 flex flex-col shrink-0">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/20">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input type="text" placeholder="Filter institutions..." value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-primary outline-none transition-all" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filtered.map(college => {
                            const empCount = collegeEmployeeCount[college.id] || 0;
                            const isSelected = selectedCollege === college.id;
                            return (
                                <motion.div key={college.id} layout
                                    onClick={() => setSelectedCollege(isSelected ? null : college.id)}
                                    className={cn("bg-zinc-900/80 border rounded-2xl p-4 space-y-3 cursor-pointer transition-all hover:border-primary/30",
                                        isSelected ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : "border-zinc-800/50")}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 size={16} className="text-primary" /></div>
                                            <div><h3 className="text-xs font-bold text-white">{college.shortName}</h3><p className="text-[9px] text-zinc-500">{college.city}</p></div>
                                        </div>
                                        {isHR && <button onClick={e => { e.stopPropagation(); openEdit(college.id); }} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"><Edit2 size={12} /></button>}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Users size={10} />{empCount} assigned</div>
                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pt-2 border-t border-zinc-800/50 space-y-2 overflow-hidden">
                                                <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-zinc-500">
                                                    <div className="bg-zinc-800/50 p-1.5 rounded-lg">Lat: {college.lat.toFixed(4)}</div>
                                                    <div className="bg-zinc-800/50 p-1.5 rounded-lg">Lng: {college.lng.toFixed(4)}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    {selectedEmps.length > 0 ? selectedEmps.map(s => (
                                                        <div key={s.id} className="flex items-center gap-2 text-[10px] bg-zinc-800/30 p-1.5 rounded-lg">
                                                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[7px] font-bold">{s.name[0]}</div>
                                                            <span className="text-zinc-300 truncate">{s.name}</span>
                                                        </div>
                                                    )) : <p className="text-[9px] text-zinc-600 italic">No employees assigned</p>}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Map View */}
                <div className="flex-1 relative bg-zinc-950 z-0">
                    <MapContainer
                        center={[22.9734, 78.6569]}
                        zoom={5}
                        style={{ height: "100%", width: "100%" }}
                        zoomControl={false}
                        ref={(map) => { mapRef.current = map; }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                        <ZoomControl position="bottomright" />
                        {colleges.map((c) => (
                            <Marker
                                key={c.id}
                                position={[c.lat, c.lng]}
                                icon={L.divIcon({
                                    className: "custom-marker",
                                    html: `<div class="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-pulse"><div class="w-2 h-2 rounded-full bg-primary"></div></div>`,
                                    iconSize: [32, 32]
                                })}
                                eventHandlers={{ click: () => setSelectedCollege(c.id) }}
                            >
                                <Popup icon={false} className="custom-popup">
                                    <div className="p-3 bg-zinc-900 text-white rounded-lg border border-zinc-800 space-y-2">
                                        <h3 className="font-bold text-sm text-primary">{c.shortName}</h3>
                                        <p className="text-[10px] text-zinc-400 leading-tight">{c.address}</p>
                                        <div className="flex gap-2">
                                            <span className="text-[9px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">Lat: {c.lat}</span>
                                            <span className="text-[9px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">Lng: {c.lng}</span>
                                        </div>
                                    </div>
                                </Popup>
                                <Circle center={[c.lat, c.lng]} radius={c.radiusKm * 1000} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.1, weight: 1 }} />
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showAdd && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2"><MapPin className="text-primary" /> {editingId ? "Edit Location" : "Add New Location"}</h2>
                                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">Full Name</label><input required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. SAGE University Bhopal" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">Short Name</label><input required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.shortName} onChange={e => setForm({ ...form, shortName: e.target.value })} placeholder="e.g. SAGE Bhopal" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">Radius (KM)</label><input required type="number" step="0.1" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.radiusKm} onChange={e => setForm({ ...form, radiusKm: e.target.value })} /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">Latitude</label><input required step="any" type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">Longitude</label><input required step="any" type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></div>
                                    <div className="col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">Address</label><input required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">City</label><input required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-zinc-500 uppercase">State</label><input required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                                    <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                    <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 flex items-center gap-2"><Building2 size={14} /> {editingId ? "Update" : "Add Location"}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
