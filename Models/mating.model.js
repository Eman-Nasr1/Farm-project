const mongoose = require('mongoose');

const MatingSchema = new mongoose.Schema(
    {
        tagId: {
            type: String,
            required: true
        },
        maleTag_id: {
            type: String,
            required: true
        },
        matingType: {
            type: String,
            required: true 
        },
        matingDate: {
            type: Date
        },
        checkDays: {
            type: Number,
            enum: [45, 60, 90], // Only allow these specific values
            required: false // Optional field
        },
        sonarDate: {
            type: Date
        },
        sonarRsult: {
            type: String,
            enum: ["positive", "negative"],
        },
        expectedDeliveryDate: {
            type: Date
        },
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
            default: Date.now
        }
    }
);

// Pre-save hook to automatically calculate dates
MatingSchema.pre('save', function (next) {
    // Calculate sonarDate if checkDays and matingDate are provided
    if (this.checkDays && this.matingDate) {
        const sonarDate = new Date(this.matingDate);
        sonarDate.setDate(sonarDate.getDate() + this.checkDays);
        this.sonarDate = sonarDate;
    }

    // Calculate expectedDeliveryDate if sonarResult is positive
    if (this.sonarRsult === 'positive' && this.matingDate) {
        const daysToAdd = 147; // 147 days after mating for expected delivery
        this.expectedDeliveryDate = new Date(this.matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    next();
});

// Pre-update hook for findOneAndUpdate operations
MatingSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();
    
    // Calculate sonarDate if checkDays is being updated
    if (update.checkDays) {
        let matingDate;
        
        // If matingDate is provided in the update, use that
        if (update.matingDate) {
            matingDate = new Date(update.matingDate);
        } else {
            // Otherwise, get the current matingDate from the document
            const doc = await this.model.findOne(this.getQuery());
            matingDate = doc?.matingDate;
        }

        if (matingDate && !isNaN(matingDate.getTime())) {
            const sonarDate = new Date(matingDate);
            sonarDate.setDate(sonarDate.getDate() + update.checkDays);
            update.sonarDate = sonarDate;
        }
    }

    // Calculate expectedDeliveryDate if sonarResult is being updated to positive
    if (update.sonarRsult === 'positive') {
        let matingDate;
        
        if (update.matingDate) {
            matingDate = new Date(update.matingDate);
        } else {
            const doc = await this.model.findOne(this.getQuery());
            matingDate = doc?.matingDate;
        }

        if (matingDate && !isNaN(matingDate.getTime())) {
            const daysToAdd = 147;
            update.expectedDeliveryDate = new Date(matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
    } else if (update.sonarRsult === 'negative') {
        update.expectedDeliveryDate = null;
    }

    next();
});

module.exports = mongoose.model('Mating', MatingSchema);