import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Location } from "@/models/Schemas";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await dbConnect();
        const location = await Location.findOne({ id });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await dbConnect();
        const body = await request.json();
        const location = await Location.findOneAndUpdate({ id }, body, { new: true });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json(location);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await dbConnect();
        const location = await Location.findOneAndDelete({ id });
        if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
        return NextResponse.json({ message: "Location deleted successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
