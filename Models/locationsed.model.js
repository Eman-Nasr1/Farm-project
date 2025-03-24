const mongoose = require('mongoose');
const User = require('../Models/user.model');

const LocationShedschema = new mongoose.Schema({
 
    locationShedName: {
        type: String,
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

module.exports = mongoose.model('LocationShed', LocationShedschema);