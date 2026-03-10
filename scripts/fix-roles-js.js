const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hrms";

const employeeSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    role: String,
    designation: String,
    location: String,
    reportsTo: String,
    status: String
}, { strict: false });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const fixRoles = async () => {
    try {
        console.log("Connecting to MongoDB:", MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.");

        const updates = [
            { email: "ayush.chouhan@geeksofgurukul.com", role: "HOI", designation: "HOI" },
            { email: "sachin@geeksofgurukul.com", role: "HOI", designation: "HOI" },
            { email: "sidhartha.paikaray@geeksofgurukul.com", role: "HOI", designation: "HOI" },
            { email: "anirudha@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "sujal@geeksofgurukul.com", role: "PROFESSOR", designation: "Professor" },
            { email: "hr@geeksofgurukul.com", role: "HR", designation: "HR" },
            { email: "sahil@geeksofgurukul.com", role: "PROFESSOR", designation: "Professor" },
            { email: "guguloth@geeksofgurukul.com", role: "PROFESSOR", designation: "Professor" },
            { email: "nishal@geeksofgurukul.com", role: "PROFESSOR", designation: "Professor" },
            { email: "raj@geeksofgurukul.com", role: "AD", designation: "AD" },
            { email: "amit.singh@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "shekhar.kumar@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "mriganka@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "sumit.maity@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "aman.meena@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "rahul.kumar@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "revanth@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "verman@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "mukesh.kumar@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "chandan@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "sushant.baranawal@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "pranjul.sahu@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "vivek.haldkar@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "avikal.shrivastava@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "ankit.singh@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "prerna.saluja@geeksofgurukul.com", role: "OM", designation: "Operation Manager" },
            { email: "ravi.bhushan@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "aniket.chouhan@geeksofgurukul.com", role: "OM", designation: "Operation Manager" },
            { email: "nitesh@geeksofgurukul.com", role: "TL", designation: "TL" },
            { email: "raviranjan@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "siddardhareddy@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "ayush.sahu@geeksofgurukul.com", role: "PROFESSOR", designation: "SDE & Professor" },
            { email: "prakash@geeksofgurukul.com", role: "OM", designation: "Operation Manager" },
            { email: "ziniwalyamini@gmail.com", role: "OM", designation: "Operation Manager" }
        ];

        for (const update of updates) {
            const res = await Employee.updateMany(
                { email: update.email },
                { $set: { role: update.role, designation: update.designation } }
            );
            console.log("Email:", update.email, "Matched:", res.matchedCount, "Modified:", res.modifiedCount);
        }

    } catch (e) {
        console.error("Error connecting to mongo", e);
    } finally {
        await mongoose.disconnect();
        console.log("Done.");
        process.exit(0);
    }
}

fixRoles();
