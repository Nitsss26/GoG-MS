// Manual test of getAuthorityEmails logic
const INITIAL_EMPLOYEES = [
    { id: "FND001", name: "Chintan Vatsa Jha", email: "ceo@geeksofgurukul.com", role: "FOUNDER", reportsTo: [] },
    { id: "EMP101", name: "Ayush Chauhan", email: "ayush@gog.com", role: "HOI", reportsTo: ["FND001"] },
    { id: "EMP108", name: "Raj Kumar Sahoo", email: "raj@geeksofgurukul.com", role: "AD", reportsTo: ["FND001"] },
    { id: "EMP104", name: "Vivek Yadav", email: "hr@geeksofgurukul.com", role: "HR", reportsTo: ["FND001"] },
    { id: "EMP135", name: "Sidhartha Paikaray", email: "sidhartha@gog.com", role: "HOI", reportsTo: ["FND001"] },
    { id: "EMP100", name: "Anirudha Rajodiya", email: "anirudha@geeksofgurukul.com", role: "PROFESSOR", reportsTo: ["EMP135"] }
];

const authorities = new Set();
const findManagers = (empId, allEmployees) => {
    const emp = allEmployees.find(e => e.id === empId);
    if (!emp || !emp.reportsTo) return;

    const managerIds = Array.isArray(emp.reportsTo) ? emp.reportsTo : [emp.reportsTo];
    managerIds.forEach(mId => {
        const manager = allEmployees.find(e => e.id === mId);
        if (manager && manager.email) {
            authorities.add(manager.email.toLowerCase());
            findManagers(manager.id, allEmployees);
        }
    });
};

const getAuthorityEmails = (employee, allEmployees) => {
    authorities.clear();
    if (employee && employee.id) findManagers(employee.id, allEmployees);

    allEmployees.filter(e => e.role === "FOUNDER" && e.email).forEach(e => authorities.add(e.email.toLowerCase()));
    allEmployees.filter(e => e.role === "HR" && e.email).forEach(e => authorities.add(e.email.toLowerCase()));
    allEmployees.filter(e => e.role === "AD" && e.email).forEach(e => authorities.add(e.email.toLowerCase()));

    if (employee && employee.email) authorities.add(employee.email.toLowerCase());
    return Array.from(authorities);
};

// Test for PROFESSOR (Anirudha reports to Sidhartha HOI)
const professor = INITIAL_EMPLOYEES.find(e => e.id === "EMP100");
const res = getAuthorityEmails(professor, INITIAL_EMPLOYEES);

console.log("Testing for PROFESSOR (Anirudha):");
console.log("Expected: Sidhartha (HOI), Chintan (Founder), Vivek (HR), Raj (AD), Anirudha (Self)");
console.log("Actual:", res);

// Test for HOI (Ayush reports to Founder)
const hoi = INITIAL_EMPLOYEES.find(e => e.id === "EMP101");
const resHoi = getAuthorityEmails(hoi, INITIAL_EMPLOYEES);
console.log("\nTesting for HOI (Ayush):");
console.log("Expected: Chintan (Founder), Vivek (HR), Raj (AD), Ayush (Self), sidhartha (HOI role is not global, so sidhartha won't be here unless he's a founder/hr/ad)");
console.log("Actual:", resHoi);
