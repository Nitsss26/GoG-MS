const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI;

const employeeSchema = new mongoose.Schema({}, { strict: false });
const attendanceSchema = new mongoose.Schema({}, { strict: false });
const reimbursementSchema = new mongoose.Schema({}, { strict: false });
const noticeSchema = new mongoose.Schema({}, { strict: false });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
const Reimbursement = mongoose.models.Reimbursement || mongoose.model("Reimbursement", reimbursementSchema);
const Notice = mongoose.models.Notice || mongoose.model("Notice", noticeSchema);

const checkData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const tlEmail = "nitesh@geeksofgurukul.com";
        const tl = await Employee.findOne({ email: tlEmail });
        
        if (!tl) {
            console.log("TL Not Found!");
            process.exit(0);
        }

        console.log("--- TL Profile Fields ---");
        console.log(`ID: ${tl.id}`);
        console.log(`Joining Date: ${tl.joiningDate}`);
        console.log(`Designation Date: ${tl.designationDate}`);
        console.log(`BiWeeklyScores Count: ${tl.biWeeklyScores ? tl.biWeeklyScores.length : 0}`);
        if (tl.biWeeklyScores) console.log(JSON.stringify(tl.biWeeklyScores, null, 2));

        const tlId = tl.id;
        const reimb = await Reimbursement.find({ employeeId: tlId });
        console.log(`\nReimbursements for ${tlId}: ${reimb.length}`);
        reimb.forEach(r => console.log(`- ${r.title}: ${r.amount} (${r.status})`));

        const notices = await Notice.find().sort({ createdAt: -1 }).limit(5);
        console.log(`\nLast 5 Notices:`);
        notices.forEach(n => console.log(`- ${n.title} (${n.createdAt})`));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
};

checkData();
