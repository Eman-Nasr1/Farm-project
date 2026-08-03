const CourseRegistration = require('../Models/courseRegistration.model');
const CoursePayment = require('../Models/coursePayment.model');
const CoursePaymentSettings = require('../Models/coursePaymentSettings.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

const ACTIVE_REGISTRATION_STATUSES = [
  'pending_payment',
  'pending_review',
  'confirmed',
];

function pushStatusHistory(doc, { oldStatus, newStatus, changedBy, changedByType, reason }) {
  if (!doc.statusHistory) doc.statusHistory = [];
  doc.statusHistory.push({
    oldStatus: oldStatus ?? null,
    newStatus,
    changedBy: changedBy || null,
    changedByType: changedByType || 'system',
    reason: reason || null,
    changedAt: new Date(),
  });
}

/**
 * Find active registration for a student — as leader OR as a group member.
 */
async function findActiveRegistration(studentId) {
  return CourseRegistration.findOne({
    registrationStatus: { $in: ACTIVE_REGISTRATION_STATUSES },
    $or: [
      { student: studentId },
      { groupLeader: studentId },
      { groupMembers: studentId },
    ],
  }).populate('payment');
}

/**
 * Latest registration for a student (any status), as leader or member.
 */
async function findLatestRegistration(studentId) {
  return CourseRegistration.findOne({
    $or: [
      { student: studentId },
      { groupLeader: studentId },
      { groupMembers: studentId },
    ],
  })
    .sort({ createdAt: -1 })
    .populate('payment');
}

function getLeaderId(registration) {
  return registration.groupLeader || registration.student;
}

function isGroupLeader(registration, studentId) {
  return String(getLeaderId(registration)) === String(studentId);
}

/**
 * Only the group leader (payer) can start/upload payments.
 */
function assertCanPay(registration, studentId) {
  if (!isGroupLeader(registration, studentId)) {
    throw AppError.create(
      'Only the group leader can complete payment for this registration',
      403,
      httpstatustext.FAIL
    );
  }
}

async function getOrCreatePaymentSettings() {
  let settings = await CoursePaymentSettings.findOne();
  if (!settings) {
    settings = await CoursePaymentSettings.create({});
  }
  return settings;
}

/**
 * Public-safe payment methods payload (no secrets).
 */
function toPublicPaymentMethods(settings, amount) {
  const methods = [];

  if (settings.paymobEnabled) {
    methods.push({
      method: 'paymob',
      label: 'Pay online with Paymob',
      amount,
      currency: 'EGP',
    });
  }

  if (settings.instapayEnabled) {
    methods.push({
      method: 'instapay',
      label: 'InstaPay',
      amount,
      currency: 'EGP',
      instapayAddress: settings.instapayAddress,
      instapayAccountName: settings.instapayAccountName,
      instructions: settings.instapayInstructions,
    });
  }

  if (settings.fawryEnabled) {
    methods.push({
      method: 'fawry',
      label: 'Fawry',
      amount,
      currency: 'EGP',
      instructions: settings.fawryInstructions,
    });
  }

  if (settings.bankTransferEnabled) {
    methods.push({
      method: 'bank_transfer',
      label: 'Bank transfer',
      amount,
      currency: 'EGP',
      bankName: settings.bankName,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
      iban: settings.iban,
      instructions: settings.bankInstructions,
    });
  }

  if (settings.manualReceiptEnabled) {
    methods.push({
      method: 'manual_receipt',
      label: 'Upload payment receipt',
      amount,
      currency: 'EGP',
      instructions: settings.manualPaymentInstructions,
    });
  }

  return methods;
}

function isMethodEnabled(settings, method) {
  const map = {
    paymob: settings.paymobEnabled,
    instapay: settings.instapayEnabled,
    fawry: settings.fawryEnabled,
    bank_transfer: settings.bankTransferEnabled,
    manual_receipt: settings.manualReceiptEnabled,
  };
  return Boolean(map[method]);
}

/**
 * Lecture access for leader or any group member after payment is paid
 * and registration is confirmed.
 */
async function studentHasLectureAccess(studentId) {
  const registration = await CourseRegistration.findOne({
    registrationStatus: 'confirmed',
    $or: [
      { student: studentId },
      { groupLeader: studentId },
      { groupMembers: studentId },
    ],
  }).populate('payment');

  if (!registration || !registration.payment) {
    return { allowed: false, registration: null };
  }

  const payment =
    typeof registration.payment === 'object' && registration.payment.status
      ? registration.payment
      : await CoursePayment.findById(registration.payment);

  if (!payment || payment.status !== 'paid') {
    return { allowed: false, registration };
  }

  return { allowed: true, registration, payment };
}

module.exports = {
  ACTIVE_REGISTRATION_STATUSES,
  pushStatusHistory,
  findActiveRegistration,
  findLatestRegistration,
  getLeaderId,
  isGroupLeader,
  assertCanPay,
  getOrCreatePaymentSettings,
  toPublicPaymentMethods,
  isMethodEnabled,
  studentHasLectureAccess,
};
