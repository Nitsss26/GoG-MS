const mongoose = require('mongoose');

// Leave Schema
const LeaveSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeName: { type: String },
    type: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    classification: { type: String, enum: ['Paid', 'Unpaid'], default: 'Paid' },
    reason: { type: String }
}, { timestamps: true });

const Leave = mongoose.model('Leave', LeaveSchema);

// Attendance Schema
const AttendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    clockIn: { type: String },
    clockOut: { type: String },
    status: { type: String, enum: ['Present', 'Absent', 'Late', 'Half-day'], default: 'Present' },
    location: { type: String }
}, { timestamps: true });

const Attendance = mongoose.model('Attendance', AttendanceSchema);

module.exports = { Leave, Attendance };
