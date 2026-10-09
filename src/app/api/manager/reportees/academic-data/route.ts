import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { SprintPlan, LectureReport } from '@/models/Schemas';
import { resolveManager, academicReportees } from '@/lib/manager-reportees';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const managerId = searchParams.get('managerId');
        const weekStartDate = searchParams.get('weekStartDate');


        // The logged-in manager (see src/lib/manager-reportees.ts)
        const who = await resolveManager(managerId);
        if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status });
        const manager = who.manager;

        // 2. Find all reportees for this manager
        // Logic: Anyone pointing to them in reportsTo (string or array)
        // AND (if HOI) anyone at their same location
        // AND (if AD/FOUNDER) EVERYONE with role FACULTY or PROFESSOR
        const reportees: any[] = await academicReportees(manager);
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