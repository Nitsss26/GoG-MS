"use client";

import LeaveApprovalBoard from "@/components/leave/LeaveApprovalBoard";

/**
 * Manager Suite → Leave Approval. Same board as HR Leave Management; the server limits the data to the
 * manager's reporting hierarchy and only allows the HOI step. Own leave is applied for on Core → Leave.
 */
export default function LeaveApprovalPage() {
    return <LeaveApprovalBoard mode="MANAGER" />;
}