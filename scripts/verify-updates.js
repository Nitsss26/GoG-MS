const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const employeeSchema = new mongoose.Schema({
    id: String,
    name: String,
    location: String
});

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB for verification");

        const testNames = ["Abhishek Tiwari", "Yamini", "Ankit Singh", "Ravi Ranjan"];
        
        for (const name of testNames) {
            const emp = await Employee.findOne({ name: new RegExp(name, 'i') });
            if (emp) {
                console.log(`Employee: ${emp.name}, Location: ${emp.location}`);
            } else {
                console.log(`Employee not found: ${name}`);
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Verification failed:", error);
        process.exit(1);
    }
}

verify();
