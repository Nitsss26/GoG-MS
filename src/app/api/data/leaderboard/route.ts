import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

// We can just use raw mongoose query if models aren't perfectly aligned, but we have schemas.
import Employee from "@/models/Employee";
import { Attendance, PerformanceStar, AdditionalResponsibility } from "@/models/Schemas";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();

        // Fetch the data required for the leaderboard
        const employees = await Employee.find({ role: { $in: ["OM", "PROFESSOR", "FACULTY"] } }).lean();
        const performanceStars = await PerformanceStar.find({}).lean();

        // Let's get attendance records for the current and previous month to calculate flags
        const attendanceRecords = await Attendance.find({}).lean();

        const additionalResponsibilities = await AdditionalResponsibility.find({ status: "Approved" }).lean();

        // Return the required mapping
        return NextResponse.json({
            success: true,
            data: {
                employees,
                performanceStars,
                attendanceRecords,
                additionalResponsibilities
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
