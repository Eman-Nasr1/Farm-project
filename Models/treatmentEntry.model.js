const mongoose = require("mongoose");  

const treatmentEntrySchema = new mongoose.Schema({  
    locationShed: {  
        type: String,  
        required: true,  
    },  
    owner: {  
        type: mongoose.Schema.Types.ObjectId,  
        ref: "User",  
        required: true,  
    },  
    treatments: [  
        {  
            treatmentId: {  
                type: mongoose.Schema.Types.ObjectId,  
                ref: "Treatment", // Reference to the Treatment model  
                required: true,  
            },  
            volume: {  
                type: Number,  
                required: true,  
            },  
        },  
    ],  
    tagId: {  
        type: String, // Optional field for tag identifier  
    },  
    date: {  
        type: Date,  
        default: Date.now,  
    },  
}, { timestamps: true });  

const TreatmentEntry = mongoose.model("TreatmentEntry", treatmentEntrySchema);  

module.exports = TreatmentEntry;