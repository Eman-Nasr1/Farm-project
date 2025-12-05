/**
 * Stripe Webhook Controller
 * 
 * Handles Stripe webhook events to keep subscription status in sync.
 * 
 * Important: This endpoint should NOT use the verifytoken middleware.
 * Stripe webhooks are verified using the webhook signature instead.
 */

const User = require('../Models/user.model');
const stripe = require('../config/stripe');
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
 * Handle subscription.created event
 * When a new subscription is created (e.g., after checkout)
 */
async function handleSubscriptionCreated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = mapStripeStatusToLocal(subscription.status);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Update user subscription info
  user.stripeSubscriptionId = subscriptionId;
  user.subscriptionStatus = status;
  user.subscriptionCurrentPeriodEnd = currentPeriodEnd;

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
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    console.error(`User not found for customer ID: ${customerId}`);
    return;
  }

  // Update user subscription info
  user.stripeSubscriptionId = subscriptionId;
  user.subscriptionStatus = status;
  user.subscriptionCurrentPeriodEnd = currentPeriodEnd;

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
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    user.subscriptionStatus = status;
    user.subscriptionCurrentPeriodEnd = currentPeriodEnd;

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

module.exports = {
  handleStripeWebhook,
};

