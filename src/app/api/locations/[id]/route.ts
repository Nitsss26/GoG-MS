import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Location } from "@/models/Schemas";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const location = await Location.findOne({ id: params.id });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const body = await request.json();
        const location = await Location.findOneAndUpdate({ id: params.id }, body, { new: true });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const location = await Location.findOneAndDelete({ id: params.id });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json({ message: "Location deleted successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
