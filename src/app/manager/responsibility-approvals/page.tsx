"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { AdditionalResponsibility } from "@/context/AuthContext";
import { Award, CheckCircle2, XCircle, Clock, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTab = "Pending" | "Approved" | "Rejected" | "All";
type ModalState = { type: "details" | "approve" | "reject"; resp: AdditionalResponsibility } | null;

// AD portal: final decision on responsibilities submitted by HOIs (and other managers).
// A responsibility counts towards the points / 100-credit calculation only after it is approved here.
export default function ResponsibilityApprovalsPage() {
    const { user, employees, approveAdditionalResponsibility } = useAuth();
    const [items, setItems] = useState<AdditionalResponsibility[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<StatusTab>("Pending");
    const [modal, setModal] = useState<ModalState>(null);
    const [reason, setReason] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const allowed = !!user && (user.role === "AD" || user.role === "FOUNDER");

    const load = async () => {
        try {
            const res = await fetch("/api/responsibilities");
            const data = await res.json();
            if (Array.isArray(data)) setItems(data);
        } catch (err) {
            console.error("Failed to fetch responsibilities:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (allowed) load();
    }, [allowed]);

    if (!user || !allowed) return null;

    const getEmployee = (id?: string) => employees.find(e => e.id === id);
    const submittedBy = (r: AdditionalResponsibility) => r.addedByName || getEmployee(r.addedBy)?.name || r.addedBy || "—";
    const submitterRole = (r: AdditionalResponsibility) => r.addedByRole || getEmployee(r.addedBy)?.role || "";
    const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

    const counts = {
        Pending: items.filter(r => r.status === "Pending").length,
        Approved: items.filter(r => r.status === "Approved").length,
        Rejected: items.filter(r => r.status === "Rejected").length,
        All: items.length,
    };
    const displayed = items
        .filter(r => tab === "All" || r.status === tab)
        .sort((a, b) => (b.submittedAt || b.date || "").localeCompare(a.submittedAt || a.date || ""));

    const openModal = (type: "details" | "approve" | "reject", resp: AdditionalResponsibility) => {
        setReason("");
        setModal({ type, resp });
    };

    const handleDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal || modal.type === "details") return;
        setIsSaving(true);
        await approveAdditionalResponsibility(modal.resp.id, modal.type === "approve" ? "Approved" : "Rejected", reason.trim() || undefined);
        await load();
        setIsSaving(false);
        setModal(null);
    };

    const statusClass = (status: string) =>
        status === "Pending" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
            status === "Approved" ? "text-green-400 bg-green-500/10 border-green-500/20" :
                "text-red-400 bg-red-500/10 border-red-500/20";

    const modalResp = modal ? (items.find(r => r.id === modal.resp.id) || modal.resp) : null;
    // Nobody gives the final decision on a request they submitted themselves
    const canDecide = (r: AdditionalResponsibility) => r.status === "Pending" && r.addedBy !== user.id;

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><Award size={20} className="text-primary" /> Responsibility Approvals</h1>
                <p className="text-xs text-zinc-400 mt-1">Responsibilities submitted for approval. A responsibility is added to the person&apos;s points only after it is approved.</p>
            </header>

            <div className="flex flex-wrap gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit">
                {(["Pending", "Approved", "Rejected", "All"] as StatusTab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", tab === t ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}>
                        {t} ({counts[t]})
                    </button>
                ))}
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white">{tab === "All" ? "All Requests & History" : `${tab} Requests`}</h3>
                </div>
                <div className="divide-y divide-zinc-800/50">
                    {loading ? (
                        <div className="p-12 text-center text-xs text-zinc-500 italic">Loading...</div>
                    ) : displayed.length === 0 ? (
                        <div className="p-12 text-center text-xs text-zinc-500 italic">No responsibility requests found.</div>
                    ) : displayed.map(r => (
                        <div key={r.id} className="p-5 flex items-start gap-4 hover:bg-zinc-800/20 transition-colors">
                            <div className="mt-0.5">
                                {r.status === "Pending" ? <Clock size={16} className="text-amber-500" /> :
                                    r.status === "Approved" ? <CheckCircle2 size={16} className="text-green-500" /> :
                                        <XCircle size={16} className="text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-bold text-white truncate" title={r.employeeName}>{r.employeeName} <span className="text-[10px] font-mono font-normal text-zinc-500">· {r.employeeId}</span></h4>
                                        <p className="text-[10px] text-zinc-500">Submitted by <span className="text-zinc-300">{submittedBy(r)}</span>{submitterRole(r) ? ` (${submitterRole(r)})` : ""} · {r.date}</p>
                                        <div className="mt-2 p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                            <p className="text-[11px] text-zinc-300 font-medium leading-relaxed break-words">
                                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">Responsibility:</span>
                                                {r.description}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mt-1">Points: <span className="text-primary font-bold">+{r.points}</span></p>
                                        {r.status === "Rejected" && r.rejectionReason && <p className="text-[10px] text-amber-500/80 italic mt-1 line-clamp-2">Reason: {r.rejectionReason}</p>}
                                    </div>
                                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full border whitespace-nowrap shrink-0", statusClass(r.status))}>{r.status}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {canDecide(r) && (
                                        <>
                                            <button onClick={() => openModal("approve", r)} className="px-4 py-1.5 text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">Approve</button>
                                            <button onClick={() => openModal("reject", r)} className="px-4 py-1.5 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Reject</button>
                                        </>
                                    )}
                                    <button onClick={() => openModal("details", r)} className="px-4 py-1.5 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"><Eye size={12} /> View Details</button>
                                    {r.status === "Pending" && r.addedBy === user.id && <span className="text-[10px] text-zinc-500 italic self-center">Submitted by you — another AD or a Founder has to decide.</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Approve / Reject confirmation */}
            {modal && modalResp && modal.type !== "details" && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {modal.type === "approve"
                                    ? <><CheckCircle2 size={20} className="text-green-400" /> Approve Responsibility</>
                                    : <><XCircle size={20} className="text-red-400" /> Reject Responsibility</>}
                            </h2>
                            <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleDecision} className="p-6 space-y-5">
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                <p className="text-sm text-white font-bold">{modalResp.employeeName}</p>
                                <p className="text-xs text-zinc-400 mt-1 break-words">{modalResp.description}</p>
                                <p className="text-xs text-zinc-500 mt-2">+{modalResp.points} points · Submitted by {submittedBy(modalResp)}</p>
                                <p className="text-[10px] text-amber-500 mt-2">
                                    {modal.type === "approve"
                                        ? "Once approved, these points are added to the person's total (responsibility points are capped at 100)."
                                        : "A rejected responsibility is not added to the person's points."}
                                </p>
                            </div>
                            {modal.type === "reject" && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reason (optional)</label>
                                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                </div>
                            )}
                            <button type="submit" disabled={isSaving} className={cn("w-full text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50", modal.type === "approve" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500")}>
                                {isSaving ? "Saving..." : modal.type === "approve" ? "Approve Responsibility" : "Reject Responsibility"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Details */}
            {modal && modalResp && modal.type === "details" && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Eye size={20} className="text-primary" /> Responsibility Details</h2>
                            <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-3">
                            {([
                                ["Person", `${modalResp.employeeName} (${modalResp.employeeId})`],
                                ["Designation", getEmployee(modalResp.employeeId)?.designation],
                                ["Responsibility", modalResp.description],
                                ["Points", `+${modalResp.points}`],
                                ["Submitted By", `${submittedBy(modalResp)}${submitterRole(modalResp) ? ` (${submitterRole(modalResp)})` : ""}`],
                                ["Date", modalResp.date],
                                ["Submitted At", fmt(modalResp.submittedAt)],
                                ["Current Status", modalResp.status],
                                [modalResp.status === "Rejected" ? "Rejected By" : "Approved By", modalResp.approvedByName || getEmployee(modalResp.approvedBy)?.name || modalResp.approvedBy],
                                [modalResp.status === "Rejected" ? "Rejected At" : "Approved At", fmt(modalResp.approvedAt)],
                                ["Rejection Reason", modalResp.rejectionReason],
                            ] as [string, string | undefined][]).filter(([, value]) => value).map(([label, value]) => (
                                <div key={label} className="flex justify-between gap-4 text-sm border-b border-zinc-800/50 pb-2">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pt-0.5 shrink-0">{label}</span>
                                    <span className="text-zinc-200 text-right break-words min-w-0">{value}</span>
                                </div>
                            ))}
                            {canDecide(modalResp) && (
                                <div className="flex gap-2 pt-3">
                                    <button onClick={() => openModal("approve", modalResp)} className="flex-1 px-3 py-2 text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">Approve</button>
                                    <button onClick={() => openModal("reject", modalResp)} className="flex-1 px-3 py-2 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Reject</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
