const mongoose = require('mongoose');  
const Feed = require('../Models/feed.model');  
const User = require('../Models/user.model');

const ShedFeedSchema = new mongoose.Schema({  
    feed: {  
        type: mongoose.Schema.Types.ObjectId,  
        ref: 'Feed',  
        required: true  
    },  
    locationShed: {  
        type: String,  
        required: true  
    },  
    quantity: {  
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

module.exports = mongoose.model('ShedEntry', ShedFeedSchema);