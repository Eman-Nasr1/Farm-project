const CoursePayment = require('../Models/coursePayment.model');
const CourseRegistration = require('../Models/courseRegistration.model');
const CourseStudent = require('../Models/courseStudent.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const { toAmountCents } = require('../utilits/coursePrices');
const { toStorageKey } = require('../middleware/courseUpload');
const coursePaymobService = require('../services/coursePaymobService');
const {
  findActiveRegistration,
  assertCanPay,
  getOrCreatePaymentSettings,
  toPublicPaymentMethods,
  isMethodEnabled,
  pushStatusHistory,
} = require('../services/courseService');
const { notifyReceiptSubmitted } = require('../utilits/courseEmail');

const MANUAL_METHODS = new Set(['instapay', 'fawry', 'bank_transfer', 'manual_receipt']);

/**
 * GET /api/course/payment-methods
 */
const getPaymentMethods = asyncwrapper(async (req, res, next) => {
  const settings = await getOrCreatePaymentSettings();

  let amount = null;
  // Optional: if authenticated student, attach their registration amount
  if (req.courseStudent?.id) {
    const registration = await findActiveRegistration(req.courseStudent.id);
    if (registration) amount = registration.amount;
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      methods: toPublicPaymentMethods(settings, amount),
      currency: 'EGP',
    },
  });
});

/**
 * POST /api/course/payments/create
 * Body: { method }
 */
const createPayment = asyncwrapper(async (req, res, next) => {
  const { method } = req.body;
  const studentId = req.courseStudent.id;

  const settings = await getOrCreatePaymentSettings();
  if (!isMethodEnabled(settings, method)) {
    return next(AppError.create('Selected payment method is not available', 400, httpstatustext.FAIL));
  }

  const registration = await findActiveRegistration(studentId);
  if (!registration) {
    return next(AppError.create('No active registration found', 404, httpstatustext.FAIL));
  }

  try {
    assertCanPay(registration, studentId);
  } catch (error) {
    return next(error);
  }

  if (registration.registrationStatus === 'confirmed') {
    return next(AppError.create('Registration is already confirmed', 400, httpstatustext.FAIL));
  }

  // Reuse existing unpaid payment or create new
  let payment = null;
  if (registration.payment) {
    payment = await CoursePayment.findById(registration.payment);
    if (payment && payment.status === 'paid') {
      return next(AppError.create('Payment already completed', 400, httpstatustext.FAIL));
    }
  }

  if (!payment || ['paid', 'refunded'].includes(payment?.status)) {
    payment = new CoursePayment({
      registration: registration._id,
      student: studentId,
      method,
      amount: registration.amount,
      status: 'pending',
      paymentContext: 'course_registration',
    });
    pushStatusHistory(payment, {
      oldStatus: null,
      newStatus: 'pending',
      changedBy: studentId,
      changedByType: 'course_student',
      reason: `Payment method selected: ${method}`,
    });
  } else {
    const oldStatus = payment.status;
    payment.method = method;
    payment.amount = registration.amount;
    if (payment.status === 'rejected') {
      // Keep rejected until new receipt; method change alone stays rejected/pending
      payment.status = 'pending';
      payment.rejectionReason = null;
      pushStatusHistory(payment, {
        oldStatus,
        newStatus: 'pending',
        changedBy: studentId,
        changedByType: 'course_student',
        reason: `Payment method changed to ${method}`,
      });
    }
  }

  await payment.save();
  registration.payment = payment._id;
  await registration.save();

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    data: { payment, registration },
  });
});

/**
 * POST /api/course/payments/paymob
 */
