const mongoose = require('mongoose');

const Excludedschema=new mongoose.Schema(
    {
        tagId:{
            type: String,
            required: true
        },

        weight:{
            type: Number
        },
      
        excludedType:{
            type:String,
            enum:["death","sweep","sale"],
            required: true
            
        },
        Date:{
            type: Date
            
        },
       
        price:{
            type: Number
            
        },
        createdAt: {  
            type: Date,  
            default: Date.now  
        } ,
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
             },
             animalId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Animal'
                 },
         
    }
)

module.exports= mongoose.model('Excloded',Excludedschema)