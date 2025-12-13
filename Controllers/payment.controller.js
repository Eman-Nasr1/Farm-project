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
  const { success, id, order_id, amount_cents } = req.query;

  // Determine if payment was successful
  const isSuccess = success === 'true' || success === true;

  // Redirect URLs
  const successUrl = 'https://mazraaonline.com/payment/success';
  const failureUrl = 'https://mazraaonline.com/payment/failed';

  // Log the redirect for debugging
  console.log(`🔄 Paymob redirect: order_id=${order_id}, success=${isSuccess}, transaction_id=${id}`);

  // Redirect user to frontend
  if (isSuccess) {
    // Optionally add query parameters to frontend URL
    const redirectUrl = `${successUrl}?order_id=${order_id || ''}&transaction_id=${id || ''}`;
    return res.redirect(redirectUrl);
  } else {
    // Payment failed
    const redirectUrl = `${failureUrl}?order_id=${order_id || ''}&error=payment_failed`;
    return res.redirect(redirectUrl);
  }
});

module.exports = {
  handlePaymobReturn,
};

