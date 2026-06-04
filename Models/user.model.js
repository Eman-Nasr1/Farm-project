const mongoose = require('mongoose');
const validator=require('validator');
const { syncEnabledAnimalTypes } = require('../utilits/animalTypes');
const Userschema=new mongoose.Schema(
    {
        name:{
            type:String,
            required:true
        },

        email:{
            type:String,
            required:true,
            unique:true,
            validate:[validator.isEmail,'filed must be a vaild email address']
        },
        password:{
            type:String,
            required:true
        },
        confirmpassword:{
            type:String,
            required:true
        },
        registerationType:{
            type:String,
            enum:["fattening","breeding"],
        },
        // Fattening only: small_ruminants | large_ruminants | all
        fatteningFarmProfile: {
            type: String,
            enum: ['small_ruminants', 'large_ruminants', 'all'],
        },
        enabledAnimalTypes: {
            type: [String],
            enum: ['sheep', 'goat', 'cattle', 'buffalo'],
            default: ['sheep', 'goat'],
        },
        phone:{
            type: String,
            required: true
        },
        token:{
            type:String
        },
        role:{
            type:String,
            enum:["user","admin"],
            default:"user"
        },
        country:{
            type: String,
            required: true
        },
        resetPasswordToken: {
            type: String,
          },
          resetPasswordExpires: {
            type: Date,
          },
        // Trial fields (managed by our app, not Stripe)
        trialStart: { 
            type: Date 
        },
        trialEnd: { 
            type: Date 
        },
        // Stripe subscription fields
        subscriptionStatus: { 
            type: String, 
            enum: ["active", "canceled", "past_due", "trialing", "none"], 
            default: "none" 
        },
        planId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Plan' 
        },
        stripeCustomerId: { 
            type: String 
        },
        stripeSubscriptionId: { 
            type: String 
        },
        subscriptionCurrentPeriodEnd: { 
            type: Date 
        },
        tenantCode: {
            type: String,
            unique: true,
            sparse: true, // Allow null values but enforce uniqueness for non-null
            index: true,
            uppercase: true,
            trim: true,
        },
        createdAt: {  
            type: Date,  
            default: Date.now  // Automatically set to the current date/time when created  
        } 
        
         
    }
)

Userschema.pre('save', function (next) {
    syncEnabledAnimalTypes(this);
    next();
});

module.exports= mongoose.model('User',Userschema)