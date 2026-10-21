import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import { verifyPassword, storedPasswordValue } from '@/lib/password';

export async function POST(request: Request) {
    try {
        const { employeeId, employeeEmail, currentPassword, newPassword } = await request.json();

        if ((!employeeId && !employeeEmail) || !currentPassword || !newPassword) {
            return NextResponse.json({ success: false, error: "All fields are required" }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ success: false, error: "New password must be at least 8 characters/digits" }, { status: 400 });
        }

        // Only the logged-in user can change their own password
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        const session = sessionCookie?.value ? verifySessionToken(sessionCookie.value) : null;
        if (!session) {
            return NextResponse.json({ success: false, error: "Please log in again." }, { status: 401 });
        }

        await dbConnect();

        // Use native MongoDB collection directly — bypasses Mongoose schema caching completely
        // This ensures we always get the actual 'password' field as stored in MongoDB
        const db = mongoose.connection.db;
        const collection = db!.collection('employees');

        // The logged-in record (this designation); one email may hold several designation records
        const query = employeeId
            ? { id: employeeId, isRemoved: { $ne: true } }
            : { email: employeeEmail, role: session.role, isRemoved: { $ne: true } };

        const employee = await collection.findOne(query);

        if (!employee) {
            return NextResponse.json({ success: false, error: "Employee not found in database" }, { status: 404 });
        }

        const sessionMatches =
            String(employee._id) === String(session.userId) ||
            employee.id === session.userId ||
            (String(employee.email || '').toLowerCase() === String(session.email || '').toLowerCase() && employee.role === session.role);
        if (!sessionMatches) {
            return NextResponse.json({ success: false, error: "You can only change your own password." }, { status: 403 });
        }

        // Compare the entered current password with the stored value (hash, or plain text for older accounts).
        // No password field means the old default "26082001" applies, same as login.
        const check = await verifyPassword(String(currentPassword), employee.password || "26082001");
        if (!check.ok) {
            return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });
        }

        // Saved as plain text (as in the original portal). One login identity per email: every designation record of this person changes.
        const escaped = String(employee.email || '').replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        const result = await collection.updateMany(
            { email: { $regex: new RegExp(`^${escaped}$`, 'i') }, isRemoved: { $ne: true } },
            { $set: { password: storedPasswordValue(String(newPassword)), passwordChangedAt: new Date().toISOString() } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ success: false, error: "Database update failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
        console.error("Change Password Error:", error?.message);
        return NextResponse.json({ success: false, error: "Server error. Please try again." }, { status: 500 });
    }
}