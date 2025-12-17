const mongoose = require('mongoose');

const DiscountCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]+$/, 'Code must contain only uppercase letters and numbers']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxUses: {
    type: Number,
    default: null, // null means unlimited
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  expiryDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  },
  // Optional: restrict to specific plans
  applicablePlans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan'
  }],
  // Optional: restrict to specific registration types
  applicableRegistrationTypes: [{
    type: String,
    enum: ['fattening', 'breeding']
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Index for faster lookups
DiscountCodeSchema.index({ code: 1, isActive: 1 });
DiscountCodeSchema.index({ expiryDate: 1 });

// Method to check if code is valid
DiscountCodeSchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (new Date() > this.expiryDate) return false;
  if (this.maxUses !== null && this.usedCount >= this.maxUses) return false;
  return true;
};

// Method to calculate discount amount
DiscountCodeSchema.methods.calculateDiscount = function(originalAmount) {
  if (!this.isValid()) return 0;
  
  if (this.discountType === 'percentage') {
    return Math.round((originalAmount * this.discountValue) / 100);
  } else {
    // Fixed amount - ensure it doesn't exceed original amount
    return Math.min(this.discountValue, originalAmount);
  }
};

// Method to increment usage
DiscountCodeSchema.methods.incrementUsage = async function() {
  this.usedCount += 1;
  await this.save();
};

module.exports = mongoose.model('DiscountCode', DiscountCodeSchema);
