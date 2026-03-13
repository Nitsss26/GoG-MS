import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ReimbursementClaim } from '@/models/Schemas';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const role = searchParams.get('role');

        let query = {};
        if (role !== 'HR' && role !== 'FOUNDER' && userId) {
            query = { employeeId: userId };
        }

        const claims = await ReimbursementClaim.find(query).sort({ date: -1 });
        return NextResponse.json(claims);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const claim = await ReimbursementClaim.create(body);
        return NextResponse.json(claim);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const claim = await ReimbursementClaim.findOneAndUpdate({ id }, updates, { new: true });
        return NextResponse.json(claim);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
