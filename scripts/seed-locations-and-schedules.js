const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const locationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    shortName: String,
    lat: Number,
    lng: Number,
    radiusKm: { type: Number, default: 2 },
    address: String,
    city: String,
    state: String
});

const employeeSchema = new mongoose.Schema({
    id: String,
    name: String,
    location: String,
    collegeName: String
});

const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);
const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

const locations = [
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
        id: "SDBC",
        name: "Sushila Devi Bansal College of Technology",
        shortName: "SDBC",
        lat: 22.59777316921307,
        lng: 75.78727275172537,
        radiusKm: 2,
        address: "AB Road, Umaria, Near Rau, Indore, Madhya Pradesh 453331",
        city: "Indore",
        state: "Madhya Pradesh"
    },
    {
        id: "sgsu",
        name: "Scope Global Skills University (SGSU)",
        shortName: "SGSU",
        lat: 23.2325,
        lng: 77.4332,
        radiusKm: 2,
        address: "Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "bansal-kokta",
        name: "Bansal Institute of Research Technology & Science, Kokta",
        shortName: "BGI Kokta",
        lat: 23.32772697940546,
        lng: 77.50723871685491,
        radiusKm: 2,
        address: "Raisen Road, Bhopal, MP, 462021",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "bansal-mandideep",
        name: "Bansal College of Engineering, BGI, - Mandideep",
        shortName: "BGI Mandideep",
        lat: 23.03720391098222,
        lng: 77.55742391129526,
        radiusKm: 2,
        address: "NH-12, near Bhopal, MP, 462046",
        city: "Mandideep",
        state: "Madhya Pradesh"
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
        id: "centurion-paralakhemundi",
        name: "Centurion University (CUTM) Paralakhemundi",
        shortName: "CUTM Paralakhemundi",
        lat: 18.818788224302555,
        lng: 84.1437052960369,
        radiusKm: 2,
        address: "Alluri Nagar, P.O. R Sitapur, Uppalada, PKD, Odisha",
        city: "Paralakhemundi",
        state: "Odisha"
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
    }
];

const employeeUpdates = [
    { name: /Ankit Singh/i, location: "sage-bhopal" },
    { name: /Ayush Sahu/i, location: "sage-bhopal" },
    { name: /Ravi Bhushan Pratap/i, location: "sgsu" },
    { name: /Suman Rajak/i, location: "sgsu" },
    { name: /Sahil Burde/i, location: "bansal-kokta" },
    { name: /Pranjul Sahu/i, location: "bansal-kokta" },
    { name: /Mukesh Kumar/i, location: "bansal-kokta" },
    { name: /Amit Singh Patel/i, location: "bansal-kokta" },
    { name: /Mayank Choudhary/i, location: "bansal-kokta" },
    { name: /Priyanka Kumawat/i, location: "bansal-kokta" },
    { name: /Sujal Verma/i, location: "bansal-mandideep" },
    { name: /Prerna Saluja/i, location: "bansal-kokta" },
    { name: /Rahul/i, location: "sage-indore" },
    { name: /Siddhant/i, location: "sage-indore" },
    { name: /Nishal Caleb/i, location: "oriental-indore" },
    { name: /Sumit Maity/i, location: "oriental-indore" },
    { name: /Avikal/i, location: "SDBC" },
    { name: /Vivek/i, location: "SDBC" },
    { name: /Vinay/i, location: "SDBC" },
    { name: /Anirudh/i, location: "SDBC" },
    { name: /Shekhar/i, location: "SDBC" },
    { name: /Aniket Chouhan/i, location: "SDBC" },
    { name: /Ravi Ranjan/i, location: "centurion-bhubaneswar" },
    { name: /Vipul Kumar/i, location: "centurion-bhubaneswar" },
    { name: /Aman/i, location: "centurion-bhubaneswar" },
    { name: /Verman/i, location: "centurion-bhubaneswar" },
    { name: /Siddharda/i, location: "centurion-bhubaneswar" },
    { name: /Mriganka/i, location: "centurion-paralakhemundi" },
    { name: /Sushant/i, location: "centurion-paralakhemundi" },
    { name: /Chandan/i, location: "centurion-paralakhemundi" },
    { name: /Jeet/i, location: "centurion-vizianagaram" },
    { name: /K\. Revanth/i, location: "centurion-vizianagaram" }
];

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        // 1. Seed Locations
        for (const loc of locations) {
            await Location.findOneAndUpdate({ id: loc.id }, loc, { upsert: true, new: true });
            console.log(`Upserted Location: ${loc.name} (${loc.id})`);
        }

        // 2. Update Employee Locations (Best effort based on name)
        for (const update of employeeUpdates) {
            const result = await Employee.updateMany({ name: update.name }, { $set: { location: update.location, collegeName: "" } });
            console.log(`Updated ${result.modifiedCount} employees matching ${update.name} to location ${update.location}`);
        }

        await mongoose.disconnect();
        console.log("Seeding completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
}

seed();
