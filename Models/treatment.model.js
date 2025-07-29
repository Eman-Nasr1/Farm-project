const mongoose = require('mongoose');  
const User = require('./user.model');  

const TreatmentSchema = new mongoose.Schema({  
  name: {  
    type: String,  
    required: true   
  },  
  type: {  
    type: String,  
    required: true  
  },  
  stock: {  
    bottles: {
      type: Number,
      required: [true, 'Number of bottles is required'],
      min: [0, 'Bottles cannot be negative']
    },
    volumePerBottle: {
      type: Number,
      required: [true, 'Volume per bottle is required'],
      min: [0, 'Volume cannot be negative']
    },
    unitOfMeasure: {
      type: String,
      enum: ['ml', 'cm³', 'ampoule'],
      required: [true, 'Unit of measure is required']
    },
    totalVolume: {
      type: Number,
      default: 0
    }
  },
  pricing: {
    bottlePrice: {
      type: Number,
      required: [true, 'Bottle price is required'],
      min: [0, 'Price cannot be negative']
    }
  },  
  expireDate: {
    type: Date 
  },
  pricePerMl: {
    type: Number
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

TreatmentSchema.methods.isExpired = function () {
  return this.expireDate && new Date() > this.expireDate;
};

module.exports = mongoose.model('Treatment', TreatmentSchema);