const startPaymobPayment = asyncwrapper(async (req, res, next) => {
  const studentId = req.courseStudent.id;
  const settings = await getOrCreatePaymentSettings();

  if (!settings.paymobEnabled) {
    return next(AppError.create('Paymob payments are disabled', 400, httpstatustext.FAIL));
  }

  const registration = await findActiveRegistration(studentId);
  if (!registration) {
    return next(AppError.create('No active registration found', 404, httpstatustext.FAIL));
  }

  try {
    assertCanPay(registration, studentId);
  } catch (error) {
    return next(error);
  }

  const student = await CourseStudent.findById(studentId);
  if (!student) {
    return next(AppError.create('Student not found', 404, httpstatustext.FAIL));
  }

  let payment = registration.payment
    ? await CoursePayment.findById(registration.payment)
    : null;

  if (payment?.status === 'paid') {
    return next(AppError.create('Payment already completed', 400, httpstatustext.FAIL));
  }

  if (!payment) {
    payment = new CoursePayment({
      registration: registration._id,
      student: studentId,
      method: 'paymob',
      amount: registration.amount,
      status: 'pending',
      paymentContext: 'course_registration',
    });
    pushStatusHistory(payment, {
      oldStatus: null,
      newStatus: 'pending',
      changedBy: studentId,
      changedByType: 'course_student',
      reason: 'Paymob payment initiated',
    });
    await payment.save();
    registration.payment = payment._id;
    await registration.save();
  } else {
    payment.method = 'paymob';
    payment.amount = registration.amount;
    await payment.save();
  }

  const amountCents = toAmountCents(registration.amount);

  try {
    const order = await coursePaymobService.createCourseOrder({
      amountCents,
      student: {
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
      },
      bookingCode: registration.bookingCode,
      paymentId: payment._id.toString(),
    });

    const paymentKey = await coursePaymobService.getCoursePaymentKey({
      orderId: order.orderId,
      amountCents,
      student: {
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
      },
    });

    payment.gatewayOrderId = String(order.orderId);
    await payment.save();

    res.status(200).json({
      status: httpstatustext.SUCCESS,
      data: {
        paymentId: payment._id,
        orderId: order.orderId,
        amount: registration.amount,
        amountCents,
        currency: 'EGP',
        checkoutUrl: paymentKey.iframeUrl || paymentKey.redirectUrl,
        paymentKey: paymentKey.paymentKey,
      },
    });
  } catch (error) {
    console.error('[course-paymob] Failed to create checkout:', error.message);
    return next(
      AppError.create(
        `Failed to create Paymob payment: ${error.message}`,
        500,
        httpstatustext.ERROR
      )
    );
  }
});

/**
 * Shared receipt upload / resubmit logic
 */
