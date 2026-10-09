import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const employees = await Employee.find({});
        
        // Strip sensitive data for standard users
        const isPrivileged = session.role === "FOUNDER" || session.role === "HR";
        const sanitizedEmployees = employees.map(emp => {
            const data = emp.toObject();
            delete data.password; // NEVER send passwords
            if (!isPrivileged) {
                // Hide bank details from non-HR/Founder
                delete data.bankAccountName;
                delete data.bankAccountNumber;
                delete data.ifscCode;
                delete data.upiId;
            }
            return data;
        });

        return NextResponse.json(sanitizedEmployees);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const data = await request.json();
        const { id, ...updates } = data;
        // Passwords are changed only through Change Password or HR → Reset Password (both store a hash)
        delete updates.password;
        delete updates.passwordChangedAt; delete updates.passwordResetAt; delete updates.passwordResetBy; delete updates.passwordResetByName;

        // Who may change what: HR / Founder any employee; everyone else only their own profile
        // (never role, college, reporting line or status), plus manager ratings of others.
        const isHrOrFounder = session.role === "HR" || session.role === "FOUNDER";
        if (!isHrOrFounder) {
            const actor: any = await Employee.findOne({ $or: [{ email: session.email }, { id: session.userId }] }).select('id').lean();
            const isSelf = actor?.id === id;
            const PROTECTED = ["role", "location", "reportsTo", "status", "isRemoved", "removedAt", "removedBy", "removedByName", "removalSnapshot", "email", "salary", "employeeId", "_id"];
            if (isSelf) {
                PROTECTED.forEach(k => delete updates[k]);
            } else {
                const keys = Object.keys(updates);
                const RATING_ROLES = ["AD", "HOI", "OM", "TL", "CURRICULUM_LEAD", "CURRICULUM_HEAD"];
                if (!RATING_ROLES.includes(session.role) || keys.some(k => k !== "monthlyScores")) {
                    return NextResponse.json({ error: 'You can only update your own profile.' }, { status: 403 });
                }
            }
        }

        if (!id) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        const updatedEmployee = await Employee.findOneAndUpdate(
            { id },
            { $set: updates },
            { new: true }
        );

        if (!updatedEmployee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const result = updatedEmployee.toObject();
        delete result.password;
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only HR / Founder add employees
        if (session.role !== "HR" && session.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can add employees.' }, { status: 403 });
        }

        await dbConnect();
        const data = await request.json();
        delete data.isRemoved;

        // Never store a plain-text password, and never accept a ready-made hash from the browser
        if (data.password) {
            data.password = await hashPassword(String(data.password));
        }
        const newEmployee = await Employee.create(data);
        const created = newEmployee.toObject();
        delete created.password;
        return NextResponse.json(created);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
