/**
 * Payment Controller
 * 
 * Handles payment-related operations like redirects and callbacks.
 * These are user-facing endpoints, not webhooks.
 */

const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Handle Paymob payment return/redirect
 * GET /api/payments/paymob/return
 * 
 * This endpoint is called by Paymob after payment completion.
 * It redirects the user to the frontend success/failure page.
 * 
 * Query parameters from Paymob:
 * - success: true/false
 * - id: transaction ID
 * - order_id: Paymob order ID
 * - amount_cents: amount paid
 * - Other transaction details
 */
const handlePaymobReturn = asyncwrapper(async (req, res, next) => {

  console.log('🔁 Paymob return hit – redirecting to success page');

  const redirectUrl = 'https://mazraaonline.com/payment/success';

  return res.redirect(redirectUrl);
});


module.exports = {
  handlePaymobReturn,
};

