/**
 * Webhook Controller
 * 
 * Handles webhook events from payment gateways (Stripe and Paymob) to keep subscription status in sync.
 * 
 * Important: These endpoints should NOT use the verifytoken middleware.
 * Webhooks are verified using gateway-specific signatures instead.
 */

const User = require('../Models/user.model');
const Plan = require('../Models/Plan');
const UserSubscription = require('../Models/UserSubscription');
const DiscountCode = require('../Models/discountCode.model');
const stripe = require('../config/stripe');
const paymentGatewayService = require('../services/paymentGatewayService');
const paymobService = require('../services/paymobService');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Handle Stripe webhook events
 * POST /api/webhooks/stripe
 * 
 * This endpoint receives events from Stripe and updates the user's
 * subscription status in the database accordingly.
 */
const handleStripeWebhook = asyncwrapper(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('⚠️  STRIPE_WEBHOOK_SECRET is not set');
    return next(AppError.create('Webhook secret not configured', 500, httpstatustext.ERROR));
  }

  let event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return next(AppError.create(`Webhook Error: ${err.message}`, 400, httpstatustext.ERROR));
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    // Still return 200 to prevent Stripe from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Handle checkout.session.completed event
 * When a checkout session is completed (user successfully subscribed)
 */
async function handleCheckoutSessionCompleted(session) {
  // Only handle subscription checkouts
  if (session.mode !== 'subscription') {
    return;
  }

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const subscriptionId = session.subscription;

  if (!userId || !planId || !subscriptionId) {
    console.error('Missing required metadata in checkout session:', { userId, planId, subscriptionId });
    return;
  }

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    console.error(`User not found for ID: ${userId}`);
    return;
  }

  // Retrieve subscription from Stripe to get full details
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const status = mapStripeStatusToLocal(subscription.status);
    const currentPeriodEnd = safeTimestampToDate(subscription.current_period_end);

    // Update user subscription info
    user.planId = planId;
    user.subscriptionStatus = status;
    user.stripeSubscriptionId = subscriptionId;
    // Only set currentPeriodEnd if it's a valid date
    if (currentPeriodEnd) {
      user.subscriptionCurrentPeriodEnd = currentPeriodEnd;
    }
    // Trial is now over (user has paid subscription)
    // Keep trialStart and trialEnd for historical purposes, but status is now 'active'

    await user.save();
    
    // Increment discount code usage if one was used
    if (session.metadata?.discountCode) {
      try {
        const discountCode = await DiscountCode.findOne({ code: session.metadata.discountCode });
        if (discountCode) {
          await discountCode.incrementUsage();
          console.log(`✅ Discount code ${discountCode.code} usage incremented`);
        }
      } catch (error) {
        console.error('Error incrementing discount code usage:', error);
        // Don't fail the webhook if discount code update fails
      }
    }
    
    console.log(`✅ Checkout completed for user ${user._id}, subscription: ${status}, plan: ${planId}`);
  } catch (error) {
    console.error('Error retrieving subscription from Stripe:', error);
  }
}

/**
 * Handle subscription.created event
 * When a new subscription is created (e.g., after checkout)
 */
async function handleSubscriptionCreated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = mapStripeStatusToLocal(subscription.status);
  const currentPeriodEnd = safeTimestampToDate(subscription.current_period_end);

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Extract planId from subscription metadata if available
  const planId = subscription.metadata?.planId;
  if (planId) {
    user.planId = planId;
  }

  // Update user subscription info
  user.stripeSubscriptionId = subscriptionId;
  user.subscriptionStatus = status;
  // Only set currentPeriodEnd if it's a valid date
  if (currentPeriodEnd) {
    user.subscriptionCurrentPeriodEnd = currentPeriodEnd;
  }

  await user.save();
  console.log(`✅ Subscription created for user ${user._id}: ${status}`);
}

/**
 * Handle subscription.updated event
 * When subscription status changes (e.g., trial ends, payment succeeds)
 */
async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = mapStripeStatusToLocal(subscription.status);
  const currentPeriodEnd = safeTimestampToDate(subscription.current_period_end);

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Extract planId from subscription metadata if available
  const planId = subscription.metadata?.planId;
  if (planId) {
    user.planId = planId;
  }

  // Update user subscription info
  user.stripeSubscriptionId = subscriptionId;
  user.subscriptionStatus = status;
  // Only set currentPeriodEnd if it's a valid date
  if (currentPeriodEnd) {
    user.subscriptionCurrentPeriodEnd = currentPeriodEnd;
  }

  await user.save();
  console.log(`✅ Subscription updated for user ${user._id}: ${status}`);
}

/**
 * Handle subscription.deleted event
 * When a subscription is canceled
 */
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Update user subscription status to canceled
  user.subscriptionStatus = 'canceled';
  // Optionally clear subscription ID if you want
  // user.stripeSubscriptionId = null;

  await user.save();
  console.log(`✅ Subscription canceled for user ${user._id}`);
}

