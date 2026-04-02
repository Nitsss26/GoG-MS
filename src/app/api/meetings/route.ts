import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { MeetingRequest } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const meetings = await MeetingRequest.find({}).sort({ createdAt: -1 });
        return NextResponse.json(meetings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const meeting = await MeetingRequest.create(body);
        return NextResponse.json(meeting);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const meeting = await MeetingRequest.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(meeting);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
