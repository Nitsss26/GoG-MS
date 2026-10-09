"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/context/AuthContext";

/**
 * Confirmation dialog for HR → "Remove from Portal".
 * Nothing is removed until HR presses "Confirm Removal".
 */
export default function RemoveEmployeeDialog({ employee, onClose, onRemoved }: { employee: Employee; onClose: () => void; onRemoved?: (employee: Employee) => void }) {
    const { removeEmployee } = useAuth();
    const [isRemoving, setIsRemoving] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const handleConfirm = async () => {
        setIsRemoving(true);
        setError("");
        const result = await removeEmployee(employee.id);
        setIsRemoving(false);
        if (result.success) {
            setDone(true);
            onRemoved?.(employee);
        } else {
            setError(result.msg || "Could not remove the employee. Please try again.");
        }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <AlertTriangle size={20} className="text-red-400" /> Remove from Portal
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
                </div>

                {done ? (
                    <div className="p-6 space-y-5">
                        <p className="text-sm text-green-400 font-bold">Employee successfully removed from the portal.</p>
                        <p className="text-xs text-zinc-400">{employee.name} can no longer log in and no longer appears in any active list.</p>
                        <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-700 transition-all">Close</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-5">
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                            <p className="text-sm text-white font-bold break-words">{employee.name}</p>
                            <p className="text-xs text-zinc-500">{employee.id} • {employee.role}{employee.designation ? ` • ${employee.designation}` : ""}</p>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Are you sure you want to remove <span className="font-bold text-white">{employee.name}</span> from the portal?
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            This employee will lose access to the portal and their associated account will be removed.
                            Past records (attendance, decided leaves, reports) are kept for the organisation&apos;s history.
                        </p>
                        {error && <p className="text-xs text-red-400">{error}</p>}
                        <div className="flex gap-3">
                            <button onClick={onClose} disabled={isRemoving} className="flex-1 px-4 py-3 text-sm font-bold text-zinc-300 border border-zinc-700 rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50">Cancel</button>
                            <button onClick={handleConfirm} disabled={isRemoving} className="flex-1 px-4 py-3 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all disabled:opacity-50">
                                {isRemoving ? "Removing..." : "Confirm Removal"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
