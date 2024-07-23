const mongoose = require('mongoose');
const Breedingschema=new mongoose.Schema(
    {
        tagId:{
            type: String,
            required: true
        },
       
        deliveryState:{
            type: String,
           
        },
        deliveryDate:{
            type: Date
            
        },
       
        numberOfBriths:{
            type: Number
        },

        birthEntries: [{
            tagId: {
                type: String,
                required: true
            },
            gender: {
                type: String,
                enum: ['male', 'female']
            },
            birthweight:{
                type: Number
            }

        }],

        owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
         },
         animalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Animal'
             }
       
  
    }
)

module.exports= mongoose.model('Breeding',Breedingschema)