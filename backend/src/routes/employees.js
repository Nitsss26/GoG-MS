const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { auth, adminOnly } = require('../middleware/auth');

// @route   GET api/employees
// @desc    Get all employees
// @access  Private/Admin
router.get('/', auth, adminOnly, employeeController.getEmployees);

// @route   PUT api/employees/profile/:id
// @desc    Update employee profile
// @access  Private
router.put('/profile/:id', auth, employeeController.updateProfile);

// @route   POST api/employees/attendance
// @desc    Clock In/Out
// @access  Private
router.post('/attendance', auth, employeeController.logAttendance);

// @route   POST api/employees/leave
// @desc    Submit leave request
// @access  Private
router.post('/leave', auth, employeeController.submitLeave);

// @route   PUT api/employees/leave/:id
// @desc    Approve/Reject leave
// @access  Private/Admin
router.put('/leave/:id', auth, adminOnly, employeeController.updateLeaveStatus);

module.exports = router;
