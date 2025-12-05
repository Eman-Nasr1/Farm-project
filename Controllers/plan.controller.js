/**
 * Plan Controller
 * 
 * Handles CRUD operations for subscription plans (admin only).
 * Plans map to Stripe Prices and are associated with registration types.
 */

const Plan = require('../Models/Plan');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Create a new subscription plan (Admin only)
 * POST /api/admin/plans
 */
const createPlan = asyncwrapper(async (req, res, next) => {
  const { name, registerationType, stripePriceId, currency, interval, intervalCount, amount, isActive } = req.body;

  // Validate required fields
  if (!name || !registerationType || !stripePriceId || !amount) {
    return next(AppError.create('Missing required fields: name, registerationType, stripePriceId, amount', 400, httpstatustext.FAIL));
  }

  // Check if plan with same registrationType and stripePriceId already exists
  const existingPlan = await Plan.findOne({ 
    registerationType, 
    stripePriceId 
  });

  if (existingPlan) {
    return next(AppError.create('Plan with this registration type and Stripe price ID already exists', 400, httpstatustext.FAIL));
  }

  // Prepare plan data
  const planData = {
    name,
    registerationType,
    stripePriceId,
    currency: currency || 'usd',
    interval: interval || 'month',
    amount,
    isActive: isActive !== undefined ? isActive : true,
  };

  // Always include intervalCount (convert to number if provided)
  if (intervalCount !== undefined && intervalCount !== null) {
    planData.intervalCount = Number(intervalCount);
  } else {
    planData.intervalCount = 1; // default
  }

  const plan = await Plan.create(planData);

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    message: 'Plan created successfully',
    data: plan,
  });
});

/**
 * Get all plans (Admin only)
 * GET /api/admin/plans
 */
const getAllPlans = asyncwrapper(async (req, res, next) => {
  const plans = await Plan.find().sort({ createdAt: -1 });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: plans,
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
    data: plan,
  });
});

/**
 * Update a plan (Admin only)
 * PUT /api/admin/plans/:id
 */
const updatePlan = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;
  const { name, registerationType, stripePriceId, currency, interval, intervalCount, amount, isActive } = req.body;

  const plan = await Plan.findById(id);

  if (!plan) {
    return next(AppError.create('Plan not found', 404, httpstatustext.FAIL));
  }

  // Update fields if provided
  if (name !== undefined) plan.name = name;
  if (registerationType !== undefined) plan.registerationType = registerationType;
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
    data: plan,
  });
});

/**
 * Delete a plan (Admin only) - soft delete by setting isActive to false
 * DELETE /api/admin/plans/:id
 */
const deletePlan = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const plan = await Plan.findById(id);

  if (!plan) {
    return next(AppError.create('Plan not found', 404, httpstatustext.FAIL));
  }

  // Soft delete: set isActive to false instead of actually deleting
  plan.isActive = false;
  await plan.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Plan deactivated successfully',
    data: plan,
  });
});

module.exports = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};

