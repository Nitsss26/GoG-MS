const User = require('../models/User');
const { Leave, Attendance } = require('../models/WorkLifecycle');

// Get all employees (Workforce Directory)
exports.getEmployees = async (req, res) => {
    try {
        const employees = await User.find({ role: 'EMPLOYEE' }).select('-password');
        res.json(employees);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Update Employee Profile (Onboarding/Edit)
exports.updateProfile = async (req, res) => {
    try {
        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'Employee not found' });

        user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- Attendance Section ---

// Clock In/Out
exports.logAttendance = async (req, res) => {
    const { clockIn, clockOut, location } = req.body;
    try {
        const date = new Date().setHours(0, 0, 0, 0);
        let attendance = await Attendance.findOne({ employeeId: req.user.id, date });

        if (attendance) {
            attendance.clockOut = clockOut || attendance.clockOut;
            await attendance.save();
        } else {
            attendance = new Attendance({
                employeeId: req.user.id,
                date,
                clockIn,
                location
            });
            await attendance.save();
        }
        res.json(attendance);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- Leave Section ---

// Submit Leave Request
exports.submitLeave = async (req, res) => {
    const { type, startDate, endDate, days, reason } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const newLeave = new Leave({
            employeeId: req.user.id,
            employeeName: user.name,
            type,
            startDate,
            endDate,
            days,
            reason
        });
        const leave = await newLeave.save();
        res.json(leave);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Approve/Reject Leave (Admin Only)
exports.updateLeaveStatus = async (req, res) => {
    const { status } = req.body;
    try {
        let leave = await Leave.findById(req.params.id);
        if (!leave) return res.status(404).json({ msg: 'Leave request not found' });

        leave.status = status;
        await leave.save();
        res.json(leave);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
