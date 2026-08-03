const express = require('express');
const router = express.Router();
const coursePaymentController = require('../Controllers/coursePayment.controller');
const authenticateCourseStudent = require('../middleware/authenticateCourseStudent');
const optionalAuth = require('../middleware/optionalCourseStudent');
const {
  createPaymentValidation,
} = require('../middleware/course.validation');
const { uploadReceipt } = require('../middleware/courseUpload');

router.get(
  '/payment-methods',
  optionalAuth,
  coursePaymentController.getPaymentMethods
);

router.post(
  '/payments/create',
  authenticateCourseStudent,
  createPaymentValidation,
  coursePaymentController.createPayment
);

router.post(
  '/payments/paymob',
  authenticateCourseStudent,
  coursePaymentController.startPaymobPayment
);

router.post(
  '/payments/upload-receipt',
  authenticateCourseStudent,
  uploadReceipt.single('receipt'),
  coursePaymentController.uploadReceipt
);

router.post(
  '/payments/resubmit-receipt',
  authenticateCourseStudent,
  uploadReceipt.single('receipt'),
  coursePaymentController.resubmitReceipt
);

router.get(
  '/payments/me',
  authenticateCourseStudent,
  coursePaymentController.getMyPayment
);

module.exports = router;
