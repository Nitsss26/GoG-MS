const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI;

const employeeSchema = new mongoose.Schema({}, { strict: false });
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const verify = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        
        console.log("--- Role Counts ---");
        const roles = await Employee.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
        console.log(roles);

        console.log("--- HOI Specific Check ---");
        const hois = await Employee.find({ role: "HOI" }, { name: 1, email: 1, role: 1 });
        console.log(hois);

        console.log("--- OM Specific Check ---");
        const oms = await Employee.find({ role: "OM" }, { name: 1, email: 1, role: 1 });
        console.log(oms);

        console.log("--- TL Check (Nitesh) ---");
        const tl = await Employee.findOne({ email: "nitesh@geeksofgurukul.com" });
        console.log(tl ? "Found: " + tl.name + " (" + tl.role + ")" : "Not Found!");

        console.log("--- Verification Complete ---");
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

verify();
