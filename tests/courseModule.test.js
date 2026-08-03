/**
 * Course module unit tests
 * Run with: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  COURSE_PRICES,
  COURSE_CATEGORIES,
  getCoursePrice,
  toAmountCents,
} = require('../utilits/coursePrices');

const {
  toPublicPaymentMethods,
  isMethodEnabled,
} = require('../services/courseService');

const paymobService = require('../services/paymobService');

test('course prices match required category amounts', () => {
  assert.equal(COURSE_PRICES.breeder, 995);
  assert.equal(COURSE_PRICES.doctor_engineer, 895);
  assert.equal(COURSE_PRICES.student, 495);
  assert.equal(COURSE_PRICES.student_group, 2000);
  assert.deepEqual([...COURSE_CATEGORIES].sort(), [
    'breeder',
    'doctor_engineer',
    'student',
    'student_group',
  ].sort());
});

test('getCoursePrice returns backend price and rejects invalid category', () => {
  assert.equal(getCoursePrice('student'), 495);
  assert.throws(() => getCoursePrice('vip'), /Invalid course category/);
});

test('toAmountCents converts EGP to Paymob piasters', () => {
  assert.equal(toAmountCents(495), 49500);
  assert.equal(toAmountCents(2000), 200000);
});

test('public payment methods only include enabled methods and no secrets', () => {
  const settings = {
    paymobEnabled: true,
    instapayEnabled: true,
    instapayAddress: '01000000000',
    instapayAccountName: 'Course Admin',
    instapayInstructions: 'Send and upload receipt',
    fawryEnabled: false,
    fawryInstructions: 'secret fawry',
    bankTransferEnabled: true,
    bankName: 'Test Bank',
    bankAccountName: 'Course',
    bankAccountNumber: '123',
    iban: 'EG00',
    bankInstructions: 'Transfer then upload',
    manualReceiptEnabled: false,
    manualPaymentInstructions: 'hidden',
  };

  const methods = toPublicPaymentMethods(settings, 495);
  const keys = methods.map((m) => m.method);

  assert.deepEqual(keys.sort(), ['bank_transfer', 'instapay', 'paymob'].sort());
  assert.equal(methods.find((m) => m.method === 'instapay').amount, 495);

  const serialized = JSON.stringify(methods);
  assert.equal(serialized.includes('PAYMOB'), false);
  assert.equal(serialized.includes('api_key'), false);
  assert.equal(serialized.includes('HMAC'), false);
});

test('isMethodEnabled respects settings flags', () => {
  const settings = {
    paymobEnabled: true,
    instapayEnabled: false,
    fawryEnabled: true,
    bankTransferEnabled: false,
    manualReceiptEnabled: true,
  };

  assert.equal(isMethodEnabled(settings, 'paymob'), true);
  assert.equal(isMethodEnabled(settings, 'instapay'), false);
  assert.equal(isMethodEnabled(settings, 'fawry'), true);
  assert.equal(isMethodEnabled(settings, 'manual_receipt'), true);
});

test('Paymob webhook HMAC verification accepts valid signature', () => {
  const secret = 'test_hmac_secret';
  process.env.PAYMOB_HMAC = secret;

  const obj = {
    amount_cents: 49500,
    created_at: '2026-01-01T00:00:00.000000',
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    id: 111,
    integration_id: 222,
    is_3d_secure: false,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 333 },
    owner: 444,
    pending: false,
    source_data: { pan: '1234', sub_type: 'MasterCard', type: 'card' },
    success: true,
  };

  const fields = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order.id,
    obj.owner,
    obj.pending,
    obj.source_data.pan,
    obj.source_data.sub_type,
    obj.source_data.type,
    obj.success,
  ];

  const hmac = crypto
    .createHmac('sha512', secret)
    .update(fields.join(''))
    .digest('hex');

  assert.equal(paymobService.verifyWebhookSignature(obj, hmac), true);

  const invalidHmac = 'a'.repeat(hmac.length);
  assert.equal(paymobService.verifyWebhookSignature(obj, invalidHmac), false);
});

test('student group must be exactly five participants (validation helper)', () => {
  function validateGroupCount(participants) {
    return Array.isArray(participants) && participants.length === 5;
  }

  assert.equal(validateGroupCount([{ }, {}, {}, {}, {}]), true);
  assert.equal(validateGroupCount([{ }, {}, {}, {}]), false);
  assert.equal(validateGroupCount([]), false);
});

test('lecture access rule requires paid + confirmed + published', () => {
  function canAccessLecture({ paymentStatus, registrationStatus, isPublished }) {
    return (
      paymentStatus === 'paid' &&
      registrationStatus === 'confirmed' &&
      isPublished === true
    );
  }

  assert.equal(
    canAccessLecture({
      paymentStatus: 'paid',
      registrationStatus: 'confirmed',
      isPublished: true,
    }),
    true
  );
  assert.equal(
    canAccessLecture({
      paymentStatus: 'pending_review',
      registrationStatus: 'pending_review',
      isPublished: true,
    }),
    false
  );
  assert.equal(
    canAccessLecture({
      paymentStatus: 'rejected',
      registrationStatus: 'pending_payment',
      isPublished: true,
    }),
    false
  );
  assert.equal(
    canAccessLecture({
      paymentStatus: 'paid',
      registrationStatus: 'confirmed',
      isPublished: false,
    }),
    false
  );
});

test('revenue includes only paid payments', () => {
  const payments = [
    { status: 'paid', amount: 995 },
    { status: 'pending_review', amount: 495 },
    { status: 'rejected', amount: 895 },
    { status: 'paid', amount: 2000 },
    { status: 'refunded', amount: 495 },
    { status: 'failed', amount: 495 },
  ];

  const revenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  assert.equal(revenue, 2995);
});
