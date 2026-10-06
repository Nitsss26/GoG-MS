import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan, Employee, WorkSchedule } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const weekStartDate = searchParams.get('weekStartDate');
        const campus = searchParams.get('campus');
        const facultyId = searchParams.get('facultyId');

        const query: any = {};
        if (weekStartDate) query.weekStartDate = weekStartDate;
        if (facultyId) query.facultyId = facultyId;

        // Fetch sprint plans
        const plans = await SprintPlan.find(query).sort({ weekStartDate: -1 }).lean();

        // Fetch faculties for campus mapping
        const faculties = await Employee.find({
            role: { $in: ["FACULTY", "PROFESSOR"] }
        }).select('id name location designation dept').lean();

        const facultyMap = new Map<string, any>();
        faculties.forEach(f => facultyMap.set(f.id, f));

        // Flatten entries for the campus timetable grid
        const allEntries: any[] = [];
        plans.forEach((plan: any) => {
            const fac = facultyMap.get(plan.facultyId);
            const planCollege = plan.college || fac?.location || "Main Campus";

            // If campus filter passed, check match
            if (campus && campus !== "All") {
                const normReq = campus.toLowerCase().replace(/[^a-z0-9]/g, "");
                const normPlan = planCollege.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (!normPlan.includes(normReq) && !normReq.includes(normPlan)) {
                    return;
                }
            }

            if (plan.entries && Array.isArray(plan.entries)) {
                plan.entries.forEach((e: any) => {
                    allEntries.push({
                        ...e,
                        facultyId: plan.facultyId,
                        facultyName: plan.facultyName || fac?.name || "Professor",
                        college: planCollege,
                        location: planCollege,
                        isLocked: plan.isLocked,
                        isVerifiedByCL: plan.isVerifiedByCL,
                        clRemarks: plan.clRemarks
                    });
                });
            }
        });

        return NextResponse.json({
            success: true,
            plans,
            allEntries,
            faculties
        });
    } catch (error: any) {
        console.error("Curriculum Sprint Plan GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { planId, campus, weekStartDate, action, clId, clName, clRemarks } = body;

        const now = new Date().toISOString();

        if (action === "verify" || action === "lock") {
            const updateFields: any = {
                isVerifiedByCL: true,
                verifiedBy: clId,
                verifiedByName: clName,
                verifiedAt: now
            };
            if (clRemarks) updateFields.clRemarks = clRemarks;
            if (action === "lock") {
                updateFields.isLocked = true;
                updateFields.lockedAt = now;
                updateFields.lockedBy = clName || clId;
            }

            if (planId) {
                const updated = await SprintPlan.findByIdAndUpdate(planId, { $set: updateFields }, { new: true });
                return NextResponse.json({ success: true, plan: updated });
            } else if (campus && weekStartDate) {
                // Bulk verify/lock for the whole campus
                const result = await SprintPlan.updateMany(
                    {
                        weekStartDate,
                        college: { $regex: new RegExp(campus.trim(), 'i') }
                    },
                    { $set: updateFields }
                );
                return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
            }
        } else if (action === "unlock") {
            const updateFields = {
                isLocked: false,
                lockedAt: null,
                lockedBy: null
            };
            if (planId) {
                const updated = await SprintPlan.findByIdAndUpdate(planId, { $set: updateFields }, { new: true });
                return NextResponse.json({ success: true, plan: updated });
            } else if (campus && weekStartDate) {
                const result = await SprintPlan.updateMany(
                    {
                        weekStartDate,
                        college: { $regex: new RegExp(campus.trim(), 'i') }
                    },
                    { $set: updateFields }
                );
                return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
            }
        }

        return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
    } catch (error: any) {
        console.error("Curriculum Sprint Plan POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