/**
 * Handle invoice.payment_succeeded event
 * When a payment is successfully processed
 */
async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    // This might be a one-time payment, not a subscription
    return;
  }

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Fetch subscription to get current status
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const status = mapStripeStatusToLocal(subscription.status);
    const currentPeriodEnd = safeTimestampToDate(subscription.current_period_end);

    // Extract planId from subscription metadata if available
    const planId = subscription.metadata?.planId;
    if (planId && !user.planId) {
      user.planId = planId;
    }

    user.subscriptionStatus = status;
    // Only set currentPeriodEnd if it's a valid date
    if (currentPeriodEnd) {
      user.subscriptionCurrentPeriodEnd = currentPeriodEnd;
    }

    await user.save();
    console.log(`✅ Payment succeeded for user ${user._id}, subscription: ${status}`);
  } catch (error) {
    console.error('Error fetching subscription:', error);
  }
}

/**
 * Handle invoice.payment_failed event
 * When a payment fails
 */
async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return;
  }

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Update subscription status to past_due
  user.subscriptionStatus = 'past_due';

  await user.save();
  console.log(`⚠️  Payment failed for user ${user._id}`);
}

/**
 * Safely convert Stripe timestamp to Date object
 * Returns null if timestamp is invalid or missing
 */
function safeTimestampToDate(timestamp) {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
    return null;
  }
  const date = new Date(timestamp * 1000);
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Map Stripe subscription status to local status enum
 */
function mapStripeStatusToLocal(stripeStatus) {
  const statusMap = {
    'trialing': 'trialing',
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'past_due',
    'incomplete': 'past_due',
    'incomplete_expired': 'canceled',
    'paused': 'canceled',
  };

  return statusMap[stripeStatus] || 'none';
}

/**
 * Handle Paymob webhook events
 * GET/POST /api/webhooks/paymob
 * 
 * Paymob can send webhooks as:
 * - GET requests with query parameters (Transaction response callback)
 * - POST requests with JSON body (Server-to-server webhook)
 * 
 * This endpoint:
 * 1. Verifies HMAC signature using Paymob's official format
 * 2. Processes successful transactions (success=true, pending=false)
 * 3. Activates subscriptions in the database
 * 4. Updates user subscription status
 * 
 * IMPORTANT: This route does NOT use authentication middleware.
 * Verification is done via Paymob HMAC signature.
 */
