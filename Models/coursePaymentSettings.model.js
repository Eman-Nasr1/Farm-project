const mongoose = require('mongoose');

/**
 * Singleton-style settings document for course payment instructions.
 * Admins update this; students only receive enabled public fields.
 */
const coursePaymentSettingsSchema = new mongoose.Schema(
  {
    paymobEnabled: {
      type: Boolean,
      default: true,
    },
    instapayEnabled: {
      type: Boolean,
      default: false,
    },
    instapayAddress: {
      type: String,
      default: '',
      trim: true,
    },
    instapayAccountName: {
      type: String,
      default: '',
      trim: true,
    },
    instapayInstructions: {
      type: String,
      default: '',
    },
    fawryEnabled: {
      type: Boolean,
      default: false,
    },
    fawryInstructions: {
      type: String,
      default: '',
    },
    bankTransferEnabled: {
      type: Boolean,
      default: false,
    },
    bankName: {
      type: String,
      default: '',
      trim: true,
    },
    bankAccountName: {
      type: String,
      default: '',
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      default: '',
      trim: true,
    },
    iban: {
      type: String,
      default: '',
      trim: true,
    },
    bankInstructions: {
      type: String,
      default: '',
    },
    manualReceiptEnabled: {
      type: Boolean,
      default: true,
    },
    manualPaymentInstructions: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CoursePaymentSettings', coursePaymentSettingsSchema);
