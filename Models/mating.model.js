const mongoose = require('mongoose');

const Matinglschema=new mongoose.Schema(
    {
        tagId:{
            type: String,
            required: true
        },
        maleTag_id:{
            type: String,
            required: true
        },
       
        matingType:{
            type: String,
            required: true 
        },
        matingDate:{
            type: Date
            
        },
        sonarDate:{
            type: Date
            
        },
       
        sonarRsult:{
            type: String,
            enum:["positive","negative"],
        },

        expectedDeliveryDate:{
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
                default: Date.now  // Automatically set to the current date/time when created  
            } 
       
  
    }
)

Matinglschema.pre('save', function (next) {
    // Calculate expectedDeliveryDate before saving the document
    if (this.sonarRsult === 'positive') {
        const daysToAdd = 147; // Number of days to add after a positive sonar result
        this.expectedDeliveryDate = new Date(this.matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    
    next();
});

Matinglschema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();
    
    // First check if the update contains sonarResult and matingDate
    if (update.sonarRsult === 'positive') {
        if (update.matingDate) {
            // Check if matingDate is a valid date
            const matingDate = new Date(update.matingDate);
            if (!isNaN(matingDate.getTime())) {
                const daysToAdd = 147;
                update.expectedDeliveryDate = new Date(matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            } else {
                return next(new Error('Invalid matingDate provided in the update.'));
            }
        } else {
            // If matingDate is not provided in the update, fetch the document's current matingDate
            const doc = await this.model.findOne(this.getQuery());
            if (doc && doc.matingDate) {
                const matingDate = new Date(doc.matingDate);
                if (!isNaN(matingDate.getTime())) {
                    const daysToAdd = 147;
                    update.expectedDeliveryDate = new Date(matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                } else {
                    return next(new Error('Invalid matingDate in the document.'));
                }
            } else {
                // No matingDate to work with
                update.expectedDeliveryDate = undefined;
            }
        }
    } else if (update.sonarRsult === 'negative') {
        // If sonarResult is 'negative', remove the expectedDeliveryDate
        update.expectedDeliveryDate = null;
    }

    next();
});


module.exports= mongoose.model('Mating',Matinglschema)