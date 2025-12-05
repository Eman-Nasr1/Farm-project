/**
 * Plan Routes (Admin only)
 * 
 * Routes for managing subscription plans.
 * All routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const planController = require('../Controllers/plan.controller');
const verifytoken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');

// All routes require authentication and admin role
router.use(verifytoken);
router.use(allowedto('admin'));

// Create a new plan
router.post('/api/admin/plans', planController.createPlan);

// Get all plans
router.get('/api/admin/plans', planController.getAllPlans);

// Get a single plan by ID
router.get('/api/admin/plans/:id', planController.getPlanById);

// Update a plan
router.put('/api/admin/plans/:id', planController.updatePlan);

// Delete (deactivate) a plan
router.delete('/api/admin/plans/:id', planController.deletePlan);

module.exports = router;