const handlePaymobWebhook = asyncwrapper(async (req, res, next) => {
  try {
    let trx, hmac, paymobOrderId;

    // Handle GET request (query parameters) or POST request (JSON body)
    if (req.method === 'GET') {
      // GET request: data comes from query parameters
      const query = req.query;
      
      // Helper function to convert string boolean to boolean
      const toBool = (val) => {
        if (val === 'true' || val === true) return true;
        if (val === 'false' || val === false) return false;
        return val;
      };
      
      // Build transaction object from query parameters for HMAC verification
      // Note: Paymob sends query parameters as strings, so we need to parse them correctly
      // Express handles dots in query params, so 'source_data.type' becomes query['source_data.type']
      trx = {
        amount_cents: query.amount_cents ? parseInt(query.amount_cents, 10) : '',
        created_at: query.created_at || '',
        currency: query.currency || '',
        error_occured: toBool(query.error_occured),
        has_parent_transaction: toBool(query.has_parent_transaction),
        id: query.id || '',
        integration_id: query.integration_id || '',
        is_3d_secure: toBool(query.is_3d_secure),
        is_auth: toBool(query.is_auth),
        is_capture: toBool(query.is_capture),
        is_refunded: toBool(query.is_refunded),
        is_standalone_payment: toBool(query.is_standalone_payment),
        is_voided: toBool(query.is_voided),
        order: {
          id: query.order || query.order_id || ''
        },
        owner: query.owner || '',
        pending: toBool(query.pending),
        source_data: {
          pan: query['source_data.pan'] || query['source_data[pan]'] || (query.source_data && query.source_data.pan) || '',
          sub_type: query['source_data.sub_type'] || query['source_data[sub_type]'] || (query.source_data && query.source_data.sub_type) || '',
          type: query['source_data.type'] || query['source_data[type]'] || (query.source_data && query.source_data.type) || ''
        },
        success: toBool(query.success)
      };

      hmac = query.hmac;
      paymobOrderId = query.order || query.order_id;
    } else if (req.method === 'POST') {
      // POST request: data comes from JSON body
      const { hmac: bodyHmac, obj } = req.body;
      
      if (!obj) {
        console.error('⚠️  Paymob webhook missing transaction object (obj)');
        return res.status(400).json({ 
          status: 'error', 
          message: 'Missing transaction object', 
          code: 400, 
          data: null 
        });
      }

      trx = obj;
      hmac = bodyHmac;
      paymobOrderId = trx.order?.id;
    } else {
      return res.status(405).json({ 
        status: 'error', 
        message: 'Method not allowed. Only GET and POST are accepted.', 
        code: 405 
      });
    }

    // Verify HMAC signature if provided
    if (hmac && process.env.PAYMOB_HMAC) {
      const isValid = paymobService.verifyWebhookSignature(trx, hmac);
      if (!isValid) {
        console.error('⚠️  Paymob webhook HMAC verification failed');
        return res.status(400).json({ 
          status: 'error', 
          message: 'Invalid webhook signature', 
          code: 400, 
          data: null 
        });
      }
    } else if (process.env.PAYMOB_HMAC && !hmac) {
      console.warn('⚠️  PAYMOB_HMAC is set but no HMAC provided in webhook request');
      // Continue processing but log warning
    }

    // Only process successful and non-pending transactions
    if (trx.success !== true || trx.pending !== false) {
      console.log(`ℹ️  Paymob webhook received non-successful transaction: success=${trx.success}, pending=${trx.pending}`);
      // Return 200 to acknowledge receipt, but don't activate subscription
      return res.status(200).json({ status: 'ok', message: 'Transaction not successful or still pending' });
    }

    // Get Paymob order ID
    if (!paymobOrderId) {
      console.error('⚠️  Paymob webhook missing order ID');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing order ID', 
        code: 400, 
        data: null 
      });
    }

    // Find the subscription by Paymob order ID
    const subscription = await UserSubscription.findOne({ paymobOrderId: paymobOrderId.toString() });
    if (!subscription) {
      console.error(`⚠️  Subscription not found for Paymob order ID: ${paymobOrderId}`);
      // Return 200 to acknowledge receipt (don't let Paymob retry)
      return res.status(200).json({ status: 'ok', message: 'Subscription not found' });
    }

    // Verify amount matches (optional check)
    if (trx.amount_cents && subscription.amount !== trx.amount_cents) {
      console.warn(`⚠️  Amount mismatch for order ${paymobOrderId}. Expected: ${subscription.amount}, Received: ${trx.amount_cents}`);
      // Still process, but log the discrepancy
    }

    // Payment successful - activate subscription
    subscription.status = 'active';
    subscription.paymobTransactionId = trx.id?.toString();
    
    // Save payment token if provided (for auto-renewal)
    const paymentToken = trx.token;
    if (paymentToken && !subscription.paymentToken) {
      subscription.paymentToken = paymentToken;
      console.log(`💳 Saved payment token for subscription ${subscription._id}`);
    }
    
    // Calculate next billing date based on plan interval
    const plan = await Plan.findById(subscription.planId);
    if (plan) {
      const nextBillingDate = new Date();
      if (plan.interval === 'year') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + (plan.intervalCount || 1));
      } else {
        // Default to monthly
        nextBillingDate.setMonth(nextBillingDate.getMonth() + (plan.intervalCount || 1));
      }
      subscription.nextBillingDate = nextBillingDate;
    } else {
      // Default to 1 month if plan not found
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      subscription.nextBillingDate = nextBillingDate;
    }
    
    // Reset failed renewal attempts on successful payment
    subscription.failedRenewalAttempts = 0;
    
    // Save subscription
    await subscription.save();
    
    // Update user's subscription status
    const user = await User.findById(subscription.userId);
    if (user) {
      user.subscriptionStatus = 'active';
      user.planId = subscription.planId;
      user.subscriptionCurrentPeriodEnd = subscription.nextBillingDate;
      
      // Mark trial as expired since user has paid subscription
      // Trial fields remain for historical purposes
      
      await user.save();
      console.log(`✅ User ${user._id} subscription activated. Plan: ${subscription.planId}, Expires: ${subscription.nextBillingDate}`);
    }

    // Increment discount code usage if one was used
    if (subscription.metadata?.discountCode) {
      try {
        const discountCode = await DiscountCode.findOne({ code: subscription.metadata.discountCode });
        if (discountCode) {
          await discountCode.incrementUsage();
          console.log(`✅ Discount code ${discountCode.code} usage incremented`);
        }
      } catch (error) {
        console.error('Error incrementing discount code usage:', error);
        // Don't fail the webhook if discount code update fails
      }
    }

    console.log(`✅ Paymob payment succeeded for order ${paymobOrderId}, subscription activated for user ${subscription.userId}`);

    // Return success response to Paymob
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('⚠️  Error handling Paymob webhook:', error);
    // Still return 200 to prevent Paymob from retrying
    return res.status(200).json({ status: 'ok', error: error.message });
  }
});

module.exports = {
  handleStripeWebhook,
  handlePaymobWebhook,
};

