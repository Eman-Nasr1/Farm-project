/**
 * Payment Controller
 *
 * Handles payment-related operations like redirects and callbacks.
 * These are user-facing endpoints, not webhooks.
 *
 * Course Paymob return redirect is controlled here.
 * Prefer COURSE_FRONTEND_URL or FRONTEND_URL (not APP_URL — APP_URL is often localhost for impersonation).
 * Production default: https://mazraaonline.com
 */

const asyncwrapper = require('../middleware/asyncwrapper');
const CoursePayment = require('../Models/coursePayment.model');

const PRODUCTION_FRONTEND_URL = 'https://mazraaonline.com';

/**
 * Frontend base URL for Course Paymob user redirects.
 * Env vars (first match wins):
 * - COURSE_FRONTEND_URL
 * - FRONTEND_URL
 * Fallback: https://mazraaonline.com
 *
 * Do NOT use APP_URL here — it is often set to localhost for other features.
 */
function getCourseFrontendBaseUrl() {
  const raw =
    process.env.COURSE_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    PRODUCTION_FRONTEND_URL;

  return String(raw).trim().replace(/\/$/, '');
}

/**
 * Handle Paymob payment return/redirect
 * GET /api/payments/paymob/return
 *
 * Query parameters from Paymob:
 * - success: true/false
 * - id: transaction ID
 * - order: Paymob order ID (sometimes order_id)
 * - amount_cents: amount paid
 *
 * This endpoint does NOT mark payments as paid.
 * It only redirects the user to the correct frontend status page.
 */
const handlePaymobReturn = asyncwrapper(async (req, res) => {
  const {
    success,
    id,
    order,
    order_id,
    error,
  } = req.query;

  const isSuccess = success === true || success === 'true';
  const orderId = order || order_id || '';
  const transactionId = id || '';

  // Route course payments to the course frontend pages
  let isCoursePayment = false;
  if (orderId) {
    const coursePayment = await CoursePayment.findOne({
      gatewayOrderId: String(orderId),
      paymentContext: 'course_registration',
    }).select('_id');
    isCoursePayment = Boolean(coursePayment);
  }

  if (isCoursePayment) {
    const frontendBase = getCourseFrontendBaseUrl();

    if (isSuccess) {
      // Exact success shape required by the course frontend:
      // https://mazraaonline.com/course/payment?status=success&order_id=<PAYMOB_ORDER_ID>
      return res.redirect(
        `${frontendBase}/course/payment?status=success&order_id=${encodeURIComponent(orderId)}`
      );
    }

    const params = new URLSearchParams();
    params.set('status', 'failed');
    params.set('error', error || 'payment_failed');
    if (orderId) params.set('order_id', String(orderId));
    if (transactionId) params.set('transaction_id', String(transactionId));
    return res.redirect(`${frontendBase}/course/payment?${params.toString()}`);
  }

  if (isSuccess) {
    console.log('Paymob return hit - redirecting to success page', {
      orderId,
      transactionId,
    });

    return res.redirect(`${PRODUCTION_FRONTEND_URL}/payment/success`);
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
    `${PRODUCTION_FRONTEND_URL}/payment/failed?${params.toString()}`
  );
});

module.exports = {
  handlePaymobReturn,
  getCourseFrontendBaseUrl,
};
