const mongoose = require("mongoose");  

const treatmentEntrySchema = new mongoose.Schema({  
   locationShed: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LocationShed'
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
            doses: {  
                type: Number,  
                required: true,  
            },  
        },  
    ], 
    eyeCheck: {
        type: Boolean,
        default: false,
      },
      rectalCheck: {
        type: Boolean,
        default: false,
      },
      respiratoryCheck: {
        type: Boolean,
        default: false,
      },
      rumenCheck: {
        type: Boolean,
        default: false,
      },
       
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