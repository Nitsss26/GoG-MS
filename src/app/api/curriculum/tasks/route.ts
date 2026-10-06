import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { CurriculumTask, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('facultyId');
        const assignedBy = searchParams.get('assignedBy');
        const status = searchParams.get('status');

        const query: any = {};
        if (facultyId) query.assignedTo = facultyId;
        if (assignedBy) query.assignedBy = assignedBy;
        if (status && status !== "All") query.status = status;

        const tasks = await CurriculumTask.find(query).sort({ createdAt: -1 }).lean();

        return NextResponse.json({ success: true, tasks });
    } catch (error: any) {
        console.error("Curriculum Tasks GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const {
            action,
            taskId,
            title,
            description,
            assignedBy,
            assignedByName,
            assignedTo,
            assignedToName,
            campus,
            priority,
            deadline,
            facultyResponse,
            facultyAttachmentUrl,
            status,
            clFeedback
        } = body;

        const now = new Date().toISOString();

        if (action === "create") {
            if (!title || !description || !assignedTo) {
                return NextResponse.json({ error: "Title, description, and assigned faculty are required" }, { status: 400 });
            }

            const id = `CT-${Date.now().toString().slice(-6)}`;
            const task = await CurriculumTask.create({
                id,
                title,
                description,
                assignedBy,
                assignedByName: assignedByName || "Curriculum Lead",
                assignedTo,
                assignedToName: assignedToName || "Professor",
                campus: campus || "",
                priority: priority || "Medium",
                deadline: deadline || "",
                status: "Pending",
                createdAt: now
            });

            return NextResponse.json({ success: true, task });
        } else if (action === "faculty_respond") {
            const task = await CurriculumTask.findOne({ id: taskId });
            if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

            if (facultyResponse !== undefined) task.facultyResponse = facultyResponse;
            if (facultyAttachmentUrl !== undefined) task.facultyAttachmentUrl = facultyAttachmentUrl;
            if (status) task.status = status;
            if (status === "Completed") task.completedAt = now;

            await task.save();
            return NextResponse.json({ success: true, task });
        } else if (action === "verify" || action === "close") {
            const task = await CurriculumTask.findOne({ id: taskId });
            if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

            task.status = "Verified";
            if (clFeedback) task.clFeedback = clFeedback;

            await task.save();
            return NextResponse.json({ success: true, task });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("Curriculum Tasks POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
