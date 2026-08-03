const { body, param, query, validationResult } = require('express-validator');
const { COURSE_CATEGORIES } = require('../utilits/coursePrices');

const EGYPTIAN_PHONE_REGEX = /^(?:\+?20|0)?1[0125][0-9]{8}$/;

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'fail', errors: errors.array() });
  }
  next();
};

const courseRegisterValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(EGYPTIAN_PHONE_REGEX)
    .withMessage('Phone must be a valid Egyptian mobile number'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(COURSE_CATEGORIES)
    .withMessage(`Category must be one of: ${COURSE_CATEGORIES.join(', ')}`),
  validate,
];

const courseLoginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const courseRegistrationValidation = [
  body('category')
    .isIn(COURSE_CATEGORIES)
    .withMessage(`Category must be one of: ${COURSE_CATEGORIES.join(', ')}`),
  body('participants')
    .optional()
    .isArray()
    .withMessage('Participants must be an array'),
  validate,
];

const createPaymentValidation = [
  body('method')
    .isIn(['paymob', 'instapay', 'fawry', 'bank_transfer', 'manual_receipt'])
    .withMessage('Invalid payment method'),
  validate,
];

const rejectPaymentValidation = [
  body('rejectionReason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required'),
  validate,
];

const lectureValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('lectureUrl')
    .trim()
    .notEmpty()
    .withMessage('Lecture URL is required')
    .isURL({ require_protocol: true })
    .withMessage('Lecture URL must be a valid URL with protocol'),
  body('platform')
    .optional()
    .isIn([
      'zoom',
      'google_meet',
      'microsoft_teams',
      'recorded_video',
      'google_drive',
      'other',
    ])
    .withMessage('Invalid lecture platform'),
  body('description').optional().isString(),
  body('lectureDate').optional({ nullable: true }).isISO8601().withMessage('Invalid lecture date'),
  validate,
];

const mongoIdParam = (name = 'id') => [
  param(name).isMongoId().withMessage(`Invalid ${name}`),
  validate,
];

const listQueryValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

module.exports = {
  EGYPTIAN_PHONE_REGEX,
  validate,
  courseRegisterValidation,
  courseLoginValidation,
  courseRegistrationValidation,
  createPaymentValidation,
  rejectPaymentValidation,
  lectureValidation,
  mongoIdParam,
  listQueryValidation,
};
