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

// Get available subscription plans
router.get('/api/subscriptions/plans', verifytoken, subscriptionController.getAvailablePlans);

// Create checkout session for subscription (unified - uses active payment gateway)
router.post('/api/subscriptions/checkout', verifytoken, subscriptionController.createCheckout);

// Legacy Stripe checkout (kept for backward compatibility)
router.post('/api/subscriptions/checkout/stripe', verifytoken, subscriptionController.createCheckoutSession);

// Get subscription status
router.get('/api/subscriptions/status', verifytoken, subscriptionController.getSubscriptionStatus);

// Toggle auto-renewal
router.put('/api/subscriptions/auto-renew', verifytoken, subscriptionController.toggleAutoRenew);

// Cancel subscription
router.put('/api/subscriptions/cancel', verifytoken, subscriptionController.cancelSubscription);

module.exports = router;

