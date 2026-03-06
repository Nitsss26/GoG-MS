const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financialController');
const { auth, adminOnly } = require('../middleware/auth');

// @route   GET api/financials/payroll
// @access  Private
router.get('/payroll', auth, financialController.getPayroll);

// @route   POST api/financials/payroll
// @access  Private/Admin
router.post('/payroll', auth, adminOnly, financialController.generatePayroll);

// @route   GET api/financials/pf
// @access  Private
router.get('/pf', auth, financialController.getPF);

// @route   POST api/financials/reimbursement
// @access  Private
router.post('/reimbursement', auth, financialController.submitClaim);

// @route   PUT api/financials/reimbursement/:id
// @access  Private/Admin
router.put('/reimbursement/:id', auth, adminOnly, financialController.updateClaimStatus);

module.exports = router;
