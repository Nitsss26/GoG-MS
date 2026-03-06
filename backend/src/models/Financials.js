const mongoose = require('mongoose');

// Payroll Schema
const PayrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },
    year: { type: String, required: true },
    amount: { type: Number, required: true },
    deductions: {
        tax: { type: Number, default: 0 },
        pf: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    reimbursements: { type: Number, default: 0 },
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Payroll = mongoose.model('Payroll', PayrollSchema);

// PF Schema
const PFSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },
    year: { type: String, required: true },
    employeeContribution: { type: Number, required: true },
    employerContribution: { type: Number, required: true },
    totalAccumulated: { type: Number, required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

const PF = mongoose.model('PF', PFSchema);

// Reimbursement Schema
const ReimbursementSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeName: { type: String },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    proofDescription: { type: String },
    validatorRole: { type: String },
    status: { type: String, enum: ['Pending', 'HOI Approved', 'Approved', 'Paid', 'Rejected'], default: 'Pending' },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

const Reimbursement = mongoose.model('Reimbursement', ReimbursementSchema);

module.exports = { Payroll, PF, Reimbursement };
