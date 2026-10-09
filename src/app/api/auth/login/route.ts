import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { createSessionToken, getSessionCookieOptions } from '@/lib/session';
import { verifyPassword, hashPassword } from '@/lib/password';

export async function POST(request: Request) {
    try {
        const { email, password, role } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
        }

        await dbConnect();

        // Exact (case-insensitive) email match — typed characters are never treated as a pattern
        const escapedEmail = String(email).trim().replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        const emailPattern = new RegExp('^' + escapedEmail + '$', 'i');
        const employee = await Employee.findOne({ email: { $regex: emailPattern } });

        if (!employee) {
            // Removed from the portal by HR: the account exists only as a historical record and cannot log in
            const removed = await Employee.findOne({ email: { $regex: emailPattern }, isRemoved: true });
            if (removed) {
                return NextResponse.json({ success: false, error: "This account has been removed from the portal." }, { status: 403 });
            }
            return NextResponse.json({ success: false, error: "Institutional account not found." }, { status: 404 });
        }

        // Check password against the stored value: a secure hash, or (older accounts) plain text.
        // Default is "26082001" if no password was ever set, same as before.
        const storedPassword = employee.password || "26082001";
        const check = await verifyPassword(String(password), storedPassword);
        if (!check.ok) {
            return NextResponse.json({ success: false, error: "Incorrect passkey." }, { status: 401 });
        }

        // Check role if provided
        if (role && employee.role !== role) {
            return NextResponse.json({ success: false, error: `Institutional role mismatch.` }, { status: 403 });
        }

        // Older account with a plain-text password: replace it with a hash now that we know it is correct
        if (check.needsRehash) {
            try {
                await Employee.updateOne({ _id: employee._id }, { $set: { password: await hashPassword(String(password)) } });
            } catch (e) {
                console.error("Login: could not upgrade stored password to a hash");
            }
        }

        // Create session token and set HTTP-only cookie
        const employeeData = employee.toObject();
        const userId = employeeData.employeeId || employeeData._id?.toString() || employeeData.id;
        const token = createSessionToken(userId, employeeData.email, employeeData.role);

        const cookieOptions = getSessionCookieOptions();
        const cookieStore = await cookies();
        cookieStore.set(cookieOptions.name, token, {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            path: cookieOptions.path,
            maxAge: cookieOptions.maxAge,
        });

        // Return sanitized employee data — NEVER include password in response
        const sanitizedEmployee = { ...employeeData };
        delete sanitizedEmployee.password;

        return NextResponse.json({ success: true, employee: sanitizedEmployee });
    } catch (error: any) {
        console.error("Login Error:", error);
        return NextResponse.json({ success: false, error: "Server error. Please try again." }, { status: 500 });
    }
}
