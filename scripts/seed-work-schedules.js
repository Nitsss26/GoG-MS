const mongoose = require('mongoose');

// MongoDB Connection
const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const WorkScheduleSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    employeeName: { type: String },
    date: { type: String, required: true }, // "Mon", "Tue", etc. or YYYY-MM-DD
    location: { type: String, required: true },
    clockInTime: { type: String, default: "09:30" },
    clockOutTime: { type: String, default: "18:30" },
    assignedBy: { type: String },
    assignedByName: { type: String },
    status: { type: String, default: "Approved", enum: ["Pending", "Approved", "Rejected"] },
    reason: { type: String }
});

const EmployeeSchema = new mongoose.Schema({
    id: String,
    name: String,
    location: String,
    role: String
});

const WorkSchedule = mongoose.models.WorkSchedule || mongoose.model('WorkSchedule', WorkScheduleSchema);
const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        const employees = await Employee.find({});
        console.log(`Found ${employees.length} employees`);

        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const customRules = [
            { nameRegex: /Ravi Ranjan/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Vipul Kumar/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Aman/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Verman/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Siddharda/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Mriganka/i, location: "centurion-paralakhemundi", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Sushant/i, location: "centurion-paralakhemundi", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Chandan/i, location: "centurion-paralakhemundi", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Jeet/i, location: "centurion-vizianagaram", in: "09:30", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /K\. Revanth/i, location: "centurion-vizianagaram", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Ankit Singh/i, location: "sage-bhopal", in: "08:30", out: "15:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Ayush Sahu/i, location: "sage-bhopal", in: "10:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Ravi Bhushan Pratap/i, location: "sgsu", in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Suman Rajak/i, location: "sgsu", in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Sahil Burde/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Pranjul Sahu/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Mukesh Kumar/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Amit Singh Patel/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Mayank Choudhary/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Priyanka Kumawat/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Sujal Verma/i, location: "bansal-mandideep", in: "10:00", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Prerna Saluja/i, location: "bansal-kokta", in: "09:35", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Rahul/i, location: "sage-indore", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Siddhant/i, location: "sage-indore", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Nishal Caleb/i, location: "oriental-indore", in: "09:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Sumit Maity/i, location: "oriental-indore", in: "09:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            { nameRegex: /Avikal/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Vivek/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Vinay/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Anirudh/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Shekhar/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
            { nameRegex: /Aniket Chouhan/i, location: "SDBC", in: "09:45", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] }
        ];

        console.log("Clearing existing schedules...");
        await WorkSchedule.deleteMany({});
        console.log("Cleared existing schedules");

        for (const emp of employees) {
            for (const day of days) {
                let ruleToApply = null;
                
                // Match custom rules
                for (const rule of customRules) {
                    if (rule.nameRegex.test(emp.name) && rule.days.includes(day)) {
                        ruleToApply = rule;
                        break;
                    }
                }

                // Handle split rules (Abhishek and Yamini)
                if (emp.name.match(/Abhishek Tiwari/i)) {
                    if (["Tue", "Thu", "Fri"].includes(day)) ruleToApply = { location: "sage-bhopal", in: "10:15", out: "16:30" };
                    if (["Mon", "Wed"].includes(day)) ruleToApply = { location: "sgsu", in: "10:15", out: "16:00" };
                    if (day === "Sat") ruleToApply = { location: "WFH", in: "09:30", out: "18:00" };
                }
                if (emp.name.match(/Yamini/i)) {
                    if (["Mon", "Tue", "Wed", "Thu"].includes(day)) ruleToApply = { location: "sage-indore", in: "10:15", out: "15:00" };
                    if (["Fri", "Sat"].includes(day)) ruleToApply = { location: "oriental-indore", in: "09:45", out: "16:00" };
                }

                if (!ruleToApply) {
                    // Fallback to employee's default location
                    let loc = emp.location || "sage-bhopal";
                    // Normalize
                    if (loc === "Bhopal") loc = "sage-bhopal";
                    if (loc === "Indore") loc = "sage-indore";
                    
                    ruleToApply = { location: loc, in: "09:30", out: "18:30" };
                }

                await WorkSchedule.create({
                    employeeId: emp.id,
                    employeeName: emp.name,
                    date: day,
                    location: ruleToApply.location,
                    clockInTime: ruleToApply.in,
                    clockOutTime: ruleToApply.out,
                    assignedBy: "SYSTEM",
                    assignedByName: "System Seed",
                    status: "Approved"
                });
            }
        }
        console.log("Final schedule seeding complete");
        process.exit(0);
    } catch (error) {
        console.error("Schedule seeding failed:", error);
        process.exit(1);
    }
}

seed();
