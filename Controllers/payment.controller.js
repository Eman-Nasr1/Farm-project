/**
 * Payment Controller
 *
 * Handles payment-related operations like redirects and callbacks.
 * These are user-facing endpoints, not webhooks.
 */

const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Handle Paymob payment return/redirect
 * GET /api/payments/paymob/return
 *
 * Query parameters from Paymob:
 * - success: true/false
 * - id: transaction ID
 * - order: Paymob order ID (sometimes order_id)
 * - amount_cents: amount paid
 */
const handlePaymobReturn = asyncwrapper(async (req, res, next) => {
  const {
    success,
    id,
    order,
    order_id,
    error,
  } = req.query;

  // Paymob often sends success as the string "true" / "false"
  const isSuccess = success === true || success === 'true';

  const orderId = order || order_id || '';
  const transactionId = id || '';

  if (isSuccess) {
    console.log('Paymob return hit - redirecting to success page', {
      orderId,
      transactionId,
    });

    return res.redirect('https://mazraaonline.com/payment/success');
  }

  console.log('Paymob return hit - redirecting to failed page', {
    orderId,
    transactionId,
    success,
  });

  const params = new URLSearchParams();
  params.set('error', error || 'payment_failed');
  if (orderId) params.set('order_id', String(orderId));
  if (transactionId) params.set('transaction_id', String(transactionId));

  return res.redirect(
    `https://mazraaonline.com/payment/failed?${params.toString()}`
  );
});

module.exports = {
  handlePaymobReturn,
};
