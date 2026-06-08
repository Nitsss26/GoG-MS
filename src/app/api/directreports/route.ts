import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session || session.role !== "AD") {
            return NextResponse.json({ error: 'Unauthorized. Only AD can create direct reports.' }, { status: 401 });
        }

        await dbConnect();
        const body = await req.json();
        
        if (!body.facultyId || !body.facultyName || !body.recordingUrl) {
             return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const report = new LectureReport({
            facultyId: body.facultyId,
            facultyName: body.facultyName,
            date: new Date().toISOString().split('T')[0],
            college: body.college || "Direct Upload",
            lectureNumber: 1,
            courseName: "Direct AD Report",
            status: "Completed",
            recordingUrl: body.recordingUrl
        });

        await report.save();

        return NextResponse.json({ success: true, reportId: report._id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
