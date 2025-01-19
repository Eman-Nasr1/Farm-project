const mongoose = require('mongoose');

const FeedSchema = new mongoose.Schema({
    feed: {  
        type: mongoose.Schema.Types.ObjectId,  
        ref: 'Feed',  
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
    }
});

const ShedFeedSchema = new mongoose.Schema({
    locationShed: {  
        type: String,  
        required: true  
    },  
    feeds: [FeedSchema], // Embed multiple feeds for the location
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

module.exports = mongoose.model('ShedEntry', ShedFeedSchema);
