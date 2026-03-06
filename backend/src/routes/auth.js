const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// @route   POST api/auth/register
// @access  Public (Can be restricted later)
router.post('/register', authController.register);

// @route   POST api/auth/login
// @access  Public
router.post('/login', authController.login);

// @route   GET api/auth/me
// @access  Private
router.get('/me', auth, authController.getMe);

module.exports = router;
