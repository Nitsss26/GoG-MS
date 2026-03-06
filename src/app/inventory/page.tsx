// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth, Asset, AssetRequest } from "@/context/AuthContext";
import {
    HardDrive,
    Plus,
    Search,
    User,
    Package,
    CheckCircle2,
    AlertCircle,
    X,
    Filter,
    Laptop,
    Smartphone,
    MousePointer2,
    History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function InventoryPage() {
    const { user, assets, employees, assetRequests, requestAsset, assignAsset, updateAssetRequestStatus } = useAuth();
    const [activeTab, setActiveTab] = useState("My Assets");
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState<Asset | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [reqForm, setReqForm] = useState({ assetType: "Laptop", reason: "" });

    if (!user) return null;

    const myAssets = assets.filter(a => a.assignedTo === user.id);
    const myRequests = assetRequests.filter(r => r.employeeId === user.id);

    const handleRequestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        requestAsset(reqForm);
        setShowRequestModal(false);
        setReqForm({ assetType: "Laptop", reason: "" });
    };

    const typeIcons = {
        "Laptop": <Laptop size={16} />,
        "SIM": <Smartphone size={16} />,
        "Peripheral": <MousePointer2 size={16} />,
        "Key": <Package size={16} />,
        "Other": <Package size={16} />
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white">Institutional Assets & Inventory</h1>
                    <p className="text-xs text-muted">Management of hardware assets, procurement nodes, and workforce assignments.</p>
                </div>
                {!["HR", "FOUNDER"].includes(user.role) && (
                    <button onClick={() => setShowRequestModal(true)} className="btn-primary h-9 px-4 flex items-center gap-2">
                        <Plus size={14} /> Request Asset
                    </button>
                )}
            </header>

            <div className="flex items-center gap-2">
                {["My Assets", ...(user.role === "HR" ? ["Full Registry", "Requests queue"] : ["My Requests"])].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                            activeTab === tab ? "bg-primary/10 text-primary border-primary/20" : "text-muted hover:text-white bg-surface-light border-border"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === "My Assets" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card p-5 space-y-1 bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                            <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Active Assignments</p>
                            <p className="text-2xl font-bold text-white tracking-tight">{myAssets.length}</p>
                        </div>
                        <div className="card p-5 space-y-1">
                            <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Pending Requests</p>
                            <p className="text-2xl font-bold text-white tracking-tight">{myRequests.filter(r => r.status === "Pending").length}</p>
                        </div>
                    </div>

                    <div className="card">
                        <div className="p-4 border-b border-border text-white">
                            <h3 className="text-sm font-semibold">Assigned Hardware Node</h3>
                        </div>
                        <div className="divide-y divide-border">
                            {myAssets.length === 0 ? (
                                <div className="p-12 text-center text-muted text-xs italic">No institutional assets assigned to your node.</div>
                            ) : (
                                myAssets.map(asset => (
                                    <div key={asset.id} className="p-4 flex items-center justify-between hover:bg-surface-light transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-primary">{typeIcons[asset.type as keyof typeof typeIcons]}</div>
                                            <div>
                                                <p className="text-sm font-bold text-white tracking-tight">{asset.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-muted font-mono uppercase font-bold tracking-widest">{asset.serialNumber}</span>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                                    <span className="text-[9px] text-muted uppercase font-bold tracking-widest">Procured: {asset.procurementDate}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="badge badge-zinc bg-primary/10 text-primary border-primary/20">Operational</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "Full Registry" && user.role === "HR" && (
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                            <input
                                type="text"
                                placeholder="Search serial or item..."
                                className="w-full bg-surface-light border border-border rounded-xl py-2.5 pl-10 pr-4 text-xs text-white outline-none focus:border-primary/50 transition-all font-medium"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn-outline px-4 flex items-center gap-2"><Filter size={14} /> Filter</button>
                    </div>

                    <div className="card overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                    <th className="px-5 py-4">Asset Node</th>
                                    <th className="px-5 py-4">Serial Handshake</th>
                                    <th className="px-5 py-4">Assignment Status</th>
                                    <th className="px-5 py-4">Custodian</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {assets.map(asset => {
                                    const assignee = employees.find(e => e.id === asset.assignedTo);
                                    return (
                                        <tr key={asset.id} className="hover:bg-surface-light transition-colors group italic">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-primary">{typeIcons[asset.type as keyof typeof typeIcons]}</div>
                                                    <div>
                                                        <p className="font-bold text-white">{asset.name}</p>
                                                        <p className="text-[9px] text-muted uppercase tracking-widest">{asset.type}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-mono text-zinc-500 font-bold">{asset.serialNumber}</td>
                                            <td className="px-5 py-4">
                                                <span className={cn("badge",
                                                    asset.status === "Available" ? "badge-green" :
                                                        asset.status === "Assigned" ? "badge-zinc" : "badge-amber"
                                                )}>{asset.status}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-[9px] font-bold">{assignee.name[0]}</div>
                                                        <span className="text-white font-medium">{assignee.name}</span>
                                                    </div>
                                                ) : <span className="text-zinc-600 font-bold italic">Unassigned Node</span>}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button onClick={() => setShowAssignModal(asset)} className="text-primary text-[10px] font-bold uppercase hover:underline">Reconfigure</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === "Requests queue" && user.role === "HR" && (
                <div className="card overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                <th className="px-5 py-4">Requestor Node</th>
                                <th className="px-5 py-4">Requirement</th>
                                <th className="px-5 py-4">Justification</th>
                                <th className="px-5 py-4">Timestamp</th>
                                <th className="px-5 py-4 text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {assetRequests.length === 0 ? (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted italic text-xs">Queue is currently clear.</td></tr>
                            ) : (
                                assetRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-surface-light transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-[9px] font-bold">{req.employeeName[0]}</div>
                                                <span className="text-white font-bold">{req.employeeName}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-bold text-white">{req.assetType}</td>
                                        <td className="px-5 py-4 text-muted text-[10px] leading-relaxed max-w-xs">{req.reason}</td>
                                        <td className="px-5 py-4 text-zinc-500 font-bold uppercase tracking-tight">{req.requestDate}</td>
                                        <td className="px-5 py-4 text-right">
                                            {req.status === "Pending" ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => updateAssetRequestStatus(req.id, "Approved")} className="badge badge-green hover:brightness-125 transition-all">Approve</button>
                                                    <button onClick={() => updateAssetRequestStatus(req.id, "Rejected")} className="badge badge-zinc opacity-50 hover:opacity-100 transition-all">Reject</button>
                                                </div>
                                            ) : (
                                                <span className={cn("badge", req.status === "Approved" ? "badge-green" : "badge-zinc opacity-50")}>{req.status}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === "My Requests" && !["HR", "FOUNDER"].includes(user.role) && (
                <div className="card overflow-hidden">
                    <div className="p-4 border-b border-border text-white flex justify-between items-center">
                        <h3 className="text-sm font-semibold">Request Timeline</h3>
                        <History size={14} className="text-muted" />
                    </div>
                    <div className="divide-y divide-border">
                        {myRequests.length === 0 ? (
                            <div className="p-12 text-center text-muted italic text-xs">You have no active hardware requests.</div>
                        ) : (
                            myRequests.map(req => (
                                <div key={req.id} className="p-5 flex items-center justify-between hover:bg-surface-light transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-white tracking-tight">{req.assetType}</p>
                                            <span className={cn("badge",
                                                req.status === "Approved" ? "badge-green" :
                                                    req.status === "Pending" ? "badge-amber" : "badge-zinc opacity-50"
                                            )}>{req.status}</span>
                                        </div>
                                        <p className="text-[10px] text-muted italic">Reason: {req.reason}</p>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 font-bold tracking-widest italic">{req.requestDate}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Request Modal */}
            <AnimatePresence>
                {showRequestModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRequestModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-md p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center pb-2 border-b border-border">
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <AlertCircle size={18} className="text-primary" />
                                    Infrastructure Request
                                </h2>
                                <button onClick={() => setShowRequestModal(false)}><X size={18} className="text-muted" /></button>
                            </div>

                            <form onSubmit={handleRequestSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-[0.2em]">Asset Vector</label>
                                    <select className="w-full bg-surface-light border border-border rounded-xl p-3 text-xs text-white" value={reqForm.assetType} onChange={e => setReqForm({ ...reqForm, assetType: e.target.value })}>
                                        <option>Laptop</option>
                                        <option>SIM Card</option>
                                        <option>External Display</option>
                                        <option>Workstation Peripherals</option>
                                        <option>Institutional Key</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-[0.2em]">Institutional Reason</label>
                                    <textarea required rows={4} className="w-full bg-surface-light border border-border rounded-xl p-3 text-xs text-white resize-none" placeholder="Provide technical justification for this resource request..." value={reqForm.reason} onChange={e => setReqForm({ ...reqForm, reason: e.target.value })} />
                                </div>
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
                                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-muted-foreground leading-relaxed italic">Your vector request will be queued for institutional audit. Upon approval, HR will assign a specific hardware node to your custodian ID.</p>
                                </div>
                                <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                                    <HardDrive size={14} /> Commit Request
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Assignment Modal (ADMIN) */}
            <AnimatePresence>
                {showAssignModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-sm p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center pb-2 border-b border-border text-white">
                                <h2 className="text-base font-bold">Node Reconfiguration</h2>
                                <button onClick={() => setShowAssignModal(null)}><X size={18} className="text-muted" /></button>
                            </div>

                            <div className="space-y-4">
                                <div className="card p-3 bg-zinc-900 border-zinc-800 space-y-1">
                                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Asset Selected</p>
                                    <p className="text-sm font-bold text-white">{showAssignModal.name}</p>
                                    <p className="text-[10px] font-mono text-zinc-500">{showAssignModal.serialNumber}</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase tracking-widest">Target Custodian</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-3 text-xs text-white"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            assignAsset(showAssignModal.id, val === "NONE" ? undefined : val);
                                            setShowAssignModal(null);
                                        }}
                                        defaultValue={showAssignModal.assignedTo || "NONE"}
                                    >
                                        <option value="NONE">Release to Inventory Pool</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.dept})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
