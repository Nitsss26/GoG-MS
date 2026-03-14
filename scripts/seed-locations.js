const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB Connection
const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const locationSchema = new mongoose.Schema({
    id: String,
    name: String,
    shortName: String,
    lat: mongoose.Schema.Types.Mixed, // Use Mixed to handle string/number
    lng: mongoose.Schema.Types.Mixed,
    radiusKm: Number,
    address: String,
    city: String,
    state: String
}, { strict: false }); // Allow extra fields like __v or _id

const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB successfully");

        const jsonPath = path.join(__dirname, '../GoG-MS.locations.json');
        console.log(`Reading locations from ${jsonPath}...`);
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const locations = JSON.parse(rawData);

        console.log(`Found ${locations.length} locations in JSON.`);

        console.log("Clearing existing locations...");
        await Location.deleteMany({});
        console.log("Cleared existing locations");

        console.log("Inserting new locations...");
        // Strip _id if it exists to let MongoDB generate new ones or use the provided ones if they are valid
        // But the user might want the exact same IDs. However, Mongoose might complain about $oid.
        const cleanedLocations = locations.map(loc => {
            const newLoc = { ...loc };
            if (newLoc._id) delete newLoc._id;
            return newLoc;
        });

        await Location.insertMany(cleanedLocations);
        console.log(`Seeded ${cleanedLocations.length} locations successfully`);

        await mongoose.disconnect();
        console.log("MongoDB connection closed");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding locations:", error);
        process.exit(1);
    }
}

seed();
