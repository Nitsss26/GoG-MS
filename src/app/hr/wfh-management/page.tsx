"use client";

import { Home } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import WfhApprovalBoard from "@/components/wfh/WfhApprovalBoard";

/** HR Administration → WFH Management: all Work From Home applications (HR, HR Executive, Founder) */
export default function HRWfhManagementPage() {
    const { user } = useAuth();
    if (!user) return null;
    if (user.role !== "HR" && user.role !== "FOUNDER") return <div className="p-8 text-center text-sm text-zinc-500">Only HR and HR Executive can open WFH Management.</div>;
    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full" data-testid="wfh-management">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"><Home size={26} className="text-primary" /> WFH Management</h1>
                <p className="text-zinc-500 mt-1">Review, approve or reject Work From Home applications. Pending applications are listed first.</p>
            </div>
            <WfhApprovalBoard />
        </div>
    );
}