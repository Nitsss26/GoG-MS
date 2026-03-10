import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';

export async function POST(request: Request) {
    try {
        const { email, password, role } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
        }

        await dbConnect();

        const employee = await Employee.findOne({ email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Institutional account not found." }, { status: 404 });
        }

        // Check password against database value (default is "26082001" if not set)
        const storedPassword = employee.password || "26082001";
        if (password !== storedPassword) {
            return NextResponse.json({ success: false, error: "Incorrect passkey." }, { status: 401 });
        }

        // Check role if provided
        if (role && employee.role !== role) {
            return NextResponse.json({ success: false, error: `Institutional role mismatch.` }, { status: 403 });
        }

        return NextResponse.json({ success: true, employee: employee.toObject() });
    } catch (error: any) {
        console.error("Login Error:", error);
        return NextResponse.json({ success: false, error: "Server error. Please try again." }, { status: 500 });
    }
}
