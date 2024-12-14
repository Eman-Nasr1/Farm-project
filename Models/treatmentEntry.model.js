const mongoose = require('mongoose');  
const Treatment = require('../Models/trreatment.model');  
const User = require('../Models/user.model');

const TreatmentEntrySchema = new mongoose.Schema({  
    treatment: {  
        type: mongoose.Schema.Types.ObjectId,  
        ref: 'Treatment',  
        required: true  
    }, 
    tagId: {
        type: String 
    }, 
    locationShed: {  
        type: String,  
        required: true  
    },  
    volume: {  
        type: Number,  
        required: true 
    }, 
    date: {  
        type: Date,  
        default: Date.now,  
        required: true  
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

module.exports = mongoose.model('TreatmentEntry', TreatmentEntrySchema);