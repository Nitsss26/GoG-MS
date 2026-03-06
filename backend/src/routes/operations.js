const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operationController');
const { auth, adminOnly } = require('../middleware/auth');

// @route   GET api/operations/hierarchy
// @access  Private
router.get('/hierarchy', auth, operationController.getHierarchy);

// @route   POST api/operations/hierarchy
// @access  Private/Admin
router.post('/hierarchy', auth, adminOnly, operationController.addNode);

// @route   GET api/operations/assets
// @access  Private
router.get('/assets', auth, operationController.getAssets);

// @route   POST api/operations/assets
// @access  Private/Admin
router.post('/assets', auth, adminOnly, operationController.addAsset);

// @route   PUT api/operations/assets/:id
// @access  Private/Admin
router.put('/assets/:id', auth, adminOnly, operationController.updateAsset);

module.exports = router;
