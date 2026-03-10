const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const employeeSchema = new mongoose.Schema({
    id: String, name: String, email: String, role: String, photoUrl: String,
    isOnboarded: Boolean, dept: String, designation: String, status: String,
    joiningDate: String, salary: Number, location: String, dateOfBirth: String,
    phone: String, gender: String, bloodGroup: String, reportsTo: String,
    managerLevel: String, chancesRemaining: { type: Number, default: 3 }
});

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

const founders = [
    { id: "FND001", name: "CEO", email: "niteshduttmishra@geeksofgurukul.com", role: "FOUNDER", isOnboarded: true, dept: "C-Suite", designation: "Chief Executive Officer", status: "Active", joiningDate: "2023-01-01", salary: 500000, location: "Bhopal", dateOfBirth: "1980-01-15", phone: "9000000001", gender: "Male", bloodGroup: "O+", chancesRemaining: 3 },
    { id: "FND002", name: "CTO", email: "cto@gog.com", role: "FOUNDER", isOnboarded: true, dept: "C-Suite", designation: "Chief Technology Officer", status: "Active", joiningDate: "2023-01-01", salary: 450000, location: "Bhopal", dateOfBirth: "1982-05-20", phone: "9000000002", gender: "Male", bloodGroup: "A+", chancesRemaining: 3 },
    { id: "FND003", name: "COO", email: "coo@gog.com", role: "FOUNDER", isOnboarded: true, dept: "C-Suite", designation: "Chief Operating Officer", status: "Active", joiningDate: "2023-01-01", salary: 450000, location: "Bhopal", dateOfBirth: "1983-08-10", phone: "9000000003", gender: "Male", bloodGroup: "B+", chancesRemaining: 3 }
];

const coreStaff = [
    { id: "HR001", name: "Vivek Yadav", email: "vivek@gog.com", role: "HR", isOnboarded: true, dept: "HR", designation: "HR Manager", status: "Active", joiningDate: "2024-03-01", salary: 95000, location: "Bhopal", phone: "9876543212", chancesRemaining: 3 },
    { id: "AD001", name: "Raj Kumar Sahoo", email: "raj@gog.com", role: "AD", isOnboarded: true, dept: "Management", designation: "Associate Director", status: "Active", joiningDate: "2024-01-15", salary: 150000, location: "Bhopal", phone: "9876543210", managerLevel: "AD", chancesRemaining: 3 },
    { id: "TL001", name: "Nitesh", email: "nitesh@gog.com", role: "TL", isOnboarded: true, dept: "Engineering", designation: "Tech Lead", status: "Active", joiningDate: "2024-02-10", salary: 140000, location: "Bhopal", phone: "9876543211", managerLevel: "TL", chancesRemaining: 3 }
];

const hois = [
    { id: "HOI001", name: "Ayush Chauhan", email: "ayush@gog.com", role: "HOI", isOnboarded: true, dept: "Academics", designation: "Head of Institute", status: "Active", joiningDate: "2024-02-01", salary: 85000, location: "sage-bhopal", phone: "9876543213", managerLevel: "HOI", chancesRemaining: 3 },
    { id: "HOI002", name: "Sachin Kumar Gupta", email: "sachin@gog.com", role: "HOI", isOnboarded: true, dept: "Admissions", designation: "Head of Institute", status: "Active", joiningDate: "2024-04-05", salary: 90000, location: "bansal-kokta", phone: "9876543214", managerLevel: "HOI", chancesRemaining: 3 },
    { id: "HOI003", name: "Sidhartha Paikaray", email: "sidhartha@gog.com", role: "HOI", isOnboarded: true, dept: "Operations", designation: "Head of Institute", status: "Active", joiningDate: "2024-03-15", salary: 88000, location: "gyanveer-university", phone: "9876543215", managerLevel: "HOI", chancesRemaining: 3 }
];

const subordinates = [];
const locations = ["bansal-mandideep", "scope-global", "bansal-kokta", "gyanveer-university", "sage-bhopal", "centurion-vizianagaram", "centurion-paralakhemundi", "centurion-bhubaneswar", "sage-university-indore"];

const indianNames = [
    "Aarav", "Advik", "Akash", "Ananya", "Arjun", "Diya", "Ishaan", "Kabir", "Meera", "Neha",
    "Pranav", "Riya", "Saanvi", "Shiva", "Tanvi", "Vihan", "Zoya", "Aryan", "Isha", "Karthik",
    "Kavya", "Manish", "Nisha", "Rahul", "Sanya", "Varun", "Anjali", "Dev", "Kyra", "Reyansh"
];

const opsNames = [
    "Sanjay", "Vikram", "Priyanka", "Amit", "Rohan", "Deepak", "Sunita", "Rajesh", "Kiran", "Aditya"
];

// Generate 30 unique reportees for EACH HOI
hois.forEach((hoi, index) => {
    // 10 OMs per HOI
    for (let i = 1; i <= 10; i++) {
        subordinates.push({
            id: `OM-${index + 1}-${i < 10 ? '0' : ''}${i}`,
            name: `${opsNames[i - 1]} (OM ${index + 1})`,
            email: `om.${index + 1}.${i}@gog.com`,
            role: "OM",
            isOnboarded: true,
            dept: "Operations",
            designation: "Operations Manager",
            status: "Active",
            joiningDate: "2024-01-01",
            salary: 60000 + (index * 2000),
            location: locations[index % locations.length],
            phone: `98100${index}${i < 10 ? '0' : ''}${i}`,
            reportsTo: hoi.id,
            chancesRemaining: 3
        });
    }

    // 20 Faculty per HOI
    for (let i = 1; i <= 20; i++) {
        subordinates.push({
            id: `FAC-${index + 1}-${i < 10 ? '0' : ''}${i}`,
            name: `${indianNames[i - 1]} (FAC ${index + 1})`,
            email: `faculty.${index + 1}.${i}@gog.com`,
            role: "FACULTY",
            isOnboarded: true,
            dept: "Academics",
            designation: hoi.id === "HOI001" ? "Associate Professor" : "Assistant Professor",
            status: "Active",
            joiningDate: "2024-02-01",
            salary: 40000 + (index * 1500),
            location: locations[(index + 1) % locations.length],
            phone: `97100${index}${i < 10 ? '0' : ''}${i}`,
            reportsTo: hoi.id,
            chancesRemaining: 3
        });
    }
});

const allEmployees = [...founders, ...coreStaff, ...hois, ...subordinates];

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully");

        console.log("Clearing existing employees...");
        await Employee.deleteMany({});
        console.log("Cleared existing employees");

        console.log("Inserting new employees...");
        await Employee.insertMany(allEmployees);
        console.log(`Seeded ${allEmployees.length} employees successfully`);

        await mongoose.disconnect();
        console.log("Connection closed");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding employees:", error);
        process.exit(1);
    }
}

seed();
