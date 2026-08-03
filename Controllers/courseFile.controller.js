const path = require('path');
const fs = require('fs');
const CourseRegistration = require('../Models/courseRegistration.model');
const CoursePayment = require('../Models/coursePayment.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const { resolveStorageKey } = require('../middleware/courseUpload');

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

/**
 * Stream a private course file to authorized student or admin.
 */
async function streamFile(res, storageKey, { download = false } = {}) {
  const absolute = resolveStorageKey(storageKey);
  if (!fs.existsSync(absolute)) {
    throw AppError.create('File not found', 404, httpstatustext.FAIL);
  }

  res.setHeader('Content-Type', contentTypeFor(absolute));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  if (download) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${path.basename(absolute)}"`
    );
  } else {
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(absolute)}"`
    );
  }

  fs.createReadStream(absolute).pipe(res);
}

/**
 * GET /api/course/files/registration-document
 * Student can view their own verification document.
 */
const getMyVerificationDocument = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findOne({
    student: req.courseStudent.id,
  }).sort({ createdAt: -1 });

  if (!registration?.verificationDocumentUrl) {
    return next(AppError.create('Document not found', 404, httpstatustext.FAIL));
  }

  await streamFile(res, registration.verificationDocumentUrl, {
    download: req.query.download === '1',
  });
});

/**
 * GET /api/course/files/receipt
 * Student can view their own receipt.
 */
const getMyReceipt = asyncwrapper(async (req, res, next) => {
  const payment = await CoursePayment.findOne({
    student: req.courseStudent.id,
  }).sort({ createdAt: -1 });

  if (!payment?.receiptUrl) {
    return next(AppError.create('Receipt not found', 404, httpstatustext.FAIL));
  }

  await streamFile(res, payment.receiptUrl, {
    download: req.query.download === '1',
  });
});

/**
 * GET /api/admin/course/files/*
 * Admin secure file access by storage key query or payment/registration id.
 */
const adminGetPaymentReceipt = asyncwrapper(async (req, res, next) => {
  const payment = await CoursePayment.findById(req.params.id);
  if (!payment?.receiptUrl) {
    return next(AppError.create('Receipt not found', 404, httpstatustext.FAIL));
  }

  await streamFile(res, payment.receiptUrl, {
    download: req.query.download === '1',
  });
});

const adminGetRegistrationDocument = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findById(req.params.id);
  if (!registration?.verificationDocumentUrl) {
    return next(AppError.create('Document not found', 404, httpstatustext.FAIL));
  }

  await streamFile(res, registration.verificationDocumentUrl, {
    download: req.query.download === '1',
  });
});

const adminGetParticipantDocument = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findById(req.params.id);
  if (!registration) {
    return next(AppError.create('Registration not found', 404, httpstatustext.FAIL));
  }

  const participant = registration.participants.id(req.params.participantId);
  if (!participant?.verificationDocumentUrl) {
    return next(AppError.create('Participant document not found', 404, httpstatustext.FAIL));
  }

  await streamFile(res, participant.verificationDocumentUrl, {
    download: req.query.download === '1',
  });
});

module.exports = {
  getMyVerificationDocument,
  getMyReceipt,
  adminGetPaymentReceipt,
  adminGetRegistrationDocument,
  adminGetParticipantDocument,
};
