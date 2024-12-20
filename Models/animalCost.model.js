const mongoose = require('mongoose');

const AnimalCostSchema = new mongoose.Schema({
    animalTagId: {
        type: String,
        required: true,
    },
    feedCost: {
        type: Number,
        default: 0, // Default to 0 if no feed cost
    },
    treatmentCost: {
        type: Number,
        default: 0, // Default to 0 if no treatment cost
    },
    totalCost: {
        type: Number, // Computed as feedCost + treatmentCost
    },
    date: {
        type: Date,
        default: Date.now,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

AnimalCostSchema.pre('save', function (next) {
    // Automatically calculate totalCost before saving
    this.totalCost = this.feedCost + this.treatmentCost;
    next();
});

module.exports = mongoose.model('AnimalCost', AnimalCostSchema);
