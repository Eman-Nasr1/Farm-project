/**
 * Settings Controller
 * 
 * Handles application-wide settings management (admin only).
 * Mainly for managing active payment gateway.
 */

const Settings = require('../Models/Settings');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

/**
 * Get current settings
 * GET /api/admin/settings
 */
const getSettings = asyncwrapper(async (req, res, next) => {
  const settings = await Settings.getSettings();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: settings,
  });
});

/**
 * Update settings (admin only)
 * PUT /api/admin/settings
 * 
 * Request body:
 * {
 *   "activePaymentGateway": "paymob" | "stripe"
 * }
 */
const updateSettings = asyncwrapper(async (req, res, next) => {
  const { activePaymentGateway } = req.body;

  if (activePaymentGateway && !['paymob', 'stripe'].includes(activePaymentGateway)) {
    return next(AppError.create(
      'activePaymentGateway must be either "paymob" or "stripe"',
      400,
      httpstatustext.FAIL
    ));
  }

  // Get or create settings
  let settings = await Settings.findOne();
  
  if (!settings) {
    // Create new settings
    settings = await Settings.create({
      activePaymentGateway: activePaymentGateway || 'paymob',
    });
  } else {
    // Update existing settings
    if (activePaymentGateway !== undefined) {
      settings.activePaymentGateway = activePaymentGateway;
    }
    await settings.save();
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Settings updated successfully',
    data: settings,
  });
});

/**
 * Set Paymob as active payment gateway
 * PUT /api/admin/settings/paymob
 */
const setPaymob = asyncwrapper(async (req, res, next) => {
  let settings = await Settings.findOne();
  
  if (!settings) {
    settings = await Settings.create({ activePaymentGateway: 'paymob' });
  } else {
    settings.activePaymentGateway = 'paymob';
    await settings.save();
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Paymob set as active payment gateway',
    data: settings,
  });
});

/**
 * Set Stripe as active payment gateway
 * PUT /api/admin/settings/stripe
 */
const setStripe = asyncwrapper(async (req, res, next) => {
  let settings = await Settings.findOne();
  
  if (!settings) {
    settings = await Settings.create({ activePaymentGateway: 'stripe' });
  } else {
    settings.activePaymentGateway = 'stripe';
    await settings.save();
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Stripe set as active payment gateway',
    data: settings,
  });
});

module.exports = {
  getSettings,
  updateSettings,
  setPaymob,
  setStripe,
};

