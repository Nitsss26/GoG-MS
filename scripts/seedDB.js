const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in .env.local');
    process.exit(1);
}

const fs = require('fs');
const path = require('path');

// Inline schemas for the script
const EmployeeSchema = new mongoose.Schema({
    id: String, name: String, email: String, role: String, isOnboarded: { type: Boolean, default: true },
    dept: String, designation: String, status: { type: String, default: 'Active' }, joiningDate: String,
    salary: Number, location: String, dateOfBirth: String, phone: String, gender: String, bloodGroup: String,
    address: String, photoUrl: String, chancesRemaining: { type: Number, default: 3 },
    reportsTo: String, managerLevel: String, password: { type: String, default: "26082001" },
    bankAccountName: String, bankAccountNumber: String, ifscCode: String, upiId: String,
    resumeUrl: String, bachelorCertUrl: String, masterCertUrl: String,
    bachelorMarksheetUrl: String, masterMarksheetUrl: String,
    marksheet10Url: String, marksheet12Url: String, aadharCardUrl: String, panCardUrl: String,
    passportPhotoUrl: String, bankPassbookUrl: String, expLetterUrl: String,
    fatherMotherName: String, parentsPhone: String, linkedinId: String,
    collegeName: String, bachelorQual: String, masterQual: String
}, { timestamps: true });

const PerformanceStarSchema = new mongoose.Schema({ employeeId: String, stars: Number, rating: Number, badges: [String] });
const AttendanceSchema = new mongoose.Schema({ employeeId: String, date: String, clockIn: String, clockOut: String, location: String, status: String, flags: Object, isApprovedByHR: { type: Boolean, default: false } });
const LeaveRequestSchema = new mongoose.Schema({ id: String, employeeId: String, employeeName: String, type: String, startDate: String, endDate: String, days: Number, status: String, classification: String, leaveType: String, reason: String });
const NoticeSchema = new mongoose.Schema({ id: String, title: String, content: String, category: String, createdBy: String, createdAt: String });
const TicketSchema = new mongoose.Schema({ id: String, raisedBy: String, employeeName: String, targetCategory: String, subject: String, content: String, status: String, createdAt: String });
const PIPRecordSchema = new mongoose.Schema({ id: String, employeeId: String, employeeName: String, reason: String, startDate: String, status: String, warnings: Number, disclaimer: String });
const AdditionalResponsibilitySchema = new mongoose.Schema({ id: String, employeeId: String, employeeName: String, addedBy: String, description: String, date: String, status: { type: String, default: "Approved" }, points: Number });

const Employee = mongoose.model('Employee', EmployeeSchema);
const PerformanceStar = mongoose.model('PerformanceStar', PerformanceStarSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);
const Notice = mongoose.model('Notice', NoticeSchema);
const Ticket = mongoose.model('Ticket', TicketSchema);
const PIPRecord = mongoose.model('PIPRecord', PIPRecordSchema);
const AdditionalResponsibility = mongoose.model('AdditionalResponsibility', AdditionalResponsibilitySchema);

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else current += char;
    }
    result.push(current.trim());
    return result;
}

