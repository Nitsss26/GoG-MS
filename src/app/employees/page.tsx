"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, Mail, Phone, MapPin, Download, Plus, ShieldAlert, FileText, Filter, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export default function EmployeesPage() {
    const { user, employees, addEmployee } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [locationFilter, setLocationFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [roleFilter, setRoleFilter] = useState("All");
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        dept: "Engineering",
        designation: "",
        role: "FACULTY" as any,
        salary: 0,
        location: "Bhopal Hub",
        status: "Active" as any,
        joiningDate: new Date().toISOString().split('T')[0]
    });

    if (!user) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addEmployee(formData);
        setShowModal(false);
        setFormData({ name: "", email: "", dept: "Engineering", designation: "", role: "FACULTY", salary: 0, location: "Bhopal Hub", status: "Active", joiningDate: new Date().toISOString().split('T')[0] });
    };

    // Strict Role-Based Access Control
    if (user.role !== "HR" && user.role !== "FOUNDER") {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center space-y-4 p-6 text-center">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
                    <ShieldAlert size={32} />
                </div>
                <div className="max-w-xs space-y-2">
                    <h2 className="text-base font-bold text-white">Institutional Restriction</h2>
                    <p className="text-xs text-muted leading-relaxed">The employee directory and contractual data are restricted to administrative personnel only.</p>
                </div>
                <Link href="/" className="btn-primary py-2.5 px-6 text-xs">Return to Dashboard</Link>
            </div>
        );
    }

    const categories = ["All", ...new Set(employees.map(e => e.dept))];
    const locations = ["All", ...new Set(employees.map(e => e.location))];
    const statuses = ["All", "Active", "On Leave", "On Site", "Resigned"];
    const roleLevels = ["All", "HR", "AD", "HOI", "OM", "TL", "Faculty"];

    const getRoleLevel = (emp: any): string => {
        if (emp.role === "HR") return "HR";
        if (emp.managerLevel) return emp.managerLevel;
        return "Faculty";
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.dept.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.designation.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === "All" || emp.dept === activeTab;
        const matchesLocation = locationFilter === "All" || emp.location === locationFilter;
        const matchesStatus = statusFilter === "All" || emp.status === statusFilter;
        const matchesRole = roleFilter === "All" || getRoleLevel(emp) === roleFilter;
        return matchesSearch && matchesTab && matchesLocation && matchesStatus && matchesRole;
    });

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Workforce Registry</h1>
                    <p className="text-xs text-muted">Management of institutional human capital and contractual nodes.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn-outline flex items-center gap-1.5 h-9 px-4 text-xs font-semibold"><Download size={13} /> Export Data</button>
                    <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 h-9 px-4 text-xs font-semibold"><Plus size={13} /> Add Record</button>
                </div>
            </header>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input type="text" placeholder="Search by name, ID or role..." className="w-full bg-surface border border-border rounded-lg py-2.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-primary/30" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter size={12} className="text-muted mr-1" />
                    <div className="flex gap-2">
                        <select className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-[10px] text-white outline-none font-bold" value={activeTab} onChange={e => setActiveTab(e.target.value)}>
                            {categories.map(c => <option key={c} value={c}>Dept: {c}</option>)}
                        </select>
                        <select className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-[10px] text-white outline-none font-bold" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                            {locations.map(l => <option key={l} value={l}>Node: {l}</option>)}
                        </select>
                        <select className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-[10px] text-white outline-none font-bold" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            {statuses.map(s => <option key={s} value={s}>State: {s}</option>)}
                        </select>
                        <select className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-[10px] text-white outline-none font-bold" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                            {roleLevels.map(r => <option key={r} value={r}>Role: {r}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Register */}
            <div className="card">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                <th className="px-5 py-4">Employee Node</th>
                                <th className="px-5 py-4">Contractual ID</th>
                                <th className="px-5 py-4">Department</th>
                                <th className="px-5 py-4">Role Level</th>
                                <th className="px-5 py-4">Location</th>
                                <th className="px-5 py-4">Operational Status</th>
                                <th className="px-5 py-4 text-right">Reference</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredEmployees.length === 0 ? (
                                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">No workforce records matching synchronization parameters.</td></tr>
                            ) : (
                                filteredEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-surface-light transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-xs font-bold">{emp.name[0]}</div>
                                                <div>
                                                    <span className="font-bold text-white block">{emp.name}</span>
                                                    <span className="text-[10px] text-muted">{emp.designation}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-mono text-[10px] text-muted">GOG-2024-{emp.id.padStart(3, '0')}</td>
                                        <td className="px-5 py-4"><span className="badge badge-zinc">{emp.dept}</span></td>
                                        <td className="px-5 py-4">
                                            {(() => {
                                                const rl = getRoleLevel(emp);
                                                const colors: Record<string, string> = { HR: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", AD: "text-purple-400 bg-purple-500/10 border-purple-500/20", HOI: "text-blue-400 bg-blue-500/10 border-blue-500/20", OM: "text-amber-400 bg-amber-500/10 border-amber-500/20", TL: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", Faculty: "text-zinc-400 bg-zinc-800 border-zinc-700" };
                                                return <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-wider", colors[rl] || colors.Faculty)}>{rl}</span>;
                                            })()}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1.5 text-muted">
                                                <MapPin size={11} className="text-primary" /> {emp.location}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn("badge",
                                                emp.status === "Active" ? "badge-green" :
                                                    emp.status === "On Leave" ? "badge-amber" : "badge-zinc"
                                            )}>{emp.status}</span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="h-8 w-8 flex items-center justify-center bg-surface-light border border-border rounded-lg hover:text-primary transition-colors"><Mail size={12} /></button>
                                                <button className="h-8 w-8 flex items-center justify-center bg-surface-light border border-border rounded-lg hover:text-primary transition-colors"><FileText size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Add Employee Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-lg p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center text-white">
                                <h2 className="text-base font-bold">Index New Employee</h2>
                                <button onClick={() => setShowModal(false)}><X size={18} className="text-muted hover:text-white" /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Full Name</label>
                                        <input type="text" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="Arjun Sharma" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Professional Email</label>
                                        <input type="email" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="arjun@gog.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Department</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.dept} onChange={e => setFormData({ ...formData, dept: e.target.value })}>
                                            <option>Engineering</option><option>HR</option><option>Product</option><option>Marketing</option><option>Design</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Designation</label>
                                        <input type="text" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" placeholder="Lead Developer" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Annual CTC (₹)</label>
                                        <input type="number" required className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.salary} onChange={e => setFormData({ ...formData, salary: Number(e.target.value) })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Deployment Node</label>
                                        <select className="w-full bg-surface-light border border-border rounded-lg p-3 text-xs text-white" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}>
                                            <option>Bhopal Hub</option><option>Indore Cluster</option><option>Hyderabad Node</option><option>Pune Cluster</option><option>Delhi Sector</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                                    <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">Indexed nodes will initially be in &quot;Pending Onboarding&quot; status. They will be required to validate their identity upon first synchronization.</p>
                                </div>
                                <button type="submit" className="btn-primary w-full py-3">Register Institutional Node</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
