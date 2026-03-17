const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('GoG-MS');
        const employees = db.collection('employees');
        
        const details = await employees.find({ id: { $in: ["EMP501", "EMP502"] } }).toArray();
        console.log(JSON.stringify(details, null, 2));

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
