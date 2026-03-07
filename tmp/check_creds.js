const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const Employee = require('../src/models/Employee').default;

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const founders = await Employee.find({ role: "FOUNDER" }).lean();
        console.log("Founders:", founders.map(f => ({ email: f.email, password: f.password })));

        const someEmployees = await Employee.find({ role: { $ne: "FOUNDER" } }).limit(5).lean();
        console.log("Sample Employees:", someEmployees.map(e => ({ email: e.email, password: e.password, dob: e.dateOfBirth })));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkData();
