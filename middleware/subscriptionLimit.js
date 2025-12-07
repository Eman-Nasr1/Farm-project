/**
 * Middleware: requireSubscriptionAndCheckAnimalLimit
 * 
 * Ensures the user has either:
 * - An active paid subscription, OR
 * - An active free trial
 * 
 * AND enforces the correct animal limit:
 * - During free trial → up to TRIAL_ANIMAL_LIMIT animals
 * - With a paid plan → up to plan.animalLimit
 * 
 * Returns 402 (Payment Required) if trial expired and no active subscription.
 * Returns 403 (Forbidden) if animal limit is reached.
 */

const User = require('../Models/user.model');
const Animal = require('../Models/animal.model');
const Plan = require('../Models/Plan');
const { TRIAL_ANIMAL_LIMIT } = require('../config/subscription');

module.exports.requireSubscriptionAndCheckAnimalLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Unauthorized' 
      });
    }

    // Fetch full user document
    const user = await User.findById(userId).populate('planId');
    if (!user) {
      return res.status(401).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }

    const now = new Date();

    // Count current animals for this user
    const currentCount = await Animal.countDocuments({ owner: userId });
    
    // Get number of animals to be created in this request (for breeding entries that create multiple animals)
    // This can be passed via req.body.numberOfAnimals or calculated from birthEntries length
    let numberOfNewAnimals = 1; // default for single animal creation
    if (req.body.birthEntries && Array.isArray(req.body.birthEntries)) {
      numberOfNewAnimals = req.body.birthEntries.length;
    } else if (req.body.numberOfAnimals && typeof req.body.numberOfAnimals === 'number') {
      numberOfNewAnimals = req.body.numberOfAnimals;
    }

    // 1) FREE TRIAL case (no paid plan yet)
    const inTrial =
      user.subscriptionStatus === 'trialing' &&
      user.trialEnd &&
      now <= user.trialEnd &&
      !user.planId; // trial only, no paid plan

    if (inTrial) {
      if (currentCount + numberOfNewAnimals > TRIAL_ANIMAL_LIMIT) {
        return res.status(403).json({
          status: 'error',
          code: 'TRIAL_ANIMAL_LIMIT_REACHED',
          message: `You cannot create ${numberOfNewAnimals} animal(s). This would exceed the free trial limit of ${TRIAL_ANIMAL_LIMIT} animals (current: ${currentCount}). Please subscribe to a paid plan to add more animals.`,
        });
      }
      // still under trial limit → allow
      req.userDocument = user;
      return next();
    }

    // 2) PAID SUBSCRIPTION case
    if (user.subscriptionStatus === 'active' && user.planId) {
      const plan = user.planId;
      if (!plan) {
        return res.status(403).json({
          status: 'error',
          code: 'NO_PLAN_FOUND',
          message: 'No active plan found for this user.',
        });
      }

      if (currentCount + numberOfNewAnimals > plan.animalLimit) {
        return res.status(403).json({
          status: 'error',
          code: 'ANIMAL_LIMIT_REACHED',
          message: `You cannot create ${numberOfNewAnimals} animal(s). This would exceed the maximum number of animals (${plan.animalLimit}) for your plan (current: ${currentCount}). Please upgrade your subscription.`,
        });
      }
      // under plan limit → allow
      req.userDocument = user;
      return next();
    }

    // 3) No active trial and no active subscription
    return res.status(402).json({
      status: 'error',
      code: 'NO_SUBSCRIPTION',
      message: 'Your free trial has ended. Please subscribe to continue using the system.',
    });
  } catch (err) {
    console.error('Subscription limit middleware error:', err);
    return res.status(500).json({ 
      status: 'error',
      message: 'Internal server error' 
    });
  }
};

