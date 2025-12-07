/**
 * Middleware: requireSubscriptionOrTrial
 * 
 * Ensures the user has either:
 * - An active paid subscription, OR
 * - An active free trial
 * 
 * Returns 402 (Payment Required) if trial expired and no active subscription.
 */

const User = require('../Models/user.model');

module.exports = async function requireSubscriptionOrTrial(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Unauthorized' 
      });
    }

    // Fetch full user document from database
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }

    const now = new Date();

    // Active paid subscription
    if (user.subscriptionStatus === 'active') {
      // Attach user to request for use in route handlers
      req.userDocument = user;
      return next();
    }

    // Free trial still valid
    const inTrial =
      user.subscriptionStatus === 'trialing' &&
      user.trialEnd &&
      now <= user.trialEnd;

    if (inTrial) {
      // Attach user to request for use in route handlers
      req.userDocument = user;
      return next();
    }

    // Trial expired and no active subscription
    return res.status(402).json({
      status: 'error',
      code: 'TRIAL_EXPIRED',
      message: 'Your free trial has ended. Please subscribe to continue using the system.',
    });
  } catch (err) {
    console.error('requireSubscriptionOrTrial middleware error:', err);
    return res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
};