function formatDOB(dob) {
    if (!dob || dob === '?' || dob === 'No' || dob === '-') return '26082001';
    // Handle Excel number (e.g., 45589)
    if (!isNaN(dob) && dob.length > 4) {
        const date = new Date((dob - 25569) * 86400 * 1000);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}${m}${y}`;
    }
    // Handle DD/MM/YYYY or DD-MM-YYYY
    const parts = dob.split(/[\/\-]/);
    if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = '19' + y; // Assume 19xx for 2 digit year if not specified
        return `${d}${m}${y}`;
    }
    return '26082001';
}

function mapRole(designation) {
    const d = (designation || "").toUpperCase();
    if (d.includes("HR")) return "HR";
    if (d.includes("AD") || d.includes("ASSOCIATE DIRECTOR")) return "AD";
    if (d.includes("TL") || d.includes("TEAM LEAD")) return "TL";
    if (d.includes("HOI") || d.includes("HEAD OF INSTITUTE")) return "HOI";
    if (d.includes("OM") || d.includes("OPERATION MANAGER")) return "OM";
    if (d.includes("ACADEMIC LEAD") || d.includes("PROFESSOR") || d.includes("FACULTY") || d.includes("SDE")) return "PROFESSOR";
    return "PROFESSOR"; // default
}

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Employee.deleteMany({});
        await PerformanceStar.deleteMany({});
        await Attendance.deleteMany({});
        await LeaveRequest.deleteMany({});
        await Notice.deleteMany({});
        await Ticket.deleteMany({});
        await PIPRecord.deleteMany({});
        await AdditionalResponsibility.deleteMany({});
        console.log('Cleared existing data');

        const csvPath = path.join(__dirname, '..', 'Data.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = parseCSVLine(lines[0]);

        const founders = [
            { id: "FND001", name: "CEO", email: "ceo@geeksofgurukul.com", role: "FOUNDER", dept: "C-Suite", designation: "Chief Executive Officer", joiningDate: "2023-01-01", salary: 500000, location: "Bhopal", password: "26082001" },
            { id: "FND002", name: "CTO", email: "cto@geeksofgurukul.com", role: "FOUNDER", dept: "C-Suite", designation: "Chief Technology Officer", joiningDate: "2023-01-01", salary: 450000, location: "Bhopal", password: "26082001" },
            { id: "FND003", name: "COO", email: "coo@geeksofgurukul.com", role: "FOUNDER", dept: "C-Suite", designation: "Chief Operating Officer", joiningDate: "2023-01-01", salary: 450000, location: "Bhopal", password: "26082001" },
        ];

        const realEmployees = [];
        for (let i = 1; i < lines.length; i++) {
            const row = parseCSVLine(lines[i]);
            if (row.length < 5) continue;

            const name = row[0];
            const companyEmail = row[1];
            const personalEmail = row[2];
            const email = companyEmail || personalEmail;
            if (!email || email.toLowerCase() === 'no') continue;

            const phone = row[3];
            const fatherMotherName = row[4];
            const parentsPhone = row[5];
            const address = row[6];
            const bachelorQual = row[7];
            const masterQual = row[8];
            const designation = row[10];
            const resumeUrl = row[11];
            const bachelorCertUrl = row[12];
            const masterCertUrl = row[13];
            const linkedinId = row[14];
            const bankAccountNumber = row[15];
            const ifscCode = row[16];
            const bankAccountName = row[17];
            const upiId = row[18];
            const marksheet10Url = row[19];
            const marksheet12Url = row[20];
            const aadharCardUrl = row[21];
            const panCardUrl = row[22];
            const passportPhotoUrl = row[23];
            const bankPassbookUrl = row[24];
            const expLetterUrl = row[25];
            const collegeName = row[26];
            const dobRaw = row[27];
            const bloodGroup = row[28];
            const bachelorMarksheetUrl = row[29];
            const masterMarksheetUrl = row[30];

            const role = mapRole(designation);
            const dob = formatDOB(dobRaw);

            realEmployees.push({
                id: `EMP${String(i).padStart(3, '0')}`,
                name,
                email: email.toLowerCase(),
                role,
                dept: "Institutional",
                designation,
                joiningDate: "2024-01-01",
                salary: 25000,
                location: "Bhopal",
                phone,
                fatherMotherName,
                parentsPhone,
                address,
                bachelorQual,
                masterQual,
                resumeUrl,
                bachelorCertUrl,
                masterCertUrl,
                linkedinId,
                bankAccountNumber,
                ifscCode,
                bankAccountName,
                upiId,
                marksheet10Url,
                marksheet12Url,
                aadharCardUrl,
                panCardUrl,
                passportPhotoUrl,
                bankPassbookUrl,
                expLetterUrl,
                collegeName,
                dateOfBirth: dobRaw,
                bloodGroup,
                bachelorMarksheetUrl,
                masterMarksheetUrl,
                password: dob
            });
        }

        const allEmployees = [...founders, ...realEmployees];
        await Employee.insertMany(allEmployees);

        // Sample Stars for Leaderboard
        const stars = allEmployees.map(emp => ({
            employeeId: emp.id,
            stars: Math.floor(Math.random() * 5) + 1,
            rating: (Math.random() * 2 + 3).toFixed(1),
            badges: ["Institutional"]
        }));
        await PerformanceStar.insertMany(stars);

        // Attendance data (Feb 2026)
        const attendance = [];
        const FEB_DAYS = ["02", "03", "04", "05", "06", "07", "09", "10", "11", "12", "13", "14", "16", "17", "18", "19", "20", "21", "23", "24", "25", "26", "27", "28"];

        for (const emp of allEmployees.slice(0, 50)) { // Just first 50 for performance
            for (const d of FEB_DAYS) {
                const hasFlags = Math.random() < 0.2;
                attendance.push({
                    employeeId: emp.id,
                    date: `2026-02-${d}`,
                    clockIn: "09:00",
                    clockOut: "18:00",
                    location: emp.location,
                    status: "Present",
                    flags: hasFlags ? {
                        late: Math.random() < 0.5,
                        dressCode: Math.random() < 0.3,
                        misconduct: Math.random() < 0.1
                    } : {},
                    isApprovedByHR: true
                });
            }
        }
        await Attendance.insertMany(attendance);

        console.log(`Database seeded successfully with ${allEmployees.length} real employees!`);
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

seed();
