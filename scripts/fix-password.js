const mongoose = require('mongoose');
const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const employeeSchema = new mongoose.Schema({
    email: String,
    password: { type: String, select: true }
}, { collection: 'employees' });

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

async function updatePassword() {
    try {
        await mongoose.connect(MONGODB_URI);
        const result = await Employee.updateOne(
            { email: "aman.meena@geeksofgurukul.com" },
            { $set: { password: "Aman@4488" } }
        );
        console.log("Update Result:", result);
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

updatePassword();
