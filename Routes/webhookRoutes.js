/**
 * Webhook Routes
 * 
 * Routes for handling external webhooks (Stripe and Paymob).
 * These routes do NOT use authentication middleware as they are
 * verified using webhook signatures instead.
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../Controllers/webhook.controller');

// IMPORTANT: Stripe webhooks require raw body for signature verification
// This is configured in index.js before the general express.json() middleware

/**
 * Stripe webhook endpoint
 * POST /api/webhooks/stripe
 * 
 * This endpoint receives events from Stripe and updates subscription status.
 * No authentication middleware is used - verification is done via Stripe signature.
 */
router.post(
  '/',
  webhookController.handleStripeWebhook
);

module.exports = router;

