import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, Attendance, OverrideRequest } from '@/models/Schemas';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, requestedBy, date, reason, proofUrls } = await req.json();

        const targetEmployee = await Employee.findOne({ id: employeeId });
        if (!targetEmployee) return NextResponse.json({ error: "Target employee not found" }, { status: 404 });

        const request = await OverrideRequest.create({
            employeeId,
            requestedBy,
            date,
            reason,
            proofUrls,
            status: "Pending",
            createdAt: new Date().toISOString()
        });

        return NextResponse.json({ message: "Override request raised", request });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const role = searchParams.get('role');
        const userId = searchParams.get('userId');

        let query = {};
        if (role === "FOUNDER" || role === "HR") {
            query = {}; // Admins see all
        } else {
            // Managers see requests they raised or for their subordinates
            const subordinates = await Employee.find({ reportsTo: userId }).select('id');
            const subIds = subordinates.map(s => s.id);
            query = { $or: [{ requestedBy: userId }, { employeeId: { $in: subIds } }] };
        }

        const requests = await OverrideRequest.find(query).sort({ createdAt: -1 });
        return NextResponse.json(requests);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const { requestId, status, approverId, approverRole } = await req.json();

        const request = await OverrideRequest.findById(requestId);
        if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

        request.status = status;
        request.approvals.push({
            role: approverRole,
            approverId,
            status,
            date: new Date().toISOString()
        });

        if (status === "Approved") {
            // Mark attendance as overridden
            await Attendance.findOneAndUpdate(
                { employeeId: request.employeeId, date: request.date },
                {
                    status: "Present",
                    "flags.overridden": true,
                    isApprovedByHR: true
                },
                { upsert: true }
            );
        }

        await request.save();
        return NextResponse.json({ message: `Override request ${status}`, request });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
