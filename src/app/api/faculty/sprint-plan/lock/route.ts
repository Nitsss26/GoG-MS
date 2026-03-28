import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan } from '@/models/Schemas';

// POST — Lock a sprint plan (auto at 5PM Saturday or manual)
export async function POST(req: Request) {
    try {
        await dbConnect();
        const { facultyId, weekStartDate } = await req.json();

        if (!facultyId || !weekStartDate) {
            return NextResponse.json({ error: "facultyId and weekStartDate required" }, { status: 400 });
        }

        const plan = await SprintPlan.findOne({ facultyId, weekStartDate });
        if (!plan) return NextResponse.json({ error: "Sprint plan not found" }, { status: 404 });
        if (plan.isLocked) return NextResponse.json({ error: "Already locked" }, { status: 400 });

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        plan.isLocked = true;
        plan.lockedAt = istString;
        await plan.save();

        return NextResponse.json({ message: "Sprint plan locked", plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
