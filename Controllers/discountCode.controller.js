/**
 * Discount Code Controller
 * 
 * Admin-only operations for managing discount codes
 */

const DiscountCode = require('../Models/discountCode.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Create a new discount code (Admin only)
 * POST /api/admin/discount-codes
 */
const createDiscountCode = asyncwrapper(async (req, res, next) => {
  const {
    code,
    discountType,
    discountValue,
    maxUses,
    expiryDate,
    description,
    applicablePlans,
    applicableRegistrationTypes
  } = req.body;

  // Validation
  if (!code || !discountType || discountValue === undefined || !expiryDate) {
    return next(AppError.create('Missing required fields: code, discountType, discountValue, expiryDate', 400, httpstatustext.FAIL));
  }

  if (!['percentage', 'fixed'].includes(discountType)) {
    return next(AppError.create('discountType must be "percentage" or "fixed"', 400, httpstatustext.FAIL));
  }

  if (discountValue <= 0) {
    return next(AppError.create('discountValue must be greater than 0', 400, httpstatustext.FAIL));
  }

  if (discountType === 'percentage' && discountValue > 100) {
    return next(AppError.create('Percentage discount cannot exceed 100%', 400, httpstatustext.FAIL));
  }

  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime()) || expiry <= new Date()) {
    return next(AppError.create('expiryDate must be a valid future date', 400, httpstatustext.FAIL));
  }

  // Check if code already exists
  const existingCode = await DiscountCode.findOne({ code: code.toUpperCase() });
  if (existingCode) {
    return next(AppError.create('Discount code already exists', 400, httpstatustext.FAIL));
  }

  // Create discount code
  const discountCode = await DiscountCode.create({
    code: code.toUpperCase(),
    discountType,
    discountValue,
    maxUses: maxUses || null,
    expiryDate: expiry,
    description: description || '',
    applicablePlans: applicablePlans || [],
    applicableRegistrationTypes: applicableRegistrationTypes || [],
    createdBy: req.user.id
  });

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    message: 'Discount code created successfully',
    data: discountCode
  });
});

/**
 * Get all discount codes (Admin only)
 * GET /api/admin/discount-codes
 */
const getAllDiscountCodes = asyncwrapper(async (req, res, next) => {
  const { isActive, expired } = req.query;

  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  if (expired === 'true') {
    filter.expiryDate = { $lt: new Date() };
  } else if (expired === 'false') {
    filter.expiryDate = { $gte: new Date() };
  }

  const discountCodes = await DiscountCode.find(filter)
    .populate('applicablePlans', 'name')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: discountCodes
  });
});

/**
 * Get single discount code (Admin only)
 * GET /api/admin/discount-codes/:id
 */
const getDiscountCode = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const discountCode = await DiscountCode.findById(id)
    .populate('applicablePlans', 'name')
    .populate('createdBy', 'name email');

  if (!discountCode) {
    return next(AppError.create('Discount code not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: discountCode
  });
});

/**
 * Update discount code (Admin only)
 * PUT /api/admin/discount-codes/:id
 */
const updateDiscountCode = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;
  const {
    discountType,
    discountValue,
    maxUses,
    expiryDate,
    isActive,
    description,
    applicablePlans,
    applicableRegistrationTypes
  } = req.body;

  const discountCode = await DiscountCode.findById(id);
  if (!discountCode) {
    return next(AppError.create('Discount code not found', 404, httpstatustext.FAIL));
  }

  // Validation
  if (discountType && !['percentage', 'fixed'].includes(discountType)) {
    return next(AppError.create('discountType must be "percentage" or "fixed"', 400, httpstatustext.FAIL));
  }

  if (discountValue !== undefined && discountValue <= 0) {
    return next(AppError.create('discountValue must be greater than 0', 400, httpstatustext.FAIL));
  }

  if (discountType === 'percentage' && discountValue > 100) {
    return next(AppError.create('Percentage discount cannot exceed 100%', 400, httpstatustext.FAIL));
  }

  if (expiryDate) {
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) {
      return next(AppError.create('expiryDate must be a valid date', 400, httpstatustext.FAIL));
    }
    discountCode.expiryDate = expiry;
  }

  // Update fields
  if (discountType) discountCode.discountType = discountType;
  if (discountValue !== undefined) discountCode.discountValue = discountValue;
  if (maxUses !== undefined) discountCode.maxUses = maxUses;
  if (isActive !== undefined) discountCode.isActive = isActive;
  if (description !== undefined) discountCode.description = description;
  if (applicablePlans !== undefined) discountCode.applicablePlans = applicablePlans;
  if (applicableRegistrationTypes !== undefined) discountCode.applicableRegistrationTypes = applicableRegistrationTypes;

  await discountCode.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Discount code updated successfully',
    data: discountCode
  });
});

/**
 * Delete discount code (Admin only)
 * DELETE /api/admin/discount-codes/:id
 */
const deleteDiscountCode = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const discountCode = await DiscountCode.findByIdAndDelete(id);
  if (!discountCode) {
    return next(AppError.create('Discount code not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Discount code deleted successfully'
  });
});

/**
 * Validate discount code (Public - used during checkout)
 * GET /api/discount-codes/validate/:code
 */
const validateDiscountCode = asyncwrapper(async (req, res, next) => {
  const { code } = req.params;
  const { planId, registrationType } = req.query;

  if (!code) {
    return next(AppError.create('Discount code is required', 400, httpstatustext.FAIL));
  }

  const discountCode = await DiscountCode.findOne({ code: code.toUpperCase() });
  
  if (!discountCode) {
    return next(AppError.create('Invalid discount code', 404, httpstatustext.FAIL));
  }

  // Check if code is valid
  if (!discountCode.isValid()) {
    return next(AppError.create('Discount code is expired or no longer valid', 400, httpstatustext.FAIL));
  }

  // Check if code applies to this plan
  if (planId && discountCode.applicablePlans.length > 0) {
    const planIdStr = planId.toString();
    const isApplicable = discountCode.applicablePlans.some(
      plan => plan.toString() === planIdStr
    );
    if (!isApplicable) {
      return next(AppError.create('This discount code is not applicable to the selected plan', 400, httpstatustext.FAIL));
    }
  }

  // Check if code applies to this registration type
  if (registrationType && discountCode.applicableRegistrationTypes.length > 0) {
    if (!discountCode.applicableRegistrationTypes.includes(registrationType)) {
      return next(AppError.create('This discount code is not applicable to your registration type', 400, httpstatustext.FAIL));
    }
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      code: discountCode.code,
      discountType: discountCode.discountType,
      discountValue: discountCode.discountValue,
      description: discountCode.description
    }
  });
});

module.exports = {
  createDiscountCode,
  getAllDiscountCodes,
  getDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  validateDiscountCode
};
