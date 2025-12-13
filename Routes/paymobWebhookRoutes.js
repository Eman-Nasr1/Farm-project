/**
 * Paymob Webhook Routes
 * 
 * Routes for handling Paymob webhooks.
 * These routes do NOT use authentication middleware as they are
 * verified using webhook signatures instead.
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../Controllers/webhook.controller');

/**
 * Paymob webhook endpoint
 * GET/POST /api/webhooks/paymob
 * 
 * Paymob sends webhooks as GET requests with query parameters
 * This endpoint receives transaction callbacks from Paymob and updates subscription status.
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

