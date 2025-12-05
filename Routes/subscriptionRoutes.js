/**
 * Subscription Routes
 * 
 * Routes for user subscription operations.
 * All routes require user authentication.
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../Controllers/subscription.controller');
const verifytoken = require('../middleware/verifytoken');

// All routes require authentication
router.use(verifytoken);

// Get available subscription plans
router.get('/api/subscriptions/plans', subscriptionController.getAvailablePlans);

// Create checkout session for subscription
router.post('/api/subscriptions/checkout', subscriptionController.createCheckoutSession);

// Get subscription status
router.get('/api/subscriptions/status', subscriptionController.getSubscriptionStatus);

module.exports = router;

