import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Location } from "@/models/Schemas";

export async function GET() {
    try {
        await dbConnect();
        const locations = await Location.find({});
        return NextResponse.json(locations);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const location = await Location.create(body);
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
