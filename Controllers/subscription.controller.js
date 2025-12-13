/**
 * Subscription Controller
 * 
 * Handles subscription-related operations:
 * - Getting available plans
 * - Creating Stripe checkout sessions
 * - Creating Paymob checkout (multi-currency support)
 * - Getting subscription status
 */

const User = require('../Models/user.model');
const Plan = require('../Models/Plan');
const UserSubscription = require('../Models/UserSubscription');
const stripe = require('../config/stripe');
const paymentGatewayService = require('../services/paymentGatewayService');
const Settings = require('../Models/Settings');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Get available subscription plans
 * Returns only active plans that match:
 * - User's registration type
 * - Active payment gateway (Paymob or Stripe)
 * 
 * GET /api/subscriptions/plans
 */
const getAvailablePlans = asyncwrapper(async (req, res, next) => {
  // Get authenticated user
  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.FAIL));
  }

  // Get active payment gateway
  const activeGateway = await paymentGatewayService.getActiveGateway();

  // Build query based on registration type and payment gateway
  const query = { isActive: true };
  
  // Filter by registration type
  if (user.registerationType) {
    query.registerationType = user.registerationType;
  }

  // Filter by payment gateway
  if (activeGateway === 'paymob') {
    // For Paymob: only plans with prices array (multi-currency support)
    // Must have at least EGP price (since all users pay in EGP)
    query.prices = { 
      $exists: true, 
      $ne: [],
      $elemMatch: { currency: 'EGP' }
    };
  } else if (activeGateway === 'stripe') {
    // For Stripe: only plans with stripePriceId
    query.stripePriceId = { $exists: true, $ne: null };
  }

  const plans = await Plan.find(query).sort({ createdAt: -1 });

  // Filter plans to ensure they match gateway requirements
  const filteredPlans = plans.filter(plan => {
    if (activeGateway === 'paymob') {
      // Must have EGP price in prices array
      return plan.prices && plan.prices.some(p => p.currency === 'EGP');
    } else if (activeGateway === 'stripe') {
      // Must have stripePriceId
      return plan.stripePriceId && plan.stripePriceId.trim().length > 0;
    }
    return true;
  });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: filteredPlans,
    gateway: activeGateway,
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

  // Create Stripe Checkout Session (NO trial_period_days - user already used free trial)
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
  const user = await User.findById(userId).populate('planId');

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.FAIL));
  }

  // Initialize trial for existing users who don't have one yet (only if no subscription)
  if (!user.trialStart && !user.trialEnd && user.subscriptionStatus === 'none' && !user.planId) {
    const now = new Date();
    user.subscriptionStatus = 'trialing';
    user.trialStart = now;
    user.trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await user.save();
  }

  const now = new Date();
  let isTrialActive = false;
  let isTrialExpired = false;
  let animalLimit = null;

  // Determine trial status
  if (user.subscriptionStatus === 'active') {
    // Active paid subscription - trial is expired
    isTrialActive = false;
    isTrialExpired = true;
    // Get animal limit from plan
    if (user.planId) {
      animalLimit = user.planId.animalLimit;
    }
  } else if (user.subscriptionStatus === 'trialing') {
    // Check if trial is still active
    if (user.trialEnd && now <= user.trialEnd) {
      isTrialActive = true;
      isTrialExpired = false;
    } else {
      // Trial expired but no active subscription
      isTrialActive = false;
      isTrialExpired = true;
    }
  } else {
    // No trial and no active subscription
    isTrialActive = false;
    isTrialExpired = true;
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      subscriptionStatus: user.subscriptionStatus,
      trialStart: user.trialStart,
      trialEnd: user.trialEnd,
      isTrialActive,
      isTrialExpired,
      planId: user.planId ? user.planId._id : null,
      animalLimit,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      registerationType: user.registerationType,
    },
  });
});

/**
 * Create a checkout session for subscription (Paymob or Stripe based on active gateway)
 * POST /api/subscriptions/checkout
 * 
 * This endpoint automatically uses the active payment gateway (Paymob or Stripe).
 * For Paymob: Returns iframe URL for payment
 * For Stripe: Returns checkout session URL
 * 
 * Request body:
 * {
 *   "planId": "MongoPlanId"
 * }
 * 
 * Response (Paymob):
 * {
 *   "status": "success",
 *   "data": {
 *     "url": "https://accept.paymob.com/api/acceptance/iframes/...",
 *     "orderId": "123456",
 *     "paymentKey": "token_xxx",
 *     "amount": 10000,
 *     "currency": "EGP"
 *   }
 * }
 */
