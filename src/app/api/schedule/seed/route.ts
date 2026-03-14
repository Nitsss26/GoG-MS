import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, WorkSchedule } from '@/models/Schemas';
import { getExpectedTimingInternal } from '@/lib/attendance-utils';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const employees = await Employee.find({});
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const count = { created: 0, updated: 0 };

        const customRules: Record<string, any> = {
            "Ankit Singh": { in: "08:30", out: "15:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "sage-bhopal" },
            "Ayush Sahu": { in: "10:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "sage-bhopal" },
            "Ravi Bhushan Pratap": { in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "sgsu" },
            "Suman Rajak": { in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "sgsu" },
            "Sahil Burde": { in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Pranjul Sahu": { in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Mukesh Kumar": { in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Amit Singh Patel": { in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Mayank Choudhary": { in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Priyanka Kumawat": { in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Sujal Verma": { in: "10:00", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-mandideep" },
            "Prerna Saluja": { in: "09:35", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "bansal-kokta" },
            "Abhishek Tiwari": { 
                special: true,
                rules: [
                    { days: ["Tue", "Thu", "Fri"], in: "10:15", out: "16:30", location: "sage-bhopal" },
                    { days: ["Mon", "Wed"], in: "10:15", out: "16:00", location: "sgsu" }
                ]
            },
            "Rahul": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "sage-indore" },
            "Siddhant": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "sage-indore" },
            "Nishal Caleb": { in: "09:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "oriental-indore" },
            "Sumit Maity": { in: "09:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "oriental-indore" },
            "Avikal": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "SDBC" },
            "Vivek": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "SDBC" },
            "Vinay": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "SDBC" },
            "Anirudh": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "SDBC" },
            "Shekhar": { in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "SDBC" },
            "Aniket Chouhan": { in: "09:45", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "SDBC" },
            "Yamini": {
                special: true,
                rules: [
                    { days: ["Mon", "Tue", "Wed", "Thu"], in: "10:15", out: "15:00", location: "sage-indore" },
                    { days: ["Fri", "Sat"], in: "09:45", out: "16:00", location: "oriental-indore" }
                ]
            },
            "Ravi ranjan": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-bhubaneswar" },
            "Vipul Kumar": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "centurion-bhubaneswar" },
            "Aman": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-bhubaneswar" },
            "Verman": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "centurion-bhubaneswar" },
            "Siddharda": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], location: "centurion-bhubaneswar" },
            "Mriganka Shekhar Barman": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-paralakhemundi" },
            "Sushant": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-paralakhemundi" },
            "Chandan": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-paralakhemundi" },
            "Jeet": { in: "09:30", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-vizianagaram" },
            "Kandula Revanth": { in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], location: "centurion-vizianagaram" }
        };

        for (const emp of employees) {
            const custom = customRules[emp.name];
            for (const day of days) {
                let ruleToApply = null;
                if (custom) {
                    if (custom.special) {
                        ruleToApply = custom.rules.find((r: any) => r.days.includes(day));
                    } else if (custom.days.includes(day)) {
                        ruleToApply = custom;
                    }
                }

                // Default if no custom rule for this day
                if (!ruleToApply) {
                    const expected = getExpectedTimingInternal(emp.name, emp.location || "bhopal", "2026-03-16"); // Mon as base
                    // For Sat, check if it's WFH/Third Sat? 
                    // But here we want a static weekly schedule. 
                    // Let's assume non-custom days use basic location defaults
                    ruleToApply = {
                        location: emp.location || "bhopal",
                        in: expected.in,
                        out: expected.out
                    };
                }

                await WorkSchedule.findOneAndUpdate(
                    { employeeId: emp.id, date: day },
                    {
                        employeeId: emp.id,
                        employeeName: emp.name,
                        date: day,
                        location: ruleToApply.location,
                        clockInTime: ruleToApply.in,
                        clockOutTime: ruleToApply.out,
                        status: "Approved",
                        assignedBy: "SYSTEM"
                    },
                    { upsert: true }
                );
            }
        }

        return NextResponse.json({ message: "Seeding complete for all employees Mon-Sat" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
