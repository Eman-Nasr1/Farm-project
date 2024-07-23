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
            enum:["goat","sheap"],
            required: true 
        },
        brithDate:{
            type: Date
            
        },
        ageInDays: {
            type: Number
        },
        purchaseData:{
            type: Date
        },
        tarderName:{
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
        },
        female_Condition:{
            type: String
        },

        owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
         }
       
        
   
         
    }
)

Animalschema.pre('save', function(next) {
   // console.log('Before saving - brithDate:', this.brithDate);
    if (this.brithDate) {
        const brithDate = new Date(this.brithDate);
        const currentDate = new Date();
        const ageInMilliseconds = currentDate - brithDate;
       this.ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
       
      // console.log('Calculated ageInDays:', this.ageInDays);
    }
 
    next();
    
});

module.exports= mongoose.model('Animal',Animalschema)