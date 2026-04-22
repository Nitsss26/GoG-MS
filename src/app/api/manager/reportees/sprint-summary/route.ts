import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const managerId = searchParams.get('managerId');

        if (!managerId) return NextResponse.json({ error: "managerId required" }, { status: 400 });

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istTime = new Date(istString);
        const dayOfWeek = istTime.getDay();
        
        // Determine the Monday that identifies the "Current Week" (the week containing today)
        // If today is Sunday(0), we consider the upcoming Monday as the current week identifier
        // If it's Mon(1) to Sat(6), we go back to the most recent Monday.
        const diffToCurrentMonday = dayOfWeek === 0 ? 1 : (1 - dayOfWeek);
        const currentMonday = new Date(istTime);
        currentMonday.setDate(istTime.getDate() + diffToCurrentMonday);
        
        const nextMonday = new Date(currentMonday);
        nextMonday.setDate(currentMonday.getDate() + 7);

        const formatDate = (d: Date) => d.getFullYear() + "-" +
            (d.getMonth() + 1).toString().padStart(2, '0') + "-" +
            d.getDate().toString().padStart(2, '0');

        const currentMondayStr = formatDate(currentMonday);
        const nextMondayStr = formatDate(nextMonday);

        // Get reportees
        const manager = await Employee.findOne({ id: managerId });
        if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

        let reportees;
        if (["AD", "FOUNDER"].includes(manager.role)) {
            reportees = await Employee.find({ role: { $in: ["FACULTY", "PROFESSOR"] } });
        } else {
            const matchingConditions: any[] = [
                { reportsTo: managerId },
                { reportsTo: { $in: [managerId] } }
            ];
            if (manager.role === "HOI" && manager.location) {
                matchingConditions.push({ location: manager.location });
            }
            reportees = await Employee.find({ $or: matchingConditions });
        }
        const reporteeIds = reportees.map(r => r.id);

        // Find plans for current and next week
        const allPlans = await SprintPlan.find({
            facultyId: { $in: reporteeIds },
            weekStartDate: { $in: [currentMondayStr, nextMondayStr] }
        });

        const summary = reporteeIds.map(id => {
            const currentPlan = allPlans.find(p => p.facultyId === id && p.weekStartDate === currentMondayStr);
            const nextPlan = allPlans.find(p => p.facultyId === id && p.weekStartDate === nextMondayStr);

            return {
                facultyId: id,
                currentWeek: {
                    hasPlan: !!currentPlan,
                    isLocked: currentPlan?.isLocked || false,
                    startDate: currentMondayStr
                },
                nextWeek: {
                    hasPlan: !!nextPlan,
                    isLocked: nextPlan?.isLocked || false,
                    startDate: nextMondayStr
                }
            };
        });

        return NextResponse.json({ 
            summary, 
            currentMonday: currentMondayStr,
            nextMonday: nextMondayStr 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
