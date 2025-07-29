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
        sonarNotificationSent: {
            type: Boolean,
            default: false
        },
        deliveryNotificationSent: {
            type: Boolean,
            default: false
        },
        checkDays: {
            type: Number,
            enum: [45, 60, 90],
            required: false
        },
        sonarDate: {
            type: Date
        },
        sonarRsult: {
            type: String,
            enum: ["positive", "negative"],
        },
        // Number of fetuses (optional)
        fetusCount: {
            type: Number,
            min: 1
        },
        // Pregnancy age in days (optional)
        pregnancyAge: {
            type: Number,
            min: 0,
            max: 147 // Maximum pregnancy duration
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

    // Calculate expectedDeliveryDate based on pregnancyAge if provided
    if (this.pregnancyAge && this.matingDate) {
        const remainingDays = 147 - this.pregnancyAge;
        this.expectedDeliveryDate = new Date(this.matingDate.getTime() + remainingDays * 24 * 60 * 60 * 1000);
    }
    // Otherwise calculate normally if sonarResult is positive
    else if (this.sonarRsult === 'positive' && this.matingDate) {
        const daysToAdd = 147;
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
        
        if (update.matingDate) {
            matingDate = new Date(update.matingDate);
        } else {
            const doc = await this.model.findOne(this.getQuery());
            matingDate = doc?.matingDate;
        }

        if (matingDate && !isNaN(matingDate.getTime())) {
            const sonarDate = new Date(matingDate);
            sonarDate.setDate(sonarDate.getDate() + update.checkDays);
            update.sonarDate = sonarDate;
        }
    }

    // Handle expectedDeliveryDate calculation based on pregnancyAge
    if (update.pregnancyAge !== undefined) {
        let matingDate;
        
        if (update.matingDate) {
            matingDate = new Date(update.matingDate);
        } else {
            const doc = await this.model.findOne(this.getQuery());
            matingDate = doc?.matingDate;
        }

        if (matingDate && !isNaN(matingDate.getTime())) {
            const remainingDays = 147 - update.pregnancyAge;
            update.expectedDeliveryDate = new Date(matingDate.getTime() + remainingDays * 24 * 60 * 60 * 1000);
        }
    }
    // Otherwise calculate normally if sonarResult is positive
    else if (update.sonarRsult === 'positive') {
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