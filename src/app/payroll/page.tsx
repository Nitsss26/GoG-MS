// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Download, Eye, X, CheckCircle2, Zap, AlertCircle, TrendingUp, PiggyBank, ShieldCheck, Mail, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PayrollPage() {
    const { user, employees, payrollRecords, pfRecords, generatePayroll } = useAuth();
    const [activeTab, setActiveTab] = useState("Compensation");
    const [selectedSlip, setSelectedSlip] = useState<any | null>(null);
    const [generatingMonth, setGeneratingMonth] = useState("February");
    const [generatingYear, setGeneratingYear] = useState("2024");
    const [showRunConfirm, setShowRunConfirm] = useState(false);
    const [isDispatching, setIsDispatching] = useState(false);
    const [dispatchLog, setDispatchLog] = useState<string[]>([]);
    const [showDispatchModal, setShowDispatchModal] = useState(false);

    if (!user) return null;

    const mySlips = payrollRecords.filter(p => p.employeeId === user.id);
    const currentUser = employees.find(e => e.id === user.id);
    const monthlySalary = (currentUser?.salary || 0) / 12;

    const handleRunPayroll = () => {
        generatePayroll(generatingMonth, generatingYear);
        setShowRunConfirm(false);
    };

    const handleDispatchEmails = async () => {
        setIsDispatching(true);
        setDispatchLog([]);
        setShowDispatchModal(true);

        for (const emp of employees) {
            await new Promise(r => setTimeout(r, 400));
            setDispatchLog(prev => [`Dispatched Slip to ${emp.email} [ID: ${emp.id}]`, ...prev]);
        }

        setIsDispatching(false);
    };

    const handleViewSlip = (record: any) => {
        const basic = record.amount * 0.5;
        const hra = record.amount * 0.3;
        const special = record.amount * 0.2;
        const pf = record.amount * 0.12;
        const tax = record.amount * 0.1;
        setSelectedSlip({
            month: record.month,
            year: record.year,
            amount: record.amount,
            earnings: { basic, hra, special, total: basic + hra + special },
            deductions: { pf, tax, total: pf + tax },
            net: (basic + hra + special) - (pf + tax),
        });
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            <header>
                <h1 className="text-lg font-bold text-white">Financial Disbursals</h1>
                <p className="text-xs text-muted">Manage payroll operations and view personal compensation logs.</p>
            </header>

            {user.role === "HR" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="card p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Zap size={16} className="text-primary" />
                                <h3 className="text-sm font-bold text-white">Execute Payroll</h3>
                            </div>
                            <p className="text-[11px] text-muted">Generate salary records for the entire workforce for a selected cycle.</p>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase">Month</label>
                                    <select className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={generatingMonth} onChange={e => setGeneratingMonth(e.target.value)}>
                                        <option>January</option><option>February</option><option>March</option><option>April</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted uppercase">Year</label>
                                    <select className="w-full bg-surface-light border border-border rounded-lg p-2.5 text-xs text-white" value={generatingYear} onChange={e => setGeneratingYear(e.target.value)}>
                                        <option>2024</option><option>2023</option>
                                    </select>
                                </div>
                                <button onClick={() => setShowRunConfirm(true)} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                                    <CheckCircle2 size={14} /> Process Batch
                                </button>
                            </div>
                        </div>

                        <div className="card p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Mail size={16} className="text-primary" />
                                <h3 className="text-sm font-bold text-white">Institutional Dispatch</h3>
                            </div>
                            <p className="text-[11px] text-muted text-pretty">Bulk distribute digital salary slips to all employees via institutional email nodes.</p>
                            <button
                                onClick={handleDispatchEmails}
                                disabled={payrollRecords.length === 0}
                                className="btn-outline w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Send size={14} /> Dispatch Batch
                            </button>
                        </div>

                        <div className="card p-5">
                            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">Liability Snapshot</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted">Avg. CTC</span>
                                    <span className="text-white font-bold">₹{(employees.reduce((acc, c) => acc + c.salary, 0) / employees.length / 100000).toFixed(1)}L</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted">Total Monthly</span>
                                    <span className="text-primary font-bold">₹{(employees.reduce((acc, c) => acc + (c.salary / 12), 0) / 1000).toFixed(1)}K</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 card">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-white">Disbursal Register</h3>
                            <button className="text-[10px] text-primary hover:underline flex items-center gap-1"><Download size={12} /> Export CSV</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                        <th className="px-4 py-3">Reference</th>
                                        <th className="px-4 py-3">Cycle</th>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Amount</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {payrollRecords.length === 0 ? (
                                        <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">No records generated in registry.</td></tr>
                                    ) : (
                                        payrollRecords.map((rec) => {
                                            const emp = employees.find(e => e.id === rec.employeeId);
                                            return (
                                                <tr key={rec.id} className="hover:bg-surface-light transition-colors group">
                                                    <td className="px-4 py-3 font-mono text-muted text-[10px]">{rec.id}</td>
                                                    <td className="px-4 py-3 text-white font-medium">{rec.month} {rec.year}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded bg-surface-light border border-border flex items-center justify-center text-primary text-[9px] font-bold">{emp?.name[0]}</div>
                                                            <span className="text-white">{emp?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-primary font-bold">₹{rec.amount.toLocaleString("en-IN")}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => handleViewSlip(rec)} className="opacity-40 group-hover:opacity-100 hover:text-primary transition-all">
                                                            <Eye size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        {["Compensation", "PF Ledger"].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all border", activeTab === tab ? "bg-primary/10 text-primary border-primary/20" : "text-muted hover:text-white bg-surface-light border-border")}>
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === "Compensation" ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="card p-5 md:col-span-2 flex justify-between items-center bg-gradient-to-r from-primary/5 to-transparent">
                                    <div>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Monthly Basic Pay</p>
                                        <p className="text-2xl font-bold text-white mt-1">₹{monthlySalary.toLocaleString("en-IN")}</p>
                                        <p className="text-[10px] text-muted mt-1">Annual CTC: ₹{((currentUser?.salary || 0) / 100000).toFixed(1)}L per annum</p>
                                    </div>
                                    <Wallet size={32} className="text-primary/20" />
                                </div>
                                <div className="card p-5 space-y-2">
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Payout Node</p>
                                    <p className="text-xs font-bold text-white">Bank Transfer (HDFC)</p>
                                    <p className="text-[10px] text-muted">A/C: ****4501 · Bhopal Main</p>
                                </div>
                            </div>

                            <div className="card">
                                <div className="p-4 border-b border-border flex justify-between items-center text-white">
                                    <h3 className="text-sm font-semibold">Compensation History</h3>
                                    <span className="badge badge-zinc">Total Logs: {mySlips.length}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                                <th className="px-4 py-3">Billing Cycle</th>
                                                <th className="px-4 py-3">Disbursment Date</th>
                                                <th className="px-4 py-3">Net Realized</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Documents</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {mySlips.length === 0 ? (
                                                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">No payslips have been generated for you yet.</td></tr>
                                            ) : (
                                                mySlips.map((rec) => (
                                                    <tr key={rec.id} className="hover:bg-surface-light transition-colors">
                                                        <td className="px-4 py-3 font-bold text-white">{rec.month} {rec.year}</td>
                                                        <td className="px-4 py-3 text-muted">{rec.generatedAt}</td>
                                                        <td className="px-4 py-3 text-primary font-bold">₹{rec.amount.toLocaleString("en-IN")}</td>
                                                        <td className="px-4 py-3"><span className="badge badge-green">Realized</span></td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button onClick={() => handleViewSlip(rec)} className="btn-outline py-1.5 px-3 flex items-center gap-2 ml-auto">
                                                                <Eye size={12} /> <span className="text-[10px]">View Detail</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="card p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-primary/20 text-primary rounded-2xl"><PiggyBank size={24} /></div>
                                        <span className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Institutional Savings</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Total PF Accumulated</p>
                                        <p className="text-3xl font-bold text-white mt-1">₹{pfRecords.filter(p => p.employeeId === user.id).reduce((acc, curr) => acc + curr.totalAccumulated, 0).toLocaleString("en-IN")}</p>
                                        <p className="text-[10px] text-primary mt-2 flex items-center gap-1 font-bold">
                                            <TrendingUp size={10} /> +₹7,200 Monthly Growth
                                        </p>
                                    </div>
                                </div>

                                <div className="card p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl"><ShieldCheck size={24} /></div>
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Compliance Node</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted font-medium">UAN Number</span>
                                            <span className="text-white font-mono font-bold tracking-wider">1012 3345 9901</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted font-medium">PF Office</span>
                                            <span className="text-white font-bold">Bhopal - 1 (MP)</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pt-1">
                                            <span className="text-muted font-medium">KYC Status</span>
                                            <span className="text-primary font-bold">Verified Node</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="card p-6 border-dashed flex flex-col items-center justify-center text-center space-y-2 text-zinc-700 hover:text-zinc-500 hover:border-zinc-500 transition-all cursor-pointer">
                                    <Download size={24} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Download Full Statement</p>
                                    <p className="text-[9px] italic">Fiscal Year 2023-2024</p>
                                </div>
                            </div>

                            <div className="card">
                                <div className="p-4 border-b border-border flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-white">Institutional Contribution Log</h3>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Employer: 12% | Employee: 12%</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-border text-[9px] text-muted font-bold uppercase tracking-widest">
                                                <th className="px-6 py-4">Financial Month</th>
                                                <th className="px-6 py-4">Employee Share (₹)</th>
                                                <th className="px-6 py-4">Institutional Share (₹)</th>
                                                <th className="px-6 py-4">Monthly Total (₹)</th>
                                                <th className="px-6 py-4 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {pfRecords.filter(p => p.employeeId === user.id).length === 0 ? (
                                                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted italic">No PF recordings found in the institutional ledger.</td></tr>
                                            ) : (
                                                pfRecords.filter(p => p.employeeId === user.id).map(pf => (
                                                    <tr key={pf.id} className="hover:bg-primary/[0.02] transition-colors group">
                                                        <td className="px-6 py-4 font-bold text-white italic">{pf.month} {pf.year}</td>
                                                        <td className="px-6 py-4 text-zinc-400 font-medium">{pf.employeeContribution.toLocaleString("en-IN")}</td>
                                                        <td className="px-6 py-4 text-zinc-400 font-medium">{pf.employerContribution.toLocaleString("en-IN")}</td>
                                                        <td className="px-6 py-4 text-primary font-bold">₹{(pf.employeeContribution + pf.employerContribution).toLocaleString("en-IN")}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase">
                                                                <CheckCircle2 size={10} /> Consistently Remitted
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Confirm Modal */}
            <AnimatePresence>
                {showRunConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRunConfirm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-sm p-6 relative z-10 space-y-6 border-amber-500/20">
                            <div className="flex items-center gap-3 text-amber-500">
                                <AlertCircle size={24} />
                                <h2 className="text-base font-bold text-white">Initialize Batch?</h2>
                            </div>
                            <p className="text-xs text-muted leading-relaxed">This will generate salary disbursal records for all <b>{employees.length}</b> employees for <b>{generatingMonth} {generatingYear}</b>. This operation is recorded in the institutional ledger.</p>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowRunConfirm(false)} className="flex-1 btn-outline py-2.5">Cancel</button>
                                <button onClick={handleRunPayroll} className="flex-1 btn-primary py-2.5">Execute Run</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Slip Modal */}
            <AnimatePresence>
                {selectedSlip && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedSlip(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card w-full max-w-lg p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-border">
                                <div>
                                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">{selectedSlip.month} {selectedSlip.year}</p>
                                    <h2 className="text-base font-bold text-white text-primary">Earnings & Deductions Ledger</h2>
                                </div>
                                <button onClick={() => setSelectedSlip(null)} className="p-2 hover:bg-zinc-800 rounded"><X size={18} className="text-muted" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-8 text-xs">
                                <div className="space-y-4">
                                    <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Disbursals (+)</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-muted"><span>Basic Salary</span><span className="text-white">₹{selectedSlip.earnings.basic.toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between text-muted"><span>House Rent (HRA)</span><span className="text-white">₹{selectedSlip.earnings.hra.toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between text-muted"><span>Special Incentive</span><span className="text-white">₹{selectedSlip.earnings.special.toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between pt-2 border-t border-border font-bold text-primary"><span>Total Earnings</span><span>₹{selectedSlip.earnings.total.toLocaleString("en-IN")}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Withholdings (-)</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-muted"><span>Provident Fund (PF)</span><span className="text-white">₹{selectedSlip.deductions.pf.toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between text-muted"><span>Professional Tax</span><span className="text-white">₹{selectedSlip.deductions.tax.toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between pt-2 border-t border-border font-bold text-amber-500"><span>Total Deductions</span><span>₹{selectedSlip.deductions.total.toLocaleString("en-IN")}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="card p-5 bg-primary/5 border-primary/20 flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Settled Amount</p>
                                    <p className="text-2xl font-bold text-white">₹{selectedSlip.net.toLocaleString("en-IN")}</p>
                                </div>
                                <button className="btn-primary h-10 px-5 flex items-center gap-2"><Download size={14} /> Download Ledger</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Dispatch Modal */}
            <AnimatePresence>
                {showDispatchModal && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isDispatching && setShowDispatchModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card w-full max-w-md p-6 relative z-10 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    {isDispatching ? <Loader2 className="animate-spin text-primary" size={18} /> : <CheckCircle2 className="text-green-500" size={18} />}
                                    Email Dispatch Registry
                                </h2>
                                {!isDispatching && <button onClick={() => setShowDispatchModal(false)}><X size={18} className="text-muted" /></button>}
                            </div>

                            <div className="bg-zinc-950 border border-border rounded-xl p-4 h-64 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
                                {dispatchLog.length === 0 ? (
                                    <p className="text-zinc-600 italic">Initializing institutional SMTP handshake...</p>
                                ) : (
                                    dispatchLog.map((log, i) => (
                                        <div key={i} className="text-zinc-400 border-l border-primary/30 pl-2 py-0.5">
                                            <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span> {log}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-muted uppercase font-bold tracking-widest">Nodes Processed: {dispatchLog.length} / {employees.length}</span>
                                {!isDispatching && <span className="text-green-500 font-bold uppercase tracking-widest">Dispatch Complete</span>}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
