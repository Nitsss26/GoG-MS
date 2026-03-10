const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI not found");
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(); // Uses db name from URI if present, otherwise default
        const employees = db.collection('employees');
        const count = await employees.countDocuments();
        console.log('Total Employees:', count);

        const hois = await employees.find({ role: 'HOI' }).toArray();
        for (const hoi of hois) {
            const reportees = await employees.countDocuments({ reportsTo: hoi.id });
            console.log(`HOI: ${hoi.name} (${hoi.id}) Reportees: ${reportees}`);
        }
    } finally {
        await client.close();
    }
}
run().catch(console.error);
