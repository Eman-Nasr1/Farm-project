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
    vaccineCost: {
        type: Number,
        default: 0,
    },
    purchasePrice: {
        type: Number,
        default: 0,
    },
    marketValue: {
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
    const baseCost = this.feedCost + this.treatmentCost + this.vaccineCost;

    // Add either purchasePrice or marketValue to the total cost
    if (this.purchasePrice && this.purchasePrice > 0) {
        this.totalCost = baseCost + this.purchasePrice;
    } else if (this.marketValue && this.marketValue > 0) {
        this.totalCost = baseCost + this.marketValue;
    } else {
        this.totalCost = baseCost;
    }

    next();
});

module.exports = mongoose.model('AnimalCost', AnimalCostSchema);