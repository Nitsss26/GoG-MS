import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LeaveRequestSchema = new mongoose.Schema({
    employeeId: { type: String },
    startDate: { type: String },
    endDate: { type: String },
    appliedAt: { type: String },
    proofUrls: [String]
}, { strict: false });

const ReimbursementClaimSchema = new mongoose.Schema({
    employeeId: { type: String },
    date: { type: String },
    proofUrls: [String]
}, { strict: false });

const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
const ReimbursementClaim = mongoose.models.ReimbursementClaim || mongoose.model('ReimbursementClaim', ReimbursementClaimSchema);

async function check() {
    await mongoose.connect(process.env.MONGODB_URI!);
    
    console.log("=== Leave Requests (with proofs) ===");
    const leaves = await LeaveRequest.find({ proofUrls: { $ne: [] } }).limit(2);
    leaves.forEach(l => console.log(JSON.stringify(l, null, 2)));

    console.log("=== Leave Requests (EMP102) ===");
    const leaves102 = await LeaveRequest.find({ employeeId: "EMP102" }).limit(2);
    leaves102.forEach(l => console.log(JSON.stringify(l, null, 2)));

    console.log("\n=== Reimbursement Claims ===");
    const claims = await ReimbursementClaim.find({ employeeId: "EMP123" }).limit(2);
    claims.forEach(c => console.log(JSON.stringify(c, null, 2)));

    await mongoose.disconnect();
}
check();
