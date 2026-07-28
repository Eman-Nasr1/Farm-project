/**
 * Plan Controller
 *
 * Handles CRUD operations for subscription plans (admin only).
 * Supports Stripe (legacy) and Paymob pricing with USD/EGP auto-conversion.
 */

const Plan = require('../Models/Plan');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const { isValidFatteningProfile } = require('../utilits/animalTypes');
const exchangeRateService = require('../services/exchangeRateService');
const {
  buildPlanPricingFields,
  previewPlanPricing,
  formatPlanForResponse,
  normalizeCurrency,
} = require('../services/planPricingService');

const FATTENING_PROFILES = ['small_ruminants', 'large_ruminants', 'all'];

function formatPlansForResponse(plans) {
  return plans.map((plan) => formatPlanForResponse(plan));
}

function hasEnteredPricing(body) {
  return body.enteredPrice !== undefined && body.enteredPrice !== null && body.enteredCurrency;
}

async function applyEnteredPricing(planData, enteredPrice, enteredCurrency) {
  const pricing = await buildPlanPricingFields(enteredPrice, enteredCurrency);

  planData.enteredPrice = pricing.enteredPrice;
  planData.enteredCurrency = pricing.enteredCurrency;
  planData.priceUSD = pricing.priceUSD;
  planData.priceEGP = pricing.priceEGP;
  planData.exchangeRate = pricing.exchangeRate;
  planData.exchangeRateUpdatedAt = pricing.exchangeRateUpdatedAt;
  planData.prices = pricing.prices;

  return planData;
}

/**
 * Create a new subscription plan (Admin only)
 * POST /api/admin/plans
 */
const createPlan = asyncwrapper(async (req, res, next) => {
  const {
    name,
    registerationType,
    fatteningFarmProfile,
    stripePriceId,
    currency,
    interval,
    intervalCount,
    amount,
    enteredPrice,
    enteredCurrency,
    animalLimit,
    isActive,
  } = req.body;

  if (!name || !registerationType || animalLimit === undefined || animalLimit === null) {
    return next(AppError.create('Missing required fields: name, registerationType, animalLimit', 400, httpstatustext.FAIL));
  }

  if (registerationType === 'fattening') {
    if (!fatteningFarmProfile || !isValidFatteningProfile(fatteningFarmProfile)) {
      return next(AppError.create(
        'fatteningFarmProfile is required for fattening plans: small_ruminants, large_ruminants, or all',
        400,
        httpstatustext.FAIL
      ));
    }
  }

  if (typeof animalLimit !== 'number' || animalLimit <= 0) {
    return next(AppError.create('animalLimit must be a positive number', 400, httpstatustext.FAIL));
  }

  const isStripePlan = stripePriceId && amount;
  const isPaymobPlan = hasEnteredPricing(req.body);

  if (!isStripePlan && !isPaymobPlan) {
    return next(AppError.create(
      'Either provide stripePriceId + amount (for Stripe) OR enteredPrice + enteredCurrency (for Paymob)',
      400,
      httpstatustext.FAIL
    ));
  }

  if (isPaymobPlan) {
    const normalizedCurrency = normalizeCurrency(enteredCurrency);
    if (typeof enteredPrice !== 'number' || enteredPrice <= 0) {
      return next(AppError.create('enteredPrice must be a number greater than zero', 400, httpstatustext.FAIL));
    }
    if (!['USD', 'EGP'].includes(normalizedCurrency)) {
      return next(AppError.create('enteredCurrency must be USD or EGP', 400, httpstatustext.FAIL));
    }
  }

  const existingQuery = { registerationType, name };
  if (registerationType === 'fattening') {
    existingQuery.fatteningFarmProfile = fatteningFarmProfile;
  }
  const existingPlan = await Plan.findOne(existingQuery);

  if (existingPlan) {
    return next(AppError.create('Plan with this registration type and name already exists', 400, httpstatustext.FAIL));
  }

  const planData = {
    name,
    registerationType,
    interval: interval || 'month',
    animalLimit: Number(animalLimit),
    isActive: isActive !== undefined ? isActive : true,
    intervalCount: intervalCount !== undefined && intervalCount !== null ? Number(intervalCount) : 1,
  };

  if (registerationType === 'fattening') {
    planData.fatteningFarmProfile = fatteningFarmProfile;
  }

  if (isStripePlan) {
    planData.stripePriceId = stripePriceId;
    planData.currency = currency || 'usd';
    planData.amount = amount;
  }

  if (isPaymobPlan) {
    try {
      await applyEnteredPricing(planData, enteredPrice, enteredCurrency);
    } catch (error) {
      return next(AppError.create(error.message, 400, httpstatustext.FAIL));
    }
  }

  const plan = await Plan.create(planData);

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    message: 'Plan created successfully',
    data: formatPlanForResponse(plan),
  });
});

/**
 * Get all plans (Admin only)
 * GET /api/admin/plans
 */
const getAllPlans = asyncwrapper(async (req, res, next) => {
  const { registerationType, fatteningFarmProfile } = req.query;
  const query = {};

  if (registerationType) {
    query.registerationType = registerationType;
  }

  if (registerationType === 'fattening' && fatteningFarmProfile) {
    if (!FATTENING_PROFILES.includes(fatteningFarmProfile)) {
      return next(AppError.create(
        'Invalid fatteningFarmProfile: small_ruminants, large_ruminants, or all',
        400,
        httpstatustext.FAIL
      ));
    }
    query.fatteningFarmProfile = { $in: [fatteningFarmProfile, 'all'] };
  } else if (fatteningFarmProfile) {
    if (!FATTENING_PROFILES.includes(fatteningFarmProfile)) {
      return next(AppError.create(
        'Invalid fatteningFarmProfile: small_ruminants, large_ruminants, or all',
        400,
        httpstatustext.FAIL
      ));
    }
    query.fatteningFarmProfile = fatteningFarmProfile;
  }

  const plans = await Plan.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: formatPlansForResponse(plans),
  });
});

