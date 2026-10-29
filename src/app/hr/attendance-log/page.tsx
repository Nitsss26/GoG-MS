"use client";
import { Suspense } from "react";
import AttendanceScreen from "@/components/attendance/AttendanceScreen";

/** HR → Attendance Log: full attendance log of all employees (HR, HR Executive, Founder) */
export default function HrAttendanceLogPage() {
    return <Suspense fallback={null}><AttendanceScreen view="hr-log" /></Suspense>;
}