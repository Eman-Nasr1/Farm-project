/**
 * Settings Routes
 * 
 * Routes for managing application-wide settings.
 * All routes require settings.manage permission.
 */

const express = require('express');
const router = express.Router();
const settingsController = require('../Controllers/settings.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// ============================================
// SETTINGS OPERATIONS (require settings.manage)
// ============================================

// Get current settings
router.get('/api/admin/settings', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  settingsController.getSettings
);

// Update settings
router.put('/api/admin/settings', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  settingsController.updateSettings
);

// Quick set Paymob
router.put('/api/admin/settings/paymob', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  settingsController.setPaymob
);

// Quick set Stripe
router.put('/api/admin/settings/stripe', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  settingsController.setStripe
);

module.exports = router;

