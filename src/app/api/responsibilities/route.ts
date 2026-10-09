import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AdditionalResponsibility, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export const dynamic = 'force-dynamic';

// Who can submit a responsibility, and who can give the final decision on it
const SUBMITTER_ROLES = ["HOI", "AD", "FOUNDER"];
const APPROVER_ROLES = ["AD", "FOUNDER"];
// Roles an HOI manages (same list the HOI portal uses for its reportees)
const HOI_TEAM_ROLES = ["FACULTY", "PROFESSOR", "OM", "MARKETING_TEAM", "TECH_TEAM"];

export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');

        let query = {};
        if (employeeId) query = { employeeId };

        const responsibilities = await AdditionalResponsibility.find(query).sort({ date: -1 });
        return NextResponse.json(responsibilities);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Submit a responsibility for a person. It is always saved as "Pending":
 * it only counts towards the credit calculation after an AD (or Founder) approves it.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!SUBMITTER_ROLES.includes(actor.role)) {
            return NextResponse.json({ error: 'You are not allowed to add a responsibility.' }, { status: 403 });
        }

        const body = await req.json();
        const description = (body.description || "").trim();
        if (!body.employeeId || !description) {
            return NextResponse.json({ error: 'Employee and responsibility description are required' }, { status: 400 });
        }

        const target = await Employee.findOne({ id: body.employeeId });
        if (!target) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        // An HOI can only add a responsibility for their own team
        if (actor.role === "HOI") {
            const managers: string[] = Array.isArray(target.reportsTo) ? target.reportsTo : [];
            const hoiIds = (await Employee.find({ role: "HOI" }).select('id')).map((h: any) => h.id);
            const hasAssignedHOI = managers.some(id => hoiIds.includes(id));
            const sameLocation = !!actor.employee?.location && target.location === actor.employee.location;
            const isMyTeam = HOI_TEAM_ROLES.includes(target.role) && (managers.includes(actor.id) || (!hasAssignedHOI && sameLocation));
            if (!isMyTeam) {
                return NextResponse.json({ error: 'You can only add a responsibility for your own team.' }, { status: 403 });
            }
        }

        const now = new Date();
        const resp = await AdditionalResponsibility.create({
            id: body.id || `AR${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            employeeId: target.id,
            employeeName: target.name,
            description,
            points: Math.min(100, Math.max(0, Number(body.points) || 0)),
            date: body.date || now.toISOString().split("T")[0],
            // Never trusted from the client:
            status: "Pending",
            addedBy: actor.id,
            addedByName: actor.name,
            addedByRole: actor.role,
            submittedAt: now.toISOString()
        });
        return NextResponse.json(resp);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Final decision on a pending responsibility: { id, status: "Approved" | "Rejected", rejectionReason? }
 * Only AD / Founder, and never the person who submitted it.
 */
export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!APPROVER_ROLES.includes(actor.role)) {
            return NextResponse.json({ error: 'Only AD can approve or reject a responsibility.' }, { status: 403 });
        }

        const { id, status, rejectionReason } = await req.json();
        if (!id || (status !== "Approved" && status !== "Rejected")) {
            return NextResponse.json({ error: 'Responsibility id and a valid status (Approved / Rejected) are required' }, { status: 400 });
        }

        const existing = await AdditionalResponsibility.findOne({ id });
        if (!existing) {
            return NextResponse.json({ error: 'Responsibility not found' }, { status: 404 });
        }
        if (existing.status !== "Pending") {
            return NextResponse.json({ error: `This responsibility is already ${existing.status}` }, { status: 409 });
        }
        if (existing.addedBy === actor.id) {
            return NextResponse.json({ error: 'You cannot approve or reject a responsibility you submitted yourself.' }, { status: 403 });
        }

        const updates: any = {
            status,
            approvedBy: actor.id,
            approvedByName: actor.name,
            approvedAt: new Date().toISOString()
        };
        if (status === "Rejected" && rejectionReason) updates.rejectionReason = rejectionReason;

        const resp = await AdditionalResponsibility.findOneAndUpdate({ id }, { $set: updates }, { new: true });
        return NextResponse.json(resp);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
