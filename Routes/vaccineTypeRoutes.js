const express = require('express');
const router = express.Router();
const vaccineTypeController = require('../Controllers/vaccineType.controller');
const verifyToken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// ============================================
// VACCINE TYPE OPERATIONS (require settings.manage)
// ============================================

// Get all vaccine types (with pagination and filters)
router.get('/api/vaccine-types', 
  verifyToken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  vaccineTypeController.getAllVaccineTypes
);

// Get a single vaccine type
router.get('/api/vaccine-types/:id', 
  verifyToken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  vaccineTypeController.getVaccineType
);

// Add a new vaccine type (with image upload)
router.post('/api/vaccine-types/add', 
  verifyToken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  vaccineTypeController.upload.single('image'), 
  vaccineTypeController.addVaccineType
);

// Update a vaccine type (with image upload)
router.patch('/api/vaccine-types/:id', 
  verifyToken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  vaccineTypeController.upload.single('image'), 
  vaccineTypeController.updateVaccineType
);

// Delete a vaccine type
router.delete('/api/vaccine-types/:id', 
  verifyToken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  vaccineTypeController.deleteVaccineType
);

// Import vaccine types from Excel
router.post('/api/vaccine-types/import', 
  verifyToken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  vaccineTypeController.upload.single('file'), 
  vaccineTypeController.importVaccineTypes
);

module.exports = router; 