async function handleReceiptUpload(req, res, next, { isResubmit }) {
  const studentId = req.courseStudent.id;
  const { paymentReference, paymentNotes, method } = req.body;

  if (!req.file) {
    return next(AppError.create('Receipt file is required', 400, httpstatustext.FAIL));
  }

  const registration = await findActiveRegistration(studentId);
  if (!registration) {
    return next(AppError.create('No active registration found', 404, httpstatustext.FAIL));
  }

  try {
    assertCanPay(registration, studentId);
  } catch (error) {
    return next(error);
  }

  let payment = registration.payment
    ? await CoursePayment.findById(registration.payment)
    : null;

  if (payment?.status === 'paid') {
    return next(AppError.create('Payment already approved', 400, httpstatustext.FAIL));
  }

  const selectedMethod = method || payment?.method;
  if (!selectedMethod || !MANUAL_METHODS.has(selectedMethod)) {
    return next(
      AppError.create(
        'Receipt upload is only allowed for InstaPay, Fawry, bank transfer, or manual receipt',
        400,
        httpstatustext.FAIL
      )
    );
  }

  const settings = await getOrCreatePaymentSettings();
  if (!isMethodEnabled(settings, selectedMethod)) {
    return next(AppError.create('Selected payment method is not available', 400, httpstatustext.FAIL));
  }

  // Prevent reusing the same receipt file path across different registrations when possible
  const receiptKey = toStorageKey(req.file.path);
  const duplicateReceipt = await CoursePayment.findOne({
    receiptUrl: receiptKey,
    registration: { $ne: registration._id },
  });
  if (duplicateReceipt) {
    return next(
      AppError.create('This receipt appears to be already used for another registration', 400, httpstatustext.FAIL)
    );
  }

  if (paymentReference) {
    const duplicateRef = await CoursePayment.findOne({
      paymentReference: String(paymentReference).trim(),
      status: { $in: ['pending_review', 'paid'] },
      registration: { $ne: registration._id },
    });
    if (duplicateRef) {
      return next(
        AppError.create('This payment reference is already used', 400, httpstatustext.FAIL)
      );
    }
  }

  if (!payment) {
    payment = new CoursePayment({
      registration: registration._id,
      student: studentId,
      method: selectedMethod,
      amount: registration.amount,
      paymentContext: 'course_registration',
    });
  }

  if (isResubmit && payment.status !== 'rejected' && payment.status !== 'pending_review') {
    // Allow resubmit from rejected; also allow pending_review overwrite carefully
    if (payment.status !== 'pending') {
      return next(
        AppError.create('Receipt can only be resubmitted after rejection', 400, httpstatustext.FAIL)
      );
    }
  }

  const oldStatus = payment.status;

  // Keep previous receipt in history
  if (payment.receiptUrl) {
    payment.receiptHistory.push({
      receiptUrl: payment.receiptUrl,
      paymentReference: payment.paymentReference,
      uploadedAt: payment.receiptUploadedAt || new Date(),
    });
  }

  payment.method = selectedMethod;
  payment.amount = registration.amount;
  payment.receiptUrl = receiptKey;
  payment.receiptUploadedAt = new Date();
  payment.paymentReference = paymentReference ? String(paymentReference).trim() : payment.paymentReference;
  payment.paymentNotes = paymentNotes || payment.paymentNotes;
  payment.status = 'pending_review';
  payment.rejectionReason = null;

  pushStatusHistory(payment, {
    oldStatus,
    newStatus: 'pending_review',
    changedBy: studentId,
    changedByType: 'course_student',
    reason: isResubmit ? 'Receipt resubmitted' : 'Receipt uploaded',
  });

  await payment.save();

  const oldRegStatus = registration.registrationStatus;
  registration.payment = payment._id;
  registration.registrationStatus = 'pending_review';
  pushStatusHistory(registration, {
    oldStatus: oldRegStatus,
    newStatus: 'pending_review',
    changedBy: studentId,
    changedByType: 'course_student',
    reason: 'Payment receipt under review',
  });
  await registration.save();

  const student = await CourseStudent.findById(studentId);
  if (student) {
    notifyReceiptSubmitted(student, registration).catch(() => {});
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Your receipt has been uploaded successfully. Your payment is currently under review.',
    data: { payment, registration },
  });
}

/**
 * POST /api/course/payments/upload-receipt
 */
const uploadReceipt = asyncwrapper(async (req, res, next) => {
  return handleReceiptUpload(req, res, next, { isResubmit: false });
});

/**
 * POST /api/course/payments/resubmit-receipt
 */
const resubmitReceipt = asyncwrapper(async (req, res, next) => {
  return handleReceiptUpload(req, res, next, { isResubmit: true });
});

/**
 * GET /api/course/payments/me
 */
const getMyPayment = asyncwrapper(async (req, res, next) => {
  const registration = await findActiveRegistration(req.courseStudent.id);
  if (!registration) {
    return next(AppError.create('No active registration found', 404, httpstatustext.FAIL));
  }

  const payment = registration.payment
    ? await CoursePayment.findById(registration.payment)
    : await CoursePayment.findOne({ registration: registration._id }).sort({ createdAt: -1 });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      registration,
      payment,
    },
  });
});

module.exports = {
  getPaymentMethods,
  createPayment,
  startPaymobPayment,
  uploadReceipt,
  resubmitReceipt,
  getMyPayment,
};
