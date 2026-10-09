/**
 * Dummy / test data seed for local development.
 *
 *   npm run seed              -> adds any dummy record that is missing (safe to run again, no duplicates,
 *                                never overwrites or deletes anything)
 *   npm run seed -- --reset   -> also puts the dummy records back to their original values
 *   npm run seed -- --remove  -> deletes ONLY the dummy records created by this script
 *
 * Reads MONGODB_URI from .env.local (or the environment). Every record created here has a fixed id
 * starting with "T" / "test-" / "LV-TEST-" / "SP-TEST-" / "LR-TEST-", so real data in the same database is never touched.
 * Passwords are stored as hashes (same format as the app), never as plain text.
 * All data is fictional. Do not run this against a production database.
 */
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

// Same DNS setting the app uses (src/lib/mongodb.ts): some networks refuse the SRV lookup
// that mongodb+srv:// (Atlas) connection strings need.
try { require('node:dns').setServers(['1.1.1.1', '8.8.8.8']); } catch (e) { }

const MONGODB_URI = process.env.MONGODB_URI;
const RESET = process.argv.includes('--reset');
const REMOVE = process.argv.includes('--remove');
const FORCE = process.argv.includes('--force');

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined. Create .env.local (see .env.example) first.');
    process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !FORCE) {
    console.error('Refusing to seed dummy data with NODE_ENV=production. Pass --force only if you are sure.');
    process.exit(1);
}

