/**
 * Subscription Renewal Service
 * 
 * Handles automatic subscription renewal for both Paymob and Stripe.
 * For Paymob: Uses tokenization to charge saved payment methods.
 * For Stripe: Uses Stripe's built-in subscription management.
 */

const UserSubscription = require('../Models/UserSubscription');
const User = require('../Models/user.model');
const Plan = require('../Models/Plan');
const paymobService = require('./paymobService');
const axios = require('axios');

const PAYMOB_API_BASE = 'https://accept.paymob.com/api';

/**
 * Process automatic renewal for a subscription
 * @param {Object} subscription - UserSubscription document
 * @returns {Promise<Object>} Renewal result
 */
async function processRenewal(subscription) {
  try {
    // Check if subscription is eligible for renewal
    if (!subscription.autoRenew || subscription.status !== 'active') {
      return {
        success: false,
        reason: 'Subscription not eligible for auto-renewal',
      };
    }

    // Check if renewal date has passed
    const now = new Date();
    if (subscription.nextBillingDate > now) {
      return {
        success: false,
        reason: 'Renewal date not yet reached',
      };
    }

    // Get user and plan
    const user = await User.findById(subscription.userId);
    const plan = await Plan.findById(subscription.planId);

    if (!user || !plan) {
      return {
        success: false,
        reason: 'User or plan not found',
      };
    }

    // Process renewal based on payment method
    if (subscription.paymentMethod === 'paymob') {
      return await processPaymobRenewal(subscription, user, plan);
    } else if (subscription.paymentMethod === 'stripe') {
      // Stripe handles renewals automatically, but we can update the subscription here
      return await processStripeRenewal(subscription, user, plan);
    }

    return {
      success: false,
      reason: 'Unsupported payment method',
    };
  } catch (error) {
    console.error(`Error processing renewal for subscription ${subscription._id}:`, error);
    return {
      success: false,
      reason: error.message,
      error: error,
    };
  }
}

/**
 * Process Paymob subscription renewal using tokenization
 * @param {Object} subscription - UserSubscription document
 * @param {Object} user - User document
 * @param {Object} plan - Plan document
 * @returns {Promise<Object>} Renewal result
 */
async function processPaymobRenewal(subscription, user, plan) {
  try {
    // Get price for user's country
    const priceInfo = plan.getPriceForCountry(user.country);
    
    if (!priceInfo || !priceInfo.amount) {
      return {
        success: false,
        reason: 'No price configured for user country',
      };
    }

    // If payment token exists, use it for automatic charge
    if (subscription.paymentToken) {
      return await chargeWithToken(subscription, user, plan, priceInfo);
    }

    // If no token, create a new order and notify user
    // This requires user to complete payment manually
    return await createRenewalOrder(subscription, user, plan, priceInfo);
  } catch (error) {
    console.error('Paymob renewal error:', error);
    return {
      success: false,
      reason: error.message,
      error: error,
    };
  }
}

/**
 * Charge using saved payment token (Paymob tokenization)
 * @param {Object} subscription - UserSubscription document
 * @param {Object} user - User document
 * @param {Object} plan - Plan document
 * @param {Object} priceInfo - Price information
 * @returns {Promise<Object>} Charge result
 */
async function chargeWithToken(subscription, user, plan, priceInfo) {
  try {
    // TODO: Implement Paymob tokenization API
    // Paymob may support tokenization, but the API structure may differ
    // Check Paymob documentation for tokenization endpoints
    
    // For now, if token exists, we'll attempt to use it
    // If Paymob doesn't support tokenization, this will fall back to manual payment
    
    // Create order for renewal
    const order = await paymobService.createOrder(
      priceInfo.amount,
      priceInfo.currency,
      user,
      plan
    );

    // Attempt to charge using saved token
    // This is a placeholder - you need to implement based on Paymob's actual API
    try {
      // Example implementation (adjust based on Paymob API):
      // const authToken = await paymobService.authenticate();
      // const chargeResponse = await axios.post(
      //   `${PAYMOB_API_BASE}/acceptance/payments/pay`,
      //   {
      //     source: {
      //       identifier: subscription.paymentToken,
      //       subtype: 'TOKEN',
      //     },
      //     amount_cents: priceInfo.amount,
      //     currency: priceInfo.currency,
      //     order_id: order.orderId,
      //   },
      //   {
      //     headers: {
      //       Authorization: `Bearer ${authToken}`,
      //     },
      //   }
      // );

      // If tokenization is not available, fall back to manual payment
      throw new Error('Tokenization not implemented - requires manual payment');
    } catch (tokenError) {
      // If tokenization fails or is not available, create manual payment URL
      const paymentData = await paymobService.getPaymentKey(
        order.orderId,
        priceInfo.amount,
        priceInfo.currency,
        user
      );

      await handleRenewalFailure(subscription);
      return {
        success: false,
        requiresManualPayment: true,
        reason: 'Tokenization not available. Manual payment required.',
        paymentUrl: paymentData.iframeUrl,
        orderId: order.orderId,
      };
    }
  } catch (error) {
    console.error('Token charge error:', error);
    await handleRenewalFailure(subscription);
    return {
      success: false,
      reason: error.message,
      error: error,
    };
  }
}

