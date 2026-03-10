const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();
        const employees = db.collection('employees');

        const ayush = await employees.findOne({ email: "ayush.chouhan@geeksofgurukul.com" });
        console.log('--- Sample: Ayush ---');
        console.log('ID:', ayush?.id);
        console.log('Password:', ayush?.password);
        console.log('Role:', ayush?.role);
        console.log('ReportsTo:', ayush?.reportsTo);
        console.log('DOB Field:', ayush?.date_of_birth);

        const raj = await employees.findOne({ email: "raj@geeksofgurukul.com" });
        console.log('--- Sample: Raj ---');
        console.log('ID:', raj?.id);
        console.log('ReportsTo:', raj?.reportsTo);

        const staff = await employees.findOne({ role: "PROFESSOR" });
        console.log('--- Sample: Staff ---');
        console.log('Name:', staff?.name);
        console.log('ReportsTo:', staff?.reportsTo);
        console.log('Resume Link:', staff?.upload_your_resume);

    } finally {
        await client.close();
    }
}
check().catch(console.error);
