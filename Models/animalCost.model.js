const mongoose = require('mongoose');

const AnimalCostSchema = new mongoose.Schema({
    animalTagId: {
        type: String,
        required: true,
    },
    feedCost: {
        type: Number,
        default: 0,
    },
    treatmentCost: {
        type: Number,
        default: 0,
    },
    vaccineCost: {  // New field for vaccine costs
        type: Number,
        default: 0,
    },
    totalCost: {
        type: Number,
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

// Update the pre-save hook to include vaccineCost in total calculation
AnimalCostSchema.pre('save', function (next) {
    this.totalCost = this.feedCost + this.treatmentCost + this.vaccineCost;
    next();
});

module.exports = mongoose.model('AnimalCost', AnimalCostSchema);