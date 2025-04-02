const mongoose = require("mongoose");  

const VaccineEntrySchema = new mongoose.Schema({  
   locationShed: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LocationShed'
      }, 
      Vaccine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vaccine'
  },
    owner: {  
        type: mongoose.Schema.Types.ObjectId,  
        ref: "User",  
        required: true,  
    },  
   
    tagId: {  
        type: String, // Optional field for tag identifier  
    },  
    date: {  
        type: Date,  
        default: Date.now,  
    },  
    entryType: {
       
            type: String,
            enum: ['First Dose', 'Booster Dose', 'Annual Dose','جرعة أولى', 'جرعة منشطة', 'جرعة سنوية'],
            required: true
         
   }
}, { timestamps: true });  

const VaccineEntry = mongoose.model("VaccineEntry", VaccineEntrySchema);  

module.exports = VaccineEntry;