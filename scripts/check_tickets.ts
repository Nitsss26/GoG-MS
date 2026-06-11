import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TicketSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    raisedBy: { type: String, required: true },
    employeeName: { type: String, required: true },
    createdAt: { type: String, required: true },
    proofUrls: [String]
}, { strict: false });

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

async function check() {
    await mongoose.connect(process.env.MONGODB_URI!);
    const tickets = await Ticket.find({ raisedBy: "EMP111" });
    console.log("Tickets for EMP111:");
    tickets.forEach(t => console.log(JSON.stringify(t, null, 2)));

    const tickets2 = await Ticket.find({ proofUrls: { $ne: [] } }).limit(5);
    console.log("\nSample tickets with proofs:");
    tickets2.forEach(t => console.log(JSON.stringify(t, null, 2)));

    await mongoose.disconnect();
}
check();
