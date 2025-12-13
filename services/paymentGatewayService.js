/**
 * Payment Gateway Service
 * 
 * Wrapper service that routes payment operations to the active payment gateway.
 * This allows easy switching between Paymob and Stripe (or other gateways) in the future.
 */

const Settings = require('../Models/Settings');
const paymobService = require('./paymobService');
// const stripeService = require('./stripeService'); // Uncomment when Stripe service is created

/**
 * Get the active payment gateway from settings
 * @returns {Promise<string>} Active gateway name ('paymob' or 'stripe')
 */
async function getActiveGateway() {
  const settings = await Settings.getSettings();
  return settings.activePaymentGateway || 'paymob';
}

/**
 * Create a checkout session/order for subscription
 * @param {number} amount - Amount in the currency's smallest unit
 * @param {string} currency - Currency code (EGP, SAR, USD)
 * @param {Object} user - User object
 * @param {Object} plan - Plan object
 * @returns {Promise<Object>} Checkout data (URL, sessionId, etc.)
 */
async function createCheckout(amount, currency, user, plan) {
  const activeGateway = await getActiveGateway();

  switch (activeGateway) {
    case 'paymob':
      // Create order and get payment key
      const order = await paymobService.createOrder(amount, currency, user, plan);
      const paymentData = await paymobService.getPaymentKey(
        order.orderId,
        amount,
        currency,
        user
      );
      
      return {
        gateway: 'paymob',
        url: paymentData.iframeUrl,
        orderId: paymentData.orderId,
        paymentKey: paymentData.paymentKey,
      };

    case 'stripe':
      // TODO: Implement Stripe checkout when needed
      // return await stripeService.createCheckoutSession(amount, currency, user, plan);
      throw new Error('Stripe integration not yet implemented');

    default:
      throw new Error(`Unsupported payment gateway: ${activeGateway}`);
  }
}

/**
 * Verify webhook signature from payment gateway
 * @param {Object} webhookData - Webhook payload
 * @param {string} signature - Signature from headers
 * @returns {Promise<boolean>} True if signature is valid
 */
async function verifyWebhookSignature(webhookData, signature) {
  const activeGateway = await getActiveGateway();

  switch (activeGateway) {
    case 'paymob':
      // For Paymob, webhookData should be the obj (transaction object)
      // and signature should be the hmac
      return paymobService.verifyWebhookSignature(webhookData, signature);

    case 'stripe':
      // TODO: Implement Stripe webhook verification when needed
      // return await stripeService.verifyWebhookSignature(webhookData, signature);
      throw new Error('Stripe webhook verification not yet implemented');

    default:
      throw new Error(`Unsupported payment gateway: ${activeGateway}`);
  }
}

module.exports = {
  getActiveGateway,
  createCheckout,
  verifyWebhookSignature,
};

