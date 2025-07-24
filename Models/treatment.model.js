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
    expireDate:{
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



module.exports = mongoose.model('Treatment', TreatmentSchema);
