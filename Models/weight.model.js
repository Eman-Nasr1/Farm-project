const mongoose = require('mongoose');
const Weightschema = new mongoose.Schema(
    {
        tagId: {
            type: String,
            required: true
        },

        Date: {
            type: Date,
            required: true

        },

        weight: {
            type: Number,
            required: true
        },
        height: {
            type: Number
        },
        weightType: {
            type: String,
            enum: ["birth", "Weaning", "regular"],
            required: true
        },
        ADG: { type: Number },
        conversionEfficiency: { type: Number },
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
Weightschema.index({ owner: 1, animalId: 1, Date: 1, weightType: 1 }, { unique: true });
module.exports = mongoose.model('Weight', Weightschema)