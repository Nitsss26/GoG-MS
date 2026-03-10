const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/context/AuthContext.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix template literals: replace `${ ... }` with `${...}`
content = content.replace(/\$\{\s+([^}]+?)\s+\}/g, '${$1}');

// Fix weird `${ h.id } ` (with trailing space)
content = content.replace(/\$\{\s*([^}]+?)\s*\}\s+/g, '${$1}');

// Specific fix for the ones I saw in view_file
content = content.replace(/\$\{\s+user\.id\s+\}/g, '${user.id}');
content = content.replace(/\$\{\s+user\.role\s+\}/g, '${user.role}');
content = content.replace(/\$\{\s+uid\(\)\s+\}/g, '${uid()}');

// Remove duplicate declarations
// INITIAL_ATTENDANCE is at 200 and 366
// INITIAL_NOTICES is at 199 and 573
// I'll just remove the ones at 200 and 199 if they are empty
content = content.replace(/const INITIAL_NOTICES: Notice\[\] = \[\];\r?\n/, '');
content = content.replace(/const INITIAL_ATTENDANCE: AttendanceRecord\[\] = \[\];\r?\n/, '');

// Fix the getReportees logic if not already fixed properly
const getReporteesRegex = /const getReportees = \(managerId: string\) => employees\.filter\(e => e\.reportsTo === managerId\);/;
if (getReporteesRegex.test(content)) {
    content = content.replace(getReporteesRegex, `const getReportees = (managerId: string) => {
        const manager = employees.find(e => e.id === managerId);
        if (manager?.role === "HOI") {
            return employees.filter(e => ["OM", "FACULTY", "PROFESSOR", "TL", "AD", "HR"].includes(e.role));
        }
        return employees.filter(e => e.reportsTo === managerId);
    };`);
}

fs.writeFileSync(filePath, content);
console.log('AuthContext.tsx cleaned up');
