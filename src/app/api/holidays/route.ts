import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Holiday } from '@/models/Schemas';

export async function GET() {
    try {
        await dbConnect();
        const holidays = await Holiday.find({});
        return NextResponse.json(holidays);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        
        // Check if updating existing or creating new
        if (body.id) {
            const updated = await Holiday.findOneAndUpdate({ id: body.id }, body, { returnDocument: 'after', upsert: true });
            return NextResponse.json(updated);
        } else {
            const newItem = await Holiday.create(body);
            return NextResponse.json(newItem);
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const { id, status, customMessage } = await req.json();
        const updated = await Holiday.findOneAndUpdate(
            { id }, 
            { status, customMessage }, 
            { returnDocument: 'after' }
        );
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
