const express = require('express');
const router = express.Router();
const vaccineTypeController = require('../Controllers/vaccineType.controller');
const verifyToken = require('../middleware/verifytoken');

// Get all vaccine types (with pagination and filters)
router.get('/api/vaccine-types', vaccineTypeController.getAllVaccineTypes);

// Get a single vaccine type
router.get('/api/vaccine-types/:id', vaccineTypeController.getVaccineType);

// Add a new vaccine type (with image upload)
router.post('/api/vaccine-types/add', vaccineTypeController.upload.single('image'), vaccineTypeController.addVaccineType);

// Update a vaccine type (with image upload)
router.patch('/api/vaccine-types/:id', vaccineTypeController.upload.single('image'), vaccineTypeController.updateVaccineType);

// Delete a vaccine type
router.delete('/api/vaccine-types/:id', vaccineTypeController.deleteVaccineType);

// Import vaccine types from Excel
router.post('/api/vaccine-types/import', vaccineTypeController.upload.single('file'), vaccineTypeController.importVaccineTypes);

module.exports = router; 