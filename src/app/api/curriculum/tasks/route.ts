import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { CurriculumTask, Employee, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

/** Who assigns, reviews and verifies professor tasks */
const ASSIGNER_ROLES = ['CURRICULUM_LEAD', 'CURRICULUM_HEAD', 'AD', 'FOUNDER'];
const PROFESSOR_ROLES = ['PROFESSOR', 'FACULTY'];
const PRIORITY: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('facultyId');
        const assignedBy = searchParams.get('assignedBy');
        const status = searchParams.get('status');

        const query: any = {};
        // a professor only sees the tasks given to them
        if (!ASSIGNER_ROLES.includes(actor.role)) query.assignedTo = actor.id;
        else if (facultyId) query.assignedTo = facultyId;
        if (assignedBy) query.assignedBy = assignedBy;
        if (status && status !== "All") query.status = status;

        const tasks = await CurriculumTask.find(query).sort({ createdAt: -1 }).lean();

        return NextResponse.json({ success: true, tasks });
    } catch (error: any) {
        console.error("Curriculum Tasks GET error:", error);
        return NextResponse.json({ error: 'Could not load the tasks.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const { action, taskId, facultyResponse, facultyAttachmentUrl, status, clFeedback } = body;
        const isAssigner = ASSIGNER_ROLES.includes(actor.role);
        const now = new Date().toISOString();

        if (action === "create") {
            if (!isAssigner) return NextResponse.json({ error: 'Only CL, CH, AD or Founder can assign tasks.' }, { status: 403 });
            const title = String(body.title || '').trim().slice(0, 300);
            const description = String(body.description || '').trim().slice(0, 5000);
            const assignedTo = String(body.assignedTo || '').trim();
            if (!title || !description || !assignedTo) {
                return NextResponse.json({ error: "Title, description, and the professor are required" }, { status: 400 });
            }
            // the professor must be a real, active employee
            const prof: any = await Employee.findOne({ id: assignedTo, isRemoved: { $ne: true } }).select('id name role location status').lean();
            if (!prof || !PROFESSOR_ROLES.includes(prof.role)) return NextResponse.json({ error: 'Choose a professor from the list.' }, { status: 400 });
            const deadline = String(body.deadline || '').trim();
            if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || isNaN(Date.parse(`${deadline}T00:00:00Z`)))) return NextResponse.json({ error: 'Enter a valid due date.' }, { status: 400 });
            // campus = the professor's college (from the database)
            const loc: any = prof.location ? await Location.findOne({ $or: [{ id: prof.location }, { name: prof.location }, { shortName: prof.location }] }).select('id name').lean() : null;

            const id = `CT-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
            const task = await CurriculumTask.create({
                id,
                title,
                description,
                assignedBy: actor.id,
                assignedByName: actor.name || actor.role,
                assignedTo: prof.id,
                assignedToName: prof.name,
                campus: loc?.name || prof.location || "",
                priority: PRIORITY[String(body.priority || '').toLowerCase()] || "Medium",
                deadline,
                status: "Pending",
                createdAt: now
            });

            return NextResponse.json({ success: true, task });
        } else if (action === "faculty_respond") {
            const task = await CurriculumTask.findOne({ id: taskId });
            if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
            if (task.assignedTo !== actor.id) return NextResponse.json({ error: 'Only the assigned professor can respond.' }, { status: 403 });

            if (facultyResponse !== undefined) task.facultyResponse = facultyResponse;
            if (facultyAttachmentUrl !== undefined) task.facultyAttachmentUrl = facultyAttachmentUrl;
            if (status && ["In Progress", "Completed"].includes(status)) task.status = status;
            if (status === "Completed") task.completedAt = now;

            await task.save();
            return NextResponse.json({ success: true, task });
        } else if (action === "verify" || action === "close" || action === "request_changes") {
            if (!isAssigner) return NextResponse.json({ error: 'Only CL, CH, AD or Founder can review tasks.' }, { status: 403 });
            const task = await CurriculumTask.findOne({ id: taskId });
            if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

            // Request Changes: back to the professor (In Progress) with the remarks
            task.status = action === "request_changes" ? "In Progress" : "Verified";
            if (clFeedback !== undefined) task.clFeedback = String(clFeedback || '').slice(0, 3000);

            await task.save();
            return NextResponse.json({ success: true, task });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("Curriculum Tasks POST error:", error);
        return NextResponse.json({ error: 'Could not save the task.' }, { status: 500 });
    }
}