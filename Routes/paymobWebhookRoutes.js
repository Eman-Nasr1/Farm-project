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
 * Paymob webhook endpoint
 * GET/POST /api/webhooks/paymob
 * 
 * Paymob can send webhooks as:
 * - GET requests with query parameters (Transaction response callback)
 * - POST requests with JSON body (Server-to-server webhook)
 * 
 * This endpoint:
 * 1. Verifies HMAC signature
 * 2. Processes successful transactions
 * 3. Activates subscriptions
 * 
 * No authentication middleware is used - verification is done via Paymob HMAC signature.
 */
router.get(
  '/',
  webhookController.handlePaymobWebhook
);

router.post(
  '/',
  webhookController.handlePaymobWebhook
);

module.exports = router;

