import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';

export async function GET() {
    try {
        await dbConnect();
        const employees = await Employee.find({});
        return NextResponse.json(employees);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
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
