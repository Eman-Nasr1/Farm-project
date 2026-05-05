/**
 * Plan Routes
 *
 * Routes for managing subscription plans.
 * Public endpoint: GET /api/plans
 * Admin endpoints: /api/admin/plans*
 */

const express = require('express');
const router = express.Router();
const planController = require('../Controllers/plan.controller');
const verifytoken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');

// Public route - no auth required
router.get('/api/plans', planController.getAllPlans);

// Protected routes - require authentication and admin role
router.get('/api/admin/plans', verifytoken, allowedto('admin'), planController.getAllPlans);
router.post('/api/admin/plans', verifytoken, allowedto('admin'), planController.createPlan);
router.get('/api/admin/plans/:id', verifytoken, allowedto('admin'), planController.getPlanById);
router.put('/api/admin/plans/:id', verifytoken, allowedto('admin'), planController.updatePlan);
router.delete('/api/admin/plans/:id', verifytoken, allowedto('admin'), planController.deletePlan);

module.exports = router;

