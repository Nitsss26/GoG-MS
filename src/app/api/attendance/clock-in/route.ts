import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, Attendance, WorkSchedule, Location } from '@/models/Schemas';
import { getDistance } from '@/lib/utils';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, lat, lng, imageUrl } = await req.json();

        // 1. Fetch Employee
        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        // 2. Founder Exemption
        if (employee.role === "FOUNDER") {
            return NextResponse.json({ error: "Founders are exempt from clock-in/out" }, { status: 400 });
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        // 3. Fetch Work Schedule
        let schedule = await WorkSchedule.findOne({ employeeId, date: today, status: "Approved" });
        if (!schedule) {
            // Default schedule if none exists (fallback)
            schedule = {
                clockInTime: "09:30",
                location: employee.location || "bhopal"
            } as any;
        }

        const [schedHours, schedMins] = (schedule?.clockInTime || "09:30").split(':').map(Number);
        const schedTime = schedHours * 60 + schedMins;

        // 4. Strict Timing Check (Must be before scheduled time)
        if (currentTime > schedTime) {
            // Auto-mark as On Leave if not already clocked in and time passed
            await Attendance.findOneAndUpdate(
                { employeeId, date: today },
                { status: "On Leave", flags: { late: true } },
                { upsert: true }
            );
            return NextResponse.json({ error: "Clock-in time has passed. You are marked as On Leave. Please request 'Mark as Present'." }, { status: 403 });
        }

        // 5. Geofencing Check
        const campus = await Location.findOne({ id: schedule?.location });
        if (!campus) return NextResponse.json({ error: "Assigned campus location not found" }, { status: 404 });

        const distance = getDistance(lat, lng, campus.lat, campus.lng);
        if (distance > (campus.radiusKm || 2)) {
            return NextResponse.json({ error: `Not in geofence of ${campus.name}. Distance: ${distance.toFixed(2)}km` }, { status: 403 });
        }

        // 6. Clock-in
        const attendance = await Attendance.findOneAndUpdate(
            { employeeId, date: today },
            {
                clockIn: now.toTimeString().split(' ')[0],
                location: campus.id,
                status: "Present",
                clockInImageUrl: imageUrl,
                dressCodeStatus: "Pending"
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({ message: "Clock-in successful", attendance });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
