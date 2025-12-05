/**
 * Subscription Controller
 * 
 * Handles subscription-related operations:
 * - Getting available plans
 * - Creating Stripe checkout sessions
 * - Getting subscription status
 */

const User = require('../Models/user.model');
const Plan = require('../Models/Plan');
const stripe = require('../config/stripe');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Get available subscription plans
 * Returns only active plans that match the user's registration type
 * GET /api/subscriptions/plans
 */
const getAvailablePlans = asyncwrapper(async (req, res, next) => {
  // Get authenticated user
  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.FAIL));
  }

  // If user has a registration type, filter plans by it
  // Otherwise, return all active plans
  const query = { isActive: true };
  if (user.registerationType) {
    query.registerationType = user.registerationType;
  }

  const plans = await Plan.find(query).sort({ amount: 1 });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: plans,
  });
});

/**
 * Create a Stripe checkout session for subscription
 * POST /api/subscriptions/checkout
 * 
 * Request body:
 * {
 *   "planId": "MongoPlanId",
 *   "successUrl": "https://frontend-domain.com/subscription/success?session_id={CHECKOUT_SESSION_ID}",
 *   "cancelUrl": "https://frontend-domain.com/subscription/cancel"
 * }
 */
const createCheckoutSession = asyncwrapper(async (req, res, next) => {
  const { planId, successUrl, cancelUrl } = req.body;

  if (!planId || !successUrl || !cancelUrl) {
    return next(AppError.create('Missing required fields: planId, successUrl, cancelUrl', 400, httpstatustext.FAIL));
  }

  // Get authenticated user
  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.FAIL));
  }

  // Load the plan
  const plan = await Plan.findById(planId);

  if (!plan) {
    return next(AppError.create('Plan not found', 404, httpstatustext.FAIL));
  }

  if (!plan.isActive) {
    return next(AppError.create('Plan is not active', 400, httpstatustext.FAIL));
  }

  // Ensure user's registration type matches the plan
  if (user.registerationType && user.registerationType !== plan.registerationType) {
    return next(AppError.create(`This plan is for ${plan.registerationType} registration type, but your account is ${user.registerationType}`, 400, httpstatustext.FAIL));
  }

  // Create or get Stripe customer
  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: userId.toString(),
      },
    });

    stripeCustomerId = customer.id;
    
    // Save the customer ID to the user
    user.stripeCustomerId = stripeCustomerId;
    await user.save();
  }

  // Create Stripe Checkout Session with 1-month free trial
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 30, // 1 month free trial
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        registerationType: plan.registerationType,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      planId: planId.toString(),
    },
  });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Checkout session created successfully',
    data: {
      url: session.url,
      sessionId: session.id,
    },
  });
});

/**
 * Get current user's subscription status
 * GET /api/subscriptions/status
 */
const getSubscriptionStatus = asyncwrapper(async (req, res, next) => {
  // Get authenticated user
  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.FAIL));
  }

  // Get the plan if user has a subscription
  let plan = null;
  if (user.stripeSubscriptionId) {
    // Optionally fetch subscription details from Stripe
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      // You can include more Stripe subscription details here if needed
    } catch (error) {
      console.error('Error fetching subscription from Stripe:', error);
    }
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      registerationType: user.registerationType,
    },
  });
});

module.exports = {
  getAvailablePlans,
  createCheckoutSession,
  getSubscriptionStatus,
};

