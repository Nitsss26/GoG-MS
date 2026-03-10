import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');
        const role = searchParams.get('role');
        const userId = searchParams.get('userId');

        let query: any = {};
        if (date) query.date = date;

        if (role === "FOUNDER" || role === "HR") {
            // See everyone
        } else if (role === "HOI") {
            // HOIs can see all staff profiles except founders
            const subordinates = await Employee.find({ role: { $nin: ["FOUNDER", "HR"] } }).select('id');
            const subIds = subordinates.map(s => s.id);
            query.employeeId = { $in: subIds };
        } else if (role === "AD") {
            // ADs see their reportees
            const subordinates = await Employee.find({ reportsTo: userId }).select('id');
            const subIds = subordinates.map(s => s.id);
            query.employeeId = { $in: subIds };
        } else {
            query.employeeId = userId;
        }

        const attendance = await Attendance.find(query);
        return NextResponse.json(attendance);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
