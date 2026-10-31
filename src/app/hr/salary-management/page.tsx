"use client";

import { useAuth } from "@/context/AuthContext";
import SalaryAdmin from "@/components/salary/SalaryAdmin";

/** HR Administration → Employee Salary Management (HR, HR Executive: manage · Founders: view only) */
export default function SalaryManagementPage() {
    const { user } = useAuth();
    if (!user) return null;
    if (user.role !== "HR" && user.role !== "FOUNDER") return <div className="p-8 text-center text-sm text-zinc-500">Only HR, HR Executive and Founders can open Employee Salary Management.</div>;
    return <SalaryAdmin />;
}