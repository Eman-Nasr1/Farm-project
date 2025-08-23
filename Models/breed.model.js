const mongoose = require('mongoose');
const User = require('../Models/user.model');

const Breedschema = new mongoose.Schema({
 
    breedName: {
        type: String,
        required: true
    },
    // ⬇️ Standard breed metrics
    standards: {
        adg: {                 // Average Daily Gain
          type: Number,        // recommended unit: grams/day
          min: [0, 'ADG cannot be negative'],
          default: null
        },
        fcr: {                 // Feed Conversion Ratio (lower is better)
          type: Number,        // dimensionless ratio
          min: [0, 'FCR cannot be negative'],
          default: null
        },
        birthWeight: {         // average birth weight
          type: Number,        // recommended unit: kg
          min: [0, 'Birth weight cannot be negative'],
          default: null
        }
        // 👉 add more later if you like (weaningWeight, matureWeight, etc.)    
      },
  
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
       
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Breed', Breedschema);