import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Ticket } from '@/models/Schemas';
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

        let query = {};
        if (role !== 'HR' && role !== 'FOUNDER' && role !== 'AD' && userId) {
            query = { $or: [{ raisedBy: userId }, { routeTo: userId }, { cc: userId }] };
        }

        const tickets = await Ticket.find(query).sort({ createdAt: -1 });
        return NextResponse.json(tickets);
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

        // Ticket ID Generation Logic
        const getCategoryCode = (cat: string) => {
            if (cat.includes("Attendance Override")) return "AO";
            if (cat.includes("Against HR")) return "GR";
            if (cat.includes("HR Desk")) return "HR";
            if (cat.includes("Misconduct")) return "MI";
            if (cat.includes("Academic")) return "AC";
            if (cat.includes("Technical")) return "TE";
            return "OT";
        };

        const code = getCategoryCode(body.targetCategory);
        const count = await Ticket.countDocuments({ id: { $regex: `^TK-GOG-${code}-` } });
        const ticketId = `TK-GOG-${code}-${String(count + 1).padStart(3, '0')}`;
        
        const ticketData = {
            ...body,
            id: ticketId
        };

        const ticket = await Ticket.create(ticketData);
        return NextResponse.json(ticket);
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
        const ticket = await Ticket.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(ticket);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
