import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Location, Employee, WorkSchedule, Holiday } from "@/models/Schemas";
import { getSessionUser } from "@/lib/session-user";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await dbConnect();
        const location = await Location.findOne({ id });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await dbConnect();
        const body = await request.json();
        const location = await Location.findOneAndUpdate({ id }, body, { new: true });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await dbConnect();
        // HR / HR Executive / Founder only
        const actor: any = await getSessionUser().catch(() => null);
        if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!["HR", "FOUNDER"].includes(actor.role)) return NextResponse.json({ error: "Only HR or Founders can delete a location." }, { status: 403 });
        const loc: any = await Location.findOne({ id }).lean();
        if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });

        // A location still in use cannot be deleted (attendance / clock-in would break): move these first
        const refs = Array.from(new Set([loc.id, loc.name, loc.shortName].filter(Boolean)));
        const todayIst = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
        const [homeEmps, clockInEmps, schedules, holidays]: any[] = await Promise.all([
            Employee.find({ location: { $in: refs }, isRemoved: { $ne: true } }).select("id name").lean(),
            Employee.find({ attendanceLocations: { $in: refs }, isRemoved: { $ne: true } }).select("id name").lean(),
            WorkSchedule.find({ location: { $in: refs }, $or: [{ date: { $gte: todayIst } }, { date: { $in: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] } }] }).select("employeeId").lean(),
            Holiday.find({ collegeIds: { $in: refs }, date: { $gte: todayIst }, status: { $ne: "Rejected" } }).select("name date").lean(),
        ]);
        const scheduleEmps = Array.from(new Set((schedules as any[]).map(s => s.employeeId)));
        const uses: string[] = [];
        const names = (l: any[]) => l.slice(0, 5).map(e => e.name || e.id).join(", ") + (l.length > 5 ? ` +${l.length - 5} more` : "");
        if (homeEmps.length) uses.push(`${homeEmps.length} employee(s) have it as their location (${names(homeEmps)})`);
        if (clockInEmps.length) uses.push(`${clockInEmps.length} HOI / OM have it as a clock-in location (${names(clockInEmps)})`);
        if (scheduleEmps.length) uses.push(`${scheduleEmps.length} employee(s) have it in their work schedule`);
        if (holidays.length) uses.push(`${holidays.length} upcoming holiday(s) are set for it`);
        if (uses.length) {
            return NextResponse.json({ error: `${loc.shortName || loc.name} is still in use and cannot be deleted: ${uses.join("; ")}. Move them to another location in Work Location first.`, inUse: uses }, { status: 409 });
        }
        await Location.deleteOne({ id });
        return NextResponse.json({ message: "Location deleted successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}