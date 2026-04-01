import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AdditionalResponsibility } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        
        let query = {};
        if (employeeId) query = { employeeId };
        
        const responsibilities = await AdditionalResponsibility.find(query).sort({ date: -1 });
        return NextResponse.json(responsibilities);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const resp = await AdditionalResponsibility.create(body);
        return NextResponse.json(resp);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const resp = await AdditionalResponsibility.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(resp);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