/**
 * Get a single plan by ID (Admin only)
 * GET /api/admin/plans/:id
 */
const getPlanById = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const plan = await Plan.findById(id);

  if (!plan) {
    return next(AppError.create('Plan not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: formatPlanForResponse(plan),
  });
});

/**
 * Update a plan (Admin only)
 * PUT /api/admin/plans/:id
 */
const updatePlan = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    registerationType,
    fatteningFarmProfile,
    stripePriceId,
    currency,
    interval,
    intervalCount,
    amount,
    enteredPrice,
    enteredCurrency,
    animalLimit,
    isActive,
  } = req.body;

  const plan = await Plan.findById(id);

  if (!plan) {
    return next(AppError.create('Plan not found', 404, httpstatustext.FAIL));
  }

  if (animalLimit !== undefined && animalLimit !== null) {
    if (typeof animalLimit !== 'number' || animalLimit <= 0) {
      return next(AppError.create('animalLimit must be a positive number', 400, httpstatustext.FAIL));
    }
    plan.animalLimit = Number(animalLimit);
  }

  if (hasEnteredPricing(req.body)) {
    const normalizedCurrency = normalizeCurrency(enteredCurrency);
    if (typeof enteredPrice !== 'number' || enteredPrice <= 0) {
      return next(AppError.create('enteredPrice must be a number greater than zero', 400, httpstatustext.FAIL));
    }
    if (!['USD', 'EGP'].includes(normalizedCurrency)) {
      return next(AppError.create('enteredCurrency must be USD or EGP', 400, httpstatustext.FAIL));
    }

    try {
      const pricing = await buildPlanPricingFields(enteredPrice, enteredCurrency);
      plan.enteredPrice = pricing.enteredPrice;
      plan.enteredCurrency = pricing.enteredCurrency;
      plan.priceUSD = pricing.priceUSD;
      plan.priceEGP = pricing.priceEGP;
      plan.exchangeRate = pricing.exchangeRate;
      plan.exchangeRateUpdatedAt = pricing.exchangeRateUpdatedAt;
      plan.prices = pricing.prices;
    } catch (error) {
      return next(AppError.create(error.message, 400, httpstatustext.FAIL));
    }
  }

  const nextRegisterationType = registerationType !== undefined ? registerationType : plan.registerationType;

  if (nextRegisterationType === 'fattening') {
    const nextProfile = fatteningFarmProfile !== undefined ? fatteningFarmProfile : plan.fatteningFarmProfile;
    if (!nextProfile || !isValidFatteningProfile(nextProfile)) {
      return next(AppError.create(
        'fatteningFarmProfile is required for fattening plans: small_ruminants, large_ruminants, or all',
        400,
        httpstatustext.FAIL
      ));
    }
  }

  if (name !== undefined) plan.name = name;
  if (registerationType !== undefined) plan.registerationType = registerationType;
  if (fatteningFarmProfile !== undefined) {
    plan.fatteningFarmProfile = fatteningFarmProfile;
  } else if (nextRegisterationType === 'breeding') {
    plan.fatteningFarmProfile = undefined;
  }
  if (stripePriceId !== undefined) plan.stripePriceId = stripePriceId;
  if (currency !== undefined) plan.currency = currency;
  if (interval !== undefined) plan.interval = interval;
  if (intervalCount !== undefined && intervalCount !== null) plan.intervalCount = Number(intervalCount);
  if (amount !== undefined) plan.amount = amount;
  if (isActive !== undefined) plan.isActive = isActive;

  await plan.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Plan updated successfully',
    data: formatPlanForResponse(plan),
  });
});

/**
 * Delete a plan (Admin only)
 * DELETE /api/admin/plans/:id
 */
const deletePlan = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const plan = await Plan.findByIdAndDelete(id);

  if (!plan) {
    return next(AppError.create('Plan not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Plan deleted successfully',
    data: null,
  });
});

/**
 * Preview converted pricing for admin form
 * POST /api/admin/plans/preview-pricing
 */
const previewPricing = asyncwrapper(async (req, res, next) => {
  const { enteredPrice, enteredCurrency } = req.body;

  try {
    const data = await previewPlanPricing(enteredPrice, enteredCurrency);
    res.status(200).json({
      status: httpstatustext.SUCCESS,
      data,
    });
  } catch (error) {
    return next(AppError.create(error.message, 400, httpstatustext.FAIL));
  }
});

/**
 * Get current USD → EGP exchange rate
 * GET /api/admin/exchange-rate/usd-egp
 */
const getExchangeRate = asyncwrapper(async (req, res, next) => {
  try {
    const { rate, source, fetchedAt } = await exchangeRateService.getUsdToEgpRate();

    res.status(200).json({
      status: httpstatustext.SUCCESS,
      data: {
        usdToEgpRate: rate,
        source,
        fetchedAt,
      },
    });
  } catch (error) {
    return next(AppError.create(error.message, 500, httpstatustext.ERROR));
  }
});

module.exports = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  previewPricing,
  getExchangeRate,
};
