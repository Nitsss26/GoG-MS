import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Attendance, Employee } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
export async function DELETE(req: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session || (session.role !== "FOUNDER" && session.role !== "HR")) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const { employeeId, date } = await req.json();
        await Attendance.findOneAndDelete({ employeeId, date });
        return NextResponse.json({ message: "Record deleted" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
