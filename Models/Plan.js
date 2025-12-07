/**
 * Plan Model
 * 
 * Represents a subscription plan that maps to a Stripe Price.
 * Admin can create/edit/delete plans for "fattening" or "breeding" registration types.
 */

const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  }, // e.g. "Fattening Plan"
  
  registerationType: {
    type: String,
    enum: ["fattening", "breeding"],
    required: true,
  },
  
  stripePriceId: { 
    type: String, 
    required: true 
  }, // price_xxx from Stripe
  
  currency: { 
    type: String, 
    default: "usd" 
  },
  
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
  
  amount: { 
    type: Number, 
    required: true 
  }, // in smallest unit (e.g. cents for USD)
  
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

module.exports = mongoose.model('Plan', PlanSchema);

