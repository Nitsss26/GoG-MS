import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, MarkAsPresentRequest, Attendance } from '@/models/Schemas';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { employeeId, date, reason, proofUrls, requestType } = await req.json();

        const employee = await Employee.findOne({ id: employeeId });
        if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        if (employee.chancesRemaining <= 0) {
            return NextResponse.json({ error: "No credits remaining for 'Mark as Present' requests." }, { status: 403 });
        }

        const request = await MarkAsPresentRequest.create({
            employeeId,
            date,
            reason,
            proofUrls,
            requestType,
            status: "Pending",
            createdAt: new Date().toISOString()
        });

        // Deduct credit
        employee.chancesRemaining -= 1;
        await employee.save();

        return NextResponse.json({ message: "Request raised successfully", request });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const role = searchParams.get('role');
        const employeeId = searchParams.get('employeeId');

        let query = {};
        if (role === "FOUNDER" || role === "HR") {
            query = {}; // HR/Founder see all
        } else if (role === "AD" || role === "HOI") {
            // Managers see their reportees
            const subordinates = await Employee.find({ reportsTo: employeeId }).select('id');
            const subIds = subordinates.map(s => s.id);
            query = { employeeId: { $in: subIds } };
        } else {
            query = { employeeId };
        }

        const requests = await MarkAsPresentRequest.find(query).sort({ createdAt: -1 });
        return NextResponse.json(requests);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await dbConnect();
        const { requestId, status, approverId, approverRole, requestType } = await req.json();

        const request = await MarkAsPresentRequest.findById(requestId);
        if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

        request.status = status;
        request.approvals.push({
            role: approverRole,
            approverId,
            status,
            date: new Date().toISOString()
        });

        if (status === "Approved") {
            const finalRequestType = requestType || request.requestType || "";
            const isLate = finalRequestType.toLowerCase().includes("late");
            const isLocation = finalRequestType.toLowerCase().includes("location");

            // Update attendance
            await Attendance.findOneAndUpdate(
                { employeeId: request.employeeId, date: request.date },
                {
                    status: "Present",
                    flags: { 
                        late: !!isLate,
                        locationDiff: !!isLocation
                    },
                    isApprovedByHR: true
                },
                { upsert: true }
            );
        }

        await request.save();
        return NextResponse.json({ message: `Request ${status}`, request });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
