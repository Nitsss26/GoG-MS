const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("CRITICAL: MONGODB_URI not found");
    process.exit(1);
}

// User-provided schema with reportsTo as Array
const employeeSchema = new mongoose.Schema({
    id: String, name: String, email: String, role: String, photoUrl: String,
    isOnboarded: Boolean, dept: String, designation: String, status: String,
    joiningDate: String, salary: Number, location: String, dateOfBirth: String,
    phone: String, gender: String, bloodGroup: String,
    reportsTo: [String], // Array type as requested
    managerLevel: String,
    chancesRemaining: { type: Number, default: 3 },
    password: { type: String, default: "26082001" },
    address: String, bankAccountName: String, bankAccountNumber: String,
    ifscCode: String, upiId: String, collegeName: String
}, { strict: false }); // Allow all other CSV fields

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

function parseFullCSV(content) {
    const records = [];
    let currentRecord = [];
    let currentValue = "";
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') {
            if (inQuotes && content[i + 1] === '"') {
                currentValue += '"'; // Escaped quote
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRecord.push(currentValue.trim());
            currentValue = "";
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (currentRecord.length > 0 || currentValue !== "") {
                currentRecord.push(currentValue.trim());
                records.push(currentRecord);
                currentRecord = [];
                currentValue = "";
            }
            if (char === '\r' && content[i + 1] === '\n') i++;
        } else {
            currentValue += char;
        }
    }
    if (currentRecord.length > 0 || currentValue !== "") {
        currentRecord.push(currentValue.trim());
        records.push(currentRecord);
    }
    return records;
}

const founders = [
    {
        id: "FND001", name: "CEO", email: "ceo@geeksofgurukul.com", role: "FOUNDER",
        isOnboarded: true, dept: "C-Suite", designation: "Chief Executive Officer",
        status: "Active", password: "26082001", location: "Bhopal", reportsTo: []
    },
    {
        id: "FND002", name: "CTO", email: "cto@geeksofgurukul.com", role: "FOUNDER",
        isOnboarded: true, dept: "C-Suite", designation: "Chief Technology Officer",
        status: "Active", password: "26082001", location: "Bhopal", reportsTo: []
    },
    {
        id: "FND003", name: "COO", email: "coo@geeksofgurukul.com", role: "FOUNDER",
        isOnboarded: true, dept: "C-Suite", designation: "Chief Operating Officer",
        status: "Active", password: "20111992", location: "Bhopal", reportsTo: []
    }
];

function mapRole(designation) {
    if (!designation) return "FACULTY";
    const d = designation.toLowerCase();
    if (d.includes("founder") || d.includes("ceo") || d.includes("cto") || d.includes("coo")) return "FOUNDER";
    if (d.includes("hr")) return "HR";
    if (d.includes("ad") || d.includes("associate director")) return "AD";
    if (d.includes("tl") || d.includes("tech lead")) return "TL";
    if (d.includes("hoi") || d.includes("head of institute")) return "HOI";
    if (d.includes("operation manager") || d.includes("ops manager") || d.includes("om")) return "OM";
    if (d.includes("professor") || d.includes("faculty") || d.includes("sde & professor")) return "PROFESSOR";
    return "FACULTY";
}

function formatPassword(dob) {
    if (!dob || dob === "?" || dob === "NA" || dob === "-" || dob === "") return "26082001";
    return dob.replace(/\D/g, ''); // DDMMYYYY format (remove /)
}

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully");

        const csvPath = path.join(__dirname, '../Data.csv');
        console.log("Reading CSV from:", csvPath);
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parseFullCSV(csvContent);

        const headers = records[0];
        const dataRecords = records.slice(1);
        const employeeMap = new Map();

        // Pass 1: Parse and create objects
        dataRecords.forEach((cols, index) => {
            if (cols.length < 2) return;

            const name = cols[0]?.trim();
            const email = cols[1]?.toLowerCase().trim();
            if (!email || email === "" || email === "company mail id") return;

            const designation = cols[10]?.trim();
            const role = mapRole(designation);
            const dob = cols[27]?.trim();
            const password = formatPassword(dob);

            const empObj = {
                id: `EMP${100 + index}`,
                name,
                email,
                role,
                designation,
                password,
                isOnboarded: true,
                status: "Active",
                joiningDate: "2024-01-01",
                salary: 50000,
                location: "sage-bhopal",
                dateOfBirth: dob,
                phone: cols[3],
                address: cols[6],
                bloodGroup: cols[28],
                bankAccountName: cols[17],
                bankAccountNumber: cols[15],
                ifscCode: cols[16],
                upiId: cols[18],
                collegeName: cols[26],
                photoUrl: cols[23],
                dept: cols[9],
                reportsTo: [] // Will set in Pass 2
            };

            // Store any other fields dynamically
            headers.forEach((header, hIdx) => {
                const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
                // Skip primary fields already mapped or redundant ones
                if (!empObj[key] && key !== 'company_mail_id' && key !== 'email_id' && key !== 'email') {
                    empObj[key] = cols[hIdx] || "";
                }
            });

            if (!employeeMap.has(email)) {
                employeeMap.set(email, empObj);
            }
        });

        const csvEmployees = Array.from(employeeMap.values());
        console.log(`Processed ${csvEmployees.length} unique records from CSV`);

        // Find key people for hierarchy
        const raj = csvEmployees.find(e => e.email === "raj@geeksofgurukul.com");
        const hois = csvEmployees.filter(e => e.role === "HOI").map(e => e.id);

        console.log("HOIs identified:", hois);

        const managementEmails = ["raj@geeksofgurukul.com", "hr@geeksofgurukul.com", "nitesh@geeksofgurukul.com"];

        csvEmployees.forEach(emp => {
            if (managementEmails.includes(emp.email)) {
                emp.reportsTo = ["FND001"]; // Management reports to Founders
            } else if (emp.role === "HOI") {
                emp.reportsTo = raj ? [raj.id] : ["FND001"]; // HOIs report to Raj
            } else {
                // Staff reports to all 3 HOIs
                emp.reportsTo = hois.length > 0 ? hois : ["FND001"];
            }
        });

        const founderEmails = founders.map(f => f.email);
        const filteredCsv = csvEmployees.filter(e => !founderEmails.includes(e.email));
        const allEmployees = [...founders, ...filteredCsv];

        console.log("Clearing existing employees...");
        await Employee.deleteMany({});

        console.log(`Inserting ${allEmployees.length} employees with specific schema...`);
        const res = await Employee.insertMany(allEmployees);
        console.log(`Successfully seeded ${res.length} employees`);

        await mongoose.disconnect();
        console.log("Seeding complete");
        process.exit(0);
    } catch (error) {
        console.error("FATAL ERROR:", error);
        process.exit(1);
    }
}

seed();
