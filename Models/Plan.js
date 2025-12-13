/**
 * Plan Model
 * 
 * Represents a subscription plan with multi-currency support.
 * Supports both Stripe (legacy) and Paymob payment gateways.
 * Admin can create/edit/delete plans for "fattening" or "breeding" registration types.
 */

const mongoose = require('mongoose');

// Subdocument for multi-currency pricing
const PlanPriceSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true,
    uppercase: true,
  }, // ISO country code: "EG", "SA", "US", etc.
  
  currency: {
    type: String,
    required: true,
    uppercase: true,
  }, // "EGP", "SAR", "USD", etc.
  
  amount: {
    type: Number,
    required: true,
    min: 0,
  }, // Amount in the currency's smallest unit (e.g., piasters for EGP, cents for USD)
}, { _id: false });

const PlanSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  }, // e.g. "Starter", "Pro", "Enterprise"
  
  registerationType: {
    type: String,
    enum: ["fattening", "breeding"],
    required: true,
  },
  
  // Legacy Stripe fields (optional, for backward compatibility)
  stripePriceId: { 
    type: String, 
  }, // price_xxx from Stripe
  
  // Legacy single currency/amount (optional, for backward compatibility)
  currency: { 
    type: String, 
    default: "usd" 
  },
  
  amount: { 
    type: Number, 
  }, // in smallest unit (e.g. cents for USD)
  
  // Multi-currency pricing (required for Paymob)
  prices: [PlanPriceSchema], // Array of prices per country/currency
  
  interval: { 
    type: String, 
    enum: ["month", "year"],
    default: "month" 
  },
  
  // How many months? 1, 3, 6, 12 (Stripe interval_count)
  intervalCount: {
    type: Number,
    default: 1,  // monthly
  },
  
  // maximum number of animals allowed for this plan
  animalLimit: {
    type: Number,
    required: true,
  },
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { 
  timestamps: true 
});

// Helper method to get price for a specific country
PlanSchema.methods.getPriceForCountry = function(countryCode) {
  if (!this.prices || this.prices.length === 0) {
    // Fallback to legacy amount/currency if no multi-currency prices
    return {
      amount: this.amount,
      currency: this.currency || 'USD',
    };
  }
  
  // Normalize country code to uppercase
  const normalizedCountry = countryCode.toUpperCase();
  
  // Find price for specific country
  const countryPrice = this.prices.find(p => p.country === normalizedCountry);
  
  if (countryPrice) {
    return {
      amount: countryPrice.amount,
      currency: countryPrice.currency,
    };
  }
  
  // Default logic: EG -> EGP, SA -> SAR, else -> USD
  if (normalizedCountry === 'EG') {
    const egpPrice = this.prices.find(p => p.currency === 'EGP');
    if (egpPrice) return { amount: egpPrice.amount, currency: 'EGP' };
  } else if (normalizedCountry === 'SA') {
    const sarPrice = this.prices.find(p => p.currency === 'SAR');
    if (sarPrice) return { amount: sarPrice.amount, currency: 'SAR' };
  }
  
  // Default to USD
  const usdPrice = this.prices.find(p => p.currency === 'USD');
  if (usdPrice) return { amount: usdPrice.amount, currency: 'USD' };
  
  // Last resort: return first available price
  if (this.prices.length > 0) {
    return {
      amount: this.prices[0].amount,
      currency: this.prices[0].currency,
    };
  }
  
  // Ultimate fallback
  return {
    amount: this.amount || 0,
    currency: this.currency || 'USD',
  };
};

module.exports = mongoose.model('Plan', PlanSchema);

