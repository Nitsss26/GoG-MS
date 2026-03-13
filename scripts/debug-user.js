const mongoose = require('mongoose');
const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const employeeSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    password: { type: String, select: true } // Ensure password is selected
}, { collection: 'employees' });

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

async function checkUser() {
    try {
        await mongoose.connect(MONGODB_URI);
        const user = await Employee.findOne({ email: "aman.meena@geeksofgurukul.com" }).select('+password');
        if (user) {
            console.log("User Found:");
            console.log("Name:", user.name);
            console.log("Email:", user.email);
            console.log("Password in DB:", user.password);
        } else {
            console.log("User not found in database.");
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkUser();
