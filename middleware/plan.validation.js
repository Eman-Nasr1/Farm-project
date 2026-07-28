/**
 * Plan validation middleware
 */

const { body, validationResult } = require('express-validator');
const { SUPPORTED_CURRENCIES } = require('../services/planPricingService');

const planPricingValidationRules = () => [
  body('enteredPrice')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('enteredPrice must be a number greater than zero'),
  body('enteredCurrency')
    .optional()
    .isIn(SUPPORTED_CURRENCIES)
    .withMessage('enteredCurrency must be USD or EGP'),
];

const previewPricingValidationRules = () => [
  body('enteredPrice')
    .notEmpty()
    .withMessage('enteredPrice is required')
    .isFloat({ gt: 0 })
    .withMessage('enteredPrice must be a number greater than zero'),
  body('enteredCurrency')
    .notEmpty()
    .withMessage('enteredCurrency is required')
    .isIn(SUPPORTED_CURRENCIES)
    .withMessage('enteredCurrency must be USD or EGP'),
];

const validatePlanRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array(),
    });
  }

  next();
};

module.exports = {
  planPricingValidationRules,
  previewPricingValidationRules,
  validatePlanRequest,
};
