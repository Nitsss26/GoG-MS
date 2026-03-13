import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Notice } from '@/models/Schemas';

export async function GET() {
    try {
        await dbConnect();
        const notices = await Notice.find({}).sort({ createdAt: -1 });
        return NextResponse.json(notices);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const notice = await Notice.create(body);
        return NextResponse.json(notice);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const notice = await Notice.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(notice);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        await Notice.findOneAndDelete({ id });
        return NextResponse.json({ message: 'Deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
