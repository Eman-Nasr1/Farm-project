const mongoose = require('mongoose');
const User = require('../Models/user.model');

const Breedschema = new mongoose.Schema({
 
    breedName: {
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

module.exports = mongoose.model('Breed', Breedschema);