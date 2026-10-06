"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, UserCog, MapPin, Users, Edit2, X, CheckCircle } from "lucide-react";
import type { Employee } from "@/context/AuthContext";

export default function EmployeeSetupPage() {
    const { employees, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [editLocation, setEditLocation] = useState("");
    const [editManager, setEditManager] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [locations, setLocations] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/locations")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setLocations(data);
            })
            .catch(console.error);
    }, []);

    if (!user || (user.role !== "HR" && user.role !== "FOUNDER")) {
        return <div className="p-8 text-center text-zinc-500">Access Denied. HR Personnel Only.</div>;
    }

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.location || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEditClick = (emp: Employee) => {
        setSelectedEmployee(emp);
        setEditLocation(emp.location || "");
        setEditManager(Array.isArray(emp.reportsTo) ? emp.reportsTo : (emp.reportsTo ? [emp.reportsTo as string] : []));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee) return;

        setIsSaving(true);
        try {
            const response = await fetch('/api/employees', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedEmployee.id,
                    location: editLocation,
                    reportsTo: editManager
                })
            });

            if (!response.ok) {
                throw new Error("Failed to update employee");
            }

            alert("Employee details updated successfully! Please refresh the page to see the changes.");
            setSelectedEmployee(null);
        } catch (error) {
            console.error("Error updating employee:", error);
            alert("Error updating employee. Check console for details.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleManagerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const options = e.target.options;
        const values: string[] = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                values.push(options[i].value);
            }
        }
        setEditManager(values);
    };

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Employee Setup</h1>
                    <p className="text-zinc-500 mt-1">Assign and manage work locations and reporting managers</p>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search employees by name, ID or location..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-950/50">
                            <tr className="border-b border-zinc-800 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Role / Dept</th>
                                <th className="px-6 py-4">Work Location</th>
                                <th className="px-6 py-4">Reporting Manager(s)</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-zinc-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700 text-white font-bold">
                                                {emp.name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">{emp.name}</div>
                                                <div className="text-xs text-zinc-500">{emp.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-zinc-300 font-medium">{emp.role}</div>
                                        <div className="text-xs text-zinc-500">{emp.dept}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-zinc-300">
                                            <MapPin size={14} className="text-primary" />
                                            {emp.location || <span className="text-zinc-600 italic">Not Assigned</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-300">
                                        {Array.isArray(emp.reportsTo) && emp.reportsTo.length > 0 
                                            ? emp.reportsTo.join(", ") 
                                            : (emp.reportsTo || <span className="text-zinc-600 italic">None</span>)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleEditClick(emp)}
                                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg border border-zinc-700 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 ml-auto"
                                        >
                                            <Edit2 size={12} /> Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        No employees found matching the criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserCog size={20} className="text-primary" /> Setup Employee
                            </h2>
                            <button onClick={() => setSelectedEmployee(null)} className="text-zinc-500 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-6">
                                <p className="text-sm text-white font-bold">{selectedEmployee.name}</p>
                                <p className="text-xs text-zinc-500">{selectedEmployee.id} • {selectedEmployee.role}</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Work Location</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <select 
                                        value={editLocation}
                                        onChange={(e) => setEditLocation(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all appearance-none"
                                    >
                                        <option value="">Select Location...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reporting Manager(s)</label>
                                <div className="relative">
                                    <Users size={16} className="absolute left-3 top-4 text-zinc-500" />
                                    <select 
                                        multiple
                                        value={editManager}
                                        onChange={handleManagerSelect}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all min-h-[120px] custom-scrollbar"
                                    >
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-zinc-600">Hold Ctrl/Cmd to select multiple managers</p>
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? "Saving..." : <><CheckCircle size={18} /> Save Assignments</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
