import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';

export async function GET() {
    try {
        await dbConnect();

        const curriculumUsers = [
            {
                id: 'EMP-CH-001',
                employeeId: 'EMP-CH-001',
                name: 'Dr. Rajesh Sharma',
                email: 'curriculum.head@geeksofgurukul.com',
                role: 'CURRICULUM_HEAD',
                designation: 'Curriculum Head & Academic Dean',
                department: 'Academics',
                location: 'Global HQ',
                status: 'ACTIVE',
                joinedDate: '2024-01-01',
                password: 'password123'
            },
            {
                id: 'EMP-CL-001',
                employeeId: 'EMP-CL-001',
                name: 'Prof. Vikram Malhotra',
                email: 'curriculum.lead@geeksofgurukul.com',
                role: 'CURRICULUM_LEAD',
                designation: 'Curriculum Lead - Engineering & FSWD',
                department: 'Academics',
                location: 'SAGE Bhopal',
                status: 'ACTIVE',
                joinedDate: '2024-01-01',
                password: 'password123'
            }
        ];

        const results = [];
        for (const u of curriculumUsers) {
            let existing = await Employee.findOne({ email: u.email });
            if (!existing) {
                existing = await Employee.create(u);
                results.push({ action: 'CREATED', email: u.email, role: u.role });
            } else {
                if (existing.role !== u.role) {
                    existing.role = u.role;
                    await existing.save();
                    results.push({ action: 'UPDATED_ROLE', email: u.email, role: u.role });
                } else {
                    results.push({ action: 'EXISTS', email: u.email, role: u.role });
                }
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error("Curriculum Seed error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
