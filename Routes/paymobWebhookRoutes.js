/**
 * Paymob Webhook Routes
 * 
 * Routes for handling Paymob webhooks.
 * These routes do NOT use authentication middleware as they are
 * verified using webhook signatures instead.
 * 
 * IMPORTANT: This route must be registered BEFORE any auth middleware in index.js
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../Controllers/webhook.controller');

/**
 * Paymob webhook endpoint (POST only)
 * POST /api/webhooks/paymob
 * 
 * This is a server-to-server webhook endpoint.
 * Paymob sends POST requests with JSON body containing:
 * - hmac: HMAC signature for verification
 * - obj: Transaction object
 * 
 * This endpoint:
 * 1. Verifies HMAC signature
 * 2. Processes successful transactions
 * 3. Activates subscriptions
 * 
 * No authentication middleware is used - verification is done via Paymob HMAC signature.
 */
router.post(
  '/',
  webhookController.handlePaymobWebhook
);

module.exports = router;

