const { MongoClient } = require('mongodb');

// Constants
const MONGODB_URI = 'mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS';
const DB_NAME = 'GoG-MS';

const vinayData = {
    id: "FAC101",
    name: "Vinaypratap Prabhakar Salve",
    email: "vinay.pratap@geeksofgurukul.com",
    role: "PROFESSOR",
    isOnboarded: true,
    dept: "SDE & Academia",
    designation: "SDE & Professor",
    status: "Active",
    joiningDate: "2024-03-26",
    salary: 1, // Placeholder as not provided
    location: "SDBC",
    dateOfBirth: "2001-06-29",
    bloodGroup: "A+ve",
    phone: "7689815633",
    address: "At. Bhatwadgaon Post Majalgaon Tq. Majalgaon Dist. Beed Maharashtra",
    fatherMotherName: "Prabhakar Dnyanoba Salve",
    parentsPhone: "9404636342",
    linkedinId: "https://www.linkedin.com/in/vinaypratap-salve-296808202/",
    bankAccountName: "Vinaypratap Prabhakar Salve",
    bankAccountNumber: "34441835312",
    ifscCode: "SBIN0000202",
    upiId: "salvevinaypratap@ybl",
    resumeUrl: "https://drive.google.com/open?id=1laE-JB3zD9Hymk6tpjZpembAZMXQfgDQ",
    bachelorCertUrl: "https://drive.google.com/open?id=1YsSYoWoANFWBfc3e-vzmVZB0NWnqcee6",
    masterCertUrl: "https://drive.google.com/open?id=156HQvsaAa_r7TMdPF3V3ggBY-P9iYIMu",
    bachelorMarksheetUrl: "https://drive.google.com/open?id=15uUHfcsQJaFFCjfc10DR97e8N1y3vu-X",
    marksheet10Url: "https://drive.google.com/open?id=1CBmKNY84HA8qP58Kyw01ssg88HoTWOgG",
    marksheet12Url: "https://drive.google.com/open?id=1l-KxD9JtRzqKEpWdQDUuaO0F27FGcQfN",
    aadharCardUrl: "https://drive.google.com/open?id=1MhHzLRBuRKhBYDZoWgh7eOk8yxZjjb4s",
    panCardUrl: "https://drive.google.com/open?id=16IsGyotQv3Rcq_MC7pTVs-cKegVDYoCB",
    passportPhotoUrl: "https://drive.google.com/open?id=1jdc1ZmOhF_eic321pDKPUNr00JGDE9TK",
    bankPassbookUrl: "https://drive.google.com/open?id=1A6Pba5lPBeDlYO5Nr0mmH81s0nqBcHtR",
    collegeName: "IIT KHARAGPUR",
    bachelorQual: "B.Tech (Biotechnology)",
    masterQual: "M.Tech (Biotechnology)",
    chancesRemaining: 3
};

const sdbcLocation = {
    id: "SDBC",
    name: "Sushila Devi Bansal College of Technology",
    shortName: "SDBC",
    lat: 22.59748,
    lng: 75.787466,
    radiusKm: 2,
    address: "AB Road, Umaria, Near Rau, Indore, Madhya Pradesh 453331",
    city: "Indore",
    state: "Madhya Pradesh"
};

async function addVinay() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);

        // 1. Ensure location exists
        const locExists = await db.collection('locations').findOne({ id: "SDBC" });
        if (!locExists) {
            console.log("Adding SDBC location...");
            await db.collection('locations').insertOne(sdbcLocation);
        }

        // 2. Add Employee
        const empExists = await db.collection('employees').findOne({ email: vinayData.email });
        if (empExists) {
            console.log("Employee already exists. Updating...");
            await db.collection('employees').updateOne({ email: vinayData.email }, { $set: vinayData });
        } else {
            console.log("Adding Vinaypratap as employee...");
            await db.collection('employees').insertOne(vinayData);
        }

        // 3. Add Work Schedules for Mon-Sat (next 30 days)
        console.log("Generating work schedules...");
        const schedules = [];
        const start = new Date();
        for (let i = 0; i < 30; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = date.toISOString().split('T')[0];

            if (dayName === 'Sun') continue;

            // Check if it's 3rd Saturday
            if (dayName === 'Sat') {
                const dayOfMonth = date.getDate();
                if (dayOfMonth >= 15 && dayOfMonth <= 21) {
                    console.log(`Skipping 3rd Saturday: ${dateStr}`);
                    continue;
                }
            }

            schedules.push({
                employeeId: vinayData.id,
                date: dateStr,
                location: "SDBC",
                clockInTime: "09:30",
                clockOutTime: "16:00",
                status: "Approved",
                assignedBy: "Auto-Migration"
            });
        }

        if (schedules.length > 0) {
            // Delete existing future schedules for this employee to avoid duplicates
            await db.collection('workschedules').deleteMany({
                employeeId: vinayData.id,
                date: { $gte: start.toISOString().split('T')[0] }
            });
            await db.collection('workschedules').insertMany(schedules);
            console.log(`Added ${schedules.length} work schedules.`);
        }

        console.log("Success!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

addVinay();
