import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { FacultyPreference } from "@/models/Schemas";

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get("facultyId");

        if (!facultyId) return NextResponse.json({ error: "Faculty ID required" }, { status: 400 });

        const prefs = await FacultyPreference.findOne({ facultyId });
        return NextResponse.json(prefs || { facultyId, subjects: [], streams: [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { facultyId, subjects, streams } = body;

        if (!facultyId) return NextResponse.json({ error: "Faculty ID required" }, { status: 400 });

        const prefs = await FacultyPreference.findOneAndUpdate(
            { facultyId },
            { $set: { subjects, streams } },
            { upsert: true, new: true }
        );

        return NextResponse.json({ message: "Preferences saved", prefs });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
