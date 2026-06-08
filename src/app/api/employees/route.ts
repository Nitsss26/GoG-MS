import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

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

        return NextResponse.json(updatedEmployee);
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

        await dbConnect();
        const data = await request.json();
        
        const newEmployee = await Employee.create(data);
        return NextResponse.json(newEmployee);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
