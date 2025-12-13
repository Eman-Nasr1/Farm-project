/**
 * Payment Routes
 * 
 * Routes for payment-related operations (redirects, callbacks, etc.)
 * These routes do NOT require authentication as they are used for payment redirects.
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../Controllers/payment.controller');

/**
 * Paymob payment return/redirect endpoint
 * GET /api/payments/paymob/return
 * 
 * This route is used as the Transaction response callback URL in Paymob.
 * It receives GET requests with query parameters after payment completion.
 * 
 * This is NOT a webhook - it's a user-facing redirect URL.
 * No HMAC verification is performed here.
 */
router.get('/api/payments/paymob/return', paymentController.handlePaymobReturn);

module.exports = router;

