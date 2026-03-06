const { Payroll, PF, Reimbursement } = require('../models/Financials');
const User = require('../models/User');

// --- Payroll Section ---

// Get Payroll History
exports.getPayroll = async (req, res) => {
    try {
        const payroll = await Payroll.find({ employeeId: req.user.id });
        res.json(payroll);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Generate Payroll (Admin Only)
exports.generatePayroll = async (req, res) => {
    const { employeeId, month, year, amount, deductions, reimbursements } = req.body;
    try {
        const newPayroll = new Payroll({
            employeeId,
            month,
            year,
            amount,
            deductions,
            reimbursements
        });
        const payroll = await newPayroll.save();
        res.json(payroll);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- PF Section ---

// Get PF Ledger
exports.getPF = async (req, res) => {
    try {
        const pf = await PF.find({ employeeId: req.user.id });
        res.json(pf);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- Reimbursement Section ---

// Submit Reimbursement Claim
exports.submitClaim = async (req, res) => {
    const { type, amount, description, proofDescription } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const newClaim = new Reimbursement({
            employeeId: req.user.id,
            employeeName: user.name,
            type,
            amount,
            description,
            proofDescription
        });
        const claim = await newClaim.save();
        res.json(claim);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Update Claim Status (Admin/HOI Only)
exports.updateClaimStatus = async (req, res) => {
    const { status, validatorRole } = req.body;
    try {
        let claim = await Reimbursement.findById(req.params.id);
        if (!claim) return res.status(404).json({ msg: 'Claim not found' });

        claim.status = status;
        claim.validatorRole = validatorRole || claim.validatorRole;
        await claim.save();
        res.json(claim);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
