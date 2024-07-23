const mongoose = require('mongoose');
const Weightschema=new mongoose.Schema(
    {
        tag_id:{
            type: String,
            required: true
        },
       
        Date:{
            type: Date
            
        },
       
        weight:{
            type: Number
        },
        height:{
            type: Number
        },

        owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
         }
       
  
    }
)

module.exports= mongoose.model('Weight',Weightschema)