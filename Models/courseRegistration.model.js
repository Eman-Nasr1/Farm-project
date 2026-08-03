const mongoose = require('mongoose');
const { COURSE_CATEGORIES } = require('../utilits/coursePrices');

const participantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    verificationDocumentUrl: { type: String, required: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseStudent',
      default: null,
    },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    oldStatus: { type: String, default: null },
    newStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    changedByType: {
      type: String,
      enum: ['course_student', 'admin', 'system'],
      default: 'system',
    },
    reason: { type: String, default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const courseRegistrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseStudent',
      required: true,
      index: true,
    },
    /**
     * Group leader who pays. Same as student for individual registrations.
     */
    groupLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseStudent',
      default: null,
      index: true,
    },
    /**
     * All group member accounts (including leader). Empty for individual categories.
     */
    groupMembers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CourseStudent',
        },
      ],
      default: [],
    },
    category: {
      type: String,
      enum: COURSE_CATEGORIES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    verificationDocumentUrl: {
      type: String,
      default: null,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    registrationStatus: {
      type: String,
      enum: [
        'pending_payment',
        'pending_review',
        'confirmed',
        'rejected',
        'cancelled',
      ],
      default: 'pending_payment',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoursePayment',
      default: null,
    },
    attended: {
      type: Boolean,
      default: false,
    },
    attendanceMarkedAt: {
      type: Date,
      default: null,
    },
    attendanceMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    internalNotes: {
      type: String,
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

courseRegistrationSchema.index({ student: 1, registrationStatus: 1 });
courseRegistrationSchema.index({ groupMembers: 1, registrationStatus: 1 });
courseRegistrationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CourseRegistration', courseRegistrationSchema);
