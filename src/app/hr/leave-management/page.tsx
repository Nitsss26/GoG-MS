"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Home } from "lucide-react";
import LeaveApprovalBoard from "@/components/leave/LeaveApprovalBoard";
import WfhApprovalBoard from "@/components/wfh/WfhApprovalBoard";
import { cn } from "@/lib/utils";

/**
 * HR Administration → Leave Management (HR / Founder: every employee, final decision).
 * Two separate sections: Leave Applications (unchanged) | Work From Home Applications.
 */
export default function HRLeaveManagementPage() {
    const [tab, setTab] = useState<"leave" | "wfh">("leave");
    useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "wfh") setTab("wfh"); }, []);
    return (
        <div>
            <div className="px-4 sm:px-6 pt-6 max-w-7xl mx-auto w-full">
                <div className="flex gap-1 bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-1 w-fit" data-testid="leave-mgmt-tabs">
                    <button onClick={() => setTab("leave")} data-testid="tab-leave" className={cn("px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all", tab === "leave" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><CalendarCheck size={12} /> Leave Applications</button>
                    <button onClick={() => setTab("wfh")} data-testid="tab-wfh" className={cn("px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all", tab === "wfh" ? "bg-primary/10 text-primary" : "text-zinc-500 hover:text-white")}><Home size={12} /> Work From Home Applications</button>
                </div>
            </div>
            {tab === "leave" ? <LeaveApprovalBoard mode="HR" /> : (
                <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><Home size={18} className="text-emerald-400" /> Work From Home Applications</h1>
                        <p className="text-xs text-zinc-400 mt-1">Review, approve or reject Work From Home requests. Approved days are remote working days — not leave.</p>
                    </div>
                    <WfhApprovalBoard />
                </div>
            )}
        </div>
    );
}