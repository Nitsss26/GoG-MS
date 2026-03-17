const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('GoG-MS');
        const employees = db.collection('employees');
        const workSchedules = db.collection('workschedules');

        const newIds = ["EMP503", "EMP504", "EMP505"];

        console.log('--- Verifying Employees ---');
        const empCount = await employees.countDocuments({ id: { $in: newIds } });
        console.log(`Employees found: ${empCount} / 3`);

        if (empCount > 0) {
            const empDetails = await employees.find({ id: { $in: newIds } }, { projection: { id: 1, name: 1, role: 1, location: 1 } }).toArray();
            console.log(JSON.stringify(empDetails, null, 2));
        }

        console.log('\n--- Verifying Schedules ---');
        const schedCount = await workSchedules.countDocuments({ employeeId: { $in: newIds } });
        console.log(`Schedule records found: ${schedCount} / 18`);

        if (schedCount > 0) {
            const schedSample = await workSchedules.find({ employeeId: "EMP503" }).limit(1).toArray();
            console.log('Sample Schedule Record (EMP503):');
            console.log(JSON.stringify(schedSample, null, 2));
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
