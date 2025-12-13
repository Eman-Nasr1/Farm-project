/**
 * Settings Routes (Admin only)
 * 
 * Routes for managing application-wide settings.
 * All routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const settingsController = require('../Controllers/settings.controller');
const verifytoken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');

// All routes require authentication and admin role
router.use(verifytoken);
router.use(allowedto('admin'));

// Get current settings
router.get('/api/admin/settings', settingsController.getSettings);

// Update settings
router.put('/api/admin/settings', settingsController.updateSettings);

// Quick set Paymob
router.put('/api/admin/settings/paymob', settingsController.setPaymob);

// Quick set Stripe
router.put('/api/admin/settings/stripe', settingsController.setStripe);

module.exports = router;

