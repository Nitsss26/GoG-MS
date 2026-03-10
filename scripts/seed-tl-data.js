const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI;

// Generic schemas for seeding
const employeeSchema = new mongoose.Schema({}, { strict: false });
const attendanceSchema = new mongoose.Schema({}, { strict: false });
const leaveSchema = new mongoose.Schema({}, { strict: false });
const ticketSchema = new mongoose.Schema({}, { strict: false });
const reimbursementSchema = new mongoose.Schema({}, { strict: false });
const additionalResponsibilitySchema = new mongoose.Schema({}, { strict: false });
const performanceStarSchema = new mongoose.Schema({}, { strict: false });
const misbehaviourSchema = new mongoose.Schema({}, { strict: false });
const holidaySchema = new mongoose.Schema({}, { strict: false });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
const Leave = mongoose.models.Leave || mongoose.model("Leave", leaveSchema);
const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
const Reimbursement = mongoose.models.Reimbursement || mongoose.model("Reimbursement", reimbursementSchema);
const AdditionalResponsibility = mongoose.models.AdditionalResponsibility || mongoose.model("AdditionalResponsibility", additionalResponsibilitySchema);
const PerformanceStar = mongoose.models.PerformanceStar || mongoose.model("PerformanceStar", performanceStarSchema);
const Misbehaviour = mongoose.models.Misbehaviour || mongoose.model("Misbehaviour", misbehaviourSchema);
const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", holidaySchema);

