const INITIAL_EMPLOYEES = [
    { id: "FOUNDER001", name: "Ajay Katana", role: "FOUNDER", email: "ajay@gog.com" },
    { id: "HR001", name: "Vivek Yadav", role: "HR", email: "vivek@gog.com" },
    { id: "AD001", name: "Raj Kumar Sahoo", role: "AD", email: "raj@gog.com" },
    { id: "HOI001", name: "Ayush Chauhan", role: "HOI", email: "ayush@gog.com" },
    { id: "HOI002", name: "Sachin Kumar", role: "HOI", email: "sachin@gog.com" },
    { id: "HOI003", name: "Sidhartha Paikaray", role: "HOI", email: "sid@gog.com" },
    ...Array.from({ length: 30 }, (_, i) => ({
        id: `FAC${String(i + 1).padStart(3, '0')}`,
        name: `Faculty Member ${i + 1}`,
        role: i < 15 ? "FACULTY" : "PROFESSOR",
        email: `fac${i + 1}@gog.com`,
        status: "Active"
    }))
];

function getReportees(managerId, employees) {
    const manager = employees.find(e => e.id === managerId);
    if (!manager) return [];

    if (manager.role === "FOUNDER") {
        return employees.filter(e => e.role !== "FOUNDER");
    }
    if (manager.role === "HR") {
        return employees.filter(e => ["AD", "TL", "HOI", "OM", "FACULTY", "PROFESSOR"].includes(e.role));
    }
    if (manager.role === "AD") {
        return employees.filter(e => ["HOI", "OM", "FACULTY", "PROFESSOR"].includes(e.role));
    }
    if (manager.role === "HOI") {
        return employees.filter(e => ["OM", "FACULTY", "PROFESSOR"].includes(e.role));
    }

    return employees.filter(e => e.reportsTo && (Array.isArray(e.reportsTo) ? e.reportsTo.includes(managerId) : e.reportsTo === managerId));
}

const employees = INITIAL_EMPLOYEES;
console.log("Hierarchy Verification Results:");
console.log("------------------------------");
console.log(`HOI001: Found ${getReportees("HOI001", employees).length} reportees`);
console.log(`AD001: Found ${getReportees("AD001", employees).length} reportees`);
console.log(`HR001: Found ${getReportees("HR001", employees).length} reportees`);
console.log(`Founder: Found ${getReportees("FOUNDER001", employees).length} reportees`);
