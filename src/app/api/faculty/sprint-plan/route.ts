import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { SprintPlan, Employee, WorkSchedule } from '@/models/Schemas';

// GET — Fetch sprint plans for a faculty
export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('facultyId');
        const weekStartDate = searchParams.get('weekStartDate');

        if (!facultyId) return NextResponse.json({ error: "facultyId required" }, { status: 400 });

        const query: any = { facultyId };
        if (weekStartDate) query.weekStartDate = weekStartDate;

        const plans = await SprintPlan.find(query).sort({ weekStartDate: -1 });

        // Fetch WorkSchedule for the given faculty
        let schedules = [];
        if (facultyId) {
            // Find all schedules for the faculty to account for both specific dates and weekdays (Mon, Tue, etc.)
            const weekEntries = await WorkSchedule.find({
                employeeId: facultyId
            }).sort({ date: 1 }).limit(20);
            
            schedules = weekEntries;
        }

        return NextResponse.json({ plans, schedules });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create or update sprint plan
export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { facultyId, weekStartDate, weekEndDate, entries, stream, year } = body;

        if (!facultyId || !weekStartDate || !weekEndDate) {
            return NextResponse.json({ error: "facultyId, weekStartDate, weekEndDate required" }, { status: 400 });
        }

        // Fetch faculty info
        const faculty = await Employee.findOne({ id: facultyId });
        if (!faculty) return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
        if (!["FACULTY", "PROFESSOR"].includes(faculty.role)) {
            return NextResponse.json({ error: "Only FACULTY/PROFESSOR can create sprint plans" }, { status: 403 });
        }

        // Check if plan exists and is locked
        const existing = await SprintPlan.findOne({ facultyId, weekStartDate });
        if (existing?.isLocked) {
            return NextResponse.json({ error: "Sprint plan is locked. Submit a change request for HOI approval." }, { status: 403 });
        }

        // Upsert the sprint plan
        const plan = await SprintPlan.findOneAndUpdate(
            { facultyId, weekStartDate },
            {
                $set: {
                    facultyName: faculty.name,
                    college: faculty.location || "",
                    weekEndDate,
                    stream: stream || "",
                    year: year || "",
                    entries: entries || [],
                    isLocked: false
                }
            },
        );

        return NextResponse.json({ message: "Sprint plan saved successfully", plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
