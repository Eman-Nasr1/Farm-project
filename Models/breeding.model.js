const mongoose = require('mongoose');

const birthEntrySchema = new mongoose.Schema({
    tagId: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: true
    },
    birthweight: {
        type: Number
    },
    expectedWeaningDate: {
        type: Date
    },
    createdAt: {  
        type: Date,  
        default: Date.now  // Automatically set to the current date/time when created  
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const breedingSchema = new mongoose.Schema({
    tagId: {
        type: String,
        required: true
    },
    deliveryState: {
        type: String
    },
    deliveryDate: {
        type: Date,
        required: true
    },
    numberOfBriths: {
        type: Number
    },
    birthEntries: [birthEntrySchema],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    animalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Animal'
    },
    createdAt: {  
        type: Date,  
        default: Date.now  // Automatically set to the current date/time when created  
    }
});

breedingSchema.pre('save', function(next) {  
    // Check if deliveryDate is set  
    if (this.deliveryDate && this.birthEntries.length > 0) {  
        // Calculate expectedWeaningDate for each birth entry  
        this.birthEntries.forEach(entry => {  
            // Set expectedWeaningDate to 2 months after deliveryDate  
            const weaningDate = new Date(this.deliveryDate);  
            weaningDate.setMonth(weaningDate.getMonth() + 2);  
            entry.expectedWeaningDate = weaningDate;
            // Ensure the owner field is set for each birth entry
            entry.owner = this.owner;
        });  
    }  
    next();  
});

module.exports = mongoose.model('Breeding', breedingSchema);