const PASSWORD = 'Test@123';
// Stored the same way the app stores passwords (src/lib/password.ts): scrypt$<salt>$<hash> — never plain text
const hashPassword = (plain) => {
    const salt = crypto.randomBytes(16);
    return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(plain, salt, 64).toString('hex')}`;
};

// ─── helpers ───
const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
};
const iso = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString();
};

// ─── LOCATIONS (same shape as the existing Location schema) ───
const locations = [
    { id: 'test-campus-a', name: 'Test Campus A', shortName: 'TCA', lat: 23.2599, lng: 77.4126, radiusKm: 2, address: '1 Demo Road, Zone A', city: 'Bhopal', state: 'Madhya Pradesh' },
    { id: 'test-campus-b', name: 'Test Campus B', shortName: 'TCB', lat: 22.7196, lng: 75.8577, radiusKm: 2, address: '2 Demo Road, Zone B', city: 'Indore', state: 'Madhya Pradesh' },
    { id: 'test-campus-c', name: 'Test Campus C', shortName: 'TCC', lat: 23.1815, lng: 79.9864, radiusKm: 2, address: '3 Demo Road, Zone C', city: 'Jabalpur', state: 'Madhya Pradesh' },
    // Two more campuses headed by Test HOI One (multi-campus HOI: Location.hoiId)
    { id: 'test-campus-d', name: 'Test Campus D', shortName: 'TCD', lat: 23.2332, lng: 77.4343, radiusKm: 2, address: '4 Demo Road, Zone D', city: 'Bhopal', state: 'Madhya Pradesh' },
    { id: 'test-campus-e', name: 'Test Campus E', shortName: 'TCE', lat: 22.9734, lng: 78.6569, radiusKm: 2, address: '5 Demo Road, Zone E', city: 'Sagar', state: 'Madhya Pradesh' },
];
// Which HOI heads which campus (Test HOI One heads A, D and E)
const CAMPUS_HOI = { 'test-campus-a': 'THOI01', 'test-campus-b': 'THOI02', 'test-campus-c': 'THOI03', 'test-campus-d': 'THOI01', 'test-campus-e': 'THOI01' };
locations.forEach(l => { l.hoiId = CAMPUS_HOI[l.id]; });
const A = 'test-campus-a', B = 'test-campus-b', C = 'test-campus-c', D = 'test-campus-d', E = 'test-campus-e';

// ─── EMPLOYEES (same fields as the existing Employee schema) ───
const emp = (id, name, email, role, dept, designation, location, reportsTo) => ({
    id, name, email, role, dept, designation, location, reportsTo,
    password: hashPassword(PASSWORD), // own salt per account
    status: 'Active',
    isOnboarded: true,
    onboardingStatus: 'Approved',
    joiningDate: '2025-01-15',
    phone: '9000000000',
    chancesRemaining: 3,
    fines: { total: 0, records: [] },
});

const employees = [
    // Every role that exists in the project
    emp('TFND01', 'Test Founder', 'founder@test.gog', 'FOUNDER', 'C-Suite', 'Founder', A, []),
    emp('THR01', 'Test HR One', 'hr1@test.gog', 'HR', 'Human Resources', 'HR Manager', A, ['TFND01']),
    emp('THR02', 'Test HR Two', 'hr2@test.gog', 'HR', 'Human Resources', 'HR Executive', B, ['TFND01']),
    emp('TAD01', 'Test Associate Director', 'ad@test.gog', 'AD', 'Management', 'Associate Director', A, ['TFND01']),
    emp('TTL01', 'Test Tech Lead', 'tl@test.gog', 'TL', 'Technology', 'Tech Lead', A, ['TFND01']),
    emp('TCH01', 'Test Curriculum Head', 'curriculum.head@test.gog', 'CURRICULUM_HEAD', 'Curriculum', 'Curriculum Head', A, ['TFND01']),
    emp('TCL01', 'Test Curriculum Lead', 'curriculum.lead@test.gog', 'CURRICULUM_LEAD', 'Curriculum', 'Curriculum Lead', A, ['TCH01']),
    // Curriculum Lead of Campus B (college-wise verification tests)
    emp('TCL02', 'Test Curriculum Lead B', 'curriculum.lead.b@test.gog', 'CURRICULUM_LEAD', 'Curriculum', 'Curriculum Lead', B, ['TCH01']),

    // HOIs — one per campus
    emp('THOI01', 'Test HOI One', 'hoi1@test.gog', 'HOI', 'Leadership', 'Head of Institute', A, ['TAD01']),
    emp('THOI02', 'Test HOI Two', 'hoi2@test.gog', 'HOI', 'Leadership', 'Head of Institute', B, ['TAD01']),
    emp('THOI03', 'Test HOI Three', 'hoi3@test.gog', 'HOI', 'Leadership', 'Head of Institute', C, ['TAD01']),

    // Operations / Marketing / Tech team
    emp('TOM01', 'Test OM One', 'om1@test.gog', 'OM', 'Operations', 'Operation Manager', A, ['THOI01']),
    emp('TOM02', 'Test OM Two', 'om2@test.gog', 'OM', 'Operations', 'Operation Manager', B, ['THOI02']),
    emp('TMKT01', 'Test Marketing', 'marketing@test.gog', 'MARKETING_TEAM', 'Marketing', 'Marketing Executive', C, ['THOI03']),
    emp('TTECH01', 'Test Tech Team', 'tech@test.gog', 'TECH_TEAM', 'Technology', 'Software Engineer', A, ['THOI01']),

    // Faculty / professors — mixed HOI and location assignments
    emp('TPROF01', 'Test Professor 01', 'prof01@test.gog', 'PROFESSOR', 'Academics', 'SDE & Professor', A, ['THOI01']),
    emp('TPROF02', 'Test Professor 02', 'prof02@test.gog', 'PROFESSOR', 'Academics', 'SDE & Professor', B, ['THOI01']),
    emp('TPROF03', 'Test Professor 03', 'prof03@test.gog', 'PROFESSOR', 'Academics', 'SDE & Professor', A, ['THOI02']),
    emp('TPROF04', 'Test Professor 04', 'prof04@test.gog', 'PROFESSOR', 'Academics', 'SDE & Professor', C, ['THOI02']),
    emp('TPROF05', 'Test Professor 05', 'prof05@test.gog', 'PROFESSOR', 'Academics', 'SDE & Professor', B, ['THOI03']),
    emp('TPROF06', 'Test Professor 06', 'prof06@test.gog', 'PROFESSOR', 'Academics', 'Professor', C, ['THOI03']),
    emp('TPROF07', 'Test Professor 07', 'prof07@test.gog', 'PROFESSOR', 'Academics', 'Professor', A, ['THOI01']),
    emp('TPROF08', 'Test Professor 08', 'prof08@test.gog', 'PROFESSOR', 'Academics', 'Professor', B, ['THOI02']),
    emp('TPROF09', 'Test Professor 09', 'prof09@test.gog', 'PROFESSOR', 'Academics', 'Professor', C, ['THOI03']),
    emp('TPROF10', 'Test Professor 10', 'prof10@test.gog', 'PROFESSOR', 'Academics', 'Professor', C, ['THOI01']),
    // Left unassigned on purpose, so HR can test "Assign HOI" / "Assign Location"
    emp('TPROF11', 'Test Professor 11', 'prof11@test.gog', 'PROFESSOR', 'Academics', 'Professor', B, []),
    emp('TPROF12', 'Test Professor 12', 'prof12@test.gog', 'PROFESSOR', 'Academics', 'Professor', '', []),
    // Campuses D and E (headed by Test HOI One)
    emp('TPROF13', 'Test Professor 13', 'prof13@test.gog', 'PROFESSOR', 'Academics', 'Professor', D, ['THOI01']),
    emp('TPROF14', 'Test Professor 14', 'prof14@test.gog', 'PROFESSOR', 'Academics', 'SDE & Professor', D, ['THOI01']),
    emp('TPROF15', 'Test Professor 15', 'prof15@test.gog', 'PROFESSOR', 'Academics', 'Professor', E, ['THOI01']),
    emp('TOM04', 'Test OM Four', 'om4@test.gog', 'OM', 'Operations', 'Operation Manager', D, ['THOI01']),
];
const byId = Object.fromEntries(employees.map(e => [e.id, e]));

// ─── LEAVE REQUESTS (same fields as the existing LeaveRequest schema) ───
const leave = (n, employeeId, type, from, to, status, reason, extra = {}) => {
    const e = byId[employeeId];
    const days = Math.round((new Date(day(to)) - new Date(day(from))) / 86400000) + 1;
    return {
        id: `LV-TEST-${String(n).padStart(2, '0')}`,
        employeeId, employeeName: e.name,
        type, startDate: day(from), endDate: day(to), days,
        status,
        classification: 'Paid',
        leaveType: 'Planned',
        reason,
        proofUrls: [],
        lossOfPayDays: 0,
        appliedAt: iso(Math.min(from, 0) - 3),
        location: e.location,
        hoiApproval: 'Pending',
        hrApproval: 'Pending',
        ...extra,
    };
};
const hoiOk = (hoiId, at) => ({ hoiApproval: 'Approved', hoiApproverId: hoiId, hoiApprovedAt: iso(at) });
const hrOk = (at) => ({ hrApproval: 'Approved', hrApproverId: 'THR01', hrApprovedAt: iso(at), approvedBy: 'THR01', approvedByName: 'Test HR One', approvedByRole: 'HR', approvedAt: iso(at) });

const LONG_REASON = 'I have been unwell since last night with a high fever, severe body ache and a persistent cough. I visited the city hospital this morning and the doctor has diagnosed a viral infection and advised complete bed rest for at least four days, along with a course of medication and a follow-up visit on the fifth day. I have already informed my HOI over a phone call and handed over my pending lectures and lab sessions to my colleague, who has agreed to cover them. The sprint plan for this week is updated, and the doctor\'s prescription and medical certificate are attached as proof. I will remain reachable on phone for anything urgent and will rejoin as soon as the doctor allows.';

// 1000+ characters, and one long string without spaces, to check that a card grows and never breaks its width
const VERY_LONG_REASON = (LONG_REASON + ' ' + 'In addition, my elderly mother, who lives with me, has also fallen ill and there is nobody else at home to take her to the hospital or look after her medicines and meals during the day. The nearest relative lives in another city and can only reach by the weekend. I have checked the academic calendar and there are no examinations or evaluations scheduled in my classes during these days, and I have shared my lecture notes, lab manuals and attendance sheets with the covering faculty so that the students do not lose any teaching hours. I request you to kindly consider this situation and approve the leave.');
const NO_SPACE_REASON = 'Reference:' + 'LEAVE-REQUEST-TRACKING-CODE-'.repeat(12) + 'END';

const leaves = [
    // Waiting for HOI (HR can approve / reject these directly)
    leave(1, 'TPROF01', 'Casual Leave', 5, 5, 'Pending HOI Approval', 'Family function'),
    leave(2, 'TPROF02', 'Casual Leave', 7, 8, 'Pending HOI Approval', 'Travelling to home town'),
    leave(3, 'TPROF03', 'Sick Leave', 2, 3, 'Pending HOI Approval', 'Doctor advised rest'),
    leave(4, 'TOM01', 'Casual Leave', 10, 10, 'Pending HOI Approval', 'Personal work'),
    leave(5, 'TPROF11', 'Privilege Leave', 14, 16, 'Pending HOI Approval', 'Wedding in the family'),
    // HOI approved, waiting for HR
    leave(6, 'TPROF05', 'Casual Leave', 6, 6, 'Pending', 'Bank work', hoiOk('THOI03', -1)),
    leave(7, 'TPROF07', 'Sick Leave', 4, 5, 'Pending', 'Medical check-up', hoiOk('THOI01', -1)),
    // An HOI's own leave goes straight to HR
    leave(8, 'THOI01', 'Casual Leave', 12, 12, 'Pending', 'Personal work', { hoiApproval: 'Approved' }),
    // Approved
    leave(9, 'TPROF04', 'Casual Leave', -10, -10, 'Approved', 'Festival at home', { ...hoiOk('THOI02', -13), ...hrOk(-12) }),
    leave(10, 'TPROF06', 'Sick Leave', -20, -19, 'Approved', 'Fever', { ...hoiOk('THOI03', -22), ...hrOk(-21) }),
    leave(11, 'TPROF10', 'Casual Leave', 0, 1, 'Approved', 'Out of station', { ...hoiOk('THOI01', -3), ...hrOk(-2) }),
    // Rejected (one by an HOI, one by HR)
    leave(12, 'TPROF08', 'Casual Leave', -6, -5, 'Rejected', 'Short trip', { hoiApproval: 'Rejected', hoiApproverId: 'THOI02', hoiApprovedAt: iso(-8), reasonForAction: 'Another professor is already on leave that day' }),
    leave(13, 'TPROF09', 'Privilege Leave', -15, -12, 'Rejected', 'Vacation', { ...hoiOk('THOI03', -18), hrApproval: 'Rejected', hrApproverId: 'THR01', hrApprovedAt: iso(-17), rejectedBy: 'THR01', rejectedByName: 'Test HR One', rejectedByRole: 'HR', rejectedAt: iso(-17), reasonForAction: 'Exam week, leave not possible' }),
    // A long reason (500+ characters) and an emergency sick leave, to test how the cards handle them
    leave(14, 'TTECH01', 'Sick Leave', 1, 4, 'Pending HOI Approval', LONG_REASON, { leaveType: 'Emergency' }),
    leave(15, 'TPROF12', 'Short Leave', 3, 3, 'Pending HOI Approval', 'Need to leave two hours early for a bank appointment'),
    leave(16, 'TMKT01', 'Casual Leave', 6, 9, 'Pending HOI Approval', VERY_LONG_REASON),
    leave(17, 'TOM02', 'Casual Leave', 8, 8, 'Pending HOI Approval', NO_SPACE_REASON),
];

// ─── A little extra so the other portals are not empty ───
const holidays = [
    { id: 'HOL-TEST-01', name: 'Test Foundation Day', date: day(20), collegeIds: [], status: 'Approved', proposedBy: 'THR01', proposedByName: 'Test HR One', forAll: true },
    // Holiday requests from HOIs, each for the HOI's own college — approve them as HR to test the college-wise email
    { id: 'HOL-TEST-02', name: 'Test Campus Fest', date: day(30), collegeIds: [A], status: 'Proposed', proposedBy: 'THOI01', proposedByName: 'Test HOI One', proposedAt: iso(-1), forAll: false },
    { id: 'HOL-TEST-03', name: 'Test Annual Sports Day', date: day(25), collegeIds: [B], status: 'Proposed', proposedBy: 'THOI02', proposedByName: 'Test HOI Two', proposedAt: iso(-1), forAll: false },
    { id: 'HOL-TEST-04', name: 'Test Local Election Day', date: day(40), collegeIds: [C], status: 'Proposed', proposedBy: 'THOI03', proposedByName: 'Test HOI Three', proposedAt: iso(0), forAll: false },
];
const notices = [
    { id: 'NOT-TEST-01', title: 'Welcome to the test environment', content: 'This is dummy data created by the seed script for testing.', category: 'General', createdBy: 'Test HR One', createdAt: iso(-2), readBy: [], imageUrls: [] },
    { id: 'NOT-TEST-02', title: 'Leave policy reminder', content: 'Please apply for planned leave at least one day in advance.', category: 'HR', createdBy: 'Test HR One', createdAt: iso(-1), readBy: [], imageUrls: [] },
];

// Additional responsibilities: one of each status, so the AD approval flow can be tested straight away
const responsibilities = [
    { id: 'AR-TEST-01', employeeId: 'TPROF02', employeeName: 'Test Professor 02', description: 'Conducted an extra weekend workshop for students', points: 20, date: day(-6), status: 'Approved', addedBy: 'THOI01', addedByName: 'Test HOI One', addedByRole: 'HOI', submittedAt: iso(-6), approvedBy: 'TAD01', approvedByName: 'Test Associate Director', approvedAt: iso(-5) },
    { id: 'AR-TEST-02', employeeId: 'TPROF01', employeeName: 'Test Professor 01', description: 'Coordinating the campus hackathon', points: 30, date: day(-1), status: 'Pending', addedBy: 'THOI01', addedByName: 'Test HOI One', addedByRole: 'HOI', submittedAt: iso(-1) },
    { id: 'AR-TEST-03', employeeId: 'TPROF04', employeeName: 'Test Professor 04', description: 'Mentoring the placement preparation batch', points: 15, date: day(-4), status: 'Rejected', addedBy: 'THOI02', addedByName: 'Test HOI Two', addedByRole: 'HOI', submittedAt: iso(-4), approvedBy: 'TAD01', approvedByName: 'Test Associate Director', approvedAt: iso(-3), rejectionReason: 'Already part of the regular duties' },
];

// Work schedule changes made by HOIs (one record per day, same as the app saves them).
// Two are unread for HR, one is already marked as read — to test HR → Schedule Changes → Mark as Read.
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const schedule = (employeeId, hoiId, changedDaysAgo, days, read) => WEEK.map(d => {
    const [location, clockInTime, clockOutTime] = days[d] || days.default;
    return {
        id: `WS-TEST-${employeeId}-${d}`,
        employeeId, employeeName: byId[employeeId].name,
        date: d, location, clockInTime, clockOutTime,
        assignedBy: hoiId, assignedByName: byId[hoiId].name,
        changedAt: iso(changedDaysAgo),
        status: read ? 'Approved' : 'Pending',
        hrReadBy: read ? 'THR01' : null,
        hrReadByName: read ? 'Test HR One' : null,
        hrReadAt: read ? iso(changedDaysAgo + 1) : null,
    };
});
const workSchedules = [
    // Unread: HOI One moved Professor 01 to Campus B on Mon/Tue and gave WFH on Sat
    ...schedule('TPROF01', 'THOI01', 0, { default: [A, '09:30', '18:00'], Mon: [B, '10:00', '17:00'], Tue: [B, '10:00', '17:00'], Sat: ['WFH', '09:30', '14:00'] }, false),
    // Unread: HOI Two changed Professor 03's timings and sent him to Campus C on Fri
    ...schedule('TPROF03', 'THOI02', -1, { default: [A, '08:30', '16:30'], Fri: [C, '09:00', '17:00'] }, false),
    // Already read by HR: HOI One's change for OM One
    ...schedule('TOM01', 'THOI01', -3, { default: [A, '09:00', '18:00'], Wed: ['WFH', '09:00', '18:00'] }, true),
];


// ─── ACADEMIC: sprint plans + class records (same fields as the SprintPlan / LectureReport schemas) ───
// Dates are relative to today (institution time zone Asia/Kolkata):
//   last week  → locked plans with class records at every verification stage
//   this week  → locked / submitted plans (Weekly Calendar, class completion)
//   next week  → Professor 01 has only a Draft, the others nothing (Saturday 10 AM reminder test)
const istYmd = (d) => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mondayOffset = (weeks) => {
    const t = istYmd(new Date());
    const dow = t.getDay();
    t.setDate(t.getDate() + (dow === 0 ? -6 : 1 - dow) + weeks * 7);
    return t;
};
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const oid = () => new mongoose.Types.ObjectId();

// [dayIndex, start, stop, code, subject, topic, section, class, lectureType, unit]
const TIMETABLE = {
    TPROF01: [[0, '09:30', '10:30', 'DBMS', 'Database Management System', 'Normalization (1NF–3NF)', 'A', 'B.Tech CSE 2A', 'Theory', '2'],
              [0, '11:00', '12:00', 'OS', 'Operating Systems', 'CPU Scheduling', 'B', 'B.Tech CSE 2B', 'Theory', '3'],
              [2, '10:00', '11:00', 'DS', 'Data Structures & Algorithms', 'Binary Search Trees', 'A', 'B.Tech CSE 2A', 'Theory', '4'],
              [4, '14:00', '16:00', 'DBMS', 'Database Management System', 'SQL Joins Lab', 'A', 'B.Tech CSE 2A', 'Practical / Lab', '2']],
    TPROF03: [[0, '10:00', '11:00', 'PY', 'Python Programming', 'Functions and Modules', 'C', 'BCA 1C', 'Theory', '2'],
              [1, '09:30', '10:30', 'PY', 'Python Programming', 'File Handling', 'C', 'BCA 1C', 'Theory', '3'],
              [3, '12:00', '13:00', 'AI', 'Artificial Intelligence', 'Search Algorithms', 'A', 'B.Tech CSE 3A', 'Theory', '1']],
    TPROF07: [[1, '11:00', '12:00', 'REACT', 'React.js UI Framework', 'Hooks: useState / useEffect', 'B', 'B.Tech CSE 3B', 'Theory', '2'],
              [2, '09:30', '10:30', 'NODE', 'Node.js Backend', 'Express Routing', 'B', 'B.Tech CSE 3B', 'Theory', '3']],
    TPROF13: [[0, '08:30', '09:20', 'TOC', 'Theory of Computation', 'Finite Automata', 'A', 'B.Tech CSE 2A', 'Theory', '1'],
              [2, '10:10', '11:00', 'TOC', 'Theory of Computation', 'Regular Expressions', 'A', 'B.Tech CSE 2A', 'Theory', '1'],
              [4, '12:20', '13:10', 'CN', 'Computer Networks', 'TCP vs UDP', 'B', 'B.Tech CSE 2B', 'Tutorial', '2']],
    TPROF14: [[1, '09:20', '10:10', 'WT', 'Web Technology', 'CSS Flexbox', 'A', 'BCA 2A', 'Practical / Lab', '2'],
              [3, '11:00', '11:50', 'WT', 'Web Technology', 'JavaScript DOM', 'A', 'BCA 2A', 'Theory', '3']],
    TPROF15: [[0, '09:20', '10:10', 'DE', 'Digital Electronics', 'Logic Gates', 'A', 'B.Tech ECE 2A', 'Theory', '1'],
              [1, '10:10', '11:00', 'CPP', 'C++ Programming', 'Classes and Objects', 'B', 'B.Tech ECE 2B', 'Theory', '2'],
              [4, '08:30', '09:20', 'DBMS', 'Database Management System', 'ER Diagrams', 'A', 'B.Tech ECE 2A', 'Theory', '1']],
    TPROF02: [[0, '10:00', '11:00', 'ML', 'Machine Learning', 'Linear Regression', 'A', 'B.Tech AIML 3A', 'Theory', '1'],
              [3, '11:00', '12:00', 'ML', 'Machine Learning', 'Logistic Regression', 'A', 'B.Tech AIML 3A', 'Theory', '2']],
};
const entriesFor = (profId, monday) => (TIMETABLE[profId] || []).map(([di, s, e, code, name, topic, sec, cls, type, unit]) => ({
    _id: oid(), day: DAY_CODES[di], date: ymd(addD(monday, di)), timeStart: s, timeStop: e,
    stream: 'Computer Science', year: '2nd Year', semester: '3rd Semester',
    subjectCode: code, subjectName: name, topics: topic, section: sec, className: cls,
    lectureType: type, unitNumber: unit, content: `${topic}: explanation, examples and practice questions`,
}));
const at = (daysAgo) => iso(-daysAgo);
const hist = (action, from, to, by, byName, role, daysAgo, note = '') => ({ action, fromStatus: from, toStatus: to, by, byName, role, at: at(daysAgo), note });
const plan = (id, profId, weeks, status, extra = {}) => {
    const e = byId[profId];
    const monday = mondayOffset(weeks);
    const entries = entriesFor(profId, monday);
    const locked = ['LOCKED', 'LOCKED_AGAIN', 'UNLOCK_REQUESTED'].includes(status);
    const hoi = { [A]: ['THOI01', 'Test HOI One'], [B]: ['THOI02', 'Test HOI Two'], [C]: ['THOI03', 'Test HOI Three'] }[e.location] || ['THOI01', 'Test HOI One'];
    const history = [hist('Created', '', 'DRAFT', profId, e.name, 'PROFESSOR', 9 - weeks * 7)];
    if (status !== 'DRAFT') history.push(hist('Submitted', 'DRAFT', 'SUBMITTED', profId, e.name, 'PROFESSOR', 8 - weeks * 7));
    if (locked) history.push(hist('Locked', 'SUBMITTED', 'LOCKED', hoi[0], hoi[1], 'HOI', 7 - weeks * 7));
    return {
        id, facultyId: profId, facultyName: e.name, college: e.location,
        weekStartDate: ymd(monday), weekEndDate: ymd(addD(monday, 5)), stream: 'Computer Science', year: '2nd Year',
        entries, status, isLocked: locked, version: 1, createdById: profId,
        submittedAt: status !== 'DRAFT' ? at(8 - weeks * 7) : undefined,
        lockedAt: locked ? at(7 - weeks * 7) : undefined, lockedBy: locked ? hoi[1] : undefined, lockedById: locked ? hoi[0] : undefined,
        lockedByName: locked ? hoi[1] : undefined, lockedByRole: locked ? 'HOI' : undefined,
        history, changeRequests: [],
        revisions: status !== 'DRAFT' ? [{ version: 1, status: 'SUBMITTED', entries, savedAt: at(8 - weeks * 7), savedBy: profId, savedByName: e.name, note: 'SUBMITTED' }] : [],
        isVerifiedByCL: false, createdAt: new Date(), updatedAt: new Date(),
        ...extra,
    };
};

const sprintPlans = [
    plan('SP-TEST-P01-LAST', 'TPROF01', -1, 'LOCKED'),
    plan('SP-TEST-P02-LAST', 'TPROF02', -1, 'LOCKED'),
    plan('SP-TEST-P01-THIS', 'TPROF01', 0, 'LOCKED'),
    plan('SP-TEST-P03-THIS', 'TPROF03', 0, 'SUBMITTED'),
    plan('SP-TEST-P07-THIS', 'TPROF07', 0, 'LOCKED'),
    plan('SP-TEST-P02-THIS', 'TPROF02', 0, 'LOCKED'),
    plan('SP-TEST-P01-NEXT', 'TPROF01', 1, 'DRAFT'),
    plan('SP-TEST-P13-THIS', 'TPROF13', 0, 'LOCKED'),
    plan('SP-TEST-P14-THIS', 'TPROF14', 0, 'SUBMITTED'),
    plan('SP-TEST-P15-THIS', 'TPROF15', 0, 'LOCKED'),
];
// Extra classes TODAY for Professor 01 (so "My Lectures" / "Lecture Report" show a full day).
// Only Monday–Saturday; on Sunday there is no class day.
const TODAY_INDEX = (() => { const d = istYmd(new Date()).getDay(); return d === 0 ? -1 : d - 1; })();
if (TODAY_INDEX >= 0) {
    const p = sprintPlans.find(x => x.id === 'SP-TEST-P01-THIS');
    const today = ymd(addD(mondayOffset(0), TODAY_INDEX));
    const extra = [
        ['08:30', '09:20', 'WT', 'Web Technology', 'HTML Forms and Validation', 'B', 'B.Tech CSE 2B', 'Practical / Lab', '1'],
        ['09:20', '10:10', 'CN', 'Computer Networks', 'OSI Model Layers', 'A', 'B.Tech CSE 2A', 'Theory', '1'],
        ['10:10', '11:00', 'OS', 'Operating Systems', 'Deadlock Avoidance', 'B', 'B.Tech CSE 2B', 'Tutorial', '3'],
        ['12:20', '13:10', 'SE', 'Software Engineering', 'Agile and Scrum', 'A', 'B.Tech CSE 2A', 'Theory', '2'],
        ['16:00', '17:00', 'DS', 'Data Structures & Algorithms', 'Graph Traversal (BFS / DFS)', 'B', 'B.Tech CSE 2B', 'Tutorial', '5'],
    ].filter(([s, e]) => !p.entries.some(x => x.date === today && x.timeStart < e && x.timeStop > s)) // never overlap an existing class
        .map(([s, e, code, name, topic, sec, cls, type, unit]) => ({
            _id: oid(), day: DAY_CODES[TODAY_INDEX], date: today, timeStart: s, timeStop: e,
            stream: 'Computer Science', year: '2nd Year', semester: '3rd Semester',
            subjectCode: code, subjectName: name, topics: topic, section: sec, className: cls,
            lectureType: type, unitNumber: unit, content: `${topic}: explanation, examples and practice questions`,
        }));
    p.entries.push(...extra);
    // lecture numbers follow the plan order → keep each day in time order
    p.entries.sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart));
    p.revisions.forEach(r => { r.entries = p.entries; });
}

// Professor 07 has asked to unlock this week's plan (waiting for HOI / CL / CH / AD)
(() => {
    const p = sprintPlans.find(x => x.id === 'SP-TEST-P07-THIS');
    p.status = 'UNLOCK_REQUESTED';
    p.statusBeforeUnlockRequest = 'LOCKED';
    p.unlockRequestedAt = at(0);
    p.changeRequests = [{ requestedAt: at(0), requestedAtISO: at(0), reason: 'Extra revision class requested by the college on Wednesday', comment: 'Move Express Routing to Thursday 09:30', status: 'Pending', requestedBy: 'TPROF07', requestedByName: 'Test Professor 07', approvedBy: '', approvedAt: '', changes: '{}' }];
    p.history.push(hist('Unlock requested', 'LOCKED', 'UNLOCK_REQUESTED', 'TPROF07', 'Test Professor 07', 'PROFESSOR', 0, 'Extra revision class requested by the college on Wednesday'));
})();

// Class records of last week: one at every stage of Professor → OM → CL/CH → HOI
const stage = (s, by, byName, role, daysAgo, comment = '') => ({ status: s, by, byName, role, at: at(daysAgo), comment });
const record = (id, planId, idx, pipelineStatus, extra = {}) => {
    const p = sprintPlans.find(x => x.id === planId);
    const e = p.entries[idx];
    const sameDay = p.entries.filter(x => x.date === e.date);
    const prof = byId[p.facultyId];
    return {
        id, facultyId: p.facultyId, facultyName: prof.name, college: prof.location, date: e.date,
        lectureNumber: sameDay.indexOf(e) + 1, sprintPlanId: '', sprintEntryId: String(e._id),
        courseName: e.subjectName, subjectCode: e.subjectCode, topicsCovered: e.topics, stream: e.stream, year: e.year, semester: e.semester,
        section: e.section, className: e.className, lectureType: e.lectureType, unitNumber: e.unitNumber,
        timeStart: e.timeStart, timeStop: e.timeStop, classStartTime: e.timeStart, classEndTime: e.timeStop, scheduledDuration: 60,
        numberOfAttendees: 52, totalStudents: 60, status: 'Completed', pipelineStatus,
        lectureNotes: { notesUrl: 'https://example.com/test-notes/' + id, notesContent: '', isSharedWithStudents: true, verificationStatus: 'Pending' },
        assignment: { hasAssignment: false, verificationStatus: 'Approved', isSharedInProfGroup: false },
        notesMissing: false, submittedAt: at(6), submissionCount: 1, snapshotUrls: [],
        clVerificationStatus: 'Pending', auditStatus: 'Pending', warnings: [], delayFlags: [],
        omVerification: { status: 'PENDING' }, clChVerification: { status: 'PENDING' }, hoiVerification: { status: 'PENDING' },
        pipelineHistory: [hist('Submitted by Professor', 'PENDING_PROFESSOR', 'SUBMITTED', p.facultyId, prof.name, 'PROFESSOR', 6, 'Attendance 52/60'), hist('Sent to OM', 'SUBMITTED', 'PENDING_OM', p.facultyId, prof.name, 'PROFESSOR', 6)],
        createdAt: new Date(), updatedAt: new Date(),
        ...extra,
    };
};
const omOk = { omVerification: stage('VERIFIED', 'TOM01', 'Test OM One', 'OM', 5, 'Notes checked and shared'), submittedToGroup: true, submittedToGroupBy: 'TOM01', submittedToGroupByName: 'Test OM One', submittedToGroupAt: at(5), actualInTime: '09:28', actualOutTime: '10:31', omTimesUpdatedBy: 'TOM01', omTimesUpdatedByName: 'Test OM One', omTimesUpdatedAt: at(5) };
const clOk = { clChVerification: stage('VERIFIED', 'TCL01', 'Test Curriculum Lead', 'CURRICULUM_LEAD', 4, 'Complete'), clVerificationStatus: 'Verified' };
const lectureReports = [
    record('LR-TEST-01', 'SP-TEST-P01-LAST', 0, 'COMPLETED', { ...omOk, ...clOk, hoiVerification: stage('VERIFIED', 'THOI01', 'Test HOI One', 'HOI', 3, ''), auditStatus: 'Approved',
        assignment: { hasAssignment: true, title: 'Normalization worksheet', assignmentUrl: 'https://example.com/test-assignment/LR-TEST-01', verificationStatus: 'Approved', isSharedInProfGroup: false, addedAt: at(6), addedBy: 'TPROF01', addedByName: 'Test Professor 01' } }),
    record('LR-TEST-02', 'SP-TEST-P01-LAST', 1, 'PENDING_HOI', { ...omOk, ...clOk }),
    record('LR-TEST-03', 'SP-TEST-P01-LAST', 2, 'PENDING_CL_CH', { ...omOk }),
    record('LR-TEST-04', 'SP-TEST-P01-LAST', 3, 'PENDING_OM', {
        notesMissing: true, notesMissingReason: 'I was out of station on official exam duty; I will share the lab notes on Monday.', notesReasonStatus: 'PENDING',
        lectureNotes: { notesUrl: '', notesContent: '', isSharedWithStudents: false, verificationStatus: 'Pending' },
    }),
    // Campus B — must never appear for Campus A's OM / HOI / CL
    record('LR-TEST-05', 'SP-TEST-P02-LAST', 0, 'PENDING_OM'),
];
// Today's records for Professor 01: first class completed (with assignment), second waiting for OM.
// The third class has ended without a report ("Report Pending"); the later ones are upcoming.
if (TODAY_INDEX >= 0) {
    const p = sprintPlans.find(x => x.id === 'SP-TEST-P01-THIS');
    const today = ymd(addD(mondayOffset(0), TODAY_INDEX));
    const idxOf = (start) => p.entries.findIndex(x => x.date === today && x.timeStart === start);
    const todayAt = (hhmm) => new Date(`${today}T${hhmm}:00+05:30`).toISOString();
    const nowHHMM = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const add = (id, start, stop, status, extra) => {
        const i = idxOf(start);
        if (i < 0 || nowHHMM < stop) return; // only classes that have already ended get a record
        lectureReports.push(record(id, 'SP-TEST-P01-THIS', i, status, {
            scheduledDuration: 50, submittedAt: todayAt(stop),
            pipelineHistory: [hist('Submitted by Professor', 'PENDING_PROFESSOR', 'SUBMITTED', 'TPROF01', 'Test Professor 01', 'PROFESSOR', 0, 'Attendance'), hist('Sent to OM', 'SUBMITTED', 'PENDING_OM', 'TPROF01', 'Test Professor 01', 'PROFESSOR', 0)],
            ...extra,
        }));
    };
    add('LR-TEST-06', '08:30', '09:20', 'COMPLETED', {
        numberOfAttendees: 54, ...omOk, actualInTime: '08:29', actualOutTime: '09:21',
        finalVerification: { ...stage('VERIFIED', 'THOI01', 'Test HOI One', 'HOI', 0, 'Good class'), reference: 'Today · Lecture 1' },
        hoiVerification: stage('VERIFIED', 'THOI01', 'Test HOI One', 'HOI', 0, 'Good class'), clChVerification: { status: 'NOT_REQUIRED' },
        clVerificationStatus: 'Verified', auditStatus: 'Approved', snapshotUrls: ['https://example.com/test-snapshot/LR-TEST-06-1', 'https://example.com/test-snapshot/LR-TEST-06-2'],
        assignment: { hasAssignment: true, title: 'Build a validated registration form', assignmentUrl: 'https://example.com/test-assignment/LR-TEST-06', verificationStatus: 'Approved', isSharedInProfGroup: false, addedAt: todayAt('09:25'), addedBy: 'TPROF01', addedByName: 'Test Professor 01' },
    });
    add('LR-TEST-07', '09:20', '10:10', 'PENDING_OM', { numberOfAttendees: 47 });
}

const DATASETS = [
    ['locations', locations],
    ['employees', employees],
    ['leaverequests', leaves],
    ['holidays', holidays],
    ['notices', notices],
    ['additionalresponsibilities', responsibilities],
    ['workschedules', workSchedules],
    ['sprintplans', sprintPlans],
    ['lecturereports', lectureReports],
];

async function run() {
    const safeUri = MONGODB_URI.replace(/\/\/[^@/]+@/, '//***:***@');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db;
    console.log(`Connected: ${safeUri}  (database: ${db.databaseName})`);

    if (REMOVE) {
        for (const [name, docs] of DATASETS) {
            const res = await db.collection(name).deleteMany({ id: { $in: docs.map(d => d.id) } });
            console.log(`${name.padEnd(14)} removed ${res.deletedCount} dummy record(s)`);
        }
        return;
    }

    // A dummy email that already belongs to a different (real) record would break the unique email index
    const clash = await db.collection('employees').findOne({
        email: { $in: employees.map(e => e.email) },
        id: { $nin: employees.map(e => e.id) },
    });
    if (clash) throw new Error(`Email ${clash.email} already belongs to employee ${clash.id}. Nothing was changed.`);

    for (const [name, docs] of DATASETS) {
        let created = 0, updated = 0;
        for (const doc of docs) {
            // --reset replaces the whole dummy record; the default only inserts when it is missing
            const res = RESET
                ? await db.collection(name).replaceOne({ id: doc.id }, doc, { upsert: true })
                : await db.collection(name).updateOne({ id: doc.id }, { $setOnInsert: doc }, { upsert: true });
            if (res.upsertedCount) created++;
            else if (res.modifiedCount) updated++;
        }
        console.log(`${name.padEnd(14)} ${created} created, ${updated} reset, ${docs.length - created - updated} already present`);
    }

    console.log('\nTest logins (password for every account: ' + PASSWORD + ' — stored as a hash)');
    console.log('Pick the matching role in the login screen dropdown.\n');
    console.log('ROLE'.padEnd(18) + 'NAME'.padEnd(26) + 'EMAIL');
    employees.forEach(e => console.log(e.role.padEnd(18) + e.name.padEnd(26) + e.email));
}

run()
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
        console.error('Seed failed:', err.message);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    });