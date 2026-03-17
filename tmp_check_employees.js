const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('GoG-MS');
        const employees = db.collection('employees');
        
        console.log('--- Last 10 Employees ---');
        const lastEmployees = await employees.find({}, { projection: { id: 1, name: 1, role: 1, designation: 1 } })
            .sort({ id: -1 })
            .limit(10)
            .toArray();
        console.log(JSON.stringify(lastEmployees, null, 2));

        console.log('\n--- Checking if new employees already exist ---');
        const newNames = ["Mayank Choudhary", "Priyanka Kumawat", "Siddhant Shrivastava"];
        const existing = await employees.find({ name: { $in: newNames } }).toArray();
        console.log(JSON.stringify(existing, null, 2));

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
