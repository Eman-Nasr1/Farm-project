/**
 * Require Active Subscription Middleware
 * 
 * Protects routes that require an active subscription.
 * Users with status "active" or "trialing" are allowed access.
 * Others receive a 402 Payment Required response.
 */

const User = require('../Models/user.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Middleware to check if user has an active subscription
 * Allows access if subscriptionStatus is "active" or "trialing"
 */
const requireActiveSubscription = asyncwrapper(async (req, res, next) => {
  // Get user ID from req.user (set by verifytoken middleware)
  if (!req.user || !req.user.id) {
    return next(AppError.create('Authentication required', 401, httpstatustext.ERROR));
  }

  // Load user from database to get current subscription status
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.FAIL));
  }

  // Check subscription status
  const allowedStatuses = ['active', 'trialing'];
  
  if (!allowedStatuses.includes(user.subscriptionStatus)) {
    return next(AppError.create(
      'You need an active subscription to access this feature',
      402, // 402 Payment Required
      httpstatustext.FAIL
    ));
  }

  // Attach user object to request for use in controllers
  req.userObject = user;

  // User has active subscription, proceed
  next();
});

module.exports = requireActiveSubscription;

