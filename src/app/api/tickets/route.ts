import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Ticket } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const role = searchParams.get('role');

        let query = {};
        if (role !== 'HR' && role !== 'FOUNDER' && userId) {
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
        await dbConnect();
        const body = await req.json();
        const ticket = await Ticket.create(body);
        return NextResponse.json(ticket);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const ticket = await Ticket.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(ticket);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
