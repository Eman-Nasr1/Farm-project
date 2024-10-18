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




Animalschema.pre('save', function(next) {
    console.log('Final Animal Object:', this);
    if (this.birthDate) {
        const birthDate = new Date(this.birthDate);
        const currentDate = new Date();
        const ageInMilliseconds = currentDate - birthDate;
        this.ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
    }
    next();
});



// Pre-update hook to update ageInDays when birthDate is updated
Animalschema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();
    
    // If birthDate is being updated
    if (update.birthDate) {
        const birthDate = new Date(update.birthDate);
        const currentDate = new Date();
        const ageInMilliseconds = currentDate - birthDate;
        update.ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
    }

    next();
});

module.exports= mongoose.model('Animal',Animalschema)