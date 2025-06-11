const mongoose = require('mongoose');
const validator=require('validator');
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
        createdAt: {  
            type: Date,  
            default: Date.now  // Automatically set to the current date/time when created  
        } 
        
         
    }
)

module.exports= mongoose.model('User',Userschema)