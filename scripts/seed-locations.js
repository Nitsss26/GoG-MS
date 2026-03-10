const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const locations = [
    {
        id: "bansal-mandideep",
        name: "Bansal College of Engineering, BGI, - Mandideep",
        shortName: "Bansal Mandideep",
        lat: 23.03720391098222,
        lng: 77.55742391129526,
        radiusKm: 2,
        address: "NH-12, near Bhopal, MP, 462046",
        city: "Mandideep",
        state: "Madhya Pradesh"
    },
    {
        id: "scope-global",
        name: "Scope Global Skills University (SGSU)",
        shortName: "SGSU",
        lat: 23.153766846215035,
        lng: 77.47917070919176,
        radiusKm: 2,
        address: "Central India's 1st Skill University, Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "bansal-kokta",
        name: "Bansal Institute of Research Technology & Science, Kokta",
        shortName: "Bansal Kokta",
        lat: 23.32772697940546,
        lng: 77.50723871685491,
        radiusKm: 2,
        address: "Raisen Road, Bhopal, MP, 462021",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "gyanveer",
        name: "Gyanveer University (GU)",
        shortName: "Gyanveer University",
        lat: 23.87427599889863,
        lng: 78.60787718177589,
        radiusKm: 2,
        address: "Village-Maa-Emliya, Rahatgarh, Sagar, MP, 470115",
        city: "Sagar",
        state: "Madhya Pradesh"
    },
    {
        id: "sage-bhopal",
        name: "Sage University Bhopal",
        shortName: "SAGE Bhopal",
        lat: 23.282547948166666,
        lng: 77.45699878273547,
        radiusKm: 2,
        address: "Ayodhya Nagar, Bhopal, MP, 462041",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "centurion-vizianagaram",
        name: "Centurion University Vizianagaram",
        shortName: "CUTM Vizianagaram",
        lat: 18.18928156196229,
        lng: 83.39240426672204,
        radiusKm: 2,
        address: "Rollavaka Village Bondapalli, AP, 535003",
        city: "Vizianagaram",
        state: "Andhra Pradesh"
    },
    {
        id: "centurion-paralakhemundi",
        name: "Centurion University (CUTM) Paralakhemundi",
        shortName: "CUTM PKD",
        lat: 18.818788224302555,
        lng: 84.1437052960369,
        radiusKm: 2,
        address: "Alluri Nagar, P.O. R Sitapur, Uppalada, PKD, Odisha",
        city: "Paralakhemundi",
        state: "Odisha"
    },
    {
        id: "centurion-bhubaneswar",
        name: "Centurion University (CUTM) Bhubaneswar",
        shortName: "CUTM Bhubaneswar",
        lat: 20.187330026231606,
        lng: 85.71089556297753,
        radiusKm: 2,
        address: "Ramachandrapur, Jatni, Bhubaneswar, Odisha, 752050",
        city: "Bhubaneswar",
        state: "Odisha"
    },
    {
        id: "sage-indore",
        name: "Sage University Indore",
        shortName: "SAGE Indore",
        lat: 22.636632721551177,
        lng: 75.85187466499627,
        radiusKm: 2,
        address: "Rau Bypass Road, Indore, MP, 452020",
        city: "Indore",
        state: "Madhya Pradesh"
    },
    {
        id: "oriental-indore",
        name: "Oriental University",
        shortName: "Oriental University",
        lat: 22.803159201664613,
        lng: 75.85620736685242,
        radiusKm: 2,
        address: "Sanwer Road, Jakhya, Indore, MP, 453555",
        city: "Indore",
        state: "Madhya Pradesh"
    }
];

const locationSchema = new mongoose.Schema({
    id: String,
    name: String,
    shortName: String,
    lat: Number,
    lng: Number,
    radiusKm: Number,
    address: String,
    city: String,
    state: String
});

const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB successfully");

        console.log("Clearing existing locations...");
        await Location.deleteMany({});
        console.log("Cleared existing locations");

        console.log("Inserting new locations...");
        await Location.insertMany(locations);
        console.log(`Seeded ${locations.length} locations successfully`);

        await mongoose.disconnect();
        console.log("MongoDB connection closed");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding locations:", error);
        process.exit(1);
    }
}

seed();
