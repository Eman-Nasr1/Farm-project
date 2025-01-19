const mongoose = require('mongoose');
const User = require('./user.model');
const Feedschema = new mongoose.Schema({
    name: {
        type: String,
       required: true 
    },
    type: {
        type: String,
        required: true
    },
    quantity: {  
        type: Number,  
        required: true  
    },
    price: {
        type: Number
    },
    concentrationOfDryMatter: { // New field added here  
        type: Number, // Percentage represented as a number  
        required:true,  
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




module.exports = mongoose.model('Feed', Feedschema);
