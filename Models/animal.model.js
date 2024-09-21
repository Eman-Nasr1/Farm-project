const mongoose = require('mongoose');
const User=require('../Models/user.model');
const Animalschema=new mongoose.Schema(
    {
        tagId:{
            type: String,
            unique: true,
            required: true
        },
        breed:{
            type: String,
            required: true 
        },
        animalType:{
            type: String,
            enum:["goat","sheep"],
            required: true 
        },
        birthDate:{
            type: Date
            
        },
        ageInDays: {
            type: Number
        },
        purchaseData:{
            type: Date
        },
        purchasePrice:{
            type: Number
        },
        traderName:{
            type: String
        },
        motherId:{
            type: String
        },
        fatherId:{
            type: String
        },
        locationShed:{
            type: String
        },
        gender:{
            type: String,
            enum:["male","female"],
            required: true
        },
        female_Condition:{
            type: String
        },
        Teething:{
            type: String,
            enum:["two","four","six"],
        },

        owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
         },
         createdAt: {  
            type: Date,  
            default: Date.now  // Automatically set to the current date/time when created  
        } 
       
        
   
         
    }
)


// Animalschema.index({ owner: 1 });
// Animalschema.index({ createdAt: 1 });
// Animalschema.index({ animalType: 1 });

Animalschema.pre('save', function(next) {
   // console.log('Before saving - brithDate:', this.brithDate);
    if (this.birthDate) {
        const birthDate = new Date(this.birthDate);
        const currentDate = new Date();
        const ageInMilliseconds = currentDate - birthDate;
       this.ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
       
      // console.log('Calculated ageInDays:', this.ageInDays);
    }
 
    next();
    
});

module.exports= mongoose.model('Animal',Animalschema)