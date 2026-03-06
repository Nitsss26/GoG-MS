const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communicationController');
const { auth, adminOnly } = require('../middleware/auth');

// @route   GET api/communications/notices
// @access  Private
router.get('/notices', auth, communicationController.getNotices);

// @route   POST api/communications/notices
// @access  Private/Admin
router.post('/notices', auth, adminOnly, communicationController.createNotice);

// @route   GET api/communications/jobs
// @access  Public/Private
router.get('/jobs', communicationController.getJobPostings);

// @route   POST api/communications/jobs
// @access  Private/Admin
router.post('/jobs', auth, adminOnly, communicationController.createJobPosting);

module.exports = router;
