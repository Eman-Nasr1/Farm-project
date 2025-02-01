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
    volume: {  
        type: Number,  
        required: true // Ensures that every treatment has a volume  
    },  
    price: {  
        type: Number,  
        required: true // Make it required to ensure every treatment has a price  
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