const seedTLData = async () => {
    try {
        console.log("Connecting to MongoDB for TL Seeding...");
        await mongoose.connect(MONGO_URI);
        
        const tlEmail = "nitesh@geeksofgurukul.com";
        const tlPhoto = "https://res.cloudinary.com/dwaepohvf/image/upload/v1773050409/sdgubdunfbltriwqhddr.jpg";
        
        // Update TL Profile Basic Info
        await Employee.updateOne(
            { email: tlEmail },
            { 
                $set: { 
                    photoUrl: tlPhoto,
                    joiningDate: "01-01-2024",
                    designationDate: "01-12-2025",
                    biWeeklyScores: [
                        { period: "Feb 15 - Feb 28, 2026", score: 4.8, points: 480, status: "Recorded" },
                        { period: "Feb 01 - Feb 14, 2026", score: 4.5, points: 450, status: "Recorded" },
                        { period: "Jan 15 - Jan 31, 2026", score: 4.9, points: 490, status: "Recorded" }
                    ]
                } 
            }
        );

        const tl = await Employee.findOne({ email: tlEmail });
        const tlId = tl.id || "EMP130";

        console.log(`Seeding data for ${tlEmail} (${tlId})`);

        // 1. Attendance with multi-flags (Jan 2026 - March 15, 2026)
        await Attendance.deleteMany({ employeeId: tlId });
        const attendanceRecords = [];
        const start = new Date("2026-01-01");
        const end = new Date("2026-03-15");

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === 0) continue; // Skip Sundays
            
            const dateStr = d.toISOString().split('T')[0];
            const isLate = Math.random() > 0.8;
            const isDressViolation = Math.random() > 0.9;
            const isMisconduct = Math.random() > 0.98;
            const isPerformanceFlag = Math.random() > 0.95;
            const isOnLeave = Math.random() > 0.95;

            if (isOnLeave) {
                attendanceRecords.push({
                    id: `att_tl_${dateStr}`,
                    employeeId: tlId,
                    employeeName: "Nitesh",
                    date: dateStr,
                    status: "On Leave",
                    clockIn: "—",
                    clockOut: "—",
                    flags: {}
                });
                continue;
            }

            attendanceRecords.push({
                id: `att_tl_${dateStr}`,
                employeeId: tlId,
                employeeName: "Nitesh",
                date: dateStr,
                status: "Present",
                clockIn: isLate ? "09:15 AM" : "09:00 AM",
                clockOut: "06:00 PM",
                flags: {
                    late: isLate,
                    dressCode: isDressViolation,
                    locationDiff: false,
                    misconduct: isMisconduct,
                    performance: isPerformanceFlag,
                    meetingAbsent: false
                },
                fine: (isLate ? 100 : 0) + (isDressViolation ? 200 : 0) + (isMisconduct ? 500 : 0)
            });
        }
        await Attendance.insertMany(attendanceRecords);

        // Update TL Points to be in range -80 to +50
        await Employee.updateOne(
            { email: tlEmail },
            { 
                $set: { 
                    biWeeklyScores: [
                        { period: "Mar 01 - Mar 15, 2026", score: 4.2, points: 35, status: "Recorded" },
                        { period: "Feb 15 - Feb 28, 2026", score: 3.5, points: -45, status: "Recorded" },
                        { period: "Feb 01 - Feb 14, 2026", score: 4.8, points: 50, status: "Recorded" },
                        { period: "Jan 15 - Jan 31, 2026", score: 3.0, points: -80, status: "Recorded" }
                    ]
                } 
            }
        );

        // 2. Performance Stars
        await PerformanceStar.updateOne(
            { employeeId: tlId },
            { $set: { stars: 4.9, rating: 4.9, badges: ["Tech Visionary", "Leader", "Problem Solver"] } },
            { upsert: true }
        );

        // 3. Indian Holidays
        const indianHolidays = [
            { id: "hol_1", name: "Republic Day", date: "2026-01-26", status: "Approved", forAll: true },
            { id: "hol_2", name: "Holi", date: "2026-03-03", status: "Approved", forAll: true },
            { id: "hol_3", name: "Eid-ul-Fitr", date: "2026-03-20", status: "Approved", forAll: true }
        ];
        for (const h of indianHolidays) {
            await Holiday.updateOne({ name: h.name, date: h.date }, { $set: h }, { upsert: true });
        }

        // 4. Dummy Birthdays (TL Specific View)
        const dummyBirthdays = [
            { id: "dummy_emp_1", email: "birthday1@gog.com", name: "Aditi Sharma", dateOfBirth: "12-03-1995", role: "PROFESSOR", designation: "Faculty", status: "Active" },
            { id: "dummy_emp_2", email: "birthday2@gog.com", name: "Rahul Verma", dateOfBirth: "15-03-1992", role: "PROFESSOR", designation: "Faculty", status: "Active" },
            { id: "dummy_emp_3", email: "birthday3@gog.com", name: "Sneha Kapur", dateOfBirth: "20-03-1997", role: "PROFESSOR", designation: "Faculty", status: "Active" }
        ];
        for (const b of dummyBirthdays) {
            await Employee.updateOne({ email: b.email }, { $set: b }, { upsert: true });
        }

        // 5. Announcements
        const newAnnouncements = [
            { id: "ann_tl_1", title: "Indore Campus Tech Meetup", content: "Join us for the monthly tech summit at Indore campus to discuss system scalability.", category: "Event", createdAt: "2026-03-05" },
            { id: "ann_tl_2", title: "New AI Integration SOP", content: "Please review the updated guidelines for using AI tools in student mentorship.", category: "Policy", createdAt: "2026-03-07" },
            { id: "ann_tl_3", title: "Quarterly Performance Bonus", content: "Management is pleased to announce bonuses for top-performing teams this quarter.", category: "HR", createdAt: "2026-03-08" }
        ];
        const Notice = mongoose.models.Notice || mongoose.model("Notice", new mongoose.Schema({}, { strict: false }));
        for (const n of newAnnouncements) {
            await Notice.updateOne({ title: n.title }, { $set: n }, { upsert: true });
        }

        console.log("TL Data Seeded Successfully with Enriched Flags and Layout Content.");
    } catch (e) {
        console.error("Error seeding TL data:", e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

seedTLData();

