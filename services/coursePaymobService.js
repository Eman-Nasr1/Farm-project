/**
 * Course-specific Paymob helpers.
 * Reuses authenticate / payment-key logic from paymobService without mixing
 * farm subscription order metadata into course payments.
 */

const axios = require('axios');
const paymobService = require('./paymobService');

const PAYMOB_API_BASE = 'https://accept.paymob.com/api';

/**
 * Create a Paymob order for a course registration payment.
 *
 * @param {Object} params
 * @param {number} params.amountCents
 * @param {Object} params.student - { fullName, email, phone }
 * @param {string} params.bookingCode
 * @param {string} params.paymentId - CoursePayment _id (used in merchant_order_id)
 */
async function createCourseOrder({ amountCents, student, bookingCode, paymentId }) {
  const authToken = await authenticateInternal();

  const nameParts = String(student.fullName || 'Student')
    .split(' ')
    .filter((p) => p.trim().length > 0);
  const firstName = nameParts[0] || 'Student';
  const lastName = nameParts.slice(1).join(' ') || 'Course';

  const orderAmount = parseInt(amountCents, 10);
  if (Number.isNaN(orderAmount) || orderAmount <= 0) {
    throw new Error(`Invalid amount: ${amountCents}`);
  }

  const merchantOrderId = `course_${paymentId}_${Date.now()}`;

  const orderData = {
    auth_token: authToken,
    delivery_needed: 'false',
    amount_cents: orderAmount,
    currency: 'EGP',
    merchant_order_id: merchantOrderId,
    items: [
      {
        name: `Course Registration ${bookingCode}`,
        amount_cents: orderAmount,
        description: `Course registration payment (${bookingCode})`,
        quantity: 1,
      },
    ],
    shipping_data: {
      apartment: 'NA',
      email: student.email,
      floor: 'NA',
      first_name: firstName,
      street: 'NA',
      building: 'NA',
      phone_number: student.phone || '0000000000',
      postal_code: 'NA',
      city: 'NA',
      country: 'EG',
      last_name: lastName,
      state: 'NA',
    },
  };

  const response = await axios.post(`${PAYMOB_API_BASE}/ecommerce/orders`, orderData);

  if (!response.data?.id) {
    throw new Error('Failed to create Paymob course order');
  }

  return {
    orderId: response.data.id,
    merchantOrderId,
    amount: orderAmount,
    currency: 'EGP',
  };
}

/**
 * Get payment key / checkout URL for a course Paymob order.
 */
async function getCoursePaymentKey({ orderId, amountCents, student }) {
  return paymobService.getPaymentKey(
    orderId,
    amountCents,
    'EGP',
    {
      name: student.fullName,
      email: student.email,
      phone: student.phone,
      country: 'EG',
    }
  );
}

async function authenticateInternal() {
  // Reuse private authenticate via createOrder path is awkward; call Paymob directly
  const apiKey = process.env.PAYMOB_API_KEY;
  if (!apiKey) {
    throw new Error('PAYMOB_API_KEY environment variable is not set');
  }

  const response = await axios.post(`${PAYMOB_API_BASE}/auth/tokens`, {
    api_key: apiKey,
  });

  if (!response.data?.token) {
    throw new Error('Failed to authenticate with Paymob');
  }

  return response.data.token;
}

module.exports = {
  createCourseOrder,
  getCoursePaymentKey,
  verifyWebhookSignature: paymobService.verifyWebhookSignature,
};
