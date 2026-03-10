"use client";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    MapPin,
    Plus,
    Search,
    Edit2,
    Trash2,
    ChevronRight,
    Globe,
    Navigation,
    X,
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LocationsPage() {
    const { user, colleges, addCollege, updateCollege, deleteCollege } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        shortName: "",
        lat: 0,
        lng: 0,
        radiusKm: 2,
        address: "",
        city: "",
        state: ""
    });

    if (!user || !["HR", "FOUNDER"].includes(user.role)) {
        return (
            <div className="p-8 text-center">
                <p className="text-zinc-400">You do not have permission to access this page.</p>
            </div>
        );
    }

    const filteredColleges = colleges.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (c: any) => {
        setFormData({
            name: c.name,
            shortName: c.shortName,
            lat: c.lat,
            lng: c.lng,
            radiusKm: c.radiusKm,
            address: c.address,
            city: c.city,
            state: c.state
        });
        setEditingId(c.id);
        setIsAdding(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            await updateCollege(editingId, formData);
        } else {
            await addCollege(formData);
        }
        setIsAdding(false);
        setEditingId(null);
        setFormData({
            name: "",
            shortName: "",
            lat: 0,
            lng: 0,
            radiusKm: 2,
            address: "",
            city: "",
            state: ""
        });
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <MapPin className="text-blue-500" />
                        Campus Locations
                    </h1>
                    <p className="text-zinc-400 text-sm">Manage institutional zones and geo-fencing clusters</p>
                </div>
                <button
                    onClick={() => { setIsAdding(true); setEditingId(null); }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} />
                    Add New Campus
                </button>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 flex items-center justify-between">
                    <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Total Zones</span>
                    <span className="text-xl font-black text-white">{colleges.length}</span>
                </div>
            </div>

            {/* Locations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredColleges.map((c) => (
                    <div key={c.id} className="group relative bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all duration-300">
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h3 className="text-white font-bold leading-tight group-hover:text-blue-400 transition-colors uppercase tracking-tight text-sm">
                                        {c.name}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-black uppercase">
                                            {c.shortName}
                                        </span>
                                        <span className="text-zinc-500 text-[10px] flex items-center gap-1 font-bold">
                                            <Navigation size={10} />
                                            Radius: {c.radiusKm}km
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-start gap-2 text-xs text-zinc-400">
                                    <Globe size={14} className="mt-0.5 shrink-0 text-zinc-600" />
                                    <span>{c.lat.toFixed(6)}, {c.lng.toFixed(6)}</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-zinc-400">
                                    <MapPin size={14} className="mt-0.5 shrink-0 text-zinc-600" />
                                    <span className="line-clamp-2">{c.address}, {c.city}, {c.state}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2">
                                <button
                                    onClick={() => handleEdit(c)}
                                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => { if (confirm('Delete this location?')) deleteCollege(c.id); }}
                                    className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                {editingId ? <Edit2 className="text-blue-500" /> : <Plus className="text-blue-500" />}
                                {editingId ? "Edit Campus Data" : "Register New Campus"}
                            </h2>
                            <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Full Campus Name</label>
                                    <input
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        placeholder="e.g. Sage University Bhopal"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Short Label</label>
                                    <input
                                        required
                                        value={formData.shortName}
                                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        placeholder="e.g. SAGE Bhopal"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tracking Radius (KM)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={formData.radiusKm}
                                        onChange={(e) => setFormData({ ...formData, radiusKm: parseFloat(e.target.value) })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Latitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        required
                                        value={formData.lat}
                                        onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Longitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        required
                                        value={formData.lng}
                                        onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">City</label>
                                    <input
                                        required
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">State</label>
                                    <input
                                        required
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Street Address</label>
                                    <textarea
                                        required
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none h-20"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
                                >
                                    Discard
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                                >
                                    <Check size={18} />
                                    {editingId ? "Save Changes" : "Create Campus"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
