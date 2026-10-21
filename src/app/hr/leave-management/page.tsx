"use client";

import LeaveApprovalBoard from "@/components/leave/LeaveApprovalBoard";

/** HR Administration → Leave Management (HR / Founder: every employee, final decision) */
export default function HRLeaveManagementPage() {
    return <LeaveApprovalBoard mode="HR" />;
}