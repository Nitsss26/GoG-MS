import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { LeaveRequest } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

export async function GET(req: Request) {
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
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const role = searchParams.get('role');

        let query: any = {};
        if (role !== 'HR' && role !== 'FOUNDER' && userId) {
            if (role === 'HOI') {
                query = { 
                    $or: [
                        { employeeId: userId },
                        { status: "Pending HOI Approval" }
                    ]
                };
            } else {
                query = { employeeId: userId };
            }
        }

        const leaves = await LeaveRequest.find(query).sort({ appliedAt: -1 });
        return NextResponse.json(leaves);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
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
        const body = await req.json();
        const leave = await LeaveRequest.create(body);
        return NextResponse.json(leave);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
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
        const body = await req.json();
        const { id, ...updates } = body;
        const leave = await LeaveRequest.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(leave);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
