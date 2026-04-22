import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { SprintPlan, LectureReport, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const managerId = searchParams.get('managerId');
        const weekStartDate = searchParams.get('weekStartDate');

        if (!managerId) return NextResponse.json({ error: "managerId required" }, { status: 400 });

        // 1. Find the manager to check their role and location
        const manager = await Employee.findOne({ id: managerId });
        if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

        // 2. Find all reportees for this manager
        // Logic: Anyone pointing to them in reportsTo (string or array)
        // AND (if HOI) anyone at their same location
        // AND (if AD/FOUNDER) EVERYONE with role FACULTY or PROFESSOR
        let reportees;

        if (["AD", "FOUNDER"].includes(manager.role)) {
            reportees = await Employee.find({ role: { $in: ["FACULTY", "PROFESSOR"] } });
        } else {
            const matchingConditions: any[] = [
                { reportsTo: managerId },
                { reportsTo: { $in: [managerId] } }
            ];

            // If manager is an HOI, also include everyone at their location
            if (manager.role === "HOI" && manager.location) {
                matchingConditions.push({ location: manager.location });
            }

            reportees = await Employee.find({ $or: matchingConditions });
        }
        const reporteeIds = reportees.map(r => r.id);

        if (reporteeIds.length === 0) {
            return NextResponse.json({ plans: [], reports: [], reportees: [] });
        }

        // 2. Fetch Sprint Plans for these reportees
        const planQuery: any = { facultyId: { $in: reporteeIds } };
        if (weekStartDate) planQuery.weekStartDate = weekStartDate;
        const plans = await SprintPlan.find(planQuery).sort({ weekStartDate: -1 });

        // 3. Fetch Lecture Reports for these reportees (last 7 days or specified week)
        const reportQuery: any = { facultyId: { $in: reporteeIds } };
        if (weekStartDate) {
            reportQuery.date = { $gte: weekStartDate };
        }
        const reports = await LectureReport.find(reportQuery).sort({ date: -1, lectureNumber: 1 });

        return NextResponse.json({ 
            plans, 
            reports, 
            reportees: reportees.map(r => ({ id: r.id, name: r.name, dept: r.dept, designation: r.designation, role: r.role }))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
