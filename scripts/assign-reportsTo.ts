import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup minimal schema to update
const EmployeeSchema = new mongoose.Schema({}, { strict: false, collection: 'employees' });
const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log("Connected to DB");

        const hois = await Employee.find({ role: 'HOI' }).lean();
        if (hois.length === 0) {
            console.log("No HOIs found!");
            process.exit(0);
        }

        console.log("Found HOIs:", hois.map((h: any) => h.id));
        const hoiIds = hois.map((h: any) => h.id);

        const unassigned = await Employee.find({
            role: { $in: ['OM', 'FACULTY', 'PROFESSOR'] }
        });

        console.log(`Found ${unassigned.length} OMs/Faculties to update.`);

        for (let i = 0; i < unassigned.length; i++) {
            const emp = unassigned[i];
            const assignedHoi = hoiIds[i % hoiIds.length];
            // Fix reportsTo to use correct string ID
            await Employee.updateOne({ _id: emp._id }, { $set: { reportsTo: assignedHoi } });
            console.log(`Assigned [${emp.get('id') || emp._id}] to HOI Custom ID: ${assignedHoi}`);
        }

        console.log("Done!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
