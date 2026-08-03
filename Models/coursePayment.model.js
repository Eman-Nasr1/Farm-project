const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    oldStatus: { type: String, default: null },
    newStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    changedByType: {
      type: String,
      enum: ['course_student', 'admin', 'system', 'paymob'],
      default: 'system',
    },
    reason: { type: String, default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const receiptHistorySchema = new mongoose.Schema(
  {
    receiptUrl: { type: String, required: true },
    paymentReference: { type: String, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const coursePaymentSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseRegistration',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseStudent',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: [
        'paymob',
        'instapay',
        'fawry',
        'bank_transfer',
        'manual_receipt',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'EGP',
    },
    status: {
      type: String,
      enum: [
        'pending',
        'pending_review',
        'paid',
        'rejected',
        'failed',
        'refunded',
      ],
      default: 'pending',
      index: true,
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    receiptUploadedAt: {
      type: Date,
      default: null,
    },
    receiptHistory: {
      type: [receiptHistorySchema],
      default: [],
    },
    paymentReference: {
      type: String,
      default: null,
      trim: true,
    },
    paymentNotes: {
      type: String,
      default: null,
    },
    /**
     * Distinguishes course payments from farm subscription Paymob orders.
     */
    paymentContext: {
      type: String,
      default: 'course_registration',
      immutable: true,
    },
    gatewayOrderId: {
      type: String,
      default: null,
    },
    gatewayTransactionId: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

coursePaymentSchema.index({ gatewayOrderId: 1 }, { sparse: true });
coursePaymentSchema.index({ status: 1, createdAt: -1 });
coursePaymentSchema.index({ paymentReference: 1 }, { sparse: true });

module.exports = mongoose.model('CoursePayment', coursePaymentSchema);
