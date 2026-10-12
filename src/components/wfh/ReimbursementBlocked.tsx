"use client";

import { ShieldOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/** Shown instead of the Reimbursement pages to the HR Executive role (the API refuses this role too). */
export function useIsHrExecutive() {
    const { user } = useAuth();
    return !!(user as any)?.hrExecutive;
}

export default function ReimbursementBlocked() {
    return (
        <div className="flex items-center justify-center h-[70vh] p-6" data-testid="reimbursement-blocked">
            <div className="max-w-sm text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"><ShieldOff size={20} className="text-red-400" /></div>
                <h2 className="text-base font-bold text-white">Access restricted</h2>
                <p className="text-xs text-zinc-400">Reimbursements are not available for the HR Executive role.</p>
            </div>
        </div>
    );
}
