import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SprintPlan } from '@/models/Schemas';

// POST — Faculty submits change request for locked sprint plan
export async function POST(req: Request) {
    try {
        await dbConnect();
        const { facultyId, weekStartDate, reason, changes } = await req.json();

        if (!facultyId || !weekStartDate || !reason) {
            return NextResponse.json({ error: "facultyId, weekStartDate, reason required" }, { status: 400 });
        }

        const plan = await SprintPlan.findOne({ facultyId, weekStartDate });
        if (!plan) return NextResponse.json({ error: "Sprint plan not found" }, { status: 404 });
        if (!plan.isLocked) return NextResponse.json({ error: "Plan is not locked. Edit directly." }, { status: 400 });

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        plan.changeRequests.push({
            requestedAt: istString,
            reason,
            status: "Pending",
            approvedBy: "",
            approvedAt: "",
            changes: JSON.stringify(changes || {})
        });
        await plan.save();

        return NextResponse.json({ message: "Change request submitted for HOI approval", plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — HOI approves or rejects a change request
export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const { facultyId, weekStartDate, requestIndex, action, approverId } = await req.json();

        if (!facultyId || !weekStartDate || requestIndex === undefined || !action) {
            return NextResponse.json({ error: "facultyId, weekStartDate, requestIndex, action required" }, { status: 400 });
        }

        const plan = await SprintPlan.findOne({ facultyId, weekStartDate });
        if (!plan) return NextResponse.json({ error: "Sprint plan not found" }, { status: 404 });
        if (!plan.changeRequests[requestIndex]) {
            return NextResponse.json({ error: "Change request not found" }, { status: 404 });
        }

        const now = new Date();
        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        plan.changeRequests[requestIndex].status = action === "approve" ? "Approved" : "Rejected";
        plan.changeRequests[requestIndex].approvedBy = approverId || "";
        plan.changeRequests[requestIndex].approvedAt = istString;

        // If approved, apply changes and temporarily unlock
        if (action === "approve") {
            try {
                const changes = JSON.parse(plan.changeRequests[requestIndex].changes || "{}");
                if (changes.entries) {
                    plan.entries = changes.entries;
                }
            } catch { }
            // Temporarily unlock for the faculty to make edits
            plan.isLocked = false;
        }

        await plan.save();
        return NextResponse.json({ message: `Change request ${action}d`, plan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
