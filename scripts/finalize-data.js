const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI;

const employeeSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    role: String,
    designation: String
}, { strict: false });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const finalizeRoles = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected.");

        const roleMappings = [
            // Founders
            { email: "ceo@geeksofgurukul.com", role: "FOUNDER", designation: "Chief Executive Officer" },
            { email: "cto@geeksofgurukul.com", role: "FOUNDER", designation: "Chief Technology Officer" },
            { email: "coo@geeksofgurukul.com", role: "FOUNDER", designation: "Chief Operating Officer" },
            // HR
            { email: "hr@geeksofgurukul.com", role: "HR", designation: "HR" },
            // AD
            { email: "raj@geeksofgurukul.com", role: "AD", designation: "AD" },
            // TL
            { email: "nitesh@geeksofgurukul.com", role: "TL", designation: "TL" },
            // HOIs (3)
            { email: "ayush.chouhan@geeksofgurukul.com", role: "HOI", designation: "HOI" },
            { email: "sachin@geeksofgurukul.com", role: "HOI", designation: "HOI" },
            { email: "sidhartha.paikaray@geeksofgurukul.com", role: "HOI", designation: "HOI" },
            // OMs (4)
            { email: "prerna.saluja@geeksofgurukul.com", role: "OM", designation: "Operation Manager" },
            { email: "aniket.chouhan@geeksofgurukul.com", role: "OM", designation: "Operation Manager" },
            { email: "prakash@geeksofgurukul.com", role: "OM", designation: "Operation Manager" },
            { email: "ziniwalyamini@gmail.com", role: "OM", designation: "Operation Manager" }
        ];

        const mappedEmails = roleMappings.map(m => m.email);

        // First, set everyone to PROFESSOR if they are not in the special list
        const resetRes = await Employee.updateMany(
            { email: { $nin: mappedEmails } },
            { $set: { role: "PROFESSOR", designation: "SDE & Professor" } }
        );
        console.log(`Reset ${resetRes.modifiedCount} employees to PROFESSOR/Professor.`);

        // Now apply specific mappings
        for (const mapping of roleMappings) {
            const res = await Employee.updateMany(
                { email: mapping.email },
                { $set: { role: mapping.role, designation: mapping.designation } }
            );
            console.log(`Updated ${mapping.email} to ${mapping.role}. Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);
        }

        console.log("Role consistency check complete.");
    } catch (e) {
        console.error("Error finalizing roles:", e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

finalizeRoles();