const createCheckout = asyncwrapper(async (req, res, next) => {
  const { planId } = req.body;

  if (!planId) {
    return next(AppError.create('Missing required field: planId', 400, httpstatustext.FAIL));
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
    return next(AppError.create(
      `This plan is for ${plan.registerationType} registration type, but your account is ${user.registerationType}`,
      400,
      httpstatustext.FAIL
    ));
  }

  // Get USD price for display (all users see USD price in UI)
  // But we'll charge everyone in EGP via Paymob
  const userCountry = user.country?.toUpperCase() || 'US';
  
  // Get USD price for display purposes
  const usdPriceInfo = plan.prices?.find(p => p.currency === 'USD') || 
                       (plan.prices && plan.prices.length > 0 ? plan.prices[0] : null);
  
  if (!usdPriceInfo || !usdPriceInfo.amount || usdPriceInfo.amount <= 0) {
    return next(AppError.create(
      'No USD price configured for this plan. Please contact support.',
      400,
      httpstatustext.FAIL
    ));
  }

  // Get EGP price for Paymob payment (all users pay in EGP)
  const egpPriceInfo = plan.prices?.find(p => p.currency === 'EGP');
  
  if (!egpPriceInfo || !egpPriceInfo.amount || egpPriceInfo.amount <= 0) {
    return next(AppError.create(
      'No EGP price configured for this plan. Please contact support.',
      400,
      httpstatustext.FAIL
    ));
  }

  // Display price in USD, but charge in EGP
  const displayPrice = {
    amount: usdPriceInfo.amount,
    currency: 'USD',
  };

  // Actual payment amount in EGP (for Paymob)
  const paymentPrice = {
    amount: egpPriceInfo.amount,
    currency: 'EGP',
  };

  // Create checkout using EGP for Paymob (all users pay in EGP)
  try {
    const checkoutData = await paymentGatewayService.createCheckout(
      paymentPrice.amount,
      paymentPrice.currency,
      user,
      plan
    );

    // Calculate next billing date (default: 1 month from now)
    const nextBillingDate = new Date();
    if (plan.interval === 'year') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + (plan.intervalCount || 1));
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + (plan.intervalCount || 1));
    }

    // Get active gateway to determine payment method
    const activeGateway = await paymentGatewayService.getActiveGateway();

    // Create or update UserSubscription record (status: 'trialing' until payment succeeds)
    // Store actual payment amount (EGP) but keep display price (USD) in metadata
    const subscriptionData = {
      userId: user._id,
      planId: plan._id,
      status: 'trialing', // Will be updated to 'active' when webhook confirms payment
      paymentMethod: activeGateway,
      currency: paymentPrice.currency.toUpperCase(), // EGP (actual payment)
      amount: paymentPrice.amount, // EGP amount (actual payment)
      nextBillingDate: nextBillingDate,
      metadata: {
        displayPrice: displayPrice, // USD price for UI display
        displayCurrency: 'USD',
      },
    };

    if (activeGateway === 'paymob' && checkoutData.orderId) {
      subscriptionData.paymobOrderId = checkoutData.orderId.toString();
    } else if (activeGateway === 'stripe' && checkoutData.sessionId) {
      subscriptionData.stripeSubscriptionId = checkoutData.sessionId;
    }

    // Check if user already has a subscription for this plan
    let subscription = await UserSubscription.findOne({
      userId: user._id,
      planId: plan._id,
      status: { $in: ['trialing', 'active'] },
    });

    if (subscription) {
      // Update existing subscription
      Object.assign(subscription, subscriptionData);
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await UserSubscription.create(subscriptionData);
    }

    res.status(200).json({
      status: httpstatustext.SUCCESS,
      message: 'Checkout created successfully',
      data: {
        ...checkoutData,
        // Display price in USD for UI
        displayPrice: {
          amount: displayPrice.amount,
          currency: displayPrice.currency,
        },
        // Actual payment amount in EGP (for reference)
        paymentAmount: {
          amount: paymentPrice.amount,
          currency: paymentPrice.currency,
        },
        planId: plan._id,
        planName: plan.name,
        subscriptionId: subscription._id,
      },
    });
  } catch (error) {
    console.error('Checkout creation error:', error);
    return next(AppError.create(
      `Failed to create checkout: ${error.message}`,
      500,
      httpstatustext.ERROR
    ));
  }
});

/**
 * Toggle auto-renewal for current user's subscription
 * PUT /api/subscriptions/auto-renew
 * 
 * Request body:
 * {
 *   "autoRenew": true/false
 * }
 */
const toggleAutoRenew = asyncwrapper(async (req, res, next) => {
  const { autoRenew } = req.body;
  const userId = req.user.id;

  if (typeof autoRenew !== 'boolean') {
    return next(AppError.create('autoRenew must be a boolean value', 400, httpstatustext.FAIL));
  }

  // Find active subscription for user
  const subscription = await UserSubscription.findOne({
    userId: userId,
    status: 'active',
  });

  if (!subscription) {
    return next(AppError.create('No active subscription found', 404, httpstatustext.FAIL));
  }

  subscription.autoRenew = autoRenew;
  await subscription.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'} successfully`,
    data: {
      subscriptionId: subscription._id,
      autoRenew: subscription.autoRenew,
    },
  });
});

/**
 * Cancel subscription
 * PUT /api/subscriptions/cancel
 */
const cancelSubscription = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;

  // Find active subscription for user
  const subscription = await UserSubscription.findOne({
    userId: userId,
    status: 'active',
  });

  if (!subscription) {
    return next(AppError.create('No active subscription found', 404, httpstatustext.FAIL));
  }

  // Disable auto-renewal and mark as canceled
  subscription.autoRenew = false;
  subscription.status = 'canceled';
  subscription.canceledAt = new Date();
  await subscription.save();

  // Update user status
  const user = await User.findById(userId);
  if (user) {
    user.subscriptionStatus = 'canceled';
    await user.save();
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Subscription canceled successfully',
    data: {
      subscriptionId: subscription._id,
      canceledAt: subscription.canceledAt,
    },
  });
});

module.exports = {
  getAvailablePlans,
  createCheckoutSession, // Legacy Stripe method (kept for backward compatibility)
  createCheckout, // New unified checkout method (uses active gateway)
  getSubscriptionStatus,
  toggleAutoRenew,
  cancelSubscription,
};

