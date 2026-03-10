const INITIAL_EMPLOYEES = [
    { id: "FOUNDER001", name: "Ajay Katana", role: "FOUNDER" },
    { id: "HR001", name: "Vivek Yadav", role: "HR" },
    { id: "AD001", name: "Raj Kumar Sahoo", role: "AD" },
    { id: "HOI001", name: "Ayush Chauhan", role: "HOI" },
    { id: "HOI002", name: "Sachin Kumar", role: "HOI" },
    { id: "HOI003", name: "Sidhartha Paikaray", role: "HOI" },
    ...Array.from({ length: 30 }, (_, i) => ({
        id: `FAC${String(i + 1).padStart(3, '0')}`,
        name: `Faculty Member ${i + 1}`,
        role: "FACULTY"
    }))
];

function getReportees(managerId, employees) {
    const manager = employees.find(e => e.id === managerId);
    if (!manager) return [];
    if (manager.role === "FOUNDER") return employees.filter(e => e.role !== "FOUNDER");
    if (manager.role === "HR") return employees.filter(e => ["AD", "TL", "HOI", "OM", "FACULTY", "PROFESSOR"].includes(e.role));
    if (manager.role === "AD") return employees.filter(e => ["HOI", "OM", "FACULTY", "PROFESSOR"].includes(e.role));
    if (manager.role === "HOI") return employees.filter(e => ["OM", "FACULTY", "PROFESSOR"].includes(e.role));
    return [];
}

const employees = INITIAL_EMPLOYEES;
console.log("HOI_COUNT=" + getReportees("HOI001", employees).length);
console.log("AD_COUNT=" + getReportees("AD001", employees).length);
console.log("HR_COUNT=" + getReportees("HR001", employees).length);
console.log("FOUNDER_COUNT=" + getReportees("FOUNDER001", employees).length);
