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
    
    if (update.sonarRsult === 'positive') {
        if (update.matingDate) {
            // Calculate the expected delivery date if sonarResult is 'positive' and matingDate is provided
            const daysToAdd = 147;
            update.expectedDeliveryDate = new Date(new Date(update.matingDate).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        } else {
            // If matingDate is not provided in the update, use the existing matingDate in the document
            const doc = await this.model.findOne(this.getQuery());
            if (doc && doc.matingDate) {
                const daysToAdd = 147;
                update.expectedDeliveryDate = new Date(new Date(doc.matingDate).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            } else {
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