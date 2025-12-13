/**
 * UserSubscription Model
 * 
 * Tracks user subscriptions separately from the User model.
 * Supports multiple payment gateways (Paymob, Stripe, etc.)
 */

const mongoose = require('mongoose');

const UserSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'trialing', 'expired', 'none'],
    default: 'none',
    required: true,
  },
  
  paymentMethod: {
    type: String,
    enum: ['paymob', 'stripe', 'other'],
    required: true,
  },
  
  currency: {
    type: String,
    required: true,
    uppercase: true,
  }, // "EGP", "SAR", "USD", etc.
  
  amount: {
    type: Number,
    required: true,
    min: 0,
  }, // Amount paid in the currency's smallest unit
  
  // Payment gateway specific IDs
  paymobOrderId: {
    type: String,
  },
  
  paymobTransactionId: {
    type: String,
  },
  
  stripeSubscriptionId: {
    type: String,
  },
  
  stripeCustomerId: {
    type: String,
  },
  
  // Subscription dates
  startedAt: {
    type: Date,
    default: Date.now,
  },
  
  nextBillingDate: {
    type: Date,
    required: true,
  },
  
  canceledAt: {
    type: Date,
  },
  
  // Auto-renewal settings
  autoRenew: {
    type: Boolean,
    default: true,
  },
  
  // Saved payment token for auto-renewal (Paymob token or Stripe payment method)
  paymentToken: {
    type: String,
  },
  
  // Last renewal attempt date
  lastRenewalAttempt: {
    type: Date,
  },
  
  // Number of consecutive failed renewal attempts
  failedRenewalAttempts: {
    type: Number,
    default: 0,
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Index for efficient queries
UserSubscriptionSchema.index({ userId: 1, status: 1 });
UserSubscriptionSchema.index({ paymobOrderId: 1 });
UserSubscriptionSchema.index({ stripeSubscriptionId: 1 });
UserSubscriptionSchema.index({ nextBillingDate: 1, status: 1, autoRenew: 1 }); // For renewal cron job

module.exports = mongoose.model('UserSubscription', UserSubscriptionSchema);

