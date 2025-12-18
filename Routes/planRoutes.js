/**
 * Plan Routes
 * 
 * Routes for managing subscription plans.
 * GET /api/admin/plans is public (no auth required).
 * All other routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const planController = require('../Controllers/plan.controller');
const verifytoken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');

// Note: GET /api/admin/plans is defined in index.js as a public route (no auth)

// Protected routes - require authentication and admin role
router.post('/api/admin/plans', verifytoken, allowedto('admin'), planController.createPlan);
router.get('/api/admin/plans/:id', verifytoken, allowedto('admin'), planController.getPlanById);
router.put('/api/admin/plans/:id', verifytoken, allowedto('admin'), planController.updatePlan);
router.delete('/api/admin/plans/:id', verifytoken, allowedto('admin'), planController.deletePlan);

module.exports = router;

