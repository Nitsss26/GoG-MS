const mongoose = require('mongoose');
const MONGODB_URI = "mongodb://localhost:27017/gog_ms"; 

async function verifyReportees() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Employee = mongoose.connection.collection('employees');
        const SprintPlan = mongoose.connection.collection('sprintplans');
        
        // 1. Check an HOI (e.g. EMP135)
        const managerId = "EMP135";
        const reportees = await Employee.find({ reportsTo: managerId }).toArray();
        console.log(`HOI ${managerId} has ${reportees.length} reportees:`, reportees.map(r => r.id));
        
        if (reportees.length > 0) {
            const reporteeId = reportees[0].id;
            const plans = await SprintPlan.find({ facultyId: reporteeId }).toArray();
            console.log(`Reportee ${reporteeId} has ${plans.length} sprint plans.`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verifyReportees();
