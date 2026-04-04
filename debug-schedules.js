const mongoose = require('mongoose');
const MONGODB_URI = "mongodb://localhost:27017/gog_ms"; // Assuming standard local URI

async function checkSchedules() {
    try {
        await mongoose.connect(MONGODB_URI);
        const WorkSchedule = mongoose.connection.collection('workschedules');
        const schedules = await WorkSchedule.find({}).limit(5).toArray();
        console.log("SCHEDULES DATA:", JSON.stringify(schedules, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchedules();
