import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        const { employeeId, employeeEmail, currentPassword, newPassword } = await request.json();

        if ((!employeeId && !employeeEmail) || !currentPassword || !newPassword) {
            return NextResponse.json({ success: false, error: "All fields are required" }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ success: false, error: "New password must be at least 8 characters/digits" }, { status: 400 });
        }

        await dbConnect();

        // Use native MongoDB collection directly — bypasses Mongoose schema caching completely
        // This ensures we always get the actual 'password' field as stored in MongoDB
        const db = mongoose.connection.db;
        const collection = db!.collection('employees');

        // Find the employee by id or email
        const query = employeeEmail
            ? { $or: [{ id: employeeId }, { email: employeeEmail }] }
            : { id: employeeId };

        const employee = await collection.findOne(query);

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found in database" }, { status: 404 });
        }

        // Compare entered current password with ACTUAL stored value in MongoDB
        const storedPassword = employee.password;

        if (!storedPassword) {
            // No password field — just set the new one
            await collection.updateOne({ _id: employee._id }, { $set: { password: newPassword } });
            return NextResponse.json({ success: true, message: "Password set successfully" });
        }

        if (currentPassword !== storedPassword) {
            return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });
        }

        // Update the password field in MongoDB
        const result = await collection.updateOne(
            { _id: employee._id },
            { $set: { password: newPassword } }
        );

        if (result.modifiedCount === 0) {
            return NextResponse.json({ success: false, error: "Database update failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
        console.error("Change Password Error:", error);
        return NextResponse.json({ success: false, error: "Server error: " + error.message }, { status: 500 });
    }
}
