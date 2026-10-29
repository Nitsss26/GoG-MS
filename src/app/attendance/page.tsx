"use client";
import { Suspense } from "react";
import AttendanceScreen from "@/components/attendance/AttendanceScreen";

/** Attendance: own clock-in / log / alerts (team sections for managers; HR's full log is HR → Attendance Log) */
export default function AttendancePage() {
    return <Suspense fallback={null}><AttendanceScreen view="default" /></Suspense>;
}