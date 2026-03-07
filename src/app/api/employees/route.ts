import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Employee from "@/models/Employee";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        const employees = await Employee.find({}).lean();
        return NextResponse.json({ success: true, data: employees });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
