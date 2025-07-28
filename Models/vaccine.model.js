const mongoose = require('mongoose');

const VaccineSchema = new mongoose.Schema({
  vaccineType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaccineType',
  },
  otherVaccineName: {
    type: String,
    trim: true
  },
  BoosterDose: {
    type: Number 
  },
  AnnualDose: {
    type: Number
  },
  stock: {  // Properly nest stock properties
    bottles: {
      type: Number,
      required: [true, 'Number of bottles is required'],
      min: [0, 'Bottles cannot be negative']
    },
    dosesPerBottle: {
      type: Number,
      required: [true, 'Doses per bottle is required'],
      min: [1, 'At least 1 dose per bottle required']
    },
    totalDoses: {
      type: Number
    }
  },
  pricing: {  // Properly nest pricing properties
    bottlePrice: {
      type: Number,
      required: [true, 'Bottle price is required'],
      min: [0, 'Price cannot be negative']
    },
    dosePrice: {
      type: Number
    }
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add a method to check if the vaccine is expired
VaccineSchema.methods.isExpired = function() {
  return this.expiryDate && new Date() > this.expiryDate;
};

module.exports = mongoose.model('Vaccine', VaccineSchema);