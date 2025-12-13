/**
 * Settings Model
 * 
 * Application-wide settings, including active payment gateway configuration.
 * This is a singleton collection (only one document should exist).
 */

const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  activePaymentGateway: {
    type: String,
    enum: ['paymob', 'stripe'],
    default: 'paymob',
    required: true,
  },
  
  // Additional settings can be added here
  // e.g., maintenance mode, feature flags, etc.
  
}, {
  timestamps: true,
});

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ activePaymentGateway: 'paymob' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);