/**
 * Create a new order for renewal (when no saved token)
 * User will need to complete payment manually
 * @param {Object} subscription - UserSubscription document
 * @param {Object} user - User document
 * @param {Object} plan - Plan document
 * @param {Object} priceInfo - Price information
 * @returns {Promise<Object>} Order creation result
 */
async function createRenewalOrder(subscription, user, plan, priceInfo) {
  try {
    // Create order
    const order = await paymobService.createOrder(
      priceInfo.amount,
      priceInfo.currency,
      user,
      plan
    );

    // Get payment key
    const paymentData = await paymobService.getPaymentKey(
      order.orderId,
      priceInfo.amount,
      priceInfo.currency,
      user
    );

    // Update subscription with pending renewal
    subscription.status = 'past_due';
    subscription.paymobOrderId = order.orderId.toString();
    subscription.lastRenewalAttempt = new Date();
    subscription.failedRenewalAttempts += 1;
    await subscription.save();

    // TODO: Send notification email to user about pending renewal
    // You can use nodemailer or your notification service here

    return {
      success: false,
      requiresManualPayment: true,
      reason: 'No saved payment method. User must complete payment manually.',
      paymentUrl: paymentData.iframeUrl,
      orderId: order.orderId,
    };
  } catch (error) {
    console.error('Renewal order creation error:', error);
    await handleRenewalFailure(subscription);
    return {
      success: false,
      reason: error.message,
      error: error,
    };
  }
}

/**
 * Process Stripe subscription renewal
 * Stripe handles renewals automatically, but we update our records
 * @param {Object} subscription - UserSubscription document
 * @param {Object} user - User document
 * @param {Object} plan - Plan document
 * @returns {Promise<Object>} Renewal result
 */
async function processStripeRenewal(subscription, user, plan) {
  // Stripe handles renewals automatically via webhooks
  // This function is mainly for updating our records if needed
  // The webhook handler will update the subscription when Stripe processes the renewal
  
  return {
    success: true,
    message: 'Stripe handles renewals automatically via webhooks',
  };
}

/**
 * Update subscription after successful renewal
 * @param {Object} subscription - UserSubscription document
 * @param {string} orderId - New order ID
 * @param {string} transactionId - Transaction ID
 */
async function updateSubscriptionAfterRenewal(subscription, orderId, transactionId) {
  const plan = await Plan.findById(subscription.planId);
  if (!plan) return;

  // Calculate next billing date
  const nextBillingDate = new Date();
  if (plan.interval === 'year') {
    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + (plan.intervalCount || 1));
  } else {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + (plan.intervalCount || 1));
  }

  // Update subscription
  subscription.status = 'active';
  subscription.paymobOrderId = orderId.toString();
  subscription.paymobTransactionId = transactionId?.toString();
  subscription.nextBillingDate = nextBillingDate;
  subscription.lastRenewalAttempt = new Date();
  subscription.failedRenewalAttempts = 0; // Reset on success
  await subscription.save();

  // Update user subscription status
  const user = await User.findById(subscription.userId);
  if (user) {
    user.subscriptionStatus = 'active';
    user.planId = subscription.planId;
    user.subscriptionCurrentPeriodEnd = nextBillingDate;
    await user.save();
  }
}

/**
 * Handle renewal failure
 * @param {Object} subscription - UserSubscription document
 */
async function handleRenewalFailure(subscription) {
  subscription.lastRenewalAttempt = new Date();
  subscription.failedRenewalAttempts += 1;

  // After 3 failed attempts, mark as past_due
  if (subscription.failedRenewalAttempts >= 3) {
    subscription.status = 'past_due';
    
    // Update user status
    const user = await User.findById(subscription.userId);
    if (user) {
      user.subscriptionStatus = 'past_due';
      await user.save();
    }
  }

  await subscription.save();
}

/**
 * Find subscriptions due for renewal
 * @param {number} daysAhead - Number of days ahead to check (default: 0 for today)
 * @returns {Promise<Array>} Array of subscriptions due for renewal
 */
async function findSubscriptionsDueForRenewal(daysAhead = 0) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysAhead);
  targetDate.setHours(23, 59, 59, 999); // End of day

  const subscriptions = await UserSubscription.find({
    status: 'active',
    autoRenew: true,
    nextBillingDate: {
      $lte: targetDate,
    },
  })
    .populate('userId')
    .populate('planId');

  return subscriptions;
}

module.exports = {
  processRenewal,
  findSubscriptionsDueForRenewal,
  processPaymobRenewal,
  processStripeRenewal,
};